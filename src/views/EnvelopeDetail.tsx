import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEnvelopeStore } from '../store/envelopeStore';
import type { Transaction } from '../models/types';
import { Trash, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';
import TransactionModal from '../components/modals/TransactionModal';
import TransferModal from '../components/modals/TransferModal';
import EnvelopeTransactionRow from '../components/EnvelopeTransactionRow';

// Helper to format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

// Helper to format date
const formatDate = (date: Date | string): string => {
    // Ensuring it's a Date object if a string/ISO date was passed
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const EnvelopeDetail: React.FC = () => {
    // Rule #4: Get the ID from the route params
    const { id } = useParams<{ id: string }>();
    // Rule #2: Map @ObservedObject (viewModel) to Zustand store
    const { envelopes, transactions, deleteEnvelope, renameEnvelope } = useEnvelopeStore();
    
    // Rule #2: Map @State (envelope, showingAddMoney, etc.) to useState
    const navigate = useNavigate();
    const [showingAddMoney, setShowingAddMoney] = useState(false);
    const [showingSpendMoney, setShowingSpendMoney] = useState(false);
    const [showingTransfer, setShowingTransfer] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Filter and sort transactions (similar to the envelopeTransactions computed property)
    const currentEnvelope = envelopes.find(e => e.id === id);

    // Handle case where envelope is not found (404 equivalent)
    if (!currentEnvelope) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
                <p>Envelope not found.</p>
            </div>
        );
    }

    const envelopeTransactions = transactions
        .filter(t => t.envelopeId === currentEnvelope.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Rule #2: @Environment(\.dismiss) maps to navigate(-1)
    const handleDone = () => navigate(-1);
    
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
        useEnvelopeStore.getState().updateTransaction(updatedTx);
    }; 

    // Translate SwiftUI 'List' structure to Tailwind/Flexbox (Rule #1)
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            
            {/* --- Navigation Bar / Toolbar (Rule #4 / #1) --- */}
            <header className="flex justify-between items-center pb-4 sticky top-0 bg-gray-900 z-10 border-b border-gray-800">
                <button 
                    onClick={() => { 
                        const newName = prompt('Rename envelope:', currentEnvelope.name);
                        if (newName && newName.trim() && id) {
                            renameEnvelope(id, newName);
                        }
                    }} 
                    className="text-blue-500 font-medium"
                >
                    Rename
                </button>
                <h1 className="text-xl font-semibold">{currentEnvelope.name}</h1>
                <button 
                    onClick={handleDone} 
                    className="text-blue-500 font-bold"
                >
                    Done
                </button>
            </header>

            {/* --- List Section 1: Balance Details (Rule #1: HStack/VStack -> Flexbox) --- */}
            <section className="mt-4 bg-gray-800 rounded-lg p-4 shadow-lg mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-headline">Current Balance</span>
                    <span className={`text-xl font-bold ${currentEnvelope.currentBalance < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {formatCurrency(currentEnvelope.currentBalance)}
                    </span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Last Updated</span>
                    <span>{formatDate(currentEnvelope.lastUpdated)}</span>
                </div>
            </section>

            {/* --- List Section 2: Action Buttons (Rule #1: Section -> Grouped Div) --- */}
            <section className="bg-gray-800 rounded-lg shadow-lg mb-4 divide-y divide-gray-700">
                <button 
                    className="flex items-center w-full p-4 text-left text-green-500 hover:bg-gray-700 transition duration-150"
                    onClick={() => setShowingAddMoney(true)}
                >
                    <ArrowUpCircle className="w-5 h-5 mr-3" />
                    Add Money
                </button>
                <button 
                    className="flex items-center w-full p-4 text-left text-red-500 hover:bg-gray-700 transition duration-150"
                    onClick={() => setShowingSpendMoney(true)}
                >
                    <ArrowDownCircle className="w-5 h-5 mr-3" />
                    Spend Money
                </button>
                <button 
                    className="flex items-center w-full p-4 text-left text-blue-500 hover:bg-gray-700 transition duration-150"
                    onClick={() => setShowingTransfer(true)}
                >
                    <ArrowRightLeft className="w-5 h-5 mr-3" />
                    Transfer Money
                </button>
            </section>

            {/* --- List Section 3: Transaction History --- */}
            <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase text-gray-400 mb-2 px-2">Transaction History</h2>
                <div className="bg-gray-800 rounded-lg shadow-lg divide-y divide-gray-700">
                    {envelopeTransactions.length === 0 ? (
                        <p className="p-4 text-center text-gray-500">
                            No transactions yet for this envelope.
                        </p>
                    ) : (
                        envelopeTransactions.map(transaction => (
                            <EnvelopeTransactionRow
                                key={transaction.id}
                                transaction={transaction}
                                onReconcile={() => handleReconcile(transaction)}
                                onEdit={() => setEditingTransaction(transaction)}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* --- List Section 4: Delete Button --- */}
            <div className="mt-8">
                <button 
                    className="w-full py-3 px-4 rounded-lg bg-gray-800 text-red-500 font-semibold hover:bg-gray-700 transition duration-150 flex items-center justify-center"
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
                    sourceEnvelope={currentEnvelope}
                />
            )}
        </div>
    );
};

export default EnvelopeDetail;