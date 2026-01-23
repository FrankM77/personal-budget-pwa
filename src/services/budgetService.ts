import { collection, query, orderBy, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, writeBatch, onSnapshot, arrayUnion, getDoc, deleteField } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Envelope, Transaction, IncomeSource, EnvelopeAllocation } from '../models/types';
import { fromFirestore } from '../mappers/transaction';
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
      console.log('🔄 BudgetService.restoreUserData: STARTING RESTORE for user:', userId);

      // 1. Wipe existing data
      await this.deleteAllUserData(userId);

      // 2. Prepare batches for restoration
      const collectionsToRestore: { name: string; data: any[] }[] = [
        { name: 'envelopes', data: backupData.envelopes || [] },
        { name: 'transactions', data: backupData.transactions || [] },
        { name: 'incomeSources', data: backupData.incomeSources ? Object.values(backupData.incomeSources).flat() : [] },
        { name: 'envelopeAllocations', data: backupData.allocations ? Object.values(backupData.allocations).flat() : [] },
        // Handle monthly budgets if present in backup (might need to derive if not)
        // For now, we'll focus on the core arrays. If monthlyBudgets are in backup, use them.
        { name: 'appSettings', data: backupData.appSettings ? [backupData.appSettings] : [] }
      ];

      // Flatten all operations into a single list of { ref, data }
      const operations: { ref: any; data: any }[] = [];

      for (const { name, data } of collectionsToRestore) {
        if (!Array.isArray(data)) continue;

        for (const item of data) {
          if (!item.id) continue; // Skip items without ID

          // Clean up item for Firestore (remove undefined, convert dates if needed)
          // Ideally we'd map these, but for restore we trust the backup structure mostly.
          // We ensure 'userId' is set correctly to the current user.
          const firestoreItem = { ...item, userId };
          
          // Settings special case: usually singleton or specific ID
          const docId = item.id;
          
          const docRef = doc(db, 'users', userId, name, docId);
          operations.push({ ref: docRef, data: firestoreItem });
        }
      }

      console.log(`📦 Prepared ${operations.length} items for restoration.`);

      // 3. Execute Batches (max 500 per batch)
      const BATCH_SIZE = 450; // Safety margin
      for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        
        chunk.forEach(op => {
          batch.set(op.ref, op.data);
        });

        console.log(`🚀 Committing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(operations.length / BATCH_SIZE)}...`);
        await batch.commit();
      }

      console.log('✨ Restore completed successfully.');

    } catch (error) {
      console.error('❌ BudgetService.restoreUserData failed:', error);
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
      console.log('📡 BudgetService.getEnvelopes called for user:', userId);
      
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
      
      console.log('✅ Fetched envelopes:', sortedEnvelopes.length);
      return sortedEnvelopes;
    } catch (error) {
      console.error('❌ BudgetService.getEnvelopes failed:', error);
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
      console.log('📊 BudgetService.getTransactions: Fetching for user', userId);
      
      const collectionRef = collection(db, 'users', userId, 'transactions');
      const q = query(collectionRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      const transactions = snapshot.docs.map(doc => {
        const firebaseTx = { id: doc.id, ...doc.data() } as any;
        return fromFirestore(firebaseTx);
      });
      
      console.log(`📋 Fetched ${transactions.length} transactions`);
      return transactions;
    } catch (error) {
      console.error('❌ BudgetService.getTransactions failed:', error);
      throw new Error(`Failed to fetch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new envelope
   * @param envelope - Envelope object without id
   * @returns Promise<Envelope> - Created envelope with Firebase ID
   */
  async createEnvelope(envelope: Omit<Envelope, 'id'> & { userId: string }): Promise<Envelope> {
    try {
      console.log('📡 BudgetService.createEnvelope called for user:', envelope.userId);
      
      const collectionRef = collection(db, 'users', envelope.userId, 'envelopes');
      const docRef = doc(collectionRef);
      const now = Timestamp.now();
      
      const newEnvelopeData = {
        ...envelope,
        createdAt: now,
        lastUpdated: now
      };

      // Optimistic write - do not await
      setDoc(docRef, newEnvelopeData).catch(err => console.error("Create env failed", err));
      
      const createdEnvelope: Envelope = {
        ...envelope,
        id: docRef.id,
        createdAt: toISOString(now),
        lastUpdated: toISOString(now)
      };
      
      console.log('✅ Created envelope (optimistic):', createdEnvelope.id);
      return createdEnvelope;
    } catch (error) {
      console.error('❌ BudgetService.createEnvelope failed:', error);
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
      console.log('📡 BudgetService.updateEnvelope called for envelope:', envelope.id);
      
      const docRef = doc(db, 'users', userId, 'envelopes', envelope.id);
      
      // Optimistic update - do not await
      setDoc(docRef, {
        ...envelope,
        lastUpdated: Timestamp.now()
      }, { merge: true }).catch(err => console.error("Update env failed", err));
      
      console.log('✅ Updated envelope (optimistic):', envelope.id);
    } catch (error) {
      console.error('❌ BudgetService.updateEnvelope failed:', error);
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
      console.log('📡 BudgetService.deleteEnvelope called for envelope:', envelopeId);
      
      const docRef = doc(db, 'users', userId, 'envelopes', envelopeId);
      
      // Optimistic delete - do not await
      deleteDoc(docRef).catch(err => console.error("Delete env failed", err));
      
      console.log('✅ Deleted envelope (optimistic):', envelopeId);
    } catch (error) {
      console.error('❌ BudgetService.deleteEnvelope failed:', error);
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
      console.log('📡 BudgetService.reorderEnvelopes called for user:', userId);
      
      const updatePromises = envelopes.map(envelope => {
        const docRef = doc(db, 'users', userId, 'envelopes', envelope.id);
        return setDoc(docRef, {
          orderIndex: envelope.orderIndex,
          lastUpdated: Timestamp.now()
        }, { merge: true });
      });
      
      // Optimistic batch update - do not await
      Promise.all(updatePromises).catch(err => console.error("Reorder env failed", err));
      console.log('✅ Reordered envelopes (optimistic)');
    } catch (error) {
      console.error('❌ BudgetService.reorderEnvelopes failed:', error);
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
      console.log('📡 BudgetService.createTransaction called for user:', transaction.userId);
      
      const collectionRef = collection(db, 'users', transaction.userId, 'transactions');
      const docRef = doc(collectionRef);
      const now = Timestamp.now();

      const newTransactionData = {
        ...transaction,
        createdAt: now
      };

      // Optimistic write - do not await
      setDoc(docRef, newTransactionData).catch(err => console.error("Create tx failed", err));
      
      const createdTransaction: Transaction = {
        ...transaction,
        id: docRef.id
      };
      
      console.log('✅ Created transaction (optimistic):', createdTransaction.id);
      return createdTransaction;
    } catch (error) {
      console.error('❌ BudgetService.createTransaction failed:', error);
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
      console.log('📡 BudgetService.updateTransaction called for transaction:', transaction.id);
      
      // Filter out undefined fields to avoid Firestore errors
      const cleanTransaction = Object.fromEntries(
        Object.entries(transaction).filter(([_, value]) => value !== undefined)
      );
      
      const docRef = doc(db, 'users', userId, 'transactions', transaction.id);
      
      // Optimistic update - do not await
      setDoc(docRef, cleanTransaction, { merge: true }).catch(err => console.error("Update tx failed", err));
      
      console.log('✅ Updated transaction (optimistic):', transaction.id);
    } catch (error) {
      console.error('❌ BudgetService.updateTransaction failed:', error);
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
      console.log('📡 BudgetService.deleteTransaction called for transaction:', transactionId);
      
      const docRef = doc(db, 'users', userId, 'transactions', transactionId);
      
      // Optimistic delete - do not await
      deleteDoc(docRef).catch(err => console.error("Delete tx failed", err));
      
      console.log('✅ Deleted transaction (optimistic):', transactionId);
    } catch (error) {
      console.error('❌ BudgetService.deleteTransaction failed:', error);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Income Source CRUD (Embedded) ===

  async createIncomeSource(source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }): Promise<IncomeSource> {
    try {
      console.log('📡 BudgetService.createIncomeSource (Embedded) called for user:', source.userId);
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
          }).catch(e => console.error("Failed to create monthly budget doc", e));
        } else {
          console.error("Create income failed", err);
        }
      });
      
      const newSource = {
        ...source,
        id: newId,
        amount: Number(source.amount),
        createdAt: toISOString(now),
        updatedAt: toISOString(now)
      };
      console.log('✅ Created income source (optimistic/embedded):', newSource.id);
      return newSource;
    } catch (error) {
      console.error('❌ BudgetService.createIncomeSource failed:', error);
      throw new Error(`Failed to create income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateIncomeSource(userId: string, sourceId: string, month: string, updates: Partial<IncomeSource>): Promise<void> {
    try {
      console.log('📡 BudgetService.updateIncomeSource (Embedded) called for source:', sourceId);
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
      }).catch((err: any) => console.error("Update income failed", err));

      console.log('✅ Updated income source (optimistic/embedded):', sourceId);
    } catch (error) {
      console.error('❌ BudgetService.updateIncomeSource failed:', error);
      throw error;
    }
  }

  async deleteIncomeSource(userId: string, sourceId: string, month: string): Promise<void> {
    try {
      console.log('📡 BudgetService.deleteIncomeSource (Embedded) called for source:', sourceId);
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
      }).catch((err: any) => console.error("Delete income failed", err));

      console.log('✅ Deleted income source (optimistic/embedded):', sourceId);
    } catch (error) {
      console.error('❌ BudgetService.deleteIncomeSource failed:', error);
      throw new Error(`Failed to delete income source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === Envelope Allocation CRUD (Embedded) ===

  async createEnvelopeAllocation(allocation: Omit<EnvelopeAllocation, 'id' | 'createdAt' | 'updatedAt'> & { userId: string }): Promise<EnvelopeAllocation> {
    try {
      console.log('📡 BudgetService.createEnvelopeAllocation (Embedded) called for user:', allocation.userId);
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
          }).catch(e => console.error("Failed to create monthly budget doc", e));
        } else {
          console.error("Create allocation failed", err);
        }
      });
      
      const newAllocation = {
        ...allocation,
        id: allocation.envelopeId,
        createdAt: toISOString(now),
        updatedAt: toISOString(now)
      };
      console.log('✅ Created allocation (optimistic/embedded):', newAllocation.id);
      return newAllocation;
    } catch (error) {
      console.error('❌ BudgetService.createEnvelopeAllocation failed:', error);
      throw new Error(`Failed to create envelope allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateEnvelopeAllocation(userId: string, envelopeId: string, month: string, updates: Partial<EnvelopeAllocation>): Promise<void> {
    try {
      console.log('📡 BudgetService.updateEnvelopeAllocation (Embedded) called for envelope:', envelopeId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (updates.budgetedAmount !== undefined) {
        updateData[`allocations.${envelopeId}`] = Number(updates.budgetedAmount);
      }

      // Optimistic update
      updateDoc(docRef, updateData).catch(err => console.error("Update allocation failed", err));
      console.log('✅ Updated allocation (optimistic/embedded):', envelopeId);
    } catch (error) {
      console.error('❌ BudgetService.updateEnvelopeAllocation failed:', error);
      throw new Error(`Failed to update envelope allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteEnvelopeAllocation(userId: string, envelopeId: string, month: string): Promise<void> {
    try {
      console.log('📡 BudgetService.deleteEnvelopeAllocation (Embedded) called for envelope:', envelopeId);
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      // Optimistic delete using deleteField
      updateDoc(docRef, {
        [`allocations.${envelopeId}`]: deleteField(),
        updatedAt: Timestamp.now()
      }).catch(err => console.error("Delete allocation failed", err));
      
      console.log('✅ Deleted allocation (optimistic/embedded):', envelopeId);
    } catch (error) {
      console.error('❌ BudgetService.deleteEnvelopeAllocation failed:', error);
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
      console.log(`📅 BudgetService.getMonthData (Embedded): Fetching for user ${userId}, month ${monthStr}`);
      
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', monthStr);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        console.log(`ℹ️ No budget data found for ${monthStr}, returning empty defaults.`);
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

      console.log(`📊 Fetched ${incomeSources.length} income sources and ${allocations.length} allocations for ${monthStr}`);
      
      return {
        incomeSources,
        allocations
      };
    } catch (error) {
      console.error('❌ BudgetService.getMonthData failed:', error);
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
      console.log('🧹 BudgetService.cleanupOrphanedData: Starting cleanup for user:', userId);
      
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
      console.log(`📋 Found ${envelopes.length} existing envelopes`);

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
          console.log(`🗑️ Found orphaned allocation: ${doc.id} for envelope ${allocation.envelopeId} in month ${allocation.month}`);
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
        console.log(`🗑️ Deleted ${orphanedAllocations.length} orphaned allocations (legacy)`);
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
             console.log(`🗑️ Found orphaned embedded allocation in ${docSnap.id} for envelope ${envelopeId}`);
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
          console.log(`🗑️ Found orphaned transaction: ${transaction.id} for envelope ${transaction.envelopeId}`);
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
        console.log(`🗑️ Deleted ${orphanedTransactions.length} orphaned transactions`);
      }

      report.details.monthsProcessed = Array.from(monthsProcessed);
      
      console.log('✅ Cleanup completed:', {
        orphanedAllocationsDeleted: report.orphanedAllocationsDeleted,
        orphanedTransactionsDeleted: report.orphanedTransactionsDeleted,
        monthsProcessed: report.details.monthsProcessed.length
      });

      return report;
    } catch (error) {
      console.error('❌ BudgetService.cleanupOrphanedData failed:', error);
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
   * Permanently delete ALL data for a user
   * @param userId - User ID to delete data for
   */
  async deleteAllUserData(userId: string): Promise<void> {
    try {
      console.log('🔥 BudgetService.deleteAllUserData: STARTING DELETION for user:', userId);

      const collections = [
        'envelopes',
        'transactions',
        'incomeSources',
        'envelopeAllocations',
        'monthlyBudgets',
        'appSettings'
      ];

      for (const collectionName of collections) {
        console.log(`🗑️ Deleting collection: ${collectionName}...`);
        const collectionRef = collection(db, 'users', userId, collectionName);
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
          console.log(`   (Empty collection)`);
          continue;
        }

        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log(`   ✅ Deleted ${snapshot.size} documents from ${collectionName}`);
      }

      console.log('✨ All user data deleted successfully.');
    } catch (error) {
      console.error('❌ BudgetService.deleteAllUserData failed:', error);
      throw new Error(`Failed to delete all user data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const budgetService = BudgetService.getInstance();