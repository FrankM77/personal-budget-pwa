import React, { useState } from 'react';
import { PlusCircle, Settings, List as ListIcon, Share, GitBranch, Wallet } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { DistributeFundsModal } from '../components/modals/DistributeFundsModal';
import { useNavigate } from 'react-router-dom';

export const EnvelopeListView: React.FC = () => {
  const { envelopes } = useEnvelopeStore();
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const navigate = useNavigate();

  // Sort envelopes by orderIndex
  const sortedEnvelopes = [...envelopes].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  // Calculate Total Balance dynamically from current envelope balances
  const totalBalance = envelopes.reduce(
    (sum, env) => sum + env.currentBalance,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Navbar */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 z-10">
        <div className="flex justify-end gap-4 text-blue-500">
          <button onClick={() => navigate('/transactions')}>
            <ListIcon size={22} />
          </button>
          <button onClick={() => navigate('/settings')}>
            <Settings size={22} />
          </button>
          <button onClick={() => alert('Export coming soon')}>
            <Share size={22} />
          </button>
        </div>

        <div className="mt-4">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">House Expenses</h1>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* Section 1: Total Balance & Distribute Button */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-zinc-400 font-medium">Total Balance</span>
            <span
              className={`text-2xl font-bold ${
                totalBalance >= 0
                  ? 'text-green-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              ${totalBalance.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setIsDistributeOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 py-3 rounded-xl font-semibold active:bg-blue-100 dark:active:bg-blue-900/60 transition-colors"
          >
            <GitBranch size={20} className="rotate-90" />
            Distribute Funds
          </button>
        </section>

        {/* Section 2: Envelope List */}
        <section>
          {sortedEnvelopes.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Wallet className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto" />
              <h3 className="text-gray-500 dark:text-zinc-400 font-medium">No envelopes yet</h3>
              <button
                onClick={() => navigate('/add-envelope')}
                className="text-blue-600 dark:text-blue-300 font-medium"
              >
                Create First Envelope
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* List Header */}
              <div className="flex justify-between items-end px-1">
                <h2 className="text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                  My Envelopes
                </h2>
                <button
                  className="text-sm text-blue-600 dark:text-blue-300 font-medium"
                  onClick={() => navigate('/add-envelope')}
                >
                  + New Envelope
                </button>
              </div>

              {/* List Items */}
              {sortedEnvelopes.map((env) => (
                <div
                  key={env.id}
                  onClick={() => navigate(`/envelope/${env.id}`)}
                  className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex justify-between items-center active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {env.name}
                    </span>
                  </div>

                  <span
                    className={`font-bold ${
                      env.currentBalance < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-emerald-400'
                    }`}
                  >
                    ${env.currentBalance.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Global Floating Action Button */}
      <button
        onClick={() => navigate('/add-transaction')}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-transform"
      >
        <PlusCircle size={28} />
      </button>

      {/* Modals */}
      <DistributeFundsModal
        isOpen={isDistributeOpen}
        onClose={() => setIsDistributeOpen(false)}
      />
    </div>
  );
};