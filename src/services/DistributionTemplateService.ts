import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
  addDoc,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { DistributionTemplate } from '../models/types';

// The path to the collection: users/{userId}/distributionTemplates
const getCollectionRef = (userId: string) =>
  collection(db, 'users', userId, 'distributionTemplates');

export const DistributionTemplateService = {

  // 1. OBSERVE (Equivalent to Combine/@Published)
  // This function keeps the UI in sync with the Cloud automatically.
  subscribeToDistributionTemplates: (
    userId: string,
    onUpdate: (templates: DistributionTemplate[]) => void
  ) => {
    const q = query(getCollectionRef(userId), orderBy('lastUsed', 'desc'));

    // This listener stays alive and calls 'onUpdate' whenever DB changes
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DistributionTemplate[];

      onUpdate(templates);
    });

    // Return the unsubscribe function so we can clean up (like .cancellable in Swift)
    return unsubscribe;
  },

  // 2. GET ALL (For store.fetchData)
  getAllDistributionTemplates: async (userId: string): Promise<DistributionTemplate[]> => {
    const q = query(getCollectionRef(userId), orderBy('lastUsed', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as DistributionTemplate[];
  },

  // 3. CREATE
  createDistributionTemplate: async (template: DistributionTemplate) => {
    const { userId, id: tempId, ...templateData } = template;
    if (!userId) {
      throw new Error('User ID is required to create distribution template');
    }
    console.log(`📝 DistributionTemplateService.createDistributionTemplate: Adding template for user ${userId}:`, templateData);

    try {
      const docRef = await addDoc(getCollectionRef(userId), templateData);
      console.log(`📄 Template addDoc succeeded, docRef:`, docRef);

      // Create result with the real Firebase ID
      const result = { id: docRef.id, ...templateData, userId };
      console.log(`📤 Final template result object:`, result);
      return result;
    } catch (error) {
      console.error(`💥 Template addDoc failed:`, error);
      throw error;
    }
  },

  // 4. SAVE (Create/Update with merge)
  saveDistributionTemplate: async (userId: string, template: DistributionTemplate) => {
    const docRef = doc(db, 'users', userId, 'distributionTemplates', template.id);
    return await setDoc(docRef, template, { merge: true });
  },

  // 5. UPDATE
  updateDistributionTemplate: async (userId: string, templateId: string, updates: Partial<DistributionTemplate>) => {
    const docRef = doc(db, 'users', userId, 'distributionTemplates', templateId);
    return await updateDoc(docRef, updates);
  },

  // 6. DELETE
  deleteDistributionTemplate: async (userId: string, templateId: string) => {
    console.log(`🗑️ DistributionTemplateService.deleteDistributionTemplate: Deleting template ${templateId} for user ${userId}`);
    const docRef = doc(db, 'users', userId, 'distributionTemplates', templateId);
    await deleteDoc(docRef);
    console.log(`✅ DistributionTemplateService.deleteDistributionTemplate: Successfully deleted template ${templateId}`);
  }
};
