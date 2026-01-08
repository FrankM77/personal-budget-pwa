import React, { useState, useEffect } from 'react';
import type { Envelope } from '../models/types';

interface SplitTransactionHelperProps {
  envelopes: Envelope[];
  transactionAmount: number;
  onSplitChange: (splits: Record<string, number>) => void;
}

export const SplitTransactionHelper: React.FC<SplitTransactionHelperProps> = ({
  envelopes,
  transactionAmount,
  onSplitChange
}) => {
  const [selectedEnvelopes, setSelectedEnvelopes] = useState<string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(transactionAmount);

  const toggleEnvelopeSelection = (envelopeId: string) => {
    setSelectedEnvelopes(prev => {
      if (prev.includes(envelopeId)) {
        return prev.filter(id => id !== envelopeId);
      } else {
        return [...prev, envelopeId];
      }
    });
  };

  const handleSplitAmountChange = (envelopeId: string, amount: number) => {
    setSplitAmounts(prev => ({
      ...prev,
      [envelopeId]: amount
    }));
  };

  useEffect(() => {
    // Calculate remaining amount
    const totalSplit = Object.values(splitAmounts).reduce((sum, amount) => sum + (amount || 0), 0);
    setRemaining(transactionAmount - totalSplit);
    
    // Notify parent of current splits
    onSplitChange(splitAmounts);
  }, [splitAmounts, transactionAmount, onSplitChange]);

  useEffect(() => {
    // Clean up split amounts when envelope is deselected
    const newSplitAmounts = { ...splitAmounts };
    Object.keys(newSplitAmounts).forEach(id => {
      if (!selectedEnvelopes.includes(id)) {
        delete newSplitAmounts[id];
      }
    });
    if (Object.keys(newSplitAmounts).length !== Object.keys(splitAmounts).length) {
      setSplitAmounts(newSplitAmounts);
    }
  }, [selectedEnvelopes, splitAmounts]);

  const clearAll = () => {
    setSelectedEnvelopes([]);
    setSplitAmounts({});
  };

  const isValid = Math.abs(remaining) < 0.01 && selectedEnvelopes.length > 0;
  const hasError = selectedEnvelopes.length > 0 && Math.abs(remaining) > 0.01;

  return (
    <div className="space-y-3">
      {selectedEnvelopes.length > 0 && (
        <div className={`p-3 rounded-lg ${
          hasError 
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
            : isValid 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700'
        }`}>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-zinc-400">Remaining to Split:</span>
            <span className={`font-bold text-lg ${
              hasError 
                ? 'text-red-600 dark:text-red-400' 
                : isValid 
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-white'
            }`}>
              ${remaining.toFixed(2)}
            </span>
          </div>
          {hasError && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Split amounts must equal transaction total
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <label className="text-xs text-gray-500 dark:text-zinc-400">
          {selectedEnvelopes.length > 1 ? 'Split Across Envelopes' : 'Select Envelope'}
        </label>
        {selectedEnvelopes.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-blue-600 dark:text-blue-400"
          >
            Clear All
          </button>
        )}
      </div>
      
      <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded-lg">
        {envelopes.map(env => (
          <div 
            key={env.id} 
            className="flex items-center py-3 px-3 border-b border-gray-100 dark:border-zinc-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedEnvelopes.includes(env.id)}
              onChange={() => toggleEnvelopeSelection(env.id)}
              className="mr-3 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="flex-1 text-gray-900 dark:text-white">{env.name}</span>
            
            {selectedEnvelopes.includes(env.id) && (
              <div className="flex items-center">
                <span className="mr-1 text-gray-500 dark:text-zinc-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitAmounts[env.id] || ''}
                  onChange={(e) => handleSplitAmountChange(env.id, parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
