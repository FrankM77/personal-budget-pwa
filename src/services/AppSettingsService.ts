import { 
  doc, 
  setDoc, 
  getDocs,
  addDoc,
  deleteDoc, 
  onSnapshot,
  collection,
  query,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppSettings } from '../models/types';

// The path to the collection: users/{userId}/appSettings
const getCollectionRef = (userId: string) =>
  collection(db, 'users', userId, 'appSettings');

export const AppSettingsService = {

  // 1. OBSERVE (Equivalent to Combine/@Published)
  // This function keeps the UI in sync with the Cloud automatically.
  subscribeToAppSettings: (
    userId: string,
    onUpdate: (settings: AppSettings | null) => void
  ) => {
    const q = query(getCollectionRef(userId), limit(1)); // Should only be one settings document per user

    // This listener stays alive and calls 'onUpdate' whenever DB changes
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        onUpdate(null);
        return;
      }

      const settings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))[0] as AppSettings;

      onUpdate(settings);
    });

    // Return the unsubscribe function so we can clean up (like .cancellable in Swift)
    return unsubscribe;
  },

  // 2. GET (For store.fetchData)
  getAppSettings: async (userId: string): Promise<AppSettings | null> => {
    const q = query(getCollectionRef(userId), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as AppSettings;
  },

  // 3. CREATE (First time setup)
  createAppSettings: async (settings: Omit<AppSettings, 'id'>) => {
    const { userId, ...settingsData } = settings;
    if (!userId) {
      throw new Error('User ID is required to create app settings');
    }
    console.log(`📝 AppSettingsService.createAppSettings: Creating settings for user ${userId}:`, settingsData);

    try {
      const docRef = await addDoc(getCollectionRef(userId), settingsData);
      console.log(`📄 Settings addDoc succeeded, docRef:`, docRef);

      // Create result with the real Firebase ID
      const result = { id: docRef.id, ...settingsData, userId };
      console.log(`📤 Final settings result object:`, result);
      return result;
    } catch (error) {
      console.error(`💥 Settings addDoc failed:`, error);
      throw error;
    }
  },

  // 4. SAVE (Create/Update with merge)
  saveAppSettings: async (userId: string, settings: AppSettings) => {
    const docRef = doc(db, 'users', userId, 'appSettings', settings.id);
    return await setDoc(docRef, settings, { merge: true });
  },

  // 5. UPDATE
  updateAppSettings: async (userId: string, settingsId: string, updates: Partial<AppSettings>) => {
    const docRef = doc(db, 'users', userId, 'appSettings', settingsId);
    return await setDoc(docRef, updates, { merge: true });
  },

  // 6. DELETE (Rarely used, but available)
  deleteAppSettings: async (userId: string, settingsId: string) => {
    console.log(`🗑️ AppSettingsService.deleteAppSettings: Deleting settings ${settingsId} for user ${userId}`);
    const docRef = doc(db, 'users', userId, 'appSettings', settingsId);
    await deleteDoc(docRef);
    console.log(`✅ AppSettingsService.deleteAppSettings: Successfully deleted settings ${settingsId}`);
  }
};
