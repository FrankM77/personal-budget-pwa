import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MonthlyBudgetService } from '../services/MonthlyBudgetService';
import { useAuthStore } from './authStore';
import { setupMonthlyBudgetStoreRealtime } from './monthlyBudgetStoreRealtime';
import type { MonthlyBudget, IncomeSource, EnvelopeAllocation } from '../models/types';

interface MonthlyBudgetStore {
  // Current month context
  currentMonth: string; // Format: "2025-01"

  // Monthly data
  monthlyBudget: MonthlyBudget | null;
  incomeSources: IncomeSource[];
  envelopeAllocations: EnvelopeAllocation[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Network and sync states
  isOnline: boolean;
  pendingSync: boolean;
  resetPending: boolean;
  testingConnectivity: boolean;

  // Actions
  setCurrentMonth: (month: string) => void;
  fetchMonthlyData: () => Promise<void>;
  createIncomeSource: (source: Omit<IncomeSource, 'id' | 'userId' | 'month' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => Promise<void>;
  deleteIncomeSource: (id: string) => Promise<void>;
  restoreIncomeSource: (source: IncomeSource, originalIndex?: number) => Promise<void>;
  createEnvelopeAllocation: (allocation: Omit<EnvelopeAllocation, 'id' | 'userId' | 'month' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEnvelopeAllocation: (id: string, updates: Partial<EnvelopeAllocation>) => Promise<void>;
  deleteEnvelopeAllocation: (id: string) => Promise<void>;
  restoreEnvelopeAllocation: (allocation: EnvelopeAllocation, originalIndex?: number) => Promise<void>;
  setEnvelopeAllocation: (envelopeId: string, budgetedAmount: number) => Promise<void>;
  copyFromPreviousMonth: () => Promise<void>;
  calculateAvailableToBudget: () => number;
  refreshAvailableToBudget: () => Promise<void>;
  loadDemoData: (incomeSources: IncomeSource[], envelopeAllocations: EnvelopeAllocation[]) => void;
  clearMonthData: () => Promise<void>;

  // Network and sync actions
  updateOnlineStatus: () => Promise<void>;
  syncData: () => Promise<void>;
  handleUserLogout: () => void;
}

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
};

// Helper function to get user ID
const getUserId = (): string => {
  const user = useAuthStore.getState().currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.id;
};

// Export getCurrentUserId for use in realtime setup
export const getCurrentUserId = getUserId;

export const useMonthlyBudgetStore = create<MonthlyBudgetStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentMonth: getCurrentMonth(),
      monthlyBudget: null,
      incomeSources: [],
      envelopeAllocations: [],
      isLoading: false,
      error: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingSync: false,
      resetPending: false,
      testingConnectivity: false,

      // Set current month and fetch data
      setCurrentMonth: (month: string) => {
        set({ currentMonth: month });
        // Trigger data fetch for new month
        get().fetchMonthlyData();
      },

      // Fetch all monthly data for current month
      fetchMonthlyData: async () => {
        try {
          set({ isLoading: true, error: null });
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();

          // Fetch all data in parallel
          const [monthlyBudget, incomeSources, envelopeAllocations] = await Promise.all([
            service.getMonthlyBudget(userId, currentMonth),
            service.getIncomeSources(userId, currentMonth),
            service.getEnvelopeAllocations(userId, currentMonth),
          ]);

          set({
            monthlyBudget,
            incomeSources,
            envelopeAllocations,
            isLoading: false,
          });
        } catch (error) {
          console.error('Error fetching monthly data:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch monthly data',
            isLoading: false,
          });
        }
      },

      // Income Source CRUD
      createIncomeSource: async (sourceData) => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();
          await service.createIncomeSource({
            ...sourceData,
            userId,
            month: currentMonth,
          });

