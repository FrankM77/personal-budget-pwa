import React, { useState, useEffect } from 'react';
import { Trash } from 'lucide-react';
import { useEnvelopeStore } from '../../store/envelopeStore';
import type { Transaction, Envelope } from '../../models/types';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  mode: 'add' | 'spend' | 'edit';
  currentEnvelope: Envelope;
  initialTransaction?: Transaction | null;
}

const TransactionModal: React.FC<Props> = ({ isVisible, onClose, mode, currentEnvelope, initialTransaction }) => {
  const { addToEnvelope, spendFromEnvelope, updateTransaction, deleteTransaction } = useEnvelopeStore();
  
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD for input

  // Reset or Populate when opening (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    if (!isVisible) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (mode === 'edit' && initialTransaction) {
        setAmount(initialTransaction.amount.toString());
        setNote(initialTransaction.description);
        const d = new Date(initialTransaction.date);
        setDate(d.toISOString().split('T')[0]);
      } else {
        setAmount('');
        setNote('');
        setDate(new Date().toISOString().split('T')[0]);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible, mode, initialTransaction]);

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (mode === 'add') {
      addToEnvelope(currentEnvelope.id, numAmount, note, new Date(date));
    } else if (mode === 'spend') {
      spendFromEnvelope(currentEnvelope.id, numAmount, note, new Date(date));
    } else if (mode === 'edit' && initialTransaction) {
      updateTransaction({
        ...initialTransaction,
        amount: numAmount,
        description: note,
        date: new Date(date).toISOString(),
        // If editing, we might need to re-evaluate type if the user changes logic, 
        // but for now let's keep the original type or derive it.
        // Simplified: keep original type unless swapping logic is added.
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!initialTransaction) return;
    
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
                onChange={(e) => setAmount(e.target.value)}
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