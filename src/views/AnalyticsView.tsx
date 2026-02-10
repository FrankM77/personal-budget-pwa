import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useBudgetStore } from '../stores/budgetStore';
import { useAnalyticsData, getMonthsForTimeFrame } from '../hooks/useAnalyticsData';
import type { TimeFrame } from '../hooks/useAnalyticsData';

// ─── Types ───
type Tab = 'totals' | 'breakdown' | 'income' | 'savings';

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: 'totals', label: 'Spending Totals' },
  { key: 'breakdown', label: 'Spending Breakdown' },
  { key: 'income', label: 'Monthly Income' },
  { key: 'savings', label: 'Savings' },
];

const TIME_FRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: '1m', label: '1 Month' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '9m', label: '9 Months' },
  { value: '12m', label: '12 Months' },
];

// Generate year options dynamically (current year back to 2024)
function getYearOptions(): { value: TimeFrame; label: string }[] {
  const currentYear = new Date().getFullYear();
  const years: { value: TimeFrame; label: string }[] = [];
  for (let y = currentYear; y >= 2024; y--) {
    years.push({ value: `year-${y}` as TimeFrame, label: `${y}` });
  }
  return years;
}

// ─── Currency formatter ───
const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDecimal = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Custom Tooltip for stacked bars ───
const StackedBarTooltip = ({ active, payload, label, nameMap }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-zinc-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill || entry.color }} />
          <span className="text-zinc-600 dark:text-zinc-300">{nameMap?.[entry.dataKey] || entry.dataKey}:</span>
          <span className="font-medium text-zinc-900 dark:text-white ml-auto">{fmtDecimal(entry.value)}</span>
        </div>
      ))}
      <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1.5 pt-1.5 flex justify-between font-semibold">
        <span className="text-zinc-700 dark:text-zinc-200">Total</span>
        <span className="text-zinc-900 dark:text-white">{fmtDecimal(total)}</span>
      </div>
    </div>
  );
};

