import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { useEnvelopeStore } from '../stores/envelopeStore';

export const AddEnvelopeView: React.FC = () => {
  const { addEnvelope } = useEnvelopeStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const handleSave = (e: React.FormEvent) => {
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

    addEnvelope({
      name,
      currentBalance: finalBalance,
      lastUpdated: new Date().toISOString(),
      isActive: true,
      orderIndex: nextOrderIndex
    } as any);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate('/')} className="mr-3 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">New Envelope</h1>
      </header>

      <div className="p-4 max-w-md mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 bg-blue-50 dark:bg-zinc-800 border-b border-blue-100 dark:border-zinc-700 flex justify-center py-8">
            <div className="w-20 h-20 bg-blue-100 dark:bg-zinc-700 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
              <FolderPlus size={40} />
            </div>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Envelope Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries, Rent, Fun Money"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                autoFocus
                required
              />
            </div>

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
                disabled={!name.trim()}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold shadow-sm text-white transition-colors ${
                  name.trim() ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' : 'bg-gray-300 dark:bg-zinc-600 cursor-not-allowed'
                }`}
              >
                Create Envelope
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
