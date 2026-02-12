import { BudgetService } from '../services/budgetService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { IncomeSource, EnvelopeAllocation } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();

// Helper to require an authenticated user (throws if not logged in)
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};

export const createAllocationSlice = ({ set, get }: SliceParams) => ({
    addIncomeSource: async (month: string, source: Omit<IncomeSource, 'id'>): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();
            
            logger.log('🔧 Adding income source:', { month, source });
            
            // Create income source via service
            const newIncomeSource = await budgetService.createIncomeSource({
                ...source,
                userId: currentUser.id,
                month
            });
            
            // Add to local state - Check for duplicates first
            set(state => {
                const currentSources = state.incomeSources[month] || [];
                const exists = currentSources.some(s => s.id === newIncomeSource.id);
                if (exists) return { isLoading: false };
                
                return {
                    incomeSources: {
                        ...state.incomeSources,
                        [month]: [...currentSources, newIncomeSource]
                    },
                    isLoading: false
                };
            });
            
            logger.log('✅ Added income source:', newIncomeSource.id);
            
        } catch (error) {
            logger.error('❌ addIncomeSource failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to add income source' 
            });
            throw error;
        }
    },

    updateIncomeSource: async (month: string, source: IncomeSource): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            logger.log('🔧 Updating income source:', { month, sourceId: source.id });
            
            // Update local state
            set(state => ({
                incomeSources: {
                    ...state.incomeSources,
                    [month]: state.incomeSources[month]?.map(s => 
                        s.id === source.id ? { ...source, updatedAt: new Date().toISOString() } : s
                    ) || []
                },
                isLoading: false
            }));
            
            // Update in backend
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) return;

            // Pass month to service
            await budgetService.updateIncomeSource(currentUser.id, source.id, month, source);
            
            logger.log('✅ Updated income source:', source.id);
            
        } catch (error) {
            logger.error('❌ updateIncomeSource failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to update income source' 
            });
            throw error;
        }
    },

    deleteIncomeSource: async (month: string, sourceId: string): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            logger.log('🗑️ Deleting income source:', { month, sourceId });
            
            // Update local state
            set(state => ({
                incomeSources: {
                    ...state.incomeSources,
                    [month]: state.incomeSources[month]?.filter(s => s.id !== sourceId) || []
                },
                isLoading: false
            }));
            
            // Delete from backend
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) return;

            // Pass month to service
            await budgetService.deleteIncomeSource(currentUser.id, sourceId, month);
            
            logger.log('✅ Deleted income source:', sourceId);
            
        } catch (error) {
            logger.error('❌ deleteIncomeSource failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to delete income source' 
            });
            throw error;
        }
    },

    copyPreviousMonthAllocations: async (currentMonth: string) => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();

            logger.log('📋 Copying allocations from previous month:', currentMonth);
            
            // Calculate previous month
            const [year, month] = currentMonth.split('-').map(Number);
            let prevYear = year;
            let prevMonth = month - 1;
            if (prevMonth < 1) {
                prevYear = year - 1;
                prevMonth = 12;
            }
            const prevMonthString = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

            // Ensure previous month data is loaded
            if (!get().incomeSources[prevMonthString] || !get().allocations[prevMonthString]) {
                logger.log(`⏳ Previous month ${prevMonthString} data missing, fetching...`);
                await get().fetchMonthData(prevMonthString);
            }
            
            // Copy income sources from previous month
            const previousIncomeSources = get().incomeSources[prevMonthString] || [];
            logger.log(`💰 Found ${previousIncomeSources.length} income sources from ${prevMonthString}`);
            
            if (previousIncomeSources.length > 0) {
                // Use addIncomeSource to ensure persistence
                for (const source of previousIncomeSources) {
                    const { id: _id, ...sourceData } = source; // Omit ID to create new
                    await get().addIncomeSource(currentMonth, sourceData);
                }
                logger.log(`✅ Copied ${previousIncomeSources.length} income sources to ${currentMonth}`);
            }
            
            // Copy allocations from previous month
            const previousAllocations = get().allocations[prevMonthString] || [];
            logger.log(`📋 Found ${previousAllocations.length} allocations from ${prevMonthString}`);
            
            // Filter out allocations for piggybanks as they are handled separately
            // AND ensure we don't copy allocations for deleted envelopes
            const regularAllocations = previousAllocations.filter(alloc => {
                const envelope = get().envelopes.find(e => e.id === alloc.envelopeId);
                return !!envelope && !envelope.isPiggybank;
            });

            if (regularAllocations.length > 0) {
                // Use createEnvelopeAllocation to ensure persistence
                for (const alloc of regularAllocations) {
                    await get().createEnvelopeAllocation({
                        envelopeId: alloc.envelopeId,
                        budgetedAmount: alloc.budgetedAmount,
                        userId: currentUser.id,
                        month: currentMonth,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });

                    // Create the corresponding income transaction for the allocation
                    // This mirrors the behavior of setEnvelopeAllocation
                    if (alloc.budgetedAmount > 0) {
                        await get().addTransaction({
                            description: 'Budgeted',
                            amount: alloc.budgetedAmount,
                            envelopeId: alloc.envelopeId,
                            type: 'Income',
                            month: currentMonth,
                            date: `${currentMonth}-01T00:00:00`,
                            reconciled: false,
                            isAutomatic: true
                        });
                    }
                }
                logger.log(`✅ Copied ${regularAllocations.length} regular allocations to ${currentMonth}`);
            }
            
            // Also create/update piggybank allocations for the new month
            const piggybanks = get().envelopes.filter(e => e.isPiggybank);
            logger.log(`🐷 Processing ${piggybanks.length} piggybanks for ${currentMonth}`);
            
            for (const piggybank of piggybanks) {
                const monthlyContribution = piggybank.piggybankConfig?.monthlyContribution;
                const isPaused = piggybank.piggybankConfig?.paused ?? false;
                
                if (!isPaused && monthlyContribution && monthlyContribution > 0) {
                    try {
                        logger.log(`🐷 Setting piggybank allocation for ${piggybank.name}: ${monthlyContribution}`);
                        await get().setEnvelopeAllocation(piggybank.id, monthlyContribution);
                    } catch (error) {
                        logger.error(`❌ Failed to set allocation for piggybank ${piggybank.name}:`, error);
                    }
                } else {
                    logger.log(`🐷 Skipping piggybank ${piggybank.name} (paused=${isPaused}, contribution=${monthlyContribution})`);
                }
            }
            
            set({ isLoading: false });
            logger.log(`🎯 Complete monthly setup copied to ${currentMonth}`);
            
        } catch (error) {
            logger.error('❌ copyPreviousMonthAllocations failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to copy allocations' 
            });
            throw error;
        }
    },

    setEnvelopeAllocation: async (envelopeId: string, budgetedAmount: number): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();
            
            const currentMonth = get().currentMonth;
            
            // Check if this is a piggybank
            const envelope = get().envelopes.find(e => e.id === envelopeId);
            
            if (!envelope) {
                logger.error(`❌ setEnvelopeAllocation: Envelope ${envelopeId} not found in store! Aborting.`);
                set({ isLoading: false });
                return;
            }

            const isPiggybank = !!envelope.isPiggybank;
            
            logger.log(`🔍 setEnvelopeAllocation called: envelopeId=${envelopeId}, amount=${budgetedAmount}, currentMonth=${currentMonth}, isPiggybank=${isPiggybank}`);
            
            // Check if allocation already exists
            const existingAllocation = get().allocations[currentMonth]?.find(
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
                    userId: currentUser.id,
                    month: currentMonth,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            // For piggybanks, also create a monthly transaction if budgetedAmount > 0
            if (isPiggybank && budgetedAmount > 0 && !envelope?.piggybankConfig?.paused) {
                // Check if a monthly transaction already exists for this month
                const existingTransaction = get().transactions.find(t => 
                    t.envelopeId === envelopeId && 
                    t.month === currentMonth &&
                    (t.description === 'Monthly Allocation' || t.description === 'Piggybank Contribution')
                );
                
                if (existingTransaction) {
                    const transactionData = {
                        ...existingTransaction,
                        amount: budgetedAmount,
                        description: 'Piggybank Contribution' // Force update description
                    };
                    await get().updateTransaction(transactionData);
                } else {
                    const transactionData = {
                        description: 'Piggybank Contribution',
                        amount: budgetedAmount,
                        envelopeId: envelopeId,
                        type: 'Income' as const,
                        month: currentMonth,
                        date: `${currentMonth}-01T00:00:00`,
                        reconciled: false,
                        isAutomatic: true
                    };
                    
                    await get().addTransaction(transactionData);
                }
            }
            
            // For regular spending envelopes, create/update Budgeted transaction
            if (!isPiggybank && budgetedAmount > 0) {
                // Check if a Budgeted transaction already exists for this month
                const existingTransaction = get().transactions.find(t => 
                    t.envelopeId === envelopeId && 
                    t.month === currentMonth &&
                    (t.description === 'Monthly Budget Allocation' || t.description === 'Budgeted')
                );
                
                if (existingTransaction) {
                    // Update existing transaction
                    const transactionData = {
                        ...existingTransaction,
                        amount: budgetedAmount,
                        description: 'Budgeted' // Force update description
                    };
                    await get().updateTransaction(transactionData);
                } else {
                    // Create new transaction
                    const transactionData = {
                        description: 'Budgeted',
                        amount: budgetedAmount,
                        envelopeId: envelopeId,
                        type: 'Income' as const,
                        month: currentMonth,
                        date: `${currentMonth}-01T00:00:00`,
                        reconciled: false,
                        isAutomatic: true
                    };
                    
                    await get().addTransaction(transactionData);
                }
            }
            
            logger.log('✅ Envelope allocation set successfully');
            
        } catch (error) {
            logger.error('❌ setEnvelopeAllocation failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to set envelope allocation' 
            });
            throw error;
        }
    },

    createEnvelopeAllocation: async (allocation: Omit<EnvelopeAllocation, 'id'>): Promise<void> => {
        try {
            const currentUser = requireAuth();
            
            const currentMonth = get().currentMonth;
            
            // Create allocation via service
            const newAllocation = await budgetService.createEnvelopeAllocation({
                envelopeId: allocation.envelopeId,
                budgetedAmount: allocation.budgetedAmount,
                userId: currentUser.id,
                month: currentMonth
            });
            
            // Update local state - Check for duplicates first
            set(state => {
                const currentAllocations = state.allocations[currentMonth] || [];
                const exists = currentAllocations.some(a => a.id === newAllocation.id);
                if (exists) return { isLoading: false };
                
                return {
                    allocations: {
                        ...state.allocations,
                        [currentMonth]: [...currentAllocations, newAllocation]
                    },
                    isLoading: false
                };
            });
            
            logger.log('✅ Created envelope allocation:', newAllocation.id);
            
        } catch (error) {
            logger.error('❌ createEnvelopeAllocation failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to create envelope allocation' 
            });
            throw error;
        }
    },

    updateEnvelopeAllocation: async (id: string, updates: Partial<EnvelopeAllocation>): Promise<void> => {
        try {
            logger.log('🔄 Updating envelope allocation:', { id, updates });
            
            const currentMonth = get().currentMonth;
            
            const currentUser = requireAuth();
            
            // Get the allocation to find the envelopeId
            const allocation = get().allocations[currentMonth]?.find(alloc => alloc.id === id);
            if (!allocation) {
                throw new Error('Allocation not found');
            }
            
            // Check if this is a piggybank
            const envelope = get().envelopes.find(e => e.id === allocation.envelopeId);
            const isPiggybank = envelope?.isPiggybank;
            
            // Update allocation via service
            await budgetService.updateEnvelopeAllocation(currentUser.id, allocation.envelopeId, currentMonth, {
              budgetedAmount: updates.budgetedAmount
            });
            
            // Update local state
            set(state => ({
                allocations: {
                    ...state.allocations,
                    [currentMonth]: state.allocations[currentMonth]?.map(alloc => 
                        alloc.id === id ? { ...alloc, ...updates, updatedAt: new Date().toISOString() } : alloc
                    ) || []
                },
                isLoading: false
            }));
            
            // For piggybanks, also update the monthly transaction if budgetedAmount changed
            if (isPiggybank && updates.budgetedAmount !== undefined) {
                // Find the existing monthly transaction
                const existingTransaction = get().transactions.find(t => 
                    t.envelopeId === allocation.envelopeId && 
                    t.month === currentMonth &&
                    (t.description === 'Monthly Allocation' || t.description === 'Piggybank Contribution')
                );
                
                if (existingTransaction) {
                    if (updates.budgetedAmount > 0 && !envelope?.piggybankConfig?.paused) {
                        // Update existing transaction
                        await get().updateTransaction({
                            ...existingTransaction,
                            amount: updates.budgetedAmount,
                            description: 'Piggybank Contribution' // Force update description
                        });
                    } else if (updates.budgetedAmount === 0 || envelope?.piggybankConfig?.paused) {
                        // Delete transaction if amount is 0 or piggybank is paused
                        await get().deleteTransaction(existingTransaction.id);
                    }
                } else if (updates.budgetedAmount > 0 && !envelope?.piggybankConfig?.paused) {
                    // Create new transaction if none exists and amount > 0
                    await get().addTransaction({
                        description: 'Piggybank Contribution',
                        amount: updates.budgetedAmount,
                        envelopeId: allocation.envelopeId,
                        type: 'Income',
                        month: currentMonth,
                        date: `${currentMonth}-01T00:00:00`,
                        reconciled: false,
                        isAutomatic: true
                    });
                }
            }
            
            // For regular spending envelopes, create/update Budgeted transaction
            if (!isPiggybank && updates.budgetedAmount !== undefined) {
                // Find the existing Budgeted transaction
                const existingTransaction = get().transactions.find(t => 
                    t.envelopeId === allocation.envelopeId && 
                    t.month === currentMonth &&
                    (t.description === 'Monthly Budget Allocation' || t.description === 'Budgeted')
                );
                
                if (existingTransaction) {
                    if (updates.budgetedAmount > 0) {
                        // Update existing transaction
                        await get().updateTransaction({
                            ...existingTransaction,
                            amount: updates.budgetedAmount,
                            description: 'Budgeted' // Force update description
                        });
                    } else if (updates.budgetedAmount === 0) {
                        // Delete transaction if amount is 0
                        await get().deleteTransaction(existingTransaction.id);
                    }
                } else if (updates.budgetedAmount > 0) {
                    // Create new transaction if none exists and amount > 0
                    await get().addTransaction({
                        description: 'Budgeted',
                        amount: updates.budgetedAmount,
                        envelopeId: allocation.envelopeId,
                        type: 'Income',
                        month: currentMonth,
                        date: `${currentMonth}-01T00:00:00`,
                        reconciled: false,
                        isAutomatic: true
                    });
                }
            }
            
            logger.log('✅ Updated envelope allocation:', id);
            
        } catch (error) {
            logger.error('❌ updateEnvelopeAllocation failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to update envelope allocation' 
            });
            throw error;
        }
    },

    deleteEnvelopeAllocation: async (id: string): Promise<void> => {
        try {
            logger.log('🗑️ Deleting envelope allocation:', id);
            
            const currentMonth = get().currentMonth;
            const allocation = get().allocations[currentMonth]?.find(alloc => alloc.id === id);
            
            if (!allocation) {
                logger.warn("Allocation not found in store, skipping delete");
                return;
            }
            
            const currentUser = requireAuth();
            
            // Delete allocation via service (using envelopeId as key)
            await budgetService.deleteEnvelopeAllocation(currentUser.id, allocation.envelopeId, currentMonth);
            
            // Update local state
            set(state => ({
                allocations: {
                    ...state.allocations,
                    [currentMonth]: state.allocations[currentMonth]?.filter(alloc => alloc.id !== id) || []
                },
                isLoading: false
            }));
            
            logger.log('✅ Deleted envelope allocation:', id);
            
        } catch (error) {
            logger.error('❌ deleteEnvelopeAllocation failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to delete envelope allocation' 
            });
            throw error;
        }
    },

    refreshAvailableToBudget: async (): Promise<number> => {
        try {
            const currentMonth = get().currentMonth;
            const allocations = get().allocations[currentMonth] || [];
            const incomeSources = get().incomeSources[currentMonth] || [];
            
            const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.budgetedAmount, 0);
            const totalIncome = incomeSources.reduce((sum, source) => sum + source.amount, 0);
            const available = totalIncome - totalAllocated;
            
            return available;
            
        } catch (error) {
            logger.error('❌ refreshAvailableToBudget failed:', error);
            set({ 
                error: error instanceof Error ? error.message : 'Failed to refresh available to budget' 
            });
            throw error;
        }
    },
});
