import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';

export const AddTransactionView: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes, spendFromEnvelope, addToEnvelope } = useEnvelopeStore();
  
  // Sort envelopes alphabetically for the dropdown
  const sortedEnvelopes = [...envelopes]
    .filter(e => e.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [envelopeId, setEnvelopeId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const isExpense = type === 'expense';
  const themeColor = isExpense ? 'text-red-600' : 'text-green-600';
  const bgColor = isExpense ? 'bg-red-50' : 'bg-green-50';
  const buttonColor = isExpense ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (!envelopeId || isNaN(val) || val <= 0) return;

    if (isExpense) {
      spendFromEnvelope(envelopeId, val, note || 'Expense', new Date());
    } else {
      addToEnvelope(envelopeId, val, note || 'Deposit', new Date());
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate('/')} className="mr-3 text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Transaction</h1>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        
        {/* Type Toggle */}
        <div className="flex bg-gray-200 p-1 rounded-xl">
          <button
            onClick={() => setType('expense')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-all ${
              isExpense ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <TrendingDown size={18} /> Expense
          </button>
          <button
            onClick={() => setType('income')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition-all ${
              !isExpense ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <TrendingUp size={18} /> Income
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CSS to hide default browser spinners on number inputs */}
          <style>{`
            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
              -webkit-appearance: none; 
              margin: 0; 
            }
            input[type=number] {
              -moz-appearance: textfield;
            }
          `}</style>

          {/* Amount Input - Flexbox Layout */}
          <div className={`py-8 px-4 rounded-2xl ${bgColor} border border-gray-100 flex flex-col items-center justify-center`}>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Amount</label>
            
            <div className="flex items-center justify-center">
              <span className={`text-4xl font-bold mr-1 ${themeColor}`}>$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                placeholder="0.00"
                step="0.01"
                className={`w-48 bg-transparent text-5xl font-bold text-left focus:outline-none placeholder-gray-300 ${themeColor}`}
                autoFocus
              />
            </div>
          </div>

          {/* Envelope Select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Select Envelope</label>
            <select
              value={envelopeId}
              onChange={(e) => setEnvelopeId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              required
            >
              <option value="" disabled>Choose an envelope...</option>
              {sortedEnvelopes.map(env => (
                <option key={env.id} value={env.id}>
                  {env.name} (${env.currentBalance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was this for?"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!envelopeId || !amount}
            className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}
          >
            {isExpense ? 'Spend Money' : 'Add Money'}
          </button>
        </form>
      </div>
    </div>
  );
};
