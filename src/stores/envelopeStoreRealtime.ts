import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import { DistributionTemplateService } from '../services/DistributionTemplateService';
import { AppSettingsService } from '../services/AppSettingsService';
import type { DistributionTemplate, Transaction, Envelope, AppSettings } from '../models/types';
import { transactionFromFirestore } from '../mappers/transaction';

type EnvelopeStoreLike = {
  getState: () => {
    isOnline: boolean;
    pendingSync: boolean;
    resetPending: boolean;
    isImporting: boolean;
    testingConnectivity: boolean;
    updateOnlineStatus: () => Promise<void>;
    syncData: () => Promise<void>;
    handleUserLogout: () => void;
  };
  setState: (partial: any) => void;
  subscribe: (listener: (state: any) => void) => () => void;
};

type AuthStoreLike = {
  getState: () => { isAuthenticated: boolean; currentUser: { id: string } | null };
  subscribe: (listener: (state: any) => void) => () => void;
};

// Helper functions for real-time sync data conversion
const convertFirebaseTransaction = (firebaseTx: any): Transaction => transactionFromFirestore(firebaseTx);

const convertFirebaseEnvelope = (firebaseEnv: any): Envelope => ({
  id: firebaseEnv.id,
  name: firebaseEnv.name || '',
  currentBalance: firebaseEnv.currentBalance || 0,
  lastUpdated: firebaseEnv.lastUpdated,
  isActive: firebaseEnv.isActive ?? true,
  orderIndex: firebaseEnv.orderIndex ?? 0,
  userId: firebaseEnv.userId || undefined,
  createdAt: firebaseEnv.createdAt,
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
const setupRealtimeSubscriptions = (useEnvelopeStore: EnvelopeStoreLike, userId: string) => {
  // Prevent duplicate subscriptions
  if ((window as any).__firebaseUnsubscribers) {
    console.log('⚠️ Real-time subscriptions already active, skipping setup');
    return;
  }

  console.log('🔄 Setting up real-time Firebase subscriptions...');

  // Subscribe to envelopes
  const unsubscribeEnvelopes = EnvelopeService.subscribeToEnvelopes(userId, (firebaseEnvelopes) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Envelopes updated', firebaseEnvelopes.length);
      const envelopes = firebaseEnvelopes.map(convertFirebaseEnvelope);
      useEnvelopeStore.setState({ envelopes });
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
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Transactions updated', firebaseTransactions.length);
      const transactions = firebaseTransactions.map(convertFirebaseTransaction);
      useEnvelopeStore.setState({ transactions });
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
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
      console.log('🔄 Real-time sync: Templates updated from Firebase', firebaseTemplates.length);
      console.log('📋 Firebase templates:', firebaseTemplates.map((t: any) => ({id: t.id, name: t.name})));
      // Note: Can't access current distributionTemplates from this context
      const distributionTemplates = firebaseTemplates.map(convertFirebaseTemplate);
      console.log('🔄 Setting store templates to:', distributionTemplates.map((t: any) => ({id: t.id, name: t.name})));
      useEnvelopeStore.setState({ distributionTemplates });
    } else {
      console.log('🔄 Real-time sync: Skipping template update (offline or pending changes)');
    }
  });

  // Subscribe to app settings
  const unsubscribeSettings = AppSettingsService.subscribeToAppSettings(userId, (firebaseSettings: AppSettings | null) => {
    const currentState = useEnvelopeStore.getState();
    // Only sync if we're online and don't have pending local changes or importing
    if (currentState.isOnline && !currentState.pendingSync && !currentState.resetPending && !currentState.isImporting) {
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

export const setupEnvelopeStoreRealtime = (params: {
  useEnvelopeStore: EnvelopeStoreLike;
  useAuthStore: AuthStoreLike;
  getCurrentUserId: () => string;
}) => {
  const { useEnvelopeStore, useAuthStore, getCurrentUserId } = params;

  // Setup online/offline detection and real-time sync after store creation
  if (typeof window === 'undefined') return;

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
          const isNowOnline = await (async () => {
            await useEnvelopeStore.getState().updateOnlineStatus();
            return useEnvelopeStore.getState().isOnline;
          })();

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
    setupRealtimeSubscriptions(useEnvelopeStore, getCurrentUserId());
  }

  // Listen for authentication changes
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && state.currentUser) {
      // User has logged in, set up real-time subscriptions
      console.log('✅ User authenticated, setting up real-time subscriptions');
      setupRealtimeSubscriptions(useEnvelopeStore, getCurrentUserId());
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

      useEnvelopeStore.getState().handleUserLogout();
    }
  });
};
