import { BudgetService } from '../services/budgetService';
import { CategoryService } from '../services/CategoryService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();
const categoryService = CategoryService.getInstance();

// Helper to require an authenticated user (throws if not logged in)
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};

export const createDataSlice = ({ set, get }: SliceParams) => ({
    setMonth: async (month: string) => {
        set({ currentMonth: month });
        
        const state = get();
        
        // Ensure month is in loadedTransactionMonths so real-time listener starts
        if (!state.loadedTransactionMonths.includes(month)) {
            set(state => ({
                loadedTransactionMonths: [...state.loadedTransactionMonths, month]
            }));
        }

        // Check if we have transactions for this month but no income sources/allocations
        // This can happen when switching to a month that has transactions but hasn't been lazy-loaded yet
        const missingMonthData = 
            state.incomeSources[month] === undefined || 
            state.allocations[month] === undefined;
        
        // Check if we need to fetch budget data for this month
        if (missingMonthData) {
            logger.log(`Month ${month} budget data missing in store, fetching...`);
            set({ isLoading: true });
            await get().fetchMonthData(month);
            set({ isLoading: false });
        }
    },

    init: async () => {
        logger.log("BudgetStore initializing...");
        const state = get();
        
        try {
            // Set loading state
            set({ isLoading: true, error: null });
            
            const { currentUser } = useAuthStore.getState();
            
            if (!currentUser) {
                logger.log("No user logged in, skipping data fetch");
                set({ isLoading: false });
                return;
            }
            
            logger.log(`Fetching data for user: ${currentUser.id}, month: ${state.currentMonth}`);
            
            // Fetch data in parallel
            // OPTIMIZATION: Real-time listeners will handle transactions once setup.
            // We only need to fetch the core building blocks and the budget data for the current month.
            const [envelopes, categoriesResult, monthData] = await Promise.all([
                budgetService.getEnvelopes(currentUser.id),
                categoryService.getCategories(currentUser.id).catch(err => {
                    logger.error('⚠️ Failed to load categories:', err);
                    return []; // Fallback to empty array
                }),
                budgetService.getMonthData(currentUser.id, state.currentMonth)
            ]);

            // Ensure transactions for current month are marked as loading/loaded
            // so the real-time listener doesn't compete with a manual fetch
            const currentMonths = [state.currentMonth];
            
            // Deduplicate categories by ID
            let uniqueCategories = Array.from(new Map(categoriesResult.map(c => [c.id, c])).values());

            // If there are duplicate category names in Firestore, clean them up
            const nameSet = new Set<string>();
            let hasDuplicateNames = false;
            for (const cat of uniqueCategories) {
                const key = cat.name.toLowerCase().trim();
                if (nameSet.has(key)) { hasDuplicateNames = true; break; }
                nameSet.add(key);
            }
            if (hasDuplicateNames && currentUser) {
                logger.log('🧹 Duplicate category names detected, running Firestore cleanup...');
                const removed = await categoryService.deduplicateCategories(currentUser.id);
                if (removed > 0) {
                    const freshCategories = await categoryService.getCategories(currentUser.id);
                    uniqueCategories = freshCategories;
                }
            }

            // Update state with fetched data
            set({
                envelopes,
                loadedTransactionMonths: currentMonths,
                areAllTransactionsLoaded: false, 
                categories: uniqueCategories,
                incomeSources: {
                    ...state.incomeSources,
                    [state.currentMonth]: monthData.incomeSources
                },
                allocations: {
                    ...state.allocations,
                    [state.currentMonth]: monthData.allocations
                },
                isLoading: false,
                error: null
            });
            
            logger.log(`✅ BudgetStore initialized: ${envelopes.length} envelopes, current month: ${state.currentMonth}`);
            
            // 🔧 Auto-detect and fix lazy loading gaps
            // Check for months that have persisted transactions but no budget data (income/allocations).
            // This can happen when localStorage has stale transaction data from previous sessions.
            const freshState = get();
            const monthsWithTransactions = new Set(
                freshState.transactions.map(t => t.month)
            );
            
            const missingDataMonths = Array.from(monthsWithTransactions).filter((month): month is string => 
                month !== undefined && 
                month !== freshState.currentMonth && // Current month already fetched above
                (!freshState.incomeSources[month] || !freshState.allocations[month])
            );
            
            if (missingDataMonths.length > 0) {
                logger.log(`🔧 Auto-fixing ${missingDataMonths.length} lazy loading gaps: ${missingDataMonths.join(', ')}`);
                
                // Fix missing month data sequentially to avoid overwhelming Firestore
                for (const month of missingDataMonths) {
                    try {
                        await get().fetchMonthData(month);
                        
                        // Check if month data is still missing after fetch (Firestore had no data)
                        const latestState = get();
                        if (!latestState.incomeSources[month] || !latestState.allocations[month]) {
                            logger.log(`🔧 Creating empty month data for ${month} (no budget data found in Firestore)`);
                            
                            // Create empty month data in the store
                            set(state => ({
                                incomeSources: {
                                    ...state.incomeSources,
                                    [month]: []
                                },
                                allocations: {
                                    ...state.allocations,
                                    [month]: []
                                }
                            }));
                        }
                        
                        logger.log(`✅ Fixed lazy loading gap for ${month}`);
                    } catch (error) {
                        logger.error(`❌ Failed to fix lazy loading gap for ${month}:`, error);
                    }
                }
            } else {
                logger.log(`ℹ️ No lazy loading gaps detected for current month transactions`);
            }
            
        } catch (error) {
            logger.error('❌ BudgetStore initialization failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to initialize budget data' 
            });
        }
    },

    fetchData: async () => {
        // Simply call init() to fetch all data
        await get().init();
    },

    fetchMonthData: async (month: string) => {
        try {
            const { currentUser } = useAuthStore.getState();
            
            if (!currentUser) {
                logger.log("No user logged in, skipping month data fetch");
                return;
            }

            logger.log(`Fetching month data for: ${month}`);
            
            // Mark transaction month as loading so real-time listener kicks in
            if (!get().loadedTransactionMonths.includes(month)) {
                set(state => ({
                    loadedTransactionMonths: [...state.loadedTransactionMonths, month]
                }));
            }

            // Fetch budget data
            const monthData = await budgetService.getMonthData(currentUser.id, month);
            
            const state = get();
            set({
                incomeSources: {
                    ...state.incomeSources,
                    [month]: monthData.incomeSources
                },
                allocations: {
                    ...state.allocations,
                    [month]: monthData.allocations
                }
            });
            logger.log(`✅ Fetched budget data for ${month}`);

            // --- Self-Healing: Verify Allocations vs Transactions ---
            // Only run for the current month to avoid creating spurious transactions
            // during analytics bulk pre-fetching of historical months
            if (month === get().currentMonth) {
                const verifyAndRepairAllocations = async () => {
                    try {
                        const currentState = get();
                        const monthAllocations = currentState.allocations[month] || [];
                        const monthTransactions = currentState.transactions.filter(t => t.month === month);
                        
                        let repairs = 0;

                        for (const alloc of monthAllocations) {
                            // Skip if envelope is a piggybank (handled differently)
                            const envelope = currentState.envelopes.find(e => e.id === alloc.envelopeId);
                            if (envelope?.isPiggybank) continue;

                            const matchingTx = monthTransactions.find(t => 
                                t.envelopeId === alloc.envelopeId && 
                                (t.description === 'Monthly Budget Allocation' || 
                                 t.description === 'Monthly Allocation' ||
                                 t.description === 'Budgeted' ||
                                 t.description === 'Piggybank Contribution')
                            );

                            if (!matchingTx) {
                                if (alloc.budgetedAmount > 0) {
                                    logger.log(`🔧 Repairing missing transaction for envelope ${envelope?.name || alloc.envelopeId}`);
                                    await currentState.addTransaction({
                                        description: 'Budgeted',
                                        amount: alloc.budgetedAmount,
                                        envelopeId: alloc.envelopeId,
                                        type: 'Income',
                                        month: month,
                                        date: `${month}-01T00:00:00`,
                                        reconciled: false,
                                        isAutomatic: true
                                    });
                                    repairs++;
                                }
                            } else if (matchingTx.amount !== alloc.budgetedAmount) {
                                logger.log(`🔧 Repairing mismatch for envelope ${envelope?.name || alloc.envelopeId}: Alloc ${alloc.budgetedAmount} vs Tx ${matchingTx.amount}`);
                                await currentState.updateTransaction({
                                    ...matchingTx,
                                    amount: alloc.budgetedAmount
                                });
                                repairs++;
                            }
                        }
                        if (repairs > 0) logger.log(`✅ Repaired ${repairs} allocation discrepancies for ${month}`);
                    } catch (error) {
                        logger.error(`❌ Verification failed for ${month}:`, error);
                        // Don't throw - verification failures shouldn't break the main fetch
                    }
                };

                // Run verification with delay to avoid conflicts with rapid switching
                setTimeout(() => {
                    verifyAndRepairAllocations().catch(err => logger.error('Verification failed:', err));
                }, 1000); // 1 second delay
            }

        } catch (error) {
            logger.error(`❌ Failed to fetch month data for ${month}:`, error);
        }
    },

    clearMonthData: async (month: string) => {
        try {
            set({ isLoading: true, error: null });
            logger.log(`🗑️ Clearing all data for month: ${month}`);

            const currentUser = requireAuth();

            const { monthlyBudgetService } = await import('../services/MonthlyBudgetService');
            
            await monthlyBudgetService.clearMonthData(currentUser.id, month);
            
            // Refresh data to reflect changes
            await get().init();
            
            logger.log(`✅ Cleared month data for ${month}`);
            set({ isLoading: false });

        } catch (error) {
            logger.error(`❌ clearMonthData failed:`, error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to clear month data' 
            });
            throw error;
        }
    },

    resetData: async () => {
        logger.log('🔄 Resetting all data');
        set({ isLoading: true });
        
        try {
            const { currentUser } = useAuthStore.getState();
            
            if (currentUser) {
                logger.log('🔥 Deleting all data from Firestore for user:', currentUser.id);
                await budgetService.deleteAllUserData(currentUser.id);
            } else {
                logger.warn('⚠️ No user logged in, only clearing local state');
            }

            set({
                envelopes: [],
                transactions: [],
                appSettings: null,
                incomeSources: {},
                allocations: {},
                isLoading: false,
                error: null
            });
            logger.log('✅ Reset data complete');
        } catch (error) {
            logger.error('❌ resetData failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to reset data' 
            });
            throw error;
        }
    },

    importData: async (data: any): Promise<{ success: boolean; message: string }> => {
        try {
            set({ isLoading: true, error: null });
            
            // Basic validation
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format');
            }

            const currentUser = requireAuth();

            logger.log('🔄 Starting Time Machine Restore for user:', currentUser.id);
            
            // Perform the cloud restore
            await budgetService.restoreUserData(currentUser.id, data);
            
            // Re-initialize the app with the new cloud data
            logger.log('🔄 Reloading app state from cloud...');
            await get().init();
            
            set({ isLoading: false });
            return { success: true, message: 'Data restored successfully from backup.' };
            
        } catch (error) {
            logger.error('❌ importData failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to import data' 
            });
            return { success: false, message: error instanceof Error ? error.message : 'Import failed' };
        }
    },

    handleUserLogout: () => {
        logger.log('🧹 Clearing user data on logout');
        // Reset onboarding state (user-specific keys remain in localStorage)
        set({
            envelopes: [],
            transactions: [],
            categories: [],
            incomeSources: {},
            allocations: {},
            isOnboardingActive: false,
            isOnboardingCompleted: false,
            isLoading: false,
            error: null
        });
    },
});
