import React from 'react';
import { PiggyBank, TrendingUp, Pause } from 'lucide-react';
import type { Envelope } from '../models/types';
import { Decimal } from 'decimal.js';

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
  
  // Calculate progress percentage
  const progressPercentage = targetAmount && targetAmount > 0
    ? Math.min((balanceNum / targetAmount) * 100, 100)
    : 0;

  // Determine if goal is reached
  const goalReached = targetAmount && balanceNum >= targetAmount;

  return (
    <div
      onClick={() => onNavigate(`/envelope/${piggybank.id}`)}
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
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400">
        {isPaused ? (
          <>
            <Pause size={14} className="text-orange-500" />
            <span className="text-orange-600 dark:text-orange-400">Paused</span>
          </>
        ) : (
          <>
            <TrendingUp size={14} style={{ color }} />
            <span>${monthlyContribution.toFixed(2)}/month</span>
          </>
        )}
      </div>
    </div>
  );
};
