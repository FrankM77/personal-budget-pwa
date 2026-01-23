import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  currentMonth: string; // Format: "2025-01"
  onMonthChange: (month: string) => void;
  budgetStatus?: {
    amount: number;
    totalIncome: number;
    totalAllocated: number;
  };
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonth,
  onMonthChange,
  budgetStatus
}) => {
  const [year, month] = currentMonth.split('-').map(Number);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthName = monthNames[month - 1];

  const goToPreviousMonth = () => {
    let newYear = year;
    let newMonth = month - 1;

    if (newMonth < 1) {
      newYear = year - 1;
      newMonth = 12;
    }

    const newMonthString = `${newYear}-${newMonth.toString().padStart(2, '0')}`;
    onMonthChange(newMonthString);
  };

  const goToNextMonth = () => {
    let newYear = year;
    let newMonth = month + 1;

    if (newMonth > 12) {
      newYear = year + 1;
      newMonth = 1;
    }

    const newMonthString = `${newYear}-${newMonth.toString().padStart(2, '0')}`;
    onMonthChange(newMonthString);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const currentMonthString = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    onMonthChange(currentMonthString);
  };

  // --- Budget Status Logic ---
  const renderBudgetStatus = () => {
    if (!budgetStatus) return null;

    const { amount, totalIncome, totalAllocated } = budgetStatus;
    const safeAmount = typeof amount === 'number' ? amount : 0;
    const safeTotalIncome = typeof totalIncome === 'number' ? totalIncome : 0;
    const safeTotalAllocated = typeof totalAllocated === 'number' ? totalAllocated : 0;

    const isZero = Math.abs(safeAmount) <= 0.01;
    const isNegative = safeAmount < -0.01;

    // Calculate progress (how much of income is allocated)
    // If income is 0, progress is 0.
    const progressPercentage = safeTotalIncome > 0 ? ((safeTotalAllocated / safeTotalIncome) * 100) : 0;
    const barWidth = isZero ? 100 : Math.min(progressPercentage, 100);
    
    let statusColor = 'text-gray-900 dark:text-white';
    let barColor = 'bg-green-500';
    let statusText = 'Left to Budget';

    if (isZero) {
        statusColor = 'text-green-600 dark:text-emerald-400';
        barColor = 'bg-green-500';
        statusText = 'Every dollar is working 🎉';
    } else if (isNegative) {
        statusColor = 'text-red-600 dark:text-red-400';
        barColor = 'bg-red-500';
        statusText = "You're not in Congress! Try again";
    } else {
        // Positive / Left to Budget
        statusColor = 'text-gray-900 dark:text-white'; // Keep amount neutral or specific?
        // Let's keep the amount neutral/primary, but maybe the label subdued?
    }

    return (
      <div className="flex-1 flex flex-col justify-center ml-4 min-w-0">
        <div className="flex items-baseline justify-start mb-1">
             <span className={`text-xs font-medium truncate mr-1.5 ${isNegative ? 'text-red-600 dark:text-red-400' : isZero ? 'text-green-600 dark:text-emerald-400' : 'text-gray-500 dark:text-zinc-500'}`}>
                {statusText}
             </span>
             {!isZero && (
               <span className={`text-sm font-bold truncate ${statusColor}`}>
                  {isNegative ? '-' : ''}${Math.abs(safeAmount).toFixed(2)}
               </span>
             )}
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div 
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${barWidth}%` }}
            />
        </div>
      </div>
    );
  };

  return (
    <div className="py-2">
      <div className="flex items-center justify-between">
        
        {/* Left Side: Month Controls */}
        <div className={`flex items-center ${budgetStatus ? 'flex-shrink-0' : 'w-full justify-between'}`}>
            {/* Previous Month Button */}
            <button
            onClick={goToPreviousMonth}
            className="p-1.5 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Previous month"
            >
            <ChevronLeft size={20} />
            </button>

            {/* Current Month Display */}
            <div className={`text-center ${budgetStatus ? 'mx-1' : 'flex-1'}`}>
            <button
                onClick={goToCurrentMonth}
                className="text-base font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap"
                title="Click to go to current month"
            >
                {currentMonthName} {year}
            </button>
            </div>

            {/* Next Month Button */}
            <button
            onClick={goToNextMonth}
            className="p-1.5 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Next month"
            >
            <ChevronRight size={20} />
            </button>
        </div>

        {/* Right Side: Budget Status (if provided) */}
        {budgetStatus && renderBudgetStatus()}

      </div>
    </div>
  );
};