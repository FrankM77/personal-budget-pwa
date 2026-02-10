import { BudgetService } from '../services/budgetService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { Envelope } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();

// Helper to require an authenticated user (throws if not logged in)
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};

export const createEnvelopeSlice = ({ set, get }: SliceParams) => ({
    addEnvelope: async (envelope: Omit<Envelope, 'id'>): Promise<string> => {
        try {
            set({ isLoading: true, error: null });
            
            const currentUser = requireAuth();
            
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
            
            logger.log('✅ Added envelope:', createdEnvelope.id);
            return createdEnvelope.id;
            
        } catch (error) {
            logger.error('❌ addEnvelope failed:', error);
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
            
            const currentUser = requireAuth();
            
            // Update in backend
            await budgetService.updateEnvelope(currentUser.id, envelope);
            
            // Update local state
            set(state => ({
                envelopes: state.envelopes.map(env => 
                    env.id === envelope.id ? envelope : env
                ),
                isLoading: false
            }));
            
            logger.log('✅ Updated envelope:', envelope.id);
            
        } catch (error) {
            logger.error('❌ updateEnvelope failed:', error);
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
            
            const currentUser = requireAuth();
            
            // Delete from backend
            await budgetService.deleteEnvelope(currentUser.id, envelopeId);
            
            // Update local state (also remove associated transactions)
            set(state => ({
                envelopes: state.envelopes.filter(env => env.id !== envelopeId),
                transactions: state.transactions.filter(tx => tx.envelopeId !== envelopeId),
                isLoading: false
            }));
            
            logger.log('✅ Deleted envelope:', envelopeId);
            
        } catch (error) {
            logger.error('❌ deleteEnvelope failed:', error);
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

            const currentUser = requireAuth();
            
            // Update in backend
            await budgetService.reorderEnvelopes(currentUser.id, changedEnvelopes);
            
            // Update local state
            set({
                envelopes: updatedEnvelopes,
                isLoading: false
            });
            
            logger.log('✅ Reordered envelopes');
            
        } catch (error) {
            logger.error('❌ reorderEnvelopes failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to reorder envelopes' 
            });
            throw error;
        }
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

            const currentUser = requireAuth();
            
            const updatedEnvelope = { ...envelope, name: newName };
            await budgetService.updateEnvelope(currentUser.id, updatedEnvelope);
            
            set({ isLoading: false });
            logger.log('✅ Renamed envelope:', envelopeId);
            
        } catch (error) {
            logger.error('❌ renameEnvelope failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to rename envelope' 
            });
            throw error;
        }
    },

    removeEnvelopeFromMonth: async (envelopeId: string, month: string) => {
        try {
            set({ isLoading: true, error: null });
            logger.log(`🗑️ Removing envelope ${envelopeId} from month ${month}`);

            const state = get();
            
            // 1. Delete Allocation for this month
            const allocation = state.allocations[month]?.find(a => a.envelopeId === envelopeId);
            if (allocation) {
                await get().deleteEnvelopeAllocation(allocation.id);
            } else {
                logger.log(`⚠️ No allocation found for envelope ${envelopeId} in ${month}`);
            }

            // 2. Delete Transactions for this month
            const transactionsToDelete = state.transactions.filter(t => 
                t.envelopeId === envelopeId && 
                (t.month === month || t.date.startsWith(month))
            );

            if (transactionsToDelete.length > 0) {
                logger.log(`🗑️ Deleting ${transactionsToDelete.length} transactions for envelope ${envelopeId} in ${month}`);
                
                // Execute deletions in parallel
                await Promise.all(transactionsToDelete.map(tx => get().deleteTransaction(tx.id)));
            }

            // 3. DO NOT delete the global envelope definition
            // The envelope remains in 'state.envelopes' but will be hidden from the month view
            // because it no longer has an allocation or transactions in this month.

            set({ isLoading: false });
            logger.log(`✅ Removed envelope ${envelopeId} from month ${month}`);

        } catch (error) {
            logger.error(`❌ removeEnvelopeFromMonth failed:`, error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to remove envelope from month' 
            });
            throw error;
        }
    },

    updatePiggybankContribution: async (envelopeId: string, newAmount: number): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            logger.log('🔧 Updating piggybank contribution:', { envelopeId, newAmount });
            
            const currentUser = requireAuth();
            
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
            
            logger.log('📤 Updating envelope in Firestore:', updatedEnvelope);
            await budgetService.updateEnvelope(currentUser.id, updatedEnvelope);
            logger.log('✅ Envelope updated successfully');
            
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
                            logger.warn('⚠️ Piggybank contribution transaction not found after update');
                        }
                    }, 1000);
                } catch (error) {
                    logger.error('❌ Failed to update piggybank contribution:', error);
                }
            }
            
            logger.log('✅ Piggybank contribution updated successfully');
            
        } catch (error) {
            logger.error('❌ updatePiggybankContribution failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to update piggybank contribution' 
            });
            throw error;
        }
    },
});