// ─── Custom Tooltip for savings ───
const SavingsTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const savings = payload.find((p: any) => p.dataKey === 'savingsPercent');
  const spending = payload.find((p: any) => p.dataKey === 'spendingPercent');
  return (
    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-lg text-sm">
      <p className="font-semibold text-zinc-900 dark:text-white mb-1">{label}</p>
      {savings && (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#3B82F6' }} />
          <span className="text-zinc-600 dark:text-zinc-300">Savings & Investments:</span>
          <span className="font-medium text-zinc-900 dark:text-white ml-auto">{savings.value.toFixed(1)}%</span>
        </div>
      )}
      {spending && (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#4ADE80' }} />
          <span className="text-zinc-600 dark:text-zinc-300">Spending:</span>
          <span className="font-medium text-zinc-900 dark:text-white ml-auto">{spending.value.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};


// ─── Main Component ───
export const AnalyticsView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('totals');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('12m');
  const { currentMonth, fetchMonthData, incomeSources, loadedTransactionMonths } = useBudgetStore();

  const yearOptions = useMemo(() => getYearOptions(), []);

  // Pre-fetch month data for all months in the selected time frame
  useEffect(() => {
    const months = getMonthsForTimeFrame(timeFrame, currentMonth);
    months.forEach((m) => {
      // Only fetch if not already in store
      // Check both incomeSources AND loadedTransactionMonths
      const isMissingData = 
        incomeSources[m] === undefined || 
        !loadedTransactionMonths.includes(m);

      if (isMissingData) {
        fetchMonthData(m);
      }
    });
  }, [timeFrame, currentMonth, fetchMonthData, incomeSources, loadedTransactionMonths]);

  const {
    spendingTotals,
    spendingBreakdown,
    monthlyIncome,
    savingsData,
    categoryNameMap,
  } = useAnalyticsData(timeFrame);

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
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Analytics</h1>
        </div>

        {/* Segmented Control */}
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            {TAB_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`
                  flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${activeTab === key
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Time Frame Picker */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="inline-flex gap-1.5 min-w-max">
            {TIME_FRAME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeFrame(value)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                  ${timeFrame === value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                {label}
              </button>
            ))}
            {/* Year options */}
            {yearOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeFrame(value)}
                className={`
                  px-3 py-1 rounded-full text-xs font-medium transition-all duration-200
                  ${timeFrame === value
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {activeTab === 'totals' && (
          <SpendingTotalsTab
            items={spendingTotals.items}
            total={spendingTotals.total}
          />
        )}
        {activeTab === 'breakdown' && (
          <SpendingBreakdownTab
            data={spendingBreakdown.data}
            categoryKeys={spendingBreakdown.categoryKeys}
            colorMap={spendingBreakdown.colorMap}
            nameMap={categoryNameMap}
            average={spendingBreakdown.average}
          />
        )}
        {activeTab === 'income' && (
          <MonthlyIncomeTab
            data={monthlyIncome.data}
            sourceKeys={monthlyIncome.sourceKeys}
            colorMap={monthlyIncome.colorMap}
            average={monthlyIncome.average}
          />
        )}
        {activeTab === 'savings' && (
          <SavingsTab data={savingsData.data} />
        )}
      </div>
    </div>
  );
};

// ─── Tab: Spending Totals (Donut) ───
const SpendingTotalsTab: React.FC<{
  items: { categoryId: string; categoryName: string; color: string; amount: number }[];
  total: number;
}> = ({ items, total }) => {
  if (items.length === 0) {
    return <EmptyState message="No spending data for this time period." />;
  }

  return (
    <div className="space-y-4">
      {/* Donut Chart */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="relative no-select-chart">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={items}
                dataKey="amount"
                nameKey="categoryName"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {items.map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = total > 0 ? ((d.amount / total) * 100).toFixed(1) : '0';
                  return (
                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 shadow-lg text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="font-semibold text-zinc-900 dark:text-white">{d.categoryName}</span>
                      </div>
                      <div className="text-zinc-600 dark:text-zinc-300">
                        {fmtDecimal(d.amount)} ({pct}%)
                      </div>
                    </div>
                  );
                }}
                contentStyle={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  borderRadius: 0,
                  boxShadow: 'none'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Total Spent</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{fmt(total)}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Categories</h3>
        <div className="space-y-2">
          {items.map((item) => {
            const pct = total > 0 ? ((item.amount / total) * 100).toFixed(1) : '0';
            return (
              <div key={item.categoryId} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{item.categoryName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{pct}%</span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-white w-20 text-right">
                    {fmtDecimal(item.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Tab: Spending Breakdown (Stacked Bar) ───
const SpendingBreakdownTab: React.FC<{
  data: any[];
  categoryKeys: string[];
  colorMap: Record<string, string>;
  nameMap: Record<string, string>;
  average: number;
}> = ({ data, categoryKeys, colorMap, nameMap, average }) => {
  if (data.length === 0 || categoryKeys.length === 0) {
    return <EmptyState message="No spending data for this time period." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Monthly Spending by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={false}
              content={(props) => <StackedBarTooltip {...props} colorMap={colorMap} nameMap={nameMap} />}
            />
            <ReferenceLine
              y={average}
              stroke="currentColor"
              strokeDasharray="8 4"
              strokeWidth={3}
              className="text-black dark:text-white"
              label={{
                value: `${fmt(average)} (avg)`,
                position: 'insideTopRight',
                fill: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            {categoryKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="spending"
                fill={colorMap[key]}
                radius={[0, 0, 0, 0]}
                name={nameMap[key] || key}
                isAnimationActive={false}
                animationBegin={0}
                animationDuration={0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <StackedBarLegend keys={categoryKeys} colorMap={colorMap} nameMap={nameMap} />
    </div>
  );
};

// ─── Tab: Monthly Income (Stacked Bar) ───
const MonthlyIncomeTab: React.FC<{
  data: any[];
  sourceKeys: string[];
  colorMap: Record<string, string>;
  average: number;
}> = ({ data, sourceKeys, colorMap, average }) => {
  // nameMap for income is just the source name itself
  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    sourceKeys.forEach((k) => { m[k] = k; });
    return m;
  }, [sourceKeys]);

  if (data.length === 0 || sourceKeys.length === 0) {
    return <EmptyState message="No income data for this time period." />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Monthly Income by Source</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={false}
              content={(props) => <StackedBarTooltip {...props} colorMap={colorMap} nameMap={nameMap} />}
            />
            <ReferenceLine
              y={average}
              stroke="currentColor"
              strokeDasharray="8 4"
              strokeWidth={3}
              className="text-black dark:text-white"
              label={{
                value: `${fmt(average)} (avg)`,
                position: 'insideTopRight',
                fill: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            {sourceKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="income"
                fill={colorMap[key]}
                radius={[0, 0, 0, 0]}
                name={key}
                isAnimationActive={false}
                animationBegin={0}
                animationDuration={0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <StackedBarLegend keys={sourceKeys} colorMap={colorMap} nameMap={nameMap} />
    </div>
  );
};

// ─── Tab: Savings (100% Stacked Bar) ───
const SavingsTab: React.FC<{ data: { month: string; monthLabel: string; savingsPercent: number; spendingPercent: number }[] }> = ({ data }) => {
  if (data.length === 0) {
    return <EmptyState message="No data for this time period." />;
  }

  const avgSavings = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.savingsPercent, 0) / data.length * 10) / 10
    : 0;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Income Allocation (Savings Base)</h3>
          <span className="text-xs font-medium text-blue-500">Avg Savings: {avgSavings}%</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-700" />
            <XAxis
              dataKey="monthLabel"
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              className="text-zinc-500 dark:text-zinc-400"
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={SavingsTooltip} />
            {/* Savings grows from bottom (blue) */}
            <Bar
              dataKey="savingsPercent"
              stackId="allocation"
              fill="#3B82F6"
              name="Savings & Investments"
              radius={[0, 0, 0, 0]}
            />
            {/* Spending fills the rest (green) */}
            <Bar
              dataKey="spendingPercent"
              stackId="allocation"
              fill="#4ADE80"
              name="Spending"
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Savings & Investments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300">Spending</span>
          </div>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
          Pay yourself first: savings grows from the bottom, reinforcing the goal of maximizing your savings rate.
        </p>
      </div>

      {/* Monthly breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Monthly Savings Rate</h3>
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.month} className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400 w-10">{d.monthLabel}</span>
              <div className="flex-1 mx-3 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${d.savingsPercent}%` }}
                />
              </div>
              <span className={`text-sm font-medium w-14 text-right ${
                d.savingsPercent >= 20 ? 'text-blue-500' : d.savingsPercent >= 10 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {d.savingsPercent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Shared: Stacked Bar Legend ───
const StackedBarLegend: React.FC<{
  keys: string[];
  colorMap: Record<string, string>;
  nameMap: Record<string, string>;
}> = ({ keys, colorMap, nameMap }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-100 dark:border-zinc-800">
    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Legend</h3>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {keys.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colorMap[key] }} />
          <span className="text-xs text-zinc-600 dark:text-zinc-300">{nameMap[key] || key}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Empty State ───
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
      <BarChart3 className="w-8 h-8 text-zinc-400" />
    </div>
    <p className="text-zinc-500 dark:text-zinc-400 text-sm">{message}</p>
  </div>
);

