import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, FolderOpen } from 'lucide-react';
import type { Category } from '../../models/types';

interface MoveToCategoryModalProps {
  isVisible: boolean;
  onClose: () => void;
  categories: Category[];
  currentCategoryId: string;
  envelopeName: string;
  onSelect: (categoryId: string) => void;
}

const MoveToCategoryModal: React.FC<MoveToCategoryModalProps> = ({
  isVisible,
  onClose,
  categories,
  currentCategoryId,
  envelopeName,
  onSelect,
}) => {
  // Lock body scroll when modal is open (mobile)
  useEffect(() => {
    if (isVisible) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Lock body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      return () => {
        // Restore scroll position and unlock
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isVisible]);
  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black bg-opacity-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] overflow-hidden relative z-10 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderOpen size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  Move Envelope
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Envelope name */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-zinc-800/50">
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Moving <span className="font-medium text-gray-700 dark:text-zinc-300">{envelopeName}</span> to:
              </p>
            </div>

            {/* Category list */}
            <div className="overflow-y-auto max-h-[50vh]">
              {categories.map((cat) => {
                const isCurrent = cat.id === currentCategoryId;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (!isCurrent) onSelect(cat.id);
                    }}
                    disabled={isCurrent}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 dark:bg-blue-900/20 cursor-default'
                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700'
                    }`}
                  >
                    <span className={`text-sm ${
                      isCurrent
                        ? 'font-semibold text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {cat.name}
                    </span>
                    {isCurrent && (
                      <Check size={16} className="text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MoveToCategoryModal;
