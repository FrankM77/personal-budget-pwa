import React, { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';

// Consistent category colors
const CATEGORY_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48', // rose
];

const formatCurrency = (n: number, decimals = 0) => {
  const abs = Math.abs(n);
  const formatted = abs >= 1000
    ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
    : `$${abs.toFixed(decimals)}`;
  return n < 0 ? `-${formatted}` : formatted;
};

const formatCurrencyFull = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// SVG donut ring component
const DonutRing: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}> = ({ percent, size = 120, strokeWidth = 10, color = '#3b82f6', trackColor = 'rgba(255,255,255,0.1)', children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(percent, 100));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// Mini circular progress for detail cards
const MiniRing: React.FC<{ percent: number; color: string }> = ({ percent, color }) => {
  const size = 44;
  const sw = 4;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 100));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-zinc-300">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
};

export const BudgetBreakdownView: React.FC = () => {
  const navigate = useNavigate();
  const { 
    envelopes, 
    categories, 
    currentMonth,
    incomeSources,
    allocations,
    transactions
  } = useBudgetStore();

  const [viewMode, setViewMode] = useState<'overview' | 'details'>('overview');

  // Get current month budget data
  const currentMonthIncomeSources = incomeSources[currentMonth] || [];
  const currentMonthAllocations = allocations[currentMonth] || [];
  
  const currentBudget = {
    incomeSources: currentMonthIncomeSources,
    envelopeAllocations: currentMonthAllocations.reduce((acc, allocation) => {
      acc[allocation.envelopeId] = allocation;
      return acc;
    }, {} as Record<string, any>)
  };

  // Calculate budget vs actual for each category
  const budgetVsActual = useMemo(() => {
    if (!currentBudget) return [];

    const monthTransactions = transactions.filter(t => t.month === currentMonth && t.type === 'Expense');
    
    return categories.map((category, idx) => {
      const categoryEnvelopes = envelopes.filter(env => env.categoryId === category.id);
      
      const budgeted = categoryEnvelopes.reduce((sum, env) => {
        const allocation = currentBudget.envelopeAllocations[env.id];
        return sum + (allocation?.budgetedAmount || 0);
      }, 0);

      const spent = monthTransactions
        .filter(t => {
          const envelope = envelopes.find(env => env.id === t.envelopeId);
          return envelope?.categoryId === category.id && !envelope.isPiggybank;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const remaining = budgeted - spent;
      const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0;

      return {
        categoryId: category.id,
        categoryName: category.name,
        budgeted,
        spent,
        remaining,
        percentUsed,
        status: remaining >= 0 ? 'under' as const : 'over' as const,
        envelopeCount: categoryEnvelopes.length,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
      };
    }).filter(cat => cat.budgeted > 0 || cat.spent > 0)
      .sort((a, b) => b.budgeted - a.budgeted);
  }, [categories, envelopes, currentBudget, currentMonth, transactions]);

  // Calculate totals
  const totals = useMemo(() => {
    const categoryTotals = budgetVsActual.reduce((acc, cat) => ({
      totalBudgeted: acc.totalBudgeted + cat.budgeted,
      totalSpent: acc.totalSpent + cat.spent,
      totalRemaining: acc.totalRemaining + cat.remaining
    }), { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0 });

    const totalIncome = currentMonthIncomeSources.reduce((sum, source) => sum + source.amount, 0);
    
    const totalAllSpending = transactions
      .filter(t => t.month === currentMonth && t.type === 'Expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      ...categoryTotals,
      totalIncome,
      totalBudgeted: categoryTotals.totalBudgeted,
      totalSpent: categoryTotals.totalSpent,
      totalAllSpending,
      totalRemaining: totalIncome - totalAllSpending
    };
  }, [budgetVsActual, currentMonthIncomeSources, transactions, currentMonth]);

  const overallPercent = totals.totalIncome > 0
    ? Math.min((totals.totalAllSpending / totals.totalIncome) * 100, 100)
    : 0;

  const donutColor = overallPercent > 90 ? '#ef4444' : overallPercent > 70 ? '#f59e0b' : '#10b981';

  // Month label
  const monthLabel = new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (!currentBudget) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black pb-32">
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50 safe-area-top">
          <div className="flex items-center gap-3 px-4 pt-2 pb-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Budget Breakdown</h1>
          </div>
        </div>
        
        <div className="p-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              No budget data found for {currentMonth}. Create a budget to see your breakdown.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50 safe-area-top">
        <div className="flex items-center gap-3 px-4 pt-2 pb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Budget Breakdown</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{monthLabel}</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="px-4 pb-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'overview'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'details'
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Summary Hero ── */}
        <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-5">
            {/* Donut */}
            <DonutRing percent={overallPercent} color={donutColor} trackColor="rgba(255,255,255,0.06)">
              <div className="text-center">
                <p className="text-xl font-bold text-zinc-900 dark:text-white">{Math.round(overallPercent)}%</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">spent</p>
              </div>
            </DonutRing>

            {/* Stats */}
            <div className="flex-1 space-y-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Income</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-white">{formatCurrencyFull(totals.totalIncome)}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Spent</p>
                  <p className="text-sm font-semibold text-orange-500">{formatCurrencyFull(totals.totalAllSpending)}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Left</p>
                  <p className={`text-sm font-semibold ${
                    totals.totalRemaining >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {totals.totalRemaining >= 0 ? '+' : '-'}{formatCurrencyFull(Math.abs(totals.totalRemaining))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {viewMode === 'overview' ? (
          <>
            {/* ── Horizontal Budget Bars ── */}
            <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Budget vs Actual</h3>
              
              {budgetVsActual.map((cat) => {
                const barMax = Math.max(cat.budgeted, cat.spent);
                const budgetedPct = barMax > 0 ? (cat.budgeted / barMax) * 100 : 0;
                const spentPct = barMax > 0 ? (cat.spent / barMax) * 100 : 0;
                const statusColor = cat.status === 'over' ? '#ef4444' : cat.color;

                return (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">{cat.categoryName}</span>
                      </div>
                      <span className={`text-xs font-semibold ${
                        cat.remaining >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {cat.remaining >= 0 ? '+' : ''}{formatCurrency(cat.remaining)}
                      </span>
                    </div>
                    {/* Stacked bar */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 w-11 text-right">Budget</span>
                        <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${budgetedPct}%`, backgroundColor: cat.color, opacity: 0.4 }} />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 w-14 text-right">{formatCurrency(cat.budgeted)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 w-11 text-right">Spent</span>
                        <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${spentPct}%`, backgroundColor: statusColor }} />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 w-14 text-right">{formatCurrency(cat.spent)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Legend */}
              <div className="flex items-center gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-blue-500/40" />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Budgeted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-2 rounded-sm bg-blue-500" />
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Spent</span>
                </div>
              </div>
            </div>

            {/* ── Spending Distribution ── */}
            <div className="bg-white dark:bg-zinc-800/80 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Spending Distribution</h3>
              {/* Proportional stacked bar */}
              {totals.totalAllSpending > 0 && (
                <div className="w-full h-6 rounded-full overflow-hidden flex">
                  {budgetVsActual.filter(c => c.spent > 0).map((cat) => (
                    <div
                      key={cat.categoryId}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(cat.spent / totals.totalAllSpending) * 100}%`,
                        backgroundColor: cat.color,
                        minWidth: '2px'
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Category labels */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {budgetVsActual.filter(c => c.spent > 0).map((cat) => (
                  <div key={cat.categoryId} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {cat.categoryName} <span className="font-medium text-zinc-900 dark:text-zinc-200">{formatCurrency(cat.spent)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ── Details: Card Grid ── */
          <div className="space-y-3">
            {budgetVsActual.map((category) => (
              <div
                key={category.categoryId}
                className="bg-white dark:bg-zinc-800/80 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  {/* Progress ring */}
                  <MiniRing
                    percent={category.percentUsed}
                    color={category.percentUsed > 100 ? '#ef4444' : category.percentUsed > 80 ? '#f59e0b' : category.color}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-zinc-900 dark:text-white truncate">{category.categoryName}</h4>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        category.status === 'under'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}>
                        {category.status === 'under' ? 'Under' : 'Over'}
                      </span>
                    </div>

                    {/* Budget bar */}
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(category.percentUsed, 100)}%`,
                          backgroundColor: category.percentUsed > 100 ? '#ef4444' : category.percentUsed > 80 ? '#f59e0b' : category.color
                        }}
                      />
                    </div>

                    {/* Amounts row */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {formatCurrencyFull(category.spent)} <span className="text-zinc-400 dark:text-zinc-500">of</span> {formatCurrencyFull(category.budgeted)}
                      </span>
                      <span className={`font-semibold ${
                        category.remaining >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {category.remaining >= 0 ? '+' : '-'}{formatCurrencyFull(Math.abs(category.remaining))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
