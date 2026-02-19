import React, { useState, useMemo } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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

  // Create envelope category map
  const envelopeCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    envelopes.forEach(env => {
      if (env.categoryId) {
        map[env.id] = env.categoryId;
      }
    });
    return map;
  }, [envelopes]);

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
    
    return categories.map(category => {
      // Get all envelopes in this category
      const categoryEnvelopes = envelopes.filter(env => env.categoryId === category.id);
      
      // Sum budgeted amounts for envelopes in this category
      const budgeted = categoryEnvelopes.reduce((sum, env) => {
        const allocation = currentBudget.envelopeAllocations[env.id];
        return sum + (allocation?.budgetedAmount || 0);
      }, 0);

      // Sum actual spending for this category (excluding piggybank withdrawals)
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
        status: remaining >= 0 ? 'under' : 'over',
        envelopeCount: categoryEnvelopes.length
      };
    }).filter(cat => cat.budgeted > 0 || cat.spent > 0); // Only show categories with activity
  }, [categories, envelopes, currentBudget, currentMonth, transactions, envelopeCategoryMap]);

  // Calculate totals
  const totals = useMemo(() => {
    const categoryTotals = budgetVsActual.reduce((acc, cat) => ({
      totalBudgeted: acc.totalBudgeted + cat.budgeted,
      totalSpent: acc.totalSpent + cat.spent,
      totalRemaining: acc.totalRemaining + cat.remaining
    }), { totalBudgeted: 0, totalSpent: 0, totalRemaining: 0 });

    // Calculate total income for the month
    const totalIncome = currentMonthIncomeSources.reduce((sum, source) => sum + source.amount, 0);
    
    // Calculate total spending including piggybank withdrawals (for overall financial picture)
    const totalAllSpending = transactions
      .filter(t => t.month === currentMonth && t.type === 'Expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      ...categoryTotals,
      totalIncome, // Total monthly income
      totalBudgeted: categoryTotals.totalBudgeted, // Budget allocated to envelopes
      totalSpent: categoryTotals.totalSpent, // Regular spending (excludes piggybank withdrawals)
      totalAllSpending, // All spending including piggybank withdrawals
      totalRemaining: totalIncome - totalAllSpending // Income minus all outflows
    };
  }, [budgetVsActual, currentMonthIncomeSources, transactions, currentMonth]);

  
  // Custom tooltip for bar chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg">
          <p className="font-semibold text-zinc-900 dark:text-white">{label}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Budgeted: ${data.budgeted.toFixed(2)}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Spent: ${data.spent.toFixed(2)}
          </p>
          <p className={`text-sm font-medium ${
            data.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {data.remaining >= 0 ? 'Under' : 'Over'} by ${Math.abs(data.remaining).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

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
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Budget Breakdown</h1>
        </div>

        {/* View Toggle */}
        <div className="px-4 pb-2">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'overview'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'details'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center">
            <DollarSign className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Income</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              ${(totals.totalIncome || 0).toFixed(0)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Spent</p>
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              ${totals.totalAllSpending.toFixed(0)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 text-center">
            <TrendingDown className={`w-5 h-5 mx-auto mb-1 ${
              totals.totalRemaining >= 0 ? 'text-green-500' : 'text-red-500'
            }`} />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Remaining</p>
            <p className={`text-lg font-bold ${
              totals.totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              ${totals.totalRemaining.toFixed(0)}
            </p>
          </div>
        </div>

        {viewMode === 'overview' ? (
          <>
            {/* Bar Chart */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Budget vs Actual</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={budgetVsActual}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="categoryName" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Legend />
                  <Bar dataKey="budgeted" fill="#3b82f6" name="Budgeted" />
                  <Bar dataKey="spent" fill="#f59e0b" name="Spent" />
                </BarChart>
              </ResponsiveContainer>
            </div>

                      </>
        ) : (
          /* Detailed List */
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 p-4 pb-2">Category Details</h3>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {budgetVsActual.map((category) => (
                <div key={category.categoryId} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-zinc-900 dark:text-white">{category.categoryName}</h4>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      category.status === 'under' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {category.status === 'under' ? 'Under Budget' : 'Over Budget'}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Budgeted:</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        ${category.budgeted.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Spent:</span>
                      <span className="font-medium text-zinc-900 dark:text-white">
                        ${category.spent.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600 dark:text-zinc-400">Remaining:</span>
                      <span className={`font-medium ${
                        category.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {category.remaining >= 0 ? '+' : ''}${category.remaining.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          category.percentUsed > 100 ? 'bg-red-500' : 
                          category.percentUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(category.percentUsed, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {category.percentUsed.toFixed(1)}% of budget used
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
