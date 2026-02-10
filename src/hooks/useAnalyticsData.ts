import { useMemo } from 'react';
import { useBudgetStore } from '../stores/budgetStore';
import type { Category, IncomeSource } from '../models/types';

// ─── Color palette for categories ───
const CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#D946EF', // fuchsia
];

// ─── Color palette for income sources ───
const INCOME_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
  '#14B8A6', // teal
];

export type TimeFrame =
  | '1m' | '3m' | '6m' | '9m' | '12m'
  | `year-${number}`; // e.g. "year-2025"

export interface SpendingTotalItem {
  categoryId: string;
  categoryName: string;
  color: string;
  amount: number;
}

export interface MonthlyStackedItem {
  month: string;        // "2025-01"
  monthLabel: string;   // "Jan"
  [key: string]: string | number; // category/source keys -> amounts
}

export interface SavingsItem {
  month: string;
  monthLabel: string;
  savingsPercent: number;
  spendingPercent: number;
}

// ─── Helpers ───

/** Generate an array of month keys for a given time frame, ending at the current month */
export function getMonthsForTimeFrame(timeFrame: TimeFrame, currentMonth: string): string[] {
  const months: string[] = [];

  if (timeFrame.startsWith('year-')) {
    const year = parseInt(timeFrame.split('-')[1], 10);
    for (let m = 1; m <= 12; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`);
    }
    return months;
  }

  const countMap: Record<string, number> = {
    '1m': 1, '3m': 3, '6m': 6, '9m': 9, '12m': 12,
  };
  const count = countMap[timeFrame] || 1;

  // Parse current month
  const [cy, cm] = currentMonth.split('-').map(Number);
  const endDate = new Date(cy, cm - 1, 1); // first of current month

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
  }

  return months;
}

const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(monthKey: string): string {
  const m = parseInt(monthKey.split('-')[1], 10);
  return SHORT_MONTH_NAMES[m - 1] || monthKey;
}

/** Build a stable color map for categories */
function buildCategoryColorMap(categories: Category[]): Record<string, string> {
  const map: Record<string, string> = {};
  categories.forEach((cat, i) => {
    map[cat.id] = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  });
  map['uncategorized'] = '#9CA3AF'; // gray for uncategorized
  return map;
}

/** Build a stable color map for income source names */
function buildIncomeColorMap(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const unique = [...new Set(names)];
  unique.forEach((name, i) => {
    map[name] = INCOME_COLORS[i % INCOME_COLORS.length];
  });
  return map;
}

// ─── Main hook ───

export function useAnalyticsData(timeFrame: TimeFrame) {
  const {
    transactions,
    envelopes,
    categories,
    incomeSources,
    currentMonth,
  } = useBudgetStore();

  const months = useMemo(
    () => getMonthsForTimeFrame(timeFrame, currentMonth),
    [timeFrame, currentMonth]
  );

  // Map envelope -> category
  const envelopeCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    envelopes.forEach((env) => {
      map[env.id] = env.categoryId || 'uncategorized';
    });
    return map;
  }, [envelopes]);

  // Category color map
  const categoryColorMap = useMemo(() => buildCategoryColorMap(categories), [categories]);

  // Category name map
  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    map['uncategorized'] = 'Uncategorized';
    return map;
  }, [categories]);

  // Filter transactions to selected months & expense type only (for spending)
  const expenseTransactions = useMemo(() => {
    const monthSet = new Set(months);
    return transactions.filter(
      (t) => t.type === 'Expense' && t.month && monthSet.has(t.month)
    );
  }, [transactions, months]);

  // ─── 1. Spending Totals (Donut) ───
  const spendingTotals = useMemo((): { items: SpendingTotalItem[]; total: number } => {
    const totals: Record<string, number> = {};

    expenseTransactions.forEach((t) => {
      const catId = envelopeCategoryMap[t.envelopeId] || 'uncategorized';
      totals[catId] = (totals[catId] || 0) + Math.abs(t.amount);
    });

    const items: SpendingTotalItem[] = Object.entries(totals)
      .map(([catId, amount]) => ({
        categoryId: catId,
        categoryName: categoryNameMap[catId] || 'Uncategorized',
        color: categoryColorMap[catId] || '#9CA3AF',
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = items.reduce((s, i) => s + i.amount, 0);
    return { items, total: Math.round(total * 100) / 100 };
  }, [expenseTransactions, envelopeCategoryMap, categoryNameMap, categoryColorMap]);

  // ─── 2. Spending Breakdown (Stacked Bar by month) ───
  const spendingBreakdown = useMemo((): {
    data: MonthlyStackedItem[];
    categoryKeys: string[];
    colorMap: Record<string, string>;
    average: number;
  } => {
    // Collect unique category IDs that appear in the data
    const catIdSet = new Set<string>();

    // Build per-month totals
    const monthMap: Record<string, Record<string, number>> = {};
    months.forEach((m) => { monthMap[m] = {}; });

    expenseTransactions.forEach((t) => {
      const catId = envelopeCategoryMap[t.envelopeId] || 'uncategorized';
      const m = t.month!;
      if (monthMap[m]) {
        monthMap[m][catId] = (monthMap[m][catId] || 0) + Math.abs(t.amount);
        catIdSet.add(catId);
      }
    });

    const categoryKeys = [...catIdSet];
    const colorMap: Record<string, string> = {};
    categoryKeys.forEach((k) => {
      colorMap[k] = categoryColorMap[k] || '#9CA3AF';
    });

    const data: MonthlyStackedItem[] = months.map((m) => {
      const row: MonthlyStackedItem = { month: m, monthLabel: monthLabel(m) };
      categoryKeys.forEach((k) => {
        row[k] = Math.round((monthMap[m][k] || 0) * 100) / 100;
      });
      return row;
    });

    const totals = data.map((d) =>
      categoryKeys.reduce((s, k) => s + ((d[k] as number) || 0), 0)
    );
    const average = totals.length > 0
      ? Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
      : 0;

    return { data, categoryKeys, colorMap, average };
  }, [months, expenseTransactions, envelopeCategoryMap, categoryColorMap]);

  // ─── 3. Monthly Income (Stacked Bar by income source name) ───
  const monthlyIncome = useMemo((): {
    data: MonthlyStackedItem[];
    sourceKeys: string[];
    colorMap: Record<string, string>;
    average: number;
  } => {
    // Collect all income source names across all months
    const allNames: string[] = [];
    const monthMap: Record<string, Record<string, number>> = {};
    months.forEach((m) => { monthMap[m] = {}; });

    months.forEach((m) => {
      const sources: IncomeSource[] = incomeSources[m] || [];
      sources.forEach((src) => {
        allNames.push(src.name);
        monthMap[m][src.name] = (monthMap[m][src.name] || 0) + src.amount;
      });
    });

    const sourceKeys = [...new Set(allNames)];
    const colorMap = buildIncomeColorMap(sourceKeys);

    const data: MonthlyStackedItem[] = months.map((m) => {
      const row: MonthlyStackedItem = { month: m, monthLabel: monthLabel(m) };
      sourceKeys.forEach((k) => {
        row[k] = Math.round((monthMap[m][k] || 0) * 100) / 100;
      });
      return row;
    });

    const totals = data.map((d) =>
      sourceKeys.reduce((s, k) => s + ((d[k] as number) || 0), 0)
    );
    const average = totals.length > 0
      ? Math.round(totals.reduce((s, v) => s + v, 0) / totals.length)
      : 0;

    return { data, sourceKeys, colorMap, average };
  }, [months, incomeSources]);

  // ─── 4. Savings (100% stacked bar) ───
  const savingsData = useMemo((): { data: SavingsItem[] } => {
    const data: SavingsItem[] = months.map((m) => {
      // Total income for the month
      const sources: IncomeSource[] = incomeSources[m] || [];
      const totalIncome = sources.reduce((s, src) => s + src.amount, 0);

      // Total spending for the month (expense transactions)
      const monthExpenses = expenseTransactions.filter((t) => t.month === m);
      const totalSpending = monthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);

      // Savings = income - spending (clamped to 0..income)
      const savings = Math.max(0, totalIncome - totalSpending);

      if (totalIncome <= 0) {
        return {
          month: m,
          monthLabel: monthLabel(m),
          savingsPercent: 0,
          spendingPercent: 100,
        };
      }

      const savingsPercent = Math.min(100, Math.round((savings / totalIncome) * 1000) / 10);
      const spendingPercent = Math.round((100 - savingsPercent) * 10) / 10;

      return {
        month: m,
        monthLabel: monthLabel(m),
        savingsPercent,
        spendingPercent,
      };
    });

    return { data };
  }, [months, incomeSources, expenseTransactions]);

  return {
    months,
    spendingTotals,
    spendingBreakdown,
    monthlyIncome,
    savingsData,
    categoryNameMap,
    categoryColorMap,
  };
}
