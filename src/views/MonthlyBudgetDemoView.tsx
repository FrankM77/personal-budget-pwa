import React, { useEffect, useState, useRef } from 'react';
import { PlusCircle, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { MonthSelector } from '../components/ui/MonthSelector';
import { AvailableToBudget } from '../components/ui/AvailableToBudget';
import { UserMenu } from '../components/ui/UserMenu';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import { mockMonthlyBudgetData, mockEnvelopeNames } from '../utils/demoData';
import type { IncomeSource } from '../models/types';

export const MonthlyBudgetDemoView: React.FC = () => {
  const {
    currentMonth,
    incomeSources,
    envelopeAllocations,
    isLoading,
    calculateAvailableToBudget,
    deleteIncomeSource,
  } = useMonthlyBudgetStore();

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
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal handlers
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
    
    const confirmed = window.confirm(`Delete "${incomeSource.name}"? This will affect your available budget.`);
    
    if (confirmed) {
      try {
        await deleteIncomeSource(incomeSource.id);
      } catch (error) {
        console.error('Error deleting income source:', error);
      }
    }
    
    // Reset after a delay to prevent edit modal from opening
    // This prevents the tap event from opening edit modal after delete action
    setTimeout(() => {
      setIsDeleting(false);
    }, 500);
  };

  const handleCloseModal = () => {
    setIncomeModalVisible(false);
    setSelectedIncomeSource(null);
  };

  // Swipe gesture handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50; // Minimum distance for swipe

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = (itemId: string, source: IncomeSource) => {
    // Don't open edit if we're in a delete flow
    if (isDeleting) {
      return;
    }

    // Cancel any pending edit operations
    if (pendingEditTimeout.current) {
      clearTimeout(pendingEditTimeout.current);
      pendingEditTimeout.current = null;
    }

    if (!touchStart || !touchEnd) {
      // No movement - treat as tap, open edit
      pendingEditTimeout.current = setTimeout(() => {
        if (!isDeleting && swipedItemId !== itemId) {
          handleEditIncome(source);
        }
        pendingEditTimeout.current = null;
      }, 50);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left reveals delete action
      setSwipedItemId(itemId);
    } else {
      // Swipe right or minimal movement - treat as tap
      if (Math.abs(distance) < 10) {
        // Very small movement, treat as tap
        pendingEditTimeout.current = setTimeout(() => {
          if (!isDeleting && swipedItemId !== itemId) {
            handleEditIncome(source);
          }
          pendingEditTimeout.current = null;
        }, 50);
      }
      setSwipedItemId(null);
    }
  };

  const handleItemTap = (source: IncomeSource) => {
    // Prevent edit modal if we just handled a delete action
    if (isDeleting) {
      return;
    }
    
    // Cancel any pending edit operations
    if (pendingEditTimeout.current) {
      clearTimeout(pendingEditTimeout.current);
      pendingEditTimeout.current = null;
    }
    
    // On mobile: if swipe actions are open, close them
    // On desktop: no-op (hover handles it)
    if (swipedItemId === source.id) {
      setSwipedItemId(null);
      return;
    }
    
    // On mobile: tap to edit (only if not swiped and not deleting)
    // This will be handled by onTouchEnd for mobile, so this is mainly for desktop fallback
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

  // Get envelope name from mock data
  const getEnvelopeName = (envelopeId: string) => {
    return mockEnvelopeNames[envelopeId] || `Envelope ${envelopeId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Header with Sync Status */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 z-10">
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
              {incomeSources.map((source) => (
                <div
                  key={source.id}
                  className="relative flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-zinc-800 rounded-xl group overflow-hidden cursor-pointer md:cursor-default"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={() => onTouchEnd(source.id, source)}
                  onClick={() => handleItemTap(source)}
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
                    {/* Desktop: Show on hover */}
                    <div className="hidden md:flex opacity-0 md:group-hover:opacity-100 transition-opacity gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditIncome(source);
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Edit income source"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteIncome(source);
                        }}
                        className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete income source"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Mobile: Swipe to reveal delete action */}
                  {swipedItemId === source.id && (
                    <div className="absolute right-0 top-0 h-full flex items-center bg-red-500 rounded-r-xl px-4 md:hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          // Cancel any pending edit operations
                          if (pendingEditTimeout.current) {
                            clearTimeout(pendingEditTimeout.current);
                            pendingEditTimeout.current = null;
                          }
                          setSwipedItemId(null);
                          handleDeleteIncome(source);
                        }}
                        className="p-2 text-white hover:bg-red-600 rounded transition-colors"
                        title="Delete income source"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Envelope Allocations Section */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Envelope Allocations
            </h2>
            <button className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors">
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
              {envelopeAllocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-zinc-800 rounded-xl"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {getEnvelopeName(allocation.envelopeId)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Budgeted this month
                    </p>
                  </div>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">
                    ${allocation.budgetedAmount.toFixed(2)}
                  </p>
                </div>
              ))}
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
    </div>
  );
};
