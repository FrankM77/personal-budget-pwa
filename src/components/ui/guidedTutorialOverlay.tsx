import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SkipForward, DollarSign, Wallet, TrendingUp, PiggyBank, CheckCircle2 } from 'lucide-react';
import { useBudgetStore } from '../../stores/budgetStore';

// ─── Tutorial Step Definitions ───

const TUTORIAL_STEPS = [
  {
    id: 'income',
    targetId: 'tutorial-income-section',
    title: 'Add Your Income',
    description: 'Tap the + button to add your first income source (e.g., Salary, Freelance).',
    icon: DollarSign,
    color: 'green',
    encouragement: 'Great start! Every budget begins with income.',
  },
  {
    id: 'envelope',
    targetId: 'tutorial-add-envelope',
    title: 'Create a Spending Envelope',
    description: 'Tap the + on any category to create your first spending envelope.',
    icon: Wallet,
    color: 'purple',
    encouragement: 'Nice! Envelopes help you track where money goes.',
  },
  {
    id: 'allocate',
    targetId: 'tutorial-allocation-area',
    title: 'Assign Money to Envelopes',
    description: 'Tap the budget amount on an envelope and enter how much to allocate.',
    icon: TrendingUp,
    color: 'blue',
    encouragement: 'Almost there! Give every dollar a job.',
  },
  {
    id: 'piggybank',
    targetId: 'tutorial-add-envelope',
    title: 'Create a Piggybank',
    description: 'Create a savings goal envelope. Toggle "Piggybank" when adding a new envelope.',
    icon: PiggyBank,
    color: 'pink',
    encouragement: 'You did it! Your budget is set up!',
  },
];

const TOTAL_STEPS = TUTORIAL_STEPS.length;

// ─── Color Maps ───

const colorMap: Record<string, { bg: string; border: string; text: string; ring: string; progressBg: string }> = {
  green: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300',
    ring: 'ring-green-400',
    progressBg: 'bg-green-500',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-300 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-400',
    progressBg: 'bg-purple-500',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    progressBg: 'bg-blue-500',
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-900/30',
    border: 'border-pink-300 dark:border-pink-700',
    text: 'text-pink-700 dark:text-pink-300',
    ring: 'ring-pink-400',
    progressBg: 'bg-pink-500',
  },
};

// ─── Hook: detect if any app modal is open (z-50 fixed overlays) ───

function useIsModalOpen() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      // App modals use: fixed inset-0 z-50
      const modals = document.querySelectorAll('.fixed.inset-0.z-50');
      setIsModalOpen(modals.length > 0);
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return isModalOpen;
}

// ─── Spotlight Highlight Component ───

