import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Decimal } from 'decimal.js';
import { MonthlyBudgetService } from '../services/MonthlyBudgetService';
import { useAuthStore } from './authStore';
import { useEnvelopeStore } from './envelopeStore';
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
  processMonthlyPiggybankContributions: (month: string) => Promise<void>;
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

const syncBudgetAllocationTransaction = async (envelopeId: string, budgetedAmount: number, month: string) => {
	const { transactions, addTransaction, deleteTransaction } = useEnvelopeStore.getState();
  
	const allocationDescription = "Monthly Budget Allocation";
	const [year, monthNum] = month.split('-').map(Number);
  
	console.log('🔍 Syncing budget allocation transaction:', { envelopeId, budgetedAmount, month, totalTransactions: transactions.length });
  
	// Find ALL existing allocation transactions for this envelope and month (in case of duplicates)
	const existingTxs = transactions.filter(tx => {
		if (tx.envelopeId !== envelopeId || tx.description !== allocationDescription) {
		  return false;
		}
		try {
		  let txDate;
		  if (typeof tx.date === 'string') {
			  txDate = new Date(tx.date);
		  } else if ((tx.date as any)?.toDate && typeof (tx.date as any).toDate === 'function') {
			  txDate = (tx.date as any).toDate();
		  } else {
			  return false;
		  }
		  return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
		} catch (e) {
		  return false;
		}
	});
  
	console.log('📋 Found existing transactions:', existingTxs.length);
  
	// Delete ALL existing allocation transactions for this envelope/month to avoid duplicates
	for (const tx of existingTxs) {
		console.log('🗑️ Deleting old allocation transaction:', tx.id, 'amount:', tx.amount);
		await deleteTransaction(tx.id);
	}
  
	const newAmount = new Decimal(budgetedAmount.toString() || '0');
  
	// Create new transaction if amount > 0
	if (newAmount.gt(0)) {
	  console.log('➕ Creating new allocation transaction with amount', newAmount.toNumber());
	  const transactionDate = new Date(year, monthNum - 1, 2).toISOString();
	  await addTransaction({
		description: allocationDescription,
		amount: newAmount.toNumber(),
		envelopeId: envelopeId,
		date: transactionDate,
		type: 'Income',
		reconciled: true
	  });
	} else {
	  console.log('✅ No new transaction needed (amount is 0)');
	}
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
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingSync: false,
      resetPending: false,
      testingConnectivity: false,

      // Set current month and fetch data
      setCurrentMonth: (month: string) => {
        set({ currentMonth: month, isLoading: true });
        // Trigger data fetch for new month
        get().fetchMonthlyData();
      },

      // Fetch all monthly data for current month
      fetchMonthlyData: async () => {
        // Wrap everything in try-catch to ensure this function NEVER rejects
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          // Check if we have cached data (from Zustand persist hydration)
          const cachedData = get();
          const hasCachedData = cachedData.incomeSources.length > 0 || 
                                cachedData.envelopeAllocations.length > 0;

          // If we have cached data, use it immediately and fetch in background
          if (hasCachedData) {
            console.log('📦 Using cached monthly budget data, fetching updates in background...');
            // Don't set isLoading to true - use cached data immediately
          } else {
            console.log('⏳ No cached monthly budget data, fetching from Firebase...');
            set({ isLoading: true, error: null });
          }

          try {
            const service = MonthlyBudgetService.getInstance();

            // Create a timeout promise (5 seconds)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Firebase query timeout')), 5000);
            });

            // Race between Firebase queries and timeout
            const fetchPromise = Promise.all([
              service.getMonthlyBudget(userId, currentMonth),
              service.getIncomeSources(userId, currentMonth),
              service.getEnvelopeAllocations(userId, currentMonth),
            ]);

            const [monthlyBudget, incomeSources, envelopeAllocations] = await Promise.race([
              fetchPromise,
              timeoutPromise
            ]) as [any, any[], any[]];

            set({
              monthlyBudget,
              incomeSources,
              envelopeAllocations,
              isLoading: false,
            });

            console.log('✅ Monthly budget data fetched from Firebase');

            // Process piggybank auto-contributions for this month
            await get().processMonthlyPiggybankContributions(currentMonth);
          } catch (error) {
            console.error('⚠️ Firebase fetch failed:', error);
            
            // Check if we have cached data to fall back to
            const cachedData = get();
            const hasCachedData = cachedData.incomeSources.length > 0 || 
                                  cachedData.envelopeAllocations.length > 0;

            if (hasCachedData) {
              console.log('📦 Using cached monthly budget data due to fetch error (likely offline)');
              set({ isLoading: false, error: null });
            } else {
              console.error('❌ No cached monthly budget data available');
              set({
                error: error instanceof Error ? error.message : 'Failed to fetch monthly data',
                isLoading: false,
              });
            }
          }
          
          // Always resolve successfully - never let this function reject
        } catch (outerError) {
          console.error('❌ Critical error in fetchMonthlyData:', outerError);
          set({ isLoading: false, error: 'Failed to load budget data' });
          // Still don't reject - just log and set error state
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

          // Manually refresh income sources to ensure immediate UI update
          const refreshedSources = await service.getIncomeSources(userId, currentMonth);
          set({ incomeSources: refreshedSources });
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
        // Remove from local state immediately for instant UI feedback
        set(state => ({
          incomeSources: state.incomeSources.filter(source => source.id !== id),
        }));

        // Fire-and-forget: Delete from Firebase in background
        // Firebase will queue this if offline and sync when back online
        const service = MonthlyBudgetService.getInstance();
        service.deleteIncomeSource(id).catch((error) => {
          console.error('Error deleting income source from Firebase:', error);
          // Note: Local state is already updated, so UI remains consistent
        });
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

          // Manually refresh envelope allocations to ensure immediate UI update
          const refreshedAllocations = await service.getEnvelopeAllocations(userId, currentMonth);
          set({ envelopeAllocations: refreshedAllocations });
        } catch (error) {
          console.error('Error creating envelope allocation:', error);
          throw error;
        }
      },

      updateEnvelopeAllocation: async (id: string, updates: Partial<EnvelopeAllocation>) => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;
          const service = MonthlyBudgetService.getInstance();
          
          // Build update object with only defined fields
          const updateData: any = {};
          if (updates.envelopeId !== undefined) updateData.envelopeId = updates.envelopeId;
          if (updates.budgetedAmount !== undefined) updateData.budgetedAmount = updates.budgetedAmount.toString();
          
          await service.updateEnvelopeAllocation(id, updateData);

          // Manually refresh envelope allocations to ensure immediate UI update
          const refreshedAllocations = await service.getEnvelopeAllocations(userId, currentMonth);
          set({ envelopeAllocations: refreshedAllocations });
        } catch (error) {
          console.error('Error updating envelope allocation:', error);
          throw error;
        }
      },

      deleteEnvelopeAllocation: async (id: string) => {
        // Remove from local state immediately for instant UI feedback
        set(state => ({
          envelopeAllocations: state.envelopeAllocations.filter(allocation => allocation.id !== id),
        }));

        // Fire-and-forget: Delete from Firebase in background
        // Firebase will queue this if offline and sync when back online
        const service = MonthlyBudgetService.getInstance();
        service.deleteEnvelopeAllocation(id).catch((error) => {
          console.error('Error deleting envelope allocation from Firebase:', error);
          // Note: Local state is already updated, so UI remains consistent
        });
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
          console.log('🔧 setEnvelopeAllocation called:', { envelopeId, budgetedAmount });
          
          // Check if allocation already exists for this envelope
          const existingAllocation = get().envelopeAllocations.find(
            alloc => alloc.envelopeId === envelopeId
          );

          console.log('📋 Existing allocation:', existingAllocation);

          if (existingAllocation) {
            // Update existing allocation
            console.log('🔄 Updating existing allocation...');
            await get().updateEnvelopeAllocation(existingAllocation.id!, {
              budgetedAmount,
            });
            console.log('✅ Allocation updated');
          } else {
            // Create new allocation
            console.log('➕ Creating new allocation...');
            await get().createEnvelopeAllocation({
              envelopeId,
              budgetedAmount,
            });
            console.log('✅ Allocation created');
          }
		  
          // Sync the allocation with a transaction in the envelopeStore
          console.log('🔄 Syncing budget allocation transaction...');
          const currentMonth = get().currentMonth;
          await syncBudgetAllocationTransaction(envelopeId, budgetedAmount, currentMonth);
          console.log('✅ Transaction synced');

          // After syncing, refresh the available to budget calculation
          console.log('🔄 Refreshing available to budget...');
          await get().refreshAvailableToBudget();
          console.log('✅ Available to budget refreshed');

        } catch (error) {
          console.error('❌ Error setting envelope allocation:', error);
          console.error('Error details:', error instanceof Error ? error.message : error);
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
			
			// ---- NEW LOGIC ----
			// Fetch previous month's data directly instead of using service-level copy
			const [prevIncome, prevAllocations] = await Promise.all([
				service.getIncomeSources(userId, prevMonthString),
				service.getEnvelopeAllocations(userId, prevMonthString),
			]);
	
			// Create new income sources for the current month
			for (const source of prevIncome) {
				await get().createIncomeSource({ name: source.name, amount: source.amount });
			}
			
			// Create new allocations for the current month using the store's action
			// This will trigger the transaction creation logic
			for (const allocation of prevAllocations) {
				await get().setEnvelopeAllocation(allocation.envelopeId, allocation.budgetedAmount);
			}
			// ---- END NEW LOGIC ----
	
			// Process piggybank auto-contributions for the new month
			await get().processMonthlyPiggybankContributions(currentMonth);
	
			// Refresh data for the current month to update the UI
			await get().fetchMonthlyData();
        } catch (error) {
          console.error('Error copying from previous month:', error);
          set({
            error: error instanceof Error ? error.message : 'Failed to copy month data',
            isLoading: false,
          });
        }
      },

      // Process monthly piggybank auto-contributions
      processMonthlyPiggybankContributions: async (month: string) => {
        try {
          console.log('🐷 Processing piggybank contributions for month:', month);
          const { envelopes, transactions, addTransaction } = useEnvelopeStore.getState();

          // Don't create contributions for months beyond the real current month
          const now = new Date();
          const currentRealMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          if (month > currentRealMonth) {
            console.log(`Skipping piggybank contributions for ${month} - future month beyond ${currentRealMonth}`);
            return;
          }

          // Find all active piggybanks
          const piggybanks = envelopes.filter(e => e.isPiggybank && e.isActive);
          console.log(`Found ${piggybanks.length} active piggybanks`);
          
          if (piggybanks.length === 0) {
            console.log('No piggybanks to process');
            return;
          }
          
          // Check if contributions already exist for this month
          const [year, monthNum] = month.split('-').map(Number);
          
          for (const piggybank of piggybanks) {
            const contribution = piggybank.piggybankConfig?.monthlyContribution || 0;
            const isPaused = piggybank.piggybankConfig?.paused || false;
            
            if (isPaused) {
              console.log(`Skipping ${piggybank.name} - contributions paused`);
              continue;
            }
            
            if (contribution <= 0) {
              console.log(`Skipping ${piggybank.name} - no contribution set`);
              continue;
            }
            
            // Check if piggybank was created after this month (don't add contributions to past months)
            if (piggybank.createdAt) {
              const createdDate = new Date(piggybank.createdAt);
              const createdMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
              
              if (month < createdMonth) {
                console.log(`Skipping ${piggybank.name} - month ${month} is before creation month ${createdMonth}`);
                continue;
              }
            }
            
            // Check if auto-contribution already exists for this piggybank this month
            const existingContribution = transactions.find(tx => 
              tx.envelopeId === piggybank.id &&
              tx.isAutomatic === true &&
              tx.month === month &&
              tx.type === 'Income'
            );
            
            if (existingContribution) {
              console.log(`Auto-contribution already exists for ${piggybank.name} in ${month}`);
              continue;
            }
            
            // Create auto-contribution transaction
            console.log(`Creating auto-contribution for ${piggybank.name}: $${contribution}`);
            const transactionDate = new Date(year, monthNum - 1, 1, 12, 0, 0);
            
            await addTransaction({
              amount: contribution,
              description: `Monthly contribution to ${piggybank.name}`,
              date: transactionDate.toISOString(),
              envelopeId: piggybank.id,
              type: 'Income',
              reconciled: false,
              isAutomatic: true
            });
            
            console.log(`✅ Created auto-contribution for ${piggybank.name}`);
          }
          
          // Refresh available to budget after contributions
          await get().refreshAvailableToBudget();
          
        } catch (error) {
          console.error('Error processing piggybank contributions:', error);
          throw error;
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
          const state = get();
          const userId = getUserId();
          const currentMonth = state.currentMonth;

          // Calculate available to budget using local state to avoid re-fetching
          const totalIncome = state.incomeSources.reduce((sum, source) => sum + source.amount, 0);
          const totalAllocations = state.envelopeAllocations.reduce((sum, alloc) => sum + alloc.budgetedAmount, 0);
          const availableToBudget = totalIncome - totalAllocations;

          const service = MonthlyBudgetService.getInstance();

          // Update or create monthly budget document in Firestore
          const currentBudget = state.monthlyBudget;
          if (currentBudget) {
            const updatedBudget = { ...currentBudget, availableToBudget, totalIncome };
            await service.createOrUpdateMonthlyBudget(updatedBudget);
            set({ monthlyBudget: updatedBudget });
          } else {
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
	
			// ---- NEW LOGIC ----
			// Delete the corresponding allocation transactions
			const { transactions, deleteTransaction } = useEnvelopeStore.getState();
			const allocationDescription = "Monthly Budget Allocation";
			const [year, monthNum] = currentMonth.split('-').map(Number);
	
			const transactionsToDelete = transactions.filter(tx => {
				if (tx.description !== allocationDescription) return false;
				try {
					const txDate = new Date(tx.date);
					return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
				} catch(e) { return false; }
			});
	
			for (const tx of transactionsToDelete) {
				await deleteTransaction(tx.id);
			}
			// ---- END NEW LOGIC ----
	
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
      version: 1,
      partialize: (state) => ({
        // Persist the data so it's available offline
        incomeSources: state.incomeSources,
        envelopeAllocations: state.envelopeAllocations,
        monthlyBudget: state.monthlyBudget,
        // Don't persist currentMonth - always start on actual current month
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
