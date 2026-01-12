import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FolderPlus, PiggyBank } from 'lucide-react';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';

export const AddEnvelopeView: React.FC = () => {
  const { addEnvelope } = useEnvelopeStore();
  const { setEnvelopeAllocation } = useMonthlyBudgetStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const isPiggybank = searchParams.get('type') === 'piggybank';
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Parse balance, default to 0 if empty
    const balanceValue = parseFloat(initialBalance);
    const finalBalance = isNaN(balanceValue) ? 0 : balanceValue;

    // Get next orderIndex (after last envelope)
    const envelopes = useEnvelopeStore.getState().envelopes;
    // Find the highest orderIndex and add 1
    const maxOrderIndex = envelopes.length > 0 ? Math.max(...envelopes.map(e => e.orderIndex ?? 0)) : -1;
    const nextOrderIndex = maxOrderIndex + 1;

    // Create the envelope or piggybank
    const envelopeData: any = {
      name,
      currentBalance: finalBalance,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isActive: true,
      orderIndex: nextOrderIndex
    };

    if (isPiggybank) {
      envelopeData.isPiggybank = true;
      envelopeData.piggybankConfig = {
        targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
        monthlyContribution: parseFloat(monthlyContribution || '0'),
        color,
        icon: 'piggy-bank'
      };
    }

    // Start envelope creation (optimistic update happens immediately)
    const envelopePromise = addEnvelope(envelopeData);
    
    // Chain allocation creation after envelope
    envelopePromise.then((newEnvelopeId) => {
      if (newEnvelopeId) {
        // Start allocation creation (optimistic update happens immediately)
        setEnvelopeAllocation(newEnvelopeId, 0).catch(err => 
          console.error('Failed to create allocation:', err)
        );
      }
    }).catch(err => {
      console.error('Failed to create envelope:', err);
    });
    
    // Small delay to ensure optimistic updates complete before navigation
    setTimeout(() => {
      navigate('/');
    }, 50);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-28">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate('/')} className="mr-3 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isPiggybank ? 'New Piggybank' : 'New Envelope'}</h1>
      </header>

      <div className="p-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 bg-blue-50 dark:bg-zinc-800 border-b border-blue-100 dark:border-zinc-700 flex justify-center py-8">
            <div className="w-20 h-20 bg-blue-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
              {isPiggybank ? <PiggyBank size={40} /> : <FolderPlus size={40} />}
            </div>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6 pb-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                {isPiggybank ? 'Piggybank Name' : 'Envelope Name'}
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isPiggybank ? 'e.g. Vacation Fund, Emergency Savings' : 'e.g. Groceries, Rent, Fun Money'}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                autoFocus
                required
              />
            </div>

            {/* Piggybank-specific fields */}
            {isPiggybank && (
              <>
                <div className="space-y-2">
                  <label htmlFor="monthly-contribution" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Monthly Auto-Contribution *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">$</span>
                    <input
                      type="number"
                      id="monthly-contribution"
                      value={monthlyContribution}
                      onChange={(e) => setMonthlyContribution(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      required={isPiggybank}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    This amount will be automatically added each month and deducted from Available to Budget
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="target-amount" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Target Goal (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">$</span>
                    <input
                      type="number"
                      id="target-amount"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    Set a savings goal to track progress
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Color
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { value: '#3B82F6', label: 'Blue' },
                      { value: '#10B981', label: 'Green' },
                      { value: '#F59E0B', label: 'Amber' },
                      { value: '#EF4444', label: 'Red' },
                      { value: '#8B5CF6', label: 'Purple' },
                      { value: '#EC4899', label: 'Pink' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setColor(option.value)}
                        className={`w-full aspect-square rounded-lg transition-all ${
                          color === option.value
                            ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-zinc-900'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: option.value }}
                        title={option.label}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Initial Balance Input */}
            <div className="space-y-2">
              <label htmlFor="balance" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Initial Deposit (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">$</span>
                <input
                  type="number"
                  id="balance"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-500">
                This creates an "Initial Deposit" income transaction. You can also add money later by editing the envelope budget on the main screen.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 font-semibold bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || (isPiggybank && !monthlyContribution)}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold shadow-sm text-white transition-colors ${
                  name.trim() && (!isPiggybank || monthlyContribution) ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' : 'bg-gray-300 dark:bg-zinc-600 cursor-not-allowed'
                }`}
              >
                {isPiggybank ? 'Create Piggybank' : 'Create Envelope'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
