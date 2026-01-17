import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { BudgetService } from '../services/budgetService';
import { useAuthStore } from './authStore';
import { setupEnvelopeStoreRealtime } from './envelopeStoreRealtime';

// Helper function to get current user ID
const getCurrentUserId = () => {
  const authStore = useAuthStore.getState();
  return authStore.currentUser?.id || '';
};

// Service instance
const budgetService = BudgetService.getInstance();

import type { Envelope, Transaction, IncomeSource, EnvelopeAllocation, AppSettings } from '../models/types';

interface BudgetState {
  // === DATA ===
  envelopes: Envelope[];
  transactions: Transaction[];
  appSettings: AppSettings | null;
  
  // Organized by Month (e.g., "2026-01")
  incomeSources: Record<string, IncomeSource[]>;
  allocations: Record<string, EnvelopeAllocation[]>;
  
  // === CONTEXT ===
  currentMonth: string; // "YYYY-MM"
  isOnline: boolean;
  pendingSync: boolean;
  resetPending: boolean;
  isImporting: boolean;
  testingConnectivity: boolean;
  isLoading: boolean;
  error: string | null;

  // === ACTIONS ===
  setMonth: (month: string) => void;
  init: () => Promise<void>;
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
  getEnvelopeBalance: (envelopeId: string) => number;
  resetData: () => Promise<void>;
  importData: (data: any) => Promise<{ success: boolean; message: string }>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initializeAppSettings: () => Promise<void>;
  syncData: () => Promise<void>;
  testConnectivity: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  updatePiggybankContribution: (envelopeId: string, newAmount: number) => Promise<void>;
  
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
        appSettings: null,
        incomeSources: {},
        allocations: {},
        currentMonth: new Date().toISOString().slice(0, 7),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isLoading: false,
        error: null,
        pendingSync: false,
        resetPending: false,
        isImporting: false,
        testingConnectivity: false,

        // Actions
        setMonth: (month) => set({ currentMonth: month }),
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
                
                // Fetch data in parallel
                const [envelopes, transactions, monthData] = await Promise.all([
                    budgetService.getEnvelopes(currentUser.id),
                    budgetService.getTransactions(currentUser.id),
                    budgetService.getMonthData(currentUser.id, state.currentMonth)
                ]);
                