          // Let the real-time listener update the state instead of doing optimistic updates
          // This prevents race conditions and duplicate items

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error creating income source:', error);
          throw error;
        }
      },

      updateIncomeSource: async (id: string, updates: Partial<IncomeSource>) => {
        try {
          // Build update object with only defined values
          const updateData: any = {
            updatedAt: Timestamp.now(),
          };

          if (updates.name !== undefined) updateData.name = updates.name;
          if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
          if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
          if (updates.category !== undefined) updateData.category = updates.category;

          const docRef = doc(db, 'incomeSources', id);
          await updateDoc(docRef, updateData);

          // Force a refresh of the income sources to ensure UI updates
          // This will trigger the real-time sync immediately
          const service = MonthlyBudgetService.getInstance();
          const userId = getUserId();
          const currentMonth = get().currentMonth;
          const refreshedSources = await service.getIncomeSources(userId, currentMonth);

          set({ incomeSources: refreshedSources });
        } catch (error) {
          console.error('Error updating income source:', error);
          throw error;
        }
      },

      deleteIncomeSource: async (id: string) => {
        try {
          // Note: In a real implementation, you'd want a delete method in the service
          // For now, we'll just remove from local state
          set(state => ({
            incomeSources: state.incomeSources.filter(source => source.id !== id),
          }));

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error deleting income source:', error);
          throw error;
        }
      },

      restoreIncomeSource: async (source: IncomeSource, originalIndex?: number) => {
        try {
          set(state => {
            const sources = [...state.incomeSources];
            // If we have an original index, insert at that position, otherwise append
            if (originalIndex !== undefined && originalIndex >= 0 && originalIndex <= sources.length) {
              sources.splice(originalIndex, 0, source);
            } else {
              sources.push(source);
            }
            return {
              incomeSources: sources,
            };
          });

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error restoring income source:', error);
          throw error;
        }
      },

      // Envelope Allocation CRUD
      createEnvelopeAllocation: async (allocationData) => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();
          await service.createEnvelopeAllocation({
            ...allocationData,
            userId,
            month: currentMonth,
          });

          // Let the real-time listener update the state instead of doing optimistic updates
          // This prevents race conditions and duplicate items

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error creating envelope allocation:', error);
          throw error;
        }
      },

      updateEnvelopeAllocation: async (id: string, updates: Partial<EnvelopeAllocation>) => {
        try {
          const service = MonthlyBudgetService.getInstance();
          await service.updateEnvelopeAllocation(id, {
            envelopeId: updates.envelopeId,
            budgetedAmount: updates.budgetedAmount?.toString(),
          });
        } catch (error) {
          console.error('Error updating envelope allocation:', error);
          throw error;
        }
      },

      deleteEnvelopeAllocation: async (id: string) => {
        try {
          // Remove from local state
          set(state => ({
            envelopeAllocations: state.envelopeAllocations.filter(allocation => allocation.id !== id),
          }));

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error deleting envelope allocation:', error);
          throw error;
        }
      },

      restoreEnvelopeAllocation: async (allocation: EnvelopeAllocation, originalIndex?: number) => {
        try {
          set(state => {
            const allocations = [...state.envelopeAllocations];
            // If we have an original index, insert at that position, otherwise append
            if (originalIndex !== undefined && originalIndex >= 0 && originalIndex <= allocations.length) {
              allocations.splice(originalIndex, 0, allocation);
            } else {
              allocations.push(allocation);
            }
            return {
              envelopeAllocations: allocations,
            };
          });

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error restoring envelope allocation:', error);
          throw error;
        }
      },

      setEnvelopeAllocation: async (envelopeId: string, budgetedAmount: number) => {
        try {
          // Check if allocation already exists for this envelope
          const existingAllocation = get().envelopeAllocations.find(
            alloc => alloc.envelopeId === envelopeId
          );

          if (existingAllocation) {
            // Update existing allocation
            await get().updateEnvelopeAllocation(existingAllocation.id!, {
              budgetedAmount,
            });
          } else {
            // Create new allocation
            await get().createEnvelopeAllocation({
              envelopeId,
              budgetedAmount,
            });
          }
        } catch (error) {
          console.error('Error setting envelope allocation:', error);
          throw error;
        }
      },

      // Copy data from previous month
      copyFromPreviousMonth: async () => {
        try {
          set({ isLoading: true, error: null });
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          // Calculate previous month
          const [year, month] = currentMonth.split('-').map(Number);
          let prevYear = year;
          let prevMonth = month - 1;
          if (prevMonth < 1) {
            prevYear = year - 1;
            prevMonth = 12;
          }
          const prevMonthString = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;

          const service = MonthlyBudgetService.getInstance();
          await service.copyMonthData(userId, prevMonthString, currentMonth);

          // Refresh data
          await get().fetchMonthlyData();
        } catch (error) {
          console.error('Error copying from previous month:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to copy month data',
            isLoading: false,
          });
        }
      },

      // Calculate available to budget from current state
      calculateAvailableToBudget: () => {
        const state = get();
        const totalIncome = state.incomeSources.reduce((sum, source) => sum + source.amount, 0);
        const totalAllocations = state.envelopeAllocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);
        return totalIncome - totalAllocations;
      },

      // Refresh available to budget from server calculation
      refreshAvailableToBudget: async () => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();
          const availableToBudget = await service.calculateAvailableToBudget(userId, currentMonth);

          // Update or create monthly budget
          const currentBudget = get().monthlyBudget;
          if (currentBudget) {
            const updatedBudget = { ...currentBudget, availableToBudget };
            await service.createOrUpdateMonthlyBudget(updatedBudget);
            set({ monthlyBudget: updatedBudget });
          } else {
            // Create new budget
            const totalIncome = get().incomeSources.reduce((sum, source) => sum + source.amount, 0);
            const newBudget = await service.createOrUpdateMonthlyBudget({
              userId,
              month: currentMonth,
              totalIncome,
              availableToBudget,
            });
            set({ monthlyBudget: newBudget });
          }
        } catch (error) {
          console.error('Error refreshing available to budget:', error);
        }
      },

      // Load demo data for demonstration purposes
      loadDemoData: (demoIncomeSources: IncomeSource[], demoEnvelopeAllocations: EnvelopeAllocation[]) => {
        set({
          incomeSources: demoIncomeSources,
          envelopeAllocations: demoEnvelopeAllocations,
          isLoading: false,
        });
      },

      clearMonthData: async () => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();

          // Clear all data for this month in Firebase
          await service.clearMonthData(userId, currentMonth);

          // Update local state
          set({
            incomeSources: [],
            envelopeAllocations: [],
          });

          // Recalculate available to budget (should be 0 now)
          await get().refreshAvailableToBudget();

        } catch (error) {
          console.error('Error clearing month data:', error);
          throw error;
        }
      },

      // Network and sync actions (delegated to realtime setup)
      updateOnlineStatus: async () => {
        // This will be overridden by the realtime setup
        console.log('Monthly budget updateOnlineStatus called');
      },

      syncData: async () => {
        // This will be overridden by the realtime setup
        console.log('Monthly budget syncData called');
      },

      handleUserLogout: () => {
        // Clear user data on logout
        set({
          monthlyBudget: null,
          incomeSources: [],
          envelopeAllocations: [],
          isLoading: false,
          error: null,
          pendingSync: false,
          resetPending: false,
          testingConnectivity: false,
        });
      },
    }),
    {
      name: 'monthly-budget-store',
      partialize: (state) => ({
        currentMonth: state.currentMonth,
      }),
    }
  )
);

// Setup real-time Firebase subscriptions and online/offline detection
setupMonthlyBudgetStoreRealtime({
  useMonthlyBudgetStore,
  useAuthStore,
  getCurrentUserId,
});
