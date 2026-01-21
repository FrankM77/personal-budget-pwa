import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import { MonthlyBudgetService } from '../services/MonthlyBudgetService';
import type { DistributionTemplate, Transaction, Envelope, AppSettings, IncomeSource, EnvelopeAllocation } from '../models/types';
import { fromFirestore } from '../mappers/transaction';

type BudgetStoreLike = {
  getState: () => {
    isOnline: boolean;
    pendingSync: boolean;
    resetPending: boolean;
    isImporting: boolean;
    testingConnectivity: boolean;
    updateOnlineStatus: () => Promise<void>;
    syncData: () => Promise<void>;
    handleUserLogout: () => void;
    currentMonth: string;
    incomeSources: Record<string, any[]>;
    allocations: Record<string, any[]>;
    isAuthenticated?: boolean;
  };
  setState: (partial: any) => void;
  subscribe: (listener: (state: any) => void) => () => void;
};

type AuthStoreLike = {
  getState: () => { isAuthenticated: boolean; currentUser: { id: string } | null };
  subscribe: (listener: (state: any) => void) => () => void;
};

const convertFirebaseIncomeSource = (firebaseSource: any): IncomeSource => ({
  id: firebaseSource.id,
  userId: firebaseSource.userId,
  month: firebaseSource.month,
  name: firebaseSource.name,
  amount: typeof firebaseSource.amount === 'string' ? parseFloat(firebaseSource.amount) : firebaseSource.amount,
  frequency: firebaseSource.frequency,
  category: firebaseSource.category,
  createdAt: firebaseSource.createdAt,
  updatedAt: firebaseSource.updatedAt
});

const convertFirebaseAllocation = (firebaseAllocation: any): EnvelopeAllocation => ({
  id: firebaseAllocation.id,
  userId: firebaseAllocation.userId,
  month: firebaseAllocation.month,
  envelopeId: firebaseAllocation.envelopeId,
  budgetedAmount: typeof firebaseAllocation.budgetedAmount === 'string' ? parseFloat(firebaseAllocation.budgetedAmount) : firebaseAllocation.budgetedAmount,
  createdAt: firebaseAllocation.createdAt,
  updatedAt: firebaseAllocation.updatedAt
});

// Helper functions for real-time sync data conversion
const convertFirebaseTransaction = (firebaseTx: any): Transaction => fromFirestore(firebaseTx);

