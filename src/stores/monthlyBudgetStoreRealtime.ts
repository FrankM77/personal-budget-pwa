import { MonthlyBudgetService } from '../services/MonthlyBudgetService';
import type { MonthlyBudget, IncomeSource, EnvelopeAllocation } from '../models/types';

type MonthlyBudgetStoreLike = {
  getState: () => {
    isOnline: boolean;
    pendingSync: boolean;
    resetPending: boolean;
    testingConnectivity: boolean;
    updateOnlineStatus: () => Promise<void>;
    syncData: () => Promise<void>;
    handleUserLogout: () => void;
    currentMonth: string;
  };
  setState: (partial: any) => void;
  subscribe: (listener: (state: any) => void) => () => void;
};

type AuthStoreLike = {
  getState: () => { isAuthenticated: boolean; currentUser: { id: string } | null };
  subscribe: (listener: (state: any) => void) => () => void;
};

// Helper functions for real-time sync data conversion
const convertFirebaseMonthlyBudget = (firebaseBudget: any): MonthlyBudget | null => {
  if (!firebaseBudget) return null;
  return {
    id: firebaseBudget.id,
    userId: firebaseBudget.userId,
    month: firebaseBudget.month,
    totalIncome: parseFloat(firebaseBudget.totalIncome),
    availableToBudget: parseFloat(firebaseBudget.availableToBudget),
    createdAt: firebaseBudget.createdAt?.toDate?.() ? firebaseBudget.createdAt.toDate().toISOString() : firebaseBudget.createdAt || new Date().toISOString(),
    updatedAt: firebaseBudget.updatedAt?.toDate?.() ? firebaseBudget.updatedAt.toDate().toISOString() : firebaseBudget.updatedAt || new Date().toISOString(),
  };
};

const convertFirebaseIncomeSource = (firebaseSource: any): IncomeSource => ({
  id: firebaseSource.id,
  userId: firebaseSource.userId,
  month: firebaseSource.month,
  name: firebaseSource.name,
  amount: parseFloat(firebaseSource.amount),
  frequency: firebaseSource.frequency,
  category: firebaseSource.category,
  createdAt: firebaseSource.createdAt?.toDate?.() ? firebaseSource.createdAt.toDate().toISOString() : firebaseSource.createdAt || new Date().toISOString(),
  updatedAt: firebaseSource.updatedAt?.toDate?.() ? firebaseSource.updatedAt.toDate().toISOString() : firebaseSource.updatedAt || new Date().toISOString(),
});

const convertFirebaseEnvelopeAllocation = (firebaseAllocation: any): EnvelopeAllocation => ({
  id: firebaseAllocation.id,
  userId: firebaseAllocation.userId,
  envelopeId: firebaseAllocation.envelopeId,
  month: firebaseAllocation.month,
  budgetedAmount: parseFloat(firebaseAllocation.budgetedAmount),
  createdAt: firebaseAllocation.createdAt?.toDate?.() ? firebaseAllocation.createdAt.toDate().toISOString() : firebaseAllocation.createdAt || new Date().toISOString(),
  updatedAt: firebaseAllocation.updatedAt?.toDate?.() ? firebaseAllocation.updatedAt.toDate().toISOString() : firebaseAllocation.updatedAt || new Date().toISOString(),
});

// Setup real-time Firebase subscriptions for cross-tab/device sync
const setupRealtimeSubscriptions = (useMonthlyBudgetStore: MonthlyBudgetStoreLike, userId: string, currentMonth: string) => {
  // Prevent duplicate subscriptions
  if ((window as any).__monthlyBudgetUnsubscribers) {
    console.log('⚠️ Monthly budget real-time subscriptions already active, skipping setup');
    return;
  }

  console.log('🔄 Setting up monthly budget real-time Firebase subscriptions for month:', currentMonth);

  const service = MonthlyBudgetService.getInstance();

  // Subscribe to monthly budget
  const unsubscribeMonthlyBudget = service.subscribeToMonthlyBudget(userId, currentMonth, (firebaseBudget) => {
    const currentState = useMonthlyBudgetStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Monthly budget updated', firebaseBudget ? 'found' : 'null');
      const monthlyBudget = convertFirebaseMonthlyBudget(firebaseBudget);
      useMonthlyBudgetStore.setState({ monthlyBudget });
    }
  });

  // Subscribe to income sources
  const unsubscribeIncomeSources = service.subscribeToIncomeSources(userId, currentMonth, (firebaseSources) => {
    const currentState = useMonthlyBudgetStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      const incomeSources = firebaseSources.map(convertFirebaseIncomeSource);

      // Remove duplicates by ID (keep the first one encountered)
      const seenIds = new Set<string>();
      const uniqueSources = incomeSources.filter(source => {
        if (seenIds.has(source.id)) {
          return false;
        }
        seenIds.add(source.id);
        return true;
      });

      useMonthlyBudgetStore.setState({ incomeSources: uniqueSources });
    }
  });

  // Subscribe to envelope allocations
  const unsubscribeEnvelopeAllocations = service.subscribeToEnvelopeAllocations(userId, currentMonth, (firebaseAllocations) => {
    const currentState = useMonthlyBudgetStore.getState();
    // Only sync if we're online and don't have pending local changes
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending) {
      console.log('🔄 Real-time sync: Envelope allocations updated', firebaseAllocations.length);
      const envelopeAllocations = firebaseAllocations.map(convertFirebaseEnvelopeAllocation);
      useMonthlyBudgetStore.setState({ envelopeAllocations });
    }
  });

  // Store unsubscribe functions for cleanup
  (window as any).__monthlyBudgetUnsubscribers = {
    monthlyBudget: unsubscribeMonthlyBudget,
    incomeSources: unsubscribeIncomeSources,
    envelopeAllocations: unsubscribeEnvelopeAllocations
  };

  console.log('✅ Monthly budget real-time subscriptions active for month:', currentMonth);
};

