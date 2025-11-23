import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderPlus } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';

export const AddEnvelopeView: React.FC = () => {
  const navigate = useNavigate();
  const { addEnvelope } = useEnvelopeStore();
  
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Parse balance, default to 0 if empty
    const balanceValue = parseFloat(initialBalance);
    const finalBalance = isNaN(balanceValue) ? 0 : balanceValue;

    addEnvelope(name, finalBalance);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate('/')} className="mr-3 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Envelope</h1>
      </header>

      <div className="p-4 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex justify-center py-8">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <FolderPlus size={40} />
            </div>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Envelope Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries, Rent, Fun Money"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                autoFocus
                required
              />
            </div>

            {/* Initial Balance Input */}
            <div className="space-y-2">
              <label htmlFor="balance" className="block text-sm font-medium text-gray-700">
                Initial Balance (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  id="balance"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-gray-500">
                You can also add money later via the "Distribute Funds" screen.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold shadow-sm text-white transition-colors ${
                  name.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Create Envelope
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
