import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';

export const AddTransactionView: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes } = useEnvelopeStore();

  // Sort envelopes by orderIndex (same as main screen)
  const sortedEnvelopes = [...envelopes]
    .filter(e => e.isActive)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

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
        <div className="w-12" /> {/* Spacer for centering */}
      </header>

      <div className="p-4 max-w-md mx-auto">
        {/* SELECT ENVELOPE Section */}
        <section className="mb-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            {/* Section Header */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                SELECT ENVELOPE
              </h2>
            </div>

            {/* Envelope List */}
            {sortedEnvelopes.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
                <p>No envelopes available</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                {sortedEnvelopes.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => navigate(`/envelope/${env.id}`)}
                    className="w-full px-4 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {env.name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-zinc-400">
                        ${env.currentBalance.toFixed(2)}
                      </span>
                    </div>

                    <ChevronRight
                      size={20}
                      className="text-gray-400 dark:text-zinc-500"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};