const SpotlightOverlay: React.FC<{
  targetRect: DOMRect | null;
  visible: boolean;
}> = ({ targetRect, visible }) => {
  if (!visible || !targetRect) return null;

  const padding = 8;
  const borderRadius = 16;

  const holeLeft = targetRect.left - padding;
  const holeTop = targetRect.top - padding;
  const holeWidth = targetRect.width + padding * 2;
  const holeHeight = targetRect.height + padding * 2;

  return (
    <div className="fixed inset-0 z-[48] pointer-events-none">
      {/* Visual-only SVG overlay with cutout */}
      <svg className="w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={holeLeft}
              y={holeTop}
              width={holeWidth}
              height={holeHeight}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* 4 click-blocking divs around the cutout hole */}
      <div className="absolute left-0 right-0 top-0 pointer-events-auto" style={{ height: Math.max(0, holeTop) }} />
      <div className="absolute left-0 right-0 bottom-0 pointer-events-auto" style={{ top: holeTop + holeHeight }} />
      <div className="absolute left-0 pointer-events-auto" style={{ top: holeTop, height: holeHeight, width: Math.max(0, holeLeft) }} />
      <div className="absolute right-0 pointer-events-auto" style={{ top: holeTop, height: holeHeight, left: holeLeft + holeWidth }} />

      {/* Pulsing ring around target */}
      <motion.div
        className="absolute border-2 border-white/60 rounded-2xl pointer-events-none"
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeWidth,
          height: holeHeight,
        }}
        animate={{
          boxShadow: [
            '0 0 0 0 rgba(255,255,255,0.4)',
            '0 0 0 8px rgba(255,255,255,0)',
            '0 0 0 0 rgba(255,255,255,0.4)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
};

// ─── Main GuidedTutorialOverlay ───

export const GuidedTutorialOverlay: React.FC = () => {
  const guidedTutorialStep = useBudgetStore(s => s.guidedTutorialStep);
  const skipGuidedTutorial = useBudgetStore(s => s.skipGuidedTutorial);
  const advanceGuidedTutorial = useBudgetStore(s => s.advanceGuidedTutorial);
  const incomeSources = useBudgetStore(s => s.incomeSources);
  const currentMonth = useBudgetStore(s => s.currentMonth);
  const envelopes = useBudgetStore(s => s.envelopes);
  const allocations = useBudgetStore(s => s.allocations);

  const piggybanks = useMemo(() => envelopes.filter(e => e.isPiggybank), [envelopes]);

  const isModalOpen = useIsModalOpen();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = guidedTutorialStep;
  const isActive = step !== null && step >= 0 && step < TOTAL_STEPS;
  const currentTutorialStep = isActive ? TUTORIAL_STEPS[step!] : null;

  // Suppress spotlight when a modal is open or skip confirm is showing
  const showSpotlight = !isModalOpen && !showSkipConfirm && !showCelebration;

  // Track target element position
  const updateTargetRect = useCallback(() => {
    if (!currentTutorialStep) {
      setTargetRect(null);
      return;
    }
    const el = document.getElementById(currentTutorialStep.targetId);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentTutorialStep]);

  useEffect(() => {
    updateTargetRect();
    const interval = setInterval(updateTargetRect, 500);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  // Auto-advance when step condition is met
  useEffect(() => {
    if (step === null) return;

    const checkCondition = () => {
      switch (step) {
        case 0:
          return (incomeSources[currentMonth] || []).length > 0;
        case 1:
          return envelopes.filter(e => !e.isPiggybank).length > 0;
        case 2:
          return (allocations[currentMonth] || []).filter(a => a.budgetedAmount > 0).length > 0;
        case 3:
          return piggybanks.length > 0;
        default:
          return false;
      }
    };

    if (checkCondition()) {
      setShowCelebration(true);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = setTimeout(() => {
        setShowCelebration(false);
        advanceGuidedTutorial();
        celebrationTimerRef.current = null;
      }, 1500);
      return () => {
        if (celebrationTimerRef.current) {
          clearTimeout(celebrationTimerRef.current);
          celebrationTimerRef.current = null;
        }
      };
    }
  }, [step, incomeSources, currentMonth, envelopes, allocations, piggybanks, advanceGuidedTutorial]);

  if (!isActive || !currentTutorialStep) return null;

  const colors = colorMap[currentTutorialStep.color] || colorMap.blue;
  const Icon = currentTutorialStep.icon;
  const progress = ((step! + 1) / TOTAL_STEPS) * 100;

  return (
    <>
      {/* Spotlight overlay — hidden when modals are open so user can interact freely */}
      {showSpotlight && (
        <SpotlightOverlay targetRect={targetRect} visible={true} />
      )}

      {/* Tutorial Card — always visible (unless celebrating or confirming skip) */}
      {/* z-[49] = below modals (z-50) so it doesn't interfere */}
      <AnimatePresence mode="wait">
        {!showCelebration && !showSkipConfirm && !isModalOpen && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="fixed left-4 right-4 z-[49] max-w-md mx-auto pointer-events-auto"
            style={
              targetRect
                ? {
                    bottom: targetRect.top > window.innerHeight / 2
                      ? window.innerHeight - targetRect.top + 20
                      : undefined,
                    top: targetRect.top <= window.innerHeight / 2
                      ? targetRect.bottom + 20
                      : undefined,
                  }
                : { bottom: 24 }
            }
          >
            <div className={`${colors.bg} border ${colors.border} rounded-2xl p-4 shadow-2xl`}>
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                    Setup Progress
                  </span>
                  <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${colors.progressBg}`}
                    initial={{ width: `${((step!) / TOTAL_STEPS) * 100}%` }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  {TUTORIAL_STEPS.map((s, i) => (
                    <div key={s.id} className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1 ${
                        i < step! ? 'bg-green-500' : i === step ? colors.progressBg : 'bg-gray-300 dark:bg-zinc-600'
                      }`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className="flex items-start gap-3">
                <div className={`${colors.bg} p-2 rounded-xl border ${colors.border} flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">
                    Step {step! + 1}: {currentTutorialStep.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                    {currentTutorialStep.description}
                  </p>
                </div>
              </div>

              {/* Skip Button */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setShowSkipConfirm(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-white/50 dark:hover:bg-zinc-800/50"
                >
                  <SkipForward size={12} />
                  Skip Tutorial
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Celebration Toast */}
        {showCelebration && (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-[49] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-green-200 dark:border-green-800 text-center max-w-xs">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              </motion.div>
              <p className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                {step! < TOTAL_STEPS - 1 ? 'Step Complete!' : 'All Done!'}
              </p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                {currentTutorialStep.encouragement}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip Confirmation Modal — above everything */}
      <AnimatePresence>
        {showSkipConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-zinc-800"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Skip Tutorial?</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">
                You're <strong>{Math.round(progress)}%</strong> through the setup!
              </p>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                You can always restart from Settings if you change your mind.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Keep Going
                </button>
                <button
                  onClick={() => {
                    setShowSkipConfirm(false);
                    skipGuidedTutorial();
                  }}
                  className="flex-1 py-2.5 px-4 bg-gray-800 dark:bg-zinc-700 text-white rounded-xl font-medium hover:bg-gray-900 dark:hover:bg-zinc-600 transition-colors"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GuidedTutorialOverlay;
