import { TransactionService } from '../services/TransactionService';
import { pendingTransactionDeletions } from './budgetStoreTransactions';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import { CategoryService } from '../services/CategoryService';
import { budgetService } from '../services/budgetService';
import type { Envelope, AppSettings, Category } from '../models/types';
import logger from '../utils/logger';

type BudgetStoreLike = {
  getState: () => {
    isOnline: boolean;
    updateOnlineStatus: () => Promise<void>;
    handleUserLogout: () => void;
    currentMonth: string;
    incomeSources: Record<string, any[]>;
    allocations: Record<string, any[]>;
    categories: Category[];
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
// Note: convertFirebaseTransaction no longer needed since TransactionService returns Transaction[] directly

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
  piggybankConfig: firebaseEnv.piggybankConfig,
  categoryId: firebaseEnv.categoryId
});

const convertFirebaseCategory = (firebaseCat: any): Category => ({
  id: firebaseCat.id,
  userId: firebaseCat.userId,
  name: firebaseCat.name,
  orderIndex: firebaseCat.orderIndex,
  isArchived: firebaseCat.isArchived,
  createdAt: firebaseCat.createdAt?.toDate?.() ? firebaseCat.createdAt.toDate().toISOString() : firebaseCat.createdAt,
  updatedAt: firebaseCat.updatedAt?.toDate?.() ? firebaseCat.updatedAt.toDate().toISOString() : firebaseCat.updatedAt,
});