// Cleanup function for when month changes
const cleanupRealtimeSubscriptions = () => {
  if ((window as any).__monthlyBudgetUnsubscribers) {
    const unsubscribers = (window as any).__monthlyBudgetUnsubscribers;
    if (unsubscribers.monthlyBudget) unsubscribers.monthlyBudget();
    if (unsubscribers.incomeSources) unsubscribers.incomeSources();
    if (unsubscribers.envelopeAllocations) unsubscribers.envelopeAllocations();
    delete (window as any).__monthlyBudgetUnsubscribers;
    console.log('🧹 Cleaned up monthly budget Firebase subscriptions');
  }
};

export const setupMonthlyBudgetStoreRealtime = (params: {
  useMonthlyBudgetStore: MonthlyBudgetStoreLike;
  useAuthStore: AuthStoreLike;
  getCurrentUserId: () => string;
}) => {
  const { useMonthlyBudgetStore, useAuthStore, getCurrentUserId } = params;

  // Setup online/offline detection and real-time sync after store creation
  if (typeof window === 'undefined') return;

  // Listen to browser online/offline events
  window.addEventListener('online', async () => {
    console.log('📡 Browser online event detected');
    // When coming back online, check connectivity
    await useMonthlyBudgetStore.getState().updateOnlineStatus();

    // If we're actually online and have pending sync or reset, auto-sync
    const state = useMonthlyBudgetStore.getState();
    if (state.isOnline && (state.pendingSync || state.resetPending)) {
      console.log('🔄 Auto-syncing pending operations...');
      state.syncData();
    }
  });

  window.addEventListener('offline', () => {
    console.log('📴 Browser offline event detected');
    useMonthlyBudgetStore.setState({ isOnline: false });
  });

  // Initial status check (quietly)
  setTimeout(() => {
    useMonthlyBudgetStore.getState().updateOnlineStatus();
  }, 1000); // Delay initial check to avoid immediate noise

  // Periodic connectivity retry when offline (every 30 seconds)
  let offlineRetryInterval: ReturnType<typeof setInterval> | null = null;

  const startOfflineRetry = () => {
    if (offlineRetryInterval) clearInterval(offlineRetryInterval);
    offlineRetryInterval = setInterval(async () => {
      const currentState = useMonthlyBudgetStore.getState();
      if (!currentState.isOnline && !currentState.testingConnectivity) {
        console.log('🔄 Periodic offline retry: testing connectivity...');
        useMonthlyBudgetStore.setState({ testingConnectivity: true });

        try {
          const isNowOnline = await (async () => {
            await useMonthlyBudgetStore.getState().updateOnlineStatus();
            return useMonthlyBudgetStore.getState().isOnline;
          })();

          if (isNowOnline) {
            console.log('✅ Periodic retry succeeded - back online!');
            useMonthlyBudgetStore.setState({ isOnline: true, testingConnectivity: false });
            // Trigger sync if needed
            if (currentState.pendingSync || currentState.resetPending) {
              useMonthlyBudgetStore.getState().syncData();
            }
            // Stop the retry interval since we're online
            if (offlineRetryInterval) {
              clearInterval(offlineRetryInterval);
              offlineRetryInterval = null;
            }
          } else {
            useMonthlyBudgetStore.setState({ testingConnectivity: false });
          }
        } catch (error) {
          console.log('❌ Periodic retry failed:', error);
          useMonthlyBudgetStore.setState({ testingConnectivity: false });
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
  useMonthlyBudgetStore.subscribe((state) => {
    if (!state.isOnline && !offlineRetryInterval) {
      console.log('🔄 Starting periodic connectivity retry');
      startOfflineRetry();
    }
  });

  // Listen for month changes to update subscriptions
  let previousMonth: string | null = null;
  useMonthlyBudgetStore.subscribe((state) => {
    if (previousMonth !== null && state.currentMonth !== previousMonth) {
      console.log('📅 Month changed from', previousMonth, 'to', state.currentMonth);
      // Clean up old subscriptions and set up new ones for the new month
      cleanupRealtimeSubscriptions();

      const authState = useAuthStore.getState();
      if (authState.isAuthenticated && authState.currentUser) {
        setupRealtimeSubscriptions(useMonthlyBudgetStore, getCurrentUserId(), state.currentMonth);
      }
    }
    previousMonth = state.currentMonth;
  });

  // Check if user is already authenticated on app load
  const initialAuthState = useAuthStore.getState();
  if (initialAuthState.isAuthenticated && initialAuthState.currentUser) {
    console.log('✅ User already authenticated on app load, setting up monthly budget real-time subscriptions');
    const currentMonth = useMonthlyBudgetStore.getState().currentMonth;
    setupRealtimeSubscriptions(useMonthlyBudgetStore, getCurrentUserId(), currentMonth);
  }

  // Listen for authentication changes
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.currentUser) {
      // User has logged in, set up real-time subscriptions
      console.log('✅ User authenticated, setting up monthly budget real-time subscriptions');
      const currentMonth = useMonthlyBudgetStore.getState().currentMonth;
      setupRealtimeSubscriptions(useMonthlyBudgetStore, getCurrentUserId(), currentMonth);
    } else if (!state.isAuthenticated && !state.isLoading) {
      // User has logged out, clear their data and unsubscribe
      console.log('👋 User logged out, clearing monthly budget data and unsubscribing');
      cleanupRealtimeSubscriptions();
      useMonthlyBudgetStore.getState().handleUserLogout();
    }
  });
};