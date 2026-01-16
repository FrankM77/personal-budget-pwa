import React, { useState, useEffect } from 'react';
import { Trash, AlertTriangle } from 'lucide-react';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../../stores/monthlyBudgetStore';
import type { Transaction, Envelope } from '../../models/types';
import CardStack from '../ui/CardStack';
import type { PaymentSource } from '../ui/CardStack';
import '../../styles/CardStack.css';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  mode: 'add' | 'spend' | 'edit';
  currentEnvelope: Envelope;
  initialTransaction?: Transaction | null;
}

const TransactionModal: React.FC<Props> = ({ isVisible, onClose, mode, currentEnvelope, initialTransaction }) => {
  const { addTransaction, updateTransaction, deleteTransaction } = useEnvelopeStore();
  const { currentMonth } = useMonthlyBudgetStore();
  
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD for input
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentSource | null>(null);

  // Reset or Populate when opening (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    if (!isVisible) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (mode === 'edit' && initialTransaction) {
        setAmount(initialTransaction.amount.toString()); // Convert number to string
        setMerchant(initialTransaction.merchant || '');
        setNote(initialTransaction.description);
        setSelectedPaymentMethod(initialTransaction.paymentMethod || null);
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
        setSelectedPaymentMethod(null);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, mode, initialTransaction]);

  if (!isVisible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      console.log('❌ Invalid amount:', amount);
      return;
    }

    console.log('💾 Saving transaction:', { mode, amount: numAmount, note, date, envelopeId: currentEnvelope.id, paymentMethod: selectedPaymentMethod });

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
          envelopeId: currentEnvelope.id!,
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
          envelopeId: currentEnvelope.id!,
          type: 'Expense',
          reconciled: false,
          paymentMethod: selectedPaymentMethod || undefined
        });
      } else if (mode === 'edit' && initialTransaction) {
        console.log('✏️ Updating transaction');
        await updateTransaction({
          ...initialTransaction,
          amount: numAmount,
          description: note,
          merchant: merchant || undefined,
          date: new Date(date).toISOString(),
          paymentMethod: selectedPaymentMethod || undefined
        });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-800">
          <button onClick={onClose} className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Cancel</button>
          <h2 className="text-gray-900 dark:text-white font-semibold text-lg">{title}</h2>
          <button 
            onClick={handleSubmit} 
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-bold disabled:opacity-50"
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Save
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Amount Input */}
          <div className="text-center">
            <label className="block text-sm text-gray-600 dark:text-zinc-400 mb-1">Amount</label>
            <div className="relative inline-block">
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-2xl ${amountColor}`}>$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Ensure we don't set invalid values
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setAmount(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                placeholder="0.00"
                autoFocus
                className={`bg-transparent text-4xl font-bold text-center w-40 focus:outline-none ${amountColor} placeholder-gray-700`}
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
            />
          </div>

          {/* Payment Method */}
          <CardStack
            selectedCard={selectedPaymentMethod}
            onCardSelect={setSelectedPaymentMethod}
          />

          {/* Note Input */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What is this for?"
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
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
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Delete Button - Only show in edit mode */}
          {mode === 'edit' && (
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
      </div>
    </div>
  );
};

export default TransactionModal;