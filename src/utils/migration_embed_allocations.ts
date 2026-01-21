import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FirestoreIncomeSource, FirestoreMonthlyBudget } from '../types/firestore';

/**
 * MIGRATION SCRIPT: Embed Allocations & Income Sources (Phase 3.1) - REVISED
 * 
 * This version finds all months with data and ensures the monthly budget document exists.
 */

export const runEmbedAllocationsMigration = async (userId: string) => {
  console.log(`🚀 Starting REVISED Embed Allocations Migration for User: ${userId}`);
  let totalBudgetsUpdated = 0;
  let errors = 0;

  try {
    // 1. Identify all months that have any data
    const monthsWithData = new Set<string>();
    
    const allocSnapshot = await getDocs(collection(db, 'users', userId, 'envelopeAllocations'));
    allocSnapshot.docs.forEach(d => { if (d.data().month) monthsWithData.add(d.data().month); });
    
    const incomeSnapshot = await getDocs(collection(db, 'users', userId, 'incomeSources'));
    incomeSnapshot.docs.forEach(d => { if (d.data().month) monthsWithData.add(d.data().month); });

    console.log(`🔍 Found data for ${monthsWithData.size} distinct months:`, Array.from(monthsWithData));

    for (const month of monthsWithData) {
      console.log(`📅 Processing Month: ${month}`);

      // 2. Fetch Allocations for this month
      const monthAllocs = allocSnapshot.docs
        .filter(d => d.data().month === month)
        .map(d => d.data());
      
      const allocationsMap: Record<string, number> = {};
      monthAllocs.forEach(data => {
        if (data.envelopeId) {
          allocationsMap[data.envelopeId] = data.budgetedAmount || 0;
        }
      });

      // 3. Fetch Income Sources for this month
      const incomeSourcesArray: FirestoreIncomeSource[] = incomeSnapshot.docs
        .filter(d => d.data().month === month)
        .map(d => ({
          ...d.data(),
          id: d.id,
          amount: d.data().amount || 0
        } as FirestoreIncomeSource));

      // 4. Calculate Totals
      const totalIncome = incomeSourcesArray.reduce((sum, s) => sum + s.amount, 0);
      const totalAllocated = Object.values(allocationsMap).reduce((sum, a) => sum + a, 0);
      const availableToBudget = totalIncome - totalAllocated;

      // 5. Create or Update the Monthly Budget Document
      const budgetRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      const firestoreData: FirestoreMonthlyBudget = {
        id: `${userId}_${month}`,
        userId,
        month,
        totalIncome,
        availableToBudget,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        allocations: allocationsMap,
        incomeSources: incomeSourcesArray
      };

      await setDoc(budgetRef, firestoreData, { merge: true });
      console.log(`✅ Embedded ${month}: ${Object.keys(allocationsMap).length} allocs, ${incomeSourcesArray.length} incomes. Bal: ${availableToBudget}`);
      totalBudgetsUpdated++;
    }

  } catch (err) {
    console.error('❌ Error during migration:', err);
    errors++;
  }

  console.log(`🏁 Embed Migration Complete. Budgets Created/Updated: ${totalBudgetsUpdated}, Errors: ${errors}`);
  return { totalBudgetsUpdated, errors };
};