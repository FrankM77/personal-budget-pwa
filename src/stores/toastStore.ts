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

    // Auto-hide after 2 seconds
    setTimeout(() => {
      get().hideToast();
    }, 2000);
  },

  hideToast: () => {
    set({ isVisible: false });
  },
}));
