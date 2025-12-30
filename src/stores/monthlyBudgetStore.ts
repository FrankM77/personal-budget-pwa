import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MonthlyBudgetService } from '../services/MonthlyBudgetService';
import { useAuthStore } from './authStore';
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

  // Actions
  setCurrentMonth: (month: string) => void;
  fetchMonthlyData: () => Promise<void>;
  createIncomeSource: (source: Omit<IncomeSource, 'id' | 'userId' | 'month' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => Promise<void>;
  deleteIncomeSource: (id: string) => Promise<void>;
  createEnvelopeAllocation: (allocation: Omit<EnvelopeAllocation, 'id' | 'userId' | 'month' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEnvelopeAllocation: (id: string, updates: Partial<EnvelopeAllocation>) => Promise<void>;
  deleteEnvelopeAllocation: (id: string) => Promise<void>;
  copyFromPreviousMonth: () => Promise<void>;
  calculateAvailableToBudget: () => number;
  refreshAvailableToBudget: () => Promise<void>;
  loadDemoData: (incomeSources: IncomeSource[], envelopeAllocations: EnvelopeAllocation[]) => void;
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
          const newSource = await service.createIncomeSource({
            ...sourceData,
            userId,
            month: currentMonth,
          });

          set(state => ({
            incomeSources: [...state.incomeSources, newSource],
          }));

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error creating income source:', error);
          throw error;
        }
      },

      updateIncomeSource: async (id: string, updates: Partial<IncomeSource>) => {
        try {
          // For now, we'll delete and recreate (Firestore doesn't support direct updates easily)
          // In a production app, you'd want proper update methods
          await get().deleteIncomeSource(id);
          if (updates.name !== undefined && updates.amount !== undefined) {
            await get().createIncomeSource({
              name: updates.name,
              amount: updates.amount,
              frequency: 'monthly', // Always default to monthly for simplicity
            });
          }
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

      // Envelope Allocation CRUD
      createEnvelopeAllocation: async (allocationData) => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();
          const newAllocation = await service.createEnvelopeAllocation({
            ...allocationData,
            userId,
            month: currentMonth,
          });

          set(state => ({
            envelopeAllocations: [...state.envelopeAllocations, newAllocation],
          }));

          // Recalculate available to budget
          await get().refreshAvailableToBudget();
        } catch (error) {
          console.error('Error creating envelope allocation:', error);
          throw error;
        }
      },

      updateEnvelopeAllocation: async (id: string, updates: Partial<EnvelopeAllocation>) => {
        try {
          // Similar to income sources, delete and recreate for simplicity
          await get().deleteEnvelopeAllocation(id);
          if (updates.envelopeId !== undefined && updates.budgetedAmount !== undefined) {
            await get().createEnvelopeAllocation({
              envelopeId: updates.envelopeId,
              budgetedAmount: updates.budgetedAmount,
            });
          }
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
    }),
    {
      name: 'monthly-budget-store',
      partialize: (state) => ({
        currentMonth: state.currentMonth,
      }),
    }
  )
);
