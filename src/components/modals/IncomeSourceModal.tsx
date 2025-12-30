import React, { useState, useEffect } from 'react';
import { useMonthlyBudgetStore } from '../../stores/monthlyBudgetStore';
import type { IncomeSource } from '../../models/types';

interface IncomeSourceModalProps {
  isVisible: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  initialIncomeSource?: IncomeSource | null;
}

const IncomeSourceModal: React.FC<IncomeSourceModalProps> = ({
  isVisible,
  onClose,
  mode,
  initialIncomeSource
}) => {
  const { createIncomeSource, updateIncomeSource } = useMonthlyBudgetStore();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset or populate form when opening
  useEffect(() => {
    if (!isVisible) return;

    const timeoutId = window.setTimeout(() => {
      if (mode === 'edit' && initialIncomeSource) {
        setName(initialIncomeSource.name);
        setAmount(initialIncomeSource.amount.toString());
      } else {
        setName('');
        setAmount('');
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, mode, initialIncomeSource]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !amount || parseFloat(amount) <= 0) {
      return; // Basic validation
    }

    setIsSubmitting(true);

    try {
      if (mode === 'add') {
        await createIncomeSource({
          name: name.trim(),
          amount: parseFloat(amount),
        });
      } else if (mode === 'edit' && initialIncomeSource) {
        await updateIncomeSource(initialIncomeSource.id, {
          name: name.trim(),
          amount: parseFloat(amount),
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving income source:', error);
      // Error handling could be added here
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'add' ? 'Add Income Source' : 'Edit Income Source'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Income Source Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Primary Job, Freelance, Investments"
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-white"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-zinc-400">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-white"
                required
              />
            </div>
          </div>


          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !amount || parseFloat(amount) <= 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : (mode === 'add' ? 'Add Income' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomeSourceModal;