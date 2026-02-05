import React, { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { Plus, Wallet, PiggyBank } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// import Moveable from 'moveable'; // Temporarily disabled for category refactor
// import { useLongPress, LongPressEventType } from 'use-long-press';
// import { triggerHaptic } from '../utils/haptics';
import { useEnvelopeList } from '../hooks/useEnvelopeList';
import { MonthSelector } from '../components/ui/MonthSelector';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import IncomeSourceModal from '../components/modals/IncomeSourceModal';
import CopyPreviousMonthPrompt from '../components/ui/CopyPreviousMonthPrompt';
import NewUserOnboarding from '../components/ui/NewUserOnboarding';
import { PiggybankListItem } from '../components/PiggybankListItem';
import { useBudgetStore } from '../stores/budgetStore';
// import { useToastStore } from '../stores/toastStore';
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

// Separate component for list item
const EnvelopeListItem = ({
  env,
  budgetedAmount,
  remainingBalance,
  navigate,
  transactions,
  currentMonth
}: {
  env: Envelope,
  budgetedAmount: number,
  remainingBalance: any,
  navigate: (path: string) => void,
  transactions: any[],
  currentMonth: string
}) => {
  const isPiggybank = Boolean(env.isPiggybank);
  const piggyColor = env.piggybankConfig?.color || '#3B82F6';
  const piggyBackground = isPiggybank
    ? `linear-gradient(135deg, ${hexToRgba(piggyColor, 0.18)} 0%, ${hexToRgba(piggyColor, 0.08)} 100%)`
    : undefined;
  const piggyBorder = isPiggybank ? hexToRgba(piggyColor, 0.5) : undefined;

  // Calculate percentage for progress bar
  const envelopeTransactions = transactions.filter(t => 
    t.envelopeId === env.id && t.month === currentMonth
  );
  const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
  const incomes = envelopeTransactions.filter(t => t.type === 'Income');
  const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalIncome = incomes.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const percentage = totalIncome > 0 ? Math.max(0, (totalSpent / totalIncome) * 100) : 0;

  const handleClick = () => {
    navigate(`/envelope/${env.id}`);
  };

  const content = (
    <div className="flex items-center gap-3 w-full">
      {/* Content Wrapper */}
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

        {/* Simplified Progress Bar */}
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
  
  return (
    <motion.div
      layout
      transition={{ layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 } }}
      onClick={handleClick}
      style={{
        background: piggyBackground,
        borderColor: piggyBorder,
        cursor: 'pointer'
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
  envelopes, 
  allocations, 
  currentMonth, 
  transactions, 
  navigate, 
  getEnvelopeBalance 
}: { 
  category: Category | { id: string, name: string }, 
  envelopes: Envelope[],
  allocations: Record<string, EnvelopeAllocation[]>,
  currentMonth: string,
  transactions: any[],
  navigate: (path: string) => void,
  getEnvelopeBalance: (id: string) => any
}) => {
  // We still hide Uncategorized if empty, but we show user categories so they can add to them
  if (envelopes.length === 0 && category.id === 'uncategorized') return null;

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
      
      <div className="space-y-2">
        {envelopes.length === 0 ? (
          <div className="py-2 text-center border border-dashed border-gray-100 dark:border-zinc-800 rounded-xl">
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">Empty category</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {envelopes.map((env) => {
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
                    // Moveable props disabled for now
                    onLongPressTrigger={() => {}}
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
    deleteIncomeSource,
    copyFromPreviousMonth
  } = useEnvelopeList();

  const { 
    setMonth, 
    setIsOnboardingActive, 
    isOnboardingCompleted, 
    completeOnboarding, 
    categories, 
    fetchCategories 
  } = useBudgetStore();
  
  const navigate = useNavigate();

  // Local state for modals and UI
  const [incomeModalVisible, setIncomeModalVisible] = useState(false);
  const [incomeModalMode, setIncomeModalMode] = useState<'add' | 'edit'>('add');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<IncomeSource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pendingEditTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Fetch categories on mount if empty
  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories.length, fetchCategories]);

  // Group envelopes by category
  const envelopesByCategory = useMemo(() => {
    const groups: Record<string, Envelope[]> = {};
    const uncategorized: Envelope[] = [];

    // Initialize groups for all categories
    categories.forEach(cat => groups[cat.id] = []);

    // Process all envelopes (spending + piggybanks)
    const allEnvelopes = [...visibleEnvelopes, ...piggybanks];
    
    allEnvelopes.forEach(env => {
      if (env.categoryId && groups[env.categoryId]) {
        groups[env.categoryId].push(env);
      } else {
        uncategorized.push(env);
      }
    });

    return { groups, uncategorized };
  }, [categories, visibleEnvelopes, piggybanks]);

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

  // Sync onboarding state
  useEffect(() => {
    setIsOnboardingActive(showOnboarding);
    return () => setIsOnboardingActive(false);
  }, [showOnboarding, setIsOnboardingActive]);

  // Handle Onboarding / Copy Prompt logic
  useEffect(() => {
    if (!isInitialLoading && !isLoading) {
      const timer = setTimeout(() => {
        if (showOnboarding) return;

        if (isOnboardingCompleted) {
           setShowOnboarding(false);
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
        const hasAnyDataInAnyMonth = Object.keys(incomeSources).some(month => 
          (incomeSources[month] || []).length > 0
        ) || Object.keys(allocations).some(month => 
          (allocations[month] || []).length > 0
        );
        
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

  // Income Management
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
    completeOnboarding();
    setShowOnboarding(false);
  };

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
      <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {!showOnboarding && (
      <header ref={headerRef as any} className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+4px)] pb-1">
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
      className="pb-[calc(8rem+env(safe-area-inset-bottom))] px-4 max-w-4xl mx-auto space-y-4"
      style={showOnboarding ? undefined : { paddingTop: Math.max(0, headerHeight + 16) }}
    >
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
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-zinc-800">
            <div className="flex justify-between items-center mb-2 px-1">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Income Sources</h2>
              <button onClick={handleAddIncome} className="text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 p-1 rounded-full transition-colors">
                <Plus size={20} />
              </button>
            </div>
            {(incomeSources[currentMonth] || []).length === 0 ? (
              <div className="text-center py-4"><p className="text-gray-500 dark:text-zinc-400 text-[10px]">No income sources yet. Add your monthly income.</p></div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {(incomeSources[currentMonth] || []).map((source) => (
                    <motion.div key={source.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                      <SwipeableRow onDelete={() => handleDeleteIncome(source)}>
                        <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-zinc-800 rounded-xl cursor-pointer" onClick={() => handleEditIncome(source)}>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900 dark:text-white">{source.name}</p>
                          </div>
                          <p className="text-xs font-bold text-green-600 dark:text-emerald-400">${source.amount.toFixed(2)}</p>
                        </div>
                      </SwipeableRow>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Render Categories */}
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
            />
          ))}

          {/* Uncategorized Envelopes */}
          {envelopesByCategory.uncategorized.length > 0 && (
            <CategorySection
              category={{ id: 'uncategorized', name: 'Uncategorized' }}
              envelopes={envelopesByCategory.uncategorized}
              allocations={allocations}
              currentMonth={currentMonth}
              transactions={transactions}
              navigate={navigate}
              getEnvelopeBalance={getEnvelopeBalance}
            />
          )}

          {/* Empty State when no envelopes at all */}
          {categories.length === 0 && envelopesByCategory.uncategorized.length === 0 && (
             <section className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 text-center py-12">
                <Wallet className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">No envelopes yet. Create categories in Settings or add an envelope to get started.</p>
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