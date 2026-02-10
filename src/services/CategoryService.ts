import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Category } from '../models/types';
import logger from '../utils/logger';

export class CategoryService {
  private static instance: CategoryService;

  private constructor() {}

  public static getInstance(): CategoryService {
    if (!CategoryService.instance) {
      CategoryService.instance = new CategoryService();
    }
    return CategoryService.instance;
  }

  // Generate a new ID
  public createId(): string {
    return doc(collection(db, 'temp')).id;
  }

  // Create a new category
  public async createCategory(category: Category): Promise<Category> {
    const categoryRef = doc(db, `users/${category.userId}/categories`, category.id);
    await setDoc(categoryRef, category);
    return category;
  }

  // Get all categories for a user
  public async getCategories(userId: string): Promise<Category[]> {
    const q = query(
      collection(db, `users/${userId}/categories`),
      orderBy('orderIndex', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Category);
  }

  // Update a category
  public async updateCategory(userId: string, category: Category): Promise<void> {
    const categoryRef = doc(db, `users/${userId}/categories`, category.id);
    await setDoc(categoryRef, category, { merge: true });
  }

  // Delete a category (or archive if preferred, but physically delete here)
  public async deleteCategory(userId: string, categoryId: string): Promise<void> {
    const categoryRef = doc(db, `users/${userId}/categories`, categoryId);
    await deleteDoc(categoryRef);
  }

  // Reorder categories
  public async reorderCategories(userId: string, categories: Category[]): Promise<void> {
    const batch = writeBatch(db);
    
    categories.forEach((cat, index) => {
      const ref = doc(db, `users/${userId}/categories`, cat.id);
      batch.update(ref, { orderIndex: index });
    });

    await batch.commit();
  }

  // Deduplicate categories by name, keeping the first (lowest orderIndex) of each
  public async deduplicateCategories(userId: string): Promise<number> {
    const categories = await this.getCategories(userId);
    
    // Group by name (case-insensitive)
    const seen = new Map<string, Category>();
    const duplicateIds: string[] = [];
    
    for (const cat of categories) {
      const key = cat.name.toLowerCase().trim();
      if (seen.has(key)) {
        duplicateIds.push(cat.id);
      } else {
        seen.set(key, cat);
      }
    }
    
    if (duplicateIds.length === 0) {
      logger.log('✅ No duplicate categories found');
      return 0;
    }
    
    logger.log(`🧹 Found ${duplicateIds.length} duplicate categories to remove`);
    
    // Delete in batches of 450
    const BATCH_SIZE = 450;
    for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = duplicateIds.slice(i, i + BATCH_SIZE);
      
      chunk.forEach(id => {
        const ref = doc(db, `users/${userId}/categories`, id);
        batch.delete(ref);
      });
      
      await batch.commit();
      logger.log(`🗑️ Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }
    
    logger.log(`✅ Removed ${duplicateIds.length} duplicate categories`);
    return duplicateIds.length;
  }

  // Real-time subscription
  public subscribeToCategories(userId: string, onUpdate: (categories: Category[]) => void): () => void {
    const q = query(
      collection(db, `users/${userId}/categories`),
      orderBy('orderIndex', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const categories = snapshot.docs.map(doc => doc.data() as Category);
      onUpdate(categories);
    }, (error) => {
      logger.error('❌ Category subscription error:', error);
    });
  }
}

export const categoryService = CategoryService.getInstance();
