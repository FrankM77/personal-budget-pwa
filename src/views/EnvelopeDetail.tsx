import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';
import { toDate } from '../utils/dateUtils';
import type { Transaction, Envelope } from '../models/types';
import { Trash, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';
import TransactionModal from '../components/modals/TransactionModal';
import TransferModal from '../components/modals/TransferModal';
import { PiggybankModal } from '../components/modals/PiggybankModal';
import EnvelopeTransactionRow from '../components/EnvelopeTransactionRow';
import { SwipeableRow } from '../components/ui/SwipeableRow';
import { AnimatePresence, motion } from 'framer-motion';

// Helper to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Removed unused formatDate function

const EnvelopeDetail: React.FC = () => {
    // Rule #4: Get the ID from the route params
    const { id } = useParams<{ id: string }>();
    // Rule #2: Map @ObservedObject (viewModel) to Zustand store
    const { 
        envelopes, 
        transactions, 
        fetchData, 
        isLoading, 
        deleteEnvelope, 
        renameEnvelope, 
        updateTransaction, 
        deleteTransaction, 
        restoreTransaction, 
        getEnvelopeBalance, 
        currentMonth,
        allocations,
        incomeSources,
        setEnvelopeAllocation,
        updatePiggybankContribution,
        updateEnvelope
    } = useBudgetStore();
    const { showToast } = useToastStore();

    // Rule #2: Map @State (envelope, showingAddMoney, etc.) to useState
    const navigate = useNavigate();
    const location = useLocation();
    const [showingAddMoney, setShowingAddMoney] = useState(false);
    const [showingSpendMoney, setShowingSpendMoney] = useState(false);
    const [showingTransfer, setShowingTransfer] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isPiggybankModalOpen, setIsPiggybankModalOpen] = useState(false);
    
    // Budget Editing State
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [budgetInput, setBudgetInput] = useState('');
    const budgetInputRef = useRef<HTMLInputElement>(null);
    const isSavingRef = useRef(false);

    // Load data from Firebase on mount (only if no data exists)
    useEffect(() => {
      if (envelopes.length === 0) {
        fetchData();
      }
    }, []); // Empty dependency array - only run once on mount

    // Filter and sort transactions (similar to the envelopeTransactions computed property)
    const currentEnvelope = envelopes.find(e => e.id === id);

    const handleSavePiggybank = async (piggybankData: Partial<Envelope>) => {
        if (!currentEnvelope) return;
        try {
            // Merge the existing piggybank with the updated data
            const updatedEnvelope: Envelope = {
                ...currentEnvelope,
                ...piggybankData,
                id: currentEnvelope.id!,
                userId: currentEnvelope.userId,
                currentBalance: currentEnvelope.currentBalance,
                lastUpdated: new Date().toISOString(),
                isActive: currentEnvelope.isActive,
                orderIndex: currentEnvelope.orderIndex
            };
            
            await updateEnvelope(updatedEnvelope);
            showToast('Piggybank updated successfully', 'success');
            setIsPiggybankModalOpen(false);
        } catch (error) {
            console.error('Failed to update piggybank:', error);
            showToast('Failed to update piggybank', 'error');
        }
    };

    // Determine Budgeted Amount
    const budgetedAmount = currentEnvelope?.isPiggybank 
        ? (currentEnvelope.piggybankConfig?.monthlyContribution || 0)
        : (allocations[currentMonth]?.find(a => a.envelopeId === id)?.budgetedAmount || 0);

    // Initialize budget input when opening edit mode
    useEffect(() => {
        if (isEditingBudget) {
            setBudgetInput(budgetedAmount.toString());
            // Focus input after render
            setTimeout(() => {
                budgetInputRef.current?.focus();
                budgetInputRef.current?.select();
            }, 50);
        }
    }, [isEditingBudget, budgetedAmount]);

    // Calculate Available to Budget
    const calculateAvailableToBudget = (projectedAmount?: number) => {
        const monthIncome = (incomeSources[currentMonth] || []).reduce((sum, s) => sum + s.amount, 0);
        const monthAllocations = (allocations[currentMonth] || []);
        
        // Filter allocations for active envelopes only
        // AND map to use projected amount for current envelope if provided
        const activeAllocations = monthAllocations.map(alloc => {
            // Check if this allocation belongs to the current envelope
            if (currentEnvelope && alloc.envelopeId === currentEnvelope.id && projectedAmount !== undefined) {
                return { ...alloc, budgetedAmount: projectedAmount };
            }
            return alloc;
        }).filter(alloc => {
            // If we are projecting a NEW allocation for this envelope (it didn't exist before)
            // we need to make sure we don't double count or miss it.
            // Actually, if it didn't exist, it won't be in monthAllocations to be mapped.
            // So we need to handle "new allocation" case separately.
            
            const env = envelopes.find(e => e.id === alloc.envelopeId);
            if (!env) return false;
            return env.isActive !== false;
        });

        // Calculate total from existing (potentially modified) allocations
        let totalAllocated = activeAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0);

        // If we are editing, and the current envelope didn't have an allocation in the list yet
        // (e.g. it was 0 or just created), we need to add the projected amount to the total
        if (projectedAmount !== undefined && currentEnvelope) {
            const hasExistingAllocation = monthAllocations.some(a => a.envelopeId === currentEnvelope.id);
            if (!hasExistingAllocation) {
                totalAllocated += projectedAmount;
            }
        }

        return monthIncome - totalAllocated;
    };

    // Use projected amount if editing, otherwise use stored data
    const projectedAvailableToBudget = isEditingBudget 
        ? calculateAvailableToBudget(parseFloat(budgetInput) || 0)
        : calculateAvailableToBudget();

    const availableToBudget = projectedAvailableToBudget;

    const handleBudgetSave = async () => {
        if (!currentEnvelope || isSavingRef.current) return;
        
        const newAmount = parseFloat(budgetInput);
        if (isNaN(newAmount) || newAmount < 0) {
            showToast("Please enter a valid positive number", "error");
            return;
        }

        isSavingRef.current = true;
        try {
            if (currentEnvelope.isPiggybank) {
                await updatePiggybankContribution(currentEnvelope.id, newAmount);
            } else {
                await setEnvelopeAllocation(currentEnvelope.id, newAmount);
            }
            setIsEditingBudget(false);
        } catch (error) {
            console.error("Failed to save budget:", error);
            showToast("Failed to update budget", "error");
        } finally {
            isSavingRef.current = false;
        }
    };


    // Handle case where envelope is not found (404 equivalent)
    if (!currentEnvelope) {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
                    <p>Loading envelope...</p>
                </div>
            );
        } else {
            return (
                <div className="flex justify-center items-center h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
                    <p>Envelope not found.</p>
                </div>
            );
        }
    }

    // Debug: Check piggybank and transactions
    if (currentEnvelope.isPiggybank) {
        const piggybankTransactions = transactions.filter(t => t.envelopeId === currentEnvelope.id);
        console.log('🐷 Piggybank:', currentEnvelope.name);
        console.log('🐷 Created at:', currentEnvelope.createdAt);
        console.log('🐷 Transactions:', piggybankTransactions.map(t => ({
            date: t.date,
            description: t.description,
            amount: t.amount
        })));
    }

    const envelopeTransactions = transactions
        .filter(t => t.envelopeId === currentEnvelope.id)
        .filter(t => {
            // If it's a piggybank, filter by creation date
            if (currentEnvelope.isPiggybank) {
                // Always show monthly allocation transactions regardless of date
                if ((t.description === 'Monthly Allocation' || t.description === 'Piggybank Contribution') && t.isAutomatic) {
                    return true;
                }
                
                if (!currentEnvelope.createdAt) return true; // Legacy piggybanks with no creation date
                
                // Use the safe toDate parser to avoid "Invalid Time Value"
                const createdDateStr = toDate(currentEnvelope.createdAt).toISOString().split('T')[0];
                const transactionDateStr = toDate(t.date).toISOString().split('T')[0];
                
                return transactionDateStr >= createdDateStr;
            }
            // For regular envelopes, filter by current month
            return t.month === currentMonth || !t.month;
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Rule #2: @Environment(\.dismiss) maps to navigate(-1)
    const handleDone = () => {
        // If user came from global FAB flow, navigate to home instead of back
        if (location.state?.fromGlobalFAB) {
            navigate('/');
        } else {
            navigate(-1);
        }
    };
    
    const handleDeleteEnvelope = () => {
        if (!id) return;

        // Always call deleteEnvelope to remove from Firestore
        // The deleteEnvelope function handles both regular envelopes and piggybanks
        deleteEnvelope(id);
        navigate(-1);
    };

    const handleReconcile = (transaction: Transaction) => {
        // Toggle reconciled status
        const updatedTx = {
            ...transaction,
            reconciled: !transaction.reconciled,
        };
        updateTransaction(updatedTx);
    }; 

    // Translate SwiftUI 'List' structure to Tailwind/Flexbox (Rule #1)
    return (
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-4 pb-[calc(8rem+env(safe-area-inset-bottom))] max-w-4xl mx-auto">
            
            {/* --- Navigation Bar / Toolbar (Rule #4 / #1) --- */}
            <header className="flex justify-between items-center pt-[calc(env(safe-area-inset-top)+6px)] pb-2 sticky top-0 bg-white dark:bg-black z-10 border-b border-gray-100 dark:border-zinc-800">
                <button 
                    onClick={() => { 
                        if (currentEnvelope.isPiggybank) {
                            setIsPiggybankModalOpen(true);
                        } else {
                            const newName = prompt('Rename envelope:', currentEnvelope.name);
                            if (newName && newName.trim() && id) {
                                renameEnvelope(id, newName);
                            }
                        }
                    }} 
                    className="text-blue-600 dark:text-blue-400 font-medium"
                >
                    {currentEnvelope.isPiggybank ? 'Edit' : 'Rename'}
                </button>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{currentEnvelope.name}</h1>
                <button 
                    onClick={handleDone} 
                    className="text-blue-600 dark:text-blue-400 font-bold"
                >
                    Done
                </button>
            </header>

            {/* --- List Section 1: Balance Details (Rule #1: HStack/VStack -> Flexbox) --- */}
            <section className="mt-4 bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-lg mb-4 border border-gray-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-headline text-gray-900 dark:text-white">Current Balance</span>
                    {(() => {
                      const balance = currentEnvelope.isPiggybank
                        ? getEnvelopeBalance(currentEnvelope.id!) // Piggybanks use lifetime balance
                        : getEnvelopeBalance(currentEnvelope.id!, currentMonth); // Regular envelopes use monthly balance
                      console.log(`Debug: Envelope ${currentEnvelope.name} Balance:`, balance);
                      return (
                        <span
                          className={`text-xl font-bold ${
                            balance < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                            {formatCurrency(balance)}
                        </span>
                      );
                    })()}
                </div>
                
                {/* --- Budgeted Amount & Available Banner (New Requirement) --- */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">
                            {currentEnvelope.isPiggybank ? 'Monthly Contribution' : 'Budgeted This Month'}
                        </span>
                        
                        {isEditingBudget ? (
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleBudgetSave(); }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    ref={budgetInputRef}
                                    type="number"
                                    step="0.01"
                                    value={budgetInput}
                                    onChange={(e) => setBudgetInput(e.target.value)}
                                    onBlur={handleBudgetSave}
                                    className="w-24 px-2 py-1 text-right font-semibold bg-gray-100 dark:bg-zinc-800 rounded border border-blue-500 focus:outline-none"
                                />
                            </form>
                        ) : (
                            <div 
                                onClick={() => setIsEditingBudget(true)}
                                className="px-2 py-1 -mr-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                            >
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(budgetedAmount)}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    {/* Left to Budget Banner */}
                    <div className={`mt-3 py-1.5 px-3 rounded-md flex justify-between items-center text-xs font-medium transition-colors ${
                        availableToBudget < 0 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
                            : availableToBudget === 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                        <span>Left to Budget:</span>
                        <span>{formatCurrency(availableToBudget)}</span>
                    </div>
                </div>
            </section>

            {/* --- List Section 2: Action Buttons (Rule #1: Section -> Grouped Div) --- */}
            <section className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg mb-4 divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-100 dark:border-zinc-800">
                <button
                    className="flex items-center w-full p-4 text-left text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition duration-150"
                    onClick={() => setShowingAddMoney(true)}
                >
                    <ArrowUpCircle className="w-5 h-5 mr-3" />
                    Add Money
                </button>
                <button
                    className="flex items-center w-full p-4 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition duration-150"
                    onClick={() => setShowingSpendMoney(true)}
                >
                    <ArrowDownCircle className="w-5 h-5 mr-3" />
                    Spend Money
                </button>
                <button 
                    className="flex items-center w-full p-4 text-left text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition duration-150"
                    onClick={() => setShowingTransfer(true)}
                >
                    <ArrowRightLeft className="w-5 h-5 mr-3" />
                    Transfer Money
                </button>
            </section>

            {/* --- List Section 3: Transaction History --- */}
            <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase text-gray-500 dark:text-zinc-400 mb-2 px-2">Transaction History</h2>
                <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg divide-y divide-gray-100 dark:divide-zinc-800 border border-gray-100 dark:border-zinc-800">
                    {envelopeTransactions.length === 0 ? (
                        <p className="p-4 text-center text-gray-500 dark:text-zinc-400">
                            No transactions yet for this envelope.
                        </p>
                    ) : (
                        <AnimatePresence initial={false} mode="popLayout">
                            {envelopeTransactions.map(transaction => (
                                <motion.div
                                    key={transaction.id}
                                    layout
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <SwipeableRow 
                                      disabled={transaction.isAutomatic}
                                      onDelete={() => {
                                        if (!transaction.id) return;
                                        const transactionToDelete = { ...transaction }; // Create a copy
                                        deleteTransaction(transaction.id);
                                        showToast(
                                          'Transaction deleted',
                                          'neutral',
                                          () => restoreTransaction(transactionToDelete)
                                        );
                                      }}
                                    >
                                        <EnvelopeTransactionRow
                                            transaction={transaction}
                                            onReconcile={() => handleReconcile(transaction)}
                                            onEdit={() => {
                                              if (transaction.isAutomatic) return;
                                              setEditingTransaction(transaction);
                                            }}
                                        />
                                    </SwipeableRow>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </section>

            {/* --- List Section 4: Delete Button --- */}
            <div className="mt-8">
                <button 
                    className="w-full py-3 px-4 rounded-lg bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 font-semibold hover:bg-gray-100 dark:hover:bg-zinc-800 transition duration-150 flex items-center justify-center border border-gray-100 dark:border-zinc-800"
                    onClick={() => {
                        const message = currentEnvelope.isPiggybank 
                            ? `Are you sure you want to delete "${currentEnvelope.name}"? This will delete the piggybank and all its history.`
                            : `Are you sure you want to remove "${currentEnvelope.name}" from ${currentMonth}? This will delete all transactions for this month only.`;
                        
                        if (confirm(message)) {
                            handleDeleteEnvelope();
                        }
                    }}
                >
                    <Trash className="w-5 h-5 mr-2" />
                    Delete Envelope
                </button>
            </div>

            {/* Transaction Modal (for Add, Spend, and Edit) */}
            <TransactionModal
                isVisible={showingAddMoney || showingSpendMoney || !!editingTransaction}
                onClose={() => {
                    setShowingAddMoney(false);
                    setShowingSpendMoney(false);
                    setEditingTransaction(null);
                }}
                mode={showingAddMoney ? 'add' : showingSpendMoney ? 'spend' : 'edit'}
                currentEnvelope={currentEnvelope}
                initialTransaction={editingTransaction}
            />

            {/* Transfer Modal */}
            <TransferModal
                isVisible={showingTransfer}
                onClose={() => setShowingTransfer(false)}
                sourceEnvelope={currentEnvelope as any}
            />

            {/* Piggybank Edit Modal */}
            <PiggybankModal
                isOpen={isPiggybankModalOpen}
                onClose={() => setIsPiggybankModalOpen(false)}
                onSave={handleSavePiggybank}
                existingPiggybank={currentEnvelope}
            />
        </div>
    );
};

export default EnvelopeDetail;
