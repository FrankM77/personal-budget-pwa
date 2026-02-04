import React, { useEffect } from 'react';
import { useBudgetStore } from '../../stores/budgetStore';

/**
 * Temporary Store Debugger Component
 * Used to verify BudgetStore connects to BudgetService and fetches data correctly
 */
export const StoreTester: React.FC = () => {
  const {
    envelopes,
    transactions,
    incomeSources,
    allocations,
    currentMonth,
    isLoading,
    error,
    init
  } = useBudgetStore();

  useEffect(() => {
    // Initialize the store on component mount
    init();
  }, [init]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 m-4">
        <div className="flex items-center">
          <span className="text-xl mr-2">⚡</span>
          <span className="font-medium">Initializing Unified Store...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4">
        <div className="flex items-center">
          <span className="text-xl mr-2">❌</span>
          <div>
            <span className="font-medium">Store Error:</span>
            <span className="ml-2">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  const hasCurrentMonthIncome = incomeSources[currentMonth]?.length > 0;
  const hasCurrentMonthAllocations = allocations[currentMonth]?.length > 0;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 m-4">
      <div className="flex items-center mb-4">
        <span className="text-xl mr-2">✅</span>
        <h2 className="text-lg font-semibold text-green-800">Unified Store Status</h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-3 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">{envelopes.length}</div>
          <div className="text-sm text-gray-600">Envelopes</div>
        </div>
        
        <div className="bg-white p-3 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">{transactions.length}</div>
          <div className="text-sm text-gray-600">Transactions</div>
        </div>
        
        <div className="bg-white p-3 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {incomeSources[currentMonth]?.length || 0}
          </div>
          <div className="text-sm text-gray-600">Income Sources ({currentMonth})</div>
        </div>
        
        <div className="bg-white p-3 rounded border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {allocations[currentMonth]?.length || 0}
          </div>
          <div className="text-sm text-gray-600">Allocations ({currentMonth})</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm">
          <span className={`w-3 h-3 rounded-full mr-2 ${hasCurrentMonthIncome ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          <span>Income data for {currentMonth}: {hasCurrentMonthIncome ? '✓ Available' : '✗ None'}</span>
        </div>
        
        <div className="flex items-center text-sm">
          <span className={`w-3 h-3 rounded-full mr-2 ${hasCurrentMonthAllocations ? 'bg-green-500' : 'bg-gray-300'}`}></span>
          <span>Allocation data for {currentMonth}: {hasCurrentMonthAllocations ? '✓ Available' : '✗ None'}</span>
        </div>
      </div>

      {envelopes.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            📋 First Envelope Data (Click to expand)
          </summary>
          <div className="mt-3 bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
            <pre className="text-xs">
              {JSON.stringify(envelopes[0], null, 2)}
            </pre>
          </div>
        </details>
      )}

      <div className="mt-6 text-xs text-gray-500 border-t pt-4">
        <div>Current Month: {currentMonth}</div>
        <div>Store initialized successfully</div>
      </div>
    </div>
  );
};
