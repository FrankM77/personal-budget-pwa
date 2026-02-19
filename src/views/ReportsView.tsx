import React, { useState } from 'react';
import { ArrowLeft, Download, FileText, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';
import { ExportModal } from '../components/modals/ExportModal';

export const ReportsView: React.FC = () => {
  const navigate = useNavigate();
  const { transactions, envelopes } = useBudgetStore();
  const [showExportModal, setShowExportModal] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-4 p-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Reports</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Export Transactions Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              Export Transactions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Export your transaction data for external analysis or record keeping
            </p>
          </div>
          
          <div className="p-4 space-y-3">
            <button
              onClick={() => setShowExportModal(true)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors border border-gray-200 dark:border-zinc-600 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-blue-500" />
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">
                    Export Transaction Data
                  </span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Export transactions as CSV or PDF with customizable date ranges
                  </span>
                </div>
              </div>
              <div className="text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-blue-800 dark:text-blue-200 font-medium">Export Features:</p>
                  <ul className="text-blue-700 dark:text-blue-300 text-xs mt-1 space-y-1">
                    <li>• Custom date range selection</li>
                    <li>• CSV format for spreadsheet compatibility</li>
                    <li>• PDF format for professional reports and sharing</li>
                    <li>• Includes transaction details, categories, and envelope information</li>
                    <li>• Filter by specific envelopes or categories</li>
                    <li>• Summary statistics in PDF reports</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Future Reports Section */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-500" />
              Coming Soon
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Advanced reporting features planned for future releases
            </p>
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-700/30 rounded-lg opacity-60">
              <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 font-medium">Monthly Summary Reports</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Comprehensive monthly financial summaries</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-700/30 rounded-lg opacity-60">
              <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 font-medium">PDF Reports</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Generate formatted PDF reports for sharing</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-700/30 rounded-lg opacity-60">
              <div className="w-8 h-8 bg-gray-200 dark:bg-zinc-600 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-gray-700 dark:text-gray-300 font-medium">Tax Reports</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Categorized reports for tax preparation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        transactions={transactions}
        envelopes={envelopes}
      />
    </div>
  );
};
