import { TransactionService } from '../services/TransactionService';
import type { Transaction } from '../models/types';
import { transactionFromFirestore, transactionToFirestore, transactionUpdatesToFirestore } from '../mappers/transaction';
import { useMonthlyBudgetStore } from './monthlyBudgetStore';

type SliceParams = {
  set: (partial: any) => void;
  get: () => { transactions: Transaction[] };
  getCurrentUserId: () => string;
  isNetworkError: (error: any) => boolean;
};

export const createTransactionSlice = ({ set, get, getCurrentUserId, isNetworkError }: SliceParams) => {
  return {
    addTransaction: async (newTx: Omit<Transaction, 'id' | 'userId'>): Promise<void> => {
      // Generate temporary ID for immediate UI update
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const userId = getCurrentUserId();
      // Extract month from date in YYYY-MM format
      const date = new Date(newTx.date);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      console.log('🗓️ Month calculation in addTransaction:', {
        originalDate: newTx.date,
        dateObj: date,
        calculatedMonth: month,
        currentMonth: useMonthlyBudgetStore.getState().currentMonth
      });
      
      const transactionWithId = {
        ...newTx,
        id: tempId,
        userId: userId,
        month: month
      };

      // Update local state immediately for responsive UI
      set((state: any) => ({
        transactions: [...state.transactions, transactionWithId],
        isLoading: true
      }));

      // Only try to sync if the envelopeId is not a temp ID
      // (Transactions created with temp envelopeIds will sync after envelope syncs)
      if (!newTx.envelopeId.startsWith('temp-')) {
        try {
          // Try to sync with Firebase (works offline thanks to persistence)
          const transactionForService = transactionToFirestore(transactionWithId as Transaction, userId);
          const savedTx = await TransactionService.addTransaction(transactionForService as any);

          // Replace temp transaction with real one from Firebase
          console.log(`🔄 Replacing temp transaction ${tempId} with Firebase transaction:`, savedTx);

          // Convert Timestamp back to string for store compatibility
          const convertedTx = transactionFromFirestore(savedTx as any);

          set((state: any) => ({
            transactions: state.transactions.map((tx: Transaction) =>
              tx.id === tempId ? (convertedTx as Transaction) : tx
            ),
            isLoading: false,
            pendingSync: false
          }));
        } catch (err: any) {
          console.error('Add Transaction Failed:', err);
          if (isNetworkError(err)) {
            // Offline: Keep the temp transaction, mark for later sync
            set({
              isLoading: false,
              pendingSync: true,
              error: null // Don't show error for offline scenarios
            });
          } else {
            // Real error: Remove temp transaction
            set((state: any) => ({
              transactions: state.transactions.filter((tx: Transaction) => tx.id !== tempId),
              error: err.message,
              isLoading: false
            }));
          }
        }
      } else {
        // Transaction has temp envelopeId, don't try to sync yet
        console.log(`⏳ Skipping Firebase sync for transaction with temp envelopeId: ${newTx.envelopeId}`);
        set({
          isLoading: false,
          pendingSync: true // Mark for later sync when envelope gets real ID
        });
      }
    },

    deleteTransaction: async (transactionId: string): Promise<void> => {
      // Find the transaction to delete
      const transactionToDelete = get().transactions.find(tx => tx.id === transactionId);
      if (!transactionToDelete) return;

      // Store references for potential rollback
      const allTransactionsToDelete = [transactionId];

      // For transfers, also delete the paired transaction
      if (transactionToDelete.transferId) {
        const pairedTransaction = get().transactions.find(tx =>
          tx.transferId === transactionToDelete.transferId && tx.id !== transactionId
        );
        if (pairedTransaction && pairedTransaction.id) {
          allTransactionsToDelete.push(pairedTransaction.id);
        }
      }

      // Update local state immediately
      set((state: any) => ({
        transactions: state.transactions.filter((tx: Transaction) => tx.id && !allTransactionsToDelete.includes(tx.id)),
        isLoading: true
      }));

      try {
        // Delete from Firebase (skip temp IDs that haven't been synced yet)
        const userId = getCurrentUserId();
        const firebaseIdsToDelete = allTransactionsToDelete.filter(txId => !txId.startsWith('temp-'));

        for (const txId of firebaseIdsToDelete) {
          console.log(`🔄 About to delete transaction ID: ${txId}`);
          await TransactionService.deleteTransaction(userId, txId);
          console.log(`✅ Deleted transaction ID: ${txId}`);
        }

        console.log('✅ All transaction deletions completed');
        set({ isLoading: false });
      } catch (err: any) {
        console.error('Delete Transaction Failed:', err);
        if (isNetworkError(err)) {
          // Offline: Keep the local deletion, mark for later sync
          set({
            isLoading: false,
            pendingSync: true,
            error: null
          });
        } else {
          // Real error: Restore the transactions locally
          const restoredTransactions = allTransactionsToDelete.map(txId => {
            // Find the original transaction (this is a simplified approach)
            return get().transactions.find(tx => tx.id === txId) || transactionToDelete;
          }).filter(Boolean);

          set((state: any) => ({
            transactions: [...state.transactions, ...restoredTransactions],
            error: err.message,
            isLoading: false
          }));
        }
      }
    },

    updateTransaction: async (updatedTx: Transaction): Promise<void> => {
      console.log('🔄 updateTransaction called:', updatedTx);

      // Update local state immediately
      set((state: any) => ({
        transactions: state.transactions.map((tx: Transaction) =>
          tx.id === updatedTx.id ? updatedTx : tx
        ),
        isLoading: true
      }));

      try {
        // Try Firebase update first with timeout for offline detection
        const userId = getCurrentUserId();
        const firebasePromise = TransactionService.updateTransaction(
          userId,
          updatedTx.id!,
          transactionUpdatesToFirestore(updatedTx)
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 5000)
        );

        await Promise.race([firebasePromise, timeoutPromise]);
        console.log('✅ Transaction updated in Firebase');

        set({ isLoading: false });
      } catch (err: any) {
        console.error('Update Transaction Failed:', err);
        console.log('🔍 Error details:', {
          name: (err as any)?.name || 'Unknown',
          message: (err as any)?.message || 'Unknown',
          code: (err as any)?.code || 'Unknown',
          isNetworkError: isNetworkError(err)
        });

        // For offline/network errors, keep the local changes and mark for later sync
        if (isNetworkError(err)) {
          console.log('🔄 Treating as offline scenario - keeping local transaction update');
          set({
            isLoading: false,
            pendingSync: true,
            error: null
          });
        } else {
          set({ error: err.message, isLoading: false });
        }
      }
    },

    restoreTransaction: async (transaction: Transaction): Promise<void> => {
      // Update local state immediately
      set((state: any) => ({
        transactions: [...state.transactions, transaction],
        isLoading: true
      }));

      try {
        // Note: Firebase restore would require additional service methods
        // For now, we keep it local-only
        set({ isLoading: false });
      } catch (err: any) {
        console.error('Restore Transaction Failed:', err);
        set({ error: err.message, isLoading: false });
      }
    }
  };
};
