import { collection, query, where, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, writeBatch, onSnapshot, arrayUnion, getDoc, deleteField } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Envelope, Transaction, IncomeSource, EnvelopeAllocation } from '../models/types';
import { fromFirestore } from '../mappers/transaction';
import logger from '../utils/logger';
import { toISOString } from '../utils/dateUtils';

export interface CleanupReport {
  orphanedAllocationsDeleted: number;
  orphanedTransactionsDeleted: number;
  details: {
    deletedAllocationIds: string[];
    deletedTransactionIds: string[];
    monthsProcessed: string[];
  };
}

/**
 * Unified Budget Service Layer (Primary)
 * Handles ALL Firestore CRUD operations for the unified BudgetStore.
 * Returns clean Domain Objects, hiding Firestore complexity.
 *
 * Architecture note: Standalone services (EnvelopeService, TransactionService,
 * CategoryService, AppSettingsService, DistributionTemplateService) exist only
 * for real-time `onSnapshot` subscriptions used by envelopeStoreRealtime.ts.
 * All create/read/update/delete operations go through this service.
 */
export class BudgetService {
  private static instance: BudgetService;

  public static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  /**
   * Restore user data from a backup (Time Machine)
   * Wipes all existing data and replaces it with backup data
   * @param userId - User ID to restore data for
   * @param backupData - The parsed JSON backup data
   */
  async restoreUserData(userId: string, backupData: any): Promise<void> {
    try {
      logger.log('🔄 BudgetService.restoreUserData: STARTING RESTORE for user:', userId);

      // 0. Validate backup schema before wiping data
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Invalid backup: data is not an object');
      }
      if (backupData.envelopes && !Array.isArray(backupData.envelopes)) {
        throw new Error('Invalid backup: envelopes must be an array');
      }
      if (backupData.transactions && !Array.isArray(backupData.transactions)) {
        throw new Error('Invalid backup: transactions must be an array');
      }
      if (backupData.allocations && typeof backupData.allocations !== 'object') {
        throw new Error('Invalid backup: allocations must be an object keyed by month');
      }
      if (backupData.incomeSources && typeof backupData.incomeSources !== 'object') {
        throw new Error('Invalid backup: incomeSources must be an object keyed by month');
      }
      // Validate envelopes have required fields
      for (const env of (backupData.envelopes || [])) {
        if (!env.id || typeof env.name !== 'string') {
          throw new Error(`Invalid backup: envelope missing id or name`);
        }
      }
      // Validate transactions have required fields
      for (const tx of (backupData.transactions || [])) {
        if (!tx.id || typeof tx.amount !== 'number') {
          throw new Error(`Invalid backup: transaction missing id or amount`);
        }
      }

      // 1. Wipe existing data
      await this.deleteAllUserData(userId);

      // 2. Build monthlyBudgets embedded documents from allocations + incomeSources
      const monthlyBudgetsData: any[] = [];
      const allMonths = new Set<string>([
        ...Object.keys(backupData.allocations || {}),
        ...Object.keys(backupData.incomeSources || {})
      ]);

      for (const month of allMonths) {
        const allocationsArray = (backupData.allocations || {})[month] || [];
        const incomeSourcesArray = (backupData.incomeSources || {})[month] || [];

        // Convert allocations array to embedded map: { envelopeId: budgetedAmount }
        const allocationsMap: Record<string, number> = {};
        for (const alloc of allocationsArray) {
          if (alloc.envelopeId) {
            allocationsMap[alloc.envelopeId] = Number(alloc.budgetedAmount || 0);
          }
        }

        const now = new Date().toISOString();
        monthlyBudgetsData.push({
          id: `${userId}_${month}`,
          month,
          userId,
          allocations: allocationsMap,
          incomeSources: incomeSourcesArray.map((s: any) => ({ ...s, userId })),
          createdAt: now,
          updatedAt: now,
          totalIncome: incomeSourcesArray.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0),
          availableToBudget: 0
        });
      }

      logger.log(`📅 Prepared ${monthlyBudgetsData.length} monthly budget documents for months: ${[...allMonths].sort().join(', ')}`);

      // 3. Prepare batches for restoration
      const collectionsToRestore: { name: string; data: any[] }[] = [
        { name: 'envelopes', data: backupData.envelopes || [] },
        { name: 'transactions', data: backupData.transactions || [] },
        { name: 'categories', data: backupData.categories || [] },
        { name: 'monthlyBudgets', data: monthlyBudgetsData },
        { name: 'appSettings', data: backupData.appSettings ? [backupData.appSettings] : [] }
      ];

      // Flatten all operations into a single list of { ref, data }
      const operations: { ref: any; data: any }[] = [];

      for (const { name, data } of collectionsToRestore) {
        if (!Array.isArray(data)) continue;

        for (const item of data) {
          // Skip items without ID, except for monthly budgets which use month as ID
          if (!item.id && name !== 'monthlyBudgets') continue;

          // Clean up item for Firestore (remove undefined, convert dates if needed)
          // Ideally we'd map these, but for restore we trust the backup structure mostly.
          // We ensure 'userId' is set correctly to the current user.
          const firestoreItem = { ...item, userId };
          
          // Settings special case: usually singleton or specific ID
          let docId = item.id;
          
          // For monthly budgets, use the month as the document ID
          if (name === 'monthlyBudgets' && item.month) {
            docId = item.month;
          }
          
          const docRef = doc(db, 'users', userId, name, docId);
          operations.push({ ref: docRef, data: firestoreItem });
        }
      }

