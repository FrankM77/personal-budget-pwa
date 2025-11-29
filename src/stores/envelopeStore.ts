import { create } from 'zustand';
import { Decimal } from 'decimal.js';
import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import type { DistributionTemplate, AppSettings } from '../models/types';

// --- Types ---
export interface Transaction {
  id?: string;
  description: string;
  amount: string; // Match schema type (stored as string)
  envelopeId: string;
  date: string; // Keep as string for store, convert to Timestamp for services
  type: 'income' | 'expense';
  userId?: string;
  transferId?: string;
  reconciled?: boolean;
}

export interface Envelope {
  id?: string;
  name: string;
  budget?: number;
  category?: string;
  currentBalance?: number;
  lastUpdated?: string;
  isActive?: boolean;
  orderIndex?: number;
}

interface EnvelopeStore {
  envelopes: Envelope[];
  transactions: Transaction[];
  distributionTemplates: DistributionTemplate[];
  appSettings: AppSettings | null;
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  pendingSync: boolean;

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
  importData: (data: any) => { success: boolean; message: string };
  resetData: () => void;
  syncData: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  getEnvelopeBalance: (envelopeId: string) => Decimal;
}

// Temporary Hardcoded ID for Phase 2
const TEST_USER_ID = "test-user-123";

// Enhanced online/offline detection (silent)
const checkOnlineStatus = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.onLine) return false;

  try {
    // Try to fetch a small resource to verify actual connectivity (silent)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return true;
  } catch {
    // Silent failure - don't log network errors
    return false;
  }
};

