import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Decimal } from 'decimal.js';
import { useAuthStore } from './authStore';
import { createEnvelopeSlice } from './envelopeStoreEnvelopes';
import { createTemplateSlice } from './envelopeStoreTemplates';
import { createSettingsSlice } from './envelopeStoreSettings';
import { createTransactionSlice } from './envelopeStoreTransactions';
import { createSyncSlice } from './envelopeStoreSync';
import { setupEnvelopeStoreRealtime } from './envelopeStoreRealtime';

import type { DistributionTemplate, AppSettings, Transaction, Envelope } from '../models/types';

// Fallback data loading when Firebase is unavailable
const loadFallbackData = async (): Promise<any> => {
  try {
    console.log('🔄 Attempting to load fallback data from backup file...');
    // Try to load the backup file - this will only work in development
    const response = await fetch('/HouseBudget_Backup_2025-11-25.json');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Loaded fallback data:', {
        envelopes: data.envelopes?.length || 0,
        transactions: data.transactions?.length || 0,
        templates: data.distributionTemplates?.length || 0
      });
      return data;
    }
  } catch (error) {
    console.log('⚠️ Could not load fallback data:', error);
  }
  return null;
};

interface EnvelopeStore {
  envelopes: Envelope[];
  transactions: Transaction[];
  distributionTemplates: DistributionTemplate[];
  appSettings: AppSettings | null;
  isLoading: boolean;
  isImporting: boolean;
  error: string | null;
  isOnline: boolean;
  pendingSync: boolean;
  resetPending: boolean;
  testingConnectivity: boolean;
  pendingDeletes: string[]; // Envelope IDs pending deletion from Firebase
  pendingDeletedTransactions: string[]; // Transaction IDs pending deletion from Firebase

  // Actions
  fetchData: () => Promise<void>;
  addEnvelope: (envelope: Omit<Envelope, 'id'>) => Promise<string>;
  updateEnvelope: (envelope: Envelope) => Promise<void>;
  reorderEnvelopes: (orderedIds: string[]) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  renameEnvelope: (envelopeId: string, newName: string) => Promise<void>;
  transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  restoreTransaction: (transaction: Transaction) => Promise<void>;
  addDistributionTemplate: (name: string, distributions: Record<string, number>, note: string) => Promise<void>;
  updateDistributionTemplate: (template: DistributionTemplate) => Promise<void>;
  deleteDistributionTemplate: (templateId: string) => Promise<void>;
  removeEnvelopeFromTemplates: (envelopeId: string) => Promise<void>;
  cleanupOrphanedTemplates: () => Promise<void>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initializeAppSettings: () => Promise<void>;
  getEnvelopeBalance: (envelopeId: string) => Decimal;
  resetAllData: () => Promise<void>;
  resetData: () => Promise<void>;
  importData: (data: any) => Promise<{ success: boolean; message: string }>;
  testConnectivity: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  syncData: () => Promise<void>;
  handleUserLogout: () => void;
}

// Get current user ID from auth store
const getCurrentUserId = (): string => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) {
    throw new Error('No authenticated user found');
  }
  return currentUser.id;
};

// Clear all user data when logging out
const clearUserData = () => {
  console.log('🧹 Clearing user data on logout');
  useEnvelopeStore.setState({
    envelopes: [],
    transactions: [],
    distributionTemplates: [],
    appSettings: null,
    isLoading: false,
    isImporting: false,
    error: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingSync: false,
    resetPending: false,
    pendingDeletes: [],
    pendingDeletedTransactions: []
  });
};

