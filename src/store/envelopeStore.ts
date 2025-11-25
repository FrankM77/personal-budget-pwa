import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Envelope, Transaction, DistributionTemplate } from '../models/types';

interface EnvelopeState {
  envelopes: Envelope[];
  transactions: Transaction[];
  distributionTemplates: DistributionTemplate[];

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
  restoreTransaction: (transaction: Transaction) => void;

  // Template actions
  saveTemplate: (name: string, distributions: Record<string, number>, note?: string) => void;
  deleteTemplate: (id: string) => void;

  // Data management actions
  importData: (data: any) => { success: boolean; message: string };
  resetData: () => void;
}

// Helper: Convert Apple Timestamp (Seconds since 2001) to JS ISO String
const parseDate = (dateValue: number | string): string => {
  // Handle null/undefined values
  if (dateValue == null) {
    return new Date().toISOString();
  }

  if (typeof dateValue === 'string') return dateValue; // Already ISO

  // Apple Epoch (Jan 1 2001) is 978307200 seconds after Unix Epoch (Jan 1 1970)
  const APPLE_EPOCH_OFFSET = 978307200;

  // If the number is small (like 785731563), it's Apple time.
  // If it's huge (like 1700000000000), it's JS time.
  // Cutoff: Year 1980 in unix seconds is ~3e8. Apple numbers are around 7e8.
  if (dateValue < 2000000000) {
      const jsTimestamp = (dateValue + APPLE_EPOCH_OFFSET) * 1000;
      return new Date(jsTimestamp).toISOString();
  }

  return new Date(dateValue).toISOString();
};

// Helper: Convert Swift Flat Array ["key", val, "key", val] to Object {key: val}
const parseDistributions = (dist: any): Record<string, number> => {
  if (!Array.isArray(dist)) return dist; // Already an object

  const result: Record<string, number> = {};
  for (let i = 0; i < dist.length; i += 2) {
    const key = dist[i];
    const val = dist[i+1];
    if (typeof key === 'string' && typeof val === 'number') {
      result[key] = val;
    }
  }
  return result;
};

