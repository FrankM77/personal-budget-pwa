import React from 'react';
import type { Transaction } from '../models/types';

interface Props {
  transaction: Transaction;
  envelopeName?: string;
  onReconcile?: () => void;
  onEdit?: () => void;
}

// ✅ CRASH-PROOF DATE FORMATTER
// This handles: Apple Timestamps, Unix Timestamps, ISO Strings, and Nulls
const formatDateSafe = (date: any) => {
  if (!date) return 'No Date';

  try {
    let d: Date;

    if (typeof date === 'number') {
      // 1. Handle Apple Epoch (Seconds since 2001)
      // Apple timestamps are small (< 10 Billion). Unix ms are huge (> 1 Trillion).
      if (date < 10000000000) {
         // Convert to Unix Milliseconds: (AppleSeconds + 978307200) * 1000
         d = new Date((date + 978307200) * 1000);
      } else {
         // 2. Handle Standard Unix Timestamp (Milliseconds)
         d = new Date(date);
      }
    } else {
      // 3. Handle ISO Strings or Date Objects
      d = new Date(date);
    }

    // Final Safety Check: Is the date valid?
    if (isNaN(d.getTime())) return "Invalid Date";

    // Format: "Nov 24, 2025"
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }).format(d);

  } catch (e) {
    console.error("Date error:", e);
    return "Error";
  }
};

// Helper: Safe Currency Formatter
const formatCurrency = (amount: number) => {
    // Safety check for non-numbers
    if (typeof amount !== 'number' || isNaN(amount)) return "$0.00";
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Math.abs(amount));
};

const EnvelopeTransactionRow: React.FC<Props> = ({ 
  transaction, 
  envelopeName,
  onReconcile,
  onEdit
}) => {
  
  // 1. Defensive Check: If transaction is missing, return nothing (don't crash)
  if (!transaction) return null;

  const isIncome = transaction.type === 'Income';
  const isExpense = transaction.type === 'Expense';

  let amountColor = 'text-gray-900 dark:text-white';
  if (isIncome) amountColor = 'text-green-600 dark:text-green-400';
  if (isExpense) amountColor = 'text-red-600 dark:text-red-400';

  return (
    <div 
      onClick={onEdit}
      className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 active:bg-gray-50 dark:active:bg-zinc-800 transition-colors cursor-pointer group border-b border-gray-100 dark:border-zinc-800 last:border-0"
    >
      <div className="flex flex-col gap-1 overflow-hidden">
        {/* Description & Reconciled Badge */}
        <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
                {transaction.description || "No Description"}
            </span>
            {transaction.reconciled && (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    R
                </span>
            )}
        </div>

        {/* Date & Envelope Name */}
        <div className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1">
            {/* ✅ CALLING SAFE FORMATTER */}
            <span>{formatDateSafe(transaction.date)}</span>
            {envelopeName && (
                <>
                    <span>•</span>
                    <span className="text-blue-500 dark:text-blue-400 truncate max-w-[150px]">
                        {envelopeName}
                    </span>
                </>
            )}
        </div>
      </div>

      {/* Amount */}
      <div className={`font-bold font-mono whitespace-nowrap ${amountColor}`}>
        {isExpense ? '-' : isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
      </div>
    </div>
  );
};

// ✅ Default Export to prevent import errors
export default EnvelopeTransactionRow;