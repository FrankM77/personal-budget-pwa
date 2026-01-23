import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Transaction } from '../models/types';

interface Props {
  transaction: Transaction;
  envelopeName?: string;
  onReconcile?: () => void;
  onEdit?: () => void;
}

// ✅ CRASH-PROOF DATE FORMATTER
// This handles: Firebase Timestamps, Apple Timestamps, Unix Timestamps, ISO Strings, and Nulls
const formatDateSafe = (date: any) => {
  if (!date) return 'No Date';

  try {
    let d: Date;

    // 1. Handle Firebase Timestamp objects
    if (date && typeof date === 'object' && date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // 2. Handle numbers (timestamps)
    else if (typeof date === 'number') {
      // Apple timestamps are small (< 10 Billion). Unix ms are huge (> 1 Trillion).
      if (date < 10000000000) {
         // Convert Apple Epoch (Seconds since 2001) to milliseconds
         d = new Date((date + 978307200) * 1000);
      } else {
         // Standard Unix Timestamp (Milliseconds)
         d = new Date(date);
      }
    }
    // 3. Handle ISO Strings or Date Objects
    else {
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
const formatCurrency = (amount: string | number) => {
    // Convert string to number if needed
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Safety check for non-numbers
    if (typeof numAmount !== 'number' || isNaN(numAmount)) return "$0.00";

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Math.abs(numAmount));
};

const EnvelopeTransactionRow: React.FC<Props> = ({ 
  transaction, 
  envelopeName,
  onReconcile,
  onEdit
}) => {
  
  // 1. Defensive Check: If transaction is missing, return nothing (don't crash)
  if (!transaction) return null;

  console.log('🔍 Transaction payment method:', transaction.paymentMethod);

  const isIncome = transaction.type === 'Income';
  const isExpense = transaction.type === 'Expense';

  let amountColor = 'text-gray-900 dark:text-white';
  if (isIncome) amountColor = 'text-green-600 dark:text-green-400';
  if (isExpense) amountColor = 'text-red-600 dark:text-red-400';

  return (
    <div 
      onClick={onEdit}
      className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 active:bg-gray-50 dark:active:bg-zinc-800 active:scale-[0.99] transition-all cursor-pointer group border-b border-gray-100 dark:border-zinc-800 last:border-0"
    >
      <div className="flex flex-col gap-1 overflow-hidden">
        {/* Main Title: Merchant (preferred) or Description */}
        <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white truncate">
                {transaction.merchant || transaction.description || "No Description"}
            </span>
            {transaction.reconciled && (
                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    R
                </span>
            )}
        </div>

        {/* Note (show if merchant exists and description exists and they're different) */}
        {transaction.merchant && transaction.description && transaction.description !== transaction.merchant && (
          <div className="text-xs text-gray-600 dark:text-zinc-400 truncate">
            {transaction.description}
          </div>
        )}

        {/* Date & Envelope Name */}
        <div className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1 flex-wrap">
            {/* CALLING SAFE FORMATTER */}
            <span>{formatDateSafe(transaction.date)}</span>
            {envelopeName && (
                <>
                    <span>•</span>
                    <span className="text-blue-500 dark:text-blue-400 truncate max-w-[150px]">
                        {envelopeName}
                    </span>
                </>
            )}
            {transaction.paymentMethod && (
                <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                        <span 
                            className="w-[12px] h-[8px] rounded-[2px] flex-shrink-0"
                            style={{ backgroundColor: transaction.paymentMethod.color }}
                        />
                        <span className="truncate max-w-[80px]">
                            {transaction.paymentMethod.name}
                        </span>
                    </span>
                </>
            )}
        </div>
      </div>

      {/* Amount & Reconcile */}
      <div className="flex items-center gap-2">
        <div className={`font-bold font-mono whitespace-nowrap ${amountColor}`}>
          {isExpense ? '-' : isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
        </div>
        {onReconcile ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReconcile();
            }}
            className="p-1.5 rounded-full border border-transparent hover:border-green-200 dark:hover:border-green-500 transition-colors"
            aria-label={transaction.reconciled ? 'Mark as unreconciled' : 'Mark as reconciled'}
          >
            {transaction.reconciled ? (
              <CheckCircle2 className="text-green-500" size={20} />
            ) : (
              <Circle className="text-gray-400" size={20} />
            )}
          </button>
        ) : (
          <span>
            {transaction.reconciled ? (
              <CheckCircle2 className="text-green-500" size={20} />
            ) : (
              <Circle className="text-gray-400" size={20} />
            )}
          </span>
        )}
      </div>
    </div>
  );
};

// ✅ Default Export to prevent import errors
export default EnvelopeTransactionRow;