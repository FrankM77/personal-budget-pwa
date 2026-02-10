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
  GripVertical
} from 'lucide-react';
import appIcon from '/icon-512.png';
import budgetBalancedIcon from '/images/budget-balanced.png';
import { useBudgetStore } from '../../stores/budgetStore';
import logger from '../../utils/logger';

interface NewUserOnboardingProps {
  currentMonth: string;
  onComplete: () => void;
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

const NewUserOnboarding: React.FC<NewUserOnboardingProps> = ({ currentMonth, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [currentBudgetAmount, setCurrentBudgetAmount] = useState(2500);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_CATEGORIES);
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

  // Animate budget amount when animation key changes or when entering Step 5
  useEffect(() => {
    logger.log('Animation effect triggered:', { currentStep, animationKey });
    if (currentStep === 5) { // Only animate on Step 5 (index 5) - Allocate Your Budget
      logger.log('Starting animation from $2500 to $0');
      setCurrentBudgetAmount(2500);
      
      // Phase 1: Animate to perfect budget (0-2 seconds)
      const phase1Duration = 2000;
      const phase1Steps = 20;
      const phase1Interval = phase1Duration / phase1Steps;
      const decrement = 2500 / phase1Steps;
      
      let currentStep = 0;
      const phase1Timer = setInterval(() => {
        currentStep++;
        const newAmount = Math.max(0, 2500 - (decrement * currentStep));
        logger.log('Phase 1 - Animation step:', currentStep, 'New amount:', newAmount);
        setCurrentBudgetAmount(newAmount);
        
        if (currentStep >= phase1Steps) {
          clearInterval(phase1Timer);
          logger.log('Phase 1 completed - Perfect budget reached');
          
          // Phase 2: Pause for 1 second, then show over-budget scenario
          setTimeout(() => {
            logger.log('Starting Phase 2 - Over budget demonstration');
            
            // Phase 2: Animate to over budget (-$500) with red bar (3-5 seconds)
            let overBudgetStep = 0;
            const overBudgetSteps = 10;
            const overBudgetInterval = 200; // 2 seconds total
            const overBudgetDecrement = 500 / overBudgetSteps;
            
            const phase2Timer = setInterval(() => {
              overBudgetStep++;
              const overBudgetAmount = -(overBudgetDecrement * overBudgetStep);
              logger.log('Phase 2 - Over budget step:', overBudgetStep, 'Over budget amount:', overBudgetAmount);
              setCurrentBudgetAmount(overBudgetAmount);
              
              if (overBudgetStep >= overBudgetSteps) {
                clearInterval(phase2Timer);
                logger.log('Animation completed - Over budget scenario demonstrated');
              }
            }, overBudgetInterval);
          }, 1000); // 1 second pause
        }
      }, phase1Interval);
      
      return () => {
        logger.log('Cleaning up animation timers');
        clearInterval(phase1Timer);
      };
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200 font-medium">
              💡 This quick guide will show you how to get started in just a few steps!
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
            First, you'll add your income sources for the month. This could be:
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
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-sm text-green-900 dark:text-green-200">
              <strong>Look for the "Income Sources" section</strong> at the top of your budget and tap the <Plus className="w-4 h-4 inline" /> button to add income.
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
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
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
            
            <p className="text-sm text-indigo-800 dark:text-indigo-300 mb-3">
              Both categories and envelopes can be reordered the same way:
            </p>
            
            <div className="space-y-2 mb-3">
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <strong>Mobile:</strong> Long-press and drag
              </p>
              <p className="text-sm text-indigo-800 dark:text-indigo-300">
                <strong>PC:</strong> Click and hold on the <strong>⋮⋮</strong> dots, then drag
              </p>
            </div>
            
            <div className="bg-white dark:bg-indigo-950/30 rounded-lg p-3 mb-3 border border-indigo-300 dark:border-indigo-700">
              <div className="flex items-center gap-2 text-xs mb-2">
                <div className="text-indigo-600 dark:text-indigo-400 font-bold">⋮⋮</div>
                <div className="flex-1">
                  <div className="font-medium text-indigo-900 dark:text-indigo-200">Food</div>
                  <div className="text-indigo-700 dark:text-indigo-400 text-xs">Category</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="text-indigo-600 dark:text-indigo-400 font-bold">⋮⋮</div>
                <div className="flex-1">
                  <div className="font-medium text-indigo-900 dark:text-indigo-200">Groceries</div>
                  <div className="text-indigo-700 dark:text-indigo-400 text-xs">$450 / $500</div>
                </div>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 italic">
                ← Click and hold these dots to drag
              </p>
            </div>
            
            <ul className="space-y-1 text-sm text-indigo-700 dark:text-indigo-400">
              <li>• Reorder categories: Settings → Manage Categories</li>
              <li>• Reorder envelopes: On the main budget screen</li>
              <li>• Organize by priority, frequency, or preference</li>
            </ul>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              💡 <strong>Pro tip:</strong> Try organizing your budget like this: Income → Fixed Expenses → Variable Expenses → Savings Goals
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
                {currentBudgetAmount === 0 && 'Perfect! Every dollar has a job 🎯'}
                {currentBudgetAmount < 0 && "You're not in Congress! Try again."}
                {currentBudgetAmount > 0 && 'Keep allocating until you reach $0'}
              </motion.div>
            </div>
          </div>
          <p className="text-gray-600 dark:text-zinc-400">
            <strong>To allocate money:</strong> Tap the budget amount on any envelope and enter how much you want to assign to it.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              💡 <strong>Pro tip:</strong> Start with your essential expenses (rent, utilities, groceries) first, then allocate what's left to other categories.
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
                  Set an automatic monthly amount to save
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
          <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-xl p-4">
            <p className="text-sm text-pink-900 dark:text-pink-200">
              <strong>Find Piggybanks</strong> at the bottom of your budget. They're optional but powerful for reaching your goals!
            </p>
          </div>
        </div>
      ),
      color: 'pink'
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
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-bold">1</span>
              </div>
              <span>Choose your categories</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-bold">2</span>
              </div>
              <span>Add your income sources</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-bold">3</span>
              </div>
              <span>Create envelopes in categories</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-bold">4</span>
              </div>
              <span>Organize your budget order</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700 dark:text-zinc-300">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-bold">5</span>
              </div>
              <span>Allocate until Left to Budget = $0</span>
            </div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mt-6">
            <p className="text-sm text-center text-blue-900 dark:text-blue-200 font-medium">
              🎉 Click "Start Budgeting" below to create your first budget!
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

  const colorClasses = {
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

  const colors = colorClasses[currentStepData.color as keyof typeof colorClasses];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 pb-2">
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
                      <Icon className={`w-8 h-8 ${colors.text}`} />
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                  Step {currentStep + 1} of {steps.length}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-2">
              {currentStepData.content}
            </div>

            {/* Progress Dots */}
            <div className="px-6 pb-4 flex justify-center gap-2">
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
                      return; // Block progress if no category selected
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