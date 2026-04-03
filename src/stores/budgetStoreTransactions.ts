import { BudgetService } from '../services/budgetService';
import { EnvelopeService } from '../services/EnvelopeService';
import { useAuthStore } from './authStore';
import { requireAuth } from '../utils/requireAuth';
import logger from '../utils/logger';
import type { Transaction } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();

// Track IDs of transactions that have been optimistically deleted
// so the real-time listener doesn't add them back before the backend write propagates
export const pendingTransactionDeletions = new Set<string>();

export const createTransactionSlice = ({ set, get }: SliceParams) => {
  // Updates a piggybank envelope's currentBalance by a delta, both locally and in Firestore.
  // Fire-and-forget on the Firestore write; the real-time envelope listener confirms the value.
  const updatePiggybankBalance = (envelopeId: string, delta: number) => {
    const { currentUser } = useAuthStore.getState();
    if (!currentUser) return;
    const envelope = get().envelopes.find(e => e.id === envelopeId);
    if (!envelope?.isPiggybank) return;

    const newBalance = (envelope.currentBalance ?? 0) + delta;

    set(state => ({
      envelopes: state.envelopes.map(e =>
        e.id === envelopeId ? { ...e, currentBalance: newBalance } : e
      )
    }));

    EnvelopeService.updateBalance(currentUser.id, envelopeId, newBalance)
      .catch(err => logger.error(`❌ Failed to update piggybank balance for ${envelopeId}:`, err));
  };

  return {
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

            // Update piggybank balance incrementally if applicable
            const delta = createdTransaction.type === 'Income' ? createdTransaction.amount : -createdTransaction.amount;
            updatePiggybankBalance(createdTransaction.envelopeId, delta);

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

            // Capture old transaction before update to compute piggybank balance delta
            const oldTx = get().transactions.find(tx => tx.id === transaction.id);

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

            // Update piggybank balance incrementally based on the delta
            if (oldTx) {
                const oldEffect = oldTx.type === 'Income' ? oldTx.amount : -oldTx.amount;
                const newEffect = updatedTransaction.type === 'Income' ? updatedTransaction.amount : -updatedTransaction.amount;
                updatePiggybankBalance(updatedTransaction.envelopeId, newEffect - oldEffect);
            }

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

            // Capture transaction before removing it to update piggybank balance
            const tx = get().transactions.find(t => t.id === transactionId);

            // Track this deletion so real-time listener doesn't re-add it
            pendingTransactionDeletions.add(transactionId);

            // Update local state FIRST (optimistic)
            set(state => ({
                transactions: state.transactions.filter(t => t.id !== transactionId),
                isLoading: false
            }));

            // Reverse the transaction's effect on the piggybank balance
            if (tx) {
                const reversal = tx.type === 'Income' ? -tx.amount : tx.amount;
                updatePiggybankBalance(tx.envelopeId, reversal);
            }

            // Hard-delete from backend (fire-and-forget to avoid real-time listener cascade)
            budgetService.deleteTransaction(currentUser.id, transactionId)
                .catch(err => logger.error('❌ Backend hard-delete transaction failed:', err));

            logger.log('✅ BudgetStoreTransactions: Hard-deleted transaction:', transactionId);
            
        } catch (error) {
            logger.error('❌ deleteTransaction failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to delete transaction' 
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

        // For Piggybanks: ALWAYS compute balance from transactions (single source of truth).
        // All piggybank transactions are eager-loaded in fetchData so data is always available.
        // When a month is provided, filter to transactions up to that month.
        // When no month is provided, use all loaded transactions.
        if (envelope.isPiggybank) {
            const allPiggybankTxs = state.transactions.filter(t => t.envelopeId === envelopeId);
            const txs = month
                ? allPiggybankTxs.filter(t => !t.month || t.month <= month)
                : allPiggybankTxs;

            const totalIncome = txs.filter(t => t.type === 'Income').reduce((acc, curr) => acc + (curr.amount || 0), 0);
            const totalSpent = txs.filter(t => t.type === 'Expense').reduce((acc, curr) => acc + (curr.amount || 0), 0);
            const balance = totalIncome - totalSpent;

            return balance;
        }

        // For regular spending envelopes, calculate monthly balance if month is provided
        if (month) {
            // Fix: If we're calculating balance for current month and transactions aren't loaded yet,
            // trigger a fetch to ensure we have the "Budgeted" transactions. This fixes the issue where 
            // balances show 0 on initial load because transactions (including automatic "Budgeted" 
            // transactions) are lazy-loaded.
            if (month === state.currentMonth && !state.loadedTransactionMonths.includes(month)) {
                // Don't await - let it fetch in background. The balance will update when data arrives.
                get().fetchTransactionsForMonth(month);
                logger.log(`🔧 getEnvelopeBalance: Triggering fetch for unloaded month ${month}`);
            }

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
  };
};
