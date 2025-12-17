import { create } from 'zustand';
import { Decimal } from 'decimal.js';
import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import { useAuthStore } from './authStore';
import { createEnvelopeSlice } from './envelopeStoreEnvelopes';
import { createTemplateSlice } from './envelopeStoreTemplates';
import { createSettingsSlice } from './envelopeStoreSettings';

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
  error: string | null;
  isOnline: boolean;
  pendingSync: boolean;
  resetPending: boolean;
  testingConnectivity: boolean;

  // Actions
  fetchData: () => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  createEnvelope: (envelope: Omit<Envelope, 'id'>) => Promise<void>;
  addToEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  spendFromEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  updateTransaction: (updatedTx: Transaction) => Promise<void>;
  restoreTransaction: (transaction: Transaction) => Promise<void>;
  renameEnvelope: (envelopeId: string, newName: string) => Promise<void>;
  saveTemplate: (name: string, distributions: Record<string, number>, note: string) => void;
  deleteTemplate: (templateId: string) => void;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initializeAppSettings: () => Promise<void>;
  importData: (data: any) => Promise<{ success: boolean; message: string }>;
  resetData: () => Promise<void>;
  performFirebaseReset: () => Promise<void>;
  syncData: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  markOnlineFromFirebaseSuccess: () => void;
  handleUserLogout: () => void;
  getEnvelopeBalance: (envelopeId: string) => Decimal;

  // Template cleanup utilities
  cleanupOrphanedTemplates: () => Promise<void>;
  updateTemplateEnvelopeReferences: (oldEnvelopeId: string, newEnvelopeId: string) => Promise<void>;
  removeEnvelopeFromTemplates: (envelopeId: string) => Promise<void>;
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
    error: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingSync: false,
    resetPending: false
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
    testConnectivity('https://httpstat.us/200', { method: 'GET' }),
    testConnectivity('https://httpbin.org/status/200', { method: 'GET' }),

    // Secondary: CDN endpoints (widely accessible)
    testConnectivity('https://www.cloudflare.com/favicon.ico'),
    testConnectivity('https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'),

    // Tertiary: Firebase connectivity (direct relevance to our app)
    testConnectivity('https://firestore.googleapis.com/v1/projects/house-budget-pwa/databases/(default)/documents'),
    testConnectivity('https://firebase.googleapis.com/v1/projects/house-budget-pwa'),

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

export const useEnvelopeStore = create<EnvelopeStore>((set, get) => ({
  envelopes: [],
  transactions: [],
  distributionTemplates: [],
  appSettings: null,
  isLoading: false,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingSync: false,
  resetPending: false,
  testingConnectivity: false,

  /**
   * SYNC: Pulls all data from Firestore (Like Pull-to-Refresh)
   * Works offline thanks to Firestore persistence
   * Note: If resetPending is true, this will perform Firebase reset instead of fetching
   */
  fetchData: async () => {
    const state = get();
    const userId = getCurrentUserId();

    // If reset is pending, perform reset instead of fetching
    if (state.resetPending) {
      console.log('🔄 fetchData: Reset pending detected, performing Firebase reset instead...');
      await get().performFirebaseReset();
      return;
    }

    console.log('🔄 fetchData: Starting data fetch for user:', userId);
    set({ isLoading: true, error: null });
    try {
      // Fetch collections in parallel (works offline with Firestore persistence)
      console.log('🔄 fetchData: Making Firebase calls...');
      let fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings;
      [fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings] = await Promise.all([
        EnvelopeService.getAllEnvelopes(userId).catch(err => {
          console.error('❌ Failed to fetch envelopes:', err);
          return [];
        }),
        TransactionService.getAllTransactions(userId).catch(err => {
          console.error('❌ Failed to fetch transactions:', err);
          return [];
        }),
        DistributionTemplateService.getAllDistributionTemplates(userId).catch(err => {
          console.error('❌ Failed to fetch templates:', err);
          return [];
        }),
        AppSettingsService.getAppSettings(userId).catch(err => {
          console.error('❌ Failed to fetch settings:', err);
          return null;
        })
      ]);

      console.log('✅ fetchData: Firebase calls completed');
      console.log('📊 Fetched data counts:', {
        envelopes: fetchedEnvelopes?.length || 0,
        transactions: fetchedTransactions?.length || 0,
        templates: fetchedTemplates?.length || 0,
        settings: fetchedSettings ? 'found' : 'null'
      });

      // If we successfully fetched data from Firebase, we're definitely online
      get().markOnlineFromFirebaseSuccess();

      // Check if we got any data from Firebase
      const hasFirebaseData = (fetchedEnvelopes?.length || 0) > 0 ||
                             (fetchedTransactions?.length || 0) > 0 ||
                             (fetchedTemplates?.length || 0) > 0;

      // If no Firebase data, try to load fallback data
      let fallbackData = null;
      if (!hasFirebaseData) {
        console.log('⚠️ No data from Firebase, loading fallback data...');
        fallbackData = await loadFallbackData();
        if (fallbackData) {
          console.log('✅ Using fallback data for initialization');
          // Use fallback data
          fetchedEnvelopes = fallbackData.envelopes || [];
          fetchedTransactions = fallbackData.transactions || [];
          fetchedTemplates = fallbackData.distributionTemplates || [];
          fetchedSettings = fallbackData.appSettings || null;
        }
      }

      // Merge with existing data to preserve locally created items that might not be in Firebase yet
      set((state) => {
        // Convert Firebase Timestamps to strings for store compatibility
        const convertTimestamps = (transactions: any[]): Transaction[] => {
          return transactions.map(tx => ({
            ...tx,
            date: tx.date && typeof tx.date === 'object' && tx.date.toDate ?
              tx.date.toDate().toISOString() : tx.date, // Convert Timestamp to ISO string
            type: tx.type === 'income' ? 'Income' : tx.type === 'expense' ? 'Expense' : tx.type === 'transfer' ? 'Transfer' : tx.type, // Convert to TitleCase
            amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount // Ensure amount is number
          }));
        };

        // Convert Firebase envelopes to store format
        const convertEnvelope = (firebaseEnv: any): Envelope => ({
          id: firebaseEnv.id,
          name: firebaseEnv.name,
          currentBalance: firebaseEnv.currentBalance || 0,
          lastUpdated: firebaseEnv.lastUpdated,
          isActive: firebaseEnv.isActive ?? true,
          orderIndex: firebaseEnv.orderIndex ?? 0
        });

        // MIGRATION: Update envelopes that don't have orderIndex
        const envelopesToUpdate = fetchedEnvelopes.filter((env: any) => !('orderIndex' in env));
        if (envelopesToUpdate.length > 0) {
          console.log(`🔄 Migrating ${envelopesToUpdate.length} envelopes to add orderIndex...`);
          envelopesToUpdate.forEach((env: any, index: number) => {
            // Assign sequential orderIndex starting from 0
            // This ensures consistent ordering across store and Firebase
            const orderIndex = index;
            const userId = getCurrentUserId();
            EnvelopeService.saveEnvelope(userId, { ...env, orderIndex })
              .then(() => console.log(`✅ Migrated envelope ${env.name} with orderIndex ${orderIndex}`))
              .catch(err => console.warn(`Failed to migrate envelope ${env.id}:`, err));
          });
        }

        const storeEnvelopes = fetchedEnvelopes.map(convertEnvelope);

        // Merge: prefer Firebase data, but keep local items that aren't in Firebase yet
        const mergedEnvelopeIds = new Set([...state.envelopes.map((e: Envelope) => e.id), ...(fetchedEnvelopes as Envelope[]).map((e: Envelope) => e.id)]);
        const localOnlyEnvelopes = state.envelopes.filter((env: Envelope) => env.id && !(fetchedEnvelopes as Envelope[]).some((fetched: Envelope) => fetched.id === env.id) && !env.id.startsWith('temp-'));
        const localOnlyTransactions = state.transactions.filter((tx: Transaction) =>
          tx.id && !(fetchedTransactions as Transaction[]).some((fetched: Transaction) => fetched.id === tx.id) &&
          (!tx.id.startsWith('temp-') || mergedEnvelopeIds.has(tx.envelopeId)) // Keep temp transactions if they belong to a known envelope
        );
        // For templates: if we're online, prefer Firebase data (local templates should be auto-synced by Firestore)
        // If offline, keep local templates
        let mergedTemplates: DistributionTemplate[];
        let localOnlyTemplates: DistributionTemplate[] = [];
        if (navigator.onLine) {
          // Online: Use Firebase data as authoritative (local templates should be auto-synced by Firestore)
          mergedTemplates = fetchedTemplates as DistributionTemplate[];
          console.log(`🌐 Online mode: Using Firebase templates only (${mergedTemplates.length} templates)`);
        } else {
          // Offline: Merge Firebase + local templates
          localOnlyTemplates = state.distributionTemplates.filter(template =>
            template.id && !fetchedTemplates.some((fetched: any) => fetched.id === template.id)
          );
          mergedTemplates = (fetchedTemplates as DistributionTemplate[]).concat(localOnlyTemplates);
          console.log(`📴 Offline mode: Merged ${fetchedTemplates.length} Firebase + ${localOnlyTemplates.length} local templates`);
        }

        console.log(`🔄 fetchData merge details:`);
        console.log(`  Store envelopes:`, state.envelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log(`  Firebase envelopes:`, (fetchedEnvelopes as Envelope[]).map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log(`  Store transactions:`, state.transactions.map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Firebase transactions:`, (fetchedTransactions as Transaction[]).map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Store templates:`, state.distributionTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));
        console.log(`  Firebase templates:`, (fetchedTemplates as DistributionTemplate[]).map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));
        console.log(`  Local-only envelopes:`, localOnlyEnvelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log(`  Local-only transactions:`, localOnlyTransactions.map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Local-only templates:`, localOnlyTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));

        console.log(`  Total merged templates:`, mergedTemplates.length, mergedTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));

        const mergedEnvelopes = storeEnvelopes.concat(localOnlyEnvelopes);
        const mergedTransactions = convertTimestamps(fetchedTransactions as any[]).concat(localOnlyTransactions);

        console.log(`  Local-only envelopes:`, localOnlyEnvelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log(`  Merged envelopes will be:`, mergedEnvelopes.length, mergedEnvelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));

        // Migrate old appSettings format if needed
        let migratedSettings: AppSettings | null = fetchedSettings;
        if (fetchedSettings && 'isDarkMode' in fetchedSettings && !('theme' in fetchedSettings)) {
          // Migrate from old isDarkMode format to new theme format
          const oldSettings = fetchedSettings as any;
          migratedSettings = {
            ...oldSettings,
            theme: oldSettings.isDarkMode ? 'dark' : 'light'
          };
          // Remove the old field
          delete (migratedSettings as any).isDarkMode;

          // Update in Firebase to migrate the data
          if (migratedSettings && migratedSettings.id) {
            const userId = getCurrentUserId();
            AppSettingsService.updateAppSettings(userId, migratedSettings.id, { theme: migratedSettings.theme })
              .catch(err => console.warn('Failed to migrate app settings:', err));
          }
        }

        return {
          envelopes: mergedEnvelopes,
          transactions: mergedTransactions,
          distributionTemplates: mergedTemplates,
          appSettings: migratedSettings,
          isLoading: false,
          pendingSync: false
        };
      });
    } catch (err: any) {
      console.error("Sync Failed:", err);
      if (isNetworkError(err)) {
        // Don't show error for network issues - data might still be available locally
        set({ isLoading: false, pendingSync: true });
      } else {
        set({ error: err.message, isLoading: false });
      }
    }
  },

  /**
   * ACTION: Add Transaction (Offline-First)
   * Updates local state immediately, syncs with Firebase when possible
   */
  addTransaction: async (newTx) => {
    // Generate temporary ID for immediate UI update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const userId = getCurrentUserId();
    const transactionWithId = {
      ...newTx,
      id: tempId,
      userId: userId
    };

    // Update local state immediately for responsive UI
    set((state) => ({
      transactions: [...state.transactions, transactionWithId],
      isLoading: true
    }));

    // Only try to sync if the envelopeId is not a temp ID
    // (Transactions created with temp envelopeIds will sync after envelope syncs)
    if (!newTx.envelopeId.startsWith('temp-')) {
      try {
        // Try to sync with Firebase (works offline thanks to persistence)
        const transactionForService = {
          ...transactionWithId,
          amount: transactionWithId.amount.toString(), // Convert to string for Firebase
          type: transactionWithId.type.toLowerCase() as 'income' | 'expense' | 'transfer', // Convert to lowercase for Firebase
          date: Timestamp.fromDate(new Date(transactionWithId.date))
        };
        const savedTx = await TransactionService.addTransaction(transactionForService as any);

        // Replace temp transaction with real one from Firebase
        console.log(`🔄 Replacing temp transaction ${tempId} with Firebase transaction:`, savedTx);

        // Convert Timestamp back to string for store compatibility
        const convertedTx = convertFirebaseTransaction(savedTx);

        set((state) => ({
          transactions: state.transactions.map(tx =>
            tx.id === tempId ? (convertedTx as Transaction) : tx
          ),
          isLoading: false,
          pendingSync: false
        }));
      } catch (err: any) {
        console.error("Add Transaction Failed:", err);
        if (isNetworkError(err)) {
          // Offline: Keep the temp transaction, mark for later sync
          set({
            isLoading: false,
            pendingSync: true,
            error: null // Don't show error for offline scenarios
          });
        } else {
          // Real error: Remove temp transaction
          set((state) => ({
            transactions: state.transactions.filter(tx => tx.id !== tempId),
            error: err.message,
            isLoading: false
          }));
        }
      }
    } else {
      // Transaction has temp envelopeId, don't try to sync yet
      console.log(`⏳ Skipping Firebase sync for transaction with temp envelopeId: ${newTx.envelopeId}`);
      set({
        isLoading: false,
        pendingSync: true // Mark for later sync when envelope gets real ID
      });
    }
  },

  /**
   * ACTION: Create Envelope (Offline-First)
   * Updates local state immediately, syncs with Firebase when possible
   */
  createEnvelope: createEnvelopeSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).createEnvelope,

  /**
   * SYNC: Manual sync for when coming back online
   * Handles both normal sync (fetchData) and pending resets (performFirebaseReset)
   */
  syncData: async () => {
    if (!get().isOnline) return;

    const state = get();
    
    // If reset is pending, perform Firebase reset instead of fetching data
    if (state.resetPending) {
      console.log('🔄 Sync detected pending reset - performing Firebase reset...');
      set({ pendingSync: true });
      try {
        await get().performFirebaseReset();
        console.log('✅ Pending reset completed during sync');
      } catch (err) {
        console.error("Firebase reset during sync failed:", err);
        // Keep resetPending true so it retries next time
      }
      return;
    }

    // Normal sync: fetch data from Firebase
    set({ pendingSync: true });
    try {
      await get().fetchData();
    } catch (err) {
      console.error("Manual sync failed:", err);
    }
  },

  /**
   * UPDATE: Online status with actual connectivity check
   */
  updateOnlineStatus: async () => {
    const isActuallyOnline = await checkOnlineStatus();
    set({ isOnline: isActuallyOnline });
  },


  // Update online status based on successful Firebase operation
  markOnlineFromFirebaseSuccess: () => {
    const currentState = get();
    if (!currentState.isOnline) {
      console.log('✅ Firebase operation succeeded - marking as online');
      set({ isOnline: true });
    }
  },

  /**
   * ACTION: Handle user logout by clearing all user data
   */
  handleUserLogout: () => {
    clearUserData();
  },

  /**
   * ACTION: Add money to envelope (Income) - Offline-First
   */
  addToEnvelope: createEnvelopeSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).addToEnvelope,

  /**
   * ACTION: Spend money from envelope (Expense) - Offline-First
   */
  spendFromEnvelope: createEnvelopeSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).spendFromEnvelope,

  /**
   * ACTION: Transfer funds between envelopes - Offline-First
   */
  transferFunds: createEnvelopeSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).transferFunds,

  /**
   * ACTION: Delete envelope - Offline-First (Cascade Delete)
   */
  deleteEnvelope: createEnvelopeSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).deleteEnvelope,

  /**
   * ACTION: Delete transaction - Offline-First
   */
  deleteTransaction: async (transactionId: string) => {
    // Find the transaction to delete
    const transactionToDelete = get().transactions.find(tx => tx.id === transactionId);
    if (!transactionToDelete) return;

    // Store references for potential rollback
    const allTransactionsToDelete = [transactionId];

    // For transfers, also delete the paired transaction
    if (transactionToDelete.transferId) {
      const pairedTransaction = get().transactions.find(tx =>
        tx.transferId === transactionToDelete.transferId && tx.id !== transactionId
      );
      if (pairedTransaction && pairedTransaction.id) {
        allTransactionsToDelete.push(pairedTransaction.id);
      }
    }

    // Update local state immediately
    set((state) => ({
      transactions: state.transactions.filter(tx => tx.id && !allTransactionsToDelete.includes(tx.id)),
      isLoading: true
    }));

    try {
      // Delete from Firebase (skip temp IDs that haven't been synced yet)
      const userId = getCurrentUserId();
      const firebaseIdsToDelete = allTransactionsToDelete.filter(txId => !txId.startsWith('temp-'));

      for (const txId of firebaseIdsToDelete) {
        console.log(`🔄 About to delete transaction ID: ${txId}`);
        await TransactionService.deleteTransaction(userId, txId);
        console.log(`✅ Deleted transaction ID: ${txId}`);
      }

      console.log(`✅ All transaction deletions completed`);
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Delete Transaction Failed:", err);
      if (isNetworkError(err)) {
        // Offline: Keep the local deletion, mark for later sync
        set({
          isLoading: false,
          pendingSync: true,
          error: null
        });
      } else {
        // Real error: Restore the transactions locally
        const restoredTransactions = allTransactionsToDelete.map(txId => {
          // Find the original transaction (this is a simplified approach)
          return get().transactions.find(tx => tx.id === txId) || transactionToDelete;
        }).filter(Boolean);

        set((state) => ({
          transactions: [...state.transactions, ...restoredTransactions],
          error: err.message,
          isLoading: false
        }));
      }
    }
  },

  /**
   * ACTION: Update transaction - Offline-First
   */
  updateTransaction: async (updatedTx: Transaction) => {
    console.log('🔄 updateTransaction called:', updatedTx);

    // Update local state immediately
    set((state) => ({
      transactions: state.transactions.map(tx =>
        tx.id === updatedTx.id ? updatedTx : tx
      ),
      isLoading: true
    }));

    try {
      // Try Firebase update first with timeout for offline detection
      const userId = getCurrentUserId();
      const firebasePromise = TransactionService.updateTransaction(userId, updatedTx.id!, {
        description: updatedTx.description,
        amount: updatedTx.amount.toString(),
        envelopeId: updatedTx.envelopeId,
        date: Timestamp.fromDate(new Date(updatedTx.date)),
        type: updatedTx.type.toLowerCase() as any
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 5000)
      );

      await Promise.race([firebasePromise, timeoutPromise]);
      console.log('✅ Transaction updated in Firebase');

      set({ isLoading: false });
    } catch (err: any) {
      console.error("Update Transaction Failed:", err);
      console.log('🔍 Error details:', {
        name: (err as any)?.name || 'Unknown',
        message: (err as any)?.message || 'Unknown',
        code: (err as any)?.code || 'Unknown',
        isNetworkError: isNetworkError(err)
      });

      // For offline/network errors, keep the local changes and mark for later sync
      if (isNetworkError(err)) {
        console.log(`🔄 Treating as offline scenario - keeping local transaction update`);
        set({
          isLoading: false,
          pendingSync: true,
          error: null
        });
      } else {
        set({ error: err.message, isLoading: false });
      }
    }
  },

  /**
   * ACTION: Restore transaction - Offline-First
   */
  restoreTransaction: async (transaction: Transaction) => {
    // Update local state immediately
    set((state) => ({
      transactions: [...state.transactions, transaction],
      isLoading: true
    }));

    try {
      // Note: Firebase restore would require additional service methods
      // For now, we keep it local-only
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Restore Transaction Failed:", err);
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * ACTION: Import data from backup - Syncs to Firebase
   */
  importData: async (data: any) => {
    try {
      // Basic validation
      if (!data.envelopes || !data.transactions) {
        return { success: false, message: "Invalid backup format: Missing core data." };
      }

      const userId = getCurrentUserId();
      console.log(`📥 Importing data for user: ${userId}`);

      // Convert old format envelopes to new format if needed
      const newEnvelopes = data.envelopes.map((env: any) => ({
        id: env.id || `imported-${Date.now()}-${Math.random()}`, // Generate ID if missing
        name: env.name,
        currentBalance: env.currentBalance || env.budget || 0,
        lastUpdated: new Date().toISOString(),
        isActive: env.isActive ?? true,
        orderIndex: env.orderIndex ?? 0,
        userId: userId // Ensure userId is set
      }));

      // Convert transactions and ensure they have userId
      const newTransactions = data.transactions.map((tx: any) => ({
        ...tx,
        id: tx.id || `imported-${Date.now()}-${Math.random()}`, // Generate ID if missing
        userId: userId, // Ensure userId is set
        date: tx.date, // Keep as-is (should be ISO string)
        amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
        type: tx.type, // Keep as-is
        reconciled: tx.reconciled ?? false
      }));

      // Import distribution templates if present
      const newTemplates = (data.distributionTemplates || []).map((template: any) => ({
        ...template,
        id: template.id || `imported-${Date.now()}-${Math.random()}`, // Generate ID if missing
        userId: userId // Ensure userId is set
      }));

      // Import app settings if present
      const newSettings = data.appSettings ? {
        ...data.appSettings,
        id: data.appSettings.id || `settings-${userId}`,
        userId: userId // Ensure userId is set
      } : null;

      console.log(`📊 Importing: ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions, ${newTemplates.length} templates`);

      // Update local store immediately for responsive UI
      set({
        envelopes: newEnvelopes,
        transactions: newTransactions,
        distributionTemplates: newTemplates,
        appSettings: newSettings,
        error: null,
        pendingSync: true // Mark as pending sync since we're syncing to Firebase
      });

      // Sync imported data to Firebase
      try {
        console.log('🔄 Syncing imported data to Firebase...');

        // Sync envelopes to Firebase
        for (const envelope of newEnvelopes) {
          try {
            await EnvelopeService.saveEnvelope(userId, envelope);
            console.log(`✅ Synced envelope: ${envelope.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync envelope ${envelope.name}:`, error);
          }
        }

        // Sync transactions to Firebase
        for (const transaction of newTransactions) {
          try {
            const firebaseTx = {
              ...transaction,
              amount: transaction.amount.toString(), // Firebase expects string
              type: transaction.type.toLowerCase(), // Firebase uses lowercase
              date: Timestamp.fromDate(new Date(transaction.date))
            };
            await TransactionService.addTransaction(firebaseTx);
            console.log(`✅ Synced transaction: ${transaction.description}`);
          } catch (error) {
            console.error(`❌ Failed to sync transaction ${transaction.description}:`, error);
          }
        }

        // Sync templates to Firebase
        for (const template of newTemplates) {
          try {
            await DistributionTemplateService.createDistributionTemplate(template);
            console.log(`✅ Synced template: ${template.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync template ${template.name}:`, error);
          }
        }

        // Sync settings to Firebase
        if (newSettings) {
          try {
            await AppSettingsService.createAppSettings(newSettings);
            console.log('✅ Synced app settings');
          } catch (error) {
            console.error('❌ Failed to sync app settings:', error);
          }
        }

        console.log('✅ All imported data synced to Firebase');
        set({ pendingSync: false });

      } catch (syncError) {
        console.error('❌ Error syncing to Firebase:', syncError);
        // Keep pendingSync true so it retries later
        set({ pendingSync: true });
      }

      const templateCount = newTemplates.length;
      const settingsImported = newSettings ? 'Settings imported.' : '';

      return {
        success: true,
        message: `Imported and synced ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions${templateCount > 0 ? `, ${templateCount} templates` : ''} to Firebase.${settingsImported ? ` ${settingsImported}` : ''}`
      };
    } catch (error) {
      console.error("Import failed:", error);
      return { success: false, message: "Failed to import data. Check file format." };
    }
  },

  /**
   * ACTION: Perform complete Firebase reset - Query Firebase directly and delete ALL documents
   * This queries Firebase collections to find ALL documents (not just local cache) and deletes them
   */
  performFirebaseReset: async () => {
    console.log('🗑️ performFirebaseReset: Starting complete Firebase reset...');
    set({ isLoading: true });

    try {
      const userId = getCurrentUserId();
      // Query Firebase directly to get ALL documents from each collection
      console.log('📡 Querying Firebase for all data to delete...');

      const [allEnvelopes, allTransactions, allTemplates, allSettings] = await Promise.all([
        EnvelopeService.getAllEnvelopes(userId).catch(err => {
          console.error('❌ Failed to fetch envelopes for reset:', err);
          return [];
        }),
        TransactionService.getAllTransactions(userId).catch(err => {
          console.error('❌ Failed to fetch transactions for reset:', err);
          return [];
        }),
        DistributionTemplateService.getAllDistributionTemplates(userId).catch(err => {
          console.error('❌ Failed to fetch templates for reset:', err);
          return [];
        }),
        AppSettingsService.getAppSettings(userId).catch(err => {
          console.error('❌ Failed to fetch settings for reset:', err);
          return null;
        })
      ]);

      console.log(`📊 Found in Firebase: ${allEnvelopes.length} envelopes, ${allTransactions.length} transactions, ${allTemplates.length} templates`);

      // Delete all envelopes
      let deletedEnvelopes = 0;
      for (const envelope of allEnvelopes) {
        if (envelope.id) {
          try {
            await EnvelopeService.deleteEnvelope(userId, envelope.id);
            deletedEnvelopes++;
            console.log(`✅ Deleted envelope: ${envelope.name || envelope.id}`);
          } catch (error) {
            console.error(`❌ Failed to delete envelope ${envelope.id}:`, error);
          }
        }
      }

      // Delete all transactions
      let deletedTransactions = 0;
      for (const transaction of allTransactions) {
        if (transaction.id) {
          try {
            await TransactionService.deleteTransaction(userId, transaction.id);
            deletedTransactions++;
            console.log(`✅ Deleted transaction: ${transaction.id}`);
          } catch (error) {
            console.error(`❌ Failed to delete transaction ${transaction.id}:`, error);
          }
        }
      }

      // Delete all templates
      let deletedTemplates = 0;
      for (const template of allTemplates) {
        if (template.id) {
          try {
            await DistributionTemplateService.deleteDistributionTemplate(userId, template.id);
            deletedTemplates++;
            console.log(`✅ Deleted template: ${template.name || template.id}`);
          } catch (error) {
            console.error(`❌ Failed to delete template ${template.id}:`, error);
          }
        }
      }

      // Delete app settings if they exist
      if (allSettings?.id) {
        try {
          await AppSettingsService.deleteAppSettings(userId, allSettings.id);
          console.log(`✅ Deleted app settings`);
        } catch (error) {
          console.error(`❌ Failed to delete app settings:`, error);
        }
      }

      console.log(`✅ Firebase reset complete: Deleted ${deletedEnvelopes} envelopes, ${deletedTransactions} transactions, ${deletedTemplates} templates`);
      
      // Clear the reset pending flag
      set({ 
        resetPending: false,
        isLoading: false,
        pendingSync: false
      });

    } catch (error) {
      console.error('❌ Error during Firebase reset:', error);
      // Keep resetPending true so it retries later
      set({ 
        isLoading: false,
        pendingSync: true
      });
      throw error;
    }
  },

  /**
   * ACTION: Reset all data - Offline-first pattern
   * 1. Clear local state immediately (optimistic update)
   * 2. Set resetPending flag
   * 3. If online, perform Firebase reset immediately
   * 4. If offline, Firebase reset will happen when coming back online (via syncData)
   */
  resetData: async () => {
    console.log('🗑️ Starting complete data reset (offline-first)...');
    
    // STEP 1: Clear local state immediately (offline-first pattern)
    set({
      envelopes: [],
      transactions: [],
      distributionTemplates: [],
      appSettings: null,
      error: null,
      resetPending: true, // Mark reset as pending for sync
      isLoading: true
    });
    
    console.log('✅ Local state cleared immediately');

    // STEP 2: If online, perform Firebase reset immediately
    const state = get();
    if (state.isOnline) {
      console.log('🌐 Online - performing Firebase reset immediately...');
      try {
        await get().performFirebaseReset();
        console.log('✅ Firebase reset completed immediately');
      } catch (error) {
        console.error('❌ Firebase reset failed, will retry on next sync:', error);
        // Keep resetPending true so it retries when sync happens
        set({ 
          isLoading: false,
          pendingSync: true
        });
      }
    } else {
      console.log('📴 Offline - Firebase reset will be performed when connection is restored');
      set({ 
        isLoading: false,
        pendingSync: true // Mark for sync when back online
      });
    }
  },

  /**
   * ACTION: Rename envelope
   */
  renameEnvelope: async (envelopeId: string, newName: string) => {
    // Update local state immediately
    set((state) => ({
      envelopes: state.envelopes.map(env =>
        env.id === envelopeId ? { ...env, name: newName } : env
      ),
      isLoading: true
    }));

    try {
      // Note: Firebase update would require additional service methods
      // For now, we keep it local-only
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Rename Envelope Failed:", err);
      set({ error: err.message, isLoading: false });
    }
  },

  /**
   * ACTION: Save distribution template
   */
  saveTemplate: createTemplateSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).saveTemplate,

  /**
   * ACTION: Delete distribution template
   */
  deleteTemplate: createTemplateSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).deleteTemplate,

  /**
   * ACTION: Update app settings
   */
  updateAppSettings: createSettingsSlice({
    set,
    get,
    getCurrentUserId,
  }).updateAppSettings,

  /**
   * ACTION: Initialize app settings for new user
   */
  initializeAppSettings: createSettingsSlice({
    set,
    get,
    getCurrentUserId,
  }).initializeAppSettings,


  // Template cleanup utilities
  cleanupOrphanedTemplates: createTemplateSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).cleanupOrphanedTemplates,

  updateTemplateEnvelopeReferences: createTemplateSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).updateTemplateEnvelopeReferences,

  removeEnvelopeFromTemplates: createTemplateSlice({
    set,
    get,
    getCurrentUserId,
    isNetworkError,
  }).removeEnvelopeFromTemplates,

  /**
   * COMPUTED: Calculate envelope balance (purely transaction-based)
   * Note: Since we use transactions for all money movements (including initial deposits),
   * the balance is purely calculated from income minus expenses, ignoring the budget field.
   */
  getEnvelopeBalance: (envelopeId: string) => {
    const state = get();
    const envelope = state.envelopes.find(e => e.id === envelopeId);
    if (!envelope) {
      console.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
      return new Decimal(0);
    }

    const envelopeTransactions = state.transactions.filter(t => t.envelopeId === envelopeId);

    const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
    const incomes = envelopeTransactions.filter(t => t.type === 'Income');

    const totalSpent = expenses.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
    const totalIncome = incomes.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));

    const balance = totalIncome.minus(totalSpent);

    return balance;
  }
}));

// Helper functions for real-time sync data conversion
const convertFirebaseTransaction = (firebaseTx: any): Transaction => ({
  id: firebaseTx.id,
  date: firebaseTx.date?.toDate?.() ? firebaseTx.date.toDate().toISOString() : firebaseTx.date,
  amount: parseFloat(firebaseTx.amount) || 0,
  description: firebaseTx.description || '',
  envelopeId: firebaseTx.envelopeId || '',
  reconciled: firebaseTx.reconciled || false,
  type: firebaseTx.type === 'income' ? 'Income' : firebaseTx.type === 'expense' ? 'Expense' : 'Transfer',
  transferId: firebaseTx.transferId || undefined,
  userId: firebaseTx.userId || undefined
});

const convertFirebaseEnvelope = (firebaseEnv: any): Envelope => ({
  id: firebaseEnv.id,
  name: firebaseEnv.name || '',
  currentBalance: firebaseEnv.currentBalance || 0,
  lastUpdated: firebaseEnv.lastUpdated,
  isActive: firebaseEnv.isActive ?? true,
  orderIndex: firebaseEnv.orderIndex ?? 0,
  userId: firebaseEnv.userId || undefined
});

const convertFirebaseTemplate = (firebaseTemplate: any): DistributionTemplate => ({
  id: firebaseTemplate.id,
  name: firebaseTemplate.name || '',
  distributions: firebaseTemplate.distributions || {},
  lastUsed: firebaseTemplate.lastUsed?.toDate?.() ? firebaseTemplate.lastUsed.toDate().toISOString() : firebaseTemplate.lastUsed || new Date().toISOString(),
  note: firebaseTemplate.note || '',
  userId: firebaseTemplate.userId || undefined
});

// Setup real-time Firebase subscriptions for cross-tab/device sync
const setupRealtimeSubscriptions = () => {
  // Prevent duplicate subscriptions
  if ((window as any).__firebaseUnsubscribers) {
    console.log('⚠️ Real-time subscriptions already active, skipping setup');
    return;
  }

  console.log('🔄 Setting up real-time Firebase subscriptions...');

  const userId = getCurrentUserId();
  if (!userId) {
    console.log('⚠️ No authenticated user found, skipping real-time subscriptions');
    return;
  }

  // Subscribe to envelopes
  const unsubscribeEnvelopes = EnvelopeService.subscribeToEnvelopes(userId, (firebaseEnvelopes) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
      const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope);
      useEnvelopeStore.setState({ envelopes });
    }
  });

  // Subscribe to transactions
  const unsubscribeTransactions = TransactionService.subscribeToTransactions(userId, (firebaseTransactions) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Transactions updated', firebaseTransactions.length);
      const transactions = firebaseTransactions.map(convertFirebaseTransaction);
      useEnvelopeStore.setState({ transactions });
    }
  });

  // Subscribe to distribution templates
  const unsubscribeTemplates = DistributionTemplateService.subscribeToDistributionTemplates(userId, (firebaseTemplates) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Templates updated', firebaseTemplates.length);
      const distributionTemplates = firebaseTemplates.map(convertFirebaseTemplate);
      useEnvelopeStore.setState({ distributionTemplates });
    }
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(userId, (firebaseSettings) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Settings updated', firebaseSettings ? 'found' : 'null');
      useEnvelopeStore.setState({ appSettings: firebaseSettings });
    }
  });

  // Store unsubscribe functions for cleanup if needed
  (window as any).__firebaseUnsubscribers = {
    envelopes: unsubscribeEnvelopes,
    transactions: unsubscribeTransactions,
    templates: unsubscribeTemplates,
    settings: unsubscribeSettings
  };

  console.log('✅ Real-time subscriptions active - cross-device sync enabled');
};

// Setup online/offline detection and real-time sync after store creation
if (typeof window !== 'undefined') {
  // Listen to browser online/offline events
  window.addEventListener('online', async () => {
    console.log('📡 Browser online event detected');
    // When coming back online, check connectivity
    await useEnvelopeStore.getState().updateOnlineStatus();

    // If we're actually online and have pending sync or reset, auto-sync
    const state = useEnvelopeStore.getState();
    if (state.isOnline && (state.pendingSync || state.resetPending)) {
      console.log('🔄 Auto-syncing pending operations...');
      state.syncData();
    }
  });

  window.addEventListener('offline', () => {
    console.log('📴 Browser offline event detected');
    useEnvelopeStore.setState({ isOnline: false });
  });

  // Initial status check (quietly)
  setTimeout(() => {
    useEnvelopeStore.getState().updateOnlineStatus();
  }, 1000); // Delay initial check to avoid immediate noise

  // Periodic connectivity retry when offline (every 30 seconds)
  let offlineRetryInterval: ReturnType<typeof setInterval> | null = null;

  const startOfflineRetry = () => {
    if (offlineRetryInterval) clearInterval(offlineRetryInterval);
    offlineRetryInterval = setInterval(async () => {
      const currentState = useEnvelopeStore.getState();
      if (!currentState.isOnline && !currentState.testingConnectivity) {
        console.log('🔄 Periodic offline retry: testing connectivity...');
        useEnvelopeStore.setState({ testingConnectivity: true });

        try {
          const isNowOnline = await checkOnlineStatus();
          if (isNowOnline) {
            console.log('✅ Periodic retry succeeded - back online!');
            useEnvelopeStore.setState({ isOnline: true, testingConnectivity: false });
            // Trigger sync if needed
            if (currentState.pendingSync || currentState.resetPending) {
              useEnvelopeStore.getState().syncData();
            }
            // Stop the retry interval since we're online
            if (offlineRetryInterval) {
              clearInterval(offlineRetryInterval);
              offlineRetryInterval = null;
            }
          } else {
            useEnvelopeStore.setState({ testingConnectivity: false });
          }
        } catch (error) {
          console.log('❌ Periodic retry failed:', error);
          useEnvelopeStore.setState({ testingConnectivity: false });
        }
      } else if (currentState.isOnline) {
        // We're online, stop the retry interval
        if (offlineRetryInterval) {
          clearInterval(offlineRetryInterval);
          offlineRetryInterval = null;
        }
      }
    }, 30000); // Check every 30 seconds
  };

  // Start periodic retry on initial load
  startOfflineRetry();

  // Restart retry when going offline
  useEnvelopeStore.subscribe((state) => {
    if (!state.isOnline && !offlineRetryInterval) {
      console.log('🔄 Starting periodic connectivity retry');
      startOfflineRetry();
    }
  });

  // Check if user is already authenticated on app load
  const initialAuthState = useAuthStore.getState();
  if (initialAuthState.isAuthenticated && initialAuthState.currentUser) {
    console.log('✅ User already authenticated on app load, setting up real-time subscriptions');
    setupRealtimeSubscriptions();
  }

  // Listen for authentication changes
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.currentUser) {
      // User has logged in, set up real-time subscriptions
      console.log('✅ User authenticated, setting up real-time subscriptions');
      setupRealtimeSubscriptions();
    } else if (!state.isAuthenticated && !state.isLoading) {
      // User has logged out, clear their data and unsubscribe
      console.log('👋 User logged out, clearing data and unsubscribing');
      
      // Clean up Firebase subscriptions
      if ((window as any).__firebaseUnsubscribers) {
        const unsubscribers = (window as any).__firebaseUnsubscribers;
        if (unsubscribers.envelopes) unsubscribers.envelopes();
        if (unsubscribers.transactions) unsubscribers.transactions();
        if (unsubscribers.templates) unsubscribers.templates();
        if (unsubscribers.settings) unsubscribers.settings();
        delete (window as any).__firebaseUnsubscribers;
        console.log('🧹 Cleaned up Firebase subscriptions');
      }
      
      clearUserData();
    }
  });
}