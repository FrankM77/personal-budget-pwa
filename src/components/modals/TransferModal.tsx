import React, { useState, useEffect } from 'react';
import { useBudgetStore } from '../../stores/budgetStore';
import type { Envelope } from '../../models/types';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  sourceEnvelope: Envelope;
}

const TransferModal: React.FC<Props> = ({ isVisible, onClose, sourceEnvelope }) => {
  const { envelopes, transferFunds } = useBudgetStore();
  
  const [targetEnvelopeId, setTargetEnvelopeId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD for input

  // Filter out the source envelope so you can't transfer to self
  const availableEnvelopes = envelopes.filter(env => env.id !== sourceEnvelope.id);

  // Reset when opening (deferred to avoid synchronous setState in effect)
  useEffect(() => {
    if (!isVisible) return undefined;

    const timeoutId = window.setTimeout(() => {
      setTargetEnvelopeId('');
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isVisible]);

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !targetEnvelopeId) return;

    transferFunds(sourceEnvelope.id, targetEnvelopeId, numAmount, note, new Date(date));
    onClose();
  };

  const targetEnvelope = envelopes.find(env => env.id === targetEnvelopeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-zinc-800">
          <button onClick={onClose} className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Cancel</button>
          <h2 className="text-gray-900 dark:text-white font-semibold text-lg">Transfer Money</h2>
          <button 
            onClick={handleSubmit} 
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 font-bold disabled:opacity-50"
            disabled={!amount || parseFloat(amount) <= 0 || !targetEnvelopeId}
          >
            Transfer
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* From Envelope (Read-only display) */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">From</label>
            <div className="text-gray-900 dark:text-white font-medium">{sourceEnvelope.name}</div>
          </div>

          {/* To Envelope (Dropdown) */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">To</label>
            <select 
              value={targetEnvelopeId}
              onChange={(e) => setTargetEnvelopeId(e.target.value)}
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-zinc-900">Select envelope...</option>
              {availableEnvelopes.map(env => (
                <option key={env.id} value={env.id} className="bg-white dark:bg-zinc-900">
                  {env.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div className="text-center">
            <label className="block text-sm text-gray-600 dark:text-zinc-400 mb-1">Amount</label>
            <div className="relative inline-block">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-2xl text-blue-600 dark:text-blue-400">$</span>
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
                className="bg-transparent text-4xl font-bold text-center w-40 focus:outline-none text-blue-600 dark:text-blue-400 placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>
          </div>

          {/* Note Input */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Note (Optional)</label>
            <input 
              type="text" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What is this transfer for?"
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

          {/* Preview (optional - shows where money is going) */}
          {targetEnvelope && amount && parseFloat(amount) > 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-200 dark:border-zinc-800">
              Moving <span className="text-blue-600 dark:text-blue-400 font-bold">${parseFloat(amount).toFixed(2)}</span> from{' '}
              <span className="text-gray-900 dark:text-white font-medium">{sourceEnvelope.name}</span> to{' '}
              <span className="text-gray-900 dark:text-white font-medium">{targetEnvelope.name}</span>
            </div>
          )}

        </form>
      </div>
    </div>
  );
};

export default TransferModal;

