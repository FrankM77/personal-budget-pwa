import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useMonthlyBudgetStore } from '../../stores/monthlyBudgetStore';

interface DemoEnvelopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnvelopeCreated?: (envelopeId: string, envelopeName: string) => void;
}

export const DemoEnvelopeModal: React.FC<DemoEnvelopeModalProps> = ({
  isOpen,
  onClose,
  onEnvelopeCreated
}) => {
  const { setEnvelopeAllocation } = useMonthlyBudgetStore();
  
  const [envelopeName, setEnvelopeName] = useState('');
  const [budgetedAmount, setBudgetedAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!envelopeName.trim() || !budgetedAmount) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate a unique envelope ID
      const envelopeId = `env-${envelopeName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const amount = parseFloat(budgetedAmount) || 0;

      // Create the envelope allocation
      await setEnvelopeAllocation(envelopeId, amount);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        // Call the callback to notify parent
        if (onEnvelopeCreated) {
          onEnvelopeCreated(envelopeId, envelopeName.trim());
        }
        // Reset form
        setEnvelopeName('');
        setBudgetedAmount('');
      }, 1500);
    } catch (error) {
      console.error('Error creating envelope:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEnvelopeName('');
    setBudgetedAmount('');
    setShowSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Add New Envelope
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Success Message */}
          {showSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-300">
                Envelope created successfully!
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Envelope Name
              </label>
              <input
                type="text"
                value={envelopeName}
                onChange={(e) => setEnvelopeName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Groceries, Gas, Entertainment"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Budgeted Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={budgetedAmount}
                  onChange={(e) => setBudgetedAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !envelopeName.trim() || !budgetedAmount}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-zinc-700 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Envelope'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
