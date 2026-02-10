import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { AppSettings } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

export const createSettingsSlice = ({ set, get }: SliceParams) => ({
    updateAppSettings: async (settings: Partial<AppSettings>): Promise<void> => {
        try {
            set({ isLoading: true, error: null });
            
            const state = get();
            const updatedSettings: AppSettings = { 
                id: state.appSettings?.id || 'default',
                theme: settings.theme ?? state.appSettings?.theme ?? 'system',
                fontSize: settings.fontSize ?? state.appSettings?.fontSize ?? 'medium',
                enableMoveableReorder: settings.enableMoveableReorder ?? state.appSettings?.enableMoveableReorder ?? true,
                paymentSources: settings.paymentSources ?? state.appSettings?.paymentSources ?? [],
                siriToken: settings.siriToken ?? state.appSettings?.siriToken
            };
            
            // Only include userId if it has a value
            if (settings.userId || state.appSettings?.userId) {
                updatedSettings.userId = settings.userId ?? state.appSettings?.userId;
            }

            // Sanitize paymentSources to remove undefined values (Firestore doesn't like them)
            if (updatedSettings.paymentSources) {
                updatedSettings.paymentSources = updatedSettings.paymentSources.map(source => {
                    const cleanSource = { ...source };
                    if (cleanSource.last4 === undefined) {
                        delete cleanSource.last4;
                    }
                    return cleanSource;
                });
            }
            
            const { currentUser } = useAuthStore.getState();
            if (currentUser) {
                const { AppSettingsService } = await import('../services/AppSettingsService');
                await AppSettingsService.updateAppSettings(currentUser.id, updatedSettings.id, updatedSettings);
            }
            
            set({
                appSettings: updatedSettings,
                isLoading: false
            });
            
            logger.log('✅ Updated app settings');
            
        } catch (error) {
            logger.error('❌ updateAppSettings failed:', error);
            set({ 
                isLoading: false, 
                error: error instanceof Error ? error.message : 'Failed to update settings' 
            });
            throw error;
        }
    },

    initializeAppSettings: async (): Promise<void> => {
        try {
            const state = get();
            if (state.appSettings) {
                return; // Already initialized
            }
            
            const { currentUser } = useAuthStore.getState();
            
            if (currentUser) {
                const { AppSettingsService } = await import('../services/AppSettingsService');
                const appSettings = await AppSettingsService.getAppSettings(currentUser.id);
                
                if (appSettings) {
                    set({ appSettings });
                    logger.log('✅ Loaded app settings from Firestore');
                    return;
                }
            }
            
            // Create default settings if none exist
            const defaultSettings: AppSettings = {
                id: 'default',
                theme: 'system',
                fontSize: 'medium',
                enableMoveableReorder: true,
                paymentSources: []
            };
            
            // Only include userId if we have a current user
            if (currentUser) {
                defaultSettings.userId = currentUser.id;
            }
            
            set({
                appSettings: defaultSettings
            });
            
            logger.log('✅ Initialized default app settings');
            
        } catch (error) {
            logger.error('❌ initializeAppSettings failed:', error);
            set({ 
                error: error instanceof Error ? error.message : 'Failed to initialize settings' 
            });
        }
    },

    updateOnlineStatus: async () => {
        try {
            const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
            set({ isOnline });
            logger.log('📡 Online status updated:', isOnline);
        } catch (error) {
            logger.error('❌ Failed to update online status:', error);
        }
    },
});
