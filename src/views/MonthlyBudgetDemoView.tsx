import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { useToastStore } from '../stores/toastStore';
import { MonthSelector } from '../components/ui/MonthSelector';
import { AvailableToBudget } from '../components/ui/AvailableToBudget';
import { UserMenu } from '../components/ui/UserMenu';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import EnvelopeAllocationModal from '../components/modals/EnvelopeAllocationModal';
import { DemoEnvelopeModal } from '../components/demo/EnvelopeModal';
import { mockMonthlyBudgetData, mockEnvelopeNames } from '../utils/demoData';
import type { IncomeSource, EnvelopeAllocation } from '../models/types';

export const MonthlyBudgetDemoView: React.FC = () => {
  const {
    currentMonth,
    incomeSources,
    envelopeAllocations,
    isLoading,
    calculateAvailableToBudget,
    deleteIncomeSource,
    restoreIncomeSource,
    deleteEnvelopeAllocation,
    restoreEnvelopeAllocation,
  } = useMonthlyBudgetStore();
  const { showToast } = useToastStore();

  // Override setCurrentMonth for demo to handle demo month specially
  const handleMonthChange = (month: string) => {
    // Set month directly
    useMonthlyBudgetStore.setState({ currentMonth: month });

    // Handle demo month vs other months
    if (month === mockMonthlyBudgetData.currentMonth) {
      // Load demo data for January 2025
      useMonthlyBudgetStore.setState({
        incomeSources: mockMonthlyBudgetData.incomeSources,
        envelopeAllocations: mockMonthlyBudgetData.envelopeAllocations,
        isLoading: false
      });
    } else {
      // Clear data for other months (no demo data available)
      useMonthlyBudgetStore.setState({
        incomeSources: [],
        envelopeAllocations: [],
        isLoading: false
      });
    }
  };

  // Demo-specific copy month functionality
  const handleCopyMonth = () => {
    // For demo: copy January 2025 data to current month
    if (currentMonth !== mockMonthlyBudgetData.currentMonth) {
      useMonthlyBudgetStore.setState({
        incomeSources: mockMonthlyBudgetData.incomeSources.map(source => ({
          ...source,
          month: currentMonth, // Update month reference
          id: `${source.id}-${currentMonth}`, // Make ID unique for this month
        })),
        envelopeAllocations: mockMonthlyBudgetData.envelopeAllocations.map(allocation => ({
          ...allocation,
          month: currentMonth, // Update month reference
          id: `${allocation.id}-${currentMonth}`, // Make ID unique for this month
        })),
        isLoading: false
      });
    }
  };

  const [demoLoaded, setDemoLoaded] = useState(false);
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [envelopeAllocationModalVisible, setEnvelopeAllocationModalVisible] = useState(false);
  const [selectedEnvelopeAllocation, setSelectedEnvelopeAllocation] = useState<EnvelopeAllocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEnvelopeModal, setShowEnvelopeModal] = useState(false);
  const [customEnvelopeNames, setCustomEnvelopeNames] = useState<Record<string, string>>({});
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal handlers
  const handleAddIncome = () => {
    setIncomeModalMode('add');
    setSelectedIncomeSource(null);
    setIncomeModalVisible(true);
  };

  const handleAddEnvelope = () => {
    setShowEnvelopeModal(true);
  };

  const handleEnvelopeCreated = (envelopeId: string, envelopeName: string) => {
    setCustomEnvelopeNames(prev => ({
      ...prev,
      [envelopeId]: envelopeName
    }));
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
      // Find the original index for proper restoration
      const sourceIndex = incomeSources.findIndex(s => s.id === incomeSource.id);

      // Capture a copy for undo
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

  const handleCloseEnvelopeAllocationModal = () => {
    setEnvelopeAllocationModalVisible(false);
    setSelectedEnvelopeAllocation(null);
  };

  const handleEnvelopeNameUpdate = (envelopeId: string, newName: string) => {
    setCustomEnvelopeNames(prev => ({
      ...prev,
      [envelopeId]: newName
    }));
  };

  const handleDeleteEnvelopeAllocation = async (allocationId: string) => {
    try {
      // Find the allocation for the toast message and get its original index
      const allocationIndex = envelopeAllocations.findIndex(a => a.id === allocationId);
      const allocation = envelopeAllocations[allocationIndex];
      if (!allocation) return false;

      // Capture a copy for undo
      const allocationCopy = { ...allocation };

      // Delete immediately (optimistic UI)
      await deleteEnvelopeAllocation(allocationId);

      // Show toast with undo option
      showToast(
        `Deleted "${getEnvelopeName(allocation.envelopeId)}" allocation`,
        'neutral',
        () => {
          // Restore the allocation at its original position
          restoreEnvelopeAllocation(allocationCopy, allocationIndex);
        }
      );

      return true;
    } catch (error) {
      console.error('Error deleting envelope allocation:', error);
      return false;
    }
  };

  const handleEditEnvelopeAllocation = (allocation: EnvelopeAllocation) => {
    // Cancel any pending edit operations
    if (pendingEditTimeout.current) {
      clearTimeout(pendingEditTimeout.current);
      pendingEditTimeout.current = null;
    }

    // Don't open edit if we're in a delete flow
    if (isDeleting) {
      return;
    }

    setEnvelopeAllocationModalVisible(true);
    setSelectedEnvelopeAllocation(allocation);
  };


  // Load mock data for demo on mount
  useEffect(() => {
    const initializeDemo = () => {
      if (!demoLoaded) {
        // Set current month directly (bypass fetchMonthlyData)
        useMonthlyBudgetStore.setState({
          currentMonth: mockMonthlyBudgetData.currentMonth,
          incomeSources: mockMonthlyBudgetData.incomeSources,
          envelopeAllocations: mockMonthlyBudgetData.envelopeAllocations,
          isLoading: false
        });

        setDemoLoaded(true);
      }
    };

    initializeDemo();
  }, [demoLoaded]);

  // Demo works with mock data only - no Firebase calls needed
  // The demo showcases UI components without backend dependencies

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (pendingEditTimeout.current) {
        clearTimeout(pendingEditTimeout.current);
      }
    };
  }, []);

  const availableToBudget = calculateAvailableToBudget();
  const totalIncome = incomeSources.reduce((sum, source) => sum + source.amount, 0);
  const totalAllocated = envelopeAllocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);

  // Get envelope name from mock data or custom names
  const getEnvelopeName = (envelopeId: string) => {
    // First check custom envelope names
    if (customEnvelopeNames[envelopeId]) {
      return customEnvelopeNames[envelopeId];
    }
    // Then check mock envelope names
    if (mockEnvelopeNames[envelopeId]) {
      return mockEnvelopeNames[envelopeId];
    }
    // Finally, generate a name from the envelope ID
    const nameParts = envelopeId.replace('env-', '').split('-');
    return nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || envelopeId;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Header with Sync Status */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 z-30">
        <div className="flex justify-between items-center">
          {/* Demo Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-blue-500">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              <span className="text-sm font-medium">
                {isLoading ? 'Loading...' : 'Demo Ready'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyMonth}
              className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors text-sm font-medium"
              disabled={isLoading || currentMonth === mockMonthlyBudgetData.currentMonth}
            >
              Copy Month
            </button>
            <UserMenu />
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Zero-Based Budget Demo
          </h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-1">
            EveryDollar-style monthly budgeting
          </p>
        </div>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        {/* Month Selector */}
        <MonthSelector
          currentMonth={currentMonth}
          onMonthChange={handleMonthChange}
        />

        {/* Available to Budget - Main Focus */}
        <AvailableToBudget
          amount={availableToBudget}
          totalIncome={totalIncome}
          totalAllocated={totalAllocated}
          isLoading={isLoading}
        />

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

        {/* Envelope Allocations Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Envelope Allocations
            </h2>
            <button 
              onClick={handleAddEnvelope}
              className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
            >
              <PlusCircle size={20} />
            </button>
          </div>

          {envelopeAllocations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-zinc-400 text-sm">
                No allocations yet. Fund envelopes from your available budget.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false} mode="popLayout">
                {envelopeAllocations.map((allocation) => (
                  <motion.div
                    key={allocation.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SwipeableRow onDelete={() => handleDeleteEnvelopeAllocation(allocation.id)}>
                      <div
                        className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-zinc-800 rounded-xl cursor-pointer"
                        onClick={() => handleEditEnvelopeAllocation(allocation)}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {getEnvelopeName(allocation.envelopeId)}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-zinc-400">
                            Budgeted this month
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <p className="font-semibold text-blue-600 dark:text-blue-400">
                            ${allocation.budgetedAmount.toFixed(2)}
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

        {/* Demo Instructions */}
        <section className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Demo Instructions
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Use month selector to navigate between months</li>
            <li>• "Copy Month" copies data from previous month</li>
            <li>• Available to Budget shows your zero-based progress</li>
            <li>• Swipe income/envelope items to delete, tap to edit amounts</li>
            <li>• Goal: Get Available to Budget to $0.00</li>
          </ul>
        </section>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-transform"
        onClick={() => {/* Add transaction logic */}}
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

      {/* Envelope Modal */}
      <DemoEnvelopeModal
        isOpen={showEnvelopeModal}
        onClose={() => setShowEnvelopeModal(false)}
        onEnvelopeCreated={handleEnvelopeCreated}
      />

      {/* Envelope Allocation Modal */}
      <EnvelopeAllocationModal
        isVisible={envelopeAllocationModalVisible}
        onClose={handleCloseEnvelopeAllocationModal}
        initialAllocation={selectedEnvelopeAllocation}
        getEnvelopeName={getEnvelopeName}
        onEnvelopeNameUpdate={handleEnvelopeNameUpdate}
      />
    </div>
  );
};
