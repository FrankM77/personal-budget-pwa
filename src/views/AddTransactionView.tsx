import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Mic } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { SplitTransactionHelper } from '../components/SplitTransactionHelper';
import CardStack from '../components/ui/CardStack';
import { useSiriQuery } from '../hooks/useSiriQuery';
import type { PaymentSource } from '../models/types';
import '../styles/CardStack.css';

interface AddTransactionViewProps {
  onClose?: () => void;
  onSaved?: () => void;
}

export const AddTransactionView: React.FC<AddTransactionViewProps> = ({ onClose, onSaved }) => {
  const navigate = useNavigate();
  const { envelopes, addTransaction, currentMonth, appSettings } = useBudgetStore();
  const { parsedData, isParsing, siriQuery, clearParsedData } = useSiriQuery();

  // Check for Siri data from sessionStorage (for webapp URL scheme handling)
  useEffect(() => {
    const storedSiriData = sessionStorage.getItem('siriParsedData');
    const storedSiriQuery = sessionStorage.getItem('siriQuery');
    
    if (storedSiriData && storedSiriQuery && !parsedData && !siriQuery) {
      try {
        const data = JSON.parse(storedSiriData);
        console.log('🎙️ Siri: Loaded stored data from sessionStorage:', data);
        
        // Manually set the parsed data as if it came from the hook
        if (data.amount !== null) {
          setAmount(data.amount.toFixed(2));
        }
        if (data.merchant) {
          setMerchant(data.merchant);
        }
        if (data.description) {
          setNote(data.description);
        }
        if (data.type) {
          setTransactionType(data.type === 'Income' ? 'income' : 'expense');
        }
        if (data.envelopeId) {
          setSiriEnvelopeId(data.envelopeId);
        }

        // Payment method prefill
        if (data.paymentMethodName && appSettings?.paymentSources?.length) {
          const normalized = data.paymentMethodName.toLowerCase();
          const matched = appSettings.paymentSources.find((p) => {
            const name = p.name.toLowerCase();
            return name === normalized || name.includes(normalized) || normalized.includes(name);
          });

          if (matched) {
            setSelectedPaymentMethod(matched);
            setHasUserSelectedPayment(false);
          }
        }

        setSiriPrefilled(true);
        setStoredSiriQueryText(storedSiriQuery);
        console.log('🎙️ Siri: Pre-filled form from sessionStorage');
        
        // Clear sessionStorage after using
        sessionStorage.removeItem('siriParsedData');
        sessionStorage.removeItem('siriQuery');
      } catch (error) {
        console.error('🎙️ Siri: Failed to parse stored data:', error);
      }
    }
  }, [parsedData, siriQuery, appSettings?.paymentSources]);

  // Form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [siriPrefilled, setSiriPrefilled] = useState(false);
  const [storedSiriQueryText, setStoredSiriQueryText] = useState<string | null>(null);
  // Initialize with LOCAL date string to ensure "today" is actually today for the user
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
  });
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentSource | null>(null);
  const [hasUserSelectedPayment, setHasUserSelectedPayment] = useState(false);
  const [siriEnvelopeId, setSiriEnvelopeId] = useState<string | null>(null);

  // Pre-fill form when Siri parsed data arrives
  useEffect(() => {
    if (!parsedData || siriPrefilled) return;

    if (parsedData.amount !== null) {
      setAmount(parsedData.amount.toFixed(2));
    }
    if (parsedData.merchant) {
      setMerchant(parsedData.merchant);
    }
    if (parsedData.description) {
      setNote(parsedData.description);
    }
    if (parsedData.type) {
      setTransactionType(parsedData.type === 'Income' ? 'income' : 'expense');
    }
    if (parsedData.envelopeId) {
      setSiriEnvelopeId(parsedData.envelopeId);
    }

    // Payment method prefill (match against Settings payment sources)
    if (parsedData.paymentMethodName && appSettings?.paymentSources?.length) {
      const normalized = parsedData.paymentMethodName.toLowerCase();
      const matched = appSettings.paymentSources.find((p) => {
        const name = p.name.toLowerCase();
        return name === normalized || name.includes(normalized) || normalized.includes(name);
      });

      if (matched) {
        setSelectedPaymentMethod(matched);
        // Do NOT mark as user-selected; this is a Siri prefill.
        setHasUserSelectedPayment(false);
      }
    }

    setSiriPrefilled(true);
    console.log('🎙️ Siri: Pre-filled form with parsed data:', parsedData);
  }, [parsedData, siriPrefilled, appSettings?.paymentSources]);

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    // If opened directly (e.g., from Siri URL), navigate to home
    navigate('/');
  };

  const handlePaymentMethodSelect = (card: PaymentSource) => {
    setSelectedPaymentMethod(card);
    // Only mark as user selected if we already have a payment method (meaning this is a manual change)
    if (selectedPaymentMethod) {
      setHasUserSelectedPayment(true);
    }
  };

  // Form validation
  const hasSplits = Object.keys(splitAmounts).length > 0;
  const totalSplit = Object.values(splitAmounts).reduce((sum, amt) => sum + (amt || 0), 0);
  const isSplitValid = Math.abs(totalSplit - parseFloat(amount || '0')) < 0.01;
  const isFormValid = amount && parseFloat(amount) > 0 && hasSplits && isSplitValid;

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    
    // Properly handle the date to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const transactionDate = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid timezone issues
    
    console.log('📅 Selected date:', date);
    console.log('📅 Parsed date:', transactionDate.toISOString());

    try {
      // Validate date against current budget month
      const [y, m] = date.split('-').map(Number);
      const selectedMonthStr = `${y}-${m.toString().padStart(2, '0')}`;
      
      if (selectedMonthStr !== currentMonth) {
        const confirmMsg = `This transaction date (${selectedMonthStr}) does not match the current budget month (${currentMonth}). Are you sure you want to save it?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      // Create a transaction for each split
      const splitEntries = Object.entries(splitAmounts).filter(([_, amt]) => amt > 0);
      
      // Fire-and-forget: Create transactions in background
      // The optimistic updates will show them immediately
      Promise.all(
        splitEntries.map(([envelopeId, splitAmount]) =>
          addTransaction({
            amount: splitAmount,
            description: note,
            merchant: merchant || undefined,
            date: transactionDate.toISOString(),
            envelopeId,
            type: transactionType === 'income' ? 'Income' : 'Expense',
            reconciled: false,
            paymentMethod: selectedPaymentMethod || undefined
          }).catch(err => console.error('Failed to create transaction:', err))
        )
      ).catch(err => console.error('Failed to create transactions:', err));

      // Navigate/close immediately - don't wait for Firebase
      if (onSaved) {
        onSaved();
      }
      if (onClose) {
        onClose();
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Failed to save transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Sort envelopes by orderIndex (creation order) with name as fallback
  // Only show active envelopes (filter out deleted ones)
  const sortedEnvelopes = [...envelopes]
    .filter(env => env.isActive !== false)
    .sort((a, b) => {
      const aOrder = a.orderIndex ?? 0;
      const bOrder = b.orderIndex ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.name.localeCompare(b.name);
    });

  const amountColor = transactionType === 'income' ? 'text-green-500' : 'text-red-500';

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 dark:bg-black overscroll-contain">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+6px)] pb-2 sticky top-0 z-20 flex items-center justify-between">
        <button
          onClick={handleClose}
          className="text-blue-600 dark:text-blue-400 font-medium"
        >
          Cancel
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">New Transaction</h1>
        <button
          onClick={handleSubmit}
          disabled={!isFormValid}
          className="text-blue-600 dark:text-blue-400 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </header>

      {/* Siri Parsing Banner */}
      {isParsing && (
        <div className="mx-4 mt-3 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Mic size={18} className="text-purple-500 animate-pulse" />
          <span className="text-sm text-purple-700 dark:text-purple-300">Parsing voice input...</span>
        </div>
      )}
      {siriPrefilled && !isParsing && (siriQuery || storedSiriQueryText) && (
        <div className="mx-4 mt-3 p-3 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Mic size={14} className="text-purple-500" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Siri Shortcut</span>
            {parsedData && (
              <span className="ml-auto text-[10px] text-purple-500 dark:text-purple-400">
                {Math.round(parsedData.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400 italic truncate">"{siriQuery || storedSiriQueryText}"</p>
          <button
            type="button"
            onClick={() => { clearParsedData(); setSiriPrefilled(false); setStoredSiriQueryText(null); }}
            className="text-[10px] text-purple-500 dark:text-purple-400 underline mt-1"
          >
            Clear pre-filled data
          </button>
        </div>
      )}

      <div className="p-4 max-w-4xl mx-auto pb-[calc(8rem+env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type Toggle */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex">
              <button
                type="button"
                onClick={() => setTransactionType('expense')}
                className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
                  transactionType === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setTransactionType('income')}
                className={`flex-1 px-4 py-3 text-center font-medium transition-colors ${
                  transactionType === 'income'
                    ? 'bg-green-500 text-white'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="text-center">
            <label className="block text-sm text-gray-600 dark:text-zinc-400 mb-1">Amount</label>
            <div className="relative inline-block">
              <span className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-2xl ${amountColor}`}>$</span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, ''); // Strip non-digits
                  if (!rawValue) {
                    setAmount('');
                    return;
                  }
                  const cents = parseInt(rawValue, 10);
                  const dollars = (cents / 100).toFixed(2);
                  setAmount(dollars);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '-') {
                    e.preventDefault();
                  }
                }}
                placeholder="0.00"
                autoFocus
                className={`bg-transparent text-4xl font-bold text-center w-40 focus:outline-none ${amountColor} placeholder-gray-700`}
              />
            </div>
          </div>

          {/* Merchant Input */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Merchant</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Where did you make this transaction?"
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Payment Method */}
          <CardStack
            selectedCard={selectedPaymentMethod}
            onCardSelect={handlePaymentMethodSelect}
            isUserSelected={hasUserSelectedPayment}
          />

          {/* Note Input */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What is this for?"
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Date Input */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs text-gray-500 dark:text-zinc-400">Date</label>
              {(() => {
                const [y, m] = date.split('-').map(Number);
                const selectedMonthStr = `${y}-${m.toString().padStart(2, '0')}`;
                if (selectedMonthStr !== currentMonth) {
                  return (
                    <div className="flex items-center text-amber-500 gap-1" title="Date is outside current budget month">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-bold uppercase">Budget Mismatch</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-gray-900 dark:text-white focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Envelope Selection with Split Support */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-800 transition-colors">
            <SplitTransactionHelper
              envelopes={sortedEnvelopes}
              transactionAmount={parseFloat(amount) || 0}
              onSplitChange={setSplitAmounts}
              initialSelectedEnvelopeId={siriEnvelopeId}
            />
          </div>
        </form>
      </div>
    </div>
  );
};
