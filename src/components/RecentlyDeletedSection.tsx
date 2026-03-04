import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { BudgetService } from '../services/budgetService';
import type { Envelope, IncomeSource, Transaction } from '../models/types';
import logger from '../utils/logger';

const budgetService = BudgetService.getInstance();

export const RecentlyDeletedSection: React.FC = () => {
  const { currentUser } = useAuthStore();
  const { currentMonth } = useBudgetStore();
  const { showToast } = useToastStore();
  
  const [deletedEnvelopes, setDeletedEnvelopes] = useState<Envelope[]>([]);
  const [deletedIncomeSources, setDeletedIncomeSources] = useState<IncomeSource[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch deleted items
  useEffect(() => {
    const fetchDeletedItems = async () => {
      if (!currentUser) return;
      
      try {
        setIsLoading(true);
        const [envelopes, incomeSources, transactions] = await Promise.all([
          budgetService.getDeletedEnvelopes(currentUser.id),
          budgetService.getDeletedIncomeSources(currentUser.id, currentMonth),
          budgetService.getDeletedTransactions(currentUser.id, currentMonth)
        ]);
        
        setDeletedEnvelopes(envelopes);
        setDeletedIncomeSources(incomeSources);
        setDeletedTransactions(transactions);
      } catch (error) {
        logger.error('Failed to fetch deleted items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeletedItems();
  }, [currentUser, currentMonth]);

  const handleRestoreEnvelope = async (envelope: Envelope) => {
    if (!currentUser) return;
    
    try {
      await budgetService.restoreEnvelope(currentUser.id, envelope.id);
      setDeletedEnvelopes(prev => prev.filter(e => e.id !== envelope.id));
      
      // Refresh the main envelopes list
      const envelopes = await budgetService.getEnvelopes(currentUser.id);
      useBudgetStore.setState({ envelopes });
      
      showToast(`Restored "${envelope.name}"`, 'success');
    } catch (error) {
      logger.error('Failed to restore envelope:', error);
      showToast('Failed to restore envelope', 'error');
    }
  };

  const handleRestoreIncomeSource = async (source: IncomeSource) => {
    if (!currentUser) return;
    
    try {
      await budgetService.restoreIncomeSource(currentUser.id, source.id, source.month);
      setDeletedIncomeSources(prev => prev.filter(s => s.id !== source.id));
      
      // Refresh the income sources for this month
      const monthData = await budgetService.getMonthData(currentUser.id, source.month);
      useBudgetStore.setState(state => ({
        incomeSources: {
          ...state.incomeSources,
          [source.month]: monthData.incomeSources
        }
      }));
      
      showToast(`Restored "${source.name}"`, 'success');
    } catch (error) {
      logger.error('Failed to restore income source:', error);
      showToast('Failed to restore income source', 'error');
    }
  };

  const handleRestoreTransaction = async (transaction: Transaction) => {
    if (!currentUser) return;
    
    try {
      await budgetService.restoreTransaction(currentUser.id, transaction.id);
      setDeletedTransactions(prev => prev.filter(t => t.id !== transaction.id));
      
      // Refresh transactions for this month
      await useBudgetStore.getState().fetchMonthData(currentMonth);
      
      showToast(`Restored transaction`, 'success');
    } catch (error) {
      logger.error('Failed to restore transaction:', error);
      showToast('Failed to restore transaction', 'error');
    }
  };

  const handlePermanentDelete = async (type: 'envelope' | 'income' | 'transaction', id: string, name: string, month?: string) => {
    if (!currentUser) return;
    
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    
    try {
      if (type === 'envelope') {
        await budgetService.permanentlyDeleteEnvelope(currentUser.id, id);
        setDeletedEnvelopes(prev => prev.filter(e => e.id !== id));
      } else if (type === 'income') {
        await budgetService.permanentlyDeleteIncomeSource(currentUser.id, id, month!);
        setDeletedIncomeSources(prev => prev.filter(s => s.id !== id));
      } else {
        await budgetService.permanentlyDeleteTransaction(currentUser.id, id);
        setDeletedTransactions(prev => prev.filter(t => t.id !== id));
      }
      
      showToast(`Permanently deleted "${name}"`, 'success');
    } catch (error) {
      logger.error('Failed to permanently delete:', error);
      showToast('Failed to permanently delete', 'error');
    }
  };

  const getDaysDeleted = (deletedAt: string) => {
    const days = Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const totalDeleted = deletedEnvelopes.length + deletedIncomeSources.length + deletedTransactions.length;

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (totalDeleted === 0) {
    return (
      <div className="p-4 text-center">
        <AlertCircle className="mx-auto mb-2 text-gray-400 dark:text-zinc-500" size={32} />
        <p className="text-sm text-gray-500 dark:text-zinc-400">No recently deleted items</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Deleted items are kept for 30 days</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Deleted Envelopes */}
      {deletedEnvelopes.map(envelope => {
        const daysDeleted = getDaysDeleted(envelope.deletedAt!);
        const daysRemaining = 30 - daysDeleted;
        
        return (
          <div
            key={envelope.id}
            className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{envelope.name}</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  {envelope.isPiggybank ? 'Piggybank' : 'Envelope'} • Deleted {daysDeleted}d ago • {daysRemaining}d remaining
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestoreEnvelope(envelope)}
                className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
              >
                <RotateCcw size={12} />
                Restore
              </button>
              <button
                onClick={() => handlePermanentDelete('envelope', envelope.id, envelope.name)}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={12} />
                Delete Forever
              </button>
            </div>
          </div>
        );
      })}

      {/* Deleted Transactions */}
      {deletedTransactions.map(transaction => {
        const daysDeleted = getDaysDeleted(transaction.deletedAt!);
        const daysRemaining = 30 - daysDeleted;
        const label = transaction.merchant || transaction.description || 'Transaction';
        
        return (
          <div
            key={transaction.id}
            className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{label}</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Transaction • ${Math.abs(transaction.amount).toFixed(2)} • Deleted {daysDeleted}d ago • {daysRemaining}d remaining
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestoreTransaction(transaction)}
                className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
              >
                <RotateCcw size={12} />
                Restore
              </button>
              <button
                onClick={() => handlePermanentDelete('transaction', transaction.id, label)}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={12} />
                Delete Forever
              </button>
            </div>
          </div>
        );
      })}

      {/* Deleted Income Sources */}
      {deletedIncomeSources.map(source => {
        const daysDeleted = getDaysDeleted(source.deletedAt!);
        const daysRemaining = 30 - daysDeleted;
        
        return (
          <div
            key={source.id}
            className="p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg border border-gray-200 dark:border-zinc-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{source.name}</h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400">
                  Income Source ({source.month}) • ${source.amount.toFixed(2)} • Deleted {daysDeleted}d ago • {daysRemaining}d remaining
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestoreIncomeSource(source)}
                className="flex-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
              >
                <RotateCcw size={12} />
                Restore
              </button>
              <button
                onClick={() => handlePermanentDelete('income', source.id, source.name, source.month)}
                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 size={12} />
                Delete Forever
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