// Setup real-time Firebase subscriptions for cross-tab/device sync
const setupRealtimeSubscriptions = (budgetStore: any, userId: string) => {
  // Prevent duplicate subscriptions
  if ((window as any).__firebaseUnsubscribers) {
    logger.log('⚠️ Real-time subscriptions already active, skipping setup');
    return;
  }

  logger.log('🔄 Setting up real-time Firebase subscriptions...');

  // Get current month for income sources and allocations
  const currentMonth = budgetStore.getState().currentMonth;
  logger.log('📅 Current month for subscriptions:', currentMonth);

  // Subscribe to envelopes
  const unsubscribeEnvelopes = EnvelopeService.subscribeToEnvelopes(userId, (firebaseEnvelopes) => {
    logger.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
    const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope).filter((env: Envelope) => !env.deletedAt);
    
    // Get current state to preserve locally deleted envelopes
    const currentState = budgetStore.getState();
    const currentEnvelopeIds = new Set(currentState.envelopes.map((env: Envelope) => env.id));
    const firebaseEnvelopeIds = new Set(envelopes.map((env: Envelope) => env.id));
    
    // Only update with envelopes that exist in Firebase and weren't locally deleted
    // This preserves local deletions until they sync with Firebase
    const updatedEnvelopes = [
      ...envelopes.filter((env: Envelope) => currentEnvelopeIds.has(env.id)), // Keep Firebase envelopes that exist locally
      ...currentState.envelopes.filter((env: Envelope) => !firebaseEnvelopeIds.has(env.id)) // Keep locally deleted envelopes
    ];
    
    budgetStore.setState({ envelopes: updatedEnvelopes });
  });

  // Transaction unsubscribers map (managed per month)
  const transactionUnsubscribers: Record<string, () => void> = {};

  const setupTransactionSubscription = (month: string) => {
    if (transactionUnsubscribers[month]) return;

    transactionUnsubscribers[month] = TransactionService.subscribeToTransactionsByMonth(userId, month, (firebaseTransactions) => {
      logger.log(`🔄 Real-time sync: Transactions updated for ${month}`, firebaseTransactions.length);
      
      const currentState = budgetStore.getState();
      
      // Filter out transactions that have been optimistically deleted locally
      // but may not yet be reflected in Firestore's snapshot
      const filteredFirebaseTransactions = firebaseTransactions.filter((tx: any) => {
        if (pendingTransactionDeletions.has(tx.id)) {
          // Check if Firestore has caught up (tx has deletedAt) — if so, clear the pending flag
          if (tx.deletedAt) {
            pendingTransactionDeletions.delete(tx.id);
          }
          return false; // Don't add back optimistically deleted transactions
        }
        return true;
      });
      
      const otherMonthsTransactions = currentState.transactions.filter((tx: any) => tx.month !== month);
      
      const updatedTransactions = [
        ...otherMonthsTransactions,
        ...filteredFirebaseTransactions
      ];
      
      budgetStore.setState({ transactions: updatedTransactions });
    });
  };

  // Initial subscription for current month and any already loaded months
  const initialMonths = [
    budgetStore.getState().currentMonth,
    ...(budgetStore.getState().loadedTransactionMonths || [])
  ];
  
  // Remove duplicates and subscribe
  Array.from(new Set(initialMonths)).forEach(month => {
    if (month) setupTransactionSubscription(month);
  });

  // Subscribe to categories
  const categoryService = CategoryService.getInstance();
  const unsubscribeCategories = categoryService.subscribeToCategories(userId, (firebaseCategories: any[]) => {
    logger.log('🔄 Real-time sync: Categories updated', firebaseCategories.length);
    const categories = firebaseCategories.map(convertFirebaseCategory);
    
    // Deduplicate categories by ID to prevent UI glitches
    const uniqueCategories = Array.from(new Map(categories.map(c => [c.id, c])).values());
    
    if (uniqueCategories.length !== categories.length) {
      logger.warn('⚠️ Duplicate categories detected in real-time update, deduplicating...');
    }
    
    budgetStore.setState({ categories: uniqueCategories });
  });

  // Subscribe to distribution templates
  const unsubscribeTemplates = DistributionTemplateService.subscribeToDistributionTemplates(userId, (firebaseTemplates) => {
    logger.log('🔄 Real-time sync: Templates updated from Firebase', firebaseTemplates.length);
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(userId, (firebaseSettings: AppSettings | null) => {
    logger.log('🔄 Real-time sync: Settings updated', firebaseSettings ? 'found' : 'null');
    
    // Get current state to preserve local changes
    const currentState = budgetStore.getState();
    
    if (firebaseSettings) {
      // Merge Firebase settings with current local state
      // This preserves any local changes that haven't synced yet
      const mergedSettings: AppSettings = {
        ...currentState.appSettings,
        ...firebaseSettings,
        // Preserve paymentSources from local state if Firebase doesn't have them
        paymentSources: firebaseSettings.paymentSources ?? currentState.appSettings?.paymentSources ?? []
      };
      
      budgetStore.setState({ appSettings: mergedSettings });
    } else {
      // If Firebase settings are null, keep current local state
      // This prevents losing local data during sync issues
      logger.log('⚠️ Firebase settings null, preserving local state');
    }
  });

  // Subscribe to monthly budget (Income Sources & Allocations)
  const unsubscribeMonthlyBudget = budgetService.subscribeToMonthlyBudget(userId, currentMonth, (data) => {
      logger.log(`🔄 Real-time sync: Monthly budget updated (${data.incomeSources.length} sources, ${data.allocations.length} allocations)`);
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
    transactionMonths: transactionUnsubscribers,
    categories: unsubscribeCategories,
    templates: unsubscribeTemplates,
    settings: unsubscribeSettings,
    monthlyBudget: unsubscribeMonthlyBudget,
    setupTransactionSubscription // Expose this so it can be called when loadedTransactionMonths changes
  };

  logger.log('✅ Real-time subscriptions active - cross-device sync enabled');
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
    logger.log('📡 Browser online event detected');
    useBudgetStore.setState({ isOnline: true });
  });

  window.addEventListener('offline', () => {
    logger.log('📴 Browser offline event detected');
    useBudgetStore.setState({ isOnline: false });
  });

  // Initial status check
  useBudgetStore.setState({ isOnline: navigator.onLine });

  // Check if user is already authenticated on app load
  const initialAuthState = useAuthStore.getState();
  if (initialAuthState.isAuthenticated && initialAuthState.currentUser) {
    logger.log('✅ User already authenticated on app load, setting up real-time subscriptions');
    setupRealtimeSubscriptions(useBudgetStore, getCurrentUserId());
  }

  // Listen for authentication changes
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.currentUser) {
      // User has logged in, set up real-time subscriptions
      logger.log('✅ User authenticated, setting up real-time subscriptions');
      setupRealtimeSubscriptions(useBudgetStore, getCurrentUserId());
    } else if (!state.isAuthenticated && !state.isLoading) {
      // User has logged out, clear their data and unsubscribe
      logger.log('👋 User logged out, clearing data and unsubscribing');

      // Clean up Firebase subscriptions
      if ((window as any).__firebaseUnsubscribers) {
        const unsubscribers = (window as any).__firebaseUnsubscribers;
        if (unsubscribers.envelopes) unsubscribers.envelopes();
        
        // Clean up all transaction month listeners
        if (unsubscribers.transactionMonths) {
          Object.values(unsubscribers.transactionMonths).forEach((unsub: any) => unsub());
        }

        if (unsubscribers.categories) unsubscribers.categories();
        if (unsubscribers.templates) unsubscribers.templates();
        if (unsubscribers.settings) unsubscribers.settings();
        if (unsubscribers.monthlyBudget) unsubscribers.monthlyBudget();
        delete (window as any).__firebaseUnsubscribers;
        logger.log('🧹 Cleaned up Firebase subscriptions');
      }

      useBudgetStore.getState().handleUserLogout();
    }
  });

  // Listen for month changes and new lazy-loaded months
  let lastProcessedMonths: string[] = [];
  useBudgetStore.subscribe((state) => {
    // Check auth state from the auth store (not budget store which doesn't have isAuthenticated)
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated) return;

    const currentMonths = Array.from(new Set([
      state.currentMonth,
      ...(state.loadedTransactionMonths || [])
    ])).filter(Boolean).sort();

    // Check if we have new months to subscribe to
    const hasNewMonths = currentMonths.some(m => !lastProcessedMonths.includes(m));
    
    if (hasNewMonths && (window as any).__firebaseUnsubscribers) {
      const unsubscribers = (window as any).__firebaseUnsubscribers;
      const setupTxSub = unsubscribers.setupTransactionSubscription;
      
      if (setupTxSub) {
        currentMonths.forEach(month => {
          if (!lastProcessedMonths.includes(month)) {
            setupTxSub(month);
          }
        });
      }

      // Also handle the monthlyBudget subscription update if currentMonth changed
      const lastMonth = lastProcessedMonths.find(m => m === state.currentMonth) ? state.currentMonth : null;
      if (state.currentMonth && lastMonth !== state.currentMonth) {
        const userId = getCurrentUserId();
        if (userId && unsubscribers.monthlyBudget) {
          unsubscribers.monthlyBudget();
          unsubscribers.monthlyBudget = budgetService.subscribeToMonthlyBudget(userId, state.currentMonth, (data) => {
            logger.log(`🔄 Real-time sync: Monthly budget updated for ${state.currentMonth}`);
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
        }
      }
      
      lastProcessedMonths = currentMonths;
    }
  });
};