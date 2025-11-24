import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion'; // <--- NEW IMPORT
import { useEnvelopeStore } from '../store/envelopeStore';
import { SwipeableRow } from '../components/ui/SwipeableRow'; // <--- NEW IMPORT
import EnvelopeTransactionRow from '../components/EnvelopeTransactionRow';
import TransactionModal from '../components/modals/TransactionModal';
import type { Transaction } from '../models/types';

export const TransactionHistoryView: React.FC = () => {
  const navigate = useNavigate();
  // Added deleteTransaction to the destructuring
  const { transactions, envelopes, updateTransaction, deleteTransaction } = useEnvelopeStore();
  
  // --- 1. Filter State (Matching Swift @State) ---
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [showReconciledOnly, setShowReconciledOnly] = useState(false);
  
  // Default Dates: Start = 1 month ago, End = Today
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // --- 2. Editing State ---
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // --- 3. The Filter Logic (Matching Swift Computed Property) ---
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // 1. Search Text (Description OR Envelope Name OR Amount)
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          const envName = envelopes.find(e => e.id === t.envelopeId)?.name.toLowerCase() || '';
          const amountStr = t.amount.toFixed(2);
          
          const matches = 
            t.description.toLowerCase().includes(searchLower) ||
            envName.includes(searchLower) ||
            amountStr.includes(searchLower);
            
          if (!matches) return false;
        }

        // 2. Envelope Filter
        if (selectedEnvelopeId !== 'all' && t.envelopeId !== selectedEnvelopeId) {
          return false;
        }

        // 3. Type Filter
        if (selectedType !== 'All' && t.type !== selectedType) {
          return false;
        }

        // 4. Date Range (Inclusive)
        const tDate = t.date.split('T')[0];
        if (tDate < startDate || tDate > endDate) {
          return false;
        }

        // 5. Reconciled Filter
        if (showReconciledOnly && !t.reconciled) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, envelopes, searchText, selectedEnvelopeId, selectedType, startDate, endDate, showReconciledOnly]);

  // Helper for Modal
  const activeEnvelope = editingTransaction 
    ? envelopes.find(e => e.id === editingTransaction.envelopeId) 
    : null;

  const handleReconcile = (transaction: Transaction) => {
    const updatedTx = { ...transaction, reconciled: !transaction.reconciled };
    updateTransaction(updatedTx);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20 transition-colors duration-200">
      {/* --- Header --- */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={() => navigate(-1)} 
            className="mr-3 text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Transactions</h1>
        </div>
        
        {/* Filter Toggle Button */}
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-full transition-colors ${
            showFilters 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' 
              : 'text-gray-400 dark:text-zinc-600 hover:bg-gray-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Filter size={20} className={showFilters ? 'fill-current' : ''} />
        </button>
      </header>

      {/* --- Collapsible Filter Panel --- */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 ${
          showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 space-y-4">
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
            />
            {searchText && (
              <button onClick={() => setSearchText('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Envelope Picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Envelope</label>
            <select
              value={selectedEnvelopeId}
              onChange={(e) => setSelectedEnvelopeId(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 border-r-8 border-transparent text-sm dark:text-white outline-none"
            >
              <option value="all">All Envelopes</option>
              {envelopes
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          {/* Segmented Control (Type) */}
          <div className="bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg flex">
            {(['All', 'Income', 'Expense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  selectedType === type
                    ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">From</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase">To</label>
              <div className="relative">
                 <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Reconciled Toggle */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Show only reconciled</span>
            <button
              onClick={() => setShowReconciledOnly(!showReconciledOnly)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                showReconciledOnly ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                showReconciledOnly ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Transaction List --- */}
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-zinc-500">
              No transactions match your filters.
            </div>
          ) : (
            // WRAPPER 1: AnimatePresence allows items to animate OUT when removed
            <AnimatePresence initial={false} mode="popLayout">
              {filteredTransactions.map((transaction) => {
                const env = envelopes.find(e => e.id === transaction.envelopeId);
                return (
                  // WRAPPER 2: Motion Div handles the collapse animation (height -> 0)
                  <motion.div
                    key={transaction.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* WRAPPER 3: SwipeableRow handles the gesture */}
                    <SwipeableRow onDelete={() => deleteTransaction(transaction.id)}>
                      <EnvelopeTransactionRow
                        transaction={transaction}
                        envelopeName={env?.name || 'Unknown Envelope'}
                        onReconcile={() => handleReconcile(transaction)}
                        onEdit={() => {
                          if (env) {
                            setEditingTransaction(transaction);
                          } else {
                            alert("Cannot edit: Envelope deleted.");
                          }
                        }}
                      />
                    </SwipeableRow>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* --- Edit Modal --- */}
      {editingTransaction && activeEnvelope && (
        <TransactionModal
          isVisible={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          mode="edit"
          currentEnvelope={activeEnvelope}
          initialTransaction={editingTransaction}
        />
      )}
    </div>
  );
};