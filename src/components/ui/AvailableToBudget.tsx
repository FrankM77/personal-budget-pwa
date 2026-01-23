import React from 'react';
import { Target, TrendingDown, CheckCircle } from 'lucide-react';

interface AvailableToBudgetProps {
  amount: number;
  totalIncome: number;
  totalAllocated: number;
  isLoading?: boolean;
  variant?: 'default' | 'header';
}

export const AvailableToBudget: React.FC<AvailableToBudgetProps> = ({
  amount,
  totalIncome,
  totalAllocated,
  isLoading = false,
  variant = 'default',
}) => {
  // Ensure totalAllocated is a number (handle potential string from Firestore)
  const safeTotalAllocated = typeof totalAllocated === 'number' ? totalAllocated : parseFloat(totalAllocated) || 0;
  const safeTotalIncome = typeof totalIncome === 'number' ? totalIncome : parseFloat(totalIncome) || 0;
  const safeAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  
  // Calculate progress percentage
  const progressPercentage = safeTotalIncome > 0 ? ((safeTotalAllocated / safeTotalIncome) * 100) : 0;

  // Determine display state
  const isPositive = safeAmount > 0;
  const isZero = Math.abs(safeAmount) < 0.01;
  const isNegative = safeAmount < 0;

  const barWidth = isZero ? 100 : Math.min(progressPercentage, 100);
  const barColor = isNegative ? 'bg-red-500' : 'bg-green-500';

  // Legacy variables for compatibility
  const isZeroBalance = isZero;
  const isOverAllocated = isNegative;
  const isUnderAllocated = isPositive;

  const getStatusConfig = () => {
    if (isZeroBalance) {
      return {
        icon: CheckCircle,
        color: 'text-green-600 dark:text-emerald-400',
        bgColor: 'bg-green-50 dark:bg-emerald-900/20',
        borderColor: 'border-green-200 dark:border-emerald-800',
        title: 'Budget Balanced!',
        subtitle: 'Every dollar has a job',
      };
    } else if (isOverAllocated) {
      return {
        icon: TrendingDown,
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        title: 'Over Budget',
        subtitle: 'Reduce allocations or add income',
      };
    } else {
      return {
        icon: Target,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800',
        title: 'Available to Budget',
        subtitle: 'Assign money to envelopes',
      };
    }
  };

  const statusConfig = getStatusConfig();

  if (isLoading) {
    return (
      <div className={variant === 'header' ? 'py-1.5 px-2' : 'bg-gray-50 dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 animate-pulse'}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-200 dark:bg-zinc-700 rounded w-32"></div>
          <div className="h-8 bg-gray-200 dark:bg-zinc-700 rounded w-20"></div>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-zinc-700 rounded"></div>
      </div>
    );
  }

  return (
    <div className={variant === 'header' ? 'py-1.5 px-2' : `rounded-2xl p-6 border ${statusConfig.bgColor} ${statusConfig.borderColor}`}>
      {/* Header */}
      <div className={variant === 'header' ? 'flex items-center gap-3 mb-0.5' : `flex items-center justify-between mb-4`}>
        {variant !== 'header' && (
          <div className="flex-shrink-0 text-center">
            <div className="text-xs text-gray-600 dark:text-zinc-400">Assigned:</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">${safeTotalAllocated.toFixed(2)}</div>
          </div>
        )}

        {variant === 'header' && (
          <div className="flex-1 flex justify-center items-center">
            {isZero ? (
              <div className="text-center">
                <div className="text-xs text-green-600 dark:text-emerald-400 font-medium">Perfect! Every dollar has a job 🎯</div>
              </div>
            ) : isNegative ? (
              <div className="text-center">
                <div className="text-xs text-red-600 dark:text-red-400 font-medium">You're not in Congress!</div>
              </div>
            ) : (
              <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Main Amount */}
        <div className="flex-shrink-0 text-center">
          {isPositive ? (
            <>
              <div className="text-xs text-gray-600 dark:text-zinc-400">Left to Budget:</div>
              <div className="text-base font-semibold text-gray-900 dark:text-white">${safeAmount.toFixed(2)}</div>
            </>
          ) : isZero ? (
            <>
              <div className="text-xs text-green-600 dark:text-emerald-400">All Budgeted!</div>
              <div className="text-base font-semibold text-green-600 dark:text-emerald-400">$0.00</div>
            </>
          ) : (
            <>
              <div className="text-xs text-red-600 dark:text-red-400">Over Budget:</div>
              <div className="text-base font-semibold text-red-600 dark:text-red-400">-${Math.abs(safeAmount).toFixed(2)}</div>
            </>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {variant !== 'header' && !isZeroBalance && safeTotalIncome > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-zinc-400">
            <span>Allocated</span>
            <span>{progressPercentage.toFixed(0)}% of income</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isOverAllocated
                  ? 'bg-red-500'
                  : isUnderAllocated
                    ? 'bg-blue-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-500">
            <span>${safeTotalAllocated.toFixed(2)} allocated</span>
            <span>${safeTotalIncome.toFixed(2)} income</span>
          </div>
        </div>
      )}

      {/* Stats Row */}
      {variant !== 'header' && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                ${safeTotalIncome.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-400">
                Total Income
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                ${safeTotalAllocated.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-zinc-400">
                Allocated
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
