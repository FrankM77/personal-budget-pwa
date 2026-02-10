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
 * Unified Budget Service Layer
 * Handles all Firestore interactions for the unified BudgetStore
 * Returns clean Domain Objects, hiding Firestore complexity
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

      // 1. Wipe existing data
      await this.deleteAllUserData(userId);

      // 2. Prepare batches for restoration
      const collectionsToRestore: { name: string; data: any[] }[] = [
        { name: 'envelopes', data: backupData.envelopes || [] },
        { name: 'transactions', data: backupData.transactions || [] },
        { name: 'categories', data: backupData.categories || [] },
        { name: 'envelopeAllocations', data: backupData.allocations ? Object.values(backupData.allocations).flat() : [] },
        // Handle monthly budgets with embedded income sources
        { name: 'monthlyBudgets', data: this.prepareMonthlyBudgetsData(backupData.allocations, backupData.incomeSources) },
        // Handle appSettings if present
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
      
      // Sort by orderIndex in memory
      const sortedEnvelopes = envelopes.sort((a, b) => {
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
      
      const transactions = snapshot.docs.map(doc => {
        const firebaseTx = { id: doc.id, ...doc.data() } as any;
        return fromFirestore(firebaseTx);
      });
      
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
      
      const transactions = snapshot.docs.map(doc => {
        const firebaseTx = { id: doc.id, ...doc.data() } as any;
        return fromFirestore(firebaseTx);
      });
      
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
      
      const transactions = snapshot.docs.map(doc => {
        const firebaseTx = { id: doc.id, ...doc.data() } as any;
        return fromFirestore(firebaseTx);
      });
      
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
      
      logger.log('✅ Deleted envelope and associated transactions from Firestore:', envelopeId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteEnvelope failed: ${error}`);
      throw new Error(`Failed to delete envelope: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        Object.entries(transaction).filter(([_, value]) => value !== undefined)
      );

      const newTransactionData = {
        ...cleanTransaction,
        createdAt: now
      };

      // Optimistic write - do not await
      setDoc(docRef, newTransactionData).catch(err => logger.warn(`Create tx failed: ${err}`));
      
      const createdTransaction: Transaction = {
        ...transaction,
        id: docRef.id
      };
      
      logger.log('✅ Created transaction (optimistic):', createdTransaction.id);
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
        Object.entries(transaction).filter(([_, value]) => value !== undefined)
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
      
      // Optimistic delete - do not await
      deleteDoc(docRef).catch(err => logger.warn(`Delete tx failed: ${err}`));
      
      logger.log('✅ Deleted transaction (optimistic):', transactionId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteTransaction failed: ${error}`);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // Read-modify-write pattern for array deletion
      getDoc(docRef).then((snap: any) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const sources = data.incomeSources || [];
        const updatedSources = sources.filter((s: any) => s.id !== sourceId);
        
        updateDoc(docRef, { 
          incomeSources: updatedSources,
          updatedAt: Timestamp.now()
        });
      }).catch((err: any) => logger.warn(`Delete income failed: ${err}`));

      logger.log('✅ Deleted income source (optimistic/embedded):', sourceId);
    } catch (error) {
      logger.warn(`❌ BudgetService.deleteIncomeSource failed: ${error}`);
      throw new Error(`Failed to delete income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      
      // Parse Income Sources (Embedded Array)
      const incomeSources = (data.incomeSources || []).map((source: any) => ({
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
      
      // Parse Income Sources (Embedded Array)
      const incomeSources = (data.incomeSources || []).map((source: any) => ({
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
   * Prepare monthly budgets data for restoration with embedded income sources
   * @param allocations - Budget allocations from backup
   * @param incomeSources - Income sources from backup
   * @returns Array of monthly budget documents
   */
  private prepareMonthlyBudgetsData(allocations: any, incomeSources: any): any[] {
    const monthlyBudgets: any[] = [];
    
    // Get all unique months from allocations and income sources
    const allMonths = new Set<string>();
    
    if (allocations) {
      Object.keys(allocations).forEach(month => allMonths.add(month));
    }
    
    if (incomeSources) {
      Object.keys(incomeSources).forEach(month => allMonths.add(month));
    }
    
    // Create monthly budget documents for each month
    allMonths.forEach(month => {
      const monthAllocations = allocations?.[month] || [];
      const monthIncomeSources = incomeSources?.[month] || [];
      
      // Convert allocations to the format expected by monthlyBudgets
      const allocationsObject: any = {};
      monthAllocations.forEach((alloc: any) => {
        allocationsObject[alloc.envelopeId] = alloc.budgetedAmount;
      });
      
      const monthlyBudget = {
        month,
        userId: '', // Will be set in the restore function
        incomeSources: monthIncomeSources,
        allocations: allocationsObject,
        totalIncome: monthIncomeSources.reduce((sum: number, source: any) => sum + Number(source.amount || 0), 0),
        availableToBudget: monthIncomeSources.reduce((sum: number, source: any) => sum + Number(source.amount || 0), 0) - 
                       monthAllocations.reduce((sum: number, alloc: any) => sum + Number(alloc.budgetedAmount || 0), 0),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      monthlyBudgets.push(monthlyBudget);
    });
    
    return monthlyBudgets;
  }

  /**
   * Permanently delete ALL data for a user
   * @param userId - User ID to delete data for
   */
  async deleteAllUserData(userId: string): Promise<void> {
    try {
      logger.log('🔥 BudgetService.deleteAllUserData: STARTING DELETION for user:', userId);

      const collections = [
        'envelopes',
        'transactions',
        'categories',
        'incomeSources',
        'envelopeAllocations',
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