const convertFirebaseEnvelope = (firebaseEnv: any): Envelope => ({
  id: firebaseEnv.id,
  name: firebaseEnv.name || '',
  currentBalance: firebaseEnv.currentBalance || 0,
  lastUpdated: firebaseEnv.lastUpdated?.toDate?.() ? firebaseEnv.lastUpdated.toDate().toISOString() : firebaseEnv.lastUpdated,
  isActive: firebaseEnv.isActive ?? true,
  orderIndex: firebaseEnv.orderIndex ?? 0,
  userId: firebaseEnv.userId || undefined,
  createdAt: firebaseEnv.createdAt?.toDate?.() ? firebaseEnv.createdAt.toDate().toISOString() : firebaseEnv.createdAt,
  isPiggybank: firebaseEnv.isPiggybank,
  piggybankConfig: firebaseEnv.piggybankConfig
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
const setupRealtimeSubscriptions = (budgetStore: any, userId: string) => {
  // Prevent duplicate subscriptions
  if ((window as any).__firebaseUnsubscribers) {
    console.log('⚠️ Real-time subscriptions already active, skipping setup');
    return;
  }

  console.log('🔄 Setting up real-time Firebase subscriptions...');

  // Get current month for income sources and allocations
  const currentMonth = budgetStore.getState().currentMonth;
  console.log('📅 Current month for subscriptions:', currentMonth);

  // Subscribe to envelopes
  const unsubscribeEnvelopes = EnvelopeService.subscribeToEnvelopes(userId, (firebaseEnvelopes) => {
    const currentState = budgetStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
      const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope);
      budgetStore.setState({ envelopes });
    } else {
      console.log('⏸️ Real-time sync: BLOCKED envelope update', {
        isOnline: currentState.isOnline,
        pendingSync: currentState.pendingSync,
        resetPending: currentState.resetPending,
        isImporting: currentState.isImporting
      });
    }
  });

  // Subscribe to transactions
  const unsubscribeTransactions = TransactionService.subscribeToTransactions(userId, (firebaseTransactions) => {
    const currentState = budgetStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Transactions updated', firebaseTransactions.length);
      const transactions = firebaseTransactions.map(convertFirebaseTransaction);
      budgetStore.setState({ transactions });
    } else {
      console.log('⏸️ Real-time sync: BLOCKED transaction update', {
        isOnline: currentState.isOnline,
        pendingSync: currentState.pendingSync,
        resetPending: currentState.resetPending,
        isImporting: currentState.isImporting,
        transactionCount: firebaseTransactions.length
      });
    }
  });

  // Subscribe to distribution templates
  const unsubscribeTemplates = DistributionTemplateService.subscribeToDistributionTemplates(userId, (firebaseTemplates) => {
    const currentState = budgetStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Templates updated from Firebase', firebaseTemplates.length);
      console.log('📋 Firebase templates:', firebaseTemplates.map((t: any) => ({id: t.id, name: t.name})));
      // Note: Can't access current distributionTemplates from this context
      const distributionTemplates = firebaseTemplates.map(convertFirebaseTemplate);
      console.log('🔄 Setting store templates to:', distributionTemplates.map((t: any) => ({id: t.id, name: t.name})));
      // TODO: Add distributionTemplates to BudgetStore if needed
      // budgetStore.setState({ distributionTemplates });
    } else {
      console.log('🔄 Real-time sync: Skipping template update (offline or pending changes)');
    }
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(userId, (firebaseSettings: AppSettings | null) => {
    const currentState = budgetStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Settings updated', firebaseSettings ? 'found' : 'null');
      budgetStore.setState({ appSettings: firebaseSettings });
    }
  });

  // Subscribe to monthly budget (includes income sources and allocations)
  const unsubscribeMonthlyBudget = MonthlyBudgetService.getInstance().subscribeToMonthlyBudget(userId, currentMonth, (firebaseBudget: any) => {
    const currentState = budgetStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      if (firebaseBudget) {
        console.log('🔄 Real-time sync: Monthly budget updated');
        
        // Process Income Sources
        const rawIncomeSources = firebaseBudget.incomeSources || [];
        // Map Firestore timestamps to ISO strings if needed, or rely on convert helper
        const incomeSources = rawIncomeSources.map(convertFirebaseIncomeSource);
        
        // Process Allocations (Map -> Array)
        const rawAllocationsMap = firebaseBudget.allocations || {};
        const allocations = Object.entries(rawAllocationsMap).map(([envelopeId, amount]) => ({
            id: envelopeId,
            userId: userId,
            envelopeId: envelopeId,
            month: currentMonth,
            budgetedAmount: typeof amount === 'number' ? amount : parseFloat(amount as string),
            createdAt: new Date().toISOString(), // Fallback
            updatedAt: new Date().toISOString()
        }));

        // Update store
        const currentIncomeSources = budgetStore.getState().incomeSources;
        const currentAllocations = budgetStore.getState().allocations;
        
        budgetStore.setState({ 
          incomeSources: {
            ...currentIncomeSources,
            [currentMonth]: incomeSources
          },
          allocations: {
            ...currentAllocations,
            [currentMonth]: allocations
          }
        });
      }
    } else {
      console.log('⏸️ Real-time sync: BLOCKED monthly budget update');
    }
  });

  // Store unsubscribe functions for cleanup if needed
  (window as any).__firebaseUnsubscribers = {
    envelopes: unsubscribeEnvelopes,
    transactions: unsubscribeTransactions,
    templates: unsubscribeTemplates,
    settings: unsubscribeSettings,
    monthlyBudget: unsubscribeMonthlyBudget
  };

  console.log('✅ Real-time subscriptions active - cross-device sync enabled');
};

export const setupEnvelopeStoreRealtime = (params: {
  useBudgetStore: BudgetStoreLike;
  useAuthStore: AuthStoreLike;
  getCurrentUserId: () => string;
}) => {
  const { useBudgetStore, useAuthStore, getCurrentUserId } = params;

  // Setup online/offline detection and real-time sync after store creation
  if (typeof window === 'undefined') return;

  // Listen to browser online/offline events
  window.addEventListener('online', async () => {
    console.log('📡 Browser online event detected');
    // When coming back online, check connectivity
    await useBudgetStore.getState().updateOnlineStatus();

    // If we're actually online and have pending sync or reset, auto-sync
    const state = useBudgetStore.getState();
    if (state.isOnline && (state.pendingSync || state.resetPending)) {
      console.log('🔄 Auto-syncing pending operations...');
      state.syncData();
    }
  });

  window.addEventListener('offline', () => {
    console.log('📴 Browser offline event detected');
    useBudgetStore.setState({ isOnline: false });
  });

  // Initial status check (quietly)
  setTimeout(() => {
    useBudgetStore.getState().updateOnlineStatus();
  }, 1000); // Delay initial check to avoid immediate noise

  // Periodic connectivity retry when offline (every 30 seconds)
  let offlineRetryInterval: ReturnType<typeof setInterval> | null = null;

  const startOfflineRetry = () => {
    if (offlineRetryInterval) clearInterval(offlineRetryInterval);
    offlineRetryInterval = setInterval(async () => {
      const currentState = useBudgetStore.getState();
      if (!currentState.isOnline && !currentState.testingConnectivity) {
        console.log('🔄 Periodic offline retry: testing connectivity...');
        useBudgetStore.setState({ testingConnectivity: true });

        try {
          const isNowOnline = await (async () => {
            await useBudgetStore.getState().updateOnlineStatus();
            return useBudgetStore.getState().isOnline;
          })();

          if (isNowOnline) {
            console.log('✅ Periodic retry succeeded - back online!');
            useBudgetStore.setState({ isOnline: true, testingConnectivity: false });
            // Trigger sync if needed
            if (currentState.pendingSync || currentState.resetPending) {
              useBudgetStore.getState().syncData();
            }
            // Stop the retry interval since we're online
            if (offlineRetryInterval) {
              clearInterval(offlineRetryInterval);
              offlineRetryInterval = null;
            }
          } else {
            useBudgetStore.setState({ testingConnectivity: false });
          }
        } catch (error) {
          console.log('❌ Periodic retry failed:', error);
          useBudgetStore.setState({ testingConnectivity: false });
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
  useBudgetStore.subscribe((state: any) => {
    if (!state.isOnline && !offlineRetryInterval) {
      console.log('🔄 Starting periodic connectivity retry');
      startOfflineRetry();
    }
  });

  // Check if user is already authenticated on app load
  const initialAuthState = useAuthStore.getState();
  if (initialAuthState.isAuthenticated && initialAuthState.currentUser) {
    console.log('✅ User already authenticated on app load, setting up real-time subscriptions');
    setupRealtimeSubscriptions(useBudgetStore, getCurrentUserId());
  }

  // Listen for authentication changes
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.currentUser) {
      // User has logged in, set up real-time subscriptions
      console.log('✅ User authenticated, setting up real-time subscriptions');
      setupRealtimeSubscriptions(useBudgetStore, getCurrentUserId());
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
        if (unsubscribers.monthlyBudget) unsubscribers.monthlyBudget();
        delete (window as any).__firebaseUnsubscribers;
        console.log('🧹 Cleaned up Firebase subscriptions');
      }

      useBudgetStore.getState().handleUserLogout();
    }
  });

  // Listen for month changes to update income sources and allocations subscriptions
  let lastMonth = useBudgetStore.getState().currentMonth;
  useBudgetStore.subscribe((state) => {
    if (state.currentMonth !== lastMonth && state.isAuthenticated) {
      console.log('📅 Month changed from', lastMonth, 'to', state.currentMonth);
      lastMonth = state.currentMonth;
      
      // Update monthly budget subscription
      const userId = getCurrentUserId();
      if (userId && (window as any).__firebaseUnsubscribers) {
        const unsubscribers = (window as any).__firebaseUnsubscribers;
        
        // Unsubscribe from old month
        if (unsubscribers.monthlyBudget) {
          unsubscribers.monthlyBudget();
          console.log('🔄 Unsubscribed from old monthly budget');
        }
        
        // Subscribe to new month
        unsubscribers.monthlyBudget = MonthlyBudgetService.getInstance().subscribeToMonthlyBudget(userId, state.currentMonth, (firebaseBudget: any) => {
          const currentState = useBudgetStore.getState();
          if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
            if (firebaseBudget) {
                console.log('🔄 Real-time sync: Monthly budget updated for new month');
                
                // Process Income Sources
                const rawIncomeSources = firebaseBudget.incomeSources || [];
                const incomeSources = rawIncomeSources.map(convertFirebaseIncomeSource);
                
                // Process Allocations
                const rawAllocationsMap = firebaseBudget.allocations || {};
                const allocations = Object.entries(rawAllocationsMap).map(([envelopeId, amount]) => ({
                    id: envelopeId,
                    userId: userId,
                    envelopeId: envelopeId,
                    month: state.currentMonth,
                    budgetedAmount: typeof amount === 'number' ? amount : parseFloat(amount as string),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }));

                // Update store
                const currentIncomeSources = useBudgetStore.getState().incomeSources;
                const currentAllocations = useBudgetStore.getState().allocations;
                
                useBudgetStore.setState({ 
                  incomeSources: {
                    ...currentIncomeSources,
                    [state.currentMonth]: incomeSources
                  },
                  allocations: {
                    ...currentAllocations,
                    [state.currentMonth]: allocations
                  }
                });
            }
          }
        });
        
        console.log('✅ Subscribed to monthly budget for new month:', state.currentMonth);
      }
    }
  });
};
