import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PlusCircle, Wallet, Wifi, WifiOff, RefreshCw, PiggyBank, ChevronUp, ChevronDown, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Moveable from 'moveable';
import { useEnvelopeList } from '../hooks/useEnvelopeList';
import { MonthSelector } from '../components/ui/MonthSelector';
import { AvailableToBudget } from '../components/ui/AvailableToBudget';
import { UserMenu } from '../components/ui/UserMenu';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import StartFreshConfirmModal from '../components/modals/StartFreshConfirmModal';
import CopyPreviousMonthPrompt from '../components/ui/CopyPreviousMonthPrompt';
import { PiggybankListItem } from '../components/PiggybankListItem';
import { useBudgetStore } from '../stores/budgetStore';
import { useNavigate } from 'react-router-dom';
import type { IncomeSource } from '../models/types';

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
                (typeof remainingBalance === 'number' ? remainingBalance : remainingBalance.toNumber()) < 0
                  ? 'text-red-500'
                  : (100 - percentage) <= 5
                    ? 'text-red-500'
                    : percentage >= 80
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-emerald-400'
              }`}>
              ${(typeof remainingBalance === 'number' ? remainingBalance : remainingBalance.toNumber()).toFixed(2)}
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
                        (typeof remainingBalance === 'number' ? remainingBalance : remainingBalance.toNumber()) < 0
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
  // Use the new hook that contains all business logic
  const { 
    visibleEnvelopes, 
    piggybanks, 
    incomeSources,
    availableToBudget,
    currentMonth,
    allocations,
    transactions,
    isLoading,
    isInitialLoading,
    isOnline,
    showTimeoutMessage,
    getEnvelopeBalance,
    reorderEnvelopes,
    deleteIncomeSource,
    clearMonthData,
    copyFromPreviousMonth,
    setEnvelopeAllocation,
    localOrderRef,
    setLocalEnvelopes,
    localPiggybankOrderRef,
    setLocalPiggybanks
  } = useEnvelopeList();

  // Get setCurrentMonth directly from store for month selector
  const { setMonth } = useBudgetStore();
  const navigate = useNavigate();

  // Local state for modals and UI
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [startFreshModalVisible, setStartFreshModalVisible] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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



  // Effect to handle Copy Previous Month Prompt visibility
  useEffect(() => {
    // Only check for copy prompt after initial loading is complete AND data has had time to load
    if (!isInitialLoading && !isLoading) {
      // Add a small delay to ensure data is loaded from backend
      const timer = setTimeout(() => {
        const hasNoData = (incomeSources[currentMonth] || []).length === 0 && (allocations[currentMonth] || []).length === 0;
        console.log('🔍 Copy prompt check:', { 
          currentMonth, 
          hasIncome: (incomeSources[currentMonth] || []).length > 0,
          hasAllocations: (allocations[currentMonth] || []).length > 0,
          showPrompt: hasNoData 
        });
        setShowCopyPrompt(hasNoData);
      }, 500); // 500ms delay to allow data to load
      
      return () => clearTimeout(timer);
    }
  }, [isInitialLoading, isLoading, incomeSources, allocations, currentMonth]);

  // Effect to auto-focus the input when editing starts
  useEffect(() => {
    if (editingEnvelopeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingEnvelopeId]);

  // Callback ref for Moveable elements
  const setMoveableRef = useCallback((envelopeId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      moveableRefs.current[envelopeId] = el;
    } else {
      delete moveableRefs.current[envelopeId];
    }
  }, []);
  
  // Callback ref for Piggybank Moveable elements
  const setPiggybankMoveableRef = useCallback((envelopeId: string) => (el: HTMLDivElement | null) => {
    if (el) {
      piggybankMoveableRefs.current[envelopeId] = el;
    } else {
      delete piggybankMoveableRefs.current[envelopeId];
    }
  }, []);

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

  // Moveable refs and instances for Piggybanks
  const piggybankMoveableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const piggybankMoveableInstances = useRef<{ [key: string]: Moveable | null }>({});
  const piggybankReorderConstraintsRef = useRef<HTMLDivElement | null>(null);
  const [activelyDraggingPiggybankId, setActivelyDraggingPiggybankId] = useState<string | null>(null);
  const piggybankMoveableDragState = useRef<{ 
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

  const [isReordering, setIsReordering] = useState(false);
  const reorderConstraintsRef = useRef<HTMLDivElement | null>(null);
  const lastDragEndTime = useRef<number>(0);
  

  const handleDragStart = useCallback(() => setIsReordering(true), []);

  const handleDragEnd = useCallback(() => {
    setIsReordering(false);
    if (localOrderRef.current.length) {
      reorderEnvelopes(localOrderRef.current);
    }
  }, [reorderEnvelopes]);

  const handleItemDragStart = useCallback((_id: string) => {
    // Item-specific drag start handler (currently just for tracking)
  }, []);

  const handleEnvelopeClick = useCallback((envelopeId: string) => {
    if (editingEnvelopeId !== envelopeId) {
      navigate(`/envelope/${envelopeId}`);
    }
  }, [editingEnvelopeId, navigate]);

  // Piggybank Drag Handlers
  const handlePiggybankDragStart = useCallback(() => setIsReordering(true), []);

  const handlePiggybankDragEnd = useCallback(() => {
    setIsReordering(false);
    if (localPiggybankOrderRef.current.length) {
      reorderEnvelopes(localPiggybankOrderRef.current);
    }
  }, [reorderEnvelopes]);

  // Initialize Moveable instances for Piggybanks
  useEffect(() => {
    const destroyMoveables = () => {
      Object.values(piggybankMoveableInstances.current).forEach(instance => instance?.destroy());
      piggybankMoveableInstances.current = {};
    };

    if (!piggybanks.length) {
      return;
    }

    const initializeMoveable = () => {
      // Only initialize Moveable if reordering is unlocked
      if (!isReorderUnlocked) return;

      piggybanks.forEach((piggybank) => {
        const element = piggybankMoveableRefs.current[piggybank.id];
        if (!element) return;

        const existingInstance = piggybankMoveableInstances.current[piggybank.id];
        if (existingInstance) {
          existingInstance.target = element;
          return;
        }

        // Use piggybankReorderConstraintsRef as container
        const moveable = new Moveable(piggybankReorderConstraintsRef.current!, {
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

        moveable.on('dragStart', (e: any) => {
          const startIndex = localPiggybankOrderRef.current.findIndex(p => p.id === piggybank.id);
          const targetEl = e.target as HTMLElement;
          const rect = targetEl.getBoundingClientRect();
          const itemHeight = rect.height + MOVEABLE_ITEM_GAP;
          
          setActivelyDraggingPiggybankId(piggybank.id);
          piggybankMoveableDragState.current = {
            activeId: piggybank.id,
            startIndex,
            currentIndex: startIndex,
            itemHeight
          };
          
          if (targetEl) {
            targetEl.style.transition = 'none';
            targetEl.style.boxShadow = '0 18px 45px rgba(15,23,42,0.35)';
            targetEl.style.zIndex = '20';
          }
          handlePiggybankDragStart();
        });

        let rafId: number | null = null;
        moveable.on('drag', (e: any) => {
          const targetEl = e.target as HTMLElement;
          
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
          }
          
          rafId = requestAnimationFrame(() => {
            const dragState = piggybankMoveableDragState.current;
            if (dragState.activeId !== piggybank.id) return;

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
              localPiggybankOrderRef.current.length - 1
            );

            // Update other items' positions to make space
            if (targetIndex !== dragState.currentIndex) {
              dragState.currentIndex = targetIndex;
              
              // Apply visual offsets to other items
              localPiggybankOrderRef.current.forEach((p, idx) => {
                if (p.id === piggybank.id) return;
                
                const otherEl = piggybankMoveableRefs.current[p.id];
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

        moveable.on('dragEnd', (e: any) => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          
          const targetEl = e.target as HTMLElement;
          const dragState = piggybankMoveableDragState.current;
          const { startIndex, currentIndex } = dragState;
          
          // Clear all transforms
          targetEl.style.transform = '';
          targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease';
          targetEl.style.boxShadow = '';
          
          // Clear transforms on other items
          localPiggybankOrderRef.current.forEach((p) => {
            if (p.id === piggybank.id) return;
            const otherEl = piggybankMoveableRefs.current[p.id];
            if (otherEl) {
              otherEl.style.transform = '';
              otherEl.style.transition = '';
            }
          });
          
          // Reorder the array if position changed
          if (startIndex !== currentIndex) {
            const updated = [...localPiggybankOrderRef.current];
            const [item] = updated.splice(startIndex, 1);
            updated.splice(currentIndex, 0, item);
            localPiggybankOrderRef.current = updated;
            setLocalPiggybanks(updated);
          }
          
          // Cleanup after animation
          setTimeout(() => {
            targetEl.style.zIndex = '';
            targetEl.style.transition = '';
            setActivelyDraggingPiggybankId(null);
          }, 300);
          
          piggybankMoveableDragState.current = { activeId: null, startIndex: 0, currentIndex: 0, itemHeight: 0 };
          handlePiggybankDragEnd();
        });
        
        // Handle click events from Moveable
        moveable.on('click', (e: any) => {
          // Check if the click originated from interaction elements
          const target = e.inputEvent.target as HTMLElement;
          if (target.closest('.js-budget-target') || target.tagName === 'INPUT' || target.tagName === 'BUTTON') {
            return;
          }
          handleEnvelopeClick(piggybank.id);
        });

        piggybankMoveableInstances.current[piggybank.id] = moveable;
      });
    };

    const timeoutId = window.setTimeout(initializeMoveable, 80);

    return () => {
      clearTimeout(timeoutId);
      destroyMoveables();
    };
  }, [piggybanks, handlePiggybankDragStart, handlePiggybankDragEnd, handleEnvelopeClick, isReorderUnlocked]);


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

        moveable.on('dragStart', (e: any) => {
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
        moveable.on('drag', (e: any) => {
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

        moveable.on('dragEnd', (e: any) => {
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
        moveable.on('click', (e: any) => {
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



  
    // Handler to save the inline budget edit
    const handleBudgetSave = async () => {
      if (!editingEnvelopeId) return;
  
      try {
          const newAmount = parseFloat(editingAmount) || 0;
          await setEnvelopeAllocation(editingEnvelopeId, newAmount);
      } catch (error) {
          console.error("Failed to save budget amount:", error);
          // showToast is now handled in the hook
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

    deleteIncomeSource(incomeSource);

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
    setStartFreshModalVisible(false);
    await clearMonthData();
  };

  const handleCopyPreviousMonth = async () => {
    setShowCopyPrompt(false);
    await copyFromPreviousMonth(currentMonth);
  };


  // Show loading screen during initial data fetch
  if (isInitialLoading) {
    return (
      <LoadingScreen 
        message={showTimeoutMessage ? "Still loading... This is normal on slow connections" : "Loading your budget..."}
        showTimeout={showTimeoutMessage}
      />
    );
  }

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
                  {isLoading ? 'Saving...' : 'Offline'}
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
          totalIncome={(incomeSources[currentMonth] || []).reduce((sum, source) => sum + source.amount, 0)}
          totalAllocated={(allocations[currentMonth] || [])
            .filter(allocation => visibleEnvelopes.some((env: any) => env.id === allocation.envelopeId) || piggybanks.some((piggybank: any) => piggybank.id === allocation.envelopeId))
            .reduce((sum, allocation) => sum + allocation.budgetedAmount, 0)}
          isLoading={isLoading}
          variant="header"
        />

        {/* Month Selector */}
        <MonthSelector
          currentMonth={currentMonth}
          onMonthChange={(newMonth) => {
            setShowCopyPrompt(false);
            setMonth(newMonth);
          }}
        />
      </header>


    <div className="pt-[calc(10rem+env(safe-area-inset-top))] p-4 max-w-md mx-auto space-y-6">
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
        {(incomeSources[currentMonth] || []).length === 0 ? (
          <div className="text-center py-6"><p className="text-gray-500 dark:text-zinc-400 text-sm">No income sources yet. Add your monthly income.</p></div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {(incomeSources[currentMonth] || []).map((source) => (
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
        )
      }
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
              {visibleEnvelopes.length === 0 
                ? "No envelopes added to this month. Copy from previous month or add new ones."
                : "No envelopes yet. Create one to get started."}
            </p>
            <button onClick={() => navigate('/add-envelope')} className="text-blue-600 dark:text-blue-300 font-medium hover:text-blue-700 dark:hover:text-blue-200 transition-colors">Create First Envelope</button>
          </div>
         ) : (
           <div ref={reorderConstraintsRef}>
             <AnimatePresence initial={false}>
               <div className="space-y-3">
                 {visibleEnvelopes.map((env: any, index: number) => {
                   const allocation = (allocations[currentMonth] || []).find(alloc => alloc.envelopeId === env.id);
                   const budgetedAmount = allocation?.budgetedAmount || 0;
                   const remainingBalance = getEnvelopeBalance(env.id);

                   const handleMoveUp = () => {
                     if (index === 0) return;
                     const newOrder = [...localOrderRef.current];
                     [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                     localOrderRef.current = newOrder;
                     setLocalEnvelopes(newOrder);
                     reorderEnvelopes(newOrder);
                   };

                   const handleMoveDown = () => {
                     if (index === visibleEnvelopes.length - 1) return;
                     const newOrder = [...localOrderRef.current];
                     [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                     localOrderRef.current = newOrder;
                     setLocalEnvelopes(newOrder);
                     reorderEnvelopes(newOrder);
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
           <div ref={piggybankReorderConstraintsRef} className="relative">
             <AnimatePresence initial={false}>
               <div className="space-y-3">
                 {piggybanks.map((piggybank: any, index: number) => {
                   const handleMoveUp = () => {
                     if (index === 0) return;
                     const newOrder = [...localPiggybankOrderRef.current];
                     [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                     localPiggybankOrderRef.current = newOrder;
                     setLocalPiggybanks(newOrder);
                     reorderEnvelopes(newOrder);
                   };

                   const handleMoveDown = () => {
                     if (index === piggybanks.length - 1) return;
                     const newOrder = [...localPiggybankOrderRef.current];
                     [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                     localPiggybankOrderRef.current = newOrder;
                     setLocalPiggybanks(newOrder);
                     reorderEnvelopes(newOrder);
                   };

                   return (
                     <PiggybankListItem
                       key={piggybank.id}
                       piggybank={piggybank}
                       balance={getEnvelopeBalance(piggybank.id)}
                       onNavigate={(id) => navigate(`/envelope/${id}`)}
                       setMoveableRef={setPiggybankMoveableRef(piggybank.id)}
                       isReorderingActive={isReordering}
                       activelyDraggingId={activelyDraggingPiggybankId}
                       onItemDragStart={() => {}}
                       onMoveUp={handleMoveUp}
                       onMoveDown={handleMoveDown}
                       isFirst={index === 0}
                       isLast={index === piggybanks.length - 1}
                       isReorderUnlocked={isReorderUnlocked}
                     />
                   );
                 })}
               </div>
             </AnimatePresence>
           </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
              <PiggyBank size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No piggybanks yet</p>
              <p className="text-xs mt-1">Click the + button above to create your first piggybank</p>
            </div>
          )}
      </section>

      <button
        onClick={() => navigate('/add-transaction')}
        className="fixed bottom-32 right-6 md:bottom-20 bg-blue-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-transform z-40 pointer-events-auto"
      >
        <PlusCircle size={28} />
      </button>

      <IncomeSourceModal isVisible={incomeModalVisible} onClose={handleCloseModal} mode={incomeModalMode} initialIncomeSource={selectedIncomeSource} />
      
      {/* This modal is no longer used for editing, but we'll leave it for now in case it's needed elsewhere. */}
      {/* <EnvelopeAllocationModal isVisible={envelopeAllocationModalVisible} onClose={handleCloseEnvelopeAllocationModal} initialAllocation={selectedEnvelopeAllocation} getEnvelopeName={(envelopeId: string) => visibleEnvelopes.find((e: any) => e.id === envelopeId)?.name || ''} /> */}

        <StartFreshConfirmModal 
          isVisible={startFreshModalVisible} 
          onClose={() => setStartFreshModalVisible(false)} 
          onConfirm={handleStartFreshConfirm} 
          currentMonth={currentMonth} 
          incomeCount={(incomeSources[currentMonth] || []).length} 
          totalIncome={(incomeSources[currentMonth] || []).reduce((sum, s) => sum + s.amount, 0)} 
          allocationCount={(allocations[currentMonth] || []).filter(a => visibleEnvelopes.some((env: any) => env.id === a.envelopeId) || piggybanks.some((piggybank: any) => piggybank.id === a.envelopeId)).length} 
          totalAllocated={(allocations[currentMonth] || []).filter(a => visibleEnvelopes.some((env: any) => env.id === a.envelopeId) || piggybanks.some((piggybank: any) => piggybank.id === a.envelopeId)).reduce((sum, a) => sum + a.budgetedAmount, 0)}
          transactionCount={transactions.filter(t => t.month === currentMonth).length}
          totalTransactionAmount={transactions.filter(t => t.month === currentMonth).reduce((sum, t) => sum + t.amount, 0)}
        />
      </div>
    </div>
    </>
  );
};
