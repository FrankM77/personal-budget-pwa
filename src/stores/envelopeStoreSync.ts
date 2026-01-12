import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import type { Transaction, Envelope, DistributionTemplate, AppSettings } from '../models/types';

export type SyncSliceParams = {
  set: (partial: any) => void;
  get: () => any;
  getCurrentUserId: () => string;
  isNetworkError: (error: any) => boolean;
  loadFallbackData: () => Promise<any>;
  checkOnlineStatus: () => Promise<boolean>;
  clearUserData: () => void;
};

export const createSyncSlice = ({
  set,
  get,
  getCurrentUserId,
  isNetworkError,
  loadFallbackData,
  checkOnlineStatus,
  clearUserData,
}: SyncSliceParams) => {
  const fetchData = async () => {
    // Wrap everything to ensure this function NEVER rejects
    try {
      const state = get();
      const userId = getCurrentUserId();

      if (state.resetPending) {
        console.log('🔄 fetchData: Reset pending detected, performing Firebase reset instead...');
        await get().performFirebaseReset();
        return;
      }

      console.log('🔄 fetchData: Starting data fetch for user:', userId);
      
      // Check if we have cached data (from Zustand persist hydration)
      const hasCachedData = state.envelopes.length > 0 || state.transactions.length > 0;
      
      // If we have cached data, use it immediately and fetch in background
      if (hasCachedData) {
        console.log('📦 Using cached envelope data, fetching updates in background...');
        // Don't set isLoading to true - use cached data immediately
      } else {
        console.log('⏳ No cached envelope data, fetching from Firebase...');
        set({ isLoading: true, error: null });
      }
      
      try {
      // Create a timeout promise (5 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firebase query timeout')), 5000);
      });

      // Create fetch promise
      const fetchPromise = Promise.all([
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

      // Race between Firebase queries and timeout
      let fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings;
      [fetchedEnvelopes, fetchedTransactions, fetchedTemplates, fetchedSettings] = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]) as any;

      console.log('✅ fetchData: Firebase calls completed');
      console.log('📊 Fetched data counts:', {
        envelopes: fetchedEnvelopes?.length || 0,
        transactions: fetchedTransactions?.length || 0,
        templates: fetchedTemplates?.length || 0,
        settings: fetchedSettings ? 'found' : 'null'
      });

      get().markOnlineFromFirebaseSuccess();

      const hasFirebaseData = (fetchedEnvelopes?.length || 0) > 0 ||
        (fetchedTransactions?.length || 0) > 0 ||
        (fetchedTemplates?.length || 0) > 0;

      let fallbackData = null;
      if (!hasFirebaseData) {
        console.log('⚠️ No data from Firebase, loading fallback data...');
        fallbackData = await loadFallbackData();
        if (fallbackData) {
          console.log('✅ Using fallback data for initialization');
          fetchedEnvelopes = fallbackData.envelopes || [];
          fetchedTransactions = fallbackData.transactions || [];
          fetchedTemplates = fallbackData.distributionTemplates || [];
          fetchedSettings = fallbackData.appSettings || null;
        }
      }

      set((currentState: any) => {
        const convertTimestamps = (transactions: any[]): Transaction[] => {
          return transactions.map(tx => ({
            ...tx,
            date: tx.date && typeof tx.date === 'object' && tx.date.toDate
              ? tx.date.toDate().toISOString()
              : tx.date,
            type: tx.type === 'income' ? 'Income' : tx.type === 'expense' ? 'Expense' : tx.type === 'transfer' ? 'Transfer' : tx.type,
            amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount
          }));
        };

        const convertEnvelope = (firebaseEnv: any): Envelope => ({
          id: firebaseEnv.id,
          name: firebaseEnv.name,
          currentBalance: firebaseEnv.currentBalance || 0,
          lastUpdated: firebaseEnv.lastUpdated,
          isActive: firebaseEnv.isActive ?? true,
          orderIndex: firebaseEnv.orderIndex ?? 0,
          createdAt: firebaseEnv.createdAt,
          isPiggybank: firebaseEnv.isPiggybank,
          piggybankConfig: firebaseEnv.piggybankConfig
        });

        const envelopesToUpdate = fetchedEnvelopes.filter((env: any) => !('orderIndex' in env));
        if (envelopesToUpdate.length > 0) {
          console.log(`🔄 Migrating ${envelopesToUpdate.length} envelopes to add orderIndex...`);
          envelopesToUpdate.forEach((env: any, index: number) => {
            const orderIndex = index;
            const migrateUserId = getCurrentUserId();
            EnvelopeService.saveEnvelope(migrateUserId, { ...env, orderIndex })
              .then(() => console.log(`✅ Migrated envelope ${env.name} with orderIndex ${orderIndex}`))
              .catch(err => console.warn(`Failed to migrate envelope ${env.id}:`, err));
          });
        }

        const storeEnvelopes = fetchedEnvelopes.map(convertEnvelope);

        const mergedEnvelopeIds = new Set([
          ...currentState.envelopes.map((e: Envelope) => e.id),
          ...(fetchedEnvelopes as Envelope[]).map((e: Envelope) => e.id)
        ]);
        const localOnlyEnvelopes = currentState.envelopes.filter((env: Envelope) =>
          env.id && !(fetchedEnvelopes as Envelope[]).some((fetched: Envelope) => fetched.id === env.id) && !env.id.startsWith('temp-')
        );
        const localOnlyTransactions = currentState.transactions.filter((tx: Transaction) =>
          tx.id && !(fetchedTransactions as Transaction[]).some((fetched: Transaction) => fetched.id === tx.id) &&
          (!tx.id.startsWith('temp-') || mergedEnvelopeIds.has(tx.envelopeId))
        );

        let mergedTemplates: DistributionTemplate[];
        let localOnlyTemplates: DistributionTemplate[] = [];
        if (navigator.onLine) {
          mergedTemplates = fetchedTemplates as DistributionTemplate[];
          console.log(`🌐 Online mode: Using Firebase templates only (${mergedTemplates.length} templates)`);
        } else {
          localOnlyTemplates = currentState.distributionTemplates.filter((template: DistributionTemplate) =>
            template.id && !fetchedTemplates.some((fetched: any) => fetched.id === template.id)
          );
          mergedTemplates = (fetchedTemplates as DistributionTemplate[]).concat(localOnlyTemplates);
          console.log(`📴 Offline mode: Merged ${fetchedTemplates.length} Firebase + ${localOnlyTemplates.length} local templates`);
        }

        console.log('🔄 fetchData merge details:');
        console.log('  Store envelopes:', currentState.envelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log('  Firebase envelopes:', (fetchedEnvelopes as Envelope[]).map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log('  Store transactions:', currentState.transactions.map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log('  Firebase transactions:', (fetchedTransactions as Transaction[]).map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log('  Store templates:', currentState.distributionTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));
        console.log('  Firebase templates:', (fetchedTemplates as DistributionTemplate[]).map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));
        console.log('  Local-only envelopes:', localOnlyEnvelopes.map((e: Envelope) => ({ id: e.id, name: e.name })));
        console.log('  Local-only transactions:', localOnlyTransactions.map((t: Transaction) => ({ id: t.id, envelopeId: t.envelopeId, description: t.description })));
        console.log('  Local-only templates:', localOnlyTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));
        console.log('  Total merged templates:', mergedTemplates.length, mergedTemplates.map((t: DistributionTemplate) => ({ id: t.id, name: t.name })));

        const mergedEnvelopes = storeEnvelopes.concat(localOnlyEnvelopes);
        const mergedTransactions = convertTimestamps(fetchedTransactions as any[]).concat(localOnlyTransactions);

        let migratedSettings: AppSettings | null = fetchedSettings;
        if (fetchedSettings && 'isDarkMode' in fetchedSettings && !('theme' in fetchedSettings)) {
          const oldSettings = fetchedSettings as any;
          migratedSettings = {
            ...oldSettings,
            theme: oldSettings.isDarkMode ? 'dark' : 'light'
          };
          delete (migratedSettings as any).isDarkMode;

          if (migratedSettings && migratedSettings.id) {
            const migrateUserId = getCurrentUserId();
            AppSettingsService.updateAppSettings(migrateUserId, migratedSettings.id, { theme: migratedSettings.theme })
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
        console.error('⚠️ Firebase fetch failed:', err);
        
        // Check if we have cached data to fall back to
        const currentState = get();
        const hasCachedData = currentState.envelopes.length > 0 || currentState.transactions.length > 0;
        
        if (err.message === 'Firebase query timeout' || isNetworkError(err)) {
          if (hasCachedData) {
            console.log('📦 Using cached envelope data due to timeout/network error (likely offline)');
            set({ isLoading: false, pendingSync: true });
          } else {
            console.error('❌ No cached envelope data available');
            set({ isLoading: false, pendingSync: true, error: 'Unable to load data. Please check your connection.' });
          }
        } else {
          set({ error: err.message, isLoading: false });
        }
      }
      
      // Always resolve successfully - never let this function reject
    } catch (outerError: any) {
      console.error('❌ Critical error in fetchData:', outerError);
      set({ isLoading: false, error: 'Failed to load envelope data' });
      // Still don't reject - just log and set error state
    }
  };

  const syncData = async () => {
    if (!get().isOnline) return;

    const state = get();

    if (state.resetPending) {
      console.log('🔄 Sync detected pending reset - performing Firebase reset...');
      set({ pendingSync: true });
      try {
        await get().performFirebaseReset();
        console.log('✅ Pending reset completed during sync');
      } catch (err) {
        console.error('Firebase reset during sync failed:', err);
      }
      return;
    }

    set({ pendingSync: true });
    try {
      await get().fetchData();
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  };

  const updateOnlineStatus = async () => {
    const isActuallyOnline = await checkOnlineStatus();
    set({ isOnline: isActuallyOnline });
  };

  const markOnlineFromFirebaseSuccess = () => {
    const currentState = get();
    if (!currentState.isOnline) {
      console.log('✅ Firebase operation succeeded - marking as online');
      set({ isOnline: true });
    }
  };

  const handleUserLogout = () => {
    clearUserData();
  };

  const importData = async (data: any) => {
    try {
      if (!data.envelopes || !data.transactions) {
        return { success: false, message: 'Invalid backup format: Missing core data.' };
      }

      const userId = getCurrentUserId();
      console.log(`📥 Importing data for user: ${userId}`);

      // Clear Firebase data first (like resetData does)
      console.log('🗑️ Clearing existing Firebase data before import...');
      await performFirebaseReset();

      // Clear local state first
      set({
        envelopes: [],
        transactions: [],
        distributionTemplates: [],
        appSettings: null,
        error: null,
        pendingSync: true,
        isLoading: true,
      });
      console.log('✅ Local state cleared before import');

      const newEnvelopes = data.envelopes.map((env: any) => ({
        id: env.id || `imported-${Date.now()}-${Math.random()}`,
        name: env.name,
        currentBalance: env.currentBalance || env.budget || 0,
        lastUpdated: new Date().toISOString(),
        isActive: env.isActive ?? true,
        orderIndex: env.orderIndex ?? 0,
        userId,
      }));

      const newTransactions = data.transactions.map((tx: any) => ({
        ...tx,
        id: tx.id || `imported-${Date.now()}-${Math.random()}`,
        userId,
        date: tx.date,
        amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
        type: tx.type,
        reconciled: tx.reconciled ?? false,
      }));

      const newTemplates = (data.distributionTemplates || []).map((template: any) => ({
        ...template,
        id: template.id || `imported-${Date.now()}-${Math.random()}`,
        userId,
      }));

      const newSettings = data.appSettings
        ? {
            ...data.appSettings,
            id: data.appSettings.id || `settings-${userId}`,
            userId,
          }
        : null;

      console.log(`📊 Importing: ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions, ${newTemplates.length} templates`);

      set({
        envelopes: newEnvelopes,
        transactions: newTransactions,
        distributionTemplates: newTemplates,
        appSettings: newSettings,
        error: null,
        pendingSync: true,
      });

      try {
        console.log('🔄 Syncing imported data to Firebase...');

        for (const envelope of newEnvelopes) {
          try {
            await EnvelopeService.saveEnvelope(userId, envelope);
            console.log(`✅ Synced envelope: ${envelope.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync envelope ${envelope.name}:`, error);
          }
        }

        for (const transaction of newTransactions) {
          try {
            const firebaseTx = {
              ...transaction,
              amount: transaction.amount.toString(),
              type: transaction.type.toLowerCase(),
              date: Timestamp.fromDate(new Date(transaction.date)),
            };
            await TransactionService.addTransaction(firebaseTx);
            console.log(`✅ Synced transaction: ${transaction.description}`);
          } catch (error) {
            console.error(`❌ Failed to sync transaction ${transaction.description}:`, error);
          }
        }

        for (const template of newTemplates) {
          try {
            await DistributionTemplateService.createDistributionTemplate(template);
            console.log(`✅ Synced template: ${template.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync template ${template.name}:`, error);
          }
        }

        if (newSettings) {
          try {
            await AppSettingsService.createAppSettings(newSettings);
            console.log('✅ Synced app settings');
          } catch (error) {
            console.error('❌ Failed to sync app settings:', error);
          }
        }

        console.log('✅ All imported data synced to Firebase');
        set({ pendingSync: false, isLoading: false });
      } catch (syncError) {
        console.error('❌ Error syncing to Firebase:', syncError);
        set({ pendingSync: true });
      }

      const templateCount = newTemplates.length;
      const settingsImported = newSettings ? 'Settings imported.' : '';

      return {
        success: true,
        message: `Imported and synced ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions${
          templateCount > 0 ? `, ${templateCount} templates` : ''
        } to Firebase.${settingsImported ? ` ${settingsImported}` : ''}`,
      };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, message: 'Failed to import data. Check file format.' };
    }
  };

  const performFirebaseReset = async () => {
    console.log('🗑️ performFirebaseReset: Starting complete Firebase reset...');
    set({ isLoading: true });

    try {
      const userId = getCurrentUserId();
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

      if (allSettings?.id) {
        try {
          await AppSettingsService.deleteAppSettings(userId, allSettings.id);
          console.log('✅ Deleted app settings');
        } catch (error) {
          console.error('❌ Failed to delete app settings:', error);
        }
      }

      console.log(`✅ Firebase reset complete: Deleted ${deletedEnvelopes} envelopes, ${deletedTransactions} transactions, ${deletedTemplates} templates`);

      set({
        resetPending: false,
        isLoading: false,
        pendingSync: false,
      });
    } catch (error) {
      console.error('❌ Error during Firebase reset:', error);
      set({
        isLoading: false,
        pendingSync: true,
      });
      throw error;
    }
  };

  const resetData = async () => {
    console.log('🗑️ Starting complete data reset (offline-first)...');

    set({
      envelopes: [],
      transactions: [],
      distributionTemplates: [],
      appSettings: null,
      error: null,
      resetPending: true,
      isLoading: true,
    });

    console.log('✅ Local state cleared immediately');

    const state = get();
    if (state.isOnline) {
      console.log('🌐 Online - performing Firebase reset immediately...');
      try {
        await get().performFirebaseReset();
        console.log('✅ Firebase reset completed immediately');
      } catch (error) {
        console.error('❌ Firebase reset failed, will retry on next sync:', error);
        set({
          isLoading: false,
          pendingSync: true,
        });
      }
    } else {
      console.log('📴 Offline - Firebase reset will be performed when connection is restored');
      set({
        isLoading: false,
        pendingSync: true,
      });
    }
  };

  return {
    fetchData,
    syncData,
    updateOnlineStatus,
    markOnlineFromFirebaseSuccess,
    handleUserLogout,
    importData,
    performFirebaseReset,
    resetData,
  };
};
