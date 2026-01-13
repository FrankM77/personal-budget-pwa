import React, { useEffect, useRef, useState } from 'react';
import { PiggyBank, TrendingUp, Pause, Loader2 } from 'lucide-react';
import type { Envelope } from '../models/types';
import { Decimal } from 'decimal.js';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useMonthlyBudgetStore } from '../stores/monthlyBudgetStore';
import { useToastStore } from '../stores/toastStore';

interface PiggybankListItemProps {
  piggybank: Envelope;
  balance: Decimal;
  onNavigate: (id: string) => void;
}

export const PiggybankListItem: React.FC<PiggybankListItemProps> = ({
  piggybank,
  balance,
  onNavigate
}) => {
  const updateEnvelope = useEnvelopeStore(state => state.updateEnvelope);
  const transactions = useEnvelopeStore(state => state.transactions);
  const deleteTransaction = useEnvelopeStore(state => state.deleteTransaction);
  const currentMonth = useMonthlyBudgetStore(state => state.currentMonth);
  const setEnvelopeAllocation = useMonthlyBudgetStore(state => state.setEnvelopeAllocation);
  const showToast = useToastStore(state => state.showToast);

  const targetAmount = piggybank.piggybankConfig?.targetAmount;
  const monthlyContribution = piggybank.piggybankConfig?.monthlyContribution || 0;
  const color = piggybank.piggybankConfig?.color || '#3B82F6';
  const isPaused = piggybank.piggybankConfig?.paused || false;
  const balanceNum = balance.toNumber();
  const hexToRgba = (hex: string, alpha = 1) => {
    const normalizedHex = hex.replace('#', '');
    const bigint = parseInt(normalizedHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const accentBackground = `linear-gradient(135deg, ${hexToRgba(color, 0.14)} 0%, ${hexToRgba(color, 0.05)} 100%)`;
  const accentBorder = hexToRgba(color, 0.4);
  const [isEditingContribution, setIsEditingContribution] = useState(false);
  const [contributionInput, setContributionInput] = useState(
    monthlyContribution ? monthlyContribution.toFixed(2) : '0.00'
  );
  const [isSavingContribution, setIsSavingContribution] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Calculate progress percentage
  const progressPercentage = targetAmount && targetAmount > 0
    ? Math.min((balanceNum / targetAmount) * 100, 100)
    : 0;

  // Determine if goal is reached
  const goalReached = targetAmount && balanceNum >= targetAmount;

  useEffect(() => {
    if (!isEditingContribution) {
      setContributionInput(monthlyContribution ? monthlyContribution.toFixed(2) : '0.00');
    }
  }, [monthlyContribution, isEditingContribution]);

  const beginContributionEdit = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if (isSavingContribution) return;
    setContributionInput(monthlyContribution ? monthlyContribution.toFixed(2) : '0.00');
    setIsEditingContribution(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const cancelContributionEdit = () => {
    setIsEditingContribution(false);
    setContributionInput(monthlyContribution ? monthlyContribution.toFixed(2) : '0.00');
  };

  const handleContributionSave = async () => {
    if (!isEditingContribution || isSavingContribution) return;
    const parsedValue = parseFloat(contributionInput);
    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      showToast('Enter a valid contribution amount', 'error');
      return;
    }

    if (parsedValue === monthlyContribution) {
      setIsEditingContribution(false);
      return;
    }

    setIsSavingContribution(true);
    try {
      const updatedEnvelope: Envelope = {
        ...piggybank,
        lastUpdated: new Date().toISOString(),
        piggybankConfig: {
          monthlyContribution: parsedValue,
          targetAmount: piggybank.piggybankConfig?.targetAmount,
          color: piggybank.piggybankConfig?.color,
          icon: piggybank.piggybankConfig?.icon,
          paused: piggybank.piggybankConfig?.paused,
        },
      };

      await updateEnvelope(updatedEnvelope);

      // Clean up legacy "Monthly contribution to..." transactions if they exist
      const legacyTx = transactions.find(
        tx =>
          tx.envelopeId === piggybank.id &&
          tx.isAutomatic === true &&
          tx.month === currentMonth &&
          tx.description.startsWith('Monthly contribution to')
      );

      if (legacyTx) {
        await deleteTransaction(legacyTx.id);
      }

      // Update envelope allocation (this will create/update the "Monthly Budget Allocation" transaction)
      if (!isPaused) {
        await setEnvelopeAllocation(piggybank.id, parsedValue);
      }

      showToast('Monthly contribution updated', 'success');
      setContributionInput(parsedValue.toFixed(2));
      setIsEditingContribution(false);
    } catch (error) {
      console.error('Failed to update piggybank contribution', error);
      showToast('Failed to update contribution', 'error');
    } finally {
      setIsSavingContribution(false);
    }
  };

  const handleContributionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleContributionSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelContributionEdit();
    }
  };

  return (
    <div
      onClick={() => onNavigate(piggybank.id)}
      className="rounded-xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md"
      style={{ background: accentBackground, borderColor: accentBorder }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${color}20` }}
          >
            <PiggyBank size={20} style={{ color }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {piggybank.name}
            </h3>
            {goalReached && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                🎉 Goal Reached!
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            ${balanceNum.toFixed(2)}
          </div>
          {targetAmount && (
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              of ${targetAmount.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar (if target is set) */}
      {targetAmount && targetAmount > 0 && (
        <div className="mb-3">
          <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: color
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              {progressPercentage.toFixed(0)}% complete
            </span>
            <span className="text-xs text-gray-500 dark:text-zinc-400">
              ${(targetAmount - balanceNum).toFixed(2)} to go
            </span>
            <span
              className="ml-2 px-2 py-0.5 text-[11px] font-semibold rounded-full uppercase tracking-wide"
              style={{
                backgroundColor: hexToRgba(color, 0.15),
                color
              }}
            >
              Piggybank
            </span>
          </div>
        </div>
      )}

      {/* Monthly Contribution */}
      <div className="mt-2">
        {isPaused ? (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
            <Pause size={14} className="text-orange-500" />
            <span className="text-orange-600 dark:text-orange-400">Paused</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
            <TrendingUp size={14} style={{ color }} />
            {isEditingContribution ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleContributionSave();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">
                    $
                  </span>
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    step="0.01"
                    value={contributionInput}
                    onChange={(e) => setContributionInput(e.target.value)}
                    onBlur={handleContributionSave}
                    onKeyDown={handleContributionKeyDown}
                    disabled={isSavingContribution}
                    className="w-28 pl-6 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                {isSavingContribution && <Loader2 size={16} className="animate-spin text-gray-400" />}
              </form>
            ) : (
              <button
                type="button"
                onClick={beginContributionEdit}
                className="font-medium text-gray-900 dark:text-white hover:underline focus:outline-none"
              >
                ${monthlyContribution.toFixed(2)}/month
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
