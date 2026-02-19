import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import type { Envelope } from '../models/types';

interface SplitTransactionHelperProps {
  envelopes: Envelope[];
  transactionAmount: number;
  onSplitChange: (splits: Record<string, number>) => void;
  initialSelectedEnvelopeId?: string | null;
}

export const SplitTransactionHelper: React.FC<SplitTransactionHelperProps> = ({
  envelopes,
  transactionAmount,
  onSplitChange,
  initialSelectedEnvelopeId
}) => {
  const { categories } = useBudgetStore();
  const [selectedEnvelopes, setSelectedEnvelopes] = useState<string[]>([]);
  const [hasAppliedInitial, setHasAppliedInitial] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select envelope from Siri pre-fill
  useEffect(() => {
    if (initialSelectedEnvelopeId && !hasAppliedInitial) {
      const exists = envelopes.some(e => e.id === initialSelectedEnvelopeId);
      if (exists) {
        setSelectedEnvelopes([initialSelectedEnvelopeId]);
        setHasAppliedInitial(true);
      }
    }
  }, [initialSelectedEnvelopeId, envelopes, hasAppliedInitial]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(transactionAmount);

  // Group envelopes by category (matching main page order)
  const groupedEnvelopes = useMemo(() => {
    const groups: { name: string; id: string; envelopes: Envelope[] }[] = [];
    const uncategorized: Envelope[] = [];

    const catMap: Record<string, Envelope[]> = {};
    categories.forEach(cat => { catMap[cat.id] = []; });

    envelopes.forEach(env => {
      if (env.categoryId && catMap[env.categoryId]) {
        catMap[env.categoryId].push(env);
      } else {
        uncategorized.push(env);
      }
    });

    categories
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .forEach(cat => {
        if (catMap[cat.id].length > 0) {
          groups.push({ name: cat.name, id: cat.id, envelopes: catMap[cat.id] });
        }
      });

    if (uncategorized.length > 0) {
      groups.push({ name: 'Other', id: 'uncategorized', envelopes: uncategorized });
    }

    return groups;
  }, [envelopes, categories]);

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

  const prevEnvelopeCount = React.useRef(selectedEnvelopes.length);

  useEffect(() => {
    if (selectedEnvelopes.length === 1) {
      // Single envelope: auto-assign the full amount
      const envelopeId = selectedEnvelopes[0];
      setSplitAmounts({ [envelopeId]: transactionAmount });
    } else if (selectedEnvelopes.length > 1 && prevEnvelopeCount.current <= 1) {
      // Transitioning from 0 or 1 envelope to multiple: reset all to 0
      const zeroed: Record<string, number> = {};
      selectedEnvelopes.forEach(id => { zeroed[id] = 0; });
      setSplitAmounts(zeroed);
    }
    prevEnvelopeCount.current = selectedEnvelopes.length;
  }, [selectedEnvelopes.length, selectedEnvelopes, transactionAmount]);

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

  // Prevent scroll from bubbling to parent on touch devices
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleTouchStart = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      // If at top, allow only downward scroll; if at bottom, allow only upward scroll
      if (scrollTop === 0) {
        el.scrollTop = 1;
      } else if (scrollTop + clientHeight >= scrollHeight) {
        el.scrollTop = scrollHeight - clientHeight - 1;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => el.removeEventListener('touchstart', handleTouchStart);
  }, []);

  const clearAll = () => {
    setSelectedEnvelopes([]);
    setSplitAmounts({});
  };

  const isValid = Math.abs(remaining) < 0.01 && selectedEnvelopes.length > 0;
  const hasError = selectedEnvelopes.length > 0 && Math.abs(remaining) > 0.01;

  return (
    <div className="space-y-3">
      {selectedEnvelopes.length > 1 && (
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
      
      <div
        ref={scrollRef}
        className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-800 overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      >
        {groupedEnvelopes.map((group) => (
          <div key={group.id}>
            {/* Category Header */}
            <div className="sticky top-0 z-10 px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                {group.name}
              </span>
            </div>

            {/* Envelopes in Category */}
            {group.envelopes.map(env => {
              const isSelected = selectedEnvelopes.includes(env.id);
              return (
                <div
                  key={env.id}
                  onClick={() => toggleEnvelopeSelection(env.id)}
                  className={`flex items-center py-3 px-3 border-b border-gray-100 dark:border-zinc-800 last:border-b-0 transition-colors cursor-pointer active:bg-gray-100 dark:active:bg-zinc-700 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mr-3 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600'
                      : 'border-gray-300 dark:border-zinc-600'
                  }`}>
                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className={`flex-1 text-sm ${
                    isSelected
                      ? 'text-blue-900 dark:text-blue-100 font-medium'
                      : 'text-gray-900 dark:text-white'
                  }`}>{env.name}</span>
                  
                  {isSelected && selectedEnvelopes.length > 1 && (
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <span className="mr-1 text-gray-500 dark:text-zinc-400 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={splitAmounts[env.id] ? splitAmounts[env.id].toFixed(2) : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/\D/g, ''); // Strip non-digits
                          if (!rawValue) {
                            handleSplitAmountChange(env.id, 0);
                            return;
                          }
                          const cents = parseInt(rawValue, 10);
                          const dollars = (cents / 100).toFixed(2);
                          handleSplitAmountChange(env.id, parseFloat(dollars));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                            e.preventDefault();
                          }
                        }}
                        className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
