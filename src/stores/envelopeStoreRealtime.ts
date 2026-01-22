import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import { budgetService } from '../services/budgetService';
import type { Transaction, Envelope, AppSettings } from '../models/types';
import { fromFirestore } from '../mappers/transaction';

type BudgetStoreLike = {
  getState: () => {
    isOnline: boolean;
    updateOnlineStatus: () => Promise<void>;
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
    console.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
    const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope);
    budgetStore.setState({ envelopes });
  });

  // Subscribe to transactions
  const unsubscribeTransactions = TransactionService.subscribeToTransactions(userId, (firebaseTransactions) => {
    console.log('🔄 Real-time sync: Transactions updated', firebaseTransactions.length);
    const transactions = firebaseTransactions.map(convertFirebaseTransaction);
    budgetStore.setState({ transactions });
  });

  // Subscribe to distribution templates
  const unsubscribeTemplates = DistributionTemplateService.subscribeToDistributionTemplates(userId, (firebaseTemplates) => {
    console.log('🔄 Real-time sync: Templates updated from Firebase', firebaseTemplates.length);
    // TODO: Add distributionTemplates to BudgetStore if needed
    // budgetStore.setState({ distributionTemplates });
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(userId, (firebaseSettings: AppSettings | null) => {
    console.log('🔄 Real-time sync: Settings updated', firebaseSettings ? 'found' : 'null');
    budgetStore.setState({ appSettings: firebaseSettings });
  });

  // Subscribe to monthly budget (Income Sources & Allocations)
  const unsubscribeMonthlyBudget = budgetService.subscribeToMonthlyBudget(userId, currentMonth, (data) => {
      console.log(`🔄 Real-time sync: Monthly budget updated (${data.incomeSources.length} sources, ${data.allocations.length} allocations)`);
      const currentState = budgetStore.getState();
      budgetStore.setState({ 
        incomeSources: {
          ...currentState.incomeSources,
          [currentMonth]: data.incomeSources
        },
        allocations: {
          ...currentState.allocations,
          [currentMonth]: data.allocations
        }
      });
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
    useBudgetStore.setState({ isOnline: true });
  });

  window.addEventListener('offline', () => {
    console.log('📴 Browser offline event detected');
    useBudgetStore.setState({ isOnline: false });
  });

  // Initial status check
  useBudgetStore.setState({ isOnline: navigator.onLine });

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
      
      // Update subscriptions
      const userId = getCurrentUserId();
      if (userId && (window as any).__firebaseUnsubscribers) {
        const unsubscribers = (window as any).__firebaseUnsubscribers;
        
        // Unsubscribe from old month
        if (unsubscribers.monthlyBudget) unsubscribers.monthlyBudget();
        
        console.log('🔄 Unsubscribed from old month data');
        
        // Subscribe to new month
        unsubscribers.monthlyBudget = budgetService.subscribeToMonthlyBudget(userId, state.currentMonth, (data) => {
            console.log('🔄 Real-time sync: Monthly budget updated for new month');
            const currentState = useBudgetStore.getState();
            useBudgetStore.setState({ 
              incomeSources: {
                ...currentState.incomeSources,
                [state.currentMonth]: data.incomeSources
              },
              allocations: {
                ...currentState.allocations,
                [state.currentMonth]: data.allocations
              }
            });
        });
        
        console.log('✅ Subscribed to monthly data for new month:', state.currentMonth);
      }
    }
  });
};