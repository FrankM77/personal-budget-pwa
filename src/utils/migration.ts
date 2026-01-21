import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toMonthKey, toDate } from './dateUtils';

export interface MigrationResult {
  totalScanned: number;
  migratedCount: number;
  errors: string[];
}

/**
 * Migration: Normalize Transaction Types (Phase 3.2 & 3.3)
 * 1. Convert 'amount' from string to number.
 * 2. Add 'month' field (YYYY-MM) derived from 'date'.
 */
export const migrateTransactions = async (userId: string): Promise<MigrationResult> => {
  console.log(`🚀 Starting Transaction Migration for user: ${userId}`);
  
  const result: MigrationResult = {
    totalScanned: 0,
    migratedCount: 0,
    errors: []
  };

  try {
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    const snapshot = await getDocs(transactionsRef);
    
    result.totalScanned = snapshot.size;
    
    // Firestore limits batches to 500 operations
    const BATCH_SIZE = 450; 
    let batch = writeBatch(db);
    let operationCount = 0;
    let batchesCommitted = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // 1. Normalize Amount (String -> Number)
      if (typeof data.amount === 'string') {
        const numAmount = parseFloat(data.amount);
        if (!isNaN(numAmount)) {
          updates.amount = numAmount;
          needsUpdate = true;
        }
      }

      // 2. Add Month Field
      if (!data.month && data.date) {
        try {
          // Handle Firestore Timestamp or ISO string
          const dateObj = toDate(data.date);
          const monthKey = toMonthKey(dateObj);
          if (monthKey) {
            updates.month = monthKey;
            needsUpdate = true;
          }
        } catch (e) {
          console.warn(`Skipping date conversion for tx ${docSnap.id}`, e);
        }
      }

      // If changes needed, add to batch
      if (needsUpdate) {
        const docRef = doc(db, 'users', userId, 'transactions', docSnap.id);
        batch.update(docRef, updates);
        operationCount++;
        result.migratedCount++;

        // Commit if batch is full
        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`📦 Committed batch ${++batchesCommitted}`);
          batch = writeBatch(db); // Start new batch
          operationCount = 0;
        }
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`📦 Committed final batch ${++batchesCommitted}`);
    }

    console.log(`✅ Migration Complete. Updated ${result.migratedCount} transactions.`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
};
