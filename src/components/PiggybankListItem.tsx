import React, { useEffect, useRef, useState } from 'react';
import { PiggyBank, TrendingUp, Pause, GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLongPress, LongPressEventType } from 'use-long-press';
import type { Envelope } from '../models/types';
import { Decimal } from 'decimal.js';
import { triggerHaptic } from '../utils/haptics';

interface PiggybankListItemProps {
  piggybank: Envelope;
  balance: Decimal;
  onNavigate: (id: string) => void;
  setMoveableRef?: (el: HTMLDivElement | null) => void;
  isReorderingActive?: boolean;
  activelyDraggingId?: string | null;
  onItemDragStart?: (id: string) => void;
  onLongPressTrigger: (e: any, id: string) => void;
}

export const PiggybankListItem: React.FC<PiggybankListItemProps> = ({
  piggybank,
  balance,
  onNavigate,
  setMoveableRef,
  isReorderingActive,
  activelyDraggingId,
  onItemDragStart,
  onLongPressTrigger
}) => {
  // long press for mobile reordering
  const bind = useLongPress((event) => {
    // Vibrate to indicate grab
    triggerHaptic();
    onLongPressTrigger(event, piggybank.id);
  }, {
    threshold: 500, // Standard threshold
    cancelOnMovement: 25, // More forgiving movement cancellation
    detect: LongPressEventType.Touch
  });

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



  const handleMoveableClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't navigate if we just dragged this item or if currently reordering
    if (didDragThisItem || isReorderingActive) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    onNavigate(piggybank.id);
  };

  const isBeingDragged = activelyDraggingId === piggybank.id;

  const content = (
    <div className="flex items-center gap-3 w-full">
      {/* Drag Handle - visible on hover for desktop */}
      <div 
        className="hidden md:flex items-center justify-center p-1 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-all duration-200"
        onMouseDown={(e) => onLongPressTrigger(e, piggybank.id)}
      >
        <GripVertical size={20} />
      </div>
      
      {/* Content Wrapper */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              <PiggyBank size={12} style={{ color }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">
                {piggybank.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp size={10} style={{ color }} />
                <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium">
                  ${monthlyContribution.toFixed(2)}/mo
                </span>
                {isPaused && (
                  <span className="text-[9px] text-orange-600 dark:text-orange-400 font-bold ml-1 flex items-center gap-0.5">
                    <Pause size={8} /> PAUSED
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right flex-shrink-0">
            <div className="text-sm font-bold text-gray-900 dark:text-white leading-none">
              ${balanceNum.toFixed(2)}
            </div>
            <div className="text-[9px] text-gray-400 dark:text-zinc-500 mt-1">
              of ${targetAmount?.toFixed(0) || '0'}
            </div>
          </div>
        </div>

        {/* Thinner Progress Bar */}
        {targetAmount && targetAmount > 0 && (
          <div className="w-full bg-gray-200 dark:bg-zinc-800/50 rounded-full h-0.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: color
              }}
            />
          </div>
        )}
        
        {goalReached && !targetAmount && (
          <div className="text-[9px] text-green-600 dark:text-green-400 font-bold mt-0.5">
            🎉 GOAL REACHED
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      {...bind()}
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
        borderColor: accentBorder,
        boxShadow: isBeingDragged ? '0 18px 45px rgba(15,23,42,0.35)' : '0 1px 2px rgba(15,23,42,0.08)',
        zIndex: isBeingDragged ? 50 : 1,
        scale: isBeingDragged ? 1.02 : 1
      }}
      className="rounded-xl py-1.5 px-3 border transition-all cursor-pointer shadow-sm hover:shadow-md select-none active:scale-[0.99] group"
    >
      {content}
    </motion.div>
  );
};
