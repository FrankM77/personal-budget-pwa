import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { SplitTransactionHelper } from '../components/SplitTransactionHelper';

export const AddTransactionView: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes, addTransaction } = useEnvelopeStore();

  // Form state
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

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
      // Create a transaction for each split
      const splitEntries = Object.entries(splitAmounts).filter(([_, amt]) => amt > 0);
      
      for (const [envelopeId, splitAmount] of splitEntries) {
        await addTransaction({
          amount: splitAmount,
          description: note,
          date: transactionDate.toISOString(),
          envelopeId,
          type: transactionType === 'income' ? 'Income' : 'Expense',
          reconciled: false
        });
      }

      // Navigate back to home
      navigate('/');
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Sort envelopes by orderIndex (creation order) with name as fallback
  const sortedEnvelopes = [...envelopes].sort((a, b) => {
    const aOrder = a.orderIndex ?? 0;
    const bOrder = b.orderIndex ?? 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  });

  const amountColor = transactionType === 'income' ? 'text-green-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-10 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
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

      <div className="p-4 max-w-md mx-auto">
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
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
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