                // Update state with fetched data
                set({
                    envelopes,
                    transactions,
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
                
                console.log(`✅ BudgetStore initialized: ${envelopes.length} envelopes, ${transactions.length} transactions, ${monthData.incomeSources.length} income sources, ${monthData.allocations.length} allocations`);
                
            } catch (error) {
                console.error('❌ BudgetStore initialization failed:', error);
                set({ 
                    isLoading: false, 
                    error: error instanceof Error ? error.message : 'Failed to initialize budget data' 
                });
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
                
                // Update local state
                set(state => ({
                    envelopes: [...state.envelopes, createdEnvelope],
                    isLoading: false
                }));
                
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
                
                // Create transaction with userId
                const transactionWithUser = { ...transaction, userId: currentUser.id };
                const createdTransaction = await budgetService.createTransaction(transactionWithUser);
                
                // Update local state
                set(state => ({
                    transactions: [...state.transactions, createdTransaction],
                    isLoading: false
                }));
                
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
                
                // Update in backend
                await budgetService.updateTransaction(currentUser.id, transaction);
                
                // Update local state
                set(state => ({
                    transactions: state.transactions.map(tx => 
                        tx.id === transaction.id ? transaction : tx
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
        getEnvelopeBalance: (envelopeId: string): number => {
            const state = get();
            const envelope = state.envelopes.find(e => e.id === envelopeId);
            if (!envelope) {
                console.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
                return 0;
            }

            // Calculate balance from transactions
            const envelopeTransactions = state.transactions.filter(t => t.envelopeId === envelopeId);

            const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
            const incomes = envelopeTransactions.filter(t => t.type === 'Income');

            const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
            const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);

            const balance = totalIncome - totalSpent;
            return balance;
        },
        resetData: async () => {
            console.log('🔄 Resetting all data');
            set({
                envelopes: [],
                transactions: [],
                appSettings: null,
                incomeSources: {},
                allocations: {},
                isLoading: false,
                error: null
            });
        },
        importData: async (data: any): Promise<{ success: boolean; message: string }> => {
            try {
                set({ isLoading: true, error: null });
                
                // Basic validation
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid data format');
                }
                
                // Import envelopes
                if (data.envelopes && Array.isArray(data.envelopes)) {
                    set(state => ({
                        envelopes: data.envelopes,
                        transactions: state.transactions
                    }));
                }
                
                // Import transactions
                if (data.transactions && Array.isArray(data.transactions)) {
                    set(state => ({
                        envelopes: state.envelopes,
                        transactions: data.transactions
                    }));
                }
                
                set({ isLoading: false });
                return { success: true, message: 'Data imported successfully' };
                
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
                    enableMoveableReorder: settings.enableMoveableReorder ?? state.appSettings?.enableMoveableReorder ?? true,
                    userId: settings.userId ?? state.appSettings?.userId
                };
                
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
                
                const defaultSettings: AppSettings = {
                    id: 'default',
                    theme: 'system',
                    enableMoveableReorder: true
                };
                
                set({
                    appSettings: defaultSettings
                });
                
                console.log('✅ Initialized app settings');
                
            } catch (error) {
                console.error('❌ initializeAppSettings failed:', error);
                set({ 
                    error: error instanceof Error ? error.message : 'Failed to initialize settings' 
                });
                throw error;
            }
        },
        syncData: async () => {
            // Simply call init() to sync all data
            await get().init();
        },
        testConnectivity: async () => {
            console.log('🌐 Testing connectivity');
            try {
                set({ testingConnectivity: true });
                
                // Simple connectivity test - try to fetch data
                await get().init();
                
                set({ 
                    testingConnectivity: false,
                    isOnline: true
                });
                console.log('✅ Connectivity test passed');
                
            } catch (error) {
                console.error('❌ Connectivity test failed:', error);
                set({ 
                    testingConnectivity: false,
                    isOnline: false,
                    error: error instanceof Error ? error.message : 'Connectivity test failed'
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
                
                // Update the monthly budget allocation (this creates the allocation transaction)
                if (!piggybank.piggybankConfig?.paused) {
                    try {
                        await get().setEnvelopeAllocation(envelopeId, newAmount);
                        
                        // Check if transaction was created
                        setTimeout(() => {
                            const allocationTx = get().transactions.find(tx => 
                                tx.envelopeId === envelopeId && 
                                tx.description === 'Monthly Budget Allocation'
                            );
                            if (!allocationTx) {
                                console.warn('⚠️ Monthly allocation transaction not found after update');
                            }
                        }, 1000);
                    } catch (error) {
                        console.error('❌ Failed to update monthly budget allocation:', error);
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
                
                // Create income source with ID and userId
                const incomeSource: IncomeSource = {
                    ...source,
                    id: `income-${Date.now()}-${Math.random()}`,
                    userId: currentUser.id,
                    month,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Add to local state
                set(state => ({
                    incomeSources: {
                        ...state.incomeSources,
                        [month]: [...(state.incomeSources[month] || []), incomeSource]
                    },
                    isLoading: false
                }));
                
                console.log('✅ Added income source:', incomeSource.id);
                
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
        copyPreviousMonthAllocations: async (currentMonth: string): Promise<void> => {
            try {
                set({ isLoading: true, error: null });
                
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
                
                // Copy income sources from previous month
                const previousIncomeSources = get().incomeSources[prevMonthString] || [];
                console.log(`💰 Found ${previousIncomeSources.length} income sources from ${prevMonthString}`);
                
                if (previousIncomeSources.length > 0) {
                    const copiedIncomeSources = previousIncomeSources.map(source => ({
                        ...source,
                        id: `income-${Date.now()}-${Math.random()}`,
                        month: currentMonth,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }));
                    
                    set(state => ({
                        incomeSources: {
                            ...state.incomeSources,
                            [currentMonth]: copiedIncomeSources
                        }
                    }));
                    
                    console.log(`✅ Copied ${copiedIncomeSources.length} income sources to ${currentMonth}`);
                }
                
                // Copy allocations from previous month
                const previousAllocations = get().allocations[prevMonthString] || [];
                console.log(`📋 Found ${previousAllocations.length} allocations from ${prevMonthString}`);
                
                // Update local state with copied allocations
                set(state => ({
                    allocations: {
                        ...state.allocations,
                        [currentMonth]: previousAllocations.map(alloc => ({
                            ...alloc,
                            id: `alloc-${Date.now()}-${Math.random()}`,
                            month: currentMonth,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }))
                    },
                    isLoading: false
                }));
                
                console.log(`✅ Copied ${previousAllocations.length} allocations to ${currentMonth}`);
                
                // Also create/update piggybank allocations for the new month
                const piggybanks = get().envelopes.filter(e => e.isPiggybank);
                console.log(`🐷 Processing ${piggybanks.length} piggybanks for ${currentMonth}`);
                
                for (const piggybank of piggybanks) {
                    const monthlyContribution = piggybank.piggybankConfig?.monthlyContribution;
                    const isPaused = piggybank.piggybankConfig?.paused ?? false;
                    
                    if (!isPaused && monthlyContribution && monthlyContribution > 0) {
                        try {
                            console.log(`🐷 Setting piggybank allocation for ${piggybank.name}: $${monthlyContribution}`);
                            await get().setEnvelopeAllocation(piggybank.id, monthlyContribution);
                        } catch (error) {
                            console.error(`❌ Failed to set allocation for piggybank ${piggybank.name}:`, error);
                        }
                    } else {
                        console.log(`🐷 Skipping piggybank ${piggybank.name} (paused=${isPaused}, contribution=${monthlyContribution})`);
                    }
                }
                
                console.log(`✅ Piggybank allocations processed for ${currentMonth}`);
                console.log(`🎯 Complete monthly setup copied to ${currentMonth}: ${previousIncomeSources.length} income sources, ${previousAllocations.length} allocations, ${piggybanks.length} piggybanks`);
                
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
                const isPiggybank = envelope?.isPiggybank;
                
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
                        t.description === 'Monthly Allocation'
                    );
                    
                    if (!existingTransaction) {
                        const transactionData = {
                            description: 'Monthly Allocation',
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
                
                // For regular spending envelopes, create/update Monthly Budget Allocation transaction
                if (!isPiggybank && budgetedAmount > 0) {
                    // Check if a Monthly Budget Allocation transaction already exists for this month
                    const existingTransaction = get().transactions.find(t => 
                        t.envelopeId === envelopeId && 
                        t.month === currentMonth &&
                        t.description === 'Monthly Budget Allocation'
                    );
                    
                    if (existingTransaction) {
                        // Update existing transaction
                        await get().updateTransaction({
                            ...existingTransaction,
                            amount: budgetedAmount
                        });
                    } else {
                        // Create new transaction
                        const transactionData = {
                            description: 'Monthly Budget Allocation',
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
                const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
                const service = MonthlyBudgetService.getInstance();
                
                const newAllocation = await service.createEnvelopeAllocation({
                    envelopeId: allocation.envelopeId,
                    budgetedAmount: allocation.budgetedAmount,
                    userId: currentUser.id,
                    month: currentMonth
                });
                
                // Update local state
                set(state => ({
                    allocations: {
                        ...state.allocations,
                        [currentMonth]: [...(state.allocations[currentMonth] || []), newAllocation]
                    },
                    isLoading: false
                }));
                
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
                const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
                const service = MonthlyBudgetService.getInstance();
                
                await service.updateEnvelopeAllocation(currentUser.id, id, {
                    budgetedAmount: updates.budgetedAmount?.toString()
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
                        t.description === 'Monthly Allocation'
                    );
                    
                    if (existingTransaction) {
                        if (updates.budgetedAmount > 0 && !envelope?.piggybankConfig?.paused) {
                            // Update existing transaction
                            await get().updateTransaction({
                                ...existingTransaction,
                                amount: updates.budgetedAmount
                            });
                        } else if (updates.budgetedAmount === 0 || envelope?.piggybankConfig?.paused) {
                            // Delete transaction if amount is 0 or piggybank is paused
                            await get().deleteTransaction(existingTransaction.id);
                        }
                    } else if (updates.budgetedAmount > 0 && !envelope?.piggybankConfig?.paused) {
                        // Create new transaction if none exists and amount > 0
                        await get().addTransaction({
                            description: 'Monthly Allocation',
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
                
                // For regular spending envelopes, create/update Monthly Budget Allocation transaction
                if (!isPiggybank && updates.budgetedAmount !== undefined) {
                    // Find the existing Monthly Budget Allocation transaction
                    const existingTransaction = get().transactions.find(t => 
                        t.envelopeId === allocation.envelopeId && 
                        t.month === currentMonth &&
                        t.description === 'Monthly Budget Allocation'
                    );
                    
                    if (existingTransaction) {
                        if (updates.budgetedAmount > 0) {
                            // Update existing transaction
                            await get().updateTransaction({
                                ...existingTransaction,
                                amount: updates.budgetedAmount
                            });
                        } else if (updates.budgetedAmount === 0) {
                            // Delete transaction if amount is 0
                            await get().deleteTransaction(existingTransaction.id);
                        }
                    } else if (updates.budgetedAmount > 0) {
                        // Create new transaction if none exists and amount > 0
                        await get().addTransaction({
                            description: 'Monthly Budget Allocation',
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
                
                // Get current user
                const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
                const currentUser = authStore.currentUser;
                if (!currentUser) {
                    throw new Error('No authenticated user found');
                }
                
                // Delete allocation via service
                const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
                const service = MonthlyBudgetService.getInstance();
                
                await service.deleteEnvelopeAllocation(currentUser.id, id);
                
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
            set({
                envelopes: [],
                transactions: [],
                incomeSources: {},
                allocations: {},
                isLoading: false,
                error: null
            });
        }
      }),
      {
        name: 'budget-storage',
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
