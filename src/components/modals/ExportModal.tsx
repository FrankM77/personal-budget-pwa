import React, { useState } from 'react';
import { X, Download, Calendar } from 'lucide-react';
import { useBudgetStore } from '../../stores/budgetStore';
import { getMonthsForTimeFrame, type TimeFrame } from '../../hooks/useAnalyticsData';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: any[];
  envelopes: any[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  transactions,
  envelopes
}) => {
  const { currentMonth } = useBudgetStore();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<TimeFrame>('3m');
  const [isExporting, setIsExporting] = useState(false);

  const TIME_FRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
    { value: '1m', label: '1 Month' },
    { value: '3m', label: '3 Months' },
    { value: '6m', label: '6 Months' },
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

  const yearOptions = getYearOptions();

  const getSelectedMonths = (): string[] => {
    return getMonthsForTimeFrame(selectedTimeFrame, currentMonth);
  };

  const getMonthRangeLabel = (): string => {
    const months = getSelectedMonths();
    if (months.length === 0) return '';
    
    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const firstLabel = `${monthNames[parseInt(firstMonth.split('-')[1]) - 1]}${firstMonth.split('-')[0]}`;
    const lastLabel = `${monthNames[parseInt(lastMonth.split('-')[1]) - 1]}${lastMonth.split('-')[0]}`;
    
    return firstLabel === lastLabel ? firstLabel : `${firstLabel}-${lastLabel}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const selectedMonths = getSelectedMonths();
      
      // Filter transactions by selected months
      const filtered = transactions.filter(t => 
        t.description !== 'Budgeted' && 
        t.description !== 'Piggybank Contribution' &&
        selectedMonths.includes(t.month || '')
      );

      // Group split transactions (same logic as original)
      const processedSplitGroups = new Set<string>();
      const rows: string[] = [];
      const headers = ['Date', 'Merchant', 'Payment Method', 'Notes', 'Amount', 'Type', 'Envelope', 'Reconciled'];

      for (const t of filtered) {
        let amount: number;
        let envName: string;
        let reconciled: boolean;

        if (t.splitGroupId && !processedSplitGroups.has(t.splitGroupId)) {
          processedSplitGroups.add(t.splitGroupId);
          const groupTxs = filtered.filter(tx => tx.splitGroupId === t.splitGroupId);
          amount = groupTxs.reduce((sum, tx) => sum + tx.amount, 0);
          envName = groupTxs.map(tx => envelopes.find(e => e.id === tx.envelopeId)?.name || 'Unknown').join(', ');
          reconciled = groupTxs.every(tx => tx.reconciled);
        } else if (t.splitGroupId && processedSplitGroups.has(t.splitGroupId)) {
          continue;
        } else {
          amount = t.amount;
          envName = envelopes.find((e) => e.id === t.envelopeId)?.name || 'Unknown';
          reconciled = t.reconciled;
        }

        const safeMerchant = (t.merchant || '').replace(/"/g, '""');
        const safeNotes = (t.description || '').replace(/"/g, '""');
        
        let paymentMethodStr = '';
        if (t.paymentMethod) {
          paymentMethodStr = `${t.paymentMethod.name} (...${t.paymentMethod.last4})`;
        }
        const safePaymentMethod = paymentMethodStr.replace(/"/g, '""');

        let dateStr = 'Invalid Date';
        if (t.date) {
          if (typeof t.date === 'string') {
            dateStr = t.date.split('T')[0];
          } else if (typeof t.date === 'number') {
            const APPLE_EPOCH_OFFSET = 978307200000; // milliseconds between 1/1/2001 and 1/1/1970
            const ts = t.date < 2000000000 ? (t.date + APPLE_EPOCH_OFFSET) * 1000 : t.date;
            dateStr = new Date(ts).toISOString().split('T')[0];
          }
        }
        
        rows.push([
          dateStr,
          `"${safeMerchant}"`, 
          `"${safePaymentMethod}"`,
          `"${safeNotes}"`, 
          amount.toFixed(2),
          t.type,
          `"${envName}"`, 
          reconciled ? 'Yes' : 'No',
        ].join(','));
      }

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with month range
      const monthRange = getMonthRangeLabel();
      link.download = `budgetTransactions_${monthRange}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Export Transactions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Time Frame Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
              Select Time Range
            </label>
            
            {/* Preset Options */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                Presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TIME_FRAME_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedTimeFrame(value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${selectedTimeFrame === value
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

            {/* Year Options */}
            <div className="space-y-2 mt-4">
              <div className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                By Year
              </div>
              <div className="grid grid-cols-3 gap-2">
                {yearOptions.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSelectedTimeFrame(value)}
                    className={`
                      px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${selectedTimeFrame === value
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

          {/* Preview */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-zinc-400">
              <div className="font-medium mb-1">Export Range:</div>
              <div className="text-gray-900 dark:text-white">
                {getSelectedMonths().length} months selected
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                {getMonthRangeLabel()}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t dark:border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
