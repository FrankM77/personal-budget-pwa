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
      
      // Also check guided tutorial completion status
      const tutorialKey = `guidedTutorialCompleted_${userId}`;
      const isTutorialCompleted = typeof localStorage !== 'undefined' ? localStorage.getItem(tutorialKey) === 'true' : false;

      // If localStorage says completed, trust it
      if (isCompleted) {
        set({ isOnboardingCompleted: true, guidedTutorialCompleted: isTutorialCompleted });
        logger.log('⏭️ Skipping onboarding: already completed (localStorage)', { isTutorialCompleted });
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

    startGuidedTutorial: () => {
      logger.log('🎓 Starting guided tutorial');
      set({ guidedTutorialStep: 0, guidedTutorialCompleted: false });
    },

    advanceGuidedTutorial: () => {
      const current = get().guidedTutorialStep;
      if (current === null) return;
      const nextStep = current + 1;
      const totalSteps = 4; // 0: income, 1: envelope, 2: allocate, 3: piggybank
      if (nextStep >= totalSteps) {
        // Complete the tutorial
        const userId = getCurrentUserId();
        if (userId) {
          localStorage.setItem(`guidedTutorialCompleted_${userId}`, 'true');
        }
        logger.log('🎓 Guided tutorial completed!');
        set({ guidedTutorialStep: null, guidedTutorialCompleted: true });
      } else {
        logger.log('🎓 Advancing guided tutorial to step:', nextStep);
        set({ guidedTutorialStep: nextStep });
      }
    },

    skipGuidedTutorial: () => {
      const userId = getCurrentUserId();
      if (userId) {
        localStorage.setItem(`guidedTutorialCompleted_${userId}`, 'true');
      }
      logger.log('🎓 Guided tutorial skipped');
      set({ guidedTutorialStep: null, guidedTutorialCompleted: true });
    },

    completeGuidedTutorial: () => {
      const userId = getCurrentUserId();
      if (userId) {
        localStorage.setItem(`guidedTutorialCompleted_${userId}`, 'true');
      }
      logger.log('🎓 Guided tutorial completed!');
      set({ guidedTutorialStep: null, guidedTutorialCompleted: true });
    },

    resetGuidedTutorial: () => {
      const userId = getCurrentUserId();
      if (userId) {
        localStorage.removeItem(`guidedTutorialCompleted_${userId}`);
      }
      logger.log('🔄 Guided tutorial reset — starting at step 0');
      set({ guidedTutorialStep: 0, guidedTutorialCompleted: false });
    },
});
