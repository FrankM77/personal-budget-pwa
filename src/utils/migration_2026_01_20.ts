import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { toMonthKey, toDate } from './dateUtils';

/**
 * DATABASE MIGRATION SCRIPT - 2026-01-20
 * 
 * Goals:
 * 1. Normalize 'amount' fields: Convert strings "12.50" to numbers 12.50
 * 2. Denormalize 'month' field: Add 'month' (YYYY-MM) to all transactions
 * 
 * Scope:
 * - Transactions
 * - Income Sources (already structured by month, but checking amounts)
 * - Envelope Allocations (already structured by month, but checking amounts)
 */

export const runDatabaseNormalization = async (userId: string) => {
  console.log(`🚀 Starting Database Normalization for User: ${userId}`);
  let totalUpdates = 0;
  let errors = 0;

  // 1. NORMALIZE TRANSACTIONS
  // -------------------------
  try {
    console.log('📦 Scanning Transactions...');
    const txRef = collection(db, 'users', userId, 'transactions');
    const txSnapshot = await getDocs(txRef);
    
    console.log(`Found ${txSnapshot.size} transactions.`);

    for (const docSnapshot of txSnapshot.docs) {
      const data = docSnapshot.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // Check Amount (String -> Number)
      if (typeof data.amount === 'string') {
        const numAmount = parseFloat(data.amount);
        if (!isNaN(numAmount)) {
          updates.amount = numAmount;
          needsUpdate = true;
        }
      }

      // Check Month (Missing -> Add)
      if (!data.month && data.date) {
        // Derive month from date
        try {
          // Handle Timestamp or ISO string
          const dateObj = toDate(data.date);
          const monthKey = toMonthKey(dateObj);
          updates.month = monthKey;
          needsUpdate = true;
        } catch (err) {
          console.warn(`⚠️ Could not derive month for tx ${docSnapshot.id}:`, err);
        }
      }

      if (needsUpdate) {
        console.log(`🛠️ Updating Transaction ${docSnapshot.id}:`, updates);
        await updateDoc(doc(db, 'users', userId, 'transactions', docSnapshot.id), updates);
        totalUpdates++;
      }
    }
  } catch (err) {
    console.error('❌ Error migrating transactions:', err);
    errors++;
  }

  // 2. NORMALIZE INCOME SOURCES (In Subcollections)
  // -------------------------
  // Note: Your current architecture uses `users/{userId}/incomeSources` (flat) OR `users/{userId}/monthlyBudgets/{month}/incomeSources` (subcollection)?
  // Based on code, it seems they are in `users/{userId}/incomeSources` but have a `month` field.
  try {
    console.log('💰 Scanning Income Sources...');
    const incRef = collection(db, 'users', userId, 'incomeSources');
    const incSnapshot = await getDocs(incRef);
    
    console.log(`Found ${incSnapshot.size} income sources.`);

    for (const docSnapshot of incSnapshot.docs) {
      const data = docSnapshot.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // Check Amount
      if (typeof data.amount === 'string') {
        const numAmount = parseFloat(data.amount);
        if (!isNaN(numAmount)) {
          updates.amount = numAmount;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log(`🛠️ Updating Income Source ${docSnapshot.id}:`, updates);
        await updateDoc(doc(db, 'users', userId, 'incomeSources', docSnapshot.id), updates);
        totalUpdates++;
      }
    }
  } catch (err) {
    console.error('❌ Error migrating income sources:', err);
    errors++;
  }

  // 3. NORMALIZE ALLOCATIONS
  // -------------------------
  try {
    console.log('📊 Scanning Envelope Allocations...');
    const allocRef = collection(db, 'users', userId, 'envelopeAllocations');
    const allocSnapshot = await getDocs(allocRef);
    
    console.log(`Found ${allocSnapshot.size} allocations.`);

    for (const docSnapshot of allocSnapshot.docs) {
      const data = docSnapshot.data();
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      // Check Budgeted Amount
      if (typeof data.budgetedAmount === 'string') {
        const numAmount = parseFloat(data.budgetedAmount);
        if (!isNaN(numAmount)) {
          updates.budgetedAmount = numAmount;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log(`🛠️ Updating Allocation ${docSnapshot.id}:`, updates);
        await updateDoc(doc(db, 'users', userId, 'envelopeAllocations', docSnapshot.id), updates);
        totalUpdates++;
      }
    }
  } catch (err) {
    console.error('❌ Error migrating allocations:', err);
    errors++;
  }

  console.log(`✅ Migration Complete. Total documents updated: ${totalUpdates}. Errors: ${errors}`);
  return { totalUpdates, errors };
};
