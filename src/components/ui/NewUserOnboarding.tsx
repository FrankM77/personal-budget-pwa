import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  PiggyBank,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Plus,
  Target,
  RotateCcw,
  Tags,
  GripVertical,
  BarChart3,
  PieChart,
  SkipForward
} from 'lucide-react';
import appIcon from '/icon-512.png';
import budgetBalancedIcon from '/images/budget-balanced.png';
import { useBudgetStore } from '../../stores/budgetStore';

interface NewUserOnboardingProps {
  currentMonth: string;
  onComplete: () => void;
  onSkip: () => void;
}

const DEFAULT_CATEGORIES = [
  'Giving',
  'Savings',
  'Housing',
  'Transportation',
  'Food',
  'Personal',
  'Health',
  'Insurance',
  'Debt'
];

// ─── Mock UI Illustrations ───

const MockIncomeSection: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-green-400 dark:border-green-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">LOOK HERE</div>
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs font-bold text-gray-900 dark:text-white">Income Sources</span>
      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
        <Plus size={12} className="text-white" />
      </div>
    </div>
    <div className="space-y-1.5">
      <div className="flex justify-between items-center py-1 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <span className="text-[10px] text-gray-700 dark:text-zinc-300">Salary</span>
        <span className="text-[10px] font-bold text-green-600 dark:text-emerald-400">$3,500.00</span>
      </div>
      <div className="flex justify-between items-center py-1 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <span className="text-[10px] text-gray-700 dark:text-zinc-300">Freelance</span>
        <span className="text-[10px] font-bold text-green-600 dark:text-emerald-400">$800.00</span>
      </div>
    </div>
  </div>
);

const MockEnvelopeSection: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-purple-400 dark:border-purple-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">LOOK HERE</div>
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs font-bold text-gray-900 dark:text-white">Food</span>
      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
        <Plus size={12} className="text-white" />
      </div>
    </div>
    <div className="space-y-1.5">
      <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <div>
          <div className="text-[10px] font-medium text-gray-900 dark:text-white">Groceries</div>
          <div className="w-16 h-1 bg-gray-200 dark:bg-zinc-600 rounded-full mt-0.5">
            <div className="w-10 h-1 bg-purple-500 rounded-full" />
          </div>
        </div>
        <span className="text-[10px] font-bold text-gray-700 dark:text-zinc-300">$350 / $500</span>
      </div>
      <div className="flex justify-between items-center py-1.5 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <div>
          <div className="text-[10px] font-medium text-gray-900 dark:text-white">Dining Out</div>
          <div className="w-16 h-1 bg-gray-200 dark:bg-zinc-600 rounded-full mt-0.5">
            <div className="w-6 h-1 bg-purple-500 rounded-full" />
          </div>
        </div>
        <span className="text-[10px] font-bold text-gray-700 dark:text-zinc-300">$75 / $200</span>
      </div>
    </div>
  </div>
);

const MockAllocationBar: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-blue-400 dark:border-blue-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">LOOK HERE</div>
    <div className="flex justify-between text-[10px] font-medium mb-1">
      <span className="text-gray-700 dark:text-zinc-300">Left to Budget</span>
      <span className="font-bold text-green-600">$0.00</span>
    </div>
    <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
      <div className="w-full h-2 bg-green-500 rounded-full" />
    </div>
    <div className="text-[9px] text-green-600 dark:text-emerald-400 text-center mt-1 font-medium">
      Every dollar has a job!
    </div>
  </div>
);

const MockPiggybankSection: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-pink-400 dark:border-pink-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-pink-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">LOOK HERE</div>
    <div className="flex justify-between items-center mb-2">
      <div className="flex items-center gap-1">
        <PiggyBank size={12} className="text-pink-500" />
        <span className="text-xs font-bold text-gray-900 dark:text-white">Piggybanks</span>
      </div>
    </div>
    <div className="space-y-1.5">
      <div className="py-1.5 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-medium text-gray-900 dark:text-white">Vacation Fund</span>
          <span className="text-[10px] font-bold text-pink-600">$1,200 / $3,000</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-600 rounded-full mt-1">
          <div className="w-2/5 h-1.5 bg-pink-500 rounded-full" />
        </div>
      </div>
      <div className="py-1.5 px-2 bg-gray-50 dark:bg-zinc-700 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-medium text-gray-900 dark:text-white">Emergency Fund</span>
          <span className="text-[10px] font-bold text-pink-600">$4,500 / $10,000</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-600 rounded-full mt-1">
          <div className="w-[45%] h-1.5 bg-pink-500 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

