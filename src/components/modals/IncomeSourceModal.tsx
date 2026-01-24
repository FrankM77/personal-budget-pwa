import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetStore } from '../../stores/budgetStore';
import { useToastStore } from '../../stores/toastStore';
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
  const { addIncomeSource, updateIncomeSource, currentMonth } = useBudgetStore();
  const { showToast } = useToastStore();

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
      showToast('Please fill in all required fields with valid values', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'add') {
        await addIncomeSource(currentMonth, {
          name: name.trim(),
          amount: parseFloat(amount),
          month: currentMonth,
          userId: '', // Will be set by the store
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        showToast('Income source added successfully', 'success');
      } else {
        if (!initialIncomeSource) {
          showToast('Error: No income source to edit', 'error');
          return;
        }
        await updateIncomeSource(currentMonth, {
          ...initialIncomeSource,
          name: name.trim(),
          amount: parseFloat(amount),
          updatedAt: new Date().toISOString(),
        });
        showToast(`Updated "${name.trim()}" income source`, 'success');
      }

      onClose();
    } catch (error) {
      console.error('Error saving income source:', error);
      showToast('Failed to save income source. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-10"
          >
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
                    type="text"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, ''); // Strip non-digits
                      if (!rawValue) {
                        setAmount('');
                        return;
                      }
                      const cents = parseInt(rawValue, 10);
                      const dollars = (cents / 100).toFixed(2);
                      setAmount(dollars);
                    }}
                    placeholder="0.00"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default IncomeSourceModal;