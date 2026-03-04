import { create } from 'zustand';

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
    set({
      message,
      type,
      isVisible: true,
      undoAction,
    });

    // Auto-hide after 5 seconds if undo action, 2 seconds otherwise
    const timeout = undoAction ? 5000 : 2000;
    setTimeout(() => {
      get().hideToast();
    }, timeout);
  },

  hideToast: () => {
    set({ isVisible: false });
  },
}));
