import { useEffect, useState, useRef, useCallback } from 'react';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { useToastStore } from '../stores/toastStore';
import { Decimal } from 'decimal.js';
import type { IncomeSource } from '../models/types';

export const useEnvelopeList = () => {
  // Envelope store (for envelopes and transactions)
  const { 
    envelopes, 
    transactions, 
    fetchData, 
    isLoading, 
    isOnline, 
    pendingSync, 
    syncData, 
    testingConnectivity, 
    reorderEnvelopes 
  } = useEnvelopeStore();

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

  // Compute loading state from stores - no local state needed
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialFetchTriggered, setInitialFetchTriggered] = useState(false);
  
  // Derive loading state purely from stores - show loading only if stores are loading
  // Once fetch is triggered and stores are not loading, we're done
  const isInitialLoading = !initialFetchTriggered || isLoading || isBudgetLoading;

  // State for reorder list to allow smooth dragging
  const [localEnvelopes, setLocalEnvelopes] = useState<typeof envelopes>([]);
  const localOrderRef = useRef<typeof envelopes>([]);

  // Function to get envelope balance 
  const getEnvelopeBalance = (envelopeId: string) => {
    // Check if this is a piggybank
    const envelope = envelopes.find(e => e.id === envelopeId);
    if (envelope?.isPiggybank) {
      // For piggybanks, use store's cumulative balance (all transactions)
      return useEnvelopeStore.getState().getEnvelopeBalance(envelopeId);
    }
    
    // For regular envelopes, calculate monthly balance
    const envelopeTransactions = transactions.filter(t => 
      t.envelopeId === envelopeId && t.month === currentMonth
    );

    const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
    const incomes = envelopeTransactions.filter(t => t.type === 'Income');
    const totalSpent = expenses.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));
    const totalIncome = incomes.reduce((acc, curr) => acc.plus(new Decimal(curr.amount || 0)), new Decimal(0));

    // Balance = Income - Expenses (same as store calculation)
    const balance = totalIncome.minus(totalSpent);
    
    return balance;
  };

  // Separate piggybanks from regular envelopes
  // Only show piggybanks from their creation month forward
  const piggybanks = envelopes.filter(env => {
    if (!env.isPiggybank || !env.isActive) return false;
    
    // If piggybank has a creation date, only show it from that month forward
    if (env.createdAt) {
      const createdDate = new Date(env.createdAt);
      // Use UTC methods to avoid timezone conversion issues
      const createdMonth = `${createdDate.getUTCFullYear()}-${String(createdDate.getUTCMonth() + 1).padStart(2, '0')}`;
      
      console.log(`🐷 Piggybank filter: ${env.name}`, {
        createdAt: env.createdAt,
        createdMonth,
        currentMonth,
        shouldShow: currentMonth >= createdMonth
      });
      
      // Only show if current viewing month is >= creation month
      return currentMonth >= createdMonth;
    }
    
    // If no creation date, show it (legacy piggybanks)
    console.log(`🐷 Piggybank ${env.name} has no createdAt - showing by default`);
    return true;
  });

  // Filter and sort envelopes for display
  const visibleEnvelopes = localEnvelopes;

  // Load data from Firebase on mount
  useEffect(() => {
    // Set timeout message after 8 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      setShowTimeoutMessage(true);
    }, 8000);

    // Trigger both fetches in parallel - they handle their own loading states
    fetchData();
    fetchMonthlyData();
    
    // Mark that we've triggered the initial fetch
    setInitialFetchTriggered(true);

    // Cleanup
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount
  
  // Watch store loading states and hide timeout message when both are done
  useEffect(() => {
    if (initialFetchTriggered && !isLoading && !isBudgetLoading) {
      setShowTimeoutMessage(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }
  }, [initialFetchTriggered, isLoading, isBudgetLoading]);

  // Update filtered envelopes when data changes
  useEffect(() => {
    const filtered = envelopes
      .filter(env => 
        !env.isPiggybank && 
        env.isActive !== false &&
        envelopeAllocations.some(alloc => alloc.envelopeId === env.id)
      )
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? 0;
        const bOrder = b.orderIndex ?? 0;
        return aOrder - bOrder;
      });

    setLocalEnvelopes(filtered);
    localOrderRef.current = filtered;
  }, [envelopes, envelopeAllocations]);

  // Calculate available to budget
  const availableToBudget = calculateAvailableToBudget();

  // Persist reorder functionality
  const persistReorder = useCallback(async (orderedEnvelopes: typeof envelopes) => {
    if (!orderedEnvelopes.length) return;
    const orderedIds = orderedEnvelopes.map(env => env.id);
    try {
      await reorderEnvelopes(orderedIds);
    } catch (error) {
      console.error('Failed to persist envelope order:', error);
      showToast('Failed to save envelope order', 'error');
    }
  }, [reorderEnvelopes, showToast]);

  // Reorder envelopes function
  const reorderEnvelopesList = useCallback(async (orderedEnvelopes: typeof envelopes) => {
    await persistReorder(orderedEnvelopes);
  }, [persistReorder]);

  // Delete income source with toast
  const deleteIncomeSourceWithToast = useCallback((incomeSource: IncomeSource) => {
    const sourceIndex = incomeSources.findIndex(s => s.id === incomeSource.id);
    const sourceCopy = { ...incomeSource };

    deleteIncomeSource(incomeSource.id).catch(console.error);

    showToast(
      `Deleted "${incomeSource.name}"`,
      'neutral',
      () => restoreIncomeSource(sourceCopy, sourceIndex)
    );
  }, [incomeSources, deleteIncomeSource, restoreIncomeSource, showToast]);

  // Copy previous month with toast
  const copyFromPreviousMonthWithToast = useCallback(async () => {
    try {
      await copyFromPreviousMonth();
      showToast('Previous month budget copied', 'success');
    } catch (error) {
      console.error('Error copying previous month:', error);
      showToast('Failed to copy previous month', 'error');
    }
  }, [copyFromPreviousMonth, showToast]);

  // Clear month data with toast
  const clearMonthDataWithToast = useCallback(async () => {
    try {
      await clearMonthData();
      showToast(
        `"${currentMonth}" budget cleared`,
        'neutral',
        () => showToast('Cannot undo "Start Fresh" after 30 seconds', 'error')
      );
    } catch (error) {
      console.error('Error clearing month data:', error);
      showToast('Failed to clear month data', 'error');
    }
  }, [clearMonthData, currentMonth, showToast]);

  return {
    // Data
    visibleEnvelopes,
    piggybanks,
    incomeSources,
    availableToBudget,
    currentMonth,
    envelopeAllocations,
    transactions,
    
    // Loading states
    isLoading,
    isInitialLoading,
    isOnline,
    showTimeoutMessage,
    pendingSync,
    
    // Functions
    getEnvelopeBalance,
    fetchData,
    fetchMonthlyData,
    syncData,
    reorderEnvelopes: reorderEnvelopesList,
    deleteIncomeSource: deleteIncomeSourceWithToast,
    restoreIncomeSource,
    clearMonthData: clearMonthDataWithToast,
    copyFromPreviousMonth: copyFromPreviousMonthWithToast,
    setEnvelopeAllocation,
    testingConnectivity,
    
    // Local state refs for reordering
    localOrderRef,
    setLocalEnvelopes
  };
};
