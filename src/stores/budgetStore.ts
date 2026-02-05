import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { BudgetService } from '../services/budgetService';
import { CategoryService } from '../services/CategoryService';
import { useAuthStore } from './authStore';
import { setupEnvelopeStoreRealtime } from './envelopeStoreRealtime';

// Helper function to get current user ID
const getCurrentUserId = () => {
  const authStore = useAuthStore.getState();
  return authStore.currentUser?.id || '';
};

// Service instance
const budgetService = BudgetService.getInstance();
const categoryService = CategoryService.getInstance();

import type { Envelope, Transaction, IncomeSource, EnvelopeAllocation, AppSettings, Category } from '../models/types';

interface BudgetState {
  // === DATA ===
  envelopes: Envelope[];
  transactions: Transaction[];
  categories: Category[];
  appSettings: AppSettings | null;
  
  // Organized by Month (e.g., "2026-01")
  incomeSources: Record<string, IncomeSource[]>;
  allocations: Record<string, EnvelopeAllocation[]>;
  
  // === CONTEXT ===
  currentMonth: string; // "YYYY-MM"
  isOnline: boolean;
  isOnboardingActive: boolean; // UI State for guide
  isOnboardingCompleted: boolean; // Persistent State
  isLoading: boolean;
  error: string | null;

  // === ACTIONS ===
  setMonth: (month: string) => void;
  init: () => Promise<void>;
  setIsOnboardingActive: (active: boolean) => void; // UI Action
  checkAndStartOnboarding: () => Promise<void>; // Action to check and start onboarding for new users
  completeOnboarding: () => void; // Action to mark onboarding as complete
  resetOnboarding: () => void; // Action to reset onboarding status
  addEnvelope: (envelope: Omit<Envelope, 'id'>) => Promise<string>;
  updateEnvelope: (envelope: Envelope) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  reorderEnvelopes: (orderedIds: string[]) => Promise<void>;
  handleUserLogout: () => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  restoreTransaction: (transaction: Transaction) => Promise<void>;
  transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  fetchData: () => Promise<void>;
  renameEnvelope: (envelopeId: string, newName: string) => Promise<void>;
  getEnvelopeBalance: (envelopeId: string, month?: string) => number;
  resetData: () => Promise<void>;
  clearMonthData: (month: string) => Promise<void>; // Clear specific month data
  importData: (data: any) => Promise<{ success: boolean; message: string }>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initializeAppSettings: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  updatePiggybankContribution: (envelopeId: string, newAmount: number) => Promise<void>;
  fetchMonthData: (month: string) => Promise<void>;
  removeEnvelopeFromMonth: (envelopeId: string, month: string) => Promise<void>;
  
