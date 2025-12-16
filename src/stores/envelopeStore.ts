import { create } from 'zustand';
import { Decimal } from 'decimal.js';
import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import type { DistributionTemplate, AppSettings } from '../models/types';

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
  resetPending: boolean;

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
  resetData: () => Promise<void>;
  performFirebaseReset: () => Promise<void>;
  syncData: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  getEnvelopeBalance: (envelopeId: string) => Decimal;

  // Template cleanup utilities
  cleanupOrphanedTemplates: () => Promise<void>;
  updateTemplateEnvelopeReferences: (oldEnvelopeId: string, newEnvelopeId: string) => Promise<void>;
  removeEnvelopeFromTemplates: (envelopeId: string) => Promise<void>;
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

  /**
   * SYNC: Pulls all data from Firestore (Like Pull-to-Refresh)
   * Works offline thanks to Firestore persistence
   * Note: If resetPending is true, this will perform Firebase reset instead of fetching
   */
  fetchData: async () => {
    const state = get();
    
    // If reset is pending, perform reset instead of fetching
    if (state.resetPending) {
      console.log('🔄 fetchData: Reset pending detected, performing Firebase reset instead...');
      await get().performFirebaseReset();
      return;
    }
    
    console.log('🔄 fetchData: Starting data fetch for user:', TEST_USER_ID);
    set({ isLoading: true, error: null });
    try {
      // Fetch collections in parallel (works offline with Firestore persistence)
      console.log('🔄 fetchData: Making Firebase calls...');
      let fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings;
      [fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings] = await Promise.all([
        EnvelopeService.getAllEnvelopes(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch envelopes:', err);
          return [];
        }),
        TransactionService.getAllTransactions(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch transactions:', err);
          return [];
        }),
        DistributionTemplateService.getAllDistributionTemplates(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch templates:', err);
          return [];
        }),
        AppSettingsService.getAppSettings(TEST_USER_ID).catch(err => {
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
              tx.date.toDate().toISOString() : tx.date // Convert Timestamp to ISO string
          }));
        };

        // Convert Firebase envelopes to store format
        const convertEnvelope = (firebaseEnv: any): Envelope => ({
          id: firebaseEnv.id,
          name: firebaseEnv.name,
          budget: firebaseEnv.currentBalance || 0,
          category: undefined, // Firebase envelopes don't have category
          currentBalance: firebaseEnv.currentBalance,
          lastUpdated: firebaseEnv.lastUpdated,
          isActive: firebaseEnv.isActive ?? true,
          orderIndex: firebaseEnv.orderIndex ?? 0
        });

        // MIGRATION: Update envelopes that don't have orderIndex
        const envelopesToUpdate = fetchedEnvelopes.filter(env => !('orderIndex' in env));
        if (envelopesToUpdate.length > 0) {
          console.log(`🔄 Migrating ${envelopesToUpdate.length} envelopes to add orderIndex...`);
          envelopesToUpdate.forEach((env, index) => {
            // Assign sequential orderIndex starting from 0
            // This ensures consistent ordering across store and Firebase
            const orderIndex = index;
            EnvelopeService.saveEnvelope(TEST_USER_ID, { ...env, orderIndex })
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
            template.id && !fetchedTemplates.some(fetched => fetched.id === template.id)
          );
          mergedTemplates = (fetchedTemplates as DistributionTemplate[]).concat(localOnlyTemplates);
          console.log(`📴 Offline mode: Merged ${fetchedTemplates.length} Firebase + ${localOnlyTemplates.length} local templates`);
        }

        console.log(`🔄 fetchData merge details:`);
        console.log(`  Store envelopes:`, state.envelopes.map(e => ({ id: e.id, name: e.name })));
        console.log(`  Firebase envelopes:`, fetchedEnvelopes.map(e => ({ id: e.id, name: e.name })));
        console.log(`  Store transactions:`, state.transactions.map(t => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Firebase transactions:`, fetchedTransactions.map(t => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Store templates:`, state.distributionTemplates.map(t => ({ id: t.id, name: t.name })));
        console.log(`  Firebase templates:`, fetchedTemplates.map(t => ({ id: t.id, name: t.name })));
        console.log(`  Local-only envelopes:`, localOnlyEnvelopes.map(e => ({ id: e.id, name: e.name })));
        console.log(`  Local-only transactions:`, localOnlyTransactions.map(t => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log(`  Local-only templates:`, localOnlyTemplates.map(t => ({ id: t.id, name: t.name })));

        console.log(`  Total merged templates:`, mergedTemplates.length, mergedTemplates.map(t => ({ id: t.id, name: t.name })));

        const mergedEnvelopes = storeEnvelopes.concat(localOnlyEnvelopes);
        const mergedTransactions = convertTimestamps(fetchedTransactions as any[]).concat(localOnlyTransactions);

        console.log(`  Local-only envelopes:`, localOnlyEnvelopes.map(e => ({ id: e.id, name: e.name })));
        console.log(`  Merged envelopes will be:`, mergedEnvelopes.length, mergedEnvelopes.map(e => ({ id: e.id, name: e.name })));

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
            AppSettingsService.updateAppSettings(TEST_USER_ID, migratedSettings.id, { theme: migratedSettings.theme })
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

    // Only try to sync if the envelopeId is not a temp ID
    // (Transactions created with temp envelopeIds will sync after envelope syncs)
    if (!newTx.envelopeId.startsWith('temp-')) {
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
  createEnvelope: async (newEnv) => {
    // For initial deposits, use transaction system instead of budget field
    // This ensures all money movements are properly tracked as transactions
    const hasInitialDeposit = newEnv.budget && newEnv.budget > 0;
    const envelopeData = hasInitialDeposit
      ? { ...newEnv, budget: 0, orderIndex: newEnv.orderIndex ?? 0 } // Set budget to 0, use transactions for balance
      : { ...newEnv, orderIndex: newEnv.orderIndex ?? 0 };

    // Generate temporary ID for immediate UI update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const envelopeWithId = { ...envelopeData, id: tempId };

    // Update local state immediately for responsive UI
    set((state) => ({
      envelopes: [...state.envelopes, envelopeWithId],
      isLoading: true
    }));

    // ALWAYS create the initial deposit transaction locally first (for immediate UI feedback)
    if (hasInitialDeposit) {
      console.log(`💰 Creating initial deposit transaction locally first: ${envelopeWithId.name} (tempId: ${tempId})`);
      try {
        await get().addTransaction({
          description: 'Initial Deposit',
          amount: newEnv.budget!.toString(),
          envelopeId: tempId, // Use temp ID initially
          date: new Date().toISOString(),
          type: 'income'
        });
        console.log(`✅ Initial deposit transaction created locally`);

        // Test balance calculation immediately
        const testBalance = get().getEnvelopeBalance(tempId);
        console.log(`💵 Test balance for temp envelope ${tempId}: $${testBalance.toNumber()}`);

      } catch (error) {
        console.error(`❌ Failed to create initial deposit transaction locally:`, error);
      }
    }

    // Now try to sync with Firebase
    try {
      console.log("📡 Attempting Firebase envelope creation...");
      const envelopeForService = {
        ...envelopeData,
        userId: TEST_USER_ID
      } as any;
      const savedEnv = await EnvelopeService.createEnvelope(envelopeForService);
      console.log("✅ Firebase envelope creation successful:", savedEnv);

      // Replace temp envelope with real one from Firebase
      // Convert Firebase envelope to store format
      const storeEnvelope: Envelope = {
        id: savedEnv.id,
        name: savedEnv.name,
        budget: savedEnv.currentBalance || 0, // Use currentBalance as budget
        category: undefined, // Firebase envelopes don't have category
        currentBalance: savedEnv.currentBalance,
        lastUpdated: savedEnv.lastUpdated,
        isActive: savedEnv.isActive ?? true,
        orderIndex: savedEnv.orderIndex ?? 0
      };

      set((state) => ({
        envelopes: state.envelopes.map(env =>
          env.id === tempId ? storeEnvelope : env
        ),
        isLoading: false,
        pendingSync: false
      }));

      // Update any transactions that reference the temp envelope ID and sync them
      if (hasInitialDeposit) {
        console.log(`🔄 Updating transactions from temp envelope ID ${tempId} to real ID ${savedEnv.id}`);
        console.log(`📊 Transactions before update:`, get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));

        // Update envelopeId for transactions
        set((state) => ({
          transactions: state.transactions.map(tx =>
            tx.envelopeId === tempId ? { ...tx, envelopeId: savedEnv.id } : tx
          )
        }));

        console.log(`📊 Transactions after envelopeId update:`, get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));

        // Now sync any transactions that were waiting for this envelope
        const transactionsToSync = get().transactions.filter(tx =>
          tx.envelopeId === savedEnv.id && tx.id && tx.id.startsWith('temp-')
        );

        console.log(`📡 Found ${transactionsToSync.length} transactions to sync for envelope ${savedEnv.id}:`, transactionsToSync.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId })));

        for (const tx of transactionsToSync) {
          try {
            console.log(`📤 Syncing transaction:`, tx);
            const transactionForService = {
              ...tx,
              date: Timestamp.fromDate(new Date(tx.date))
            };
            const savedTx = await TransactionService.addTransaction(transactionForService as any);

            console.log(`✅ Transaction synced:`, savedTx);

            // Replace temp transaction with real one
            const convertedTx = {
              ...savedTx,
              date: savedTx.date && typeof savedTx.date === 'object' && savedTx.date.toDate ?
                savedTx.date.toDate().toISOString() : savedTx.date
            };

            console.log(`🔄 Replacing temp transaction ${tx.id} with Firebase transaction ${savedTx.id}`);
            set((state) => ({
              transactions: state.transactions.map(t =>
                t.id === tx.id ? (convertedTx as Transaction) : t
              )
            }));

          } catch (syncError) {
            console.error(`❌ Failed to sync transaction ${tx.id}:`, syncError);
          }
        }

        console.log(`📊 Final transactions after sync:`, get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));
        set({ pendingSync: false });
        console.log(`✅ All transactions synced for envelope ${savedEnv.id}`);
      }

    } catch (err: any) {
      console.error("Create Envelope Failed:", err);
      console.log("Error details:", {
        code: err?.code,
        message: err?.message,
        name: err?.name,
        isNetworkError: isNetworkError(err)
      });

      // For offline/network errors, keep the local envelope and mark for later sync
      if (isNetworkError(err)) {
        console.log(`🔄 Treating as offline scenario - keeping temp envelope and transactions`);
        set({
          isLoading: false,
          pendingSync: true,
          error: null
        });
      } else {
        // For real errors, remove the local envelope
        console.log(`❌ Real error - removing temp envelope`);
        set((state) => ({
          envelopes: state.envelopes.filter(env => env.id !== tempId),
          transactions: state.transactions.filter(tx => tx.envelopeId !== tempId),
          error: err.message,
          isLoading: false
        }));
      }
    }
  },

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

      // Clean up templates that reference the deleted envelope
      await get().removeEnvelopeFromTemplates(envelopeId);

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
      const firebasePromise = TransactionService.updateTransaction(TEST_USER_ID, updatedTx.id!, {
        description: updatedTx.description,
        amount: updatedTx.amount,
        envelopeId: updatedTx.envelopeId,
        date: Timestamp.fromDate(new Date(updatedTx.date)),
        type: updatedTx.type
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
   * ACTION: Perform complete Firebase reset - Query Firebase directly and delete ALL documents
   * This queries Firebase collections to find ALL documents (not just local cache) and deletes them
   */
  performFirebaseReset: async () => {
    console.log('🗑️ performFirebaseReset: Starting complete Firebase reset...');
    set({ isLoading: true });

    try {
      // Query Firebase directly to get ALL documents from each collection
      console.log('📡 Querying Firebase for all data to delete...');
      
      const [allEnvelopes, allTransactions, allTemplates, allSettings] = await Promise.all([
        EnvelopeService.getAllEnvelopes(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch envelopes for reset:', err);
          return [];
        }),
        TransactionService.getAllTransactions(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch transactions for reset:', err);
          return [];
        }),
        DistributionTemplateService.getAllDistributionTemplates(TEST_USER_ID).catch(err => {
          console.error('❌ Failed to fetch templates for reset:', err);
          return [];
        }),
        AppSettingsService.getAppSettings(TEST_USER_ID).catch(err => {
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
            await EnvelopeService.deleteEnvelope(TEST_USER_ID, envelope.id);
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
            await TransactionService.deleteTransaction(TEST_USER_ID, transaction.id);
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
            await DistributionTemplateService.deleteDistributionTemplate(TEST_USER_ID, template.id);
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
          await AppSettingsService.deleteAppSettings(TEST_USER_ID, allSettings.id);
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
  saveTemplate: async (name: string, distributions: Record<string, number>, note: string) => {
    console.log('📝 saveTemplate called with:', { name, distributions, note });
    try {
      const templateData: DistributionTemplate = {
        id: `temp-${Date.now()}`, // Temporary ID, will be replaced by Firebase
        userId: TEST_USER_ID,
        name,
        note,
        lastUsed: new Date().toISOString(),
        distributions
      };

      console.log('🔄 Attempting Firebase template save...');
      console.log('📶 Current online status:', navigator.onLine);

      // Try Firebase save first with timeout for offline detection
      try {
        const firebasePromise = DistributionTemplateService.createDistributionTemplate(templateData);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 5000)
        );
        const savedTemplate = await Promise.race([firebasePromise, timeoutPromise]) as DistributionTemplate;
        console.log('✅ Firebase template save succeeded (online mode):', savedTemplate);

        set((state) => {
          const newTemplates = [...state.distributionTemplates, savedTemplate];
          console.log('🔄 Updating store - old templates:', state.distributionTemplates.length, 'new templates:', newTemplates.length);
          return {
            distributionTemplates: newTemplates
          };
        });

        console.log('✅ Template saved to Firebase:', savedTemplate);
        console.log('📊 Store now has templates:', get().distributionTemplates.length);
      } catch (firebaseError: any) {
        console.log('🔥 Firebase template save failed or timed out:', firebaseError.message);
        throw firebaseError; // Re-throw to trigger local fallback
      }
    } catch (error) {
      console.error('❌ Failed to save template to Firebase, saving locally:', error);
      console.log('🔍 Error details:', {
        name: (error as any)?.name || 'Unknown',
        message: (error as any)?.message || 'Unknown',
        code: (error as any)?.code || 'Unknown',
        isNetworkError: isNetworkError(error)
      });

      // Fallback: save locally if Firebase fails
      const localTemplate: DistributionTemplate = {
        id: `local-${Date.now()}`,
        userId: TEST_USER_ID,
        name,
        note,
        lastUsed: new Date().toISOString(),
        distributions
      };

      console.log('💾 Saving template locally (offline):', localTemplate);

      set((state) => ({
        distributionTemplates: [...state.distributionTemplates, localTemplate],
        pendingSync: true // Mark for later sync
      }));

      console.log('✅ Template saved locally as fallback:', localTemplate);
      console.log('📊 Store now has templates:', get().distributionTemplates.length);
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

  // Template cleanup utilities
  cleanupOrphanedTemplates: async () => {
    console.log('🧹 Cleaning up orphaned templates...');
    const templates = get().distributionTemplates;
    const envelopes = get().envelopes;
    const envelopeIds = new Set(envelopes.map(env => env.id));

    let cleanedCount = 0;
    for (const template of templates) {
      const originalDistributions = { ...template.distributions };
      const cleanedDistributions: Record<string, number> = {};

      // Keep only distributions for existing envelopes
      for (const [envId, amount] of Object.entries(template.distributions)) {
        if (envelopeIds.has(envId)) {
          cleanedDistributions[envId] = amount;
        }
      }

      // If template has no valid distributions left, delete it
      if (Object.keys(cleanedDistributions).length === 0) {
        console.log(`🗑️ Deleting orphaned template: ${template.name}`);
        await DistributionTemplateService.deleteDistributionTemplate(TEST_USER_ID, template.id);
        cleanedCount++;
      }
      // If template changed, update it
      else if (JSON.stringify(cleanedDistributions) !== JSON.stringify(originalDistributions)) {
        console.log(`🔧 Updating template ${template.name} - removed orphaned envelope references`);
        await DistributionTemplateService.updateDistributionTemplate(TEST_USER_ID, template.id, {
          distributions: cleanedDistributions
        });
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`✅ Cleaned up ${cleanedCount} templates`);
    } else {
      console.log('✅ No orphaned templates found');
    }
  },

  updateTemplateEnvelopeReferences: async (oldEnvelopeId: string, newEnvelopeId: string) => {
    console.log(`🔄 Updating template references: ${oldEnvelopeId} → ${newEnvelopeId}`);
    const templates = get().distributionTemplates;
    let updatedCount = 0;

    for (const template of templates) {
      if (template.distributions[oldEnvelopeId] !== undefined) {
        const updatedDistributions = { ...template.distributions };
        updatedDistributions[newEnvelopeId] = updatedDistributions[oldEnvelopeId];
        delete updatedDistributions[oldEnvelopeId];

        console.log(`📝 Updating template: ${template.name}`);
        await DistributionTemplateService.updateDistributionTemplate(TEST_USER_ID, template.id, {
          distributions: updatedDistributions
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ Updated ${updatedCount} templates with new envelope reference`);
    }
  },

  removeEnvelopeFromTemplates: async (envelopeId: string) => {
    console.log(`🗑️ Removing envelope ${envelopeId} from all templates`);
    const templates = get().distributionTemplates;
    let updatedCount = 0;
    let deletedCount = 0;

    for (const template of templates) {
      if (template.distributions[envelopeId] !== undefined) {
        const updatedDistributions = { ...template.distributions };
        delete updatedDistributions[envelopeId];

        // If no distributions left, delete the template
        if (Object.keys(updatedDistributions).length === 0) {
          console.log(`🗑️ Deleting template ${template.name} - no envelopes left`);
          await DistributionTemplateService.deleteDistributionTemplate(TEST_USER_ID, template.id);
          deletedCount++;
        } else {
          console.log(`📝 Removing envelope from template: ${template.name}`);
          await DistributionTemplateService.updateDistributionTemplate(TEST_USER_ID, template.id, {
            distributions: updatedDistributions
          });
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0 || deletedCount > 0) {
      console.log(`✅ Updated ${updatedCount} templates, deleted ${deletedCount} empty templates`);
    }
  },

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
const convertFirebaseTransaction = (firebaseTx: any) => ({
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

const convertFirebaseEnvelope = (firebaseEnv: any) => ({
  id: firebaseEnv.id,
  name: firebaseEnv.name || '',
  currentBalance: firebaseEnv.currentBalance || 0,
  lastUpdated: firebaseEnv.lastUpdated,
  isActive: firebaseEnv.isActive ?? true,
  orderIndex: firebaseEnv.orderIndex ?? 0,
  userId: firebaseEnv.userId || undefined
});

const convertFirebaseTemplate = (firebaseTemplate: any) => ({
  id: firebaseTemplate.id,
  name: firebaseTemplate.name || '',
  distributions: firebaseTemplate.distributions || {},
  lastUsed: firebaseTemplate.lastUsed?.toDate?.() ? firebaseTemplate.lastUsed.toDate().toISOString() : firebaseTemplate.lastUsed || new Date().toISOString(),
  note: firebaseTemplate.note || '',
  userId: firebaseTemplate.userId || undefined
});

// Setup real-time Firebase subscriptions for cross-tab/device sync
const setupRealtimeSubscriptions = () => {
  console.log('🔄 Setting up real-time Firebase subscriptions...');

  // Subscribe to envelopes
  const unsubscribeEnvelopes = EnvelopeService.subscribeToEnvelopes(TEST_USER_ID, (firebaseEnvelopes) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
      const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope);
      useEnvelopeStore.setState({ envelopes });
    }
  });

  // Subscribe to transactions
  const unsubscribeTransactions = TransactionService.subscribeToTransactions(TEST_USER_ID, (firebaseTransactions) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Transactions updated', firebaseTransactions.length);
      const transactions = firebaseTransactions.map(convertFirebaseTransaction);
      useEnvelopeStore.setState({ transactions });
    }
  });

  // Subscribe to distribution templates
  const unsubscribeTemplates = DistributionTemplateService.subscribeToDistributionTemplates(TEST_USER_ID, (firebaseTemplates) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Templates updated', firebaseTemplates.length);
      const distributionTemplates = firebaseTemplates.map(convertFirebaseTemplate);
      useEnvelopeStore.setState({ distributionTemplates });
    }
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(TEST_USER_ID, (firebaseSettings) => {
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
  // Set up real-time subscriptions first
  setupRealtimeSubscriptions();

  // Listen to browser online/offline events
  window.addEventListener('online', async () => {
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
    useEnvelopeStore.setState({ isOnline: false });
  });

  // Initial status check (quietly)
  setTimeout(() => {
    useEnvelopeStore.getState().updateOnlineStatus();
  }, 1000); // Delay initial check to avoid immediate noise
}