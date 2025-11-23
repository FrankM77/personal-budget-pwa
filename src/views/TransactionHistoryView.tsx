import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowDownCircle } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { formatCurrency } from '../utils/formatters';

const formatDateHeader = (isoDateString: string) => {
  const date = new Date(isoDateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const TransactionHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const { transactions, envelopes } = useEnvelopeStore();

  const groupedTransactions = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const groups: Record<string, typeof transactions> = {};
    
    sorted.forEach((tx) => {
      const dateKey = new Date(tx.date).toDateString(); 
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    });

    return groups;
  }, [transactions]);

  const getEnvelopeName = (id: string | null) => {
    if (!id) return 'Unallocated / Income';
    const env = envelopes.find((e) => e.id === id);
    return env ? env.name : 'Unknown Envelope';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col">
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 px-4 py-3 flex items-center sticky top-0 z-10 safe-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white ml-2">History</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-zinc-500">
            <div className="bg-gray-100 dark:bg-zinc-900 p-4 rounded-full mb-4">
              <ArrowDownCircle size={32} />
            </div>
            <p>No transactions yet.</p>
          </div>
        ) : (
          Object.keys(groupedTransactions).map((dateKey) => {
            const groupItems = groupedTransactions[dateKey];
            const headerLabel = formatDateHeader(groupItems[0].date);

            return (
              <div key={dateKey} className="mb-2">
                <div className="bg-gray-100 dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-gray-500 dark:text-zinc-400 sticky top-0 border-b border-gray-200/50 dark:border-zinc-800/60">
                  {headerLabel}
                </div>
                <div className="bg-white dark:bg-zinc-900 divide-y divide-gray-100 dark:divide-zinc-800 border-b border-gray-200 dark:border-zinc-800">
                  {groupItems.map((tx) => {
                    const isIncome = tx.amount > 0; 
                    return (
                      <div
                        key={tx.id}
                        className="px-4 py-3 flex items-center justify-between active:bg-gray-50 dark:active:bg-zinc-800 transition-colors"
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <span className="text-gray-900 dark:text-white font-medium truncate pr-4">
                            {tx.description || 'No Description'}
                          </span>
                          <div className="flex items-center text-xs text-gray-500 dark:text-zinc-400">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide mr-2 uppercase ${
                                tx.envelopeId
                                  ? 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'
                                  : 'bg-green-50 text-green-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              }`}
                            >
                              {getEnvelopeName(tx.envelopeId)}
                            </span>
                          </div>
                        </div>

                        <div className={`font-medium tabular-nums ${
                          isIncome ? 'text-green-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {isIncome ? '+' : ''}{formatCurrency(tx.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

// Also adding default export just in case App.tsx decides to switch styles
export default TransactionHistoryView;