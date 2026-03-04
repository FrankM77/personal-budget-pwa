import { create } from 'zustand';
import logger from '../utils/logger';

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'neutral';
  isVisible: boolean;
  undoAction?: () => void;
}

interface ToastActions {
  showToast: (message: string, type: ToastState['type'], undoAction?: () => void) => void;
  hideToast: () => void;
}

type ToastStore = ToastState & ToastActions;

export const useToastStore = create<ToastStore>((set, get) => ({
  message: '',
  type: 'neutral',
  isVisible: false,
  undoAction: undefined,

  showToast: (message: string, type: ToastState['type'] = 'neutral', undoAction?: () => void) => {
    logger.log('📢 ToastStore.showToast called', { message, type, hasUndo: !!undoAction });
    
    // Force replace entire state to ensure subscribers are notified
    set({
      message,
      type,
      isVisible: true,
      undoAction,
      showToast: get().showToast,
      hideToast: get().hideToast,
    }, true); // true = replace entire state

    logger.log('📢 ToastStore state updated', { isVisible: true });

    // Auto-hide after 5 seconds if undo action, 2 seconds otherwise
    const timeout = undoAction ? 5000 : 2000;
    setTimeout(() => {
      logger.log('⏰ Toast timeout expired, hiding toast');
      get().hideToast();
    }, timeout);
  },

  hideToast: () => {
    logger.log('🚫 ToastStore.hideToast called');
    set({ isVisible: false });
  },
}));
