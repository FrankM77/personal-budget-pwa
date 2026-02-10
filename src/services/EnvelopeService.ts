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
  import { db } from '../firebase'; // Ensure you have your firebase config initialized here
  import type { Envelope } from '../models/types';
  import logger from '../utils/logger';

  // The path to the collection: users/{userId}/envelopes
  const getCollectionRef = (userId: string) =>
    collection(db, 'users', userId, 'envelopes');

  export const EnvelopeService = {

    // 1. OBSERVE (Equivalent to Combine/@Published)
    // This function keeps the UI in sync with the Cloud automatically.
    subscribeToEnvelopes: (
      userId: string,
      onUpdate: (envelopes: Envelope[]) => void
    ) => {
      const q = query(getCollectionRef(userId), orderBy('orderIndex', 'asc'));

      // This listener stays alive and calls 'onUpdate' whenever DB changes
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const envelopes = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamps to ISO strings
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
            lastUpdated: data.lastUpdated?.toDate?.() ? data.lastUpdated.toDate().toISOString() : data.lastUpdated
          };
        }) as Envelope[];

        onUpdate(envelopes);
      });

      // Return the unsubscribe function so we can clean up (like .cancellable in Swift)
      return unsubscribe;
    },

    // 2. GET ALL (For store.fetchData)
    getAllEnvelopes: async (userId: string): Promise<Envelope[]> => {
      try {
        logger.log('📡 EnvelopeService.getAllEnvelopes called for user:', userId);
        
        // Fetch ALL documents without ordering first (ensures we get all envelopes)
        // Then sort in memory to handle missing orderIndex fields gracefully
        const collectionRef = getCollectionRef(userId);
        const snapshot = await getDocs(collectionRef);
        
        const envelopes = snapshot.docs.map((doc, index) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firestore Timestamps to ISO strings
            createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
            lastUpdated: data.lastUpdated?.toDate?.() ? data.lastUpdated.toDate().toISOString() : data.lastUpdated,
            // Ensure orderIndex is always set (default to index if missing)
            orderIndex: data.orderIndex ?? index
          };
        }) as Envelope[];
        
        // Sort by orderIndex in memory (consistent with subscribeToEnvelopes)
        const sortedEnvelopes = envelopes.sort((a, b) => {
          const aIndex = a.orderIndex ?? 0;
          const bIndex = b.orderIndex ?? 0;
          return aIndex - bIndex;
        });
        
        logger.log('✅ Fetched envelopes:', sortedEnvelopes.length);
        return sortedEnvelopes;
      } catch (error) {
        logger.error('❌ EnvelopeService.getAllEnvelopes failed:', error);
        return [];
      }
    },

    // 3. CREATE (For store.createEnvelope)
    createEnvelope: async (envelope: Envelope) => {
      const { userId, id: tempId, ...envelopeData } = envelope;
      if (!userId) {
        throw new Error('User ID is required to create envelope');
      }

      try {
        const docRef = await addDoc(getCollectionRef(userId), envelopeData);
        // Create result with the real Firebase ID
        const result = { id: docRef.id, ...envelopeData, userId };
        return result;
      } catch (error) {
        logger.error(`💥 Envelope addDoc failed:`, error);
        throw error;
      }
    },

    // 4. SAVE (Create/Update with merge)
    saveEnvelope: async (userId: string, envelope: Envelope) => {
      if (!envelope.id) {
        throw new Error('Envelope ID is required for save operation');
      }
      const docRef = doc(db, 'users', userId, 'envelopes', envelope.id);
      return await setDoc(docRef, envelope, { merge: true });
    },

    // 5. UPDATE BALANCE
    updateBalance: async (userId: string, envelopeId: string, newBalance: number) => {
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      return await updateDoc(docRef, {
        currentBalance: newBalance,
        lastUpdated: new Date().toISOString()
      });
    },

    // 6. DELETE
    deleteEnvelope: async (userId: string, envelopeId: string) => {
      logger.log(`🗑️ EnvelopeService.deleteEnvelope: Deleting envelope ${envelopeId} for user ${userId}`);
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      await deleteDoc(docRef);
      logger.log(`✅ EnvelopeService.deleteEnvelope: Successfully deleted envelope ${envelopeId}`);
    }
  };
