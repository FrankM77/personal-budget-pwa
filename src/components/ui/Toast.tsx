import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Undo2 } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';

export const Toast: React.FC = () => {
  const { message, type, isVisible, undoAction, hideToast } = useToastStore();

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 dark:bg-green-600 text-white';
      case 'error':
        return 'bg-red-500 dark:bg-red-600 text-white';
      case 'neutral':
      default:
        return 'bg-gray-800 dark:bg-gray-900 text-white border border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-4 left-4 right-4 z-[150] mt-[calc(env(safe-area-inset-top)+8px)]"
        >
          <div className={`rounded-xl shadow-lg p-4 flex items-center justify-between ${getToastStyles()}`}>
            <div className="flex items-center flex-1 min-w-0">
              <span className="text-sm font-medium whitespace-pre-line pr-2">{message}</span>
            </div>

            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {undoAction && (
                <button
                  onClick={() => {
                    undoAction();
                    hideToast();
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors"
                >
                  <Undo2 size={14} className="inline mr-1" />
                  Undo
                </button>
              )}

              <button
                onClick={hideToast}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
