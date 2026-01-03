import React, { useState, useEffect, useRef } from 'react';
import { useMonthlyBudgetStore } from '../../stores/monthlyBudgetStore';
import { useToastStore } from '../../stores/toastStore';
import type { EnvelopeAllocation } from '../../models/types';

interface EnvelopeAllocationModalProps {
  isVisible: boolean;
  onClose: () => void;
  initialAllocation?: EnvelopeAllocation | null;
  getEnvelopeName: (envelopeId: string) => string;
  onEnvelopeNameUpdate?: (envelopeId: string, newName: string) => void;
}

const EnvelopeAllocationModal: React.FC<EnvelopeAllocationModalProps> = ({
  isVisible,
  onClose,
  initialAllocation,
  getEnvelopeName,
  onEnvelopeNameUpdate
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const { setEnvelopeAllocation } = useMonthlyBudgetStore();
  const { showToast } = useToastStore();

  // Reset or populate form when opening
  useEffect(() => {
    if (!isVisible) return;

    const timeoutId = window.setTimeout(() => {
      if (initialAllocation) {
        setName(getEnvelopeName(initialAllocation.envelopeId));
        setAmount(initialAllocation.budgetedAmount.toString());
      } else {
        setName('');
        setAmount('');
      }

      // Auto-focus the amount input after the form is populated
      setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      }, 100);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, initialAllocation, getEnvelopeName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !amount || parseFloat(amount) <= 0) {
      return; // Basic validation
    }

    setIsSubmitting(true);

    try {
      if (initialAllocation) {
        // Update the envelope name if it changed
        if (name.trim() !== getEnvelopeName(initialAllocation.envelopeId)) {
          onEnvelopeNameUpdate?.(initialAllocation.envelopeId, name.trim());
        }

        // Update the allocation amount using the proper store method
        const newAmount = parseFloat(amount);
        await setEnvelopeAllocation(initialAllocation.envelopeId, newAmount);

        // Show success message
        showToast(`Budget updated to $${newAmount.toFixed(2)}`, 'success');
      }

      onClose();
    } catch (error) {
      console.error('Error saving envelope allocation:', error);
      showToast('Failed to save budget amount', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Set Budget Amount
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
          {/* Envelope Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Envelope Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries, Gas, Entertainment"
              className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-white"
              required
            />
          </div>

          {/* Budgeted Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
              Budgeted Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-zinc-400">
                $
              </span>
              <input
                ref={amountInputRef}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800 dark:text-white"
                required
                autoComplete="off"
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
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnvelopeAllocationModal;
