import { useEffect, useState, useRef, useCallback } from 'react';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { monthlyBudgetService } from '../services/MonthlyBudgetService';
import { Decimal } from 'decimal.js';
import type { IncomeSource } from '../models/types';

// Helper function to safely convert various date formats to JavaScript Date
const safeDateConversion = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  // Handle standard Date objects
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle Firestore Timestamp objects with toDate() method
  if (typeof dateValue === 'object' && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Handle raw Firestore Timestamp objects with seconds property
  if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
    return new Date(dateValue.seconds * 1000);
  }
  
  // Handle string dates
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }
  
  // Handle numeric timestamps (milliseconds)
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }
  
  return null;
};

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
  } = useBudgetStore();

  // Auth store (for current user)
  const { currentUser } = useAuthStore();

  // Monthly budget store (for zero-based budgeting features)
  const {
    currentMonth,
    incomeSources,
    allocations,
    deleteIncomeSource,
    setEnvelopeAllocation,
    copyPreviousMonthAllocations,
    isLoading: isBudgetLoading,
  } = useBudgetStore();

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
      return useBudgetStore.getState().getEnvelopeBalance(envelopeId);
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
      try {
        // Use safe conversion to handle various date formats
        const createdDate = safeDateConversion(env.createdAt);
        
        // Check if the date conversion was successful
        if (!createdDate) {
          console.error(`🐷 Invalid creation date for piggybank ${env.name}:`, env.createdAt);
          return false; // Hide piggybanks with invalid dates
        }
        
        // Use local time methods to match currentMonth format
        const createdMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Only show if current viewing month is >= creation month
        return currentMonth >= createdMonth;
      } catch (error) {
        console.error(`🐷 Error processing piggybank ${env.name}:`, error, {
          createdAt: env.createdAt,
          typeofCreatedAt: typeof env.createdAt
        });
        return false; // Hide piggybanks with processing errors
      }
    }
    
    // If no creation date, show it (legacy piggybanks)
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

    // Trigger data fetch - it handles its own loading state
    fetchData();
    
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
        env.isActive !== false
        // Show all envelopes by default - the allocation filter was too restrictive
        // Users should see all their envelopes regardless of allocations
      )
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? 0;
        const bOrder = b.orderIndex ?? 0;
        return aOrder - bOrder;
      });

    setLocalEnvelopes(filtered);
    localOrderRef.current = filtered;
  }, [envelopes, allocations, currentMonth]);

  // Calculate available to budget - match the UI logic in AvailableToBudget component
  const totalIncome = (incomeSources[currentMonth] || []).reduce((sum, source) => sum + source.amount, 0);
  const totalAllocated = (allocations[currentMonth] || [])
    .filter(allocation => visibleEnvelopes.some((env: any) => env.id === allocation.envelopeId) || piggybanks.some((piggybank: any) => piggybank.id === allocation.envelopeId))
    .reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);
  const availableToBudget = totalIncome - totalAllocated;

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
    deleteIncomeSource(currentMonth, incomeSource.id).catch(console.error);

    showToast(
      `Deleted "${incomeSource.name}"`,
      'neutral'
    );
  }, [deleteIncomeSource, currentMonth, showToast]);

  // Copy previous month with toast
  const copyFromPreviousMonthWithToast = useCallback(async (targetMonth?: string) => {
    try {
      const monthToUse = targetMonth || currentMonth;
      console.log('🔧 Copying to month:', monthToUse);
      await copyPreviousMonthAllocations(monthToUse);
      showToast('Previous month budget copied', 'success');
    } catch (error) {
      console.error('Error copying previous month:', error);
      showToast('Failed to copy previous month', 'error');
    }
  }, [copyPreviousMonthAllocations, showToast, currentMonth]);

  // Clear month data with toast
  const clearMonthDataWithToast = useCallback(async () => {
    if (!currentUser || !currentMonth) {
      showToast('Cannot clear data: not logged in or no month selected', 'error');
      return;
    }

    try {
      // Clear allocations and income sources for current month
      await monthlyBudgetService.clearMonthData(currentUser.id, currentMonth);
      
      // Refresh data to reflect changes
      await fetchData();
      
      showToast(
        `"${currentMonth}" budget cleared successfully`,
        'success'
      );
    } catch (error) {
      console.error('Error clearing month data:', error);
      showToast('Failed to clear month data', 'error');
    }
  }, [currentUser, currentMonth, fetchData, showToast]);

  return {
    // Data
    visibleEnvelopes,
    piggybanks,
    incomeSources,
    availableToBudget,
    currentMonth,
    allocations,
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
    syncData,
    reorderEnvelopes: reorderEnvelopesList,
    deleteIncomeSource: deleteIncomeSourceWithToast,
    clearMonthData: clearMonthDataWithToast,
    copyFromPreviousMonth: copyFromPreviousMonthWithToast,
    setEnvelopeAllocation,
    testingConnectivity,
    
    // Local state refs for reordering
    localOrderRef,
    setLocalEnvelopes
  };
};
