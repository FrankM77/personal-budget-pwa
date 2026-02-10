import { DistributionTemplateService } from '../services/DistributionTemplateService';
import type { DistributionTemplate, Envelope } from '../models/types';
import logger from '../utils/logger';

type SliceParams = {
  set: (partial: any) => void;
  get: () => {
    distributionTemplates: DistributionTemplate[];
    envelopes: Envelope[];
  };
  getCurrentUserId: () => string;
  isNetworkError: (error: any) => boolean;
};

export const createTemplateSlice = ({ set, get, getCurrentUserId, isNetworkError }: SliceParams) => {
  return {
    saveTemplate: async (name: string, distributions: Record<string, number>, note: string) => {
      logger.log('📝 saveTemplate called with:', { name, distributions, note });
      try {
        const userId = getCurrentUserId();
        const templateData: DistributionTemplate = {
          id: `temp-${Date.now()}`, // Temporary ID, will be replaced by Firebase
          userId: userId,
          name,
          note,
          lastUsed: new Date().toISOString(),
          distributions
        };

        logger.log('🔄 Attempting Firebase template save...');
        logger.log('📶 Current online status:', navigator.onLine);

        // Try Firebase save first with timeout for offline detection
        try {
          const firebasePromise = DistributionTemplateService.createDistributionTemplate(templateData);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 5000)
          );
          const savedTemplate = await Promise.race([firebasePromise, timeoutPromise]) as DistributionTemplate;
          logger.log('✅ Firebase template save succeeded (online mode):', savedTemplate);

          // Don't update local state - real-time subscription handles it
          logger.log('✅ Template saved to Firebase - real-time subscription will update local state');

          logger.log('✅ Template saved to Firebase:', savedTemplate);
          logger.log('📊 Store now has templates:', get().distributionTemplates.length);
        } catch (firebaseError: any) {
          logger.log('🔥 Firebase template save failed or timed out:', firebaseError.message);
          throw firebaseError; // Re-throw to trigger local fallback
        }
      } catch (error) {
        logger.error('❌ Failed to save template to Firebase, saving locally:', error);
        logger.log('🔍 Error details:', {
          name: (error as any)?.name || 'Unknown',
          message: (error as any)?.message || 'Unknown',
          code: (error as any)?.code || 'Unknown',
          isNetworkError: isNetworkError(error)
        });

        // Fallback: save locally if Firebase fails
        const userId = getCurrentUserId();
        const localTemplate: DistributionTemplate = {
          id: `local-${Date.now()}`,
          userId,
          name,
          note,
          lastUsed: new Date().toISOString(),
          distributions
        };

        logger.log('💾 Saving template locally (offline):', localTemplate);

        set((state: any) => ({
          distributionTemplates: [...state.distributionTemplates, localTemplate],
          pendingSync: true // Mark for later sync
        }));

        logger.log('✅ Template saved locally as fallback:', localTemplate);
        logger.log('📊 Store now has templates:', get().distributionTemplates.length);
      }
    },

    updateTemplate: async (template: DistributionTemplate) => {
      try {
        const userId = getCurrentUserId();
        await DistributionTemplateService.updateDistributionTemplate(userId, template.id, {
          name: template.name,
          note: template.note,
          distributions: template.distributions,
          lastUsed: template.lastUsed
        });

        set((state: any) => ({
          distributionTemplates: state.distributionTemplates.map((t: DistributionTemplate) =>
            t.id === template.id ? template : t
          )
        }));

        logger.log('✅ Template updated in Firebase:', template.id);
      } catch (error) {
        logger.error('❌ Failed to update template in Firebase:', error);
        throw error;
      }
    },

    deleteTemplate: async (templateId: string) => {
      try {
        const userId = getCurrentUserId();
        await DistributionTemplateService.deleteDistributionTemplate(userId, templateId);

        set((state: any) => ({
          distributionTemplates: state.distributionTemplates.filter((t: DistributionTemplate) => t.id !== templateId)
        }));

        logger.log('✅ Template deleted from Firebase:', templateId);
      } catch (error) {
        logger.error('❌ Failed to delete template from Firebase:', error);
        throw error;
      }
    },

    cleanupOrphanedTemplates: async () => {
      logger.log('🧹 Cleaning up orphaned templates...');
      const templates = get().distributionTemplates;
      const envelopes = get().envelopes;
      const envelopeIds = new Set(envelopes.map(env => env.id));

      let cleanedCount = 0;
      for (const template of templates) {
        const originalDistributions = { ...template.distributions };
        const cleanedDistributions: Record<string, number> = {};

        // Keep only distributions for existing envelopes
        for (const [envId, amount] of Object.entries(template.distributions)) {
          if (envelopeIds.has(envId)) {
            cleanedDistributions[envId] = amount;
          }
        }

        // If template has no valid distributions left, delete it
        if (Object.keys(cleanedDistributions).length === 0) {
          logger.log(`🗑️ Deleting orphaned template: ${template.name}`);
          const userId = getCurrentUserId();
          await DistributionTemplateService.deleteDistributionTemplate(userId, template.id);
          cleanedCount++;
        }
        // If template changed, update it
        else if (JSON.stringify(cleanedDistributions) !== JSON.stringify(originalDistributions)) {
          logger.log(`🔧 Updating template ${template.name} - removed orphaned envelope references`);
          const userId = getCurrentUserId();
          await DistributionTemplateService.updateDistributionTemplate(userId, template.id, {
            distributions: cleanedDistributions
          });
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.log(`✅ Cleaned up ${cleanedCount} templates`);
      } else {
        logger.log('✅ No orphaned templates found');
      }
    },

    updateTemplateEnvelopeReferences: async (oldEnvelopeId: string, newEnvelopeId: string) => {
      logger.log(`🔄 Updating template references: ${oldEnvelopeId} → ${newEnvelopeId}`);
      const templates = get().distributionTemplates;
      let updatedCount = 0;

      for (const template of templates) {
        if (template.distributions[oldEnvelopeId] !== undefined) {
          const updatedDistributions = { ...template.distributions };
          updatedDistributions[newEnvelopeId] = updatedDistributions[oldEnvelopeId];
          delete updatedDistributions[oldEnvelopeId];

          logger.log(`📝 Updating template: ${template.name}`);
          const userId = getCurrentUserId();
          await DistributionTemplateService.updateDistributionTemplate(userId, template.id, {
            distributions: updatedDistributions
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        logger.log(`✅ Updated ${updatedCount} templates with new envelope reference`);
      }
    },

    removeEnvelopeFromTemplates: async (envelopeId: string) => {
      logger.log(`🗑️ Removing envelope ${envelopeId} from all templates`);
      const templates = get().distributionTemplates;
      let updatedCount = 0;
      let deletedCount = 0;

      for (const template of templates) {
        if (template.distributions[envelopeId] !== undefined) {
          const updatedDistributions = { ...template.distributions };
          delete updatedDistributions[envelopeId];

          // If no distributions left, delete the template
          if (Object.keys(updatedDistributions).length === 0) {
            logger.log(`🗑️ Deleting template ${template.name} - no envelopes left`);
            const userId = getCurrentUserId();
            await DistributionTemplateService.deleteDistributionTemplate(userId, template.id);
            deletedCount++;
          } else {
            logger.log(`📝 Removing envelope from template: ${template.name}`);
            const userId = getCurrentUserId();
            await DistributionTemplateService.updateDistributionTemplate(userId, template.id, {
              distributions: updatedDistributions
            });
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0 || deletedCount > 0) {
        logger.log(`✅ Updated ${updatedCount} templates, deleted ${deletedCount} empty templates`);
      }
    }
  };
};
