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
        const envelopes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Envelope[];

        onUpdate(envelopes);
      });

      // Return the unsubscribe function so we can clean up (like .cancellable in Swift)
      return unsubscribe;
    },

    // 2. GET ALL (For store.fetchData)
    getAllEnvelopes: async (userId: string): Promise<Envelope[]> => {
      const q = query(getCollectionRef(userId), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Envelope[];
    },

    // 3. CREATE (For store.createEnvelope)
    createEnvelope: async (envelope: Envelope) => {
      const { userId, id: tempId, ...envelopeData } = envelope;
      console.log(`📝 EnvelopeService.createEnvelope: Adding envelope for user ${userId}:`, envelopeData);
      console.log(`🔍 Original envelope had temp ID: ${tempId}`);

      try {
        const docRef = await addDoc(getCollectionRef(userId), envelopeData);
        console.log(`📄 Envelope addDoc succeeded, docRef:`, docRef);
        console.log(`📄 Document ID: ${docRef.id}`);

        // Create result with the real Firebase ID
        const result = { id: docRef.id, ...envelopeData, userId };
        console.log(`📤 Final envelope result object:`, result);
        return result;
      } catch (error) {
        console.error(`💥 Envelope addDoc failed:`, error);
        throw error;
      }
    },

    // 4. SAVE (Create/Update with merge)
    saveEnvelope: async (userId: string, envelope: Envelope) => {
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
      console.log(`🗑️ EnvelopeService.deleteEnvelope: Deleting envelope ${envelopeId} for user ${userId}`);
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      await deleteDoc(docRef);
      console.log(`✅ EnvelopeService.deleteEnvelope: Successfully deleted envelope ${envelopeId}`);
    }
  };
