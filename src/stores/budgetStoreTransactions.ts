import { BudgetService } from '../services/budgetService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { Transaction } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();

// Helper to require an authenticated user (throws if not logged in)
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};

export const createTransactionSlice = ({ set, get }: SliceParams) => ({
    addTransaction: async (transaction: Omit<Transaction, 'id' | 'userId'>): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();
            
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
            
            logger.log('✅ Added transaction:', createdTransaction.id);
            
        } catch (error) {
            logger.error('❌ addTransaction failed:', error);
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
            
            const currentUser = requireAuth();
            
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
            
            logger.log('✅ Updated transaction:', transaction.id);
            
        } catch (error) {
            logger.error('❌ updateTransaction failed:', error);
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
            
            const currentUser = requireAuth();
            
            // Delete from backend
            await budgetService.deleteTransaction(currentUser.id, transactionId);
            
            // Update local state
            set(state => ({
                transactions: state.transactions.filter(tx => tx.id !== transactionId),
                isLoading: false
            }));
            
            logger.log('✅ Deleted transaction:', transactionId);
            
        } catch (error) {
            logger.error('❌ deleteTransaction failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to delete transaction' 
            });
            throw error;
        }
    },

    restoreTransaction: async (transaction: Transaction): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();
            
            // Ensure month is set
            const txDate = new Date(transaction.date);
            const month = transaction.month || `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
            
            const restoredTransaction = { ...transaction, month };

            // Update in backend
            await budgetService.updateTransaction(currentUser.id, restoredTransaction);
            
            // Update local state - add back if not present, or update if present
            set(state => {
                const existingIndex = state.transactions.findIndex(tx => tx.id === transaction.id);
                let newTransactions;
                
                if (existingIndex >= 0) {
                    // Transaction exists, update it
                    newTransactions = state.transactions.map(tx => 
                        tx.id === transaction.id ? restoredTransaction : tx
                    );
                } else {
                    // Transaction was deleted, add it back
                    newTransactions = [...state.transactions, restoredTransaction];
                }
                
                return {
                    transactions: newTransactions,
                    isLoading: false
                };
            });
            
            logger.log('✅ Restored transaction:', transaction.id);
            
        } catch (error) {
            logger.error('❌ restoreTransaction failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to restore transaction' 
            });
            throw error;
        }
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

            logger.log('✅ Transfer completed');
            
        } catch (error) {
            logger.error('❌ transferFunds failed:', error);
            throw error;
        }
    },

    fetchTransactionsForMonth: async (month: string) => {
        const state = get();
        if (state.areAllTransactionsLoaded || state.loadedTransactionMonths.includes(month)) {
            return; // Already loaded or loading
        }

        try {
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) return;

            // Mark as loaded/loading immediately to prevent double-fetch during async gap
            set(state => ({
                loadedTransactionMonths: [...state.loadedTransactionMonths, month]
            }));

            // Set loading state quietly
            logger.log(`📥 Fetching transactions for month: ${month}`);
            
            const newTransactions = await budgetService.getTransactionsByMonth(currentUser.id, month);
            
            set(state => ({
                transactions: [
                    ...state.transactions.filter(t => t.month !== month), 
                    ...newTransactions
                ]
            }));
            
            logger.log(`✅ Loaded ${newTransactions.length} transactions for ${month}`);
        } catch (error) {
            logger.error(`❌ Failed to fetch transactions for ${month}:`, error);
            // Remove from loaded months so we can try again
            set(state => ({
                loadedTransactionMonths: state.loadedTransactionMonths.filter(m => m !== month)
            }));
        }
    },

    fetchTransactionsForEnvelope: async (envelopeId: string) => {
        const state = get();
        if (state.areAllTransactionsLoaded) return; // Already have all data

        try {
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) return;

            logger.log(`📥 Fetching transactions for envelope: ${envelopeId}`);
            const envTransactions = await budgetService.getTransactionsByEnvelope(currentUser.id, envelopeId);
            
            set(state => {
                // Create a map of existing transactions for faster lookup
                const existingTxMap = new Map(state.transactions.map(t => [t.id, t]));
                
                // Add/Update fetched transactions
                envTransactions.forEach(t => {
                    existingTxMap.set(t.id, t);
                });
                
                return {
                    transactions: Array.from(existingTxMap.values())
                };
            });
            
            logger.log(`✅ Loaded ${envTransactions.length} transactions for envelope ${envelopeId}`);
        } catch (error) {
            logger.error(`❌ Failed to fetch transactions for envelope ${envelopeId}:`, error);
        }
    },

    fetchAllTransactions: async () => {
        const state = get();
        if (state.areAllTransactionsLoaded) return;

        try {
            set({ isLoading: true });
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) {
                set({ isLoading: false });
                return;
            }

            logger.log('📥 Fetching ALL transactions history...');
            const allTransactions = await budgetService.getTransactions(currentUser.id);
            
            set({
                transactions: allTransactions,
                areAllTransactionsLoaded: true,
                // We can also assume all months are loaded, but we don't necessarily know *which* months exist without parsing.
                // But since areAllTransactionsLoaded is true, fetchTransactionsForMonth will return early anyway.
                isLoading: false
            });
            
            logger.log(`✅ Loaded complete history: ${allTransactions.length} transactions`);
        } catch (error) {
            logger.error('❌ Failed to fetch all transactions:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to fetch transaction history' 
            });
        }
    },

    getEnvelopeBalance: (envelopeId: string, month?: string): number => {
        const state = get();
        const envelope = state.envelopes.find(e => e.id === envelopeId);
        if (!envelope) {
            logger.log(`❌ getEnvelopeBalance: Envelope ${envelopeId} not found`);
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
        logger.warn(`⚠️ getEnvelopeBalance: Month not provided for non-piggybank envelope ${envelopeId}. Returning 0.`);
        return 0;
    },
});
