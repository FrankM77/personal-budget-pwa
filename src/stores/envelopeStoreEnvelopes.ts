import { Timestamp } from 'firebase/firestore';
import { TransactionService } from '../services/TransactionService';
import { EnvelopeService } from '../services/EnvelopeService';
import type { Transaction, Envelope } from '../models/types';

type SliceParams = {
  set: (partial: any) => void;
  get: () => {
    envelopes: Envelope[];
    transactions: Transaction[];
    addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
    getEnvelopeBalance: (envelopeId: string) => any;
    removeEnvelopeFromTemplates: (envelopeId: string) => Promise<void>;
  };
  getCurrentUserId: () => string;
  isNetworkError: (error: any) => boolean;
};

export const createEnvelopeSlice = ({ set, get, getCurrentUserId, isNetworkError }: SliceParams) => {
  const convertFirebaseTransaction = (firebaseTx: any): Transaction => ({
    id: firebaseTx.id,
    date: firebaseTx.date?.toDate?.() ? firebaseTx.date.toDate().toISOString() : firebaseTx.date,
    amount: parseFloat(firebaseTx.amount) || 0,
    description: firebaseTx.description || '',
    envelopeId: firebaseTx.envelopeId || '',
    reconciled: firebaseTx.reconciled || false,
    type: firebaseTx.type === 'income' ? 'Income' : firebaseTx.type === 'expense' ? 'Expense' : 'Transfer',
    transferId: firebaseTx.transferId || undefined,
    userId: firebaseTx.userId || undefined
  });

  return {
    createEnvelope: async (newEnv: Omit<Envelope, 'id'>): Promise<Envelope> => {
      // For initial deposits, use transaction system instead of initialBalance field
      // This ensures all money movements are properly tracked as transactions
      const hasInitialDeposit = (newEnv as any).currentBalance && (newEnv as any).currentBalance > 0;
      const envelopeData = hasInitialDeposit
        ? { ...newEnv, currentBalance: 0, orderIndex: (newEnv as any).orderIndex ?? 0 } // Set currentBalance to 0, use transactions for balance
        : { ...newEnv, orderIndex: (newEnv as any).orderIndex ?? 0 };

      // Generate temporary ID for immediate UI update
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const envelopeWithId = { ...envelopeData, id: tempId } as Envelope;

      // Update local state immediately for responsive UI
      set((state: any) => ({
        envelopes: [...state.envelopes, envelopeWithId],
        isLoading: true
      }));

      // ALWAYS create the initial deposit transaction locally first (for immediate UI feedback)
      if (hasInitialDeposit) {
        console.log(`💰 Creating initial deposit transaction locally first: ${envelopeWithId.name} (tempId: ${tempId})`);
        try {
          await get().addTransaction({
            description: 'Initial Deposit',
            amount: (newEnv as any).currentBalance!,
            envelopeId: tempId, // Use temp ID initially
            date: new Date().toISOString(),
            type: 'Income',
            reconciled: false
          });
          console.log('✅ Initial deposit transaction created locally');

          // Test balance calculation immediately
          const testBalance = get().getEnvelopeBalance(tempId);
          console.log(`💵 Test balance for temp envelope ${tempId}: $${testBalance.toNumber()}`);

        } catch (error) {
          console.error('❌ Failed to create initial deposit transaction locally:', error);
        }
      }

      // Now try to sync with Firebase
      try {
        console.log('📡 Attempting Firebase envelope creation...');
        const userId = getCurrentUserId();
        const envelopeForService: Envelope & { userId: string } = {
          ...(envelopeData as any),
          id: '', // Temporary ID, will be replaced by Firebase
          userId: userId
        };
        const savedEnv: Envelope = await EnvelopeService.createEnvelope(envelopeForService);
        console.log('✅ Firebase envelope creation successful:', savedEnv);

        // Replace temp envelope with real one from Firebase
        // Convert Firebase envelope to store format (preserve all fields including piggybank data)
        const storeEnvelope: Envelope = {
          id: savedEnv.id,
          name: savedEnv.name,
          currentBalance: savedEnv.currentBalance,
          lastUpdated: savedEnv.lastUpdated,
          isActive: savedEnv.isActive ?? true,
          orderIndex: savedEnv.orderIndex ?? 0,
          userId: savedEnv.userId,
          createdAt: savedEnv.createdAt,
          isPiggybank: savedEnv.isPiggybank,
          piggybankConfig: savedEnv.piggybankConfig
        };

        set((state: any) => ({
          envelopes: state.envelopes.map((env: Envelope) =>
            env.id === tempId ? storeEnvelope : env
          ),
          isLoading: false,
          pendingSync: false
        }));

        // Update any transactions that reference the temp envelope ID and sync them
        if (hasInitialDeposit) {
          console.log(`🔄 Updating transactions from temp envelope ID ${tempId} to real ID ${savedEnv.id}`);
          console.log('📊 Transactions before update:', get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));

          // Update envelopeId for transactions
          set((state: any) => ({
            transactions: state.transactions.map((tx: Transaction) =>
              tx.envelopeId === tempId ? { ...tx, envelopeId: savedEnv.id } : tx
            )
          }));

          console.log('📊 Transactions after envelopeId update:', get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));

          // Now sync any transactions that were waiting for this envelope
          const transactionsToSync = get().transactions.filter(tx =>
            tx.envelopeId === savedEnv.id && tx.id && tx.id.startsWith('temp-')
          );

          console.log(`📡 Found ${transactionsToSync.length} transactions to sync for envelope ${savedEnv.id}:`, transactionsToSync.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId })));

          for (const tx of transactionsToSync) {
            try {
              console.log('📤 Syncing transaction:', tx);
              const transactionForService = {
                ...tx,
                amount: tx.amount.toString(), // Convert to string for Firebase
                type: tx.type.toLowerCase() as 'income' | 'expense' | 'transfer', // Convert to lowercase for Firebase
                date: Timestamp.fromDate(new Date(tx.date))
              };
              const savedTx = await TransactionService.addTransaction(transactionForService as any);

              console.log('✅ Transaction synced:', savedTx);

              // Replace temp transaction with real one
              const convertedTx = convertFirebaseTransaction(savedTx);

              console.log(`🔄 Replacing temp transaction ${tx.id} with Firebase transaction ${savedTx.id}`);
              set((state: any) => ({
                transactions: state.transactions.map((t: Transaction) =>
                  t.id === tx.id ? (convertedTx as Transaction) : t
                )
              }));

            } catch (syncError) {
              console.error(`❌ Failed to sync transaction ${tx.id}:`, syncError);
            }
          }

          console.log('📊 Final transactions after sync:', get().transactions.map(tx => ({ id: tx.id, envelopeId: tx.envelopeId, description: tx.description })));
          set({ pendingSync: false });
          console.log(`✅ All transactions synced for envelope ${savedEnv.id}`);
        }

        // Return the saved envelope so we have the real ID
        return savedEnv;

      } catch (err: any) {
        console.error('Create Envelope Failed:', err);
        console.log('Error details:', {
          code: err?.code,
          message: err?.message,
          name: err?.name,
          isNetworkError: isNetworkError(err)
        });

        // For offline/network errors, keep the local envelope and mark for later sync
        if (isNetworkError(err)) {
          console.log('🔄 Treating as offline scenario - keeping temp envelope and transactions');
          set({
            isLoading: false,
            pendingSync: true,
            error: null
          });
          // Return the temp envelope
          return envelopeWithId;
        } else {
          // For real errors, remove the local envelope
          console.log('❌ Real error - removing temp envelope');
          set((state: any) => ({
            envelopes: state.envelopes.filter((env: Envelope) => env.id !== tempId),
            transactions: state.transactions.filter((tx: Transaction) => tx.envelopeId !== tempId),
            error: err.message,
            isLoading: false
          }));
          throw err;
        }
      }
      // Return the final saved envelope (this line should technically be unreachable due to the return in try block, but satisfies TS)
      return envelopeWithId;
    },

    addToEnvelope: async (envelopeId: string, amount: number, note: string, date?: Date | string): Promise<void> => {
      const transactionDate = date
        ? typeof date === 'string' ? date : date.toISOString()
        : new Date().toISOString();

      await get().addTransaction({
        description: note,
        amount: amount,
        envelopeId,
        date: transactionDate,
        type: 'Income',
        reconciled: false
      });
    },

    spendFromEnvelope: async (envelopeId: string, amount: number, note: string, date?: Date | string): Promise<void> => {
      const transactionDate = date
        ? typeof date === 'string' ? date : date.toISOString()
        : new Date().toISOString();

      await get().addTransaction({
        description: note,
        amount: amount,
        envelopeId,
        date: transactionDate,
        type: 'Expense',
        reconciled: false
      });
    },

    transferFunds: async (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string): Promise<void> => {
      console.log(`Transferring ${amount} from ${fromEnvelopeId} to ${toEnvelopeId} with note: ${note}`);
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
    },

    deleteEnvelope: async (envelopeId: string): Promise<void> => {
      // Find transactions to delete
      const transactionsToDelete = get().transactions.filter(tx => tx.envelopeId === envelopeId);

      // Update local state immediately (cascade delete)
      set((state: any) => ({
        envelopes: state.envelopes.filter((env: Envelope) => env.id !== envelopeId),
        transactions: state.transactions.filter((tx: Transaction) => tx.envelopeId !== envelopeId),
        isLoading: true
      }));

      try {
        // Delete envelope from Firebase
        const userId = getCurrentUserId();
        await EnvelopeService.deleteEnvelope(userId, envelopeId);

        // Cascade delete: Delete all associated transactions from Firebase
        for (const transaction of transactionsToDelete) {
          if (transaction.id && !transaction.id.startsWith('temp-')) {
            await TransactionService.deleteTransaction(userId, transaction.id);
          }
        }

        // Clean up templates that reference the deleted envelope
        await get().removeEnvelopeFromTemplates(envelopeId);

        set({ isLoading: false });
      } catch (err: any) {
        console.error('Delete Envelope Failed:', err);
        if (isNetworkError(err)) {
          // Offline: Keep the local deletion, mark for later sync
          set({
            isLoading: false,
            pendingSync: true,
            error: null
          });
        } else {
          // Real error: Restore the envelope and transactions locally
          const restoredEnvelope = get().envelopes.find(env => env.id === envelopeId);
          if (restoredEnvelope) {
            set((state: any) => ({
              envelopes: [...state.envelopes, restoredEnvelope],
              transactions: [...state.transactions, ...transactionsToDelete],
              error: err.message,
              isLoading: false
            }));
          } else {
            set({ error: err.message, isLoading: false });
          }
        }
      }
    },

    updateEnvelope: async (envelope: Envelope): Promise<void> => {
      // Update local state immediately
      set((state: any) => ({
        envelopes: state.envelopes.map((env: Envelope) =>
          env.id === envelope.id ? envelope : env
        ),
        isLoading: true
      }));

      try {
        const userId = getCurrentUserId();
        await EnvelopeService.saveEnvelope(userId, envelope);
        set({ isLoading: false });
      } catch (err: any) {
        console.error('Update Envelope Failed:', err);
        if (isNetworkError(err)) {
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

    renameEnvelope: async (envelopeId: string, newName: string): Promise<void> => {
      // Update local state immediately
      set((state: any) => ({
        envelopes: state.envelopes.map((env: Envelope) =>
          env.id === envelopeId ? { ...env, name: newName } : env
        ),
        isLoading: true
      }));

      try {
        // Note: Firebase update would require additional service methods
        // For now, we keep it local-only
        set({ isLoading: false });
      } catch (err: any) {
        console.error('Rename Envelope Failed:', err);
        set({ error: err.message, isLoading: false });
      }
    }
  };
};
