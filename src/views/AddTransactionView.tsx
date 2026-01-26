import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { SplitTransactionHelper } from '../components/SplitTransactionHelper';
import CardStack from '../components/ui/CardStack';
import type { PaymentSource } from '../models/types';
import '../styles/CardStack.css';

interface AddTransactionViewProps {
  onClose?: () => void;
  onSaved?: () => void;
}

export const AddTransactionView: React.FC<AddTransactionViewProps> = ({ onClose, onSaved }) => {
  const navigate = useNavigate();
  const { envelopes, addTransaction, currentMonth } = useBudgetStore();

  // Form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  // Initialize with LOCAL date string to ensure "today" is actually today for the user
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
  });
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentSource | null>(null);
  const [hasUserSelectedPayment, setHasUserSelectedPayment] = useState(false);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate(-1);
  };

  const handlePaymentMethodSelect = (card: PaymentSource) => {
    setSelectedPaymentMethod(card);
    // Only mark as user selected if we already have a payment method (meaning this is a manual change)
    if (selectedPaymentMethod) {
      setHasUserSelectedPayment(true);
    }
  };

  // Form validation
  const hasSplits = Object.keys(splitAmounts).length > 0;
  const totalSplit = Object.values(splitAmounts).reduce((sum, amt) => sum + (amt || 0), 0);
  const isSplitValid = Math.abs(totalSplit - parseFloat(amount || '0')) < 0.01;
  const isFormValid = amount && parseFloat(amount) > 0 && hasSplits && isSplitValid;

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    // Properly handle the date to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const transactionDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid timezone issues
    
    console.log('📅 Selected date:', date);
    console.log('📅 Parsed date:', transactionDate.toISOString());

    try {
      // Validate date against current budget month
      const [y, m] = date.split('-').map(Number);
      const selectedMonthStr = `${y}-${m.toString().padStart(2, '0')}`;
      
      if (selectedMonthStr !== currentMonth) {
        const confirmMsg = `This transaction date (${selectedMonthStr}) does not match the current budget month (${currentMonth}). Are you sure you want to save it?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      // Create a transaction for each split
      const splitEntries = Object.entries(splitAmounts).filter(([_, amt]) => amt > 0);
      
      // Fire-and-forget: Create transactions in background
      // The optimistic updates will show them immediately
      Promise.all(
        splitEntries.map(([envelopeId, splitAmount]) =>
          addTransaction({
            amount: splitAmount,
            description: note,
            merchant: merchant || undefined,
            date: transactionDate.toISOString(),
            envelopeId,
            type: transactionType === 'income' ? 'Income' : 'Expense',
            reconciled: false,
            paymentMethod: selectedPaymentMethod || undefined
          }).catch(err => console.error('Failed to create transaction:', err))
        )
      ).catch(err => console.error('Failed to create transactions:', err));

      // Navigate/close immediately - don't wait for Firebase
      if (onSaved) {
        onSaved();
      }
      if (onClose) {
        onClose();
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Sort envelopes by orderIndex (creation order) with name as fallback
  // Only show active envelopes (filter out deleted ones)
  const sortedEnvelopes = [...envelopes]
    .filter(env => env.isActive !== false)
    .sort((a, b) => {
      const aOrder = a.orderIndex ?? 0;
      const bOrder = b.orderIndex ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });

  const amountColor = transactionType === 'income' ? 'text-green-500' : 'text-red-500';

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 dark:bg-black overscroll-contain">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-2 sticky top-0 z-20 flex items-center justify-between">
        <button
          onClick={handleClose}
          className="text-blue-600 dark:text-blue-400 font-medium"
        >
          Cancel
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">New Transaction</h1>
        <button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="text-blue-600 dark:text-blue-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </header>

      <div className="p-4 max-w-4xl mx-auto pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type Toggle */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex">
              <button
                type="button"
                onClick={() => setTransactionType('expense')}
                className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
                  transactionType === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('income')}
                className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
                  transactionType === 'income'
                    ? 'bg-green-500 text-white'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                Income
              </button>
            </div>
          </div>

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
            onCardSelect={handlePaymentMethodSelect}
            isUserSelected={hasUserSelectedPayment}
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
                const [y, m] = date.split('-').map(Number);
                const selectedMonthStr = `${y}-${m.toString().padStart(2, '0')}`;
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
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Envelope Selection with Split Support */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 transition-colors">
            <SplitTransactionHelper
              envelopes={sortedEnvelopes}
              transactionAmount={parseFloat(amount) || 0}
              onSplitChange={setSplitAmounts}
            />
          </div>
        </form>
      </div>
    </div>
  );
};
