import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { useToastStore } from '../stores/toastStore';
import type { Transaction } from '../stores/envelopeStore';
import { Trash, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';
import TransactionModal from '../components/modals/TransactionModal';
import TransferModal from '../components/modals/TransferModal';
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
    const { envelopes, transactions, fetchData, isLoading, deleteEnvelope, renameEnvelope, updateTransaction, deleteTransaction, restoreTransaction, getEnvelopeBalance } = useEnvelopeStore();
    const { showToast } = useToastStore();

    // Rule #2: Map @State (envelope, showingAddMoney, etc.) to useState
    const navigate = useNavigate();
    const location = useLocation();
    const [showingAddMoney, setShowingAddMoney] = useState(false);
    const [showingSpendMoney, setShowingSpendMoney] = useState(false);
    const [showingTransfer, setShowingTransfer] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Load data from Firebase on mount (only if no data exists)
    useEffect(() => {
      if (envelopes.length === 0) {
        fetchData();
      }
    }, []); // Empty dependency array - only run once on mount

    // Filter and sort transactions (similar to the envelopeTransactions computed property)
    const currentEnvelope = envelopes.find(e => e.id === id);


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

    const envelopeTransactions = transactions
        .filter(t => t.envelopeId === currentEnvelope.id)
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
        if (id) {
            deleteEnvelope(id);
            navigate(-1);
        }
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
        <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white p-4">
            
            {/* --- Navigation Bar / Toolbar (Rule #4 / #1) --- */}
            <header className="flex justify-between items-center pt-[calc(env(safe-area-inset-top)+12px)] pb-4 sticky top-0 bg-white dark:bg-black z-10 border-b border-gray-100 dark:border-zinc-800">
                <button 
                    onClick={() => { 
                        const newName = prompt('Rename envelope:', currentEnvelope.name);
                        if (newName && newName.trim() && id) {
                            renameEnvelope(id, newName);
                        }
                    }} 
                    className="text-blue-600 dark:text-blue-400 font-medium"
                >
                    Rename
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
                      const balance = getEnvelopeBalance(currentEnvelope.id!).toNumber();
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
                <div className="flex justify-between items-center text-sm text-gray-500 dark:text-zinc-400">
                    <span>Budget</span>
                    <span>{formatCurrency(currentEnvelope.budget || 0)}</span>
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
                                    <SwipeableRow onDelete={() => {
                                      if (!transaction.id) return;
                                      const transactionToDelete = { ...transaction }; // Create a copy
                                      deleteTransaction(transaction.id);
                                      showToast(
                                        'Transaction deleted',
                                        'neutral',
                                        () => restoreTransaction(transactionToDelete)
                                      );
                                    }}>
                                        <EnvelopeTransactionRow
                                            transaction={transaction}
                                            onReconcile={() => handleReconcile(transaction)}
                                            onEdit={() => setEditingTransaction(transaction)}
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
                        if (confirm(`Are you sure you want to delete "${currentEnvelope.name}"? This will delete all transactions.`)) {
                            handleDeleteEnvelope();
                        }
                    }}
                >
                    <Trash className="w-5 h-5 mr-2" />
                    Delete Envelope
                </button>
            </div>

            {/* Transaction Modal (for Add, Spend, and Edit) */}
            {(showingAddMoney || showingSpendMoney || editingTransaction) && (
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
            )}

            {/* Transfer Modal */}
            {showingTransfer && (
                <TransferModal
                    isVisible={showingTransfer}
                    onClose={() => setShowingTransfer(false)}
                    sourceEnvelope={currentEnvelope as any}
                />
            )}
        </div>
    );
};

export default EnvelopeDetail;