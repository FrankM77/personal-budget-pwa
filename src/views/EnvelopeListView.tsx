import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Plus, Wallet, PiggyBank, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Moveable from 'moveable';
import { useLongPress, LongPressEventType } from 'use-long-press';
import { triggerHaptic } from '../utils/haptics';
import { useEnvelopeList } from '../hooks/useEnvelopeList';
import { MonthSelector } from '../components/ui/MonthSelector';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import CopyPreviousMonthPrompt from '../components/ui/CopyPreviousMonthPrompt';
import NewUserOnboarding from '../components/ui/NewUserOnboarding';
import { PiggybankListItem } from '../components/PiggybankListItem';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';
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
  navigate,
  transactions,
  currentMonth,
  setMoveableRef,
  isReorderingActive,
  activelyDraggingId,
  onItemDragStart,
  onLongPressTrigger
  }: {
  env: any,
  budgetedAmount: number,
  remainingBalance: any,
  navigate: (path: string) => void,
  transactions: any[],
  currentMonth: string,
  setMoveableRef: (envelopeId: string) => (el: HTMLDivElement | null) => void,
  isReorderingActive: boolean,
  activelyDraggingId: string | null,
  onItemDragStart: (id: string) => void,
  onLongPressTrigger: (e: any, id: string) => void
}) => {
  const isPiggybank = Boolean(env.isPiggybank);
  const piggyColor = env.piggybankConfig?.color || '#3B82F6';
  const piggyBackground = isPiggybank
    ? `linear-gradient(135deg, ${hexToRgba(piggyColor, 0.18)} 0%, ${hexToRgba(piggyColor, 0.08)} 100%)`
    : undefined;
  const piggyBorder = isPiggybank ? hexToRgba(piggyColor, 0.5) : undefined;
  const moveableItemRef = useRef<HTMLDivElement>(null);
  const [didDragThisItem, setDidDragThisItem] = useState(false);

  // long press for mobile reordering
  const bind = useLongPress((event) => {
    // Vibrate to indicate grab
    triggerHaptic();
    onLongPressTrigger(event, env.id);
  }, {
    threshold: 500, // Standard threshold
    cancelOnMovement: 25, // More forgiving movement cancellation
    detect: LongPressEventType.Touch
  });

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
    <div className="flex items-center gap-3 w-full">
      {/* Drag Handle - visible on hover for desktop */}
      <div 
        className="hidden md:flex items-center justify-center p-1 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-all duration-200"
        onMouseDown={(e) => onLongPressTrigger(e, env.id)}
      >
        <GripVertical size={20} />
      </div>

      {/* Content Wrapper */}
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {isPiggybank && (
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center border"
                style={{
                  borderColor: hexToRgba(piggyColor, 0.4),
                  backgroundColor: hexToRgba(piggyColor, 0.15),
                  color: piggyColor
                }}
              >
                <PiggyBank size={12} />
              </span>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {env.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-zinc-400">Budgeted:</span>
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">${budgetedAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-sm font-bold leading-none ${
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
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 block uppercase tracking-wider mt-0.5">Remaining</span>
          </div>
        </div>

        {/* Simplified Progress Bar - much thinner */}
        {budgetedAmount > 0 && (
          <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="w-full bg-gray-200 dark:bg-zinc-700/50 rounded-full h-0.5 overflow-hidden">
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
          </div>
        )}
      </div>
    </div>
  );

  const isBeingDragged = activelyDraggingId === env.id;
  
  return (
    <motion.div
      {...bind()}
      layout={!isBeingDragged}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
      }}
      data-envelope-id={env.id}
      ref={(el) => {
        setMoveableRef(env.id)(el);
        moveableItemRef.current = el;
      }}
      onClick={handleMoveableClick}
      style={{
        boxShadow: isBeingDragged ? '0 18px 45px rgba(15,23,42,0.35)' : '0 1px 2px rgba(15,23,42,0.08)',
        background: piggyBackground,
        borderColor: piggyBorder,
        cursor: isBeingDragged ? 'grabbing' : 'pointer',
        zIndex: isBeingDragged ? 50 : 1,
        scale: isBeingDragged ? 1.02 : 1
      }}
      className={`py-2 px-3 rounded-xl active:scale-[0.99] transition-all select-none border group ${
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
    showTimeoutMessage,
    getEnvelopeBalance,
    reorderEnvelopes,
    deleteIncomeSource,
    copyFromPreviousMonth,
    localOrderRef,
    setLocalEnvelopes,
    localPiggybankOrderRef,
    setLocalPiggybanks
  } = useEnvelopeList();

  // Get setCurrentMonth directly from store for month selector
  const { setMonth, setIsOnboardingActive, isOnboardingCompleted, completeOnboarding, isOnboardingActive } = useBudgetStore();
  const { showToast } = useToastStore();
  const navigate = useNavigate();

  // Local state for modals and UI
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  // Initialize from global state to support "Restart Onboarding" from settings
  const [showOnboarding, setShowOnboarding] = useState(isOnboardingActive);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useLayoutEffect(() => {
    if (showOnboarding) return;
    const el = headerRef.current;
    if (!el) return;

    const update = () => setHeaderHeight(el.getBoundingClientRect().height);
    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);

    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [showOnboarding, currentMonth, incomeSources, allocations, visibleEnvelopes, piggybanks, availableToBudget]);

  // Sync onboarding state with global store to control navigation visibility
  useEffect(() => {
    setIsOnboardingActive(showOnboarding);
    return () => setIsOnboardingActive(false);
  }, [showOnboarding, setIsOnboardingActive]);

  // Effect to handle Copy Previous Month Prompt or Onboarding visibility
  useEffect(() => {
    // Only check for copy prompt after initial loading is complete AND data has had time to load
    if (!isInitialLoading && !isLoading) {
      // Add a small delay to ensure data is loaded from backend
      const timer = setTimeout(() => {
        // If onboarding is already active (e.g. from Restart), don't override
        if (showOnboarding) return;

        // If onboarding is already completed, never show it again automatically
        if (isOnboardingCompleted) {
           setShowOnboarding(false);
           
           // Still check for copy prompt logic for existing users
           const hasNoData = (incomeSources[currentMonth] || []).length === 0 && (allocations[currentMonth] || []).length === 0;
           const hasAnyDataInAnyMonth = Object.keys(incomeSources).some(month => 
             (incomeSources[month] || []).length > 0
           ) || Object.keys(allocations).some(month => 
             (allocations[month] || []).length > 0
           );
           
           if (hasNoData && hasAnyDataInAnyMonth) {
               setShowCopyPrompt(true);
           } else {
               setShowCopyPrompt(false);
           }
           return;
        }

        const hasNoData = (incomeSources[currentMonth] || []).length === 0 && (allocations[currentMonth] || []).length === 0;
        
        // Check if user has ANY data in ANY month (to detect truly new users)
        const hasAnyDataInAnyMonth = Object.keys(incomeSources).some(month => 
          (incomeSources[month] || []).length > 0
        ) || Object.keys(allocations).some(month => 
          (allocations[month] || []).length > 0
        );
        
        if (hasNoData) {
          if (!hasAnyDataInAnyMonth) {
            // Truly new user - show onboarding
            setShowOnboarding(true);
            setShowCopyPrompt(false);
          } else {
            // Existing user with no data for this month - show copy prompt
            setShowCopyPrompt(true);
            setShowOnboarding(false);
          }
        } else {
          setShowCopyPrompt(false);
          setShowOnboarding(false);
        }
      }, 500); // 500ms delay to allow data to load
      
      return () => clearTimeout(timer);
    }
  }, [isInitialLoading, isLoading, currentMonth, incomeSources, allocations, isOnboardingCompleted]);



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
  const isManualDrag = useRef(false);
  
  // Reset reordering state when component mounts
  useEffect(() => {
    setIsReordering(false);
    isManualDrag.current = false;
    setActivelyDraggingId(null);
    setActivelyDraggingPiggybankId(null);
  }, []);

  // Use ref for isReordering to avoid recreating handleEnvelopeClick on state change
  const isReorderingRef = useRef(isReordering);
  useEffect(() => {
    isReorderingRef.current = isReordering;
  }, [isReordering]);

  const handleDragStart = useCallback(() => setIsReordering(true), []);

  const handleDragEnd = useCallback(() => {
    setIsReordering(false);
    isManualDrag.current = false; // Reset flag
    if (localOrderRef.current.length) {
      reorderEnvelopes(localOrderRef.current);
    }
  }, [reorderEnvelopes]);

  const handleItemDragStart = useCallback((_id: string) => {
    // Item-specific drag start handler
  }, []);

  const handleEnvelopeClick = useCallback((envelopeId: string) => {
    if (isReorderingRef.current) return;
    navigate(`/envelope/${envelopeId}`);
  }, [navigate]);

  const handleLongPressTrigger = useCallback((e: any, id: string) => {
    const instance = moveableInstances.current[id] || piggybankMoveableInstances.current[id];
    if (instance) {
      // Set manual flag to allow drag
      isManualDrag.current = true;
      // Trigger Moveable's drag programmatically
      // use-long-press provides the event, we need the underlying UI event
      const event = e.nativeEvent || e;
      instance.dragStart(event);
    }
  }, []);

  // Piggybank Drag Handlers
  const handlePiggybankDragStart = useCallback(() => setIsReordering(true), []);

  const handlePiggybankDragEnd = useCallback(() => {
    setIsReordering(false);
    isManualDrag.current = false; // Reset flag
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

    // While onboarding is shown, the reorder container isn't mounted.
    // Destroy instances so we can re-initialize cleanly when onboarding closes.
    if (showOnboarding) {
      destroyMoveables();
      return;
    }

    if (!piggybanks.length) {
      return;
    }

    const initializeMoveable = () => {
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
          draggable: true,
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
          checkInput: true,
          dragArea: false, // Don't start drag on area, only on dragStart() call or handle
          hideDefaultLines: true,
          hideChildMoveableDefaultLines: true,
          renderDirections: [],
        });

        moveable.on('dragStart', (e: any) => {
          // GUARD: Only allow drag if triggered manually (long press or handle)
          if (!isManualDrag.current) {
             e.stop();
             return;
          }

          const target = e.inputEvent.target as HTMLElement;
          
          // Check if user is trying to interact with budget field
          if (target.closest('.js-budget-target') || target.tagName === 'INPUT') {
            showToast("Lock envelope order to edit budget", "neutral");
            e.stop();
            return;
          }

          // Don't show toast for drag operations - allow reordering to work
          // The toast will be shown by the click handler for budget field interactions

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
  }, [piggybanks, handlePiggybankDragStart, handlePiggybankDragEnd, handleEnvelopeClick, showOnboarding]);


  // Initialize Moveable instances
  useEffect(() => {
    const destroyMoveables = () => {
      Object.values(moveableInstances.current).forEach(instance => instance?.destroy());
      moveableInstances.current = {};
    };

    // While onboarding is shown, the reorder container isn't mounted.
    // Destroy instances so we can re-initialize cleanly when onboarding closes.
    if (showOnboarding) {
      destroyMoveables();
      return;
    }

    if (!visibleEnvelopes.length) {
      return;
    }

    const initializeMoveable = () => {
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
          draggable: true,
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
          checkInput: true,
          dragArea: false, // Important: don't start drag on area, wait for handle or longpress
          hideDefaultLines: true,
          hideChildMoveableDefaultLines: true,
          renderDirections: [],
        });

        moveable.on('dragStart', (e: any) => {
          // GUARD: Only allow drag if triggered manually (long press or handle)
          if (!isManualDrag.current) {
             e.stop();
             return;
          }

          const target = e.inputEvent.target as HTMLElement;
          
          // Check if user is trying to interact with budget field
          if (target.closest('.js-budget-target') || target.tagName === 'INPUT') {
            e.stop();
            return;
          }

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
          handleDragEnd();
        });

        // Handle click events from Moveable
        moveable.on('click', () => {
          // Check if the click originated from the budget field
          const target = window.event?.target as HTMLElement;
          if (target && (target.closest('.js-budget-target') || target.tagName === 'INPUT')) {
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
  }, [visibleEnvelopes, handleDragStart, handleDragEnd, handleEnvelopeClick, showOnboarding]);




  
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

  const handleCopyPreviousMonth = async () => {
    setShowCopyPrompt(false);
    await copyFromPreviousMonth(currentMonth);
  };

  const handleOnboardingComplete = () => {
    // Mark onboarding as complete in store so it doesn't show again
    completeOnboarding();
    
    // Close onboarding and show the empty budget
    setShowOnboarding(false);
    // The user can now manually add income sources and envelopes
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
      {/* Navbar - Hide during onboarding */}
      {!showOnboarding && (
      <header ref={headerRef as any} className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1">
        
        {/* Combined Month Selector & Budget Status */}
        <MonthSelector
          currentMonth={currentMonth}
          onMonthChange={(newMonth) => {
            setShowCopyPrompt(false);
            setMonth(newMonth);
          }}
          budgetStatus={{
            amount: availableToBudget,
            totalIncome: (incomeSources[currentMonth] || []).reduce((sum, source) => sum + source.amount, 0),
            totalAllocated: (allocations[currentMonth] || [])
              .filter(allocation => visibleEnvelopes.some((env: any) => env.id === allocation.envelopeId) || piggybanks.some((piggybank: any) => piggybank.id === allocation.envelopeId))
              .reduce((sum, allocation) => sum + allocation.budgetedAmount, 0)
          }}
        />
      </header>
      )}


    <div
      className={
        showOnboarding
          ? 'pb-[calc(8rem+env(safe-area-inset-bottom))] px-4 max-w-4xl mx-auto space-y-4'
          : 'pb-[calc(8rem+env(safe-area-inset-bottom))] px-4 max-w-4xl mx-auto space-y-4'
      }
      style={
        showOnboarding
          ? undefined
          : {
              paddingTop: Math.max(0, headerHeight + 16)
            }
      }
    >
      {/* New User Onboarding */}
      {showOnboarding ? (
        <NewUserOnboarding
          currentMonth={currentMonth}
          onComplete={handleOnboardingComplete}
        />
      ) : showCopyPrompt ? (
        <CopyPreviousMonthPrompt
          currentMonth={currentMonth}
          onCopy={handleCopyPreviousMonth}
        />
      ) : (
        <>
          {/* Income Sources Section */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Income Sources</h2>
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
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{source.name}</p>
                          </div>
                          <p className="text-sm font-semibold text-green-600 dark:text-emerald-400">${source.amount.toFixed(2)}</p>
                        </div>
                      </SwipeableRow>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )
          }
            <div className="flex justify-end mt-4">
              <button onClick={handleAddIncome} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
                <Plus size={24} />
              </button>
            </div>
          </section>

          {/* Spending Envelopes Section */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Spending Envelopes</h2>
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
                    {visibleEnvelopes.map((env: any) => {
                      const allocation = (allocations[currentMonth] || []).find(alloc => alloc.envelopeId === env.id);
                      const budgetedAmount = allocation?.budgetedAmount || 0;
                      const remainingBalance = getEnvelopeBalance(env.id);

                      return (
                        <EnvelopeListItem
                          key={env.id}
                          env={env}
                          budgetedAmount={budgetedAmount}
                          remainingBalance={remainingBalance}
                          navigate={navigate}
                          transactions={transactions}
                          currentMonth={currentMonth}
                          setMoveableRef={setMoveableRef}
                          isReorderingActive={isReordering}
                          activelyDraggingId={activelyDraggingId}
                          onItemDragStart={handleItemDragStart}
                          onLongPressTrigger={handleLongPressTrigger}
                        />
                      );
                    })}
                  </div>
                </AnimatePresence>
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={() => navigate('/add-envelope')} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800" title="Create New Envelope">
                <Plus size={24} />
              </button>
            </div>
          </section>

          {/* Piggybanks Section */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <PiggyBank size={20} className="text-blue-600 dark:text-blue-400" />
                Piggybanks
              </h2>
            </div>
             {piggybanks.length > 0 ? (
               <div ref={piggybankReorderConstraintsRef} className="relative">
                 <AnimatePresence initial={false}>
                   <div className="space-y-3">
                     {piggybanks.map((piggybank: any) => {
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
                           onLongPressTrigger={handleLongPressTrigger}
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
                  <p className="text-xs mt-1">Click the + button below to create your first piggybank</p>
                </div>
              )}
            <div className="flex justify-end mt-4">
              <button onClick={() => navigate('/add-envelope?type=piggybank')} className="text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800" title="Create New Piggybank">
                <Plus size={24} />
              </button>
            </div>
          </section>
        </>
      )}

      <IncomeSourceModal isVisible={incomeModalVisible} onClose={handleCloseModal} mode={incomeModalMode} initialIncomeSource={selectedIncomeSource} />
      </div>
    </div>
    </>
  );
};