export const useEnvelopeStore = create<EnvelopeState>()(
  persist(
    (set) => ({
      envelopes: [],
      transactions: [],
      distributionTemplates: [], // <--- ADDED

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

      // Delete an envelope, its transactions, AND clean up templates
      deleteEnvelope: (id: string) => {
        set((state) => {
            // 1. Remove Envelope & Transactions
            const newEnvelopes = state.envelopes.filter((env) => env.id !== id);
            const newTransactions = state.transactions.filter((tx) => tx.envelopeId !== id);

            // 2. Clean up Templates (Remove reference to this envelope)
            const newTemplates = state.distributionTemplates
              .map((template) => {
                const newDistributions = { ...template.distributions };
                if (newDistributions[id]) {
                  delete newDistributions[id];
                }
                return { ...template, distributions: newDistributions };
              })
              // Remove empty templates
              .filter((template) => Object.keys(template.distributions).length > 0);

            return {
              envelopes: newEnvelopes,
              transactions: newTransactions,
              distributionTemplates: newTemplates,
            };
        });
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

          const fromEnvelope = state.envelopes.find((env) => env.id === fromEnvelopeId);
          const toEnvelope = state.envelopes.find((env) => env.id === toEnvelopeId);

          if (!fromEnvelope || !toEnvelope) {
            console.warn('One or both envelopes not found');
            return state;
          }

          const transferId = uuidv4();

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

          if (note) {
            expenseTransaction.description += ` (${note})`;
            incomeTransaction.description += ` (${note})`;
          }

          return {
            transactions: [...state.transactions, expenseTransaction, incomeTransaction],
            envelopes: state.envelopes.map((env) => {
              if (env.id === fromEnvelopeId) {
                return {
                  ...env,
                  currentBalance: env.currentBalance - amount,
                  lastUpdated: new Date().toISOString(),
                };
              } else if (env.id === toEnvelopeId) {
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
          const oldTransaction = state.transactions.find((tx) => tx.id === updatedTx.id);
          
          if (!oldTransaction) {
            console.warn('Transaction not found');
            return state;
          }

          let balanceAdjustment = 0;

          if (oldTransaction.envelopeId !== updatedTx.envelopeId) {
            const oldAmount = oldTransaction.type === 'Income' ? -oldTransaction.amount : oldTransaction.amount;
            const newAmount = updatedTx.type === 'Income' ? updatedTx.amount : -updatedTx.amount;

            return {
              transactions: state.transactions.map((tx) =>
                tx.id === updatedTx.id ? updatedTx : tx
              ),
              envelopes: state.envelopes.map((env) => {
                if (env.id === oldTransaction.envelopeId) {
                  return {
                    ...env,
                    currentBalance: env.currentBalance + oldAmount,
                    lastUpdated: new Date().toISOString(),
                  };
                } else if (env.id === updatedTx.envelopeId) {
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

          if (oldTransaction.type === updatedTx.type) {
            const amountDiff = updatedTx.amount - oldTransaction.amount;
            balanceAdjustment = updatedTx.type === 'Income' ? amountDiff : -amountDiff;
          } else {
            const revertOld = oldTransaction.type === 'Income' ? -oldTransaction.amount : oldTransaction.amount;
            const applyNew = updatedTx.type === 'Income' ? updatedTx.amount : -updatedTx.amount;
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

      // Delete a transaction and reverse its balance impact (Resilient Version)
      deleteTransaction: (transactionId: string) => {
        set((state) => {
          const transaction = state.transactions.find((tx) => tx.id === transactionId);

          if (!transaction) {
            console.warn('Transaction not found');
            return state;
          }

          const balanceReversal = transaction.type === 'Income' 
            ? -transaction.amount 
            : transaction.amount;

          const isTransfer = !!transaction.transferId;
          const transactionsToDelete = [transactionId];
          const envelopesToUpdate: string[] = [transaction.envelopeId];

          if (isTransfer) {
            const pairedTransaction = state.transactions.find(
              (tx) => tx.transferId === transaction.transferId && tx.id !== transactionId
            );
            
            if (pairedTransaction) {
              transactionsToDelete.push(pairedTransaction.id);
              envelopesToUpdate.push(pairedTransaction.envelopeId);
            }
          }

          const updatedEnvelopes = state.envelopes.map((env) => {
            if (env.id === transaction.envelopeId) {
              const newBalance = env.currentBalance + balanceReversal;
              return {
                ...env,
                currentBalance: newBalance,
                lastUpdated: new Date().toISOString(),
              };
            }

            if (isTransfer && envelopesToUpdate.includes(env.id) && env.id !== transaction.envelopeId) {
              const pairedTx = state.transactions.find(
                (tx) => tx.transferId === transaction.transferId && tx.id !== transactionId
              );
              if (pairedTx && pairedTx.envelopeId === env.id) {
                const pairedReversal = pairedTx.type === 'Income'
                  ? -pairedTx.amount
                  : pairedTx.amount;
                const newBalance = env.currentBalance + pairedReversal;
                return {
                  ...env,
                  currentBalance: newBalance,
                  lastUpdated: new Date().toISOString(),
                };
              }
            }

            return env;
          });

          return {
            transactions: state.transactions.filter(
              (tx) => !transactionsToDelete.includes(tx.id)
            ),
            envelopes: updatedEnvelopes,
          };
        });
      },

      // Restore a previously deleted transaction
      // NOTE: For Transfers, this only restores the single transaction record passed in.
      // It does not currently restore the paired transfer if it was deleted.
      restoreTransaction: (transaction: Transaction) => {
        set((state) => {
          const exists = state.transactions.some((tx) => tx.id === transaction.id);
          if (exists) return state;

          const balanceImpact = transaction.type === 'Income'
            ? transaction.amount
            : -transaction.amount;

          return {
            transactions: [...state.transactions, transaction],
            envelopes: state.envelopes.map((env) => {
              if (env.id === transaction.envelopeId) {
                return {
                  ...env,
                  currentBalance: env.currentBalance + balanceImpact,
                  lastUpdated: new Date().toISOString(),
                };
              }
              return env;
            }),
          };
        });
      },

      // --- TEMPLATE ACTIONS (ADDED) ---
      saveTemplate: (name: string, distributions: Record<string, number>, note: string = "") => {
        const cleanDistributions: Record<string, number> = {};
        Object.entries(distributions).forEach(([envId, amount]) => {
            if (amount > 0) cleanDistributions[envId] = amount;
        });

        const newTemplate: DistributionTemplate = {
          id: uuidv4(),
          name,
          distributions: cleanDistributions,
          lastUsed: new Date().toISOString(),
          note: note
        };

        set((state) => ({
          distributionTemplates: [...state.distributionTemplates, newTemplate]
        }));
      },

      deleteTemplate: (id: string) => {
        set((state) => ({
          distributionTemplates: state.distributionTemplates.filter(t => t.id !== id)
        }));
      },

      // Data management actions
      resetData: () => {
        set({ envelopes: [], transactions: [], distributionTemplates: [] });
      },

      importData: (data: any) => {
        try {
          // 1. Basic Validation
          if (!data.envelopes || !data.transactions) {
            throw new Error("Invalid backup format: Missing core data.");
          }

          // 2. Process Envelopes (Convert dates)
          const newEnvelopes = data.envelopes.map((env: any) => ({
            ...env,
            lastUpdated: parseDate(env.lastUpdated),
            // Ensure numeric values are numbers
            currentBalance: Number(env.currentBalance),
            orderIndex: Number(env.orderIndex || 0)
          }));

          // 3. Process Transactions (Convert dates, ensure types)
          const newTransactions = data.transactions.map((tx: any) => ({
            ...tx,
            date: parseDate(tx.date),
            amount: Number(tx.amount),
            // Ensure IDs are present
            id: tx.id || uuidv4()
          }));

          // 4. Process Templates (Handle Swift Array format)
          const newTemplates = (data.distributionTemplates || []).map((t: any) => ({
            ...t,
            lastUsed: parseDate(t.lastUsed),
            distributions: parseDistributions(t.distributions || t.allocations) // Handle both naming conventions
          }));

          // 5. Apply to State
          set({
            envelopes: newEnvelopes,
            transactions: newTransactions,
            distributionTemplates: newTemplates
          });

          return { success: true, message: "Restored successfully!" };
        } catch (error) {
          console.error("Import failed:", error);
          return { success: false, message: "Failed to import data. Check file format." };
        }
      },
    }),
    {
      name: 'envelope-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);