import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, List as ListIcon, GitBranch, Wallet, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { MonthSelector } from '../components/ui/MonthSelector';
import { AvailableToBudget } from '../components/ui/AvailableToBudget';
import { UserMenu } from '../components/ui/UserMenu';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import EnvelopeAllocationModal from '../components/modals/EnvelopeAllocationModal';
import StartFreshConfirmModal from '../components/modals/StartFreshConfirmModal';
import CopyPreviousMonthPrompt from '../components/ui/CopyPreviousMonthPrompt';
import { useToastStore } from '../stores/toastStore';
import { useNavigate } from 'react-router-dom';
import type { IncomeSource } from '../models/types';

export const EnvelopeListView: React.FC = () => {
  // Envelope store (for envelopes and transactions)
  const { envelopes, transactions, fetchData, isOnline, pendingSync, syncData, isLoading, getEnvelopeBalance, testingConnectivity } = useEnvelopeStore();

  // Monthly budget store (for zero-based budgeting features)
  const {
    currentMonth,
    incomeSources,
    envelopeAllocations,
    calculateAvailableToBudget,
    deleteIncomeSource,
    restoreIncomeSource,
    clearMonthData,
    copyFromPreviousMonth
  } = useMonthlyBudgetStore();

  const { showToast } = useToastStore();
  const navigate = useNavigate();

  // Local state for modals
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [envelopeAllocationModalVisible, setEnvelopeAllocationModalVisible] = useState(false);
  const [selectedEnvelopeAllocation, setSelectedEnvelopeAllocation] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [startFreshModalVisible, setStartFreshModalVisible] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Income Management Handlers
  const handleAddIncome = () => {
    setIncomeModalMode('add');
    setSelectedIncomeSource(null);
    setIncomeModalVisible(true);
  };

  const handleEditIncome = (incomeSource: IncomeSource) => {
    // Cancel any pending edit operations
    if (pendingEditTimeout.current) {
      clearTimeout(pendingEditTimeout.current);
      pendingEditTimeout.current = null;
    }

    // Don't open edit if we're in a delete flow
    if (isDeleting) {
      return;
    }

    setIncomeModalMode('edit');
    setSelectedIncomeSource(incomeSource);
    setIncomeModalVisible(true);
  };

  const handleDeleteIncome = async (incomeSource: IncomeSource) => {
    // Cancel any pending edit operations
    if (pendingEditTimeout.current) {
      clearTimeout(pendingEditTimeout.current);
      pendingEditTimeout.current = null;
    }

    // Set deleting flag immediately to prevent edit modal
    setIsDeleting(true);

    try {
      // Capture a copy for undo
      const sourceIndex = incomeSources.findIndex(s => s.id === incomeSource.id);
      const sourceCopy = { ...incomeSource };

      // Delete immediately (optimistic UI)
      await deleteIncomeSource(incomeSource.id);

      // Show toast with undo option
      showToast(
        `Deleted "${incomeSource.name}"`,
        'neutral',
        () => restoreIncomeSource(sourceCopy, sourceIndex)
      );

      // Reset after a delay to prevent edit modal from opening
      setTimeout(() => {
        setIsDeleting(false);
      }, 500);
      return true;
    } catch (error) {
      console.error('Error deleting income source:', error);
      setTimeout(() => {
        setIsDeleting(false);
      }, 500);
      return false;
    }
  };

  const handleCloseModal = () => {
    setIncomeModalVisible(false);
    setSelectedIncomeSource(null);
  };

  const handleEditEnvelopeAllocation = (allocation: any) => {
    setSelectedEnvelopeAllocation(allocation);
    setEnvelopeAllocationModalVisible(true);
  };

  const handleCloseEnvelopeAllocationModal = () => {
    setEnvelopeAllocationModalVisible(false);
    setSelectedEnvelopeAllocation(null);
  };

  const handleEnvelopeNameUpdate = (envelopeId: string, newName: string) => {
    // For now, this would require updating the envelope in envelopeStore
    // This is a placeholder for when envelope editing is implemented
    console.log('Envelope name update:', envelopeId, newName);
  };

  const handleStartFresh = () => {
    setStartFreshModalVisible(true);
  };

  const handleStartFreshConfirm = async () => {
    try {
      await clearMonthData();
      setStartFreshModalVisible(false);

      // Show success toast with undo option
      showToast(
        `"${currentMonth}" budget cleared`,
        'neutral',
        async () => {
          // Note: Since we cleared all data, undo would require storing backup
          // For now, show that undo isn't available
          showToast('Cannot undo "Start Fresh" after 30 seconds', 'error');
        }
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

  const handleDismissCopyPrompt = () => {
    setShowCopyPrompt(false);
  };


  // Calculate available to budget for current month
  const availableToBudget = calculateAvailableToBudget();

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
            <button
              onClick={() => navigate('/monthly-budget-demo')}
              className="text-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              title="Monthly Budget Demo"
            >
              <GitBranch size={22} />
            </button>
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
            useMonthlyBudgetStore.getState().setCurrentMonth(newMonth);

            // Check if new month is empty after a brief delay for data to load
            setTimeout(() => {
              const state = useMonthlyBudgetStore.getState();
              if (state.currentMonth === newMonth &&
                  state.incomeSources.length === 0 &&
                  state.envelopeAllocations.length === 0) {
                setShowCopyPrompt(true);
              }
            }, 500);
          }}
        />

        {/* Available to Budget - Main Focus */}
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
            onDismiss={handleDismissCopyPrompt}
          />
        )}

        {/* Income Sources Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Income Sources
            </h2>
            <button
              onClick={handleAddIncome}
              className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
            >
              <PlusCircle size={20} />
            </button>
          </div>

          {incomeSources.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-zinc-400 text-sm">
                No income sources yet. Add your monthly income to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false} mode="popLayout">
                {incomeSources.map((source) => (
                  <motion.div
                    key={source.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SwipeableRow onDelete={() => handleDeleteIncome(source)}>
                      <div
                        className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-zinc-800 rounded-xl cursor-pointer"
                        onClick={() => handleEditIncome(source)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {source.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-zinc-400">
                            Monthly income
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <p className="font-semibold text-green-600 dark:text-emerald-400">
                            ${source.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </SwipeableRow>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
        {/* Envelope Budget & Status Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Spending Envelopes
            </h2>
            <button
              onClick={() => navigate('/add-envelope')}
              className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
              title="Create New Envelope"
            >
              <PlusCircle size={20} />
            </button>
          </div>

          {sortedEnvelopes.length === 0 ? (
            <div className="text-center py-6">
              <Wallet className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
                No envelopes yet. Create your first envelope to get started.
              </p>
              <button
                onClick={() => navigate('/add-envelope')}
                className="text-blue-600 dark:text-blue-300 font-medium hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
              >
                Create First Envelope
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEnvelopes.map((env) => {
                // Find allocation for this envelope in current month
                const allocation = envelopeAllocations.find(alloc => alloc.envelopeId === env.id);
                const budgetedAmount = allocation?.budgetedAmount || 0;
                const remainingBalance = getEnvelopeBalance(env.id!);

                return (
                  <div
                    key={env.id}
                    onClick={() => navigate(`/envelope/${env.id}`)}
                    className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl cursor-pointer active:scale-[0.99] transition-transform"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {env.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditEnvelopeAllocation(allocation || {
                              id: '',
                              userId: '',
                              envelopeId: env.id!,
                              month: currentMonth,
                              budgetedAmount: 0,
                              createdAt: new Date().toISOString(),
                              updatedAt: new Date().toISOString(),
                            });
                          }}
                          className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                          <span className="text-sm">Budgeted:</span>
                          <span className="font-semibold">${budgetedAmount.toFixed(2)}</span>
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-zinc-400 mb-1">
                          Remaining
                        </div>
                        <div className={`font-semibold ${
                          remainingBalance.toNumber() < 0
                            ? 'text-red-600 dark:text-red-400'
                            : remainingBalance.toNumber() >= 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-600 dark:text-zinc-400'
                        }`}>
                          {remainingBalance.toNumber() < 0 ? '-' : ''}${Math.abs(remainingBalance.toNumber()).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Income Source Modal */}
      <IncomeSourceModal
        isVisible={incomeModalVisible}
        onClose={handleCloseModal}
        mode={incomeModalMode}
        initialIncomeSource={selectedIncomeSource}
      />

      {/* Envelope Allocation Modal */}
      <EnvelopeAllocationModal
        isVisible={envelopeAllocationModalVisible}
        onClose={handleCloseEnvelopeAllocationModal}
        initialAllocation={selectedEnvelopeAllocation}
        getEnvelopeName={(envelopeId: string) => {
          const env = envelopes.find(e => e.id === envelopeId);
          return env?.name || `Envelope ${envelopeId}`;
        }}
        onEnvelopeNameUpdate={handleEnvelopeNameUpdate}
      />

      {/* Start Fresh Confirmation Modal */}
      <StartFreshConfirmModal
        isVisible={startFreshModalVisible}
        onClose={() => setStartFreshModalVisible(false)}
        onConfirm={handleStartFreshConfirm}
        currentMonth={currentMonth}
        incomeCount={incomeSources.length}
        totalIncome={incomeSources.reduce((sum, source) => sum + source.amount, 0)}
        allocationCount={envelopeAllocations.length}
        totalAllocated={envelopeAllocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0)}
      />
    </div>
  );
};
