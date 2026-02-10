import { AppSettingsService } from '../services/AppSettingsService';
import type { AppSettings } from '../models/types';
import logger from '../utils/logger';

type SliceParams = {
  set: (partial: any) => void;
  get: () => {
    appSettings: AppSettings | null;
  };
  getCurrentUserId: () => string;
};

export const createSettingsSlice = ({ set, get, getCurrentUserId }: SliceParams) => {
  return {
    updateAppSettings: async (settings: Partial<AppSettings>) => {
      const state = get();

      if (!state.appSettings) {
        // If no settings exist, create them first
        try {
          await createSettingsSlice({ set, get, getCurrentUserId }).initializeAppSettings();
          // Now that settings exist, update them with the new values
          const newState = get();
          if (newState.appSettings) {
            // Merge the new settings with the initialized defaults
            const updatedSettings = { ...newState.appSettings, ...settings };
            set({ appSettings: updatedSettings });
            const userId = getCurrentUserId();
            await AppSettingsService.updateAppSettings(userId, newState.appSettings.id, settings);
            logger.log('✅ App settings updated successfully');
          }
        } catch (error) {
          logger.error('❌ Failed to initialize/update settings:', error);
        }
        return;
      }

      try {
        set((currentState: { appSettings: AppSettings }) => ({
          appSettings: { ...currentState.appSettings, ...settings }
        }));

        const userId = getCurrentUserId();
        await AppSettingsService.updateAppSettings(userId, state.appSettings.id, settings);
        logger.log('✅ App settings updated successfully');
      } catch (error) {
        logger.error('❌ Failed to update app settings:', error);
        // Revert on failure
        set((currentState: { appSettings: AppSettings }) => ({
          appSettings: currentState.appSettings
        }));
        throw error;
      }
    },

    initializeAppSettings: async () => {
      try {
        const userId = getCurrentUserId();
        const defaultSettings: Omit<AppSettings, 'id'> = {
          userId,
          theme: 'system',
          enableMoveableReorder: false
        };

        const createdSettings = await AppSettingsService.createAppSettings(defaultSettings);

        set({ appSettings: createdSettings });

        logger.log('✅ App settings initialized successfully');
      } catch (error) {
        logger.error('❌ Failed to initialize app settings:', error);
        // Set default settings locally if Firebase fails
        const userId = getCurrentUserId();
        set({
          appSettings: {
            id: 'local-settings',
            userId,
            theme: 'system',
            enableMoveableReorder: false
          }
        });
      }
    }
  };
};
