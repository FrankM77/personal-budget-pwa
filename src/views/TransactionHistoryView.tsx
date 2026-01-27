import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Filter, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion'; 
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore'; 
import { SwipeableRow } from '../components/ui/SwipeableRow'; 
import EnvelopeTransactionRow from '../components/EnvelopeTransactionRow';
import TransactionModal from '../components/modals/TransactionModal';
import type { Transaction } from '../models/types';

export const TransactionHistoryView: React.FC = () => {
  const navigate = useNavigate();
  // Added deleteTransaction to the destructuring
  const { transactions, envelopes, updateTransaction, deleteTransaction, restoreTransaction, currentMonth, appSettings } = useBudgetStore(); 
  const { showToast } = useToastStore(); 
  
  // --- 1. Filter State (Matching Swift @State) ---
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [showReconciledOnly, setShowReconciledOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); 
  const [showAllTime, setShowAllTime] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('all');
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
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
    console.log('🔍 Filtering transactions:', {
      totalTransactions: transactions.length,
      showAllTime,
      currentMonth,
      transactionMonths: transactions.map(t => ({ id: t.id, month: t.month, date: t.date, description: t.description }))
    });
    
    // First filter by month if not showing all time
    let filteredByMonth = transactions;
    if (!showAllTime) {
      filteredByMonth = transactions.filter(t => t.month === currentMonth || !t.month);
      console.log('📅 After month filter:', {
        remaining: filteredByMonth.length,
        currentMonth,
        filteredTransactions: filteredByMonth.map(t => ({
          id: t.id,
          description: t.description,
          month: t.month,
          matchesCurrentMonth: t.month === currentMonth
        }))
      });
    }
    
    // Sanitize transactions - ensure dates are valid strings, convert if needed
    const sanitizedTransactions = filteredByMonth.map(t => {
      if (!t) return null;

      let dateStr = t.date;
      if (typeof t.date === 'number') {
        // Convert numeric date (legacy data) to ISO string
        // Assume it's Apple timestamp (seconds since 2001)
        const APPLE_EPOCH_OFFSET = 978307200;
        const jsTimestamp = (t.date + APPLE_EPOCH_OFFSET) * 1000;
        dateStr = new Date(jsTimestamp).toISOString();
      } else if (!t.date || typeof t.date !== 'string') {
        return null; // Skip invalid transactions
      }

      return { ...t, date: dateStr };
    }).filter(Boolean) as Transaction[];

    return sanitizedTransactions
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

        // 4. Payment Method Filter
        if (selectedPaymentMethodId !== 'all' && (!t.paymentMethod || t.paymentMethod.id !== selectedPaymentMethodId)) {
          return false;
        }

        // 5. Date Range (Inclusive)
        if (!t.date || typeof t.date !== 'string') {
          return false; // Skip transactions with invalid dates
        }
        const tDate = t.date.split('T')[0];
        
        // Only filter by date if enabled by user
        if (isDateFilterActive) { 
          if (tDate < startDate || tDate > endDate) {
            return false;
          }
        }

        // 6. Month Filter
        if (selectedMonth !== 'all') {
          const month = new Date(tDate).getMonth();
          if (month !== parseInt(selectedMonth)) return false;
        } 
        
        // Removed the broken 'else if (currentMonth !== 'all')' block. 
        // 1. currentMonth filtering is already handled in the 'filteredByMonth' pre-filter step.
        // 2. The logic 'parseInt(currentMonth)' was flawed (parsed Year instead of Month index).

        // 7. Reconciled Filter
        if (showReconciledOnly && !t.reconciled) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, envelopes, searchText, selectedEnvelopeId, selectedType, selectedPaymentMethodId, startDate, endDate, showReconciledOnly, showAllTime, currentMonth, isDateFilterActive]);

  console.log('✅ Final filtered transactions:', {
    count: filteredTransactions.length,
    transactions: filteredTransactions.map(t => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      month: t.month,
      type: t.type
    }))
  });
  

  // Helper for Modal
  const activeEnvelope = editingTransaction 
    ? envelopes.find(e => e.id === editingTransaction.envelopeId) 
    : null;

  const handleReconcile = (transaction: Transaction) => {
    const updatedTx = { ...transaction, reconciled: !transaction.reconciled };
    updateTransaction(updatedTx);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-[calc(8rem+env(safe-area-inset-bottom))] transition-colors duration-200">
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

      {/* --- Month Selector and All Time Toggle --- */}
      <div className="px-4 py-2 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 flex justify-between items-center">
        <div className="text-sm font-medium text-gray-700 dark:text-zinc-300">Month: {currentMonth}</div>
        <button 
          onClick={() => setShowAllTime(!showAllTime)}
          className={`text-sm px-3 py-1 rounded-md ${showAllTime ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300'}`}
        >
          {showAllTime ? 'Current Month Only' : 'All Time'}
        </button>
      </div>

      {/* --- Quick Search Box (Always visible) --- */}
      <div className="px-4 py-3 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800">
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
      </div>

      {/* --- Collapsible Filter Panel --- */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 ${
          showFilters ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 space-y-4">
          
          {/* Payment Method Filter */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Payment Method</label>
            <select
              value={selectedPaymentMethodId}
              onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 border-r-8 border-transparent text-sm dark:text-white outline-none"
            >
              <option value="all">All Payment Methods</option>
              {appSettings?.paymentSources?.map(card => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
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

          {/* Month Picker */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 border-r-8 border-transparent text-sm dark:text-white outline-none"
            >
              <option value="all">All Months</option>
              {Array.from({length: 12}, (_, i) => i).map(month => (
                <option key={month} value={month}>{new Date(2022, month).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase">Date Range</span>
              <div className="flex items-center gap-2">
                 <label className="text-xs text-gray-600 dark:text-zinc-400">Enable</label>
                 <button
                    onClick={() => setIsDateFilterActive(!isDateFilterActive)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      isDateFilterActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${
                      isDateFilterActive ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
              </div>
            </div>
            <div className={`grid grid-cols-2 gap-4 transition-opacity ${isDateFilterActive ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase">From</label>
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
                <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase">To</label>
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

          {/* Show All Time Toggle */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Show all time</span>
            <button
              onClick={() => setShowAllTime(!showAllTime)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                showAllTime ? 'bg-green-500' : 'bg-gray-300 dark:bg-zinc-700'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                showAllTime ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* --- Transaction List --- */}
      <div className="p-4 max-w-4xl mx-auto">
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
                    <SwipeableRow 
                      disabled={transaction.isAutomatic}
                      onDelete={() => {
                        if (!transaction.id) return;
                        const transactionToDelete = { ...transaction }; // Create a copy
                        deleteTransaction(transaction.id);
                        showToast(
                          'Transaction deleted',
                          'neutral',
                          () => restoreTransaction(transactionToDelete)
                        );
                      }}
                    >
                      <EnvelopeTransactionRow
                        transaction={transaction}
                        envelopeName={env?.name || 'Unknown Envelope'}
                        onReconcile={() => handleReconcile(transaction)}
                        onEdit={() => {
                          if (transaction.isAutomatic) return;
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
      <TransactionModal
        isVisible={!!editingTransaction && !!activeEnvelope}
        onClose={() => setEditingTransaction(null)}
        mode="edit"
        currentEnvelope={activeEnvelope || {} as any}
        initialTransaction={editingTransaction}
      />
    </div>
  );
};
