import React, { useState, useEffect } from 'react';
import { X, PiggyBank } from 'lucide-react';
import type { Envelope } from '../../models/types';

interface PiggybankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (piggybankData: Partial<Envelope>) => Promise<void>;
  existingPiggybank?: Envelope;
}

export const PiggybankModal: React.FC<PiggybankModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingPiggybank
}) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [icon, setIcon] = useState('piggy-bank');
  const [paused, setPaused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (existingPiggybank) {
      setName(existingPiggybank.name);
      setTargetAmount(existingPiggybank.piggybankConfig?.targetAmount?.toString() || '');
      setMonthlyContribution(existingPiggybank.piggybankConfig?.monthlyContribution.toString() || '0');
      setColor(existingPiggybank.piggybankConfig?.color || '#3B82F6');
      setIcon(existingPiggybank.piggybankConfig?.icon || 'piggy-bank');
      setPaused(existingPiggybank.piggybankConfig?.paused || false);
    } else {
      setName('');
      setTargetAmount('');
      setMonthlyContribution('');
      setColor('#3B82F6');
      setIcon('piggy-bank');
      setPaused(false);
    }
  }, [existingPiggybank, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !monthlyContribution) return;

    setIsSaving(true);
    try {
      const piggybankData: Partial<Envelope> = {
        name: name.trim(),
        isPiggybank: true,
        piggybankConfig: {
          targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
          monthlyContribution: parseFloat(monthlyContribution),
          color,
          icon,
          paused
        }
      };

      if (existingPiggybank) {
        piggybankData.id = existingPiggybank.id;
        piggybankData.currentBalance = existingPiggybank.currentBalance;
        piggybankData.lastUpdated = new Date().toISOString();
        piggybankData.isActive = existingPiggybank.isActive;
        piggybankData.orderIndex = existingPiggybank.orderIndex;
        piggybankData.userId = existingPiggybank.userId;
      }

      await onSave(piggybankData);
      onClose();
    } catch (error) {
      console.error('Error saving piggybank:', error);
      alert('Failed to save piggybank');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const colorOptions = [
    { value: '#3B82F6', label: 'Blue' },
    { value: '#10B981', label: 'Green' },
    { value: '#F59E0B', label: 'Amber' },
    { value: '#EF4444', label: 'Red' },
    { value: '#8B5CF6', label: 'Purple' },
    { value: '#EC4899', label: 'Pink' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <PiggyBank size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {existingPiggybank ? 'Edit Piggybank' : 'New Piggybank'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <label htmlFor="piggybank-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Piggybank Name *
            </label>
            <input
              type="text"
              id="piggybank-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vacation Fund, Emergency Savings"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              required
              autoFocus
            />
          </div>

          {/* Monthly Contribution */}
          <div className="space-y-2">
            <label htmlFor="monthly-contribution" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Monthly Auto-Contribution *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">$</span>
              <input
                type="number"
                id="monthly-contribution"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              This amount will be automatically added each month and deducted from Available to Budget
            </p>
          </div>

          {/* Target Amount (Optional) */}
          <div className="space-y-2">
            <label htmlFor="target-amount" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Target Goal (Optional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 font-semibold">$</span>
              <input
                type="number"
                id="target-amount"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-500">
              Set a savings goal to track progress
            </p>
          </div>

          {/* Pause Toggle */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={paused}
                onChange={(e) => setPaused(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Pause auto-contributions
                </span>
                <p className="text-xs text-gray-500 dark:text-zinc-500">
                  Monthly contributions will be skipped while paused
                </p>
              </div>
            </label>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Color
            </label>
            <div className="grid grid-cols-6 gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`w-full aspect-square rounded-lg transition-all ${
                    color === option.value
                      ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-zinc-900'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: option.value }}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 font-semibold bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !monthlyContribution || isSaving}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold shadow-sm text-white transition-colors ${
                name.trim() && monthlyContribution && !isSaving
                  ? 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                  : 'bg-gray-300 dark:bg-zinc-600 cursor-not-allowed'
              }`}
            >
              {isSaving ? 'Saving...' : existingPiggybank ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
