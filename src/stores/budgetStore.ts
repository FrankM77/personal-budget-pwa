import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';
import { setupEnvelopeStoreRealtime } from './envelopeStoreRealtime';
import type { BudgetState } from './budgetStoreTypes';
import { createTransactionSlice } from './budgetStoreTransactions';
import { createEnvelopeSlice } from './budgetStoreEnvelopes';
import { createAllocationSlice } from './budgetStoreAllocations';
import { createCategorySlice } from './budgetStoreCategories';
import { createOnboardingSlice } from './budgetStoreOnboarding';
import { createSettingsSlice } from './budgetStoreSettings';
import { createDataSlice } from './budgetStoreData';

// Re-export the BudgetState type for consumers
export type { BudgetState } from './budgetStoreTypes';

// Helper function to get current user ID
const getCurrentUserId = () => {
  const authStore = useAuthStore.getState();
  return authStore.currentUser?.id || '';
};

export const useBudgetStore = create<BudgetState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        envelopes: [],
        transactions: [],
        categories: [],
        appSettings: null,
        incomeSources: {},
        allocations: {},
        loadedTransactionMonths: [],
        areAllTransactionsLoaded: false,
        currentMonth: new Date().toISOString().slice(0, 7),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isOnboardingActive: false,
        isOnboardingCompleted: false, // Will be set per-user in checkAndStartOnboarding
        isLoading: false,
        error: null,

        // Compose all action slices
        ...createTransactionSlice({ set, get }),
        ...createEnvelopeSlice({ set, get }),
        ...createAllocationSlice({ set, get }),
        ...createCategorySlice({ set, get }),
        ...createOnboardingSlice({ set, get }),
        ...createSettingsSlice({ set, get }),
        ...createDataSlice({ set, get }),
      }),
      {
        name: 'budget-storage',
        partialize: (state) => ({
          // Exclude onboarding state from persistence - it's user-specific and stored separately
          envelopes: state.envelopes,
          transactions: state.transactions,
          categories: state.categories,
          appSettings: state.appSettings,
          incomeSources: state.incomeSources,
          allocations: state.allocations,
          currentMonth: state.currentMonth,
          isOnline: state.isOnline,
          // isOnboardingActive: excluded (UI state only)
          // isOnboardingCompleted: excluded (stored in localStorage separately per user)
        }),
      }
    )
  )
);

// Setup real-time Firebase subscriptions and online/offline detection
// NOTE: Real-time listeners are now compatible with the new slice architecture
setupEnvelopeStoreRealtime({
  useBudgetStore: useBudgetStore as any,
  useAuthStore: useAuthStore as any,
  getCurrentUserId: getCurrentUserId,
});
