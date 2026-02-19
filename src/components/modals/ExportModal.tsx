import React, { useState } from 'react';
import { X, Download, Calendar, FileText } from 'lucide-react';
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
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
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

      
      if (exportFormat === 'csv') {
        // CSV Export (existing logic)
        const headers = ['Date', 'Merchant', 'Payment Method', 'Notes', 'Amount', 'Type', 'Envelope', 'Reconciled'];
        const rows: string[] = [];
        
        for (const t of filtered) {
          const env = envelopes.find(e => e.id === t.envelopeId);
          const envName = env?.name || 'Unknown';
          const reconciled = t.reconciled || false;
          
          let safeMerchant = (t.merchant || '').replace(/"/g, '""');
          let safeNotes = (t.notes || '').replace(/"/g, '""');
          
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
            t.amount.toFixed(2),
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
      } else if (exportFormat === 'pdf') {
        // PDF Export
        // Simple PDF export using window.print
        const monthRange = getMonthRangeLabel();
        let htmlContent = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .expense { color: #dc3545; }
                .income { color: #28a745; }
                .summary { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
              </style>
            </head>
            <body>
              <h1>Budget Transactions Report</h1>
              <p><strong>Period:</strong> ${monthRange}</p>
              <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        `;

        // Calculate summary
        const totalIncome = filtered
          .filter(t => t.type === 'Income')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const totalExpenses = filtered
          .filter(t => t.type === 'Expense')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const netAmount = totalIncome - totalExpenses;

        htmlContent += `
          <div class="summary">
            <h2>Summary</h2>
            <p><strong>Total Income:</strong> <span class="income">$${totalIncome.toFixed(2)}</span></p>
            <p><strong>Total Expenses:</strong> <span class="expense">$${totalExpenses.toFixed(2)}</span></p>
            <p><strong>Net Amount:</strong> <span class="${netAmount >= 0 ? 'income' : 'expense'}">$${netAmount.toFixed(2)}</span></p>
            <p><strong>Transaction Count:</strong> ${filtered.length}</p>
          </div>
        `;

        // Add transactions table
        htmlContent += `
          <h2>Transactions</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Envelope</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reconciled</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const t of filtered) {
          const env = envelopes.find(e => e.id === t.envelopeId);
          const envName = env?.name || 'Unknown';
          const reconciled = t.reconciled || false;
          const amountClass = t.type === 'Income' ? 'income' : 'expense';
          
          let dateStr = 'Invalid Date';
          if (t.date) {
            if (typeof t.date === 'string') {
              dateStr = t.date.split('T')[0];
            } else if (typeof t.date === 'number') {
              const APPLE_EPOCH_OFFSET = 978307200000;
              const ts = t.date < 2000000000 ? (t.date + APPLE_EPOCH_OFFSET) * 1000 : t.date;
              dateStr = new Date(ts).toISOString().split('T')[0];
            }
          }
          
          htmlContent += `
            <tr>
              <td>${dateStr}</td>
              <td>${t.merchant || ''}</td>
              <td>${envName}</td>
              <td>${t.type}</td>
              <td class="${amountClass}">$${Math.abs(t.amount).toFixed(2)}</td>
              <td>${reconciled ? 'Yes' : 'No'}</td>
            </tr>
          `;
        }

        htmlContent += `
            </tbody>
          </table>
        </body>
      </html>
        `;

        // Create a temporary window and print
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          // Wait for content to load, then print
          printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
          };
        }
      }
      
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
          {/* Export Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportFormat('csv')}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                  ${exportFormat === 'csv'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => setExportFormat('pdf')}
                className={`
                  px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                  ${exportFormat === 'pdf'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>
          </div>

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
                {exportFormat === 'csv' ? (
                  <>
                    <Download className="w-4 h-4" />
                    Export CSV
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Export PDF
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
