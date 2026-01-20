import React, { useEffect, useRef, useState } from 'react';
import { PiggyBank, TrendingUp, Pause, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Envelope } from '../models/types';
import { Decimal } from 'decimal.js';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';

interface PiggybankListItemProps {
  piggybank: Envelope;
  balance: Decimal;
  onNavigate: (id: string) => void;
  setMoveableRef?: (el: HTMLDivElement | null) => void;
  isReorderingActive?: boolean;
  activelyDraggingId?: string | null;
  onItemDragStart?: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  isReorderUnlocked?: boolean;
}

export const PiggybankListItem: React.FC<PiggybankListItemProps> = ({
  piggybank,
  balance,
  onNavigate,
  setMoveableRef,
  isReorderingActive,
  activelyDraggingId,
  onItemDragStart,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isReorderUnlocked
}) => {
  const updatePiggybankContribution = useBudgetStore(state => state.updatePiggybankContribution);
  const showToast = useToastStore(state => state.showToast);

  const targetAmount = piggybank.piggybankConfig?.targetAmount;
  const monthlyContribution = piggybank.piggybankConfig?.monthlyContribution ?? 0;
  const color = piggybank.piggybankConfig?.color || '#3B82F6';
  const isPaused = piggybank.piggybankConfig?.paused || false;
  
  const balanceNum = typeof balance === 'number' ? balance : balance.toNumber();
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
  const moveableItemRef = useRef<HTMLDivElement>(null);
  const [didDragThisItem, setDidDragThisItem] = useState(false);
  
  // Calculate progress percentage
  const progressPercentage = targetAmount && targetAmount > 0
    ? Math.min((balanceNum / targetAmount) * 100, 100)
    : 0;

  // Determine if goal is reached
  const goalReached = targetAmount && balanceNum >= targetAmount;

  // Reset drag flag when it changes from another item
  useEffect(() => {
    if (activelyDraggingId && activelyDraggingId !== piggybank.id) {
      setDidDragThisItem(false);
    }
  }, [activelyDraggingId, piggybank.id]);

  // Handle drag start for this item
  useEffect(() => {
    if (activelyDraggingId === piggybank.id) {
      setDidDragThisItem(true);
      if (onItemDragStart) onItemDragStart(piggybank.id);
    }
  }, [activelyDraggingId, piggybank.id, onItemDragStart]);

  // Clear drag flag after a delay when drag ends
  useEffect(() => {
    if (!activelyDraggingId && didDragThisItem) {
      const timer = setTimeout(() => {
        setDidDragThisItem(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activelyDraggingId, didDragThisItem]);

  useEffect(() => {
    if (!isEditingContribution) {
      setContributionInput(monthlyContribution ? monthlyContribution.toFixed(2) : '0.00');
    }
  }, [monthlyContribution, isEditingContribution]);

  useEffect(() => {
    if (isEditingContribution && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingContribution]);

  const beginContributionEdit = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('touches' in event || event.type.startsWith('touch')) {
      event.preventDefault();
    }
    if (isSavingContribution) return;
    setContributionInput(monthlyContribution ? monthlyContribution.toFixed(2) : '0.00');
    setIsEditingContribution(true);
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
      // Use the new dedicated store action
      await updatePiggybankContribution(piggybank.id, parsedValue);
      
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

  const handleMoveableClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't navigate if we just dragged this item or if currently reordering
    if (didDragThisItem || isReorderingActive) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Don't navigate if editing contribution
    if (isEditingContribution) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    onNavigate(piggybank.id);
  };

  const isBeingDragged = activelyDraggingId === piggybank.id;

  const content = (
    <div className="flex items-center gap-2 w-full">
      {/* Reorder Buttons - only show when unlocked and handler provided */}
      {isReorderUnlocked && onMoveUp && onMoveDown && (
      <div className="flex flex-col gap-1 mr-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={isFirst}
          className={`p-1 rounded transition-colors ${
            isFirst
              ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
              : 'text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
          title="Move up"
          aria-label="Move piggybank up"
        >
          <ChevronUp size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={isLast}
          className={`p-1 rounded transition-colors ${
            isLast
              ? 'text-gray-300 dark:text-zinc-700 cursor-not-allowed'
              : 'text-gray-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
          title="Move down"
          aria-label="Move piggybank down"
        >
          <ChevronDown size={18} />
        </button>
      </div>
      )}
      
      {/* Content Wrapper */}
      <div className="flex-1">
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
                  onClick={e => e.stopPropagation()}
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
                      autoFocus
                      className="w-28 pl-6 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  {isSavingContribution && <Loader2 size={16} className="animate-spin text-gray-400" />}
                </form>
              ) : (
                <div
                  onClick={beginContributionEdit}
                  onTouchEnd={beginContributionEdit}
                  className="font-medium text-gray-900 dark:text-white hover:underline cursor-pointer"
                >
                  ${monthlyContribution.toFixed(2)}/month
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      layout={!isBeingDragged}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }
      }}
      ref={(el) => {
        if (setMoveableRef) setMoveableRef(el);
        moveableItemRef.current = el;
      }}
      onClick={handleMoveableClick}
      style={{
        background: accentBackground, 
        borderColor: accentBorder
      }}
      className="rounded-xl p-4 border transition-all cursor-pointer shadow-sm hover:shadow-md select-none"
    >
      {content}
    </motion.div>
  );
};