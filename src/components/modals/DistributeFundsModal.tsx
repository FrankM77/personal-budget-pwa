import React, { useState, useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useEnvelopeStore } from '../../store/envelopeStore';

interface DistributeFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DistributeFundsModal: React.FC<DistributeFundsModalProps> = ({ isOpen, onClose }) => {
  const { envelopes, addToEnvelope } = useEnvelopeStore();
  
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [note, setNote] = useState<string>('');
  
  const activeEnvelopes = useMemo(() => 
    envelopes
      .filter(e => e.isActive)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)), 
  [envelopes]);

  const depositValue = parseFloat(depositAmount) || 0;
  
  const totalDistributed = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  }, [allocations]);

  const remainingAmount = depositValue - totalDistributed;
  const isValid = depositValue > 0 && Math.abs(remainingAmount) < 0.01;

  const handleAllocationChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    setAllocations(prev => ({
      ...prev,
      [id]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleApply = () => {
    if (!isValid) return;
    Object.entries(allocations).forEach(([id, amount]) => {
      if (amount > 0) {
        addToEnvelope(id, amount, note || 'Deposit', new Date());
      }
    });
    setDepositAmount('');
    setAllocations({});
    setNote('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-black sm:bg-gray-100 dark:sm:bg-black">
      {/* FIX: Applied Safe Area Padding Logic
        - Old: py-3
        - New: pt-[calc(env(safe-area-inset-top)+12px)] pb-3
      */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={onClose} className="text-blue-600 dark:text-blue-400 font-medium text-base">Cancel</button>
        <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Distribute Funds</h2>
        <button 
          onClick={handleApply}
          disabled={!isValid}
          className={`font-bold text-base ${
            isValid
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-300 dark:text-zinc-600'
          }`}
        >
          Apply
        </button>
      </header>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        
        {/* Sticky Summary Panel */}
        <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 shadow-sm p-4 space-y-4">
          
          {/* Deposit Input */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
            <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400 mb-1">Deposit Amount</label>
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mr-2">$</span>
              <input 
                type="number"
                inputMode="decimal" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="text-3xl font-bold text-black dark:text-white w-full focus:outline-none bg-white dark:bg-zinc-900 placeholder-gray-300 dark:placeholder-zinc-600 appearance-none"
                autoFocus
              />
            </div>
          </div>

          {/* Calculations */}
          <div className="flex justify-between items-center text-sm font-medium px-1">
            <div className="flex flex-col">
              <span className="text-gray-500 dark:text-zinc-400">Distributed</span>
              <span className="text-gray-900 dark:text-white">${totalDistributed.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-gray-500 dark:text-zinc-400">Remaining</span>
              <span
                className={`text-lg ${
                  remainingAmount === 0
                    ? 'text-green-600 dark:text-green-400'
                    : remainingAmount < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}
              >
                ${remainingAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Over-allocation Warning */}
          {remainingAmount < -0.01 && (
            <div className="flex items-center text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-100 dark:border-red-900">
              <AlertCircle className="w-4 h-4 mr-1" />
              You have over-allocated by ${Math.abs(remainingAmount).toFixed(2)}
            </div>
          )}

          {/* Note Input */}
          <input 
            type="text" 
            placeholder="Distribution Note (Optional)" 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-3 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-zinc-600"
          />
        </div>

        {/* Envelope Allocation List */}
        <div className="p-4 space-y-3">
          {activeEnvelopes.map((env) => {
            const currentAlloc = allocations[env.id] || 0;
            const percent = totalDistributed > 0 ? Math.round((currentAlloc / totalDistributed) * 100) : 0;

            return (
              <div key={env.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{env.name}</h3>
                    {currentAlloc > 0 && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        {percent}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-zinc-400">
                    Current: ${env.currentBalance.toFixed(2)}
                  </div>
                </div>

                <div className="w-32 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">$</span>
                  <input 
                    type="number"
                    inputMode="decimal"
                    value={allocations[env.id] === 0 ? '' : allocations[env.id]}
                    onChange={(e) => handleAllocationChange(env.id, e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-6 py-2 text-right bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none font-mono text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-zinc-600 appearance-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};