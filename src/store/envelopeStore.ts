import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Envelope, Transaction } from '../models/types';

interface EnvelopeState {
  envelopes: Envelope[];
  transactions: Transaction[];
  
  // Envelope actions
  addEnvelope: (name: string, initialBalance: number) => void;
  deleteEnvelope: (id: string) => void;
  renameEnvelope: (id: string, newName: string) => void;
  
  // Transaction actions
  addToEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => void;
  spendFromEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => void;
  updateTransaction: (updatedTx: Transaction) => void;
  transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => void;
  deleteTransaction: (transactionId: string) => void;
}

// Mock data for initial state
const mockEnvelopes: Envelope[] = [
  {
    id: uuidv4(),
    name: 'Groceries',
    currentBalance: 500,
    lastUpdated: new Date().toISOString(),
    isActive: true,
    orderIndex: 0,
  },
  {
    id: uuidv4(),
    name: 'Mortgage',
    currentBalance: 2000,
    lastUpdated: new Date().toISOString(),
    isActive: true,
    orderIndex: 1,
  },
  {
    id: uuidv4(),
    name: 'Entertainment',
    currentBalance: 300,
    lastUpdated: new Date().toISOString(),
    isActive: true,
    orderIndex: 2,
  },
  {
    id: uuidv4(),
    name: 'Emergency Fund',
    currentBalance: 5000,
    lastUpdated: new Date().toISOString(),
    isActive: true,
    orderIndex: 3,
  },
];

const mockTransactions: Transaction[] = [];

