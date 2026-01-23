import React from 'react';
import { Sparkles, Calendar } from 'lucide-react';

interface CopyPreviousMonthPromptProps {
  currentMonth: string;
  onCopy: () => void;
  isLoading?: boolean;
}

const CopyPreviousMonthPrompt: React.FC<CopyPreviousMonthPromptProps> = ({
  currentMonth,
  onCopy,
  isLoading = false,
}) => {
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const getPreviousMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevYear = year - 1;
      prevMonth = 12;
    }
    return formatMonth(`${prevYear}-${prevMonth.toString().padStart(2, '0')}`);
  };

  const formattedCurrentMonth = formatMonth(currentMonth);
  const formattedPrevMonth = getPreviousMonth(currentMonth);

  return (
    <div className="flex flex-col items-center justify-center text-center p-6 py-12 space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 blur-2xl rounded-full opacity-50"></div>
        <div className="relative bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
          <Calendar className="w-12 h-12 text-blue-500" />
          <div className="absolute -top-2 -right-2 bg-blue-500 text-white p-1.5 rounded-full border-2 border-white dark:border-zinc-900">
            <Sparkles size={14} />
          </div>
        </div>
      </div>

      <div className="max-w-xs mx-auto space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          It looks like you need a budget for {formattedCurrentMonth}
        </h2>
        <p className="text-gray-500 dark:text-zinc-400">
          We can copy your budget from {formattedPrevMonth} to get you started right away.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3 pt-2">
        <button
          onClick={onCopy}
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            'Creating...'
          ) : (
            <>
              <span>Create {formattedCurrentMonth} Budget</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CopyPreviousMonthPrompt;
