import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PlusCircle, Wallet, Wifi, WifiOff, RefreshCw, PiggyBank, ChevronUp, ChevronDown, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Moveable from 'moveable';
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
import { PiggybankListItem } from '../components/PiggybankListItem';
import { useToastStore } from '../stores/toastStore';
import { useNavigate } from 'react-router-dom';
import type { IncomeSource } from '../models/types';
import { Decimal } from 'decimal.js';

// Helper to convert hex color to rgba (used for piggybank accents)
const hexToRgba = (hex: string, alpha = 1) => {
  const normalizedHex = hex.replace('#', '');
  const bigint = parseInt(normalizedHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MOVEABLE_ITEM_GAP = 12;
const clampValue = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

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
  transactions,
  currentMonth,
  setMoveableRef,
  isReorderingActive,
  activelyDraggingId,
  onItemDragStart,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isReorderUnlocked
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
  transactions: any[],
  currentMonth: string,
  setMoveableRef: (envelopeId: string) => (el: HTMLDivElement | null) => void,
  isReorderingActive: boolean,
  activelyDraggingId: string | null,
  onItemDragStart: (id: string) => void,
  onMoveUp: () => void,
  onMoveDown: () => void,
  isFirst: boolean,
  isLast: boolean,
  isReorderUnlocked: boolean
}) => {
  const isPiggybank = Boolean(env.isPiggybank);
  const piggyColor = env.piggybankConfig?.color || '#3B82F6';
  const piggyBackground = isPiggybank
    ? `linear-gradient(135deg, ${hexToRgba(piggyColor, 0.18)} 0%, ${hexToRgba(piggyColor, 0.08)} 100%)`
    : undefined;
  const piggyBorder = isPiggybank ? hexToRgba(piggyColor, 0.5) : undefined;
  const moveableItemRef = useRef<HTMLDivElement>(null);
  const [didDragThisItem, setDidDragThisItem] = useState(false);

  // Calculate percentage for both background color and progress bar
  const envelopeTransactions = transactions.filter(t => 
    t.envelopeId === env.id && t.month === currentMonth
  );
  const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
  const incomes = envelopeTransactions.filter(t => t.type === 'Income');
  const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const percentage = Math.max(0, (totalSpent / totalIncome) * 100);



  const handleMoveableClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't navigate if we just dragged this item or if currently reordering
    if (didDragThisItem || isReorderingActive) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Don't navigate if editing this envelope's budget
    if (editingEnvelopeId === env.id) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Navigate to envelope details
    navigate(`/envelope/${env.id}`);
  };

  // Reset drag flag when it changes from another item
  useEffect(() => {
    if (activelyDraggingId && activelyDraggingId !== env.id) {
      setDidDragThisItem(false);
    }
  }, [activelyDraggingId, env.id]);

  // Handle drag start for this item
  useEffect(() => {
    if (activelyDraggingId === env.id) {
      setDidDragThisItem(true);
      onItemDragStart(env.id);
    }
  }, [activelyDraggingId, env.id, onItemDragStart]);

  // Clear drag flag after a delay when drag ends
  useEffect(() => {
    if (!activelyDraggingId && didDragThisItem) {
      const timer = setTimeout(() => {
        setDidDragThisItem(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activelyDraggingId, didDragThisItem]);

  const content = (
    <div className="flex items-center gap-2 w-full">
      {/* Reorder Buttons - only show when unlocked */}
      {isReorderUnlocked && (
      <div className="flex flex-col gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={isFirst}
          className={`p-1 rounded transition-colors ${
            isFirst
              ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
              : 'text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
          title="Move up"
          aria-label="Move envelope up"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={isLast}
          className={`p-1 rounded transition-colors ${
            isLast
              ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
              : 'text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
          title="Move down"
          aria-label="Move envelope down"
        >
          <ChevronDown size={18} />
        </button>
      </div>
      )}
      {/* Content Wrapper */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {isPiggybank && (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center border"
              style={{
                borderColor: hexToRgba(piggyColor, 0.4),
                backgroundColor: hexToRgba(piggyColor, 0.15),
                color: piggyColor
              }}
            >
              <PiggyBank size={16} />
            </span>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {env.name}
            </h3>
            {isPiggybank && (
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: piggyColor }}
              >
                Piggybank
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div
            className="flex items-center space-x-4"
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
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingEnvelopeId(env.id);
                  setEditingAmount(budgetedAmount.toString());
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingEnvelopeId(env.id);
                  setEditingAmount(budgetedAmount.toString());
                }}
                className="flex items-center space-x-1 hover:bg-gray-200 dark:hover:bg-zinc-700 px-3 py-2 rounded transition-colors cursor-pointer js-budget-target"
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
  );

  const isBeingDragged = activelyDraggingId === env.id;
  
  return (
    <motion.div
      layout={!isBeingDragged}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
      }}
      ref={(el) => {
        setMoveableRef(env.id)(el);
        moveableItemRef.current = el;
      }}
      onClick={handleMoveableClick}
      style={{
        boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
        background: piggyBackground,
        borderColor: piggyBorder,
        cursor: 'pointer'
      }}
      className={`p-4 rounded-xl active:scale-[0.99] transition-all select-none border ${
        isPiggybank ? 'bg-white/70 dark:bg-zinc-800/80' : 'bg-gray-50 dark:bg-zinc-800 border-transparent'
      }`}
    >
      {content}
    </motion.div>
  );
};

export const EnvelopeListView: React.FC = () => {
  // Envelope store (for envelopes and transactions)
  const { envelopes, transactions, fetchData, isLoading, isOnline, pendingSync, syncData, testingConnectivity, reorderEnvelopes } = useEnvelopeStore();

  // Callback ref for Moveable elements
  const setMoveableRef = useCallback((envelopeId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      moveableRefs.current[envelopeId] = el;
    } else {
      delete moveableRefs.current[envelopeId];
    }
  }, []);

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

  // State for reorder lock/unlock - persist in localStorage
  const [isReorderUnlocked, setIsReorderUnlocked] = useState(() => {
    const stored = localStorage.getItem('envelopeReorderUnlocked');
    return stored === 'true';
  });

  // Persist reorder unlock state to localStorage
  useEffect(() => {
    localStorage.setItem('envelopeReorderUnlocked', isReorderUnlocked.toString());
  }, [isReorderUnlocked]);

  // Function to get envelope balance for current month (matches store calculation)
  const getEnvelopeBalance = (envelopeId: string) => {
    // Calculate transactions for this envelope in the current month using reactive transactions
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
  const lastDragEndTime = useRef<number>(0);


  // Moveable refs and instances for new reordering system
  const moveableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const moveableInstances = useRef<{ [key: string]: Moveable | null }>({});
  const [activelyDraggingId, setActivelyDraggingId] = useState<string | null>(null);
  const moveableDragState = useRef<{ 
    activeId: string | null; 
    startIndex: number; 
    currentIndex: number;
    itemHeight: number;
  }>({
    activeId: null,
    startIndex: 0,
    currentIndex: 0,
    itemHeight: 0
  });
  
  // Envelopes should already be sorted by orderIndex from the store/service
  // Filter envelopes to only show those that have an allocation for the current month
  // We use a local state for the reorder list to allow smooth dragging
  const [localEnvelopes, setLocalEnvelopes] = useState<typeof envelopes>([]);
  const localOrderRef = useRef<typeof envelopes>([]);

  // Separate piggybanks from regular envelopes
  const piggybanks = envelopes.filter(env => env.isPiggybank === true && env.isActive);

  useEffect(() => {
    if (!isReordering) {
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
    }
  }, [envelopes, envelopeAllocations, isReordering]);

  const handleDragStart = useCallback(() => setIsReordering(true), []);

  const handleDragEnd = useCallback(() => {
    setIsReordering(false);
    if (localOrderRef.current.length) {
      persistReorder(localOrderRef.current);
    }
  }, [persistReorder]);

  const handleItemDragStart = useCallback((_id: string) => {
    // Item-specific drag start handler (currently just for tracking)
  }, []);

  const handleEnvelopeClick = useCallback((envelopeId: string) => {
    if (editingEnvelopeId !== envelopeId) {
      navigate(`/envelope/${envelopeId}`);
    }
  }, [editingEnvelopeId, navigate]);

  const visibleEnvelopes = localEnvelopes;

  // Initialize Moveable instances
  useEffect(() => {
    const destroyMoveables = () => {
      Object.values(moveableInstances.current).forEach(instance => instance?.destroy());
      moveableInstances.current = {};
    };

    if (!visibleEnvelopes.length) {
      return;
    }

    const initializeMoveable = () => {
      // Only initialize Moveable if reordering is unlocked
      if (!isReorderUnlocked) return;

      visibleEnvelopes.forEach((envelope) => {
        const element = moveableRefs.current[envelope.id];
        if (!element) return;

        const existingInstance = moveableInstances.current[envelope.id];
        if (existingInstance) {
          existingInstance.target = element;
          return;
        }

        const moveable = new Moveable(reorderConstraintsRef.current!, {
          target: element,
          draggable: isReorderUnlocked,
          throttleDrag: 0,
          edgeDraggable: false,
          startDragRotate: 0,
          throttleDragRotate: 0,
          rotatable: false,
          scalable: false,
          resizable: false,
          warpable: false,
          pinchable: false,
          snappable: true,
          snapThreshold: 5,
          isDisplaySnapDigit: false,
          isDisplayInnerSnapDigit: false,
          snapGap: true,
          snapDirections: {"top": true, "bottom": true, "left": false, "right": false},
          elementSnapDirections: {"top": true, "bottom": true, "left": false, "right": false},
          clickable: true,
          preventClickDefault: false,
          preventClickEventOnDrag: true,
          checkInput: false,
          dragArea: true,
          hideDefaultLines: true,
          hideChildMoveableDefaultLines: true,
          renderDirections: [],
        });

        moveable.on('dragStart', (e) => {
          const startIndex = localOrderRef.current.findIndex(env => env.id === envelope.id);
          const targetEl = e.target as HTMLElement;
          const rect = targetEl.getBoundingClientRect();
          const itemHeight = rect.height + MOVEABLE_ITEM_GAP;
          
          setActivelyDraggingId(envelope.id);
          moveableDragState.current = {
            activeId: envelope.id,
            startIndex,
            currentIndex: startIndex,
            itemHeight
          };
          
          if (targetEl) {
            targetEl.style.transition = 'none';
            targetEl.style.boxShadow = '0 18px 45px rgba(15,23,42,0.35)';
            targetEl.style.zIndex = '20';
          }
          handleDragStart();
        });

        let rafId: number | null = null;
        moveable.on('drag', (e) => {
          const targetEl = e.target as HTMLElement;
          
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
          }
          
          rafId = requestAnimationFrame(() => {
            const dragState = moveableDragState.current;
            if (dragState.activeId !== envelope.id) return;

            // Constrain to Y-axis only
            const translateY = e.beforeTranslate[1];
            targetEl.style.transform = `translateY(${translateY}px)`;
            targetEl.style.transition = 'none';

            // Calculate target index based on drag distance
            const { itemHeight, startIndex } = dragState;
            if (!itemHeight) return;
            
            const indexOffset = Math.round(translateY / itemHeight);
            const targetIndex = clampValue(
              startIndex + indexOffset,
              0,
              localOrderRef.current.length - 1
            );

            // Update other items' positions to make space
            if (targetIndex !== dragState.currentIndex) {
              dragState.currentIndex = targetIndex;
              
              // Apply visual offsets to other items
              localOrderRef.current.forEach((env, idx) => {
                if (env.id === envelope.id) return;
                
                const otherEl = moveableRefs.current[env.id];
                if (!otherEl) return;
                
                let offset = 0;
                if (startIndex < targetIndex) {
                  // Dragging down: shift items up
                  if (idx > startIndex && idx <= targetIndex) {
                    offset = -itemHeight;
                  }
                } else if (startIndex > targetIndex) {
                  // Dragging up: shift items down
                  if (idx >= targetIndex && idx < startIndex) {
                    offset = itemHeight;
                  }
                }
                
                otherEl.style.transform = offset ? `translateY(${offset}px)` : '';
                otherEl.style.transition = 'transform 0.2s ease';
              });
            }
            
            rafId = null;
          });
        });

        moveable.on('dragEnd', (e) => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          
          const targetEl = e.target as HTMLElement;
          const dragState = moveableDragState.current;
          const { startIndex, currentIndex } = dragState;
          
          // Clear all transforms
          targetEl.style.transform = '';
          targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease';
          targetEl.style.boxShadow = '';
          
          // Clear transforms on other items
          localOrderRef.current.forEach((env) => {
            if (env.id === envelope.id) return;
            const otherEl = moveableRefs.current[env.id];
            if (otherEl) {
              otherEl.style.transform = '';
              otherEl.style.transition = '';
            }
          });
          
          // Reorder the array if position changed
          if (startIndex !== currentIndex) {
            const updated = [...localOrderRef.current];
            const [item] = updated.splice(startIndex, 1);
            updated.splice(currentIndex, 0, item);
            localOrderRef.current = updated;
            setLocalEnvelopes(updated);
          }
          
          // Cleanup after animation
          setTimeout(() => {
            targetEl.style.zIndex = '';
            targetEl.style.transition = '';
            setActivelyDraggingId(null);
          }, 300);
          
          moveableDragState.current = { activeId: null, startIndex: 0, currentIndex: 0, itemHeight: 0 };
          lastDragEndTime.current = Date.now();
          handleDragEnd();
        });

        // Handle click events from Moveable
        moveable.on('click', (e) => {
          // Check if the click originated from the budget field
          const target = e.inputEvent.target as HTMLElement;
          if (target.closest('.js-budget-target') || target.tagName === 'INPUT') {
            return; // Don't navigate if clicking budget field
          }
          handleEnvelopeClick(envelope.id);
        });

        moveableInstances.current[envelope.id] = moveable;
      });
    };

    const timeoutId = window.setTimeout(initializeMoveable, 80);

    return () => {
      clearTimeout(timeoutId);
      destroyMoveables();
    };
  }, [visibleEnvelopes, handleDragStart, handleDragEnd, handleEnvelopeClick, isReorderUnlocked]);



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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .moveable-control { display: none !important; }
        .moveable-origin { display: none !important; }
        .moveable-line { display: none !important; }
      ` }} />
      <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1">
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
              onClick={() => setIsReorderUnlocked(!isReorderUnlocked)}
              className={`transition-colors ${
                isReorderUnlocked
                  ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                  : 'text-gray-500 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-300'
              }`}
              title={isReorderUnlocked ? 'Lock envelope order' : 'Unlock to reorder envelopes'}
            >
              {isReorderUnlocked ? <Unlock size={22} /> : <Lock size={22} />}
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

        {/* Available to Budget */}
        <AvailableToBudget
          amount={availableToBudget}
          totalIncome={incomeSources.reduce((sum, source) => sum + source.amount, 0)}
          totalAllocated={envelopeAllocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0)}
          isLoading={isLoading}
          variant="header"
        />

        {/* Month Selector */}
        <MonthSelector
          currentMonth={currentMonth}
          onMonthChange={(newMonth) => {
            setShowCopyPrompt(false);
            useMonthlyBudgetStore.getState().setCurrentMonth(newMonth);
          }}
        />
      </header>


    <div className="pt-40 p-4 max-w-md mx-auto space-y-6">
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

      {/* Piggybanks Section */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PiggyBank size={20} className="text-blue-600 dark:text-blue-400" />
            Piggybanks
          </h2>
          <button onClick={() => navigate('/add-envelope?type=piggybank')} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors" title="Create New Piggybank">
            <PlusCircle size={20} />
          </button>
        </div>
         {piggybanks.length > 0 ? (
           <div className="space-y-3">
             {piggybanks.map((piggybank) => (
               <PiggybankListItem
                 key={piggybank.id}
                 piggybank={piggybank}
                 balance={getEnvelopeBalance(piggybank.id)}
                 onNavigate={(id) => navigate(`/envelope/${id}`)}
               />
             ))}
           </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
              <PiggyBank size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No piggybanks yet</p>
              <p className="text-xs mt-1">Click the + button above to create your first piggybank</p>
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
             <AnimatePresence initial={false}>
               <div className="space-y-3">
                 {visibleEnvelopes.map((env, index) => {
                   const allocation = envelopeAllocations.find(alloc => alloc.envelopeId === env.id);
                   const budgetedAmount = allocation?.budgetedAmount || 0;
                   const remainingBalance = getEnvelopeBalance(env.id);

                   const handleMoveUp = () => {
                     if (index === 0) return;
                     const newOrder = [...localOrderRef.current];
                     [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                     localOrderRef.current = newOrder;
                     setLocalEnvelopes(newOrder);
                     persistReorder(newOrder);
                   };

                   const handleMoveDown = () => {
                     if (index === visibleEnvelopes.length - 1) return;
                     const newOrder = [...localOrderRef.current];
                     [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                     localOrderRef.current = newOrder;
                     setLocalEnvelopes(newOrder);
                     persistReorder(newOrder);
                   };

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
                       transactions={transactions}
                       currentMonth={currentMonth}
                       setMoveableRef={setMoveableRef}
                       isReorderingActive={isReordering}
                       activelyDraggingId={activelyDraggingId}
                       onItemDragStart={handleItemDragStart}
                       onMoveUp={handleMoveUp}
                       onMoveDown={handleMoveDown}
                       isFirst={index === 0}
                       isLast={index === visibleEnvelopes.length - 1}
                       isReorderUnlocked={isReorderUnlocked}
                     />
                   );
                 })}
               </div>
             </AnimatePresence>
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
    </>
  );
};
