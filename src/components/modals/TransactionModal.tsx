import React, { useState, useEffect } from 'react';
import { Trash, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBudgetStore } from '../../stores/budgetStore';
import type { Transaction, Envelope, PaymentSource } from '../../models/types';
import CardStack from '../ui/CardStack';
import { SplitTransactionHelper } from '../SplitTransactionHelper';
import '../../styles/CardStack.css';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  mode: 'add' | 'spend' | 'edit';
  currentEnvelope: Envelope;
  initialTransaction?: Transaction | null;
  envelopes?: Envelope[]; // Add envelopes prop for edit mode
}

const TransactionModal: React.FC<Props> = ({ isVisible, onClose, mode, currentEnvelope, initialTransaction, envelopes }) => {
  const { addTransaction, updateTransaction, deleteTransaction, currentMonth } = useBudgetStore();
  
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD for input
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentSource | null>(null);
  const [selectedEnvelope, setSelectedEnvelope] = useState<Envelope | null>(null);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  // Sort envelopes by orderIndex (creation order) with name as fallback
  // Only show active envelopes (filter out deleted ones)
  const sortedEnvelopes = envelopes ? [...envelopes]
    .filter(env => env.isActive !== false)
    .sort((a, b) => {
      const aOrder = a.orderIndex ?? 0;
      const bOrder = b.orderIndex ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    }) : [];

  // Reset or Populate when opening
  useEffect(() => {
    if (!isVisible) return;

    if (mode === 'edit' && initialTransaction) {
      setAmount(initialTransaction.amount.toString()); // Convert number to string
      setMerchant(initialTransaction.merchant || '');
      setNote(initialTransaction.description);
      setSelectedPaymentMethod(initialTransaction.paymentMethod || null);
      // Set selected envelope to the transaction's current envelope
      if (envelopes) {
        const transactionEnvelope = envelopes.find(e => e.id === initialTransaction.envelopeId);
        setSelectedEnvelope(transactionEnvelope || currentEnvelope);
        // Initialize splitAmounts with the full amount in the current envelope
        setSplitAmounts({ [initialTransaction.envelopeId]: initialTransaction.amount });
      }
      try {
        const d = new Date(initialTransaction.date);
        if (!isNaN(d.getTime())) {
          setDate(d.toISOString().split('T')[0]);
        } else {
          console.warn('Invalid date in transaction:', initialTransaction.date);
          setDate(new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Error parsing transaction date:', error);
        setDate(new Date().toISOString().split('T')[0]);
      }
    } else {
      setAmount('');
      setMerchant('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedEnvelope(currentEnvelope); // For add/spend modes, use current envelope
      setSplitAmounts({}); // Reset split amounts for add/spend modes
      // Don't forcefully nullify if we want to keep the default, 
      // but CardStack relies on null to trigger default selection.
      // With setTimeout removed, the race condition should be resolved.
    }
  }, [isVisible, mode, initialTransaction, currentEnvelope, envelopes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.log('❌ Invalid amount:', amount);
      return;
    }

    // For edit mode, check if we have split amounts
    const hasSplitTransactions = mode === 'edit' && Object.keys(splitAmounts).length > 0;
    
    console.log('💾 Saving transaction:', { mode, amount: numAmount, note, date, splitAmounts, paymentMethod: selectedPaymentMethod });

    try {
      // Validate date against current budget month
      const selectedDate = new Date(date);
      const selectedMonthStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (selectedMonthStr !== currentMonth) {
        const confirmMsg = `This transaction date (${selectedMonthStr}) does not match the current budget month (${currentMonth}). Are you sure you want to save it?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      if (mode === 'add') {
        console.log('➕ Adding income transaction');
        await addTransaction({
          amount: numAmount,
          description: note,
          merchant: merchant || undefined,
          date: new Date(date).toISOString(),
          envelopeId: (selectedEnvelope || currentEnvelope).id!,
          type: 'Income',
          reconciled: false,
          paymentMethod: selectedPaymentMethod || undefined
        });
      } else if (mode === 'spend') {
        console.log('➖ Adding expense transaction');
        await addTransaction({
          amount: numAmount,
          description: note,
          merchant: merchant || undefined,
          date: new Date(date).toISOString(),
          envelopeId: (selectedEnvelope || currentEnvelope).id!,
          type: 'Expense',
          reconciled: false,
          paymentMethod: selectedPaymentMethod || undefined
        });
      } else if (mode === 'edit' && initialTransaction) {
        console.log('✏️ Updating transaction');
        if (hasSplitTransactions) {
          // Handle split transaction - for now, just update the original transaction
          // In a future enhancement, we could delete the original and create new split transactions
          await updateTransaction({
            ...initialTransaction,
            amount: numAmount,
            description: note,
            merchant: merchant || undefined,
            date: new Date(date).toISOString(),
            envelopeId: Object.keys(splitAmounts)[0] || initialTransaction.envelopeId, // Use first split envelope
            paymentMethod: selectedPaymentMethod || undefined
          });
        } else {
          // Normal single envelope update
          await updateTransaction({
            ...initialTransaction,
            amount: numAmount,
            description: note,
            merchant: merchant || undefined,
            date: new Date(date).toISOString(),
            envelopeId: (selectedEnvelope || currentEnvelope).id!,
            paymentMethod: selectedPaymentMethod || undefined
          });
        }
      }
      console.log('✅ Transaction saved successfully');
      onClose();
    } catch (error) {
      console.error('❌ Error saving transaction:', error);
      alert('Failed to save transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = () => {
    if (!initialTransaction || !initialTransaction.id) return;

    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(initialTransaction.id);
      onClose();
    }
  };

  const title = mode === 'add' ? 'Add Money' : mode === 'spend' ? 'Spend Money' : 'Edit Transaction';
  const amountColor = mode === 'add' ? 'text-green-500' : 'text-red-500';

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-800">
              <button onClick={onClose} className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Cancel</button>
              <h2 className="text-gray-900 dark:text-white font-semibold text-lg">{title}</h2>
              <button 
                onClick={handleSubmit} 
                className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-bold disabled:opacity-50"
                disabled={!amount || parseFloat(amount) <= 0 || initialTransaction?.isAutomatic}
              >
                {initialTransaction?.isAutomatic ? '' : 'Save'}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Amount Input */}
              <div className="text-center">
                <label className="block text-sm text-gray-600 dark:text-zinc-400 mb-1">Amount</label>
                <div className="relative inline-block">
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-2xl ${amountColor}`}>$</span>
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
                    onKeyDown={(e) => {
                      if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="0.00"
                    autoFocus
                    disabled={initialTransaction?.isAutomatic}
                    className={`bg-transparent text-4xl font-bold text-center w-40 focus:outline-none ${amountColor} placeholder-gray-700 ${initialTransaction?.isAutomatic ? 'cursor-not-allowed opacity-80' : ''}`}
                  />
                </div>
              </div>

              {/* Merchant Input */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
                <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Merchant</label>
                <input
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Where did you make this transaction?"
                  className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  disabled={initialTransaction?.isAutomatic}
                />
              </div>

              {/* Payment Method - Hide for automatic transactions */}
              {!initialTransaction?.isAutomatic && (
                <CardStack
                  selectedCard={selectedPaymentMethod}
                  onCardSelect={setSelectedPaymentMethod}
                />
              )}

              {/* Note Input */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
                <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What is this for?"
                  className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  disabled={initialTransaction?.isAutomatic}
                />
              </div>

              {/* Date Input */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-gray-500 dark:text-zinc-400">Date</label>
                  {(() => {
                    const selectedDate = new Date(date);
                    const selectedMonthStr = `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    if (selectedMonthStr !== currentMonth) {
                      return (
                        <div className="flex items-center text-amber-500 gap-1" title="Date is outside current budget month">
                          <AlertTriangle size={14} />
                          <span className="text-[10px] font-bold uppercase">Budget Mismatch</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    console.log('Date changed to:', e.target.value);
                    setDate(e.target.value);
                  }}
                  required
                  disabled={initialTransaction?.isAutomatic}
                  className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none [color-scheme:dark] disabled:opacity-80"
                />
              </div>

              {/* Envelope Selection with Split Support - Only show in edit mode */}
              {mode === 'edit' && envelopes && (
                <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 transition-colors">
                  <SplitTransactionHelper
                    envelopes={sortedEnvelopes}
                    transactionAmount={parseFloat(amount) || 0}
                    onSplitChange={setSplitAmounts}
                    initialSelectedEnvelopeId={initialTransaction?.envelopeId}
                  />
                </div>
              )}

              {/* Delete Button - Only show in edit mode and NOT for automatic transactions */}
              {mode === 'edit' && !initialTransaction?.isAutomatic && (
                <div className="pt-4 border-t border-gray-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full py-3 px-4 rounded-lg bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition duration-150 flex items-center justify-center border border-gray-200 dark:border-zinc-800"
                  >
                    <Trash className="w-5 h-5 mr-2" />
                    Delete Transaction
                  </button>
                </div>
              )}

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TransactionModal;
