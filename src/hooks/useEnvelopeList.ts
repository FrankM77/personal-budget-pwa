import { useEffect, useState, useRef, useCallback } from 'react';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import type { IncomeSource } from '../models/types';
import logger from '../utils/logger';

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
  
  // State for reorder list of piggybanks
  const [localPiggybanks, setLocalPiggybanks] = useState<typeof envelopes>([]);
  const localPiggybankOrderRef = useRef<typeof envelopes>([]);

  // Function to get envelope balance 
  const getEnvelopeBalance = useCallback((envelopeId: string) => {
    // Check if this is a piggybank
    const envelope = envelopes.find(e => e.id === envelopeId);
    
    if (envelope?.isPiggybank) {
      // For piggybanks, use store's cumulative balance (no month param)
      const balance = useBudgetStore.getState().getEnvelopeBalance(envelopeId);
      return balance; // Return as number
    }
    
    // For regular envelopes, use store's monthly balance (pass currentMonth)
    const balance = useBudgetStore.getState().getEnvelopeBalance(envelopeId, currentMonth);
    return balance; // Return as number
  }, [envelopes, currentMonth]);

  // Calculate piggybanks with sorting
  useEffect(() => {
    const filteredPiggybanks = envelopes.filter(env => {
      if (!env.isPiggybank || !env.isActive) return false;
      
      // If piggybank has a creation date, only show it from that month forward
      if (env.createdAt) {
        try {
          // Use safe conversion to handle various date formats
          const createdDate = safeDateConversion(env.createdAt);
          
          // Check if the date conversion was successful
          if (!createdDate) {
            logger.error(`🐷 Invalid creation date for piggybank ${env.name}:`, env.createdAt);
            return false; // Hide piggybanks with invalid dates
          }
          
          // Use local time methods to match currentMonth format
          const createdMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Only show if current viewing month is >= creation month
          return currentMonth >= createdMonth;
        } catch (error) {
          logger.error(`🐷 Error processing piggybank ${env.name}:`, error, {
            createdAt: env.createdAt,
            typeofCreatedAt: typeof env.createdAt
          });
          return false; // Hide piggybanks with processing errors
        }
      }
      
      // If no creation date, show it (legacy piggybanks)
      return true;
    }).sort((a, b) => {
      const aOrder = a.orderIndex ?? 0;
      const bOrder = b.orderIndex ?? 0;
      return aOrder - bOrder;
    });

    setLocalPiggybanks(filteredPiggybanks);
    localPiggybankOrderRef.current = filteredPiggybanks;
  }, [envelopes, currentMonth]);

  // Separate piggybanks from regular envelopes
  const piggybanks = localPiggybanks;

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
      .filter(env => {
        // Piggybanks are handled separately
        if (env.isPiggybank) return false;
        
        // Respect global active flag
        if (env.isActive === false) return false;

        // Check if envelope has an allocation for the current month
        const monthAllocations = allocations[currentMonth] || [];
        const hasAllocation = monthAllocations.some(a => a.envelopeId === env.id);

        // Check if envelope has transactions for the current month
        const hasTransactions = transactions.some(t => 
          t.envelopeId === env.id && 
          (t.month === currentMonth || t.date.startsWith(currentMonth))
        );

        // Visible if it has an allocation or transactions in this month
        return hasAllocation || hasTransactions;
      })
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? 0;
        const bOrder = b.orderIndex ?? 0;
        return aOrder - bOrder;
      });

    setLocalEnvelopes(filtered);
    localOrderRef.current = filtered;
  }, [envelopes, allocations, currentMonth, transactions]);

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
      logger.error('Failed to persist envelope order:', error);
      showToast('Failed to save envelope order', 'error');
    }
  }, [reorderEnvelopes, showToast]);

  // Reorder envelopes function
  const reorderEnvelopesList = useCallback(async (orderedEnvelopes: typeof envelopes) => {
    await persistReorder(orderedEnvelopes);
  }, [persistReorder]);

  // Delete income source with toast
  const deleteIncomeSourceWithToast = useCallback((incomeSource: IncomeSource) => {
    deleteIncomeSource(currentMonth, incomeSource.id).catch(logger.error);

    showToast(
      `Deleted "${incomeSource.name}"`,
      'neutral'
    );
  }, [deleteIncomeSource, currentMonth, showToast]);

  // Copy previous month with toast
  const copyFromPreviousMonthWithToast = useCallback(async (targetMonth?: string) => {
    try {
      const monthToUse = targetMonth || currentMonth;
      logger.log('🔧 Copying to month:', monthToUse);
      await copyPreviousMonthAllocations(monthToUse);
      showToast('Previous month budget copied', 'success');
    } catch (error) {
      logger.error('Error copying previous month:', error);
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
      // Clear allocations and income sources for current month via store action
      await useBudgetStore.getState().clearMonthData(currentMonth);
      
      showToast(
        `"${currentMonth}" budget and transactions cleared successfully`,
        'success'
      );
    } catch (error) {
      logger.error('Error clearing month data:', error);
      showToast('Failed to clear month data', 'error');
    }
  }, [currentUser, currentMonth, showToast]);

  // Wrap setEnvelopeAllocation to add toast logic
  const setEnvelopeAllocationWithToast = useCallback(async (envelopeId: string, budgetedAmount: number) => {
    try {
      await setEnvelopeAllocation(envelopeId, budgetedAmount);
      
      // Check if over budget after the update
      // We use a small timeout to let the store update and recalculate
      setTimeout(() => {
        const state = useBudgetStore.getState();
        const month = state.currentMonth;
        const sources = state.incomeSources[month] || [];
        const rawAllocs = state.allocations[month] || [];
        
        // Filter allocations to match UI logic (exclude inactive/hidden envelopes)
        const activeEnvelopeIds = new Set(
            state.envelopes
                .filter(e => {
                    // Piggybank Logic
                    if (e.isPiggybank) {
                        if (!e.isActive) return false; // Must be explicitly active
                        if (e.createdAt) {
                             const createdDate = safeDateConversion(e.createdAt);
                             if (!createdDate) return false;
                             const createdMonth = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
                             return month >= createdMonth;
                        }
                        return true;
                    }
                    // Regular Envelope Logic
                    return e.isActive !== false; // Default to true
                })
                .map(e => e.id)
        );

        const allocs = rawAllocs.filter(a => activeEnvelopeIds.has(a.envelopeId));
        
        const totalInc = sources.reduce((sum, s) => sum + s.amount, 0);
        const totalAlloc = allocs.reduce((sum, a) => sum + a.budgetedAmount, 0);
        
        if (totalInc - totalAlloc < -0.005) {
          showToast("You can't spend more than you make.\nYou're not in Congress!", 'error');
        } else if (Math.abs(totalInc - totalAlloc) < 0.005 && totalInc > 0) {
          showToast("Every dollar has a job 🎯", 'success');
        }
      }, 100);
    } catch (error) {
      logger.error('Failed to set allocation:', error);
      showToast('Failed to update budget', 'error');
    }
  }, [setEnvelopeAllocation, showToast]);

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
    
    // Functions
    getEnvelopeBalance,
    fetchData,
    reorderEnvelopes: reorderEnvelopesList,
    deleteIncomeSource: deleteIncomeSourceWithToast,
    clearMonthData: clearMonthDataWithToast,
    copyFromPreviousMonth: copyFromPreviousMonthWithToast,
    setEnvelopeAllocation: setEnvelopeAllocationWithToast,
    
    // Local state refs for reordering
    localOrderRef,
    setLocalEnvelopes,
    localPiggybankOrderRef,
    setLocalPiggybanks
  };
};
