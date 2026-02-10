import { BudgetService } from '../services/budgetService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { SliceParams } from './budgetStoreTypes';

const budgetService = BudgetService.getInstance();

// Helper function to get current user ID
const getCurrentUserId = () => {
  const authStore = useAuthStore.getState();
  return authStore.currentUser?.id || '';
};

export const createOnboardingSlice = ({ set, get }: SliceParams) => ({
    setIsOnboardingActive: (active: boolean) => {
        set({ isOnboardingActive: active });
    },

    checkAndStartOnboarding: async () => {
      const userId = getCurrentUserId();
      if (!userId) {
        logger.log('⏭️ No user ID, skipping onboarding check');
        return;
      }
      
      // Check user-specific onboarding completion status
      const storageKey = `onboardingCompleted_${userId}`;
      const isCompleted = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) === 'true' : false;
      
      logger.log('🔍 checkAndStartOnboarding called:', {
        userId,
        isOnboardingCompleted: isCompleted,
        isOnboardingActive: get().isOnboardingActive,
        localStorage_key: storageKey,
        localStorage_value: localStorage.getItem(storageKey)
      });
      
      // If localStorage says completed, trust it
      if (isCompleted) {
        set({ isOnboardingCompleted: true });
        logger.log('⏭️ Skipping onboarding: already completed (localStorage)');
        return;
      }
      
      // localStorage doesn't have completion flag (new device or cleared storage)
      // Check Firestore for existing data before treating user as new
      try {
        const existingEnvelopes = await budgetService.getEnvelopes(userId);
        if (existingEnvelopes.length > 0) {
          // User has existing data — they're not new, just on a new device
          logger.log('⏭️ Existing user detected on new device — skipping onboarding, setting localStorage');
          localStorage.setItem(storageKey, 'true');
          set({ isOnboardingCompleted: true, isOnboardingActive: false });
          return;
        }
      } catch (error) {
        logger.error('⚠️ Failed to check existing envelopes for onboarding:', error);
        // On error, don't show onboarding — safer to skip than to annoy existing users
        set({ isOnboardingCompleted: true, isOnboardingActive: false });
        return;
      }
      
      // Truly new user — no localStorage flag AND no Firestore data
      if (!get().isOnboardingActive) {
        logger.log('🎯 Starting onboarding for new user - setting isOnboardingActive to TRUE');
        set({ isOnboardingCompleted: false, isOnboardingActive: true });
        logger.log('✅ isOnboardingActive set to:', get().isOnboardingActive);
      }
    },

    completeOnboarding: () => {
      const userId = getCurrentUserId();
      if (userId) {
        const storageKey = `onboardingCompleted_${userId}`;
        localStorage.setItem(storageKey, 'true');
        logger.log('✅ Onboarding completed for user:', userId);
      }
      set({ isOnboardingCompleted: true, isOnboardingActive: false });
    },

    resetOnboarding: () => {
        const userId = getCurrentUserId();
        if (userId) {
          const storageKey = `onboardingCompleted_${userId}`;
          localStorage.removeItem(storageKey);
          logger.log('🔄 Onboarding reset for user:', userId);
        }
        set({ isOnboardingCompleted: false, isOnboardingActive: true });
    },
});
