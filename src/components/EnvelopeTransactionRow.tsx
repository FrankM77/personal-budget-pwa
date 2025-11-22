import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Transaction } from '../models/types';

interface Props {
  transaction: Transaction;
  onReconcile: () => void;
  onEdit: () => void;
}

// Helper to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Helper to format date
const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const EnvelopeTransactionRow: React.FC<Props> = ({ transaction, onReconcile, onEdit }) => {
  // Determine amount color: RED for Expense or Transfer, GREEN for Income
  const amountColor = transaction.type === 'Income' ? 'text-green-500' : 'text-red-500';
  const amountPrefix = transaction.type === 'Income' ? '+' : '-';

  return (
    <div className="flex justify-between items-center p-4 hover:bg-gray-700 transition duration-150">
      {/* Left + Right side: Clickable area for editing */}
      <div 
        className="flex justify-between items-center flex-1 cursor-pointer"
        onClick={onEdit}
      >
        {/* Left side: Description and Date */}
        <div>
          <p className="text-white font-bold">{transaction.description}</p>
          <p className="text-sm text-gray-400">{formatDate(transaction.date)}</p>
        </div>

        {/* Right side (within clickable area): Amount */}
        <span className={`font-bold ${amountColor}`}>
          {amountPrefix}{formatCurrency(transaction.amount)}
        </span>
      </div>

      {/* Far Right: Reconcile button (separate from clickable area) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReconcile();
        }}
        className="ml-4 p-1 hover:bg-gray-600 rounded transition duration-150"
      >
        {transaction.reconciled ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <Circle className="w-6 h-6 text-gray-400" />
        )}
      </button>
    </div>
  );
};

export default EnvelopeTransactionRow;