// Helper: Check if error is network-related
const isNetworkError = (error: any): boolean => {
  return error?.code === 'unavailable' ||
         error?.code === 'cancelled' ||
         error?.message?.includes('network') ||
         error?.message?.includes('offline') ||
         error?.message?.includes('Failed to fetch') ||
         !navigator.onLine;
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

  /**
   * SYNC: Pulls all data from Firestore (Like Pull-to-Refresh)
   * Works offline thanks to Firestore persistence
   */
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      // Fetch collections in parallel (works offline with Firestore persistence)
      const [fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings] = await Promise.all([
        EnvelopeService.getAllEnvelopes(TEST_USER_ID).catch(err => {
          console.warn('Failed to fetch envelopes:', err);
          return [];
        }),
        TransactionService.getAllTransactions(TEST_USER_ID).catch(err => {
          console.warn('Failed to fetch transactions:', err);
          return [];
        }),
        DistributionTemplateService.getAllDistributionTemplates(TEST_USER_ID).catch(err => {
          console.warn('Failed to fetch templates:', err);
          return [];
        }),
        AppSettingsService.getAppSettings(TEST_USER_ID).catch(err => {
          console.warn('Failed to fetch settings:', err);
          return null;
        })
      ]);

      // Merge with existing data to preserve locally created items that might not be in Firebase yet
      set((state) => {
        // Convert Firebase Timestamps to strings for store compatibility
        const convertTimestamps = (transactions: any[]): Transaction[] => {
          return transactions.map(tx => ({
            ...tx,
            date: tx.date && typeof tx.date === 'object' && tx.date.toDate ?
              tx.date.toDate().toISOString() : tx.date // Convert Timestamp to ISO string
          }));
        };

        // Merge: prefer Firebase data, but keep local items that aren't in Firebase yet
        const mergedEnvelopes = (fetchedEnvelopes as unknown as Envelope[]).concat(
          state.envelopes.filter(env => !fetchedEnvelopes.some(fetched => fetched.id === env.id))
        );

        const mergedTransactions = convertTimestamps(fetchedTransactions as any[]).concat(
          state.transactions.filter(tx => !fetchedTransactions.some(fetched => fetched.id === tx.id))
        );

        // Migrate old appSettings format if needed
        let migratedSettings = fetchedSettings;
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
          AppSettingsService.updateAppSettings(TEST_USER_ID, fetchedSettings.id, { theme: migratedSettings.theme })
            .catch(err => console.warn('Failed to migrate app settings:', err));
        }

        return {
          envelopes: mergedEnvelopes,
          transactions: mergedTransactions,
          distributionTemplates: fetchedTemplates as DistributionTemplate[],
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
    const transactionWithId = {
      ...newTx,
      amount: newTx.amount.toString(), // Convert to string for Firebase
      id: tempId,
      userId: TEST_USER_ID
    };

    // Update local state immediately for responsive UI
    set((state) => ({
      transactions: [...state.transactions, transactionWithId],
      isLoading: true
    }));

    try {
      // Try to sync with Firebase (works offline thanks to persistence)
      const transactionForService = {
        ...transactionWithId,
        date: Timestamp.fromDate(new Date(transactionWithId.date))
      };
      const savedTx = await TransactionService.addTransaction(transactionForService as any);

      // Replace temp transaction with real one from Firebase
      console.log(`🔄 Replacing temp transaction ${tempId} with Firebase transaction:`, savedTx);

      // Convert Timestamp back to string for store compatibility
      const convertedTx = {
        ...savedTx,
        date: savedTx.date && typeof savedTx.date === 'object' && savedTx.date.toDate ?
          savedTx.date.toDate().toISOString() : savedTx.date
      };

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
  },

  /**
   * ACTION: Create Envelope (Offline-First)
   * Updates local state immediately, syncs with Firebase when possible
   */
  createEnvelope: async (newEnv) => {
    // Generate temporary ID for immediate UI update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const envelopeWithId = { ...newEnv, id: tempId };

    // Update local state immediately for responsive UI
    set((state) => ({
      envelopes: [...state.envelopes, envelopeWithId],
      isLoading: true
    }));

    try {
      // Try to sync with Firebase (works offline thanks to persistence)
      const envelopeForService = {
        ...newEnv,
        userId: TEST_USER_ID
      } as any; // Type assertion to include userId
      const savedEnv = await EnvelopeService.createEnvelope(envelopeForService);

      // Replace temp envelope with real one from Firebase
      set((state) => ({
        envelopes: state.envelopes.map(env =>
          env.id === tempId ? (savedEnv as unknown as Envelope) : env
        ),
        isLoading: false,
        pendingSync: false
      }));
    } catch (err: any) {
      console.error("Create Envelope Failed:", err);
      if (isNetworkError(err)) {
        // Offline: Keep the temp envelope, mark for later sync
        set({
          isLoading: false,
          pendingSync: true,
          error: null // Don't show error for offline scenarios
        });
      } else {
        // Real error: Remove temp envelope
        set((state) => ({
          envelopes: state.envelopes.filter(env => env.id !== tempId),
          error: err.message,
          isLoading: false
        }));
      }
    }
  },

  /**
   * SYNC: Manual sync for when coming back online
   */
  syncData: async () => {
    if (!get().isOnline) return;

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

  /**
   * ACTION: Add money to envelope (Income) - Offline-First
   */
  addToEnvelope: async (envelopeId: string, amount: number, note: string, date?: Date | string) => {
    const transactionDate = date
      ? typeof date === 'string' ? date : date.toISOString()
      : new Date().toISOString();

    await get().addTransaction({
      description: note,
      amount: amount.toString(),
      envelopeId,
      date: transactionDate,
      type: 'income'
    });
  },

  /**
   * ACTION: Spend money from envelope (Expense) - Offline-First
   */
  spendFromEnvelope: async (envelopeId: string, amount: number, note: string, date?: Date | string) => {
    const transactionDate = date
      ? typeof date === 'string' ? date : date.toISOString()
      : new Date().toISOString();

    await get().addTransaction({
      description: note,
      amount: amount.toString(),
      envelopeId,
      date: transactionDate,
      type: 'expense'
    });
  },

  /**
   * ACTION: Transfer funds between envelopes - Offline-First
   */
  transferFunds: async (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => {
    console.log(`Transferring ${amount} from ${fromEnvelopeId} to ${toEnvelopeId} with note: ${note}`);
    const transactionDate = date
      ? typeof date === 'string' ? date : date.toISOString()
      : new Date().toISOString();

    const transferId = `transfer-${Date.now()}-${Math.random()}`;

    // Create expense transaction from source envelope
    await get().addTransaction({
      description: `Transfer to ${get().envelopes.find(e => e.id === toEnvelopeId)?.name || 'envelope'}`,
      amount: amount.toString(),
      envelopeId: fromEnvelopeId,
      date: transactionDate,
      type: 'expense',
      transferId
    });

    // Create income transaction to destination envelope
    await get().addTransaction({
      description: `Transfer from ${get().envelopes.find(e => e.id === fromEnvelopeId)?.name || 'envelope'}`,
      amount: amount.toString(),
      envelopeId: toEnvelopeId,
      date: transactionDate,
      type: 'income',
      transferId
    });
  },

  /**
   * ACTION: Delete envelope - Offline-First (Cascade Delete)
   */
  deleteEnvelope: async (envelopeId: string) => {
    // Find transactions to delete
    const transactionsToDelete = get().transactions.filter(tx => tx.envelopeId === envelopeId);

    // Update local state immediately (cascade delete)
    set((state) => ({
      envelopes: state.envelopes.filter(env => env.id !== envelopeId),
      transactions: state.transactions.filter(tx => tx.envelopeId !== envelopeId),
      isLoading: true
    }));

    try {
      // Delete envelope from Firebase
      await EnvelopeService.deleteEnvelope(TEST_USER_ID, envelopeId);

      // Cascade delete: Delete all associated transactions from Firebase
      for (const transaction of transactionsToDelete) {
        if (transaction.id && !transaction.id.startsWith('temp-')) {
          await TransactionService.deleteTransaction(TEST_USER_ID, transaction.id);
        }
      }

      set({ isLoading: false });
    } catch (err: any) {
      console.error("Delete Envelope Failed:", err);
      if (isNetworkError(err)) {
        // Offline: Keep the local deletion, mark for later sync
        set({
          isLoading: false,
          pendingSync: true,
          error: null
        });
      } else {
        // Real error: Restore the envelope and transactions locally
        const restoredEnvelope = get().envelopes.find(env => env.id === envelopeId);
        if (restoredEnvelope) {
          set((state) => ({
            envelopes: [...state.envelopes, restoredEnvelope],
            transactions: [...state.transactions, ...transactionsToDelete],
            error: err.message,
            isLoading: false
          }));
        } else {
          set({ error: err.message, isLoading: false });
        }
      }
    }
  },

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
      const firebaseIdsToDelete = allTransactionsToDelete.filter(txId => !txId.startsWith('temp-'));

      for (const txId of firebaseIdsToDelete) {
        console.log(`🔄 About to delete transaction ID: ${txId}`);
        await TransactionService.deleteTransaction(TEST_USER_ID, txId);
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
    // Update local state immediately
    set((state) => ({
      transactions: state.transactions.map(tx =>
        tx.id === updatedTx.id ? updatedTx : tx
      ),
      isLoading: true
    }));

    try {
      // Note: Firebase update would require additional service methods
      // For now, we keep it local-only
      set({ isLoading: false });
    } catch (err: any) {
      console.error("Update Transaction Failed:", err);
      set({ error: err.message, isLoading: false });
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
   * ACTION: Import data from backup - Local only
   */
  importData: (data: any) => {
    try {
      // Basic validation
      if (!data.envelopes || !data.transactions) {
        return { success: false, message: "Invalid backup format: Missing core data." };
      }

      // Convert old format envelopes to new format if needed
      const newEnvelopes = data.envelopes.map((env: any) => ({
        id: env.id,
        name: env.name,
        budget: env.budget || env.currentBalance || 0,
        spent: env.spent || 0,
        category: env.category || 'General'
      }));

      // Use transactions as-is (they should be compatible)
      const newTransactions = data.transactions || [];

      // Import distribution templates if present
      const newTemplates = data.distributionTemplates || [];

      // Import app settings if present
      const newSettings = data.appSettings || null;

      // Update store
      set({
        envelopes: newEnvelopes,
        transactions: newTransactions,
        distributionTemplates: newTemplates,
        appSettings: newSettings,
        error: null,
        pendingSync: false
      });

      const templateCount = newTemplates.length;
      const settingsImported = newSettings ? 'Settings imported.' : '';

      return {
        success: true,
        message: `Loaded ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions${templateCount > 0 ? `, ${templateCount} templates` : ''}.${settingsImported ? ` ${settingsImported}` : ''}`
      };
    } catch (error) {
      console.error("Import failed:", error);
      return { success: false, message: "Failed to import data. Check file format." };
    }
  },

  /**
   * ACTION: Reset all data - Local only for safety
   */
  resetData: () => {
    set({
      envelopes: [],
      transactions: [],
      distributionTemplates: [],
      appSettings: null,
      error: null,
      pendingSync: false
    });
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
  saveTemplate: async (name: string, distributions: Record<string, number>, note: string) => {
    try {
      const templateData: DistributionTemplate = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced by Firebase
        userId: TEST_USER_ID,
        name,
        note,
        lastUsed: new Date().toISOString(),
        distributions
      };

      // Try Firebase save first
      const savedTemplate = await DistributionTemplateService.createDistributionTemplate(templateData);

      set((state) => ({
        distributionTemplates: [...state.distributionTemplates, savedTemplate]
      }));

      console.log('✅ Template saved to Firebase:', savedTemplate);
    } catch (error) {
      console.error('❌ Failed to save template to Firebase, saving locally:', error);

      // Fallback: save locally if Firebase fails
      const localTemplate: DistributionTemplate = {
        id: `local-${Date.now()}`,
        userId: TEST_USER_ID,
        name,
        note,
        lastUsed: new Date().toISOString(),
        distributions
      };

      set((state) => ({
        distributionTemplates: [...state.distributionTemplates, localTemplate]
      }));

      console.log('✅ Template saved locally as fallback:', localTemplate);
    }
  },

  /**
   * ACTION: Delete distribution template
   */
  deleteTemplate: async (templateId: string) => {
    try {
      await DistributionTemplateService.deleteDistributionTemplate(TEST_USER_ID, templateId);

      set((state) => ({
        distributionTemplates: state.distributionTemplates.filter(t => t.id !== templateId)
      }));

      console.log('✅ Template deleted from Firebase:', templateId);
    } catch (error) {
      console.error('❌ Failed to delete template from Firebase:', error);
      throw error;
    }
  },

  /**
   * ACTION: Update app settings
   */
  updateAppSettings: async (settings: Partial<AppSettings>) => {
    const state = get();

    if (!state.appSettings) {
      // If no settings exist, create them first
      try {
        await state.initializeAppSettings();
        // Now that settings exist, update them with the new values
        const newState = get();
        if (newState.appSettings) {
          // Merge the new settings with the initialized defaults
          const updatedSettings = { ...newState.appSettings, ...settings };
          set({ appSettings: updatedSettings });
          await AppSettingsService.updateAppSettings(TEST_USER_ID, newState.appSettings.id, settings);
          console.log('✅ App settings updated successfully');
        }
      } catch (error) {
        console.error('❌ Failed to initialize/update settings:', error);
      }
      return;
    }

    try {
      set((state) => ({
        appSettings: { ...state.appSettings!, ...settings }
      }));

      await AppSettingsService.updateAppSettings(TEST_USER_ID, state.appSettings!.id, settings);
      console.log('✅ App settings updated successfully');
    } catch (error) {
      console.error('❌ Failed to update app settings:', error);
      // Revert on failure
      set((state) => ({
        appSettings: state.appSettings // Keep original
      }));
      throw error;
    }
  },

  /**
   * ACTION: Initialize app settings for new user
   */
  initializeAppSettings: async () => {
    try {
      const defaultSettings: Omit<AppSettings, 'id'> = {
        userId: TEST_USER_ID,
        theme: 'system'
      };

      const createdSettings = await AppSettingsService.createAppSettings(defaultSettings);

      set({ appSettings: createdSettings });

      console.log('✅ App settings initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize app settings:', error);
      // Set default settings locally if Firebase fails
      set({
        appSettings: {
          id: 'local-settings',
          userId: TEST_USER_ID,
          theme: 'system'
        }
      });
    }
  },

  /**
   * COMPUTED: Calculate remaining budget
   */
  getEnvelopeBalance: (envelopeId: string) => {
    const state = get();
    const envelope = state.envelopes.find(e => e.id === envelopeId);
    if (!envelope) {
      console.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
      return new Decimal(0);
    }

    const envelopeTransactions = state.transactions.filter(t => t.envelopeId === envelopeId);
    console.log(`📊 getEnvelopeBalance: Envelope ${envelope.name} (${envelopeId}) has ${envelopeTransactions.length} transactions`);

    const expenses = envelopeTransactions.filter(t => t.type === 'expense');
    const incomes = envelopeTransactions.filter(t => t.type === 'income');

    const totalSpent = expenses.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
    const totalIncome = incomes.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));

    console.log(`💸 getEnvelopeBalance: Envelope ${envelope.name} - Budget: $${envelope.budget || 0}, Income: $${totalIncome.toNumber()}, Spent: $${totalSpent.toNumber()}, Balance: $${new Decimal(envelope.budget || 0).plus(totalIncome).minus(totalSpent).toNumber()}`);

    return new Decimal(envelope.budget || 0).plus(totalIncome).minus(totalSpent);
  }
}));

// Setup online/offline detection after store creation
if (typeof window !== 'undefined') {
  // Listen to browser online/offline events
  window.addEventListener('online', async () => {
    // When coming back online, check connectivity
    await useEnvelopeStore.getState().updateOnlineStatus();

    // If we're actually online and have pending sync, auto-sync
    const state = useEnvelopeStore.getState();
    if (state.isOnline && state.pendingSync) {
      console.log('🔄 Auto-syncing pending operations...');
      state.syncData();
    }
  });
  window.addEventListener('offline', () => {
    useEnvelopeStore.setState({ isOnline: false });
  });

  // Initial status check (quietly)
  setTimeout(() => {
    useEnvelopeStore.getState().updateOnlineStatus();
  }, 1000); // Delay initial check to avoid immediate noise
}