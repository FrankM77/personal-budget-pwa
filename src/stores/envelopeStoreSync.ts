import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import { useMonthlyBudgetStore } from './monthlyBudgetStore';
import type { Transaction, Envelope, DistributionTemplate, AppSettings } from '../models/types';
import { toISOString } from '../utils/dateUtils';

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
              ? toISOString(tx.date)
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
        // Keep local-only envelopes including temp ones (pending sync)
        const localOnlyEnvelopes = currentState.envelopes.filter((env: Envelope) =>
          env.id && !(fetchedEnvelopes as Envelope[]).some((fetched: Envelope) => fetched.id === env.id)
        );
        
        // Only keep local-only transactions if:
        // 1. They're not in Firebase (pending sync)
        // 2. They're either temp transactions OR their envelope still exists in the merged set
        const localOnlyTransactions = currentState.transactions.filter((tx: Transaction) => {
          const notInFirebase = tx.id && !(fetchedTransactions as Transaction[]).some((fetched: Transaction) => fetched.id === tx.id);
          const isTempTransaction = tx.id && tx.id.startsWith('temp-');
          const envelopeExists = mergedEnvelopeIds.has(tx.envelopeId);
          
          const shouldKeep = notInFirebase && ((isTempTransaction && envelopeExists) || (!isTempTransaction && envelopeExists));
          
          if (notInFirebase && !shouldKeep) {
            console.log(`🗑️ Filtering out orphaned transaction: ${tx.id} (envelope: ${tx.envelopeId}, exists: ${envelopeExists})`);
          }
          
          // Keep if: not in Firebase AND (is temp with valid envelope OR is non-temp with valid envelope)
          return shouldKeep;
        });

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
    
    // Sync pending envelope deletions first
    if (state.pendingDeletes && state.pendingDeletes.length > 0) {
      console.log(`🗑️ Syncing ${state.pendingDeletes.length} pending envelope deletions to Firebase...`);
      const userId = getCurrentUserId();
      
      for (const envelopeId of state.pendingDeletes) {
        try {
          await EnvelopeService.deleteEnvelope(userId, envelopeId);
          console.log(`✅ Deleted envelope ${envelopeId} from Firebase`);
        } catch (err) {
          console.error(`❌ Failed to delete envelope ${envelopeId}:`, err);
        }
      }
      
      // Clear pending deletes after sync attempt
      set({ pendingDeletes: [] });
    }
    
    // Sync pending transaction deletions
    if (state.pendingDeletedTransactions && state.pendingDeletedTransactions.length > 0) {
      console.log(`🗑️ Syncing ${state.pendingDeletedTransactions.length} pending transaction deletions to Firebase...`);
      const userId = getCurrentUserId();
      
      for (const transactionId of state.pendingDeletedTransactions) {
        try {
          await TransactionService.deleteTransaction(userId, transactionId);
          console.log(`✅ Deleted transaction ${transactionId} from Firebase`);
        } catch (err) {
          console.error(`❌ Failed to delete transaction ${transactionId}:`, err);
        }
      }
      
      // Clear pending transaction deletes after sync attempt
      set({ pendingDeletedTransactions: [] });
    }
    
    // Sync pending income source deletions from monthlyBudgetStore
    try {
      const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
      const budgetStore = useMonthlyBudgetStore.getState();
      
      if (budgetStore.pendingDeletedIncomeSources && budgetStore.pendingDeletedIncomeSources.length > 0) {
        console.log(`🗑️ Syncing ${budgetStore.pendingDeletedIncomeSources.length} pending income source deletions to Firebase...`);
        const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
        const service = MonthlyBudgetService.getInstance();
        
        const userId = getCurrentUserId();
        for (const incomeSourceId of budgetStore.pendingDeletedIncomeSources) {
          try {
            await service.deleteIncomeSource(userId, incomeSourceId);
            console.log(`✅ Deleted income source ${incomeSourceId} from Firebase`);
          } catch (err) {
            console.error(`❌ Failed to delete income source ${incomeSourceId}:`, err);
          }
        }
        
        // Clear pending income source deletes after sync attempt
        useMonthlyBudgetStore.setState({ pendingDeletedIncomeSources: [] });
      }
    } catch (err) {
      console.error('Failed to sync income source deletions:', err);
    }
    
    // Sync temp envelopes to Firebase
    const tempEnvelopes = state.envelopes.filter((env: Envelope) => env.id.startsWith('temp-'));
    if (tempEnvelopes.length > 0) {
      console.log(`🔄 Syncing ${tempEnvelopes.length} temp envelopes to Firebase...`);
      
      for (const tempEnv of tempEnvelopes) {
        try {
          const { id, ...envelopeData } = tempEnv;
          // Ensure userId is present
          if (!envelopeData.userId) {
            envelopeData.userId = getCurrentUserId();
          }
          const savedEnv = await EnvelopeService.createEnvelope(envelopeData);
          console.log(`✅ Synced temp envelope ${id} -> ${savedEnv.id}`);
          
          // Replace temp envelope with real one
          set((state: any) => ({
            envelopes: state.envelopes.map((env: Envelope) =>
              env.id === id ? { ...savedEnv, order: tempEnv.order } : env
            )
          }));
          
          // Update transactions to point to new envelope ID
          set((state: any) => ({
            transactions: state.transactions.map((tx: Transaction) =>
              tx.envelopeId === id ? { ...tx, envelopeId: savedEnv.id } : tx
            )
          }));
          
          // Update allocations to point to new envelope ID
          const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
          const budgetStore = useMonthlyBudgetStore.getState();
          const updatedAllocations = budgetStore.envelopeAllocations.map(alloc =>
            alloc.envelopeId === id ? { ...alloc, envelopeId: savedEnv.id } : alloc
          );
          useMonthlyBudgetStore.setState({ envelopeAllocations: updatedAllocations });
          
          // Now sync the allocation for this envelope
          const tempAllocsForThisEnvelope = updatedAllocations.filter(alloc =>
            alloc.envelopeId === savedEnv.id && alloc.id?.startsWith('temp-')
          );
          
          if (tempAllocsForThisEnvelope.length > 0) {
            const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
            const service = MonthlyBudgetService.getInstance();
            
            for (const tempAlloc of tempAllocsForThisEnvelope) {
              try {
                await service.createEnvelopeAllocation({
                  envelopeId: tempAlloc.envelopeId,
                  budgetedAmount: tempAlloc.budgetedAmount,
                  userId: tempAlloc.userId,
                  month: tempAlloc.month
                });
                console.log(`✅ Synced allocation for envelope ${savedEnv.id}`);
              } catch (err) {
                console.error(`❌ Failed to sync allocation:`, err);
              }
            }
            
            // Refresh allocations to get real IDs
            const refreshedAllocations = await service.getEnvelopeAllocations(
              tempAllocsForThisEnvelope[0].userId,
              budgetStore.currentMonth
            );
            useMonthlyBudgetStore.setState({ envelopeAllocations: refreshedAllocations });
          }
        } catch (err) {
          console.error(`❌ Failed to sync temp envelope ${tempEnv.id}:`, err);
        }
      }
    }
    
    // Sync any remaining temp allocations to Firebase (only if their envelope has a real ID)
    try {
      const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
      const budgetStore = useMonthlyBudgetStore.getState();
      const tempAllocations = budgetStore.envelopeAllocations.filter(alloc => 
        alloc.id?.startsWith('temp-') && !alloc.envelopeId.startsWith('temp-')
      );
      
      if (tempAllocations.length > 0) {
        console.log(`🔄 Syncing ${tempAllocations.length} temp allocations to Firebase...`);
        const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
        const service = MonthlyBudgetService.getInstance();
        
        for (const tempAlloc of tempAllocations) {
          try {
            await service.createEnvelopeAllocation({
              envelopeId: tempAlloc.envelopeId,
              budgetedAmount: tempAlloc.budgetedAmount,
              userId: tempAlloc.userId,
              month: tempAlloc.month
            });
            console.log(`✅ Synced temp allocation ${tempAlloc.id} for envelope ${tempAlloc.envelopeId}`);
          } catch (err) {
            console.error(`❌ Failed to sync temp allocation ${tempAlloc.id}:`, err);
          }
        }
        
        // Refresh allocations to get real IDs and remove temp ones
        const refreshedAllocations = await service.getEnvelopeAllocations(
          budgetStore.envelopeAllocations[0]?.userId || getCurrentUserId(),
          budgetStore.currentMonth
        );
        useMonthlyBudgetStore.setState({ envelopeAllocations: refreshedAllocations });
        console.log('✅ Allocations refreshed after sync');
      }
    } catch (err) {
      console.error('Failed to sync temp allocations:', err);
    }
    
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
    set({ isImporting: true });
    try {
      if (!data.envelopes || !data.transactions) {
        return { success: false, message: 'Invalid backup format: Missing core data.' };
      }

      const userId = getCurrentUserId();
      console.log(`📥 Importing data for user: ${userId}`);
      console.log(`🔒 isImporting flag set to TRUE - real-time sync paused`);

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

      // Also clear monthly budget store
      const { clearMonthlyBudget } = useMonthlyBudgetStore.getState();
      await clearMonthlyBudget();
      console.log('✅ Monthly budget store cleared');

      // Process envelopes from backup
      const newEnvelopes = data.envelopes.map((env: any) => {
        console.log(`🔍 Raw envelope from backup:`, JSON.stringify(env, null, 2));
        const processedEnv = {
          ...env,
          id: env.id || `imported-${Date.now()}-${Math.random()}`,
          userId,
        };
        console.log(`📦 Processing envelope: ${processedEnv.name}`, {
          isPiggybank: processedEnv.isPiggybank,
          hasPiggybankConfig: !!processedEnv.piggybankConfig,
          piggybankConfig: processedEnv.piggybankConfig
        });
        return processedEnv;
      });

      // Process transactions from backup
      const newTransactions = data.transactions.map((tx: any) => ({
        ...tx,
        id: tx.id || `imported-${Date.now()}-${Math.random()}`,
        userId,
        date: tx.date,
        amount: typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount) || 0,
        type: tx.type,
        reconciled: tx.reconciled ?? false,
      }));

      // Process envelope allocations and income sources from backup
      const newEnvelopeAllocations = (data.envelopeAllocations || []).map((alloc: any) => ({
        ...alloc,
        id: alloc.id || `imported-${Date.now()}-${Math.random()}`,
        userId,
      }));

      // Deduplicate allocations by envelopeId - keep the last one for each envelope
      const deduplicatedAllocations = newEnvelopeAllocations.reduce((acc: any[], alloc: any) => {
        const existingIndex = acc.findIndex(a => a.envelopeId === alloc.envelopeId);
        if (existingIndex >= 0) {
          // Replace with the newer allocation
          acc[existingIndex] = alloc;
          console.log(`🔄 Deduplicating allocation for envelope ${alloc.envelopeId} - keeping newer one`);
        } else {
          acc.push(alloc);
        }
        return acc;
      }, []);

      console.log(`📊 After deduplication: ${deduplicatedAllocations.length} allocations (was ${newEnvelopeAllocations.length})`);

      const newIncomeSources = (data.incomeSources || []).map((source: any) => ({
        ...source,
        id: source.id || `imported-${Date.now()}-${Math.random()}`,
        userId,
      }));

      const newSettings = data.appSettings
        ? {
            ...data.appSettings,
            id: data.appSettings.id || `settings-${userId}`,
            userId,
          }
        : null;

      console.log(`📊 Importing: ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions, ${deduplicatedAllocations.length} allocations, ${newIncomeSources.length} income sources`);

      set({
        envelopes: newEnvelopes,
        transactions: newTransactions,
        distributionTemplates: [],
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

        // Import monthly budget data
        const MonthlyBudgetService = (await import('../services/MonthlyBudgetService')).MonthlyBudgetService.getInstance();
        
        for (const allocation of deduplicatedAllocations) {
          try {
            await MonthlyBudgetService.createEnvelopeAllocation(allocation);
            console.log(`✅ Synced allocation for envelope: ${allocation.envelopeId}`);
          } catch (error) {
            console.error(`❌ Failed to sync allocation:`, error);
          }
        }

        for (const source of newIncomeSources) {
          try {
            await MonthlyBudgetService.createIncomeSource(source);
            console.log(`✅ Synced income source: ${source.name}`);
          } catch (error) {
            console.error(`❌ Failed to sync income source ${source.name}:`, error);
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
        
        // Clear local state to force a fresh fetch from Firebase with correct IDs
        // This prevents duplicate transactions caused by local IDs not matching Firebase IDs
        console.log('🧹 Clearing local state to fetch fresh data with Firebase IDs...');
        set({
          envelopes: [],
          transactions: [],
          distributionTemplates: [],
          pendingSync: false,
          isLoading: false
        });
        
        // Fetch fresh data from Firebase to get correct IDs
        console.log('📥 Fetching fresh data from Firebase after import...');
        await get().fetchData();
        console.log('✅ Fresh data loaded from Firebase');
        
      } catch (syncError) {
        console.error('❌ Error syncing to Firebase:', syncError);
        set({ pendingSync: true });
      }

      const settingsImported = newSettings ? 'Settings imported.' : '';

      // Refresh available to budget after import (skip fetchMonthlyData to avoid duplicate piggybank processing)
      const { refreshAvailableToBudget, envelopeAllocations } = useMonthlyBudgetStore.getState();
      console.log('🔍 Checking allocations after import:');
      envelopeAllocations.forEach(alloc => {
        console.log(`  - ${alloc.envelopeId}: $${alloc.budgetedAmount}`);
      });
      const totalAllocated = envelopeAllocations.reduce((sum, alloc) => sum + alloc.budgetedAmount, 0);
      console.log(`💰 Total allocated after import: $${totalAllocated}`);
      
      await refreshAvailableToBudget();
      console.log('✅ Monthly budget available to budget refreshed');

      return {
        success: true,
        message: `Imported and synced ${newEnvelopes.length} envelopes, ${newTransactions.length} transactions, ${deduplicatedAllocations.length} allocations, ${newIncomeSources.length} income sources to Firebase.${settingsImported ? ` ${settingsImported}` : ''}`,
      };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, message: 'Failed to import data. Check file format.' };
    } finally {
      console.log(`🔓 isImporting flag set to FALSE - real-time sync resumed`);
      set({ isImporting: false });
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
