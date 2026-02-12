import { CategoryService } from '../services/CategoryService';
import { useAuthStore } from './authStore';
import logger from '../utils/logger';
import type { Category, Envelope } from '../models/types';
import type { SliceParams } from './budgetStoreTypes';

const categoryService = CategoryService.getInstance();

// Helper to require an authenticated user (throws if not logged in)
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};

export const createCategorySlice = ({ set, get }: SliceParams) => ({
    fetchCategories: async () => {
        try {
            set({ isLoading: true, error: null });
            const { currentUser } = useAuthStore.getState();
            if (!currentUser) return;

            const categories = await categoryService.getCategories(currentUser.id);
            // Deduplicate
            const uniqueCategories = Array.from(new Map(categories.map(c => [c.id, c])).values());
            set({ categories: uniqueCategories, isLoading: false });
        } catch (error) {
            logger.error('Failed to fetch categories:', error);
            set({ isLoading: false });
        }
    },

    addCategory: async (category: Omit<Category, 'id' | 'userId'>) => {
        try {
            set({ isLoading: true, error: null });
            const currentUser = requireAuth();

            // Prevent duplicate categories by name
            const existingByName = get().categories.find(
                c => c.name.toLowerCase().trim() === (category.name || '').toLowerCase().trim()
            );
            if (existingByName) {
                logger.log(`⚠️ Category "${category.name}" already exists, skipping creation`);
                set({ isLoading: false });
                return existingByName.id;
            }

            const newId = categoryService.createId();
            const newCategory: Category = {
                ...category,
                id: newId,
                userId: currentUser.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                orderIndex: get().categories.length // Append to end
            };

            await categoryService.createCategory(newCategory);
            
            // Update local state - Check for duplicates first (real-time listener might have beaten us)
            set(state => {
                const exists = state.categories.some(c => c.id === newId);
                if (exists) return { isLoading: false };
                return {
                    categories: [...state.categories, newCategory],
                    isLoading: false
                };
            });

            return newId;
        } catch (error) {
            logger.error('Failed to add category:', error);
            set({ isLoading: false });
            throw error;
        }
    },

    updateCategory: async (category: Category) => {
        try {
            set({ isLoading: true, error: null });
            const currentUser = requireAuth();

            const updatedCategory = { ...category, updatedAt: new Date().toISOString() };
            await categoryService.updateCategory(currentUser.id, updatedCategory);

            set(state => ({
                categories: state.categories.map(c => c.id === category.id ? updatedCategory : c),
                isLoading: false
            }));
        } catch (error) {
            logger.error('Failed to update category:', error);
            set({ isLoading: false });
            throw error;
        }
    },

    deleteCategory: async (categoryId: string) => {
        try {
            set({ isLoading: true, error: null });
            const currentUser = requireAuth();

            // Find envelopes that belong to this category
            const orphanedEnvelopes = get().envelopes.filter(e => e.categoryId === categoryId);

            // If there are orphaned envelopes, reassign them to a category named "Uncategorized"
            if (orphanedEnvelopes.length > 0) {
                // Look for an existing category named "Uncategorized" (case-insensitive)
                let uncategorized = get().categories.find(
                    c => c.name.toLowerCase().trim() === 'uncategorized' && c.id !== categoryId
                );

                // If none exists, create one
                if (!uncategorized) {
                    const newId = categoryService.createId();
                    const now = new Date().toISOString();
                    uncategorized = {
                        id: newId,
                        userId: currentUser.id,
                        name: 'Uncategorized',
                        orderIndex: get().categories.length,
                        isDefault: true,
                        createdAt: now,
                        updatedAt: now,
                    };
                    await categoryService.createCategory(uncategorized);
                    set(state => {
                        const exists = state.categories.some(c => c.id === newId);
                        if (exists) return {};
                        return { categories: [...state.categories, uncategorized!] };
                    });
                    logger.log('📂 Created new "Uncategorized" category for orphaned envelopes:', newId);
                }

                for (const env of orphanedEnvelopes) {
                    const updated: Envelope = { ...env, categoryId: uncategorized.id };
                    await get().updateEnvelope(updated);
                }
                logger.log(`📂 Reassigned ${orphanedEnvelopes.length} envelopes to "Uncategorized"`);
            }

            await categoryService.deleteCategory(currentUser.id, categoryId);

            set(state => ({
                categories: state.categories.filter(c => c.id !== categoryId),
                isLoading: false
            }));
        } catch (error) {
            logger.error('Failed to delete category:', error);
            set({ isLoading: false });
            throw error;
        }
    },

    ensureDefaultCategory: async () => {
        const existing = get().categories.find(c => c.isDefault);
        if (existing) return existing.id;

        // Create the default category
        const currentUser = requireAuth();
        const newId = categoryService.createId();
        const now = new Date().toISOString();
        const defaultCategory: Category = {
            id: newId,
            userId: currentUser.id,
            name: 'Uncategorized',
            orderIndex: get().categories.length,
            isDefault: true,
            createdAt: now,
            updatedAt: now,
        };

        await categoryService.createCategory(defaultCategory);

        set(state => {
            const exists = state.categories.some(c => c.id === newId);
            if (exists) return {};
            return { categories: [...state.categories, defaultCategory] };
        });

        logger.log('📂 Created default "Uncategorized" category:', newId);
        return newId;
    },

    reorderCategories: async (orderedIds: string[]) => {
        try {
            set({ isLoading: true, error: null });
            const currentUser = requireAuth();

            const state = get();
            const orderMap = new Map<string, number>();
            orderedIds.forEach((id, index) => orderMap.set(id, index));

            const updatedCategories = state.categories.map(cat => {
                if (!orderMap.has(cat.id)) return cat;
                const nextOrder = orderMap.get(cat.id)!;
                if (cat.orderIndex === nextOrder) return cat;
                return { ...cat, orderIndex: nextOrder };
            });
            
            // Optimistic update
            set({ categories: updatedCategories.sort((a, b) => a.orderIndex - b.orderIndex) });

            await categoryService.reorderCategories(currentUser.id, updatedCategories);
            set({ isLoading: false });
        } catch (error) {
            logger.error('Failed to reorder categories:', error);
            set({ isLoading: false });
            throw error;
        }
    },
});
