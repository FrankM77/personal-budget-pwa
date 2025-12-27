import React, { useState, useEffect } from 'react';
import { PlusCircle, List as ListIcon, GitBranch, Wallet, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { DistributeFundsModal } from '../components/modals/DistributeFundsModal';
import { UserMenu } from '../components/ui/UserMenu';
import { useNavigate } from 'react-router-dom';

export const EnvelopeListView: React.FC = () => {
  const { envelopes, transactions, fetchData, isOnline, pendingSync, syncData, isLoading, getEnvelopeBalance, testingConnectivity } = useEnvelopeStore();
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const navigate = useNavigate();

  // Load data from Firebase on mount (only if no data exists)
  useEffect(() => {
    if (envelopes.length === 0) {
      fetchData();
    }
  }, []); // Empty dependency array - only run once on mount

  // Envelopes should already be sorted by orderIndex from the store/service
  // If not, sort by orderIndex first, then by name as fallback
  const sortedEnvelopes = [...envelopes].sort((a, b) => {
    const aOrder = a.orderIndex ?? 0;
    const bOrder = b.orderIndex ?? 0;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    return a.name.localeCompare(b.name);
  });

  // Calculate Total Balance dynamically from computed envelope balances
  console.log('🔄 EnvelopeListView render - calculating balances');
  console.log('📊 Current envelopes:', envelopes.length);
  console.log('💰 Current transactions:', transactions.length);

  const totalBalance = envelopes.reduce(
    (sum, env) => {
      const balance = getEnvelopeBalance(env.id!);
      console.log(`💵 Envelope ${env.name} (${env.id}): $${balance.toNumber().toFixed(2)}`);
      return sum + balance.toNumber();
    },
    0
  );

  console.log('💸 Total balance:', totalBalance);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Navbar */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          {/* Sync Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              isLoading ? (
                <div className="flex items-center gap-1 text-blue-500">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Syncing...</span>
                </div>
              ) : pendingSync ? (
                <button
                  onClick={syncData}
                  className="flex items-center gap-1 text-orange-500 hover:text-orange-600 transition-colors"
                  title="Sync pending - tap to sync"
                >
                  <RefreshCw size={16} />
                  <span className="text-sm font-medium">Sync</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 text-green-500">
                  <Wifi size={16} />
                  <span className="text-sm font-medium">Online</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1 text-gray-500">
                <WifiOff size={16} />
                <span className="text-sm font-medium">
                  {testingConnectivity
                    ? 'Testing Connection...'
                    : isLoading
                      ? 'Offline (Saving...)'
                      : 'Offline'
                  }
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/transactions')}
              className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Transaction History"
            >
              <ListIcon size={22} />
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Personal Budget</h1>
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
              {totalBalance < 0 ? '-' : ''}${Math.abs(totalBalance).toFixed(2)}
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
                      getEnvelopeBalance(env.id!).toNumber() < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-emerald-400'
                    }`}
                  >
                    {getEnvelopeBalance(env.id!).toNumber() < 0 ? '-' : ''}${Math.abs(getEnvelopeBalance(env.id!).toNumber()).toFixed(2)}
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