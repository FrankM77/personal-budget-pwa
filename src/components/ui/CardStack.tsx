import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SwipeableRow } from './SwipeableRow';
import { useBudgetStore } from '../../stores/budgetStore';
import type { PaymentSource } from '../../models/types';
import '../../styles/CardStack.css';

const DEFAULT_DATA: PaymentSource[] = [
  // Start with empty array - only show "Add New Card" for new users
];

interface Props {
  selectedCard?: PaymentSource | null;
  onCardSelect?: (card: PaymentSource) => void;
  initialCards?: PaymentSource[];
  disabled?: boolean;
  isUserSelected?: boolean; // New prop to track if user manually selected
}

const CardStack: React.FC<Props> = ({ 
  selectedCard: externalSelectedCard, 
  onCardSelect, 
  initialCards = DEFAULT_DATA,
  disabled = false,
  isUserSelected = false
}) => {
  const appSettings = useBudgetStore(state => state.appSettings);
  const updateAppSettings = useBudgetStore(state => state.updateAppSettings);
  
  const [internalSelectedCard, setInternalSelectedCard] = useState<PaymentSource>(
    initialCards.length > 0 ? initialCards[0] : { 
      id: 'add-new', 
      name: '+ Add New Card', 
      network: 'Visa' as const, 
      last4: '', 
      color: '#6b7280' 
    }
  );
  const [isStackOpen, setIsStackOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [cards, setCards] = useState<PaymentSource[]>(initialCards);
  const [deleteConfirmCard, setDeleteConfirmCard] = useState<PaymentSource | null>(null);
  const [newCard, setNewCard] = useState({
    name: '',
    network: 'Visa' as 'Visa' | 'Mastercard' | 'Amex' | 'Cash' | 'Venmo',
    last4: '',
    color: '#3b82f6'
  });
  const [draggedCard, setDraggedCard] = useState<PaymentSource | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load cards from app settings on mount and when app settings change
  useEffect(() => {
    if (appSettings?.paymentSources) {
      setCards(appSettings.paymentSources);
      if (appSettings.paymentSources.length > 0 && !externalSelectedCard) {
        setInternalSelectedCard(appSettings.paymentSources[0]);
      }
    }
  }, [appSettings, externalSelectedCard]);

  // Use external selected card if provided, otherwise use internal state
  const selectedCard = externalSelectedCard || internalSelectedCard;

  // Auto-select the first card and notify parent when component mounts or cards change
  useEffect(() => {
    if (!externalSelectedCard && onCardSelect && cards.length > 0) {
      onCardSelect(cards[0]);
    }
  }, [externalSelectedCard, onCardSelect, cards]);

  const handleCardClick = (card: PaymentSource) => {
    if (disabled) return;
    
    if (card.id === 'add-new') {
      setIsAddCardModalOpen(true);
    } else {
      // Select card immediately on first tap
      setInternalSelectedCard(card);
      onCardSelect?.(card);
      setIsStackOpen(false);
    }
  };

  const toggleStack = () => {
    if (!disabled) {
      setIsStackOpen(!isStackOpen);
    }
  };

  const handleDeleteCard = (card: PaymentSource) => {
    if (!disabled) {
      setDeleteConfirmCard(card);
    }
  };

  const confirmDeleteCard = async () => {
    if (deleteConfirmCard && !disabled) {
      const updatedCards = cards.filter(c => c.id !== deleteConfirmCard.id);
      setCards(updatedCards);
      
      // If the deleted card was selected, select the first available card
      if (selectedCard?.id === deleteConfirmCard.id) {
        const nextCard = updatedCards.length > 0 ? updatedCards[0] : { 
          id: 'add-new', 
          name: '+ Add New Card', 
          network: 'Visa' as const, 
          last4: '', 
          color: '#6b7280' 
        };
        setInternalSelectedCard(nextCard);
        onCardSelect?.(nextCard);
      }
      
      setDeleteConfirmCard(null);
      setIsStackOpen(false);
      
      // Save to app settings
      try {
        await updateAppSettings({ paymentSources: updatedCards });
      } catch (error) {
        console.error('Failed to delete card from app settings:', error);
        // Revert the local state if save failed
        setCards(cards);
        alert('Failed to delete card. Please try again.');
        return;
      }
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmCard(null);
  };

  const handleAddCard = async () => {
    if (disabled) return;

    // Validate last 4 digits (only for cards)
    const isCard = !['Cash', 'Venmo'].includes(newCard.network);
    if (isCard && (newCard.last4.length !== 4 || !/^\d{4}$/.test(newCard.last4))) {
      alert('Please enter exactly 4 digits for the last 4 digits');
      return;
    }

    if (!newCard.name.trim()) {
      alert('Please enter a name');
      return;
    }

    // Create new card
    const card: PaymentSource = {
      id: `custom-${Date.now()}`,
      name: newCard.name.trim(),
      network: newCard.network,
      last4: isCard ? newCard.last4 : undefined,
      color: newCard.color
    };

    // Add to cards array
    const updatedCards = [...cards, card];
    setCards(updatedCards);
    setInternalSelectedCard(card);
    onCardSelect?.(card);
    setIsAddCardModalOpen(false);
    setIsStackOpen(false);
    
    // Save to app settings
    try {
      await updateAppSettings({ paymentSources: updatedCards });
    } catch (error) {
      console.error('Failed to save card to app settings:', error);
      // Revert the local state if save failed
      setCards(cards);
      setInternalSelectedCard(selectedCard);
      alert('Failed to save card. Please try again.');
      return;
    }
    
    // Reset form
    setNewCard({
      name: '',
      network: 'Visa',
      last4: '',
      color: '#3b82f6'
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, card: PaymentSource) => {
    if (disabled) return;
    setDraggedCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || !draggedCard) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    if (disabled || !draggedCard) return;
    e.preventDefault();
    setDragOverIndex(null);

    const draggedIndex = cards.findIndex(card => card.id === draggedCard.id);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    // Reorder cards
    const newCards = [...cards];
    newCards.splice(draggedIndex, 1);
    newCards.splice(dropIndex, 0, draggedCard);
    
    setCards(newCards);
    setDraggedCard(null);

    // Save to app settings
    try {
      await updateAppSettings({ paymentSources: newCards });
    } catch (error) {
      console.error('Failed to reorder cards:', error);
      // Revert the local state if save failed
      setCards(cards);
      alert('Failed to reorder cards. Please try again.');
    }
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverIndex(null);
  };

  const colorOptions = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#6b7280', // Gray
    '#0f4c81', // Dark Blue (Chase style)
    '#fdbb30', // Gold (Amex style)
    '#7fb5b5', // Teal (Citi style)
    '#232f3e', // Dark Gray (Amazon style)
    '#e3e3e3'  // Light Gray (Apple style)
  ];

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Payment Method
          {!isUserSelected && (
            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
              (Default selected)
            </span>
          )}
        </label>
        <div 
          onClick={toggleStack}
          className={`flex items-center gap-4 p-3 border rounded-lg transition-colors ${
            disabled 
              ? 'cursor-not-allowed opacity-50 border-gray-300 dark:border-gray-600' 
              : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 border-gray-300 dark:border-gray-600'
          } ${!isUserSelected ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}
        >
          <div 
            className="w-[70px] h-[40px] rounded-lg flex flex-col justify-between p-[6px] shadow-lg text-white font-mono text-xs"
            style={{ backgroundColor: selectedCard.color }}
          >
            <span className="text-right text-[7px] uppercase font-bold">
              {selectedCard.network}
            </span>
            <span className="text-left text-[9px] leading-none">
              {['Cash', 'Venmo'].includes(selectedCard.network) 
                ? (selectedCard.network === 'Cash' ? '$$$' : '@') 
                : `•••• ${selectedCard.last4 || '••••'}`}
            </span>
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-white">
              {selectedCard.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {['Cash', 'Venmo'].includes(selectedCard.network) 
                ? selectedCard.network 
                : `(...${selectedCard.last4})`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {isStackOpen ? '▲' : '▼'}
            </span>
            {!isUserSelected && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" title="Default payment method - tap to change"></div>
            )}
          </div>
        </div>

        {/* Dropdown Card Stack */}
        {isStackOpen && (
          <div className="card-stack-dropdown">
            {cards.length > 1 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
                💡 Drag and drop cards to reorder
              </div>
            )}
            <div className="card-stack">
              <AnimatePresence initial={false} mode="popLayout">
                {[...cards, { id: 'add-new', name: '+ Add New Card', network: 'Visa' as const, last4: '', color: '#6b7280' }].map((card, index) => {
                  const isSelected = selectedCard.id === card.id;
                  const isAddNew = card.id === 'add-new';
                  const isNonCard = ['Cash', 'Venmo'].includes(card.network);
                  
                  return (
                    <motion.div 
                      key={card.id} 
                      layout 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }} 
                      transition={{ duration: 0.2 }}
                    >
                      <SwipeableRow 
                        onDelete={() => !isAddNew && !disabled && handleDeleteCard(card)}
                        threshold={-80}
                      >
                        {/* Card */}
                        <div
                          className={`card-stack-item ${isSelected ? 'selected' : ''} ${isAddNew ? 'add-new-card' : ''} ${draggedCard?.id === card.id ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                          onClick={() => handleCardClick(card)}
                          draggable={!isAddNew && !disabled}
                          onDragStart={!isAddNew ? (e) => handleDragStart(e, card) : undefined}
                          onDragOver={!isAddNew ? (e) => handleDragOver(e, index) : undefined}
                          onDragLeave={!isAddNew ? handleDragLeave : undefined}
                          onDrop={!isAddNew ? (e) => handleDrop(e, index) : undefined}
                          onDragEnd={!isAddNew ? handleDragEnd : undefined}
                          style={{ 
                            backgroundColor: isAddNew ? '#f3f4f6' : card.color,
                            color: isAddNew ? '#374151' : (card.color === '#e3e3e3' ? '#000' : '#fff'),
                            zIndex: cards.length - index,
                            opacity: draggedCard?.id === card.id ? 0.5 : 1,
                            transform: dragOverIndex === index ? 'scale(1.02)' : 'scale(1)'
                          }}
                        >
                          <div className="card-header">
                            <span className="card-network">{isAddNew ? '' : card.network}</span>
                            {isSelected && !isAddNew && (
                              <span className="selected-indicator">✓</span>
                            )}
                          </div>
                          
                          <div className="card-details">
                            <div className="card-name">{card.name}</div>
                            <div className="card-number">
                              {isAddNew ? '' : (isNonCard ? (card.network === 'Cash' ? '$$$' : '@') : `•••• ${card.last4}`)}
                            </div>
                          </div>
                          
                          {isAddNew && (
                            <div className="add-icon">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                            </div>
                          )}
                        </div>
                      </SwipeableRow>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Add Card Modal */}
      {isAddCardModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Payment Method</h2>
              <button
                type="button"
                onClick={() => setIsAddCardModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Card Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newCard.name}
                  onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                  placeholder="e.g., Wallet Cash, My Venmo"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Network */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={newCard.network}
                  onChange={(e) => setNewCard({ ...newCard, network: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Amex">Amex</option>
                  <option value="Cash">Cash</option>
                  <option value="Venmo">Venmo</option>
                </select>
              </div>

              {/* Last 4 Digits */}
              {!['Cash', 'Venmo'].includes(newCard.network) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    value={newCard.last4}
                    onChange={(e) => setNewCard({ ...newCard, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="1234"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              )}

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => setNewCard({ ...newCard, color })}
                      className={`w-full h-10 rounded-lg border-2 transition-all ${
                        newCard.color === color
                          ? 'border-blue-500 scale-110'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview
                </label>
                <div 
                  className="w-full h-20 rounded-lg flex flex-col justify-between p-3 shadow-lg text-white font-mono text-xs"
                  style={{ backgroundColor: newCard.color }}
                >
                  <span className="text-right text-[7px] uppercase font-bold">
                    {newCard.network}
                  </span>
                  <span className="text-left text-[9px] leading-none">
                    {['Cash', 'Venmo'].includes(newCard.network) 
                      ? (newCard.network === 'Cash' ? '$$$' : '@') 
                      : `•••• ${newCard.last4 || '0000'}`}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddCardModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Delete Card
              </h3>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete <span className="font-medium">{deleteConfirmCard.name}</span>?
              </p>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCard}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CardStack;