// Enhanced online/offline detection with multiple fallback methods
const checkOnlineStatus = async (): Promise<boolean> => {
  // Quick check: Browser's navigator.onLine
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    console.log('❌ Browser reports offline');
    return false;
  }

  const testConnectivity = async (url: string, options: RequestInit = {}): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      console.log(`⚠️ Connectivity test failed for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  };

  // Test multiple reliable endpoints (try in parallel for speed)
  const connectivityTests = [
    // Primary: HTTP status services (highly reliable)
    testConnectivity('https://httpbin.org/status/200', { method: 'GET' }),

    // Secondary: CDN endpoints (widely accessible)
    testConnectivity('https://www.cloudflare.com/favicon.ico'),
    testConnectivity('https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'),

    // Fallback: Original Google test (for networks that allow it)
    testConnectivity('https://www.google.com/favicon.ico'),
  ];

  console.log('🌐 Testing connectivity with multiple endpoints...');

  // Try tests in parallel, succeed if ANY pass
  try {
    const results = await Promise.allSettled(connectivityTests);

    const successfulTests = results.filter(result =>
      result.status === 'fulfilled' && result.value === true
    ).length;

    const totalTests = results.length;

    if (successfulTests > 0) {
      console.log(`✅ Connectivity confirmed (${successfulTests}/${totalTests} tests passed)`);
      return true;
    } else {
      console.log(`❌ All connectivity tests failed (${totalTests} tests)`);
      return false;
    }
  } catch (error) {
    console.log('❌ Connectivity testing error:', error);
    return false;
  }
};

// Helper: Check if error is network-related
const isNetworkError = (error: any): boolean => {
  // More comprehensive network error detection
  const errorCode = error?.code?.toLowerCase() || '';
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorName = error?.name?.toLowerCase() || '';

  // Firebase specific error codes
  if (errorCode === 'unavailable' || errorCode === 'cancelled') {
    return true;
  }

  // Network-related message patterns
  if (errorMessage.includes('network') ||
      errorMessage.includes('offline') ||
      errorMessage.includes('disconnected') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout')) {
    return true;
  }

  // Browser network errors
  if (errorMessage.includes('err_internet_disconnected') ||
      errorMessage.includes('err_network_changed') ||
      errorMessage.includes('err_connection_refused')) {
    return true;
  }

  // Check navigator state as fallback
  if (!navigator.onLine) {
    return true;
  }

  // Firebase WebChannel errors often have undefined name/message but are network related
  if (errorName === 'undefined' && errorMessage === 'undefined') {
    return true;
  }

  return false;
};

export const useEnvelopeStore = create<EnvelopeStore>()(
  persist(
    (set, get) => {
      // Instantiate all slices
      const envelopeSlice = createEnvelopeSlice({
        set,
        get,
        getCurrentUserId,
        isNetworkError,
      });
      const templateSlice = createTemplateSlice({
        set,
        get,
        getCurrentUserId,
        isNetworkError,
      });
      const settingsSlice = createSettingsSlice({
        set,
        get,
        getCurrentUserId,
      });
      const transactionSlice = createTransactionSlice({
        set,
        get,
        getCurrentUserId,
        isNetworkError,
      });
      const syncSlice = createSyncSlice({
        set,
        get,
        getCurrentUserId,
        isNetworkError,
        loadFallbackData,
        checkOnlineStatus,
        clearUserData,
      });

      return {
        // Initial state
        envelopes: [],
        transactions: [],
        distributionTemplates: [],
        appSettings: null,
        isLoading: false,
        isImporting: false,
        error: null,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        pendingSync: false,
        resetPending: false,
        testingConnectivity: false,
        pendingDeletes: [],
        pendingDeletedTransactions: [],

        // Delegated Actions from slices
        addEnvelope: async (newEnv: Omit<Envelope, 'id'>): Promise<string> => {
          const savedEnv = await envelopeSlice.createEnvelope(newEnv);
          return savedEnv.id;
        },
        updateEnvelope: envelopeSlice.updateEnvelope,
        reorderEnvelopes: envelopeSlice.reorderEnvelopes,
        deleteEnvelope: envelopeSlice.deleteEnvelope,
        renameEnvelope: envelopeSlice.renameEnvelope,
        transferFunds: envelopeSlice.transferFunds,
        addTransaction: transactionSlice.addTransaction,
        updateTransaction: transactionSlice.updateTransaction,
        deleteTransaction: transactionSlice.deleteTransaction,
        restoreTransaction: transactionSlice.restoreTransaction,
        addDistributionTemplate: templateSlice.saveTemplate,
        updateDistributionTemplate: templateSlice.updateTemplate,
        deleteDistributionTemplate: templateSlice.deleteTemplate,
        removeEnvelopeFromTemplates: templateSlice.removeEnvelopeFromTemplates,
        cleanupOrphanedTemplates: templateSlice.cleanupOrphanedTemplates,
        updateAppSettings: settingsSlice.updateAppSettings,
        initializeAppSettings: settingsSlice.initializeAppSettings,
        fetchData: syncSlice.fetchData,
        syncData: syncSlice.syncData,
        updateOnlineStatus: syncSlice.updateOnlineStatus,
        markOnlineFromFirebaseSuccess: syncSlice.markOnlineFromFirebaseSuccess,
        handleUserLogout: syncSlice.handleUserLogout,
        importData: syncSlice.importData,
        performFirebaseReset: syncSlice.performFirebaseReset,
        resetData: syncSlice.resetData,

        // Non-delegated utility methods
        getEnvelopeBalance: (envelopeId: string) => {
          const state = get();
          const envelope = state.envelopes.find(e => e.id === envelopeId);
          if (!envelope) {
            console.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
            return new Decimal(0);
          }

          // For piggybanks, calculate cumulative balance (all-time)
          // For regular envelopes, use all transactions (month filtering happens in views)
          const envelopeTransactions = state.transactions.filter(t => t.envelopeId === envelopeId);

          const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
          const incomes = envelopeTransactions.filter(t => t.type === 'Income');

          const totalSpent = expenses.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
          const totalIncome = incomes.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));

          const balance = totalIncome.minus(totalSpent);

          return balance;
        },
        
        // New method to get transactions for a specific month
        getTransactionsForMonth: (month: string) => {
          const state = get();
          return state.transactions.filter(t => t.month === month);
        },
        resetAllData: async () => {
          console.log('🔄 Resetting all data');
          set({
            envelopes: [],
            transactions: [],
            distributionTemplates: [],
            appSettings: null,
            isLoading: false,
            isImporting: false,
            error: null,
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            pendingSync: false,
            resetPending: false
          });
        },
        testConnectivity: async () => {
          console.log('🌐 Testing connectivity');
          await checkOnlineStatus();
        },
      };
    },
    {
      name: 'envelope-storage',
      partialize: (state) => ({
        envelopes: state.envelopes,
        transactions: state.transactions,
        distributionTemplates: state.distributionTemplates,
        appSettings: state.appSettings
      })
    }
  )
);

// Setup real-time Firebase subscriptions and online/offline detection
setupEnvelopeStoreRealtime({
  useEnvelopeStore,
  useAuthStore,
  getCurrentUserId: getCurrentUserId,
});
