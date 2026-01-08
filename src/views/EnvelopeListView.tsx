import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, Wallet, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { MonthSelector } from '../components/ui/MonthSelector';
import { AvailableToBudget } from '../components/ui/AvailableToBudget';
import { UserMenu } from '../components/ui/UserMenu';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import StartFreshConfirmModal from '../components/modals/StartFreshConfirmModal';
import CopyPreviousMonthPrompt from '../components/ui/CopyPreviousMonthPrompt';
import { useToastStore } from '../stores/toastStore';
import { useNavigate } from 'react-router-dom';
import type { IncomeSource } from '../models/types';
import { Decimal } from 'decimal.js';

// Separate component for list item to allow individual useDragControls hook
const EnvelopeListItem = ({ 
  env, 
  budgetedAmount, 
  remainingBalance, 
  editingEnvelopeId, 
  setEditingEnvelopeId,
  editingAmount, 
  setEditingAmount,
  handleBudgetSave,
  navigate,
  inputRef,
  dragConstraints,
  onDragStart,
  onDragEnd,
  transactions,
  currentMonth
}: {
  env: any,
  budgetedAmount: number,
  remainingBalance: any,
  editingEnvelopeId: string | null,
  setEditingEnvelopeId: (id: string | null) => void,
  editingAmount: string,
  setEditingAmount: (amount: string) => void,
  handleBudgetSave: () => void,
  navigate: (path: string) => void,
  inputRef: React.RefObject<HTMLInputElement | null>,
  dragConstraints: React.RefObject<HTMLElement | null>,
  onDragStart: () => void,
  onDragEnd: () => void,
  transactions: any[],
  currentMonth: string
}) => {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const longPressTimeout = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const itemRef = useRef<HTMLLIElement>(null);

  // Calculate percentage for both background color and progress bar
  const envelopeTransactions = transactions.filter(t => 
    t.envelopeId === env.id && t.month === currentMonth
  );
  const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
  const incomes = envelopeTransactions.filter(t => t.type === 'Income');
  const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const percentage = Math.max(0, (totalSpent / totalIncome) * 100);

  const clearLongPressTimeout = () => {
    if (longPressTimeout.current !== null) {
      clearTimeout(longPressTimeout.current);
      longPressTimeout.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only respond to primary mouse button or touch
    if (e.button !== 0 && e.pointerType !== 'touch') return;

    pointerStartRef.current = { x: e.clientX, y: e.clientY };

    clearLongPressTimeout();
    longPressTimeout.current = window.setTimeout(() => {
      // Start drag after a short long-press delay
      setIsLongPressActive(true);
      controls.start(e);
    }, 220);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || longPressTimeout.current === null) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > 8) {
      // User is scrolling or moving too much before long-press activates
      clearLongPressTimeout();
    }
  };

  const handlePointerUp = () => {
    clearLongPressTimeout();
    setIsLongPressActive(false);
    pointerStartRef.current = null;
  };

  const handlePointerCancel = () => {
    clearLongPressTimeout();
    setIsLongPressActive(false);
    pointerStartRef.current = null;
  };

  const handleNavigate = () => {
    // Prevent navigation if this interaction was a drag
    if (isDragging) return;
    if (editingEnvelopeId !== env.id) {
      navigate(`/envelope/${env.id}`);
    }
  };

  // Prevent scroll on touch devices when dragging
  useEffect(() => {
    const element = itemRef.current;
    if (!element) return;

    const preventScroll = (e: TouchEvent) => {
      if (isDragging || isLongPressActive) {
        e.preventDefault();
      }
    };

    element.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      element.removeEventListener('touchmove', preventScroll);
    };
  }, [isDragging, isLongPressActive]);

  return (
    <Reorder.Item 
      ref={itemRef}
      value={env}
      dragListener={false}
      dragControls={controls}
      dragConstraints={dragConstraints}
      dragElastic={0.16}
      dragMomentum={false}
      onDragStart={() => {
        setIsDragging(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        setIsLongPressActive(false);
        onDragEnd();
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.7 }}
      whileDrag={{ scale: 1.04, zIndex: 20 }}
      layout
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerCancel}
      style={{
        boxShadow: isDragging
          ? '0 18px 45px rgba(15,23,42,0.35)'
          : '0 1px 2px rgba(15,23,42,0.08)',
        touchAction: 'none'
      }}
      className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl cursor-pointer active:scale-[0.99] transition-transform select-none"
    >
      <div className="flex items-center gap-3 w-full">
        {/* Content Wrapper */}
        <div 
          className="flex-1"
          onClick={handleNavigate}
        >
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{env.name}</h3>
          <div className="flex justify-between items-center">
            <div 
              className="flex items-center space-x-4" 
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {editingEnvelopeId === env.id ? (
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-gray-500 dark:text-zinc-400">Budgeted:</span>
                  <form onSubmit={(e) => { e.preventDefault(); handleBudgetSave(); }}>
                    <input
                      ref={inputRef}
                      type="number"
                      value={editingAmount}
                      onChange={(e) => setEditingAmount(e.target.value)}
                      onBlur={handleBudgetSave}
                      className="w-24 px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                      step="0.01"
                      autoFocus
                    />
                  </form>
                </div>
              ) : (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingEnvelopeId(env.id);
                    setEditingAmount(budgetedAmount.toString());
                  }}
                  className="flex items-center space-x-1 hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
                >
                  <span className="text-sm text-gray-500 dark:text-zinc-400">Budgeted:</span>
                  <span className="font-medium text-gray-900 dark:text-white">${budgetedAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="text-right">
              <span className="text-sm text-gray-500 dark:text-zinc-400 block">Remaining</span>
              <span className={`font-bold ${
                  remainingBalance.toNumber() < 0 
                    ? 'text-red-500' 
                    : (100 - percentage) <= 5 
                      ? 'text-red-500' 
                      : percentage >= 80 
                        ? 'text-yellow-600 dark:text-yellow-400' 
                        : 'text-green-600 dark:text-emerald-400'
                }`}>
                ${remainingBalance.toNumber().toFixed(2)}
              </span>
            </div>
          </div>
          
          {/* Budget Progress Bar */}
          {budgetedAmount > 0 && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {(() => {
                console.log(`📊 Envelope: ${env.name}`, {
                  budgetedAmount,
                  totalIncome,
                  totalSpent,
                  remainingBalance: remainingBalance.toNumber(),
                  percentage
                });
                return (
                  <>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
                      <span>Budget Used</span>
                      <span>{percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ease-out ${
                          remainingBalance.toNumber() < 0 
                            ? 'bg-red-500' 
                            : (100 - percentage) <= 5 
                              ? 'bg-red-500' 
                              : percentage >= 80 
                                ? 'bg-yellow-500' 
                                : 'bg-green-400'
                        }`}
                        style={{ width: `${Math.max(100 - percentage, 2)}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
};

export const EnvelopeListView: React.FC = () => {
  // Envelope store (for envelopes and transactions)
  const { envelopes, transactions, fetchData, isLoading, isOnline, pendingSync, syncData, testingConnectivity } = useEnvelopeStore();

  // Monthly budget store (for zero-based budgeting features)
  const {
    currentMonth,
    fetchMonthlyData,
    incomeSources,
    envelopeAllocations,
    calculateAvailableToBudget,
    deleteIncomeSource,
    restoreIncomeSource,
    clearMonthData,
    copyFromPreviousMonth,
    setEnvelopeAllocation,
    isLoading: isBudgetLoading,
  } = useMonthlyBudgetStore();

  const { showToast } = useToastStore();
  const navigate = useNavigate();

  // Local state for modals and UI
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [startFreshModalVisible, setStartFreshModalVisible] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loading state for initial data fetch
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State for inline budget editing
  const [editingEnvelopeId, setEditingEnvelopeId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to get envelope balance for current month (matches store calculation)
  const getEnvelopeBalance = (envelopeId: string) => {
    // Calculate transactions for this envelope in the current month using reactive transactions
    const envelopeTransactions = transactions.filter(t => 
      t.envelopeId === envelopeId && t.month === currentMonth
    );
    
    // Also check all transactions for this envelope (for debugging)
    const allEnvelopeTransactions = transactions.filter(t => t.envelopeId === envelopeId);
    
    console.log(`💰 Balance calc for envelope ${envelopeId}:`, {
      currentMonth,
      totalTransactions: transactions.length,
      allEnvelopeTransactions: allEnvelopeTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        month: t.month,
        date: t.date
      })),
      matchingMonthTransactions: envelopeTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        month: t.month,
        date: t.date
      }))
    });
    
    const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
    const incomes = envelopeTransactions.filter(t => t.type === 'Income');
    const totalSpent = expenses.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
    const totalIncome = incomes.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
    
    // Balance = Income - Expenses (same as store calculation)
    const balance = totalIncome.minus(totalSpent);
    console.log(`💰 Final balance for envelope ${envelopeId}:`, balance.toNumber());
    
    return balance;
  };

  // Load data from Firebase on mount
  useEffect(() => {
    console.log('🚀 Starting initial data load, isInitialLoading:', isInitialLoading);
    
    const loadData = async () => {
      console.log('⏳ Setting timeout for loading message');
      // Set timeout message after 8 seconds (improved from 30s)
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Loading timeout reached, showing timeout message');
        setShowTimeoutMessage(true);
      }, 8000);

      try {
        console.log('📡 Fetching data in parallel...');
        // Fetch both datasets in parallel for faster loading
        await Promise.all([
          fetchData().then(() => console.log('✅ Envelope data fetched')),
          fetchMonthlyData().then(() => console.log('✅ Monthly budget data fetched'))
        ]);
        
        // Clear timeout and hide loading screen
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        console.log('🎉 Data load complete, hiding loading screen');
        setIsInitialLoading(false);
        setShowTimeoutMessage(false);
      } catch (error) {
        console.error('❌ Error loading initial data:', error);
        // Still hide loading screen on error so user isn't stuck
        setIsInitialLoading(false);
        setShowTimeoutMessage(false);
      }
    };

    loadData();

    // Cleanup
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Effect to handle Copy Previous Month Prompt visibility
  useEffect(() => {
    if (!isBudgetLoading && !isInitialLoading) {
      const hasNoData = incomeSources.length === 0 && envelopeAllocations.length === 0;
      setShowCopyPrompt(hasNoData);
    }
  }, [isBudgetLoading, isInitialLoading, incomeSources, envelopeAllocations, currentMonth]);

  // Effect to auto-focus the input when editing starts
  useEffect(() => {
    if (editingEnvelopeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingEnvelopeId]);

  const [isReordering, setIsReordering] = useState(false);
  const reorderConstraintsRef = useRef<HTMLDivElement | null>(null);
  
  // Handler for reordering completion
  const handleReorder = (newOrder: typeof envelopes) => {
    // We don't want to update state immediately to avoid jumping, 
    // but we need to persist the new order indices
    console.log('📦 Reordered envelopes:', newOrder.map(e => e.name));
    
    // Update order indices for all envelopes
    newOrder.forEach((env, index) => {
      if (env.orderIndex !== index) {
        useEnvelopeStore.getState().updateEnvelope({
          ...env,
          orderIndex: index
        });
      }
    });
  };

  // Envelopes should already be sorted by orderIndex from the store/service
  // Filter envelopes to only show those that have an allocation for the current month
  // We use a local state for the reorder list to allow smooth dragging
  const [localEnvelopes, setLocalEnvelopes] = useState<typeof envelopes>([]);
  const localOrderRef = useRef<typeof envelopes>([]);

  useEffect(() => {
    // Update local envelopes when store changes, BUT ONLY if not currently dragging
    if (!isReordering) {
      const filtered = [...envelopes]
        .filter(env => envelopeAllocations.some(alloc => alloc.envelopeId === env.id))
        .sort((a, b) => {
          const aOrder = a.orderIndex ?? 0;
          const bOrder = b.orderIndex ?? 0;
          return aOrder - bOrder;
        });

      setLocalEnvelopes(filtered);
      localOrderRef.current = filtered;
    }
  }, [envelopes, envelopeAllocations, isReordering]);

  const handleReorderUpdate = (newOrder: typeof envelopes) => {
    setLocalEnvelopes(newOrder);
    localOrderRef.current = newOrder;
  };

  const handleDragStart = () => setIsReordering(true);

  const handleDragEnd = () => {
    setIsReordering(false);
    if (localOrderRef.current.length) {
      handleReorder(localOrderRef.current);
    }
  };

  const visibleEnvelopes = localEnvelopes;

  const totalBalance = envelopes.reduce(
    (sum, env) => sum + getEnvelopeBalance(env.id!).toNumber(),
    0
  );

    console.log('💸 Total balance:', totalBalance);
  
    // Handler to save the inline budget edit
    const handleBudgetSave = async () => {
      if (!editingEnvelopeId) return;
  
      try {
          const newAmount = parseFloat(editingAmount) || 0;
          await setEnvelopeAllocation(editingEnvelopeId, newAmount);
      } catch (error) {
          console.error("Failed to save budget amount:", error);
          showToast("Failed to update budget", "error");
      } finally {
          // ALWAYS exit edit mode, even if save fails, to prevent getting stuck.
          setEditingEnvelopeId(null);
          setEditingAmount('');
      }
    };
  
    // Income Management Handlers
    const handleAddIncome = () => {
      setIncomeModalMode('add');
      setSelectedIncomeSource(null);
      setIncomeModalVisible(true);
    };

  const handleEditIncome = (incomeSource: IncomeSource) => {
    if (pendingEditTimeout.current) clearTimeout(pendingEditTimeout.current);
    if (isDeleting) return;

    setIncomeModalMode('edit');
    setSelectedIncomeSource(incomeSource);
    setIncomeModalVisible(true);
  };

  const handleDeleteIncome = (incomeSource: IncomeSource) => {
    if (pendingEditTimeout.current) clearTimeout(pendingEditTimeout.current);
    setIsDeleting(true);

    const sourceIndex = incomeSources.findIndex(s => s.id === incomeSource.id);
    const sourceCopy = { ...incomeSource };

    deleteIncomeSource(incomeSource.id).catch(console.error);

    showToast(
      `Deleted "${incomeSource.name}"`,
      'neutral',
      () => restoreIncomeSource(sourceCopy, sourceIndex)
    );

    setTimeout(() => setIsDeleting(false), 500);
  };

  const handleCloseModal = () => {
    setIncomeModalVisible(false);
    setSelectedIncomeSource(null);
  };

  const handleStartFresh = () => {
    setStartFreshModalVisible(true);
  };

  const handleStartFreshConfirm = async () => {
    try {
      await clearMonthData();
      setStartFreshModalVisible(false);
      showToast(
        `"${currentMonth}" budget cleared`,
        'neutral',
        () => showToast('Cannot undo "Start Fresh" after 30 seconds', 'error')
      );
    } catch (error) {
      console.error('Error clearing month data:', error);
      showToast('Failed to clear month data', 'error');
    }
  };

  const handleCopyPreviousMonth = async () => {
    try {
      await copyFromPreviousMonth();
      setShowCopyPrompt(false);
      showToast('Previous month budget copied', 'success');
    } catch (error) {
      console.error('Error copying previous month:', error);
      showToast('Failed to copy previous month', 'error');
    }
  };

  const availableToBudget = calculateAvailableToBudget();

  // Show loading screen during initial data fetch
  console.log('🔍 Checking loading screen condition, isInitialLoading:', isInitialLoading);
  if (isInitialLoading) {
    console.log('📺 Showing loading screen');
    return (
      <LoadingScreen 
        message={showTimeoutMessage ? "Still loading... This is normal on slow connections" : "Loading your budget..."}
        showTimeout={showTimeoutMessage}
      />
    );
  }

  console.log('📱 Showing main content');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Navbar */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 z-30">
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
                  {testingConnectivity ? 'Testing...' : isLoading ? 'Saving...' : 'Offline'}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
                        <button
              onClick={handleStartFresh}
              className="text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              title="Start Fresh - Clear current month budget"
            >
              <RefreshCw size={22} />
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Personal Budget</h1>
        </div>
      </header>


    <div className="p-4 max-w-md mx-auto space-y-6">
      {/* Month Selector */}
      <MonthSelector
        currentMonth={currentMonth}
        onMonthChange={(newMonth) => {
          setShowCopyPrompt(false);
          useMonthlyBudgetStore.getState().setCurrentMonth(newMonth);
        }}
      />

      {/* Available to Budget */}
      <AvailableToBudget
        amount={availableToBudget}
        totalIncome={incomeSources.reduce((sum, source) => sum + source.amount, 0)}
        totalAllocated={envelopeAllocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0)}
        isLoading={isLoading}
      />

      {/* Copy Previous Month Prompt */}
      {showCopyPrompt && (
        <CopyPreviousMonthPrompt
          currentMonth={currentMonth}
          onCopy={handleCopyPreviousMonth}
          onDismiss={() => setShowCopyPrompt(false)}
        />
      )}

      {/* Income Sources Section */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Income Sources</h2>
          <button onClick={handleAddIncome} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors">
            <PlusCircle size={20} />
          </button>
        </div>
        {incomeSources.length === 0 ? (
          <div className="text-center py-6"><p className="text-gray-500 dark:text-zinc-400 text-sm">No income sources yet. Add your monthly income.</p></div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {incomeSources.map((source) => (
                <motion.div key={source.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <SwipeableRow onDelete={() => handleDeleteIncome(source)}>
                    <div className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-zinc-800 rounded-xl cursor-pointer" onClick={() => handleEditIncome(source)}>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                        <p className="text-sm text-gray-600 dark:text-zinc-400">Monthly income</p>
                      </div>
                      <p className="font-semibold text-green-600 dark:text-emerald-400">${source.amount.toFixed(2)}</p>
                    </div>
                  </SwipeableRow>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Spending Envelopes Section */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Envelopes</h2>
          <button onClick={() => navigate('/add-envelope')} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors" title="Create New Envelope">
            <PlusCircle size={20} />
          </button>
        </div>
        {visibleEnvelopes.length === 0 ? (
          <div className="text-center py-6">
            <Wallet className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
              {envelopes.length > 0 
                ? "No envelopes added to this month. Copy from previous month or add new ones."
                : "No envelopes yet. Create one to get started."}
            </p>
            <button onClick={() => navigate('/add-envelope')} className="text-blue-600 dark:text-blue-300 font-medium hover:text-blue-700 dark:hover:text-blue-200 transition-colors">Create First Envelope</button>
          </div>
        ) : (
          <div ref={reorderConstraintsRef}>
            <Reorder.Group 
              axis="y" 
              values={localEnvelopes} 
              onReorder={handleReorderUpdate}
              className="space-y-3"
              layoutScroll
            >
            {visibleEnvelopes.map((env) => {
              const allocation = envelopeAllocations.find(alloc => alloc.envelopeId === env.id);
              const budgetedAmount = allocation?.budgetedAmount || 0;
              const remainingBalance = getEnvelopeBalance(env.id);

              return (
                <EnvelopeListItem
                  key={env.id}
                  env={env}
                  budgetedAmount={budgetedAmount}
                  remainingBalance={remainingBalance}
                  editingEnvelopeId={editingEnvelopeId}
                  setEditingEnvelopeId={setEditingEnvelopeId}
                  editingAmount={editingAmount}
                  setEditingAmount={setEditingAmount}
                  handleBudgetSave={handleBudgetSave}
                  navigate={navigate}
                  inputRef={inputRef}
                  dragConstraints={reorderConstraintsRef}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  transactions={transactions}
                  currentMonth={currentMonth}
                />
              );
            })}
          </Reorder.Group>
          </div>
        )}
      </section>

      <button
        onClick={() => navigate('/add-transaction')}
        className="fixed bottom-24 right-6 md:bottom-10 bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-transform z-40 pointer-events-auto"
      >
        <PlusCircle size={28} />
      </button>

      <IncomeSourceModal isVisible={incomeModalVisible} onClose={handleCloseModal} mode={incomeModalMode} initialIncomeSource={selectedIncomeSource} />
      
      {/* This modal is no longer used for editing, but we'll leave it for now in case it's needed elsewhere. */}
      {/* <EnvelopeAllocationModal isVisible={envelopeAllocationModalVisible} onClose={handleCloseEnvelopeAllocationModal} initialAllocation={selectedEnvelopeAllocation} getEnvelopeName={(envelopeId: string) => envelopes.find(e => e.id === envelopeId)?.name || ''} /> */}

      <StartFreshConfirmModal isVisible={startFreshModalVisible} onClose={() => setStartFreshModalVisible(false)} onConfirm={handleStartFreshConfirm} currentMonth={currentMonth} incomeCount={incomeSources.length} totalIncome={incomeSources.reduce((sum, s) => sum + s.amount, 0)} allocationCount={envelopeAllocations.length} totalAllocated={envelopeAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)} />
    </div>
    </div>
  );
};