export const useEnvelopeStore = create<EnvelopeState>()(
  persist(
    (set) => ({
      envelopes: mockEnvelopes,
      transactions: mockTransactions,

      // Add a new envelope with optional initial balance
      addEnvelope: (name: string, initialBalance: number = 0) => {
        const newEnvelope: Envelope = {
          id: uuidv4(),
          name,
          currentBalance: initialBalance,
          lastUpdated: new Date().toISOString(),
          isActive: true,
          orderIndex: 0,
        };

        set((state) => ({
          envelopes: [...state.envelopes, newEnvelope],
        }));

        // If there's an initial balance, create an income transaction
        if (initialBalance > 0) {
          const initialTransaction: Transaction = {
            id: uuidv4(),
            date: new Date().toISOString(),
            amount: initialBalance,
            description: 'Initial balance',
            envelopeId: newEnvelope.id,
            reconciled: false,
            type: 'Income',
          };

          set((state) => ({
            transactions: [...state.transactions, initialTransaction],
          }));
        }
      },

      // Delete an envelope and all its transactions
      deleteEnvelope: (id: string) => {
        set((state) => ({
          envelopes: state.envelopes.filter((env) => env.id !== id),
          transactions: state.transactions.filter((tx) => tx.envelopeId !== id),
        }));
      },

      // Rename an envelope
      renameEnvelope: (id: string, newName: string) => {
        set((state) => ({
          envelopes: state.envelopes.map((env) =>
            env.id === id ? { ...env, name: newName } : env
          ),
        }));
      },

      // Add money to an envelope (income)
      addToEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => {
        const transactionDate = date
          ? typeof date === 'string'
            ? date
            : date.toISOString()
          : new Date().toISOString();

        const newTransaction: Transaction = {
          id: uuidv4(),
          date: transactionDate,
          amount,
          description: note,
          envelopeId,
          reconciled: false,
          type: 'Income',
        };

        set((state) => ({
          transactions: [...state.transactions, newTransaction],
          envelopes: state.envelopes.map((env) =>
            env.id === envelopeId
              ? {
                  ...env,
                  currentBalance: env.currentBalance + amount,
                  lastUpdated: new Date().toISOString(),
                }
              : env
          ),
        }));
      },

      // Spend money from an envelope (expense)
      spendFromEnvelope: (envelopeId: string, amount: number, note: string, date?: Date | string) => {
        const transactionDate = date
          ? typeof date === 'string'
            ? date
            : date.toISOString()
          : new Date().toISOString();

        const newTransaction: Transaction = {
          id: uuidv4(),
          date: transactionDate,
          amount,
          description: note,
          envelopeId,
          reconciled: false,
          type: 'Expense',
        };

        set((state) => ({
          transactions: [...state.transactions, newTransaction],
          envelopes: state.envelopes.map((env) =>
            env.id === envelopeId
              ? {
                  ...env,
                  currentBalance: env.currentBalance - amount,
                  lastUpdated: new Date().toISOString(),
                }
              : env
          ),
        }));
      },

      // Transfer funds between envelopes
      transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => {
        set((state) => {
          const transactionDate = date
            ? typeof date === 'string'
              ? date
              : date.toISOString()
            : new Date().toISOString();

          // Find both envelopes
          const fromEnvelope = state.envelopes.find((env) => env.id === fromEnvelopeId);
          const toEnvelope = state.envelopes.find((env) => env.id === toEnvelopeId);

          if (!fromEnvelope || !toEnvelope) {
            console.warn('One or both envelopes not found');
            return state;
          }

          // Generate a shared transfer ID to link the two transactions
          const transferId = uuidv4();

          // Create expense transaction for the "from" envelope
          const expenseTransaction: Transaction = {
            id: uuidv4(),
            date: transactionDate,
            amount,
            description: `Transfer to ${toEnvelope.name}`,
            envelopeId: fromEnvelopeId,
            reconciled: false,
            type: 'Expense',
            transferId,
          };

          // Create income transaction for the "to" envelope
          const incomeTransaction: Transaction = {
            id: uuidv4(),
            date: transactionDate,
            amount,
            description: `Transfer from ${fromEnvelope.name}`,
            envelopeId: toEnvelopeId,
            reconciled: false,
            type: 'Income',
            transferId,
          };

          // Add note to descriptions if provided
          if (note) {
            expenseTransaction.description += ` (${note})`;
            incomeTransaction.description += ` (${note})`;
          }

          return {
            transactions: [...state.transactions, expenseTransaction, incomeTransaction],
            envelopes: state.envelopes.map((env) => {
              if (env.id === fromEnvelopeId) {
                // Deduct from source envelope
                return {
                  ...env,
                  currentBalance: env.currentBalance - amount,
                  lastUpdated: new Date().toISOString(),
                };
              } else if (env.id === toEnvelopeId) {
                // Add to target envelope
                return {
                  ...env,
                  currentBalance: env.currentBalance + amount,
                  lastUpdated: new Date().toISOString(),
                };
              }
              return env;
            }),
          };
        });
      },

      // Update an existing transaction and adjust envelope balance
      updateTransaction: (updatedTx: Transaction) => {
        set((state) => {
          // Find the old transaction
          const oldTransaction = state.transactions.find((tx) => tx.id === updatedTx.id);
          
          if (!oldTransaction) {
            console.warn('Transaction not found');
            return state;
          }

          // Calculate the balance adjustment
          let balanceAdjustment = 0;

          // If the envelope changed, we need to revert old and apply new
          if (oldTransaction.envelopeId !== updatedTx.envelopeId) {
            // Revert the old transaction from old envelope
            const oldAmount = oldTransaction.type === 'Income' 
              ? -oldTransaction.amount 
              : oldTransaction.amount;
            
            // Apply new transaction to new envelope
            const newAmount = updatedTx.type === 'Income' 
              ? updatedTx.amount 
              : -updatedTx.amount;

            return {
              transactions: state.transactions.map((tx) =>
                tx.id === updatedTx.id ? updatedTx : tx
              ),
              envelopes: state.envelopes.map((env) => {
                if (env.id === oldTransaction.envelopeId) {
                  // Revert old transaction
                  return {
                    ...env,
                    currentBalance: env.currentBalance + oldAmount,
                    lastUpdated: new Date().toISOString(),
                  };
                } else if (env.id === updatedTx.envelopeId) {
                  // Apply new transaction
                  return {
                    ...env,
                    currentBalance: env.currentBalance + newAmount,
                    lastUpdated: new Date().toISOString(),
                  };
                }
                return env;
              }),
            };
          }

          // Same envelope, calculate the difference
          if (oldTransaction.type === updatedTx.type) {
            // Same type, calculate amount difference
            const amountDiff = updatedTx.amount - oldTransaction.amount;
            balanceAdjustment = updatedTx.type === 'Income' ? amountDiff : -amountDiff;
          } else {
            // Type changed (Income <-> Expense)
            // Revert old and apply new
            const revertOld = oldTransaction.type === 'Income' 
              ? -oldTransaction.amount 
              : oldTransaction.amount;
            const applyNew = updatedTx.type === 'Income' 
              ? updatedTx.amount 
              : -updatedTx.amount;
            balanceAdjustment = revertOld + applyNew;
          }

          return {
            transactions: state.transactions.map((tx) =>
              tx.id === updatedTx.id ? updatedTx : tx
            ),
            envelopes: state.envelopes.map((env) =>
              env.id === updatedTx.envelopeId
                ? {
                    ...env,
                    currentBalance: env.currentBalance + balanceAdjustment,
                    lastUpdated: new Date().toISOString(),
                  }
                : env
            ),
          };
        });
      },

      // Delete a transaction and reverse its balance impact
      deleteTransaction: (transactionId: string) => {
        set((state) => {
          // Find the transaction to delete
          const transaction = state.transactions.find((tx) => tx.id === transactionId);
          
          if (!transaction) {
            console.warn('Transaction not found');
            return state;
          }

          // Calculate the balance reversal
          // If it was income, we need to subtract it back
          // If it was expense, we need to add it back
          const balanceReversal = transaction.type === 'Income' 
            ? -transaction.amount 
            : transaction.amount;

          // Check if this is a transfer (has a transferId)
          const isTransfer = !!transaction.transferId;
          const transactionsToDelete = [transactionId];
          const envelopesToUpdate: string[] = [transaction.envelopeId];

          if (isTransfer) {
            // Find the paired transaction
            const pairedTransaction = state.transactions.find(
              (tx) => tx.transferId === transaction.transferId && tx.id !== transactionId
            );
            
            if (pairedTransaction) {
              transactionsToDelete.push(pairedTransaction.id);
              envelopesToUpdate.push(pairedTransaction.envelopeId);
            }
          }

          return {
            // Remove the transaction(s)
            transactions: state.transactions.filter(
              (tx) => !transactionsToDelete.includes(tx.id)
            ),
            // Update the envelope balance(s)
            envelopes: state.envelopes.map((env) => {
              // Update the envelope of the deleted transaction
              if (env.id === transaction.envelopeId) {
                return {
                  ...env,
                  currentBalance: env.currentBalance + balanceReversal,
                  lastUpdated: new Date().toISOString(),
                };
              }
              
              // If there's a paired transfer transaction, update that envelope too
              if (isTransfer && envelopesToUpdate.includes(env.id) && env.id !== transaction.envelopeId) {
                const pairedTx = state.transactions.find(
                  (tx) => tx.transferId === transaction.transferId && tx.id !== transactionId
                );
                if (pairedTx && pairedTx.envelopeId === env.id) {
                  const pairedReversal = pairedTx.type === 'Income' 
                    ? -pairedTx.amount 
                    : pairedTx.amount;
                  return {
                    ...env,
                    currentBalance: env.currentBalance + pairedReversal,
                    lastUpdated: new Date().toISOString(),
                  };
                }
              }
              
              return env;
            }),
          };
        });
      },
    }),
    {
      name: 'envelope-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