  // Category Actions
  fetchCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'userId'>) => Promise<string>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;

  // Income Source Actions
  addIncomeSource: (month: string, source: Omit<IncomeSource, 'id'>) => Promise<void>;
  updateIncomeSource: (month: string, source: IncomeSource) => Promise<void>;
  deleteIncomeSource: (month: string, sourceId: string) => Promise<void>;
  copyPreviousMonthAllocations: (currentMonth: string) => Promise<void>;
  
  // Allocation Actions
  setEnvelopeAllocation: (envelopeId: string, budgetedAmount: number) => Promise<void>;
  createEnvelopeAllocation: (allocation: Omit<EnvelopeAllocation, 'id'>) => Promise<void>;
  updateEnvelopeAllocation: (id: string, updates: Partial<EnvelopeAllocation>) => Promise<void>;
  deleteEnvelopeAllocation: (id: string) => Promise<void>;
  refreshAvailableToBudget: () => Promise<number>;
}

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
        currentMonth: new Date().toISOString().slice(0, 7),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isOnboardingActive: false,
        isOnboardingCompleted: false, // Will be set per-user in checkAndStartOnboarding
        isLoading: false,
        error: null,

        // Actions
        setIsOnboardingActive: (active: boolean) => {
            set({ isOnboardingActive: active });
        },

        checkAndStartOnboarding: async () => {
          const userId = getCurrentUserId();
          if (!userId) {
            console.log('⏭️ No user ID, skipping onboarding check');
            return;
          }
          
          // Check user-specific onboarding completion status
          const storageKey = `onboardingCompleted_${userId}`;
          const isCompleted = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) === 'true' : false;
          
          console.log('🔍 checkAndStartOnboarding called:', {
            userId,
            isOnboardingCompleted: isCompleted,
            isOnboardingActive: get().isOnboardingActive,
            localStorage_key: storageKey,
            localStorage_value: localStorage.getItem(storageKey)
          });
          
          // If localStorage says completed, trust it
          if (isCompleted) {
            set({ isOnboardingCompleted: true });
            console.log('⏭️ Skipping onboarding: already completed (localStorage)');
            return;
          }
          
          // localStorage doesn't have completion flag (new device or cleared storage)
          // Check Firestore for existing data before treating user as new
          try {
            const existingEnvelopes = await budgetService.getEnvelopes(userId);
            if (existingEnvelopes.length > 0) {
              // User has existing data — they're not new, just on a new device
              console.log('⏭️ Existing user detected on new device — skipping onboarding, setting localStorage');
              localStorage.setItem(storageKey, 'true');
              set({ isOnboardingCompleted: true, isOnboardingActive: false });
              return;
            }
          } catch (error) {
            console.error('⚠️ Failed to check existing envelopes for onboarding:', error);
            // On error, don't show onboarding — safer to skip than to annoy existing users
            set({ isOnboardingCompleted: true, isOnboardingActive: false });
            return;
          }
          
          // Truly new user — no localStorage flag AND no Firestore data
          if (!get().isOnboardingActive) {
            console.log('🎯 Starting onboarding for new user - setting isOnboardingActive to TRUE');
            set({ isOnboardingCompleted: false, isOnboardingActive: true });
            console.log('✅ isOnboardingActive set to:', get().isOnboardingActive);
          }
        },

        completeOnboarding: () => {
          const userId = getCurrentUserId();
          if (userId) {
            const storageKey = `onboardingCompleted_${userId}`;
            localStorage.setItem(storageKey, 'true');
            console.log('✅ Onboarding completed for user:', userId);
          }
          set({ isOnboardingCompleted: true, isOnboardingActive: false });
        },

        resetOnboarding: () => {
            const userId = getCurrentUserId();
            if (userId) {
              const storageKey = `onboardingCompleted_${userId}`;
              localStorage.removeItem(storageKey);
              console.log('🔄 Onboarding reset for user:', userId);
            }
            set({ isOnboardingCompleted: false, isOnboardingActive: true });
        },

        clearMonthData: async (month: string) => {
            try {
                set({ isLoading: true, error: null });
                console.log(`🗑️ Clearing all data for month: ${month}`);

                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }

                // Call service to clear data
                // We need to import monthlyBudgetService dynamically or assume it's available via BudgetService
                // But monthlyBudgetService is a separate service. 
                // Let's import it at the top or use dynamic import if needed.
                // Since we can't easily change imports at the top in this replace call, 
                // let's use the monthlyBudgetService instance if we can, or replicate the logic.
                // Better yet, let's use dynamic import for the service to be safe.
                const { monthlyBudgetService } = await import('../services/MonthlyBudgetService');
                
                await monthlyBudgetService.clearMonthData(currentUser.id, month);
                
                // Refresh data to reflect changes
                await get().init();
                
                console.log(`✅ Cleared month data for ${month}`);
                set({ isLoading: false });

            } catch (error) {
                console.error(`❌ clearMonthData failed:`, error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to clear month data' 
                });
                throw error;
            }
        },

        fetchMonthData: async (month: string) => {
            try {
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                
                if (!currentUser) {
                    console.log("No user logged in, skipping month data fetch");
                    return;
                }

                console.log(`Fetching month data for: ${month}`);
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
                console.log(`✅ Fetched month data for ${month}`);

                // --- Self-Healing: Verify Allocations vs Transactions ---
                const verifyAndRepairAllocations = async () => {
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
                                console.log(`🔧 Repairing missing transaction for envelope ${envelope?.name || alloc.envelopeId}`);
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
                            console.log(`🔧 Repairing mismatch for envelope ${envelope?.name || alloc.envelopeId}: Alloc ${alloc.budgetedAmount} vs Tx ${matchingTx.amount}`);
                            await currentState.updateTransaction({
                                ...matchingTx,
                                amount: alloc.budgetedAmount
                            });
                            repairs++;
                        }
                    }
                    if (repairs > 0) console.log(`✅ Repaired ${repairs} allocation discrepancies for ${month}`);
                };

                // Run verification (non-blocking)
                verifyAndRepairAllocations().catch(err => console.error('Verification failed:', err));

            } catch (error) {
                console.error(`❌ Failed to fetch month data for ${month}:`, error);
            }
        },

        removeEnvelopeFromMonth: async (envelopeId: string, month: string) => {
            try {
                set({ isLoading: true, error: null });
                console.log(`🗑️ Removing envelope ${envelopeId} from month ${month}`);

                const state = get();
                
                // 1. Delete Allocation for this month
                const allocation = state.allocations[month]?.find(a => a.envelopeId === envelopeId);
                if (allocation) {
                    await get().deleteEnvelopeAllocation(allocation.id);
                } else {
                    console.log(`⚠️ No allocation found for envelope ${envelopeId} in ${month}`);
                }

                // 2. Delete Transactions for this month
                const transactionsToDelete = state.transactions.filter(t => 
                    t.envelopeId === envelopeId && 
                    (t.month === month || t.date.startsWith(month))
                );

                if (transactionsToDelete.length > 0) {
                    console.log(`🗑️ Deleting ${transactionsToDelete.length} transactions for envelope ${envelopeId} in ${month}`);
                    
                    // Execute deletions in parallel
                    await Promise.all(transactionsToDelete.map(tx => get().deleteTransaction(tx.id)));
                }

                // 3. DO NOT delete the global envelope definition
                // The envelope remains in 'state.envelopes' but will be hidden from the month view
                // because it no longer has an allocation or transactions in this month.

                set({ isLoading: false });
                console.log(`✅ Removed envelope ${envelopeId} from month ${month}`);

            } catch (error) {
                console.error(`❌ removeEnvelopeFromMonth failed:`, error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to remove envelope from month' 
                });
                throw error;
            }
        },

        setMonth: async (month: string) => {
            set({ currentMonth: month });
            
            const state = get();
            // Check if we need to fetch data for this month
            if (state.incomeSources[month] === undefined || state.allocations[month] === undefined) {
                 console.log(`Month ${month} data missing in store, fetching...`);
                 set({ isLoading: true });
                 await get().fetchMonthData(month);
                 set({ isLoading: false });
            }
        },
        init: async () => {
            console.log("BudgetStore initializing...");
            const state = get();
            
            try {
                // Set loading state
                set({ isLoading: true, error: null });
                
                // Get current user from auth store
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                
                if (!currentUser) {
                    console.log("No user logged in, skipping data fetch");
                    set({ isLoading: false });
                    return;
                }
                
                console.log(`Fetching data for user: ${currentUser.id}, month: ${state.currentMonth}`);
                
                // Fetch data in parallel with individual error handling for categories
                const [envelopes, transactions, categoriesResult, monthData] = await Promise.all([
                    budgetService.getEnvelopes(currentUser.id),
                    budgetService.getTransactions(currentUser.id),
                    categoryService.getCategories(currentUser.id).catch(err => {
                        console.error('⚠️ Failed to load categories:', err);
                        return []; // Fallback to empty array
                    }),
                    budgetService.getMonthData(currentUser.id, state.currentMonth)
                ]);
                
                // Update state with fetched data
                set({
                    envelopes,
                    transactions,
                    categories: categoriesResult,
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
                
                console.log(`✅ BudgetStore initialized: ${envelopes.length} envelopes, ${transactions.length} transactions, ${categoriesResult.length} categories, ${monthData.incomeSources.length} income sources, ${monthData.allocations.length} allocations`);
                
            } catch (error) {
                console.error('❌ BudgetStore initialization failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to initialize budget data' 
                });
            }
        },
        // === CATEGORY ACTIONS ===
        fetchCategories: async () => {
            try {
                set({ isLoading: true, error: null });
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) return;

                const categories = await categoryService.getCategories(currentUser.id);
                set({ categories, isLoading: false });
            } catch (error) {
                console.error('Failed to fetch categories:', error);
                set({ isLoading: false });
            }
        },

        addCategory: async (category) => {
            try {
                set({ isLoading: true, error: null });
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) throw new Error('No user logged in');

                const newId = categoryService.createId();
                const newCategory: Category = {
                    ...category,
                    id: newId,
                    userId: currentUser.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    orderIndex: get().categories.length // Append to end
                };

                await categoryService.createCategory(newCategory);
                
                // Update local state - Check for duplicates first (real-time listener might have beaten us)
                set(state => {
                    const exists = state.categories.some(c => c.id === newId);
                    if (exists) return { isLoading: false };
                    return {
                        categories: [...state.categories, newCategory],
                        isLoading: false
                    };
                });

                return newId;
            } catch (error) {
                console.error('Failed to add category:', error);
                set({ isLoading: false });
                throw error;
            }
        },

        updateCategory: async (category) => {
            try {
                set({ isLoading: true, error: null });
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) throw new Error('No user logged in');

                const updatedCategory = { ...category, updatedAt: new Date().toISOString() };
                await categoryService.updateCategory(currentUser.id, updatedCategory);

                set(state => ({
                    categories: state.categories.map(c => c.id === category.id ? updatedCategory : c),
                    isLoading: false
                }));
            } catch (error) {
                console.error('Failed to update category:', error);
                set({ isLoading: false });
                throw error;
            }
        },

        deleteCategory: async (categoryId) => {
            try {
                set({ isLoading: true, error: null });
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) throw new Error('No user logged in');

                await categoryService.deleteCategory(currentUser.id, categoryId);

                set(state => ({
                    categories: state.categories.filter(c => c.id !== categoryId),
                    isLoading: false
                }));
            } catch (error) {
                console.error('Failed to delete category:', error);
                set({ isLoading: false });
                throw error;
            }
        },

        reorderCategories: async (orderedIds) => {
            try {
                set({ isLoading: true, error: null });
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) throw new Error('No user logged in');

                const state = get();
                const orderMap = new Map<string, number>();
                orderedIds.forEach((id, index) => orderMap.set(id, index));

                const updatedCategories = state.categories.map(cat => {
                    if (!orderMap.has(cat.id)) return cat;
                    const nextOrder = orderMap.get(cat.id)!;
                    if (cat.orderIndex === nextOrder) return cat;
                    return { ...cat, orderIndex: nextOrder };
                });
                
                // Optimistic update
                set({ categories: updatedCategories.sort((a, b) => a.orderIndex - b.orderIndex) });

                await categoryService.reorderCategories(currentUser.id, updatedCategories);
                set({ isLoading: false });
            } catch (error) {
                console.error('Failed to reorder categories:', error);
                set({ isLoading: false });
                throw error;
            }
        },

        addEnvelope: async (envelope: Omit<Envelope, 'id'>): Promise<string> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Create envelope with userId
                const envelopeWithUser = { ...envelope, userId: currentUser.id };
                const createdEnvelope = await budgetService.createEnvelope(envelopeWithUser);
                
                // Update local state - Check for duplicates first
                set(state => {
                    const exists = state.envelopes.some(e => e.id === createdEnvelope.id);
                    if (exists) return { isLoading: false };
                    return {
                        envelopes: [...state.envelopes, createdEnvelope],
                        isLoading: false
                    };
                });
                
                console.log('✅ Added envelope:', createdEnvelope.id);
                return createdEnvelope.id;
                
            } catch (error) {
                console.error('❌ addEnvelope failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to add envelope' 
                });
                throw error;
            }
        },
        updateEnvelope: async (envelope: Envelope): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Update in backend
                await budgetService.updateEnvelope(currentUser.id, envelope);
                
                // Update local state
                set(state => ({
                    envelopes: state.envelopes.map(env => 
                        env.id === envelope.id ? envelope : env
                    ),
                    isLoading: false
                }));
                
                console.log('✅ Updated envelope:', envelope.id);
                
            } catch (error) {
                console.error('❌ updateEnvelope failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to update envelope' 
                });
                throw error;
            }
        },
        deleteEnvelope: async (envelopeId: string): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Delete from backend
                await budgetService.deleteEnvelope(currentUser.id, envelopeId);
                
                // Update local state (also remove associated transactions)
                set(state => ({
                    envelopes: state.envelopes.filter(env => env.id !== envelopeId),
                    transactions: state.transactions.filter(tx => tx.envelopeId !== envelopeId),
                    isLoading: false
                }));
                
                console.log('✅ Deleted envelope:', envelopeId);
                
            } catch (error) {
                console.error('❌ deleteEnvelope failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to delete envelope' 
                });
                throw error;
            }
        },
        reorderEnvelopes: async (orderedIds: string[]): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                const state = get();
                const orderMap = new Map<string, number>();
                orderedIds.forEach((id, index) => {
                    orderMap.set(id, index);
                });

                const updatedEnvelopes = state.envelopes.map((env) => {
                    if (!orderMap.has(env.id)) return env;
                    const nextOrder = orderMap.get(env.id)!;
                    if (env.orderIndex === nextOrder) return env;
                    return {
                        ...env,
                        orderIndex: nextOrder,
                    };
                });

                const changedEnvelopes = updatedEnvelopes.filter((env, index) => env !== state.envelopes[index]);

                if (!changedEnvelopes.length) {
                    set({ isLoading: false });
                    return;
                }

                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Update in backend
                await budgetService.reorderEnvelopes(currentUser.id, changedEnvelopes);
                
                // Update local state
                set({
                    envelopes: updatedEnvelopes,
                    isLoading: false
                });
                
                console.log('✅ Reordered envelopes');
                
            } catch (error) {
                console.error('❌ reorderEnvelopes failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to reorder envelopes' 
                });
                throw error;
            }
        },
        addTransaction: async (transaction: Omit<Transaction, 'id' | 'userId'>): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Ensure month is set
                const txDate = new Date(transaction.date);
                const month = transaction.month || `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

                // Create transaction with userId and month
                const transactionWithUser = { 
                    ...transaction, 
                    userId: currentUser.id,
                    month 
                };
                const createdTransaction = await budgetService.createTransaction(transactionWithUser);
                
                // Update local state - Check for duplicates first
                set(state => {
                    const exists = state.transactions.some(t => t.id === createdTransaction.id);
                    if (exists) return { isLoading: false };
                    return {
                        transactions: [...state.transactions, createdTransaction],
                        isLoading: false
                    };
                });
                
                console.log('✅ Added transaction:', createdTransaction.id);
                
            } catch (error) {
                console.error('❌ addTransaction failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to add transaction' 
                });
                throw error;
            }
        },
        updateTransaction: async (transaction: Transaction): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Ensure month is set
                const txDate = new Date(transaction.date);
                const month = transaction.month || `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
                
                const updatedTransaction = { ...transaction, month };

                // Update in backend
                await budgetService.updateTransaction(currentUser.id, updatedTransaction);
                
                // Update local state
                set(state => ({
                    transactions: state.transactions.map(tx => 
                        tx.id === transaction.id ? updatedTransaction : tx
                    ),
                    isLoading: false
                }));
                
                console.log('✅ Updated transaction:', transaction.id);
                
            } catch (error) {
                console.error('❌ updateTransaction failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to update transaction' 
                });
                throw error;
            }
        },
        deleteTransaction: async (transactionId: string): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Delete from backend
                await budgetService.deleteTransaction(currentUser.id, transactionId);
                
                // Update local state
                set(state => ({
                    transactions: state.transactions.filter(tx => tx.id !== transactionId),
                    isLoading: false
                }));
                
                console.log('✅ Deleted transaction:', transactionId);
                
            } catch (error) {
                console.error('❌ deleteTransaction failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to delete transaction' 
                });
                throw error;
            }
        },
        restoreTransaction: async (transaction: Transaction): Promise<void> => {
            // For now, restore is the same as update (re-adds the transaction)
            await get().updateTransaction(transaction);
        },
        transferFunds: async (fromEnvelopeId: string, toEnvelopeId: string, amount: number, _note: string, date?: Date | string): Promise<void> => {
            try {
                const transactionDate = date
                    ? typeof date === 'string' ? date : date.toISOString()
                    : new Date().toISOString();

                const transferId = `transfer-${Date.now()}-${Math.random()}`;

                // Create expense transaction from source envelope
                await get().addTransaction({
                    description: `Transfer to ${get().envelopes.find(e => e.id === toEnvelopeId)?.name || 'envelope'}`,
                    amount: amount,
                    envelopeId: fromEnvelopeId,
                    date: transactionDate,
                    type: 'Expense',
                    transferId,
                    reconciled: false
                } as any);

                // Create income transaction to destination envelope
                await get().addTransaction({
                    description: `Transfer from ${get().envelopes.find(e => e.id === fromEnvelopeId)?.name || 'envelope'}`,
                    amount: amount,
                    envelopeId: toEnvelopeId,
                    date: transactionDate,
                    type: 'Income',
                    transferId,
                    reconciled: false
                } as any);

                console.log('✅ Transfer completed');
                
            } catch (error) {
                console.error('❌ transferFunds failed:', error);
                throw error;
            }
        },
        fetchData: async () => {
            // Simply call init() to fetch all data
            await get().init();
        },
        renameEnvelope: async (envelopeId: string, newName: string): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                const state = get();
                const envelope = state.envelopes.find(env => env.id === envelopeId);
                if (!envelope) {
                    throw new Error('Envelope not found');
                }
                
                // Update local state immediately
                set(state => ({
                    envelopes: state.envelopes.map(env =>
                        env.id === envelopeId ? { ...env, name: newName } : env
                    ),
                    isLoading: true
                }));

                // Get current user and update in backend
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                const updatedEnvelope = { ...envelope, name: newName };
                await budgetService.updateEnvelope(currentUser.id, updatedEnvelope);
                
                set({ isLoading: false });
                console.log('✅ Renamed envelope:', envelopeId);
                
            } catch (error) {
                console.error('❌ renameEnvelope failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to rename envelope' 
                });
                throw error;
            }
        },
        getEnvelopeBalance: (envelopeId: string, month?: string): number => {
            const state = get();
            const envelope = state.envelopes.find(e => e.id === envelopeId);
            if (!envelope) {
                console.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
                return 0;
            }

            // For Piggybanks, always calculate lifetime cumulative balance
            if (envelope.isPiggybank) {
                const envelopeTransactions = state.transactions.filter(t => t.envelopeId === envelopeId);

                const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
                const incomes = envelopeTransactions.filter(t => t.type === 'Income');

                const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);

                return totalIncome - totalSpent;
            }

            // For regular spending envelopes, calculate monthly balance if month is provided
            if (month) {
                const envelopeTransactions = state.transactions.filter(t => 
                    t.envelopeId === envelopeId && t.month === month
                );

                const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
                const incomes = envelopeTransactions.filter(t => t.type === 'Income');

                const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);

                return totalIncome - totalSpent;
            }

            // Fallback for regular envelopes if month is not provided (shouldn't happen if called correctly)
            console.warn(`⚠️ getEnvelopeBalance: Month not provided for non-piggybank envelope ${envelopeId}. Returning 0.`);
            return 0;
        },
        resetData: async () => {
            console.log('🔄 Resetting all data');
            set({ isLoading: true });
            
            try {
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                
                if (currentUser) {
                    console.log('🔥 Deleting all data from Firestore for user:', currentUser.id);
                    await budgetService.deleteAllUserData(currentUser.id);
                } else {
                    console.warn('⚠️ No user logged in, only clearing local state');
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
                console.log('✅ Reset data complete');
            } catch (error) {
                console.error('❌ resetData failed:', error);
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

                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                
                if (!currentUser) {
                    throw new Error('You must be logged in to restore data.');
                }

                console.log('🔄 Starting Time Machine Restore for user:', currentUser.id);
                
                // Perform the cloud restore
                await budgetService.restoreUserData(currentUser.id, data);
                
                // Re-initialize the app with the new cloud data
                console.log('🔄 Reloading app state from cloud...');
                await get().init();
                
                set({ isLoading: false });
                return { success: true, message: 'Data restored successfully from backup.' };
                
            } catch (error) {
                console.error('❌ importData failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to import data' 
                });
                return { success: false, message: error instanceof Error ? error.message : 'Import failed' };
            }
        },
        updateAppSettings: async (settings: Partial<AppSettings>): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                const state = get();
                const updatedSettings: AppSettings = { 
                    id: state.appSettings?.id || 'default',
                    theme: settings.theme ?? state.appSettings?.theme ?? 'system',
                    fontSize: settings.fontSize ?? state.appSettings?.fontSize ?? 'medium',
                    enableMoveableReorder: settings.enableMoveableReorder ?? state.appSettings?.enableMoveableReorder ?? true,
                    paymentSources: settings.paymentSources ?? state.appSettings?.paymentSources ?? []
                };
                
                // Only include userId if it has a value
                if (settings.userId || state.appSettings?.userId) {
                    updatedSettings.userId = settings.userId ?? state.appSettings?.userId;
                }

                // Sanitize paymentSources to remove undefined values (Firestore doesn't like them)
                if (updatedSettings.paymentSources) {
                    updatedSettings.paymentSources = updatedSettings.paymentSources.map(source => {
                        const cleanSource = { ...source };
                        if (cleanSource.last4 === undefined) {
                            delete cleanSource.last4;
                        }
                        return cleanSource;
                    });
                }
                
                // Get current user and update in backend
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (currentUser) {
                    const { AppSettingsService } = await import('../services/AppSettingsService');
                    await AppSettingsService.updateAppSettings(currentUser.id, updatedSettings.id, updatedSettings);
                }
                
                set({
                    appSettings: updatedSettings,
                    isLoading: false
                });
                
                console.log('✅ Updated app settings');
                
            } catch (error) {
                console.error('❌ updateAppSettings failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to update settings' 
                });
                throw error;
            }
        },
        initializeAppSettings: async (): Promise<void> => {
            try {
                const state = get();
                if (state.appSettings) {
                    return; // Already initialized
                }
                
                // Get current user and load from backend
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                
                if (currentUser) {
                    const { AppSettingsService } = await import('../services/AppSettingsService');
                    const appSettings = await AppSettingsService.getAppSettings(currentUser.id);
                    
                    if (appSettings) {
                        set({ appSettings });
                        console.log('✅ Loaded app settings from Firestore');
                        return;
                    }
                }
                
                // Create default settings if none exist
                const defaultSettings: AppSettings = {
                    id: 'default',
                    theme: 'system',
                    fontSize: 'medium',
                    enableMoveableReorder: true,
                    paymentSources: []
                };
                
                // Only include userId if we have a current user
                if (currentUser) {
                    defaultSettings.userId = currentUser.id;
                }
                
                set({
                    appSettings: defaultSettings
                });
                
                console.log('✅ Initialized default app settings');
                
            } catch (error) {
                console.error('❌ initializeAppSettings failed:', error);
                set({ 
                    error: error instanceof Error ? error.message : 'Failed to initialize settings' 
                });
            }
        },
        updatePiggybankContribution: async (envelopeId: string, newAmount: number): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                console.log('🔧 Updating piggybank contribution:', { envelopeId, newAmount });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Find the piggybank envelope
                const piggybank = get().envelopes.find(env => env.id === envelopeId && env.isPiggybank);
                if (!piggybank) {
                    throw new Error('Piggybank not found');
                }
                
                // Update the envelope with the new contribution amount
                const updatedEnvelope: Envelope = {
                    ...piggybank,
                    lastUpdated: new Date().toISOString(),
                    piggybankConfig: {
                        monthlyContribution: newAmount,
                        targetAmount: piggybank.piggybankConfig?.targetAmount,
                        color: piggybank.piggybankConfig?.color,
                        icon: piggybank.piggybankConfig?.icon,
                        paused: piggybank.piggybankConfig?.paused ?? false, // Ensure boolean, not undefined
                    },
                };
                
                console.log('📤 Updating envelope in Firestore:', updatedEnvelope);
                await budgetService.updateEnvelope(currentUser.id, updatedEnvelope);
                console.log('✅ Envelope updated successfully');
                
                // Update local state
                set(state => ({
                    envelopes: state.envelopes.map(env => 
                        env.id === envelopeId ? updatedEnvelope : env
                    ),
                    isLoading: false
                }));
                
                // Update the piggybank contribution (this creates the allocation transaction)
                if (!piggybank.piggybankConfig?.paused) {
                    try {
                        await get().setEnvelopeAllocation(envelopeId, newAmount);
                        
                        // Check if transaction was created
                        setTimeout(() => {
                            const allocationTx = get().transactions.find(tx => 
                                tx.envelopeId === envelopeId && 
                                (tx.description === 'Monthly Allocation' || tx.description === 'Piggybank Contribution')
                            );
                            if (!allocationTx) {
                                console.warn('⚠️ Piggybank contribution transaction not found after update');
                            }
                        }, 1000);
                    } catch (error) {
                        console.error('❌ Failed to update piggybank contribution:', error);
                    }
                }
                
                console.log('✅ Piggybank contribution updated successfully');
                
            } catch (error) {
                console.error('❌ updatePiggybankContribution failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to update piggybank contribution' 
                });
                throw error;
            }
        },
        addIncomeSource: async (month: string, source: Omit<IncomeSource, 'id'>): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                console.log('🔧 Adding income source:', { month, source });
                
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
                
                console.log('✅ Added income source:', newIncomeSource.id);
                
            } catch (error) {
                console.error('❌ addIncomeSource failed:', error);
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
                
                console.log('🔧 Updating income source:', { month, sourceId: source.id });
                
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
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) return;

                // Pass month to service
                await budgetService.updateIncomeSource(currentUser.id, source.id, month, source);
                
                console.log('✅ Updated income source:', source.id);
                
            } catch (error) {
                console.error('❌ updateIncomeSource failed:', error);
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
                
                console.log('🗑️ Deleting income source:', { month, sourceId });
                
                // Update local state
                set(state => ({
                    incomeSources: {
                        ...state.incomeSources,
                        [month]: state.incomeSources[month]?.filter(s => s.id !== sourceId) || []
                    },
                    isLoading: false
                }));
                
                // Delete from backend
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) return;

                // Pass month to service
                await budgetService.deleteIncomeSource(currentUser.id, sourceId, month);
                
                console.log('✅ Deleted income source:', sourceId);
                
            } catch (error) {
                console.error('❌ deleteIncomeSource failed:', error);
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
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }

                console.log('📋 Copying allocations from previous month:', currentMonth);
                
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
                    console.log(`⏳ Previous month ${prevMonthString} data missing, fetching...`);
                    await get().fetchMonthData(prevMonthString);
                }
                
                // Copy income sources from previous month
                const previousIncomeSources = get().incomeSources[prevMonthString] || [];
                console.log(`💰 Found ${previousIncomeSources.length} income sources from ${prevMonthString}`);
                
                if (previousIncomeSources.length > 0) {
                    // Use addIncomeSource to ensure persistence
                    for (const source of previousIncomeSources) {
                        const { id, ...sourceData } = source; // Omit ID to create new
                        await get().addIncomeSource(currentMonth, sourceData);
                    }
                    console.log(`✅ Copied ${previousIncomeSources.length} income sources to ${currentMonth}`);
                }
                
                // Copy allocations from previous month
                const previousAllocations = get().allocations[prevMonthString] || [];
                console.log(`📋 Found ${previousAllocations.length} allocations from ${prevMonthString}`);
                
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
                    console.log(`✅ Copied ${regularAllocations.length} regular allocations to ${currentMonth}`);
                }
                
                // Also create/update piggybank allocations for the new month
                const piggybanks = get().envelopes.filter(e => e.isPiggybank);
                console.log(`🐷 Processing ${piggybanks.length} piggybanks for ${currentMonth}`);
                
                for (const piggybank of piggybanks) {
                    const monthlyContribution = piggybank.piggybankConfig?.monthlyContribution;
                    const isPaused = piggybank.piggybankConfig?.paused ?? false;
                    
                    if (!isPaused && monthlyContribution && monthlyContribution > 0) {
                        try {
                            console.log(`🐷 Setting piggybank allocation for ${piggybank.name}: ${monthlyContribution}`);
                            await get().setEnvelopeAllocation(piggybank.id, monthlyContribution);
                        } catch (error) {
                            console.error(`❌ Failed to set allocation for piggybank ${piggybank.name}:`, error);
                        }
                    } else {
                        console.log(`🐷 Skipping piggybank ${piggybank.name} (paused=${isPaused}, contribution=${monthlyContribution})`);
                    }
                }
                
                set({ isLoading: false });
                console.log(`🎯 Complete monthly setup copied to ${currentMonth}`);
                
            } catch (error) {
                console.error('❌ copyPreviousMonthAllocations failed:', error);
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
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                const currentMonth = get().currentMonth;
                
                // Check if this is a piggybank
                const envelope = get().envelopes.find(e => e.id === envelopeId);
                
                if (!envelope) {
                    console.error(`❌ setEnvelopeAllocation: Envelope ${envelopeId} not found in store! Aborting.`);
                    set({ isLoading: false });
                    return;
                }

                const isPiggybank = !!envelope.isPiggybank;
                
                console.log(`🔍 setEnvelopeAllocation called: envelopeId=${envelopeId}, amount=${budgetedAmount}, currentMonth=${currentMonth}, isPiggybank=${isPiggybank}`);
                
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
                
                console.log('✅ Envelope allocation set successfully');
                
            } catch (error) {
                console.error('❌ setEnvelopeAllocation failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to set envelope allocation' 
                });
                throw error;
            }
        },
        createEnvelopeAllocation: async (allocation: Omit<EnvelopeAllocation, 'id'>): Promise<void> => {
            try {
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
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
                
                console.log('✅ Created envelope allocation:', newAllocation.id);
                
            } catch (error) {
                console.error('❌ createEnvelopeAllocation failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to create envelope allocation' 
                });
                throw error;
            }
        },
        updateEnvelopeAllocation: async (id: string, updates: Partial<EnvelopeAllocation>): Promise<void> => {
            try {
                console.log('🔄 Updating envelope allocation:', { id, updates });
                
                const currentMonth = get().currentMonth;
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
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
                
                console.log('✅ Updated envelope allocation:', id);
                
            } catch (error) {
                console.error('❌ updateEnvelopeAllocation failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to update envelope allocation' 
                });
                throw error;
            }
        },
        deleteEnvelopeAllocation: async (id: string): Promise<void> => {
            try {
                console.log('🗑️ Deleting envelope allocation:', id);
                
                const currentMonth = get().currentMonth;
                const allocation = get().allocations[currentMonth]?.find(alloc => alloc.id === id);
                
                if (!allocation) {
                    console.warn("Allocation not found in store, skipping delete");
                    return;
                }
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
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
                
                console.log('✅ Deleted envelope allocation:', id);
                
            } catch (error) {
                console.error('❌ deleteEnvelopeAllocation failed:', error);
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
                console.error('❌ refreshAvailableToBudget failed:', error);
                set({ 
                    error: error instanceof Error ? error.message : 'Failed to refresh available to budget' 
                });
                throw error;
            }
        },
        updateOnlineStatus: async () => {
            try {
                const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
                set({ isOnline });
                console.log('📡 Online status updated:', isOnline);
            } catch (error) {
                console.error('❌ Failed to update online status:', error);
            }
        },
        handleUserLogout: () => {
            console.log('🧹 Clearing user data on logout');
            // Reset onboarding state (user-specific keys remain in localStorage)
            set({
                envelopes: [],
                transactions: [],
                incomeSources: {},
                allocations: {},
                isOnboardingActive: false,
                isOnboardingCompleted: false,
                isLoading: false,
                error: null
            });
        }
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
setupEnvelopeStoreRealtime({
  useBudgetStore: useBudgetStore as any,
  useAuthStore: useAuthStore as any,
  getCurrentUserId: getCurrentUserId,
});
