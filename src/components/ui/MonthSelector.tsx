import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  currentMonth: string; // Format: "2025-01"
  onMonthChange: (month: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentMonth,
  onMonthChange
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

  return (
    <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {/* Previous Month Button */}
        <button
          onClick={goToPreviousMonth}
          className="p-2 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Current Month Display */}
        <div className="flex-1 text-center">
          <button
            onClick={goToCurrentMonth}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Click to go to current month"
          >
            {currentMonthName} {year}
          </button>
        </div>

        {/* Next Month Button */}
        <button
          onClick={goToNextMonth}
          className="p-2 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};