      logger.log(`📦 Prepared ${operations.length} items for restoration.`);

      // 3. Execute Batches (max 500 per batch)
      const BATCH_SIZE = 450; // Safety margin
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(op => {
          batch.set(op.ref, op.data);
        });

        logger.log(`🚀 Committing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(operations.length / BATCH_SIZE)}...`);
        await batch.commit();
      }

      logger.log('✨ Restore completed successfully.');

    } catch (error) {
      logger.warn(`❌ BudgetService.restoreUserData failed: ${error}`);
      throw new Error(`Failed to restore user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all envelopes for a user
   * @param userId - User ID to fetch envelopes for
   * @returns Promise<Envelope[]> - Array of envelope objects
   */
  async getEnvelopes(userId: string): Promise<Envelope[]> {
    try {
      logger.log('📡 BudgetService.getEnvelopes called for user:', userId);
      
      const collectionRef = collection(db, 'users', userId, 'envelopes');
      const snapshot = await getDocs(collectionRef);
      
      const envelopes = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        ...doc.data(),
        // Ensure orderIndex is always set (default to index if missing)
        orderIndex: doc.data().orderIndex ?? index
      })) as Envelope[];
      
      // Filter out soft-deleted envelopes
      const activeEnvelopes = envelopes.filter(env => !env.deletedAt);
      
      // Sort by orderIndex in memory
      const sortedEnvelopes = activeEnvelopes.sort((a, b) => {
        const aIndex = a.orderIndex ?? 0;
        const bIndex = b.orderIndex ?? 0;
        return aIndex - bIndex;
      });
      
      logger.log('✅ Fetched envelopes:', sortedEnvelopes.length);
      return sortedEnvelopes;
    } catch (error) {
      logger.warn(`❌ BudgetService.getEnvelopes failed: ${error}`);
      throw new Error(`Failed to fetch envelopes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch deleted envelopes (for Recently Deleted view)
   * @param userId - User ID to fetch deleted envelopes for
   * @returns Promise<Envelope[]> - Array of soft-deleted envelope objects
   */
  async getDeletedEnvelopes(userId: string): Promise<Envelope[]> {
    try {
      logger.log('📡 BudgetService.getDeletedEnvelopes called for user:', userId);
      
      const collectionRef = collection(db, 'users', userId, 'envelopes');
      const snapshot = await getDocs(collectionRef);
      
      const envelopes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Envelope[];
      
      // Filter for soft-deleted envelopes only
      const deletedEnvelopes = envelopes.filter(env => env.deletedAt);
      
      // Sort by deletedAt (most recent first)
      const sortedDeleted = deletedEnvelopes.sort((a, b) => {
        const aTime = new Date(a.deletedAt!).getTime();
        const bTime = new Date(b.deletedAt!).getTime();
        return bTime - aTime;
      });
      
      logger.log('✅ Fetched deleted envelopes:', sortedDeleted.length);
      return sortedDeleted;
    } catch (error) {
      logger.warn(`❌ BudgetService.getDeletedEnvelopes failed: ${error}`);
      throw new Error(`Failed to fetch deleted envelopes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all transactions for a user, sorted by date (descending)
   * @param userId - User ID to fetch transactions for
   * @returns Promise<Transaction[]> - Array of transaction objects
   */
  async getTransactions(userId: string): Promise<Transaction[]> {
    try {
      logger.log('📊 BudgetService.getTransactions: Fetching for user', userId);
      
      const collectionRef = collection(db, 'users', userId, 'transactions');
      const q = query(collectionRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      const transactions = snapshot.docs
        .map(doc => {
          const firebaseTx = { id: doc.id, ...doc.data() } as any;
          return fromFirestore(firebaseTx);
        })
        .filter(tx => !tx.deletedAt);
      
      logger.log(`📋 Fetched ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      logger.warn(`❌ BudgetService.getTransactions failed: ${error}`);
      throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch transactions for a specific month
   * @param userId - User ID
   * @param month - Month string (YYYY-MM)
   * @returns Promise<Transaction[]>
   */
  async getTransactionsByMonth(userId: string, month: string): Promise<Transaction[]> {
    try {
      logger.log(`📊 BudgetService.getTransactionsByMonth: Fetching for user ${userId}, month ${month}`);
      
      const collectionRef = collection(db, 'users', userId, 'transactions');
      // Note: This requires a composite index on [month, date] in Firestore
      // If index is missing, it will throw an error with a link to create it
      const q = query(
        collectionRef, 
        where('month', '==', month),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const transactions = snapshot.docs
        .map(doc => {
          const firebaseTx = { id: doc.id, ...doc.data() } as any;
          return fromFirestore(firebaseTx);
        })
        .filter(tx => !tx.deletedAt); // Filter out soft-deleted transactions
      
      logger.log(`📋 Fetched ${transactions.length} transactions for ${month}`);
      return transactions;
    } catch (error) {
      logger.warn(`❌ BudgetService.getTransactionsByMonth failed: ${error}`);
      throw new Error(`Failed to fetch transactions for month ${month}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all transactions for a specific envelope
   * @param userId - User ID
   * @param envelopeId - Envelope ID
   * @returns Promise<Transaction[]>
   */
  async getTransactionsByEnvelope(userId: string, envelopeId: string): Promise<Transaction[]> {
    try {
      logger.log(`📊 BudgetService.getTransactionsByEnvelope: Fetching for user ${userId}, envelope ${envelopeId}`);
      
      const collectionRef = collection(db, 'users', userId, 'transactions');
      const q = query(
        collectionRef, 
        where('envelopeId', '==', envelopeId),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      const transactions = snapshot.docs
        .map(doc => {
          const firebaseTx = { id: doc.id, ...doc.data() } as any;
          return fromFirestore(firebaseTx);
        })
        .filter(tx => !tx.deletedAt); // Filter out soft-deleted transactions
      
      logger.log(`📋 Fetched ${transactions.length} transactions for envelope ${envelopeId}`);
      return transactions;
    } catch (error) {
      logger.warn(`❌ BudgetService.getTransactionsByEnvelope failed: ${error}`);
      throw new Error(`Failed to fetch transactions for envelope ${envelopeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new envelope
   * @param envelope - Envelope object without id
   * @returns Promise<Envelope> - Created envelope with Firebase ID
   */
  async createEnvelope(envelope: Omit<Envelope, 'id'> & { userId: string }): Promise<Envelope> {
    try {
      logger.log('📡 BudgetService.createEnvelope called for user:', envelope.userId);
      
      const collectionRef = collection(db, 'users', envelope.userId, 'envelopes');
      const docRef = doc(collectionRef);
      const now = Timestamp.now();
      
      const newEnvelopeData = {
        ...envelope,
        createdAt: now,
        lastUpdated: now
      };

      // Optimistic write - do not await
      setDoc(docRef, newEnvelopeData).catch(err => logger.warn(`Create env failed: ${err}`));
      
      const createdEnvelope: Envelope = {
        ...envelope,
        id: docRef.id,
        createdAt: toISOString(now),
        lastUpdated: toISOString(now)
      };
      
      logger.log('✅ Created envelope (optimistic):', createdEnvelope.id);
      return createdEnvelope;
    } catch (error) {
      logger.warn(`❌ BudgetService.createEnvelope failed: ${error}`);
      throw new Error(`Failed to create envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing envelope
   * @param userId - User ID
   * @param envelope - Envelope object with id
   * @returns Promise<void>
   */
  async updateEnvelope(userId: string, envelope: Envelope): Promise<void> {
    try {
      logger.log('📡 BudgetService.updateEnvelope called for envelope:', envelope.id);
      
      const docRef = doc(db, 'users', userId, 'envelopes', envelope.id);
      
      // Optimistic update - do not await
      setDoc(docRef, {
        ...envelope,
        lastUpdated: Timestamp.now()
      }, { merge: true }).catch(err => logger.warn(`Update env failed: ${err}`));
      
      logger.log('✅ Updated envelope (optimistic):', envelope.id);
    } catch (error) {
      logger.warn(`❌ BudgetService.updateEnvelope failed: ${error}`);
      throw new Error(`Failed to update envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an envelope
   * @param userId - User ID
   * @param envelopeId - Envelope ID to delete
   * @returns Promise<void>
   */
  async deleteEnvelope(userId: string, envelopeId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      
      // Soft-delete: Set deletedAt timestamp instead of hard-deleting
      await updateDoc(docRef, {
        deletedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
      
      logger.log('✅ Soft-deleted envelope (set deletedAt):', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteEnvelope failed: ${error}`);
      throw new Error(`Failed to delete envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore a soft-deleted envelope
   * @param userId - User ID
   * @param envelopeId - Envelope ID to restore
   * @returns Promise<void>
   */
  async restoreEnvelope(userId: string, envelopeId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      
      // Remove deletedAt to restore
      await updateDoc(docRef, {
        deletedAt: deleteField(),
        lastUpdated: new Date().toISOString()
      });
      
      logger.log('✅ Restored envelope (removed deletedAt):', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.restoreEnvelope failed: ${error}`);
      throw new Error(`Failed to restore envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete an envelope and all its transactions
   * @param userId - User ID
   * @param envelopeId - Envelope ID to permanently delete
   * @returns Promise<void>
   */
  async permanentlyDeleteEnvelope(userId: string, envelopeId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      
      // Delete all transactions associated with this envelope
      const transactionsQuery = query(
        collection(db, 'users', userId, 'transactions'),
        where('envelopeId', '==', envelopeId)
      );
      
      const transactionSnapshot = await getDocs(transactionsQuery);
      const deletePromises = transactionSnapshot.docs.map(doc => deleteDoc(doc.ref));
      
      // Delete the envelope and all its transactions
      await Promise.all([
        deleteDoc(docRef),
        ...deletePromises
      ]);
      
      logger.log('✅ Permanently deleted envelope and associated transactions from Firestore:', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.permanentlyDeleteEnvelope failed: ${error}`);
      throw new Error(`Failed to permanently delete envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reorder envelopes by updating their orderIndex
   * @param userId - User ID
   * @param envelopes - Array of envelopes with updated orderIndex
   * @returns Promise<void>
   */
  async reorderEnvelopes(userId: string, envelopes: Envelope[]): Promise<void> {
    try {
      logger.log('📡 BudgetService.reorderEnvelopes called for user:', userId);
      
      const updatePromises = envelopes.map(envelope => {
        const docRef = doc(db, 'users', userId, 'envelopes', envelope.id);
        return setDoc(docRef, {
          orderIndex: envelope.orderIndex,
          lastUpdated: Timestamp.now()
        }, { merge: true });
      });
      
      // Optimistic batch update - do not await
      Promise.all(updatePromises).catch(err => logger.warn(`Reorder env failed: ${err}`));
      logger.log('✅ Reordered envelopes (optimistic)');
    } catch (error) {
      logger.warn(`❌ BudgetService.reorderEnvelopes failed: ${error}`);
      throw new Error(`Failed to reorder envelopes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new transaction
   * @param transaction - Transaction object without id
   * @returns Promise<Transaction> - Created transaction with Firebase ID
   */
  async createTransaction(transaction: Omit<Transaction, 'id'> & { userId: string }): Promise<Transaction> {
    try {
      logger.log('📡 BudgetService.createTransaction called for user:', transaction.userId);
      
      const collectionRef = collection(db, 'users', transaction.userId, 'transactions');
      const docRef = doc(collectionRef);
      const now = Timestamp.now();

      // Sanitize nested paymentMethod object
      if (transaction.paymentMethod) {
        const cleanPaymentMethod = { ...transaction.paymentMethod };
        if (cleanPaymentMethod.last4 === undefined) {
          delete cleanPaymentMethod.last4;
        }
        transaction.paymentMethod = cleanPaymentMethod;
      }

      // Filter out undefined fields
      const cleanTransaction = Object.fromEntries(
        Object.entries(transaction).filter(([_key, value]) => value !== undefined)
      );

      const newTransactionData = {
        ...cleanTransaction,
        createdAt: now
      };

      // Wait for Firestore write to complete
      await setDoc(docRef, newTransactionData);
      
      const createdTransaction: Transaction = {
        ...transaction,
        id: docRef.id
      };
      
      logger.log('✅ Created transaction:', createdTransaction.id);
      return createdTransaction;
    } catch (error) {
      logger.warn(`❌ BudgetService.createTransaction failed: ${error}`);
      throw new Error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing transaction
   * @param userId - User ID
   * @param transaction - Transaction object with id
   * @returns Promise<void>
   */
  async updateTransaction(userId: string, transaction: Transaction): Promise<void> {
    try {
      logger.log('📡 BudgetService.updateTransaction called for transaction:', transaction.id);
      
      // Sanitize nested paymentMethod object
      if (transaction.paymentMethod) {
        const cleanPaymentMethod = { ...transaction.paymentMethod };
        if (cleanPaymentMethod.last4 === undefined) {
          delete cleanPaymentMethod.last4;
        }
        transaction.paymentMethod = cleanPaymentMethod;
      }

      // Filter out undefined fields to avoid Firestore errors
      const cleanTransaction = Object.fromEntries(
        Object.entries(transaction).filter(([_key, value]) => value !== undefined)
      );
      
      const docRef = doc(db, 'users', userId, 'transactions', transaction.id);
      
      // Optimistic update - do not await
      setDoc(docRef, cleanTransaction, { merge: true }).catch(err => logger.warn(`Update tx failed: ${err}`));
      
      logger.log('✅ Updated transaction (optimistic):', transaction.id);
    } catch (error) {
      logger.warn(`❌ BudgetService.updateTransaction failed: ${error}`);
      throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a transaction
   * @param userId - User ID
   * @param transactionId - Transaction ID to delete
   * @returns Promise<void>
   */
  async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    try {
      logger.log('📡 BudgetService.deleteTransaction called for transaction:', transactionId);
      
      const docRef = doc(db, 'users', userId, 'transactions', transactionId);
      
      // Soft-delete: Set deletedAt timestamp instead of hard-deleting
      updateDoc(docRef, {
        deletedAt: new Date().toISOString()
      }).catch(err => logger.warn(`Soft-delete tx failed: ${err}`));
      
      logger.log('✅ Soft-deleted transaction:', transactionId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteTransaction failed: ${error}`);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore a soft-deleted transaction
   */
  async restoreTransaction(userId: string, transactionId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'transactions', transactionId);
      
      await updateDoc(docRef, {
        deletedAt: deleteField()
      });
      
      logger.log('✅ Restored transaction (removed deletedAt):', transactionId);
    } catch (error) {
      logger.warn(`❌ BudgetService.restoreTransaction failed: ${error}`);
      throw new Error(`Failed to restore transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all soft-deleted transactions for a user in a given month
   */
  async getDeletedTransactions(userId: string, month: string): Promise<Transaction[]> {
    try {
      logger.log(`📡 BudgetService.getDeletedTransactions: Fetching for user ${userId}, month ${month}`);
      
      const collectionRef = collection(db, 'users', userId, 'transactions');
      const q = query(collectionRef, where('month', '==', month));
      const snapshot = await getDocs(q);
      
      const deletedTransactions: Transaction[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.deletedAt) {
          deletedTransactions.push({ id: docSnap.id, ...data } as Transaction);
        }
      });
      
      // Sort by deletedAt descending (most recent first)
      deletedTransactions.sort((a, b) => 
        new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()
      );
      
      logger.log(`📊 Fetched ${deletedTransactions.length} deleted transactions for ${month}`);
      return deletedTransactions;
    } catch (error) {
      logger.warn(`❌ BudgetService.getDeletedTransactions failed: ${error}`);
      throw new Error(`Failed to fetch deleted transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Permanently delete a transaction from Firestore
   */
  async permanentlyDeleteTransaction(userId: string, transactionId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'transactions', transactionId);
      await deleteDoc(docRef);
      
      logger.log('✅ Permanently deleted transaction:', transactionId);
    } catch (error) {
      logger.warn(`❌ BudgetService.permanentlyDeleteTransaction failed: ${error}`);
      throw new Error(`Failed to permanently delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Income Source CRUD (Embedded) ===

  async createIncomeSource(source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }): Promise<IncomeSource> {
    try {
      logger.log('📡 BudgetService.createIncomeSource (Embedded) called for user:', source.userId);
      const docRef = doc(db, 'users', source.userId, 'monthlyBudgets', source.month);
      const now = Timestamp.now();
      
      // Generate ID client-side
      const newId = `inc_${now.toMillis()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const newSourceData = {
        ...source,
        id: newId,
        amount: Number(source.amount),
        createdAt: now,
        updatedAt: now
      };

      // Optimistic update - do not await
      updateDoc(docRef, {
        incomeSources: arrayUnion(newSourceData),
        updatedAt: now
      }).catch(err => {
        // If document doesn't exist, create it
        if (err.code === 'not-found') {
          setDoc(docRef, {
            id: `${source.userId}_${source.month}`,
            userId: source.userId,
            month: source.month,
            createdAt: now,
            updatedAt: now,
            incomeSources: [newSourceData],
            allocations: {},
            totalIncome: 0,
            availableToBudget: 0
          }).catch(e => logger.warn(`Failed to create monthly budget doc: ${e}`));
        } else {
          logger.warn(`Create income failed: ${err}`);
        }
      });
      
      const newSource = {
        ...source,
        id: newId,
        amount: Number(source.amount),
        createdAt: toISOString(now),
        updatedAt: toISOString(now)
      };
      logger.log('✅ Created income source (optimistic/embedded):', newSource.id);
      return newSource;
    } catch (error) {
      logger.warn(`❌ BudgetService.createIncomeSource failed: ${error}`);
      throw new Error(`Failed to create income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateIncomeSource(userId: string, sourceId: string, month: string, updates: Partial<IncomeSource>): Promise<void> {
    try {
      logger.log('📡 BudgetService.updateIncomeSource (Embedded) called for source:', sourceId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      // Read-modify-write pattern for array update
      getDoc(docRef).then((snap: any) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const sources = data.incomeSources || [];
        const updatedSources = sources.map((s: any) => {
          if (s.id === sourceId) {
            // Merge updates, ensuring amounts are numbers if present
            const merged = { ...s, ...updates, updatedAt: Timestamp.now() };
            if (updates.amount !== undefined) merged.amount = Number(updates.amount);
            return merged;
          }
          return s;
        });
        
        updateDoc(docRef, { 
          incomeSources: updatedSources,
          updatedAt: Timestamp.now()
        });
      }).catch((err: any) => logger.warn(`Update income failed: ${err}`));

      logger.log('✅ Updated income source (optimistic/embedded):', sourceId);
    } catch (error) {
      logger.warn(`❌ BudgetService.updateIncomeSource failed: ${error}`);
      throw error;
    }
  }

  async deleteIncomeSource(userId: string, sourceId: string, month: string): Promise<void> {
    try {
      logger.log('📡 BudgetService.deleteIncomeSource (Embedded) called for source:', sourceId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      // Soft-delete: Set deletedAt timestamp on the income source
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      
      const data = snap.data();
      const sources = data.incomeSources || [];
      const updatedSources = sources.map((s: any) => 
        s.id === sourceId 
          ? { ...s, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : s
      );
      
      await updateDoc(docRef, { 
        incomeSources: updatedSources,
        updatedAt: Timestamp.now()
      });

      logger.log('✅ Soft-deleted income source (set deletedAt):', sourceId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteIncomeSource failed: ${error}`);
      throw new Error(`Failed to delete income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restoreIncomeSource(userId: string, sourceId: string, month: string): Promise<void> {
    try {
      logger.log('📡 BudgetService.restoreIncomeSource (Embedded) called for source:', sourceId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      
      const data = snap.data();
      const sources = data.incomeSources || [];
      const updatedSources = sources.map((s: any) => {
        if (s.id === sourceId) {
          const { deletedAt, ...rest } = s;
          return { ...rest, updatedAt: new Date().toISOString() };
        }
        return s;
      });
      
      await updateDoc(docRef, { 
        incomeSources: updatedSources,
        updatedAt: Timestamp.now()
      });

      logger.log('✅ Restored income source (removed deletedAt):', sourceId);
    } catch (error) {
      logger.warn(`❌ BudgetService.restoreIncomeSource failed: ${error}`);
      throw new Error(`Failed to restore income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async permanentlyDeleteIncomeSource(userId: string, sourceId: string, month: string): Promise<void> {
    try {
      logger.log('📡 BudgetService.permanentlyDeleteIncomeSource (Embedded) called for source:', sourceId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      
      const data = snap.data();
      const sources = data.incomeSources || [];
      const updatedSources = sources.filter((s: any) => s.id !== sourceId);
      
      await updateDoc(docRef, { 
        incomeSources: updatedSources,
        updatedAt: Timestamp.now()
      });

      logger.log('✅ Permanently deleted income source:', sourceId);
    } catch (error) {
      logger.warn(`❌ BudgetService.permanentlyDeleteIncomeSource failed: ${error}`);
      throw new Error(`Failed to permanently delete income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Envelope Allocation CRUD (Embedded) ===

  async createEnvelopeAllocation(allocation: Omit<EnvelopeAllocation, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }): Promise<EnvelopeAllocation> {
    try {
      logger.log('📡 BudgetService.createEnvelopeAllocation (Embedded) called for user:', allocation.userId);
      const docRef = doc(db, 'users', allocation.userId, 'monthlyBudgets', allocation.month);
      const now = Timestamp.now();
      
      const updateData = {
        [`allocations.${allocation.envelopeId}`]: Number(allocation.budgetedAmount),
        updatedAt: now
      };

      // Optimistic update
      updateDoc(docRef, updateData).catch(err => {
        if (err.code === 'not-found') {
          setDoc(docRef, {
            id: `${allocation.userId}_${allocation.month}`,
            userId: allocation.userId,
            month: allocation.month,
            createdAt: now,
            updatedAt: now,
            incomeSources: [],
            allocations: { [allocation.envelopeId]: Number(allocation.budgetedAmount) },
            totalIncome: 0,
            availableToBudget: 0
          }).catch(e => logger.warn(`Failed to create monthly budget doc: ${e}`));
        } else {
          logger.warn(`Create allocation failed: ${err}`);
        }
      });
      
      const newAllocation = {
        ...allocation,
        id: allocation.envelopeId,
        createdAt: toISOString(now),
        updatedAt: toISOString(now)
      };
      logger.log('✅ Created allocation (optimistic/embedded):', newAllocation.id);
      return newAllocation;
    } catch (error) {
      logger.warn(`❌ BudgetService.createEnvelopeAllocation failed: ${error}`);
      throw new Error(`Failed to create envelope allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateEnvelopeAllocation(userId: string, envelopeId: string, month: string, updates: Partial<EnvelopeAllocation>): Promise<void> {
    try {
      logger.log('📡 BudgetService.updateEnvelopeAllocation (Embedded) called for envelope:', envelopeId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (updates.budgetedAmount !== undefined) {
        updateData[`allocations.${envelopeId}`] = Number(updates.budgetedAmount);
      }

      // Optimistic update
      updateDoc(docRef, updateData).catch(err => logger.warn(`Update allocation failed: ${err}`));
      logger.log('✅ Updated allocation (optimistic/embedded):', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.updateEnvelopeAllocation failed: ${error}`);
      throw new Error(`Failed to update envelope allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteEnvelopeAllocation(userId: string, envelopeId: string, month: string): Promise<void> {
    try {
      logger.log('📡 BudgetService.deleteEnvelopeAllocation (Embedded) called for envelope:', envelopeId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      // Optimistic delete using deleteField
      updateDoc(docRef, {
        [`allocations.${envelopeId}`]: deleteField(),
        updatedAt: Timestamp.now()
      }).catch(err => logger.warn(`Delete allocation failed: ${err}`));
      
      logger.log('✅ Deleted allocation (optimistic/embedded):', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteEnvelopeAllocation failed: ${error}`);
      throw new Error(`Failed to delete envelope allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch month-specific data (income sources and allocations)
   * @param userId - User ID to fetch data for
   * @param monthStr - Month string in "YYYY-MM" format
   * @returns Promise<{ incomeSources: IncomeSource[], allocations: EnvelopeAllocation[] }>
   */
  async getMonthData(userId: string, monthStr: string): Promise<{
    incomeSources: IncomeSource[];
    allocations: EnvelopeAllocation[];
  }> {
    try {
      logger.log(`📅 BudgetService.getMonthData (Embedded): Fetching for user ${userId}, month ${monthStr}`);
      
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', monthStr);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        logger.log(`ℹ️ No budget data found for ${monthStr}, returning empty defaults.`);
        return { incomeSources: [], allocations: [] };
      }

      const data = snap.data();
      
      // Parse Income Sources (Embedded Array) and filter out soft-deleted
      const incomeSources = (data.incomeSources || [])
        .filter((source: any) => !source.deletedAt) // Filter out soft-deleted
        .map((source: any) => ({
          ...source,
          amount: Number(source.amount), // Ensure number
          createdAt: source.createdAt?.toDate ? source.createdAt.toDate().toISOString() : (source.createdAt || new Date().toISOString()),
          updatedAt: source.updatedAt?.toDate ? source.updatedAt.toDate().toISOString() : (source.updatedAt || new Date().toISOString()),
        })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse Allocations (Embedded Map: envelopeId -> amount)
      const allocationsMap = data.allocations || {};
      const allocations = Object.entries(allocationsMap).map(([envelopeId, amount]) => ({
        id: envelopeId, // Use envelopeId as allocation ID
        userId,
        envelopeId,
        month: monthStr,
        budgetedAmount: Number(amount),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), // Fallback to doc creation time
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      logger.log(`📊 Fetched ${incomeSources.length} income sources and ${allocations.length} allocations for ${monthStr}`);
      
      return {
        incomeSources,
        allocations
      };
    } catch (error) {
      logger.warn(`❌ BudgetService.getMonthData failed: ${error}`);
      throw new Error(`Failed to fetch month data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clean up orphaned data (allocations and transactions pointing to deleted envelopes)
   * @param userId - User ID to clean up data for
   * @returns Promise<CleanupReport> - Report of what was cleaned up
   */
  async cleanupOrphanedData(userId: string): Promise<CleanupReport> {
    try {
      logger.log('🧹 BudgetService.cleanupOrphanedData: Starting cleanup for user:', userId);
      
      const report: CleanupReport = {
        orphanedAllocationsDeleted: 0,
        orphanedTransactionsDeleted: 0,
        details: {
          deletedAllocationIds: [],
          deletedTransactionIds: [],
          monthsProcessed: []
        }
      };

      // Step 1: Get all existing envelopes
      const envelopes = await this.getEnvelopes(userId);
      const envelopeIds = new Set(envelopes.map(env => env.id));
      logger.log(`📋 Found ${envelopes.length} existing envelopes`);

      // Step 2: Get all allocations across all months and clean orphaned ones
      const allocationsCollection = collection(db, 'users', userId, 'envelopeAllocations');
      const allAllocationsSnapshot = await getDocs(allocationsCollection);
      
      const orphanedAllocations: string[] = [];
      const monthsProcessed = new Set<string>();

      for (const doc of allAllocationsSnapshot.docs) {
        const allocation = doc.data() as EnvelopeAllocation;
        monthsProcessed.add(allocation.month);
        
        // Check if the envelope still exists
        if (!envelopeIds.has(allocation.envelopeId)) {
          orphanedAllocations.push(doc.id);
          logger.log(`🗑️ Found orphaned allocation: ${doc.id} for envelope ${allocation.envelopeId} in month ${allocation.month}`);
        }
      }

      // Delete orphaned allocations (Legacy Collection)
      if (orphanedAllocations.length > 0) {
        const deletePromises = orphanedAllocations.map(allocationId => 
          deleteDoc(doc(db, 'users', userId, 'envelopeAllocations', allocationId))
        );
        await Promise.all(deletePromises);
        report.orphanedAllocationsDeleted += orphanedAllocations.length;
        report.details.deletedAllocationIds.push(...orphanedAllocations);
        logger.log(`🗑️ Deleted ${orphanedAllocations.length} orphaned allocations (legacy)`);
      }

      // Step 2b: Clean up embedded allocations in monthlyBudgets
      const monthlyBudgetsCollection = collection(db, 'users', userId, 'monthlyBudgets');
      const monthlyBudgetsSnapshot = await getDocs(monthlyBudgetsCollection);
      
      for (const docSnap of monthlyBudgetsSnapshot.docs) {
        const data = docSnap.data();
        const allocations = data.allocations || {};
        const updates: any = {};
        let hasUpdates = false;
        
        Object.keys(allocations).forEach(envelopeId => {
          if (!envelopeIds.has(envelopeId)) {
             updates[`allocations.${envelopeId}`] = deleteField();
             hasUpdates = true;
             logger.log(`🗑️ Found orphaned embedded allocation in ${docSnap.id} for envelope ${envelopeId}`);
             report.orphanedAllocationsDeleted++;
             report.details.deletedAllocationIds.push(`${docSnap.id}_${envelopeId}`);
          }
        });
        
        if (hasUpdates) {
          updates.updatedAt = Timestamp.now();
          await updateDoc(docSnap.ref, updates);
          monthsProcessed.add(docSnap.id);
        }
      }

      // Step 3: Get all transactions and clean orphaned ones
      const transactions = await this.getTransactions(userId);
      const orphanedTransactions: string[] = [];

      for (const transaction of transactions) {
        // Check if the envelope still exists
        if (!envelopeIds.has(transaction.envelopeId)) {
          orphanedTransactions.push(transaction.id);
          logger.log(`🗑️ Found orphaned transaction: ${transaction.id} for envelope ${transaction.envelopeId}`);
        }
      }

      // Delete orphaned transactions
      if (orphanedTransactions.length > 0) {
        const deletePromises = orphanedTransactions.map(transactionId => 
          deleteDoc(doc(db, 'users', userId, 'transactions', transactionId))
        );
        await Promise.all(deletePromises);
        report.orphanedTransactionsDeleted = orphanedTransactions.length;
        report.details.deletedTransactionIds = orphanedTransactions;
        logger.log(`🗑️ Deleted ${orphanedTransactions.length} orphaned transactions`);
      }

      report.details.monthsProcessed = Array.from(monthsProcessed);
      
      logger.log('✅ Cleanup completed:', {
        orphanedAllocationsDeleted: report.orphanedAllocationsDeleted,
        orphanedTransactionsDeleted: report.orphanedTransactionsDeleted,
        monthsProcessed: report.details.monthsProcessed.length
      });

      return report;
    } catch (error) {
      logger.warn(`❌ BudgetService.cleanupOrphanedData failed: ${error}`);
      throw new Error(`Failed to cleanup orphaned data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Real-time Subscriptions ===

  subscribeToMonthlyBudget(userId: string, month: string, callback: (data: { incomeSources: IncomeSource[], allocations: EnvelopeAllocation[] }) => void): Unsubscribe {
    const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);

    return onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) {
        callback({ incomeSources: [], allocations: [] });
        return;
      }

      const data = docSnap.data();
      
      // Parse Income Sources (Embedded Array) and filter out soft-deleted
      const incomeSources = (data.incomeSources || [])
        .filter((source: any) => !source.deletedAt)
        .map((source: any) => ({
          ...source,
          amount: Number(source.amount), // Ensure number
          createdAt: source.createdAt?.toDate ? source.createdAt.toDate().toISOString() : (source.createdAt || new Date().toISOString()),
          updatedAt: source.updatedAt?.toDate ? source.updatedAt.toDate().toISOString() : (source.updatedAt || new Date().toISOString()),
        })).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Parse Allocations (Embedded Map: envelopeId -> amount)
      const allocationsMap = data.allocations || {};
      const allocations = Object.entries(allocationsMap).map(([envelopeId, amount]) => ({
        id: envelopeId, // Use envelopeId as allocation ID
        userId,
        envelopeId,
        month,
        budgetedAmount: Number(amount),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), // Fallback to doc creation time
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
      })).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      callback({ incomeSources, allocations });
    });
  }

  /**
   * Fetch deleted income sources for a specific month (for Recently Deleted view)
   * @param userId - User ID
   * @param monthStr - Month string in "YYYY-MM" format
   * @returns Promise<IncomeSource[]> - Array of soft-deleted income sources
   */
  async getDeletedIncomeSources(userId: string, monthStr: string): Promise<IncomeSource[]> {
    try {
      logger.log(`📅 BudgetService.getDeletedIncomeSources: Fetching for user ${userId}, month ${monthStr}`);
      
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', monthStr);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        return [];
      }

      const data = snap.data();
      
      // Parse and filter for deleted income sources only
      const deletedSources = (data.incomeSources || [])
        .filter((source: any) => source.deletedAt) // Only soft-deleted
        .map((source: any) => ({
          ...source,
          amount: Number(source.amount),
          createdAt: source.createdAt?.toDate ? source.createdAt.toDate().toISOString() : (source.createdAt || new Date().toISOString()),
          updatedAt: source.updatedAt?.toDate ? source.updatedAt.toDate().toISOString() : (source.updatedAt || new Date().toISOString()),
          deletedAt: source.deletedAt
        })).sort((a: any, b: any) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()); // Most recent first

      logger.log(`📊 Fetched ${deletedSources.length} deleted income sources for ${monthStr}`);
      return deletedSources;
    } catch (error) {
      logger.warn(`❌ BudgetService.getDeletedIncomeSources failed: ${error}`);
      throw new Error(`Failed to fetch deleted income sources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Purge soft-deleted items older than the retention period (30 days)
   * Called during init to prevent indefinite accumulation of deleted data
   * @param userId - User ID to clean up for
   */
  async purgeExpiredSoftDeletes(userId: string): Promise<void> {
    try {
      const RETENTION_DAYS = 30;
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      let purged = 0;

      // 1. Purge expired soft-deleted envelopes
      const envelopesRef = collection(db, 'users', userId, 'envelopes');
      const envelopeSnap = await getDocs(envelopesRef);
      for (const docSnap of envelopeSnap.docs) {
        const data = docSnap.data();
        if (data.deletedAt && data.deletedAt < cutoff) {
          // Also delete associated transactions
          const txQuery = query(
            collection(db, 'users', userId, 'transactions'),
            where('envelopeId', '==', docSnap.id)
          );
          const txSnap = await getDocs(txQuery);
          await Promise.all(txSnap.docs.map(tx => deleteDoc(tx.ref)));
          await deleteDoc(docSnap.ref);
          purged++;
        }
      }

      // 2. Purge expired soft-deleted transactions
      const txRef = collection(db, 'users', userId, 'transactions');
      const txSnap = await getDocs(txRef);
      for (const docSnap of txSnap.docs) {
        const data = docSnap.data();
        if (data.deletedAt && data.deletedAt < cutoff) {
          await deleteDoc(docSnap.ref);
          purged++;
        }
      }

      // 3. Purge expired soft-deleted income sources (embedded in monthlyBudgets)
      const monthlyRef = collection(db, 'users', userId, 'monthlyBudgets');
      const monthlySnap = await getDocs(monthlyRef);
      for (const docSnap of monthlySnap.docs) {
        const data = docSnap.data();
        const sources = data.incomeSources || [];
        const filtered = sources.filter((s: any) => !s.deletedAt || s.deletedAt >= cutoff);
        if (filtered.length < sources.length) {
          await updateDoc(docSnap.ref, { incomeSources: filtered, updatedAt: Timestamp.now() });
          purged += sources.length - filtered.length;
        }
      }

      if (purged > 0) {
        logger.log(`🧹 Purged ${purged} expired soft-deleted items (>${RETENTION_DAYS} days old)`);
      }
    } catch (error) {
      // Non-critical — log but don't throw
      logger.warn(`⚠️ Soft-delete purge failed (non-critical): ${error}`);
    }
  }

  /**
   * Permanently delete ALL data for a user
   * @param userId - User ID to delete data for
   */
  async deleteAllUserData(userId: string): Promise<void> {
    try {
      logger.log('🔥 BudgetService.deleteAllUserData: STARTING DELETION for user:', userId);

      // Legacy collections (incomeSources, envelopeAllocations) included for migration cleanup
      const collections = [
        'envelopes',
        'transactions',
        'categories',
        'incomeSources',        // Legacy — now embedded in monthlyBudgets
        'envelopeAllocations',  // Legacy — now embedded in monthlyBudgets
        'monthlyBudgets',
        'appSettings'
      ];

      for (const collectionName of collections) {
        logger.log(`🗑️ Deleting collection: ${collectionName}...`);
        const collectionRef = collection(db, 'users', userId, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
          logger.log(`   (Empty collection)`);
          continue;
        }

        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        logger.log(`   ✅ Deleted ${snapshot.size} documents from ${collectionName}`);
      }

      logger.log('✨ All user data deleted successfully.');
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteAllUserData failed: ${error}`);
      throw new Error(`Failed to delete all user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const budgetService = BudgetService.getInstance();