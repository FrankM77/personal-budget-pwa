import { collection, query, orderBy, where, getDocs, addDoc, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
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
      const docRef = await addDoc(collectionRef, {
        ...envelope,
        createdAt: Timestamp.now(),
        lastUpdated: Timestamp.now()
      });
      
      const createdEnvelope: Envelope = {
        ...envelope,
        id: docRef.id,
        createdAt: toISOString(Timestamp.now()),
        lastUpdated: toISOString(Timestamp.now())
      };
      
      console.log('✅ Created envelope:', createdEnvelope.id);
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
      await setDoc(docRef, {
        ...envelope,
        lastUpdated: Timestamp.now()
      }, { merge: true });
      
      console.log('✅ Updated envelope:', envelope.id);
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
      await deleteDoc(docRef);
      
      console.log('✅ Deleted envelope:', envelopeId);
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
      
      await Promise.all(updatePromises);
      console.log('✅ Reordered envelopes');
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
      const docRef = await addDoc(collectionRef, {
        ...transaction,
        createdAt: Timestamp.now()
      });
      
      const createdTransaction: Transaction = {
        ...transaction,
        id: docRef.id
      };
      
      console.log('✅ Created transaction:', createdTransaction.id);
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
      
      console.log('📤 Clean transaction for Firestore:', cleanTransaction);
      
      const docRef = doc(db, 'users', userId, 'transactions', transaction.id);
      await setDoc(docRef, cleanTransaction, { merge: true });
      
      console.log('✅ Updated transaction:', transaction.id);
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
      await deleteDoc(docRef);
      
      console.log('✅ Deleted transaction:', transactionId);
    } catch (error) {
      console.error('❌ BudgetService.deleteTransaction failed:', error);
      throw new Error(`Failed to delete transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      console.log(`📅 BudgetService.getMonthData: Fetching for user ${userId}, month ${monthStr}`);
      
      // Fetch income sources for the month
      const incomeSourcesQuery = query(
        collection(db, 'users', userId, 'incomeSources'),
        where('month', '==', monthStr)
      );
      const incomeSourcesSnapshot = await getDocs(incomeSourcesQuery);
      
      const incomeSources = incomeSourcesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          month: data.month,
          name: data.name,
          amount: parseFloat(data.amount),
          frequency: data.frequency,
          category: data.category,
          createdAt: toISOString(data.createdAt),
          updatedAt: toISOString(data.updatedAt),
        } as IncomeSource;
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Fetch envelope allocations for the month
      const allocationsQuery = query(
        collection(db, 'users', userId, 'envelopeAllocations'),
        where('month', '==', monthStr)
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      
      const allocations = allocationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          envelopeId: data.envelopeId,
          month: data.month,
          budgetedAmount: parseFloat(data.budgetedAmount),
          createdAt: toISOString(data.createdAt),
          updatedAt: toISOString(data.updatedAt),
        } as EnvelopeAllocation;
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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

      // Delete orphaned allocations
      if (orphanedAllocations.length > 0) {
        const deletePromises = orphanedAllocations.map(allocationId => 
          deleteDoc(doc(db, 'users', userId, 'envelopeAllocations', allocationId))
        );
        await Promise.all(deletePromises);
        report.orphanedAllocationsDeleted = orphanedAllocations.length;
        report.details.deletedAllocationIds = orphanedAllocations;
        console.log(`🗑️ Deleted ${orphanedAllocations.length} orphaned allocations`);
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
