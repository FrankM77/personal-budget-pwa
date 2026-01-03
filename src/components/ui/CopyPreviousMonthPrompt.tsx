import React from 'react';
import { Copy, X } from 'lucide-react';

interface CopyPreviousMonthPromptProps {
  currentMonth: string;
  onCopy: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

const CopyPreviousMonthPrompt: React.FC<CopyPreviousMonthPromptProps> = ({
  currentMonth,
  onCopy,
  onDismiss,
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

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Copy className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
              Copy Previous Month?
            </h3>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
              Would you like to copy your budget setup from {getPreviousMonth(currentMonth)} to get started with {formatMonth(currentMonth)}?
            </p>
            <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
              This will copy your income sources and envelope allocations, but not transactions.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 flex space-x-3">
        <button
          onClick={onDismiss}
          className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-zinc-700 transition-colors"
          disabled={isLoading}
        >
          Start Fresh
        </button>
        <button
          onClick={onCopy}
          disabled={isLoading}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Copying...' : 'Copy Previous Month'}
        </button>
      </div>
    </div>
  );
};

export default CopyPreviousMonthPrompt;