const MockAnalyticsDonut: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-cyan-400 dark:border-cyan-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">ANALYTICS</div>
    <div className="flex items-center gap-3">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-zinc-700" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#8B5CF6" strokeWidth="3" strokeDasharray="35 65" strokeLinecap="round" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#3B82F6" strokeWidth="3" strokeDasharray="25 75" strokeDashoffset="-35" strokeLinecap="round" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="20 80" strokeDashoffset="-60" strokeLinecap="round" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#F59E0B" strokeWidth="3" strokeDasharray="15 85" strokeDashoffset="-80" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[8px] text-gray-500 dark:text-zinc-500">Total</span>
          <span className="text-[10px] font-bold text-gray-900 dark:text-white">$4,300</span>
        </div>
      </div>
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-[9px] text-gray-600 dark:text-zinc-400">Housing 35%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[9px] text-gray-600 dark:text-zinc-400">Food 25%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[9px] text-gray-600 dark:text-zinc-400">Transport 20%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[9px] text-gray-600 dark:text-zinc-400">Personal 15%</span>
        </div>
      </div>
    </div>
  </div>
);

const MockAnalyticsBar: React.FC = () => (
  <div className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-teal-400 dark:border-teal-600 p-3 relative overflow-hidden">
    <div className="absolute -top-1 -right-1 bg-teal-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">TRENDS</div>
    <div className="text-[10px] font-medium text-gray-700 dark:text-zinc-300 mb-2">Monthly Spending</div>
    <div className="flex items-end gap-1 h-12">
      {[65, 45, 80, 55, 70, 40].map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full rounded-t" style={{ height: `${h}%`, background: `hsl(${200 + i * 20}, 70%, 55%)` }} />
          <span className="text-[7px] text-gray-400">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}</span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Animated Reorder Demo ───
const REORDER_ITEMS = [
  { id: 'housing', label: 'Housing', sub: 'Rent, Utilities' },
  { id: 'food', label: 'Food', sub: 'Groceries, Dining' },
  { id: 'transport', label: 'Transportation', sub: 'Gas, Insurance' },
  { id: 'savings', label: 'Savings', sub: 'Emergency, Goals' },
];

const ReorderDemo: React.FC = () => {
  const [items, setItems] = useState(REORDER_ITEMS);
  const phaseRef = React.useRef(0);

  useEffect(() => {
    const sequence = [
      () => setItems([REORDER_ITEMS[1], REORDER_ITEMS[0], REORDER_ITEMS[2], REORDER_ITEMS[3]]),
      () => setItems([REORDER_ITEMS[3], REORDER_ITEMS[1], REORDER_ITEMS[0], REORDER_ITEMS[2]]),
      () => setItems(REORDER_ITEMS),
    ];

    const timer = setInterval(() => {
      phaseRef.current = (phaseRef.current + 1) % sequence.length;
      sequence[phaseRef.current]();
    }, 2000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white dark:bg-indigo-950/30 rounded-lg p-2 border border-indigo-300 dark:border-indigo-700 space-y-1">
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-2 py-1.5 px-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg"
          >
            <GripVertical size={14} className="text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-indigo-900 dark:text-indigo-200">{item.label}</div>
              <div className="text-[9px] text-indigo-600 dark:text-indigo-400">{item.sub}</div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <p className="text-[9px] text-indigo-500 dark:text-indigo-400 text-center italic mt-1">
        Categories reordering automatically...
      </p>
    </div>
  );
};

// ─── Main Component ───

const NewUserOnboarding: React.FC<NewUserOnboardingProps> = ({ currentMonth, onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentBudgetAmount, setCurrentBudgetAmount] = useState(2500);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const { addCategory } = useBudgetStore();

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleComplete = async () => {
    // Create selected categories
    for (let i = 0; i < selectedCategories.length; i++) {
      await addCategory({
        name: selectedCategories[i],
        orderIndex: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    onComplete();
  };

  const handleSkip = async () => {
    // Still create default categories when skipping
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      await addCategory({
        name: DEFAULT_CATEGORIES[i],
        orderIndex: i,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    onSkip();
  };

  // Animate budget amount when animation key changes or when entering the allocate step
  useEffect(() => {
    if (currentStep === 5) {
      setCurrentBudgetAmount(2500);
      
      const phase1Duration = 2000;
      const phase1Steps = 20;
      const phase1Interval = phase1Duration / phase1Steps;
      const decrement = 2500 / phase1Steps;
      
      let step = 0;
      const phase1Timer = setInterval(() => {
        step++;
        const newAmount = Math.max(0, 2500 - (decrement * step));
        setCurrentBudgetAmount(newAmount);
        
        if (step >= phase1Steps) {
          clearInterval(phase1Timer);
          
          setTimeout(() => {
            let overBudgetStep = 0;
            const overBudgetSteps = 10;
            const overBudgetInterval = 200;
            const overBudgetDecrement = 500 / overBudgetSteps;
            
            const phase2Timer = setInterval(() => {
              overBudgetStep++;
              const overBudgetAmount = -(overBudgetDecrement * overBudgetStep);
              setCurrentBudgetAmount(overBudgetAmount);
              
              if (overBudgetStep >= overBudgetSteps) {
                clearInterval(phase2Timer);
              }
            }, overBudgetInterval);
          }, 1000);
        }
      }, phase1Interval);
      
      return () => clearInterval(phase1Timer);
    }
  }, [animationKey, currentStep]);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formattedMonth = formatMonth(currentMonth);

  const steps = [
    {
      icon: Sparkles,
      title: 'Welcome to Dollars At Work!',
      description: `Let's set up your budget for ${formattedMonth}`,
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Dollars At Work helps you take control of your money using the <strong>zero-based budgeting</strong> method.
          </p>
          <p className="text-gray-600 dark:text-zinc-400">
            Every dollar gets a job, and you'll know exactly where your money is going.
          </p>
          {/* Mock app preview */}
          <div className="bg-gray-100 dark:bg-zinc-800/50 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 text-center mb-1">Your budget will look like this:</div>
            <div className="bg-white dark:bg-zinc-800 rounded-lg p-2 flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-900 dark:text-white">February 2026</span>
              <span className="text-[10px] font-bold text-green-600">$0.00 left</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-1.5 text-center">
                <DollarSign size={14} className="text-green-500 mx-auto" />
                <span className="text-[8px] text-gray-600 dark:text-zinc-400">Income</span>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg p-1.5 text-center">
                <Wallet size={14} className="text-purple-500 mx-auto" />
                <span className="text-[8px] text-gray-600 dark:text-zinc-400">Envelopes</span>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
              This quick guide will show you how to get started in just a few steps!
            </p>
          </div>
        </div>
      ),
      color: 'blue'
    },
    {
      icon: Tags,
      title: 'Step 1: Choose Categories',
      description: 'Select categories to organize your spending',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Categories help group your envelopes. Select the ones you need:
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {DEFAULT_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`p-3 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedCategories.includes(cat)
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                    : 'bg-white border-gray-200 text-gray-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedCategories.includes(cat) ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                }`}>
                  {selectedCategories.includes(cat) && <CheckCircle2 size={12} className="text-white" />}
                </div>
                {cat}
              </button>
            ))}
          </div>
          {selectedCategories.length === 0 && (
            <p className="text-red-500 text-xs">Please select at least one category.</p>
          )}
        </div>
      ),
      color: 'blue'
    },
    {
      icon: DollarSign,
      title: 'Step 2: Add Your Income',
      description: 'Tell us how much money you have to work with',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Add your income sources for the month. This could be:
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span><strong>Salary</strong> - Your regular paycheck</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span><strong>Freelance</strong> - Side gig income</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span><strong>Other Income</strong> - Any other money coming in</span>
            </li>
          </ul>
          <MockIncomeSection />
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
            <p className="text-sm text-green-900 dark:text-green-200">
              <strong>Tap the <Plus className="w-4 h-4 inline" /> button</strong> next to "Income Sources" to add your income.
            </p>
          </div>
        </div>
      ),
      color: 'green'
    },
    {
      icon: Wallet,
      title: 'Step 3: Create Spending Envelopes',
      description: 'Organize your spending into categories',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Spending envelopes are where you track expenses. You'll assign each envelope to a category.
          </p>
          <MockEnvelopeSection />
          <ul className="space-y-2 text-gray-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <span><strong>Groceries</strong> (Food)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <span><strong>Rent/Mortgage</strong> (Housing)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <span><strong>Gas</strong> (Transportation)</span>
            </li>
          </ul>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
            <p className="text-sm text-purple-900 dark:text-purple-200">
              <strong>Tap "+" on a category section</strong> to add an envelope to it.
            </p>
          </div>
        </div>
      ),
      color: 'purple'
    },
    {
      icon: GripVertical,
      title: 'Step 4: Organize Your Budget',
      description: 'Reorder categories and envelopes to match your preferences',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Your budget should work the way <strong>you</strong> think about money. Customize the order to match your priorities!
          </p>
          
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
            <h4 className="font-medium text-indigo-900 dark:text-indigo-200 mb-3 flex items-center gap-2">
              <GripVertical className="w-4 h-4" />
              Drag to Reorder
            </h4>
            
            <div className="space-y-2 mb-3">
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <strong>Mobile:</strong> Long-press and drag
              </p>
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <strong>PC:</strong> Click and hold on the <strong>dots</strong>, then drag
              </p>
            </div>
            
            <ReorderDemo />
            
            <ul className="space-y-1 text-sm text-indigo-700 dark:text-indigo-400 mt-3">
              <li>- Reorder categories: Settings &rarr; Manage Categories</li>
              <li>- Reorder envelopes: On the main budget screen</li>
            </ul>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Pro tip:</strong> Try organizing: Income &rarr; Fixed Expenses &rarr; Variable Expenses &rarr; Savings Goals
            </p>
          </div>
        </div>
      ),
      color: 'indigo'
    },
    {
      icon: TrendingUp,
      title: 'Step 5: Allocate Your Budget',
      description: 'Assign money to each envelope',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Now comes the fun part - giving every dollar a job!
          </p>
          <MockAllocationBar />
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r-xl p-4 relative">
            <button
              onClick={() => setAnimationKey(prev => prev + 1)}
              className="absolute top-2 right-2 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg transition-colors"
              title="Replay animation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-2">
              The "Left to Budget" amount shows unassigned money
            </p>
            <p className="text-sm text-blue-900 dark:text-blue-200 mb-3">
              Your goal is to get this to <strong>$0.00</strong> by allocating all your income to envelopes.
            </p>
            {/* Animated Left to Budget Bar */}
            <div key={animationKey} className="space-y-2">
              <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
                <span>Left to Budget</span>
                <span className={`font-bold ${currentBudgetAmount < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  ${currentBudgetAmount.toFixed(2)}
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${currentBudgetAmount < 0 ? 'bg-red-500' : 'bg-green-500'}`}
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: currentBudgetAmount < 0 
                      ? '100%' 
                      : `${(2500 - currentBudgetAmount) / 2500 * 100}%`
                  }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                />
              </div>
              <motion.div
                className={`text-xs font-medium text-center mt-1 ${
                  currentBudgetAmount === 0 
                    ? 'text-green-600 dark:text-emerald-400' 
                    : currentBudgetAmount < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-700 dark:text-blue-300'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 0.5 }}
              >
                {currentBudgetAmount === 0 && 'Perfect! Every dollar has a job!'}
                {currentBudgetAmount < 0 && "You're not in Congress! Try again."}
                {currentBudgetAmount > 0 && 'Keep allocating until you reach $0'}
              </motion.div>
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              <strong>Pro tip:</strong> Start with essential expenses (rent, utilities, groceries) first, then allocate what's left.
            </p>
          </div>
        </div>
      ),
      color: 'blue'
    },
    {
      icon: PiggyBank,
      title: 'Bonus: Piggybanks (Savings Goals)',
      description: 'Save for future goals',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Piggybanks are special envelopes for <strong>savings goals</strong> that carry over month-to-month.
          </p>
          <MockPiggybankSection />
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Set a Goal</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Vacation, emergency fund, new car - whatever you're saving for
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Monthly Contributions</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Set a monthly amount to save
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Track Progress</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Watch your savings grow toward your goal
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      color: 'pink'
    },
    {
      icon: BarChart3,
      title: 'Charts: Spending Insights',
      description: 'Visualize where your money goes',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            The <strong>Charts</strong> screen gives you powerful insights into your spending habits over time.
          </p>
          <MockAnalyticsDonut />
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <PieChart className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Spending Totals</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  See a donut chart of spending by category
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Spending Breakdown</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Monthly stacked bar chart by category
                </p>
              </div>
            </div>
          </div>
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-3">
            <p className="text-sm text-cyan-900 dark:text-cyan-200">
              <strong>Access Charts</strong> from the bottom navigation bar under the "More" menu.
            </p>
          </div>
        </div>
      ),
      color: 'blue'
    },
    {
      icon: TrendingUp,
      title: 'Charts: Income & Savings',
      description: 'Track your financial health over time',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            Monitor your <strong>income trends</strong> and <strong>savings rate</strong> to stay on track.
          </p>
          <MockAnalyticsBar />
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Monthly Income</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Track income by source over time with stacked bars
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Savings Rate</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  See what percentage of income you're saving each month
                </p>
              </div>
            </div>
          </div>
          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3">
            <p className="text-sm text-teal-900 dark:text-teal-200">
              <strong>Time frames:</strong> View 1, 3, 6, 9, or 12 months of data, or filter by year.
            </p>
          </div>
        </div>
      ),
      color: 'blue'
    },
    {
      icon: budgetBalancedIcon,
      title: 'You\'re Ready to Budget!',
      description: 'Start taking control of your money',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-gray-600 dark:text-zinc-400">
            That's it! You now know the basics of Dollars At Work:
          </p>
          <div className="space-y-2">
            {[
              'Choose your categories',
              'Add your income sources',
              'Create envelopes in categories',
              'Organize your budget order',
              'Allocate until Left to Budget = $0',
              'Set up Piggybanks for savings goals',
              'Track trends in Charts',
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
                <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 dark:text-green-400 font-bold text-xs">{i + 1}</span>
                </div>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-4">
            <p className="text-sm text-center text-blue-900 dark:text-blue-200 font-medium">
              Click "Start Budgeting" below and we'll guide you through your first setup!
            </p>
          </div>
        </div>
      ),
      color: 'green',
      useCustomIcon: true
    }
  ];

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.useCustomIcon ? budgetBalancedIcon : currentStepData.icon;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const colorClasses: Record<string, { bg: string; text: string; button: string }> = {
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      button: 'bg-green-600 hover:bg-green-700'
    },
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-600 dark:text-purple-400',
      button: 'bg-purple-600 hover:bg-purple-700'
    },
    indigo: {
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-600 dark:text-indigo-400',
      button: 'bg-indigo-600 hover:bg-indigo-700'
    },
    pink: {
      bg: 'bg-pink-100 dark:bg-pink-900/30',
      text: 'text-pink-600 dark:text-pink-400',
      button: 'bg-pink-600 hover:bg-pink-700'
    }
  };

  const colors = colorClasses[currentStepData.color] || colorClasses.blue;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Skip Confirmation Modal */}
        <AnimatePresence>
          {showSkipConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-zinc-800"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Skip Onboarding?</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                  We'll set up default categories for you. You can always restart this guide from Settings.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSkipConfirm(false)}
                    className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Continue Guide
                  </button>
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-2.5 px-4 bg-gray-800 dark:bg-zinc-700 text-white rounded-xl font-medium hover:bg-gray-900 dark:hover:bg-zinc-600 transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
          >
            {/* Skip Button */}
            <div className="flex justify-end px-4 pt-3">
              <button
                onClick={() => setShowSkipConfirm(true)}
                className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <SkipForward size={14} />
                Skip
              </button>
            </div>

            {/* Header */}
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {currentStepData.title}
                  </h2>
                  <p className="text-gray-600 dark:text-zinc-400">
                    {currentStepData.description}
                  </p>
                </div>
                <div className="flex flex-col items-center mx-4">
                  {currentStep === 0 ? (
                    <img src={appIcon} alt="Dollars At Work" className={`w-20 h-20 ${colors.text}`} />
                  ) : currentStepData.useCustomIcon ? (
                    <img src={budgetBalancedIcon} alt="Budget Balanced" className={`w-32 h-32 ${colors.text}`} />
                  ) : (
                    <div className={`${colors.bg} p-3 rounded-xl`}>
                      {typeof Icon === 'string' ? null : <Icon className={`w-8 h-8 ${colors.text}`} />}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-2 max-h-[55vh] overflow-y-auto">
              {currentStepData.content}
            </div>

            {/* Progress Dots */}
            <div className="px-6 pb-2 flex justify-center gap-1.5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${index === currentStep
                      ? `w-8 ${colors.button}`
                      : index < currentStep
                      ? 'w-2 bg-gray-400 dark:bg-zinc-600'
                      : 'w-2 bg-gray-200 dark:bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            {/* Step Counter */}
            <div className="text-center pb-2">
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {currentStep + 1} of {steps.length}
              </span>
            </div>

            {/* Navigation */}
            <div className="p-6 pt-0 flex gap-3">
              {!isFirstStep && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="flex-1 py-3 px-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (isLastStep) {
                    handleComplete();
                  } else {
                    if (currentStepData.title.includes('Choose Categories') && selectedCategories.length === 0) {
                      return;
                    }
                    setCurrentStep(prev => prev + 1);
                  }
                }}
                disabled={currentStepData.title.includes('Choose Categories') && selectedCategories.length === 0}
                className={`${isFirstStep ? 'flex-1' : 'flex-[2]'} py-3 px-4 ${colors.button} text-white rounded-xl font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLastStep ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Start Budgeting
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default NewUserOnboarding;