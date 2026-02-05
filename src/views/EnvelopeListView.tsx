import React, { useEffect, useState, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
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
import { useNavigate } from 'react-router-dom';
import type { IncomeSource, Envelope, Category, EnvelopeAllocation } from '../models/types';

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

// Separate component for list item
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
  env: Envelope,
  budgetedAmount: number,
  remainingBalance: any,
  navigate: (path: string) => void,
  transactions: any[],
  currentMonth: string,
  setMoveableRef: (id: string) => (el: HTMLDivElement | null) => void,
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

  // Calculate percentage for progress bar
  const envelopeTransactions = transactions.filter(t => 
    t.envelopeId === env.id && t.month === currentMonth
  );
  const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
  const incomes = envelopeTransactions.filter(t => t.type === 'Income');
  const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const percentage = totalIncome > 0 ? Math.max(0, (totalSpent / totalIncome) * 100) : 0;

  const handleMoveableClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (didDragThisItem || isReorderingActive) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/envelope/${env.id}`);
  };

  useEffect(() => {
    if (activelyDraggingId && activelyDraggingId !== env.id) {
      setDidDragThisItem(false);
    }
  }, [activelyDraggingId, env.id]);

  useEffect(() => {
    if (activelyDraggingId === env.id) {
      setDidDragThisItem(true);
      onItemDragStart(env.id);
    }
  }, [activelyDraggingId, env.id, onItemDragStart]);

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
      <div 
        className="hidden md:flex items-center justify-center p-1 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-all duration-200"
        onMouseDown={(e) => onLongPressTrigger(e, env.id)}
      >
        <GripVertical size={20} />
      </div>

      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {isPiggybank && (
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center border"
                style={{
                  borderColor: hexToRgba(piggyColor, 0.4),
                  backgroundColor: hexToRgba(piggyColor, 0.15),
                  color: piggyColor
                }}
              >
                <PiggyBank size={10} />
              </span>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                {env.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] text-gray-500 dark:text-zinc-400">Budgeted:</span>
                <span className="text-[10px] font-medium text-gray-700 dark:text-zinc-300">${budgetedAmount.toFixed(2)}</span>
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
            <span className="text-[9px] text-gray-400 dark:text-zinc-500 block uppercase tracking-wider mt-0.5">Remaining</span>
          </div>
        </div>

        {budgetedAmount > 0 && (
          <div className="mt-1">
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
      ref={setMoveableRef(env.id)}
      onClick={handleMoveableClick}
      style={{
        boxShadow: isBeingDragged ? '0 18px 45px rgba(15,23,42,0.35)' : '0 1px 2px rgba(15,23,42,0.08)',
        background: piggyBackground,
        borderColor: piggyBorder,
        cursor: isBeingDragged ? 'grabbing' : 'pointer',
        zIndex: isBeingDragged ? 50 : 1,
        scale: isBeingDragged ? 1.02 : 1
      }}
      className={`py-1.5 px-3 rounded-xl active:scale-[0.99] transition-all select-none border group ${
        isPiggybank ? 'bg-white/70 dark:bg-zinc-800/80' : 'bg-gray-50 dark:bg-zinc-800 border-transparent'
      }`}
    >
      {content}
    </motion.div>
  );
};

// Component for a Category Section
const CategorySection = ({ 
  category, 
  envelopes: initialEnvelopes, 
  allocations, 
  currentMonth, 
  transactions, 
  navigate, 
  getEnvelopeBalance,
  onReorderGlobal
}: { 
  category: Category | { id: string, name: string }, 
  envelopes: Envelope[],
  allocations: Record<string, EnvelopeAllocation[]>,
  currentMonth: string,
  transactions: any[],
  navigate: (path: string) => void,
  getEnvelopeBalance: (id: string) => any,
  onReorderGlobal: (orderedIds: string[]) => void
}) => {
  if (initialEnvelopes.length === 0 && category.id === 'uncategorized') return null;

  const [localEnvelopes, setLocalEnvelopes] = useState(initialEnvelopes);
  const localOrderRef = useRef(initialEnvelopes);
  const [isReordering, setIsReordering] = useState(false);
  const [activelyDraggingId, setActivelyDraggingId] = useState<string | null>(null);
  const isManualDrag = useRef(false);
  const reorderConstraintsRef = useRef<HTMLDivElement | null>(null);
  const moveableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const moveableInstances = useRef<{ [key: string]: Moveable | null }>({});
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

  useEffect(() => {
    if (!isReordering) {
      setLocalEnvelopes(initialEnvelopes);
      localOrderRef.current = initialEnvelopes;
    }
  }, [initialEnvelopes, isReordering]);

  const handleLongPressTrigger = useCallback((e: any, id: string) => {
    const instance = moveableInstances.current[id];
    if (instance) {
      isManualDrag.current = true;
      const event = e.nativeEvent || e;
      instance.dragStart(event);
    }
  }, []);

  const setMoveableRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) moveableRefs.current[id] = el;
    else delete moveableRefs.current[id];
  }, []);

  useEffect(() => {
    const destroyMoveables = () => {
      Object.values(moveableInstances.current).forEach(instance => instance?.destroy());
      moveableInstances.current = {};
    };

    if (!localEnvelopes.length) return;

    const initializeMoveable = () => {
      localEnvelopes.forEach((envelope) => {
        const element = moveableRefs.current[envelope.id];
        if (!element || !reorderConstraintsRef.current) return;

        const moveable = new Moveable(reorderConstraintsRef.current, {
          target: element,
          draggable: true,
          throttleDrag: 0,
          snappable: true,
          snapThreshold: 5,
          snapDirections: {"top": true, "bottom": true},
          elementSnapDirections: {"top": true, "bottom": true},
          clickable: true,
          dragArea: false,
          hideDefaultLines: true,
          renderDirections: [],
        });

        moveable.on('dragStart', (e: any) => {
          if (!isManualDrag.current) { e.stop(); return; }
          const target = e.inputEvent.target as HTMLElement;
          if (target.closest('.js-budget-target') || target.tagName === 'INPUT') { e.stop(); return; }

          const startIndex = localOrderRef.current.findIndex(env => env.id === envelope.id);
          const targetEl = e.target as HTMLElement;
          const rect = targetEl.getBoundingClientRect();
          
          setActivelyDraggingId(envelope.id);
          moveableDragState.current = {
            activeId: envelope.id,
            startIndex,
            currentIndex: startIndex,
            itemHeight: rect.height + MOVEABLE_ITEM_GAP
          };
          
          targetEl.style.transition = 'none';
          targetEl.style.boxShadow = '0 18px 45px rgba(15,23,42,0.35)';
          targetEl.style.zIndex = '20';
          setIsReordering(true);
        });

        let rafId: number | null = null;
        moveable.on('drag', (e: any) => {
          const targetEl = e.target as HTMLElement;
          if (rafId !== null) cancelAnimationFrame(rafId);
          
          rafId = requestAnimationFrame(() => {
            const dragState = moveableDragState.current;
            if (dragState.activeId !== envelope.id) return;

            const translateY = e.beforeTranslate[1];
            targetEl.style.transform = `translateY(${translateY}px)`;
            targetEl.style.transition = 'none';

            const { itemHeight, startIndex } = dragState;
            const indexOffset = Math.round(translateY / itemHeight);
            const targetIndex = clampValue(startIndex + indexOffset, 0, localOrderRef.current.length - 1);

            if (targetIndex !== dragState.currentIndex) {
              dragState.currentIndex = targetIndex;
              localOrderRef.current.forEach((env, idx) => {
                if (env.id === envelope.id) return;
                const otherEl = moveableRefs.current[env.id];
                if (!otherEl) return;
                
                let offset = 0;
                if (startIndex < targetIndex && idx > startIndex && idx <= targetIndex) offset = -itemHeight;
                else if (startIndex > targetIndex && idx >= targetIndex && idx < startIndex) offset = itemHeight;
                
                otherEl.style.transform = offset ? `translateY(${offset}px)` : '';
                otherEl.style.transition = 'transform 0.2s ease';
              });
            }
            rafId = null;
          });
        });

        moveable.on('dragEnd', (e: any) => {
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
          const targetEl = e.target as HTMLElement;
          const { startIndex, currentIndex } = moveableDragState.current;
          
          targetEl.style.transform = '';
          targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease';
          targetEl.style.boxShadow = '';
          
          localOrderRef.current.forEach((env) => {
            const otherEl = moveableRefs.current[env.id];
            if (otherEl) { otherEl.style.transform = ''; otherEl.style.transition = ''; }
          });
          
          if (startIndex !== currentIndex) {
            const updated = [...localOrderRef.current];
            const [item] = updated.splice(startIndex, 1);
            updated.splice(currentIndex, 0, item);
            localOrderRef.current = updated;
            setLocalEnvelopes(updated);
            onReorderGlobal(updated.map(u => u.id));
          }
          
          setTimeout(() => {
            targetEl.style.zIndex = '';
            setActivelyDraggingId(null);
            setIsReordering(false);
            isManualDrag.current = false;
          }, 300);
        });

        moveable.on('click', () => {
          const target = window.event?.target as HTMLElement;
          if (target && (target.closest('.js-budget-target') || target.tagName === 'INPUT')) return;
          navigate(`/envelope/${envelope.id}`);
        });

        moveableInstances.current[envelope.id] = moveable;
      });
    };

    const timeoutId = window.setTimeout(initializeMoveable, 80);
    return () => { clearTimeout(timeoutId); destroyMoveables(); };
  }, [localEnvelopes, navigate, onReorderGlobal]);

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-2 px-1">
        <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          {category.name}
        </h2>
        <button 
          onClick={() => navigate(category.id === 'uncategorized' ? '/add-envelope' : `/add-envelope?categoryId=${category.id}`)} 
          className="text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 p-1 rounded-full transition-colors" 
          title={`Add to ${category.name}`}
        >
          <Plus size={20} />
        </button>
      </div>
      
      <div ref={reorderConstraintsRef} className="space-y-2 relative">
        {localEnvelopes.length === 0 ? (
          <div className="py-2 text-center border border-dashed border-gray-100 dark:border-zinc-800 rounded-xl">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">Empty category</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {localEnvelopes.map((env) => {
              const allocation = (allocations[currentMonth] || []).find((alloc) => alloc.envelopeId === env.id);
              const budgetedAmount = allocation?.budgetedAmount || 0;
              const remainingBalance = getEnvelopeBalance(env.id);

              if (env.isPiggybank) {
                return (
                  <PiggybankListItem
                    key={env.id}
                    piggybank={env}
                    balance={remainingBalance}
                    onNavigate={(id) => navigate(`/envelope/${id}`)}
                    setMoveableRef={setMoveableRef(env.id)}
                    isReorderingActive={isReordering}
                    activelyDraggingId={activelyDraggingId}
                    onItemDragStart={() => {}}
                    onLongPressTrigger={handleLongPressTrigger}
                  />
                );
              }

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
                  onItemDragStart={() => {}}
                  onLongPressTrigger={handleLongPressTrigger}
                />
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};

export const EnvelopeListView: React.FC = () => {
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
    deleteIncomeSource
  } = useEnvelopeList();

  const { 
    setMonth, 
    setIsOnboardingActive, 
    isOnboardingCompleted, 
    completeOnboarding, 
    categories, 
    fetchCategories,
    envelopes,
    reorderEnvelopes
  } = useBudgetStore();
  
  const navigate = useNavigate();

  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories.length, fetchCategories]);

  const envelopesByCategory = useMemo(() => {
    const groups: Record<string, Envelope[]> = {};
    const uncategorized: Envelope[] = [];
    categories.forEach(cat => groups[cat.id] = []);
    const allEnvelopes = [...visibleEnvelopes, ...piggybanks].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    allEnvelopes.forEach(env => {
      if (env.categoryId && groups[env.categoryId]) groups[env.categoryId].push(env);
      else uncategorized.push(env);
    });
    return { groups, uncategorized };
  }, [categories, visibleEnvelopes, piggybanks]);

  const handleReorderInSection = useCallback(async (newOrderInSection: string[]) => {
    const newGlobalIds = [...envelopes.map(e => e.id)];
    const sectionIdSet = new Set(newOrderInSection);
    const resultIds: string[] = [];
    let sectionIdx = 0;
    newGlobalIds.forEach(id => {
      if (sectionIdSet.has(id)) resultIds.push(newOrderInSection[sectionIdx++]);
      else resultIds.push(id);
    });
    await reorderEnvelopes(resultIds);
  }, [envelopes, reorderEnvelopes]);

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

  useEffect(() => {
    setIsOnboardingActive(showOnboarding);
    return () => setIsOnboardingActive(false);
  }, [showOnboarding, setIsOnboardingActive]);

  useEffect(() => {
    if (!isInitialLoading && !isLoading) {
      const timer = setTimeout(() => {
        if (showOnboarding) return;
        if (isOnboardingCompleted) {
           setShowOnboarding(false);
           const hasNoData = (incomeSources[currentMonth] || []).length === 0 && (allocations[currentMonth] || []).length === 0;
           const hasAnyDataInAnyMonth = Object.keys(incomeSources).some(month => (incomeSources[month] || []).length > 0) || Object.keys(allocations).some(month => (allocations[month] || []).length > 0);
           if (hasNoData && hasAnyDataInAnyMonth) setShowCopyPrompt(true);
           else setShowCopyPrompt(false);
           return;
        }
        const hasNoData = (incomeSources[currentMonth] || []).length === 0 && (allocations[currentMonth] || []).length === 0;
        const hasAnyDataInAnyMonth = Object.keys(incomeSources).some(month => (incomeSources[month] || []).length > 0) || Object.keys(allocations).some(month => (allocations[month] || []).length > 0);
        if (hasNoData) {
          if (!hasAnyDataInAnyMonth) {
            setShowOnboarding(true);
            setShowCopyPrompt(false);
          } else {
            setShowCopyPrompt(true);
            setShowOnboarding(false);
          }
        } else {
          setShowCopyPrompt(false);
          setShowOnboarding(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoading, isLoading, currentMonth, incomeSources, allocations, isOnboardingCompleted]);

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
    const { copyPreviousMonthAllocations } = useBudgetStore.getState();
    await copyPreviousMonthAllocations(currentMonth);
  };

  const handleOnboardingComplete = () => {
    completeOnboarding();
    setShowOnboarding(false);
  };

  if (isInitialLoading) {
    return <LoadingScreen message={showTimeoutMessage ? "Still loading..." : "Loading your budget..."} showTimeout={showTimeoutMessage} />;
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `.moveable-control, .moveable-origin, .moveable-line { display: none !important; }` }} />
      <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {!showOnboarding && (
      <header ref={headerRef as any} className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1">
        <MonthSelector
          currentMonth={currentMonth}
          onMonthChange={(newMonth) => { setShowCopyPrompt(false); setMonth(newMonth); }}
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

    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))] px-4 max-w-4xl mx-auto space-y-4" style={showOnboarding ? undefined : { paddingTop: Math.max(0, headerHeight + 16) }}>
      {showOnboarding ? (
        <NewUserOnboarding currentMonth={currentMonth} onComplete={handleOnboardingComplete} />
      ) : showCopyPrompt ? (
        <CopyPreviousMonthPrompt currentMonth={currentMonth} onCopy={handleCopyPreviousMonth} />
      ) : (
        <>
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2 px-1">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Income Sources</h2>
              <button onClick={handleAddIncome} className="text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 p-1 rounded-full transition-colors"><Plus size={20} /></button>
            </div>
            {(incomeSources[currentMonth] || []).length === 0 ? (
              <div className="text-center py-4"><p className="text-gray-500 dark:text-zinc-400 text-[10px]">No income sources yet.</p></div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {(incomeSources[currentMonth] || []).map((source) => (
                    <motion.div key={source.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <SwipeableRow onDelete={() => handleDeleteIncome(source)}>
                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-zinc-800 rounded-xl cursor-pointer" onClick={() => handleEditIncome(source)}>
                          <div className="flex-1"><p className="text-xs font-medium text-gray-900 dark:text-white">{source.name}</p></div>
                          <p className="text-xs font-bold text-green-600 dark:text-emerald-400">${source.amount.toFixed(2)}</p>
                        </div>
                      </SwipeableRow>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {categories.map(category => (
            <CategorySection
              key={category.id}
              category={category}
              envelopes={envelopesByCategory.groups[category.id] || []}
              allocations={allocations}
              currentMonth={currentMonth}
              transactions={transactions}
              navigate={navigate}
              getEnvelopeBalance={getEnvelopeBalance}
              onReorderGlobal={handleReorderInSection}
            />
          ))}

          {envelopesByCategory.uncategorized.length > 0 && (
            <CategorySection
              category={{ id: 'uncategorized', name: 'Uncategorized' }}
              envelopes={envelopesByCategory.uncategorized}
              allocations={allocations}
              currentMonth={currentMonth}
              transactions={transactions}
              navigate={navigate}
              getEnvelopeBalance={getEnvelopeBalance}
              onReorderGlobal={handleReorderInSection}
            />
          )}

          {categories.length === 0 && envelopesByCategory.uncategorized.length === 0 && (
             <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 text-center py-12">
                <Wallet className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">No envelopes yet.</p>
                <button onClick={() => navigate('/add-envelope')} className="text-blue-600 dark:text-blue-300 font-medium hover:text-blue-700 dark:hover:text-blue-200 transition-colors">Create First Envelope</button>
             </section>
          )}
        </>
      )}
      <IncomeSourceModal isVisible={incomeModalVisible} onClose={handleCloseModal} mode={incomeModalMode} initialIncomeSource={selectedIncomeSource} />
      </div>
    </div>
    </>
  );
};