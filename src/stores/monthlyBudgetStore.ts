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
import { toMonthKey, toDate } from '../utils/dateUtils';

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
  pendingDeletedIncomeSources: string[]; // Income source IDs pending deletion from Firebase

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
  clearMonthlyBudget: () => void;

  // Maintenance actions
  cleanupInvalidAllocations: () => void;
  cleanupOrphanedAllocations: () => Promise<void>;

  // Network and sync actions
  updateOnlineStatus: () => Promise<void>;
  syncData: () => Promise<void>;
  handleUserLogout: () => void;
}

// Helper function to get user ID
const getUserId = (): string => {
  const user = useAuthStore.getState().currentUser;
  if (!user) throw new Error('User not authenticated');
  return user.id;
};

// Export getCurrentUserId for use in realtime setup
export const getCurrentUserId = getUserId;

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = (): string => {
  return toMonthKey(new Date());
};

const syncBudgetAllocationTransaction = async (envelopeId: string, budgetedAmount: number, month: string) => {
	const { transactions, addTransaction, deleteTransaction, updateTransaction } = useEnvelopeStore.getState();
  
	const allocationDescription = "Monthly Budget Allocation";
	const [year, monthNum] = month.split('-').map(Number);
  
	console.log('🔍 Syncing budget allocation transaction:', { envelopeId, budgetedAmount, month, totalTransactions: transactions.length });
  
	// Find ALL existing allocation transactions for this envelope and month
	const existingTxs = transactions.filter(tx => {
		if (tx.envelopeId !== envelopeId) return false;
        
        // Match both the new standard description AND the legacy description
        const isAllocation = tx.description === allocationDescription;
        const isLegacyContribution = tx.description.startsWith('Monthly contribution to');
        
        if (!isAllocation && !isLegacyContribution) return false;

		try {
		  const txDate = toDate(tx.date);
		  return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
		} catch (e) {
		  return false;
		}
	});
  
	console.log('📋 Found existing transactions:', existingTxs.length);

    const newAmount = new Decimal(budgetedAmount.toString() || '0');

    if (existingTxs.length > 0) {
        // UPSERT LOGIC: Update the first one, delete the rest
        const [txToUpdate, ...txsToDelete] = existingTxs;

        // Delete duplicates
        for (const tx of txsToDelete) {
            console.log('🗑️ Deleting duplicate allocation transaction:', tx.id);
            await deleteTransaction(tx.id);
        }

        // Update the primary transaction if amount or description changed
        if (txToUpdate.amount !== newAmount.toNumber() || txToUpdate.description !== allocationDescription) {
            console.log('🔄 Updating existing allocation transaction:', txToUpdate.id, 'to amount:', newAmount.toNumber());
            await updateTransaction({
                ...txToUpdate,
                amount: newAmount.toNumber(),
                description: allocationDescription, // Standardize description
                type: 'Income',
                reconciled: true
            });
        } else {
            console.log('✅ Transaction already correct:', txToUpdate.id);
        }

    } else {
        // CREATE LOGIC: Only if no transaction exists and not future month
        if (newAmount.gt(0)) {
            // Check if this is a future month
            const currentRealMonth = toMonthKey(new Date());
            const targetMonth = `${year}-${String(monthNum).padStart(2, '0')}`;
            
            if (targetMonth > currentRealMonth) {
                console.log(`🚫 Skipping allocation transaction for ${targetMonth} - future month beyond ${currentRealMonth}`);
                return;
            }
            
            console.log('➕ Creating new allocation transaction with amount', newAmount.toNumber());
            const transactionDate = new Date(year, monthNum - 1, 1).toISOString(); // Use 1st of month
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
      pendingDeletedIncomeSources: [],

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

            // Clean up any orphaned allocations (allocations for deleted envelopes)
            await get().cleanupOrphanedAllocations();

            // Process monthly piggybank auto-contributions if real calendar month matches budget month
            const realMonth = toMonthKey(new Date());
            if (realMonth === currentMonth) {
              console.log(`📅 Real month ${realMonth} matches budget month ${currentMonth} - processing piggybank contributions`);
              await get().processMonthlyPiggybankContributions(currentMonth);
            } else {
              console.log(`📅 Real month ${realMonth} doesn't match budget month ${currentMonth} - skipping piggybank contributions`);
            }
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
        const userId = getUserId();
        const currentMonth = get().currentMonth;
        
        // Generate temp ID for optimistic update
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const now = new Date().toISOString();
        const tempSource: IncomeSource = {
          ...sourceData,
          id: tempId,
          userId,
          month: currentMonth,
          createdAt: now,
          updatedAt: now
        };
        
        // Update local state immediately
        set(state => ({
          incomeSources: [...state.incomeSources, tempSource]
        }));
        
        try {
          console.log('🔄 Creating income source in Firebase...', sourceData);
          const service = MonthlyBudgetService.getInstance();
          
          const createPromise = service.createIncomeSource({
            ...sourceData,
            userId,
            month: currentMonth,
          });
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 3000)
          );
          
          await Promise.race([createPromise, timeoutPromise]);
          console.log('✅ Income source created in Firebase successfully');

          // Refresh to get real ID from Firebase
          const refreshedSources = await service.getIncomeSources(userId, currentMonth);
          console.log('✅ Refreshed income sources:', refreshedSources);
          set({ incomeSources: refreshedSources });
          
          // Update monthly budget with new totalIncome
          await get().refreshAvailableToBudget();
        } catch (error: any) {
          const isOffline = error?.message?.includes('timeout') || !navigator.onLine;
          
          if (isOffline) {
            console.log('📴 Offline detected - keeping income source locally, will sync when online');
            console.log('📴 Error details:', error);
            // Keep the temp income source, it will sync when online
          } else {
            console.error('❌ Error creating income source:', error);
            // Remove temp source on real error
            set(state => ({
              incomeSources: state.incomeSources.filter(s => s.id !== tempId)
            }));
            throw error;
          }
        }
      },

      updateIncomeSource: async (id: string, updates: Partial<IncomeSource>) => {
        // Update local state immediately
        const now = new Date().toISOString();
        set(state => ({
          incomeSources: state.incomeSources.map(source =>
            source.id === id ? { ...source, ...updates, updatedAt: now } : source
          )
        }));
        
        try {
          // Build update object with only defined values
          const updateData: any = {
            updatedAt: Timestamp.now(),
          };

          if (updates.name !== undefined) updateData.name = updates.name;
          if (updates.amount !== undefined) updateData.amount = updates.amount.toString();
          if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
          if (updates.category !== undefined) updateData.category = updates.category;

          const userId = getUserId();
          const docRef = doc(db, 'users', userId, 'incomeSources', id);
          
          const updatePromise = updateDoc(docRef, updateData);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 3000)
          );
          
          await Promise.race([updatePromise, timeoutPromise]);

          // Force a refresh of the income sources to ensure UI updates
          const service = MonthlyBudgetService.getInstance();
          const currentMonth = get().currentMonth;
          const refreshedSources = await service.getIncomeSources(userId, currentMonth);

          set({ incomeSources: refreshedSources });
        } catch (error: any) {
          const isOffline = error?.message?.includes('timeout') || !navigator.onLine;
          
          if (isOffline) {
            console.log('📴 Offline detected - keeping income source update locally, will sync when online');
            // Keep the local update, it will sync when online
          } else {
            console.error('Error updating income source:', error);
            throw error;
          }
        }
      },

      deleteIncomeSource: async (id: string) => {
        // Remove from local state immediately for instant UI feedback
        set(state => ({
          incomeSources: state.incomeSources.filter(source => source.id !== id),
        }));

        try {
          // Delete from Firebase with timeout
          const service = MonthlyBudgetService.getInstance();
          const userId = getUserId();
          const deletePromise = service.deleteIncomeSource(userId, id);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 3000)
          );
          
          await Promise.race([deletePromise, timeoutPromise]);
          
          // Recalculate and update monthly budget after deletion
          await get().refreshAvailableToBudget();
        } catch (err: any) {
          const isOffline = err.message?.includes('timeout') || !navigator.onLine;
          
          if (isOffline) {
            // Offline: Keep the local deletion, mark for later sync
            console.log('📴 Offline detected - keeping income source deletion locally, will sync when online');
            set((state: any) => ({
              pendingSync: true,
              pendingDeletedIncomeSources: [...state.pendingDeletedIncomeSources, id]
            }));
          } else {
            console.error('Error deleting income source from Firebase:', err);
            // Note: Local state is already updated, so UI remains consistent
          }
          
          // Recalculate budget even if offline
          await get().refreshAvailableToBudget();
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

          // Optimistic update - add allocation immediately to local state
          const tempId = `temp-${Date.now()}-${Math.random()}`;
          const now = new Date().toISOString();
          const tempAllocation: EnvelopeAllocation = {
            ...allocationData,
            id: tempId,
            userId,
            month: currentMonth,
            createdAt: now,
            updatedAt: now
          };
          
          set(state => ({
            envelopeAllocations: [...state.envelopeAllocations, tempAllocation]
          }));

          // Try to sync with Firebase
          const service = MonthlyBudgetService.getInstance();
          try {
            const firebasePromise = service.createEnvelopeAllocation({
              ...allocationData,
              userId,
              month: currentMonth,
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 3000)
            );
            
            await Promise.race([firebasePromise, timeoutPromise]);
            
            // If successful, refresh to get real ID
            const refreshedAllocations = await service.getEnvelopeAllocations(userId, currentMonth);
            set({ envelopeAllocations: refreshedAllocations });
          } catch (err: any) {
            const isOffline = err.message?.includes('timeout') || !navigator.onLine;
            if (isOffline) {
              console.log('📴 Offline - keeping allocation locally, will sync when online');
              // Keep the temp allocation and mark for sync
              set({ pendingSync: true });
            } else {
              console.error('❌ Real error - removing temp allocation');
              set(state => ({
                envelopeAllocations: state.envelopeAllocations.filter(a => a.id !== tempId)
              }));
              throw err;
            }
          }
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
          
          await service.updateEnvelopeAllocation(userId, id, updateData);

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
        const userId = getUserId();
        service.deleteEnvelopeAllocation(userId, id).catch((error) => {
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
		  
          // Sync the allocation with a transaction in the envelopeStore
          const currentMonth = get().currentMonth;
          await syncBudgetAllocationTransaction(envelopeId, budgetedAmount, currentMonth);

          // After syncing, refresh the available to budget calculation
          await get().refreshAvailableToBudget();

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
			const prevMonthString = toMonthKey(new Date(prevYear, prevMonth - 1, 1));
	
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
          const { envelopes, transactions, deleteTransaction } = useEnvelopeStore.getState();

          // Only create contributions for the current real calendar month
          const currentRealMonth = toMonthKey(new Date());
          if (month !== currentRealMonth) {
            if (month > currentRealMonth) {
              console.log(`Skipping piggybank contributions for ${month} - future month beyond ${currentRealMonth}`);
            } else {
              console.log(`Skipping piggybank contributions for ${month} - past month, current is ${currentRealMonth}`);
            }
            return;
          }

          // Find all active piggybanks
          const piggybanks = envelopes.filter(e => e.isPiggybank && e.isActive);
          console.log(`Found ${piggybanks.length} active piggybanks`);
          
          if (piggybanks.length === 0) {
            console.log('No piggybanks to process');
            return;
          }
          
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
              const createdDate = toDate(piggybank.createdAt);
              const createdMonth = toMonthKey(createdDate);
              
              if (month < createdMonth) {
                console.log(`Skipping ${piggybank.name} - month ${month} is before creation month ${createdMonth}`);
                continue;
              }
            }

            // 1. Clean up legacy "Monthly contribution to..." transactions if they exist
            const legacyTransactions = transactions.filter(tx => 
              tx.envelopeId === piggybank.id &&
              tx.isAutomatic === true &&
              tx.month === month &&
              tx.description.startsWith('Monthly contribution to')
            );
            
            if (legacyTransactions.length > 0) {
              console.log(`Found ${legacyTransactions.length} legacy auto-contributions for ${piggybank.name}. Deleting all...`);
              for (const tx of legacyTransactions) {
                console.log(`Deleting legacy transaction ${tx.id}`);
                await deleteTransaction(tx.id);
              }
            }

            // 2. Check current allocations and deduplicate if necessary
            const matchingAllocations = get().envelopeAllocations.filter(
              a => a.envelopeId === piggybank.id && a.month === month
            );

            if (matchingAllocations.length > 1) {
              console.warn(`Found ${matchingAllocations.length} duplicate allocations for ${piggybank.name}. Cleaning up...`);
              // Keep the first one, delete the rest
              const [keep, ...remove] = matchingAllocations;
              for (const alloc of remove) {
                if (alloc.id) {
                  console.log(`Deleting duplicate allocation ${alloc.id}`);
                  await get().deleteEnvelopeAllocation(alloc.id);
                }
              }
              
              // Update the kept one if needed
              if (keep.budgetedAmount !== contribution) {
                console.log(`Updating allocation for ${piggybank.name} to $${contribution}`);
                await get().setEnvelopeAllocation(piggybank.id, contribution);
              }
            } else if (matchingAllocations.length === 1) {
              // Update if needed
              const currentAmount = matchingAllocations[0].budgetedAmount;
              if (currentAmount !== contribution) {
                console.log(`Updating allocation for ${piggybank.name} to $${contribution}`);
                await get().setEnvelopeAllocation(piggybank.id, contribution);
              } else {
                // Check if the corresponding transaction exists
                const allocationTransaction = transactions.find(tx => 
                  tx.envelopeId === piggybank.id && 
                  tx.month === month && 
                  tx.description === "Monthly Budget Allocation"
                );
                
                if (!allocationTransaction) {
                  console.log(`🔧 Missing transaction for ${piggybank.name} allocation - creating transaction`);
                  // Call syncBudgetAllocationTransaction to create the missing transaction
                  await syncBudgetAllocationTransaction(piggybank.id, currentAmount, month);
                } else {
                  console.log(`Allocation for ${piggybank.name} already correct ($${contribution})`);
                }
              }
            } else {
              // Create new allocation
              console.log(`Creating initial allocation for ${piggybank.name} ($${contribution})`);
              await get().setEnvelopeAllocation(piggybank.id, contribution);
            }
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

          console.log('💰 Refreshing monthly budget...');
          console.log('💰 Income sources in state:', state.incomeSources);
          console.log('💰 Allocations in state:', state.envelopeAllocations);

          // Calculate available to budget using local state to avoid re-fetching
          const totalIncome = state.incomeSources.reduce((sum, source) => sum + source.amount, 0);
          const totalAllocations = state.envelopeAllocations.reduce((sum, alloc) => sum + alloc.budgetedAmount, 0);
          const availableToBudget = totalIncome - totalAllocations;

          console.log('💰 Calculated totalIncome:', totalIncome);
          console.log('💰 Calculated totalAllocations:', totalAllocations);
          console.log('💰 Calculated availableToBudget:', availableToBudget);

          const service = MonthlyBudgetService.getInstance();

          // Update or create monthly budget document in Firestore
          const currentBudget = state.monthlyBudget;
          if (currentBudget) {
            console.log('💰 Updating existing budget:', currentBudget);
            const updatedBudget = { ...currentBudget, availableToBudget, totalIncome };
            await service.createOrUpdateMonthlyBudget(updatedBudget);
            set({ monthlyBudget: updatedBudget });
            console.log('✅ Monthly budget updated in Firebase');
          } else {
            console.log('💰 Creating new budget');
            const newBudget = await service.createOrUpdateMonthlyBudget({
              userId,
              month: currentMonth,
              totalIncome,
              availableToBudget,
            });
            set({ monthlyBudget: newBudget });
            console.log('✅ Monthly budget created in Firebase:', newBudget);
          }
        } catch (error) {
          console.error('❌ Error refreshing available to budget:', error);
        }
      },

      clearMonthData: async () => {
        try {
          const userId = getUserId();
          const currentMonth = get().currentMonth;

          const service = MonthlyBudgetService.getInstance();

          // ---- NEW LOGIC ----
          // Delete the corresponding allocation transactions
          const { transactions, deleteTransaction, envelopes } = useEnvelopeStore.getState();
          const allocationDescription = "Monthly Budget Allocation";
          const [year, monthNum] = currentMonth.split('-').map(Number);

          const transactionsToDelete = transactions.filter(tx => {
            if (tx.description !== allocationDescription) return false;
            try {
              const txDate = toDate(tx.date);
              return txDate.getFullYear() === year && txDate.getMonth() + 1 === monthNum;
            } catch(e) { return false; }
          });

          for (const tx of transactionsToDelete) {
            await deleteTransaction(tx.id);
          }

          // Delete piggybanks created in current month and their current month data only
          const currentMonthPiggybanks = envelopes.filter(env => {
            if (!env.isPiggybank) return false;
            
            // Check if piggybank was created in current month
            if (env.createdAt) {
              const createdDate = toDate(env.createdAt);
              const createdMonth = toMonthKey(createdDate);
              return createdMonth === currentMonth;
            }
            
            return false; // Legacy piggybanks without createdAt - don't delete
          });
          
          console.log(`🐷 Deleting ${currentMonthPiggybanks.length} piggybanks created in ${currentMonth}`);
          
          for (const piggybank of currentMonthPiggybanks) {
            // Delete piggybank's transactions from current month only
            const piggybankTransactions = transactions.filter(tx => 
              tx.envelopeId === piggybank.id && tx.month === currentMonth
            );
            
            for (const tx of piggybankTransactions) {
              console.log(`🗑️ Deleting transaction ${tx.id} for ${piggybank.name} from ${currentMonth}`);
              await deleteTransaction(tx.id);
            }
            
            // Delete piggybank's allocation from current month only
            const allocation = get().envelopeAllocations.find(a => 
              a.envelopeId === piggybank.id && a.month === currentMonth
            );
            if (allocation) {
              console.log(`🗑️ Deleting allocation ${allocation.id} for ${piggybank.name} from ${currentMonth}`);
              await get().deleteEnvelopeAllocation(allocation.id!);
            }
            
            // Delete the piggybank itself
            console.log(`🗑️ Deleting piggybank ${piggybank.name} (created in ${currentMonth})`);
            const { deleteEnvelope } = useEnvelopeStore.getState();
            await deleteEnvelope(piggybank.id);
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

      clearMonthlyBudget: async () => {
        console.log('🧹 Clearing monthly budget data (local and Firebase)...');
        
        // Clear local state
        set({
          monthlyBudget: null,
          incomeSources: [],
          envelopeAllocations: [],
        });

        // Also clear Firebase data for current month
        try {
          await get().clearMonthData();
          console.log('✅ Firebase monthly budget data cleared');
        } catch (error) {
          console.error('❌ Failed to clear Firebase monthly budget data:', error);
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

      cleanupInvalidAllocations: () => {
        const current = get().envelopeAllocations;
        const valid = current.filter(a => 
          a.budgetedAmount > 0 && !a.envelopeId.startsWith('temp-')
        );
        if (current.length !== valid.length) {
          set({ envelopeAllocations: valid });
          console.log(`Cleaned ${current.length - valid.length} invalid allocations`);
        }
      },

      cleanupOrphanedAllocations: async () => {
        const { envelopes } = await import('./envelopeStore').then(m => m.useEnvelopeStore.getState());
        const allocations = get().envelopeAllocations;
        const orphaned = allocations.filter(a => !envelopes.some(env => env.id === a.envelopeId));
        
        if (orphaned.length > 0) {
          console.log(`🧹 Found ${orphaned.length} orphaned allocations, cleaning up...`);
          
          // Delete from Firebase
          const userId = getUserId();
          const service = MonthlyBudgetService.getInstance();
          for (const allocation of orphaned) {
            if (allocation.id && !allocation.id.startsWith('temp-')) {
              try {
                await service.deleteEnvelopeAllocation(userId, allocation.id);
                console.log(`✅ Deleted orphaned allocation ${allocation.id}`);
              } catch (err) {
                console.error(`❌ Failed to delete orphaned allocation ${allocation.id}:`, err);
              }
            }
          }
          
          // Remove from local state
          set({
            envelopeAllocations: allocations.filter(a => envelopes.some(env => env.id === a.envelopeId))
          });
          
          // Refresh budget
          await get().refreshAvailableToBudget();
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
        currentMonth: state.currentMonth,
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
