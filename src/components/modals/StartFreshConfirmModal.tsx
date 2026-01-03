import React, { useState } from 'react';

interface StartFreshConfirmModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentMonth: string;
  incomeCount: number;
  totalIncome: number;
  allocationCount: number;
  totalAllocated: number;
  isLoading?: boolean;
}

const StartFreshConfirmModal: React.FC<StartFreshConfirmModalProps> = ({
  isVisible,
  onClose,
  onConfirm,
  currentMonth,
  incomeCount,
  totalIncome,
  allocationCount,
  totalAllocated,
  isLoading = false,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [step, setStep] = useState<'confirm' | 'type'>('confirm');

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleConfirmClick = () => {
    if (step === 'confirm') {
      setStep('type');
    } else if (step === 'type' && confirmationText === 'START FRESH') {
      onConfirm();
    }
  };

  const handleClose = () => {
    setStep('confirm');
    setConfirmationText('');
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Start Fresh for {formatMonth(currentMonth)}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 'confirm' ? (
            <>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      This action will permanently delete:
                    </h3>
                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                      <ul className="space-y-1">
                        <li>• {incomeCount} income source{incomeCount !== 1 ? 's' : ''} (totaling ${totalIncome.toFixed(2)}/month)</li>
                        <li>• {allocationCount} envelope allocation{allocationCount !== 1 ? 's' : ''} (totaling ${totalAllocated.toFixed(2)})</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>All other months will remain completely unchanged.</strong> This only affects the current month's budget data.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-zinc-400">
                You can undo this action within 30 seconds if you change your mind.
              </p>
            </>
          ) : (
            <>
              <div className="text-center">
                <p className="text-sm text-gray-900 dark:text-white mb-4">
                  Type <strong>START FRESH</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="START FRESH"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-zinc-800 dark:text-white text-center font-mono text-lg"
                  autoFocus
                />
              </div>

              <p className="text-xs text-gray-500 dark:text-zinc-500 text-center">
                This action cannot be undone after 30 seconds
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={
              isLoading ||
              (step === 'type' && confirmationText !== 'START FRESH')
            }
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Clearing...' : step === 'confirm' ? 'Continue' : 'Start Fresh'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartFreshConfirmModal;