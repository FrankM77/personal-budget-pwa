import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs
  } from 'firebase/firestore';
  import { db } from '../firebase'; // Ensure you have your firebase config initialized here
  import type { Transaction } from '../types/schema';
  import { transactionFromFirestore } from '../mappers/transaction';

  // The path to the collection: users/{userId}/transactions
  const getCollectionRef = (userId: string) => 
    collection(db, 'users', userId, 'transactions');
  
  export const TransactionService = {

    // 1. OBSERVE (Equivalent to Combine/@Published)
    // This function keeps the UI in sync with the Cloud automatically.
    subscribeToTransactions: (
      userId: string,
      onUpdate: (transactions: Transaction[]) => void
    ) => {
      const q = query(getCollectionRef(userId), orderBy('date', 'desc'));

      // This listener stays alive and calls 'onUpdate' whenever DB changes
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];

        onUpdate(transactions);
      });

      // Return the unsubscribe function so we can clean up (like .cancellable in Swift)
      return unsubscribe;
    },

    // 2. GET ALL (For store.fetchData)
    getAllTransactions: async (userId: string): Promise<Transaction[]> => {
      console.log(`📊 TransactionService.getAllTransactions: Fetching for user ${userId}`);
      const q = query(getCollectionRef(userId), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => {
        const firebaseTx = { id: doc.id, ...doc.data() } as any;
        return transactionFromFirestore(firebaseTx);
      });
      console.log(`📋 Fetched ${transactions.length} transactions:`, transactions.map(t => ({ id: t.id, description: t.description, month: t.month })));
      return transactions as any as Transaction[];
    },

    // 3. ADD (Create) - Updated to match store expectation
    addTransaction: async (transaction: Transaction): Promise<Transaction> => {
      const { userId, id: tempId, ...transactionData } = transaction;
      if (!userId) {
        throw new Error('User ID is required to create transaction');
      }
      console.log(`📝 TransactionService.addTransaction: Adding transaction for user ${userId}:`, transactionData);
      console.log(`🔍 Original transaction had temp ID: ${tempId}`);

      try {
        console.log(`🔥 About to call addDoc with:`, transactionData);
        const docRef = await addDoc(getCollectionRef(userId), transactionData);
        console.log(`📄 addDoc succeeded, docRef:`, docRef);
        console.log(`📄 Document ID: ${docRef.id}`);
        console.log(`📄 Document path: ${docRef.path}`);

        // Create result with the real Firebase ID
        const result = { id: docRef.id, ...transactionData, userId };
        console.log(`📤 Final result object:`, result);
        return result;
      } catch (error) {
        console.error(`💥 addDoc failed:`, error);
        const err = error as Error;
        console.error(`Error message:`, err.message);
        throw error;
      }
    },

    // 4. UPDATE
    updateTransaction: async (userId: string, transactionId: string, updates: Partial<Transaction>) => {
      const docRef = doc(db, 'users', userId, 'transactions', transactionId);
      return await updateDoc(docRef, updates);
    },

    // 5. DELETE
    deleteTransaction: async (userId: string, transactionId: string) => {
      console.log(`🗑️ TransactionService.deleteTransaction: Deleting transaction ${transactionId} for user ${userId}`);
      try {
        const docRef = doc(db, 'users', userId, 'transactions', transactionId);
        console.log(`🎯 Deleting document at path: ${docRef.path}`);
        await deleteDoc(docRef);
        console.log(`✅ TransactionService.deleteTransaction: Successfully deleted transaction ${transactionId}`);
      } catch (error) {
        console.error(`💥 TransactionService.deleteTransaction: Failed to delete transaction ${transactionId}:`, error);
        const err = error as Error;
        console.error(`Error message:`, err.message);
        throw error;
      }
    }
  };