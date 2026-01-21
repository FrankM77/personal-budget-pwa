import { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp, deleteField, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  FirestoreMonthlyBudget,
  FirestoreIncomeSource,
  FirestoreEnvelopeAllocation
} from '../types/firestore';
import type { MonthlyBudget, IncomeSource, EnvelopeAllocation } from '../models/types';
import { toISOString } from '../utils/dateUtils';

export class MonthlyBudgetService {
  private static instance: MonthlyBudgetService;

  public static getInstance(): MonthlyBudgetService {
    if (!MonthlyBudgetService.instance) {
      MonthlyBudgetService.instance = new MonthlyBudgetService();
    }
    return MonthlyBudgetService.instance;
  }

  // Monthly Budget CRUD
  async getMonthlyBudget(userId: string, month: string): Promise<MonthlyBudget | null> {
    try {
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirestoreMonthlyBudget;
        return {
          id: data.id,
          userId: data.userId,
          month: data.month,
          totalIncome: data.totalIncome,
          availableToBudget: data.availableToBudget,
          createdAt: toISOString(data.createdAt),
          updatedAt: toISOString(data.updatedAt),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting monthly budget:', error);
      throw error;
    }
  }

  async createOrUpdateMonthlyBudget(budget: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>): Promise<MonthlyBudget> {
    try {
      const now = Timestamp.now();
      const id = `${budget.userId}_${budget.month}`;

      const firestoreData: FirestoreMonthlyBudget = {
        id,
        userId: budget.userId,
        month: budget.month,
        totalIncome: budget.totalIncome,
        availableToBudget: budget.availableToBudget,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', budget.userId, 'monthlyBudgets', budget.month), firestoreData);

      return {
        ...budget,
        id,
        createdAt: toISOString(now),
        updatedAt: toISOString(now),
      };
    } catch (error) {
      console.error('Error creating/updating monthly budget:', error);
      throw error;
    }
  }

  async getMonthData(userId: string, month: string): Promise<{ incomeSources: IncomeSource[], allocations: EnvelopeAllocation[] }> {
    try {
      const budget = await this.getMonthlyBudget(userId, month);
      
      if (!budget) {
        return { incomeSources: [], allocations: [] };
      }

      // Fetch the raw document to get embedded data
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return { incomeSources: [], allocations: [] };
      }
      
      const data = docSnap.data() as FirestoreMonthlyBudget;

      const incomeSources: IncomeSource[] = (data.incomeSources || []).map(src => ({
        id: src.id,
        userId: src.userId,
        month: src.month,
        name: src.name,
        amount: src.amount,
        frequency: src.frequency || 'monthly',
        category: src.category,
        createdAt: toISOString(src.createdAt),
        updatedAt: toISOString(src.updatedAt)
      }));

      const allocations: EnvelopeAllocation[] = Object.entries(data.allocations || {}).map(([envelopeId, amount]) => ({
        id: envelopeId,
        userId: userId,
        envelopeId: envelopeId,
        month: month,
        budgetedAmount: amount,
        createdAt: toISOString(data.createdAt),
        updatedAt: toISOString(data.updatedAt)
      }));

      return { incomeSources, allocations };
    } catch (error) {
      console.error('Error getting month data:', error);
      throw error;
    }
  }

  // Income Sources CRUD
  async getIncomeSources(userId: string, month: string): Promise<IncomeSource[]> {
    const data = await this.getMonthData(userId, month);
    return data.incomeSources;
  }

  async createIncomeSource(source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<IncomeSource> {
    try {
      const now = Timestamp.now();
      // Generate a client-side ID since we aren't using addDoc anymore
      const newId = `inc_${now.toMillis()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newSource: FirestoreIncomeSource = {
        id: newId,
        userId: source.userId,
        month: source.month,
        name: source.name,
        amount: source.amount,
        frequency: source.frequency || 'monthly',
        category: source.category,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = doc(db, 'users', source.userId, 'monthlyBudgets', source.month);
      
      // Use arrayUnion to append to the embedded array
      await updateDoc(docRef, {
        incomeSources: arrayUnion(newSource)
      });

      return {
        ...source,
        id: newId,
        frequency: source.frequency || 'monthly',
        createdAt: toISOString(now),
        updatedAt: toISOString(now),
      };
    } catch (error) {
      console.error('Error creating income source:', error);
      throw error;
    }
  }

  // Envelope Allocations CRUD
  async getEnvelopeAllocations(userId: string, month: string): Promise<EnvelopeAllocation[]> {
    const data = await this.getMonthData(userId, month);
    return data.allocations;
  }

  async createEnvelopeAllocation(allocation: Omit<EnvelopeAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvelopeAllocation> {
    try {
      const now = Timestamp.now();
      const docRef = doc(db, 'users', allocation.userId, 'monthlyBudgets', allocation.month);

      // Use dot notation to update the specific key in the embedded map
      await updateDoc(docRef, {
        [`allocations.${allocation.envelopeId}`]: allocation.budgetedAmount,
        updatedAt: now
      });

      return {
        ...allocation,
        id: allocation.envelopeId,
        createdAt: toISOString(now),
        updatedAt: toISOString(now),
      };
    } catch (error) {
      console.error('Error creating envelope allocation:', error);
      throw error;
    }
  }

  // Month Copying Functionality
  async copyMonthData(
    userId: string,
    fromMonth: string,
    toMonth: string
  ): Promise<void> {
    try {
      // 1. Get source budget data
      const sourceData = await this.getMonthData(userId, fromMonth);
      
      const now = Timestamp.now();
      
      // 2. Prepare new Income Sources
      const newIncomeSources: FirestoreIncomeSource[] = sourceData.incomeSources.map(src => ({
        id: `inc_${now.toMillis()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        month: toMonth,
        name: src.name,
        amount: src.amount,
        frequency: src.frequency || 'monthly',
        category: src.category,
        createdAt: now,
        updatedAt: now
      }));
      
      // 3. Prepare new Allocations Map
      const newAllocationsMap: Record<string, number> = {};
      sourceData.allocations.forEach(alloc => {
        newAllocationsMap[alloc.envelopeId] = alloc.budgetedAmount;
      });
      
      // 4. Calculate totals
      const totalIncome = newIncomeSources.reduce((sum, s) => sum + s.amount, 0);
      const totalAllocations = Object.values(newAllocationsMap).reduce((sum, a) => sum + a, 0);
      
      // 5. Create new budget document
      const targetId = `${userId}_${toMonth}`;
      const firestoreData: FirestoreMonthlyBudget = {
        id: targetId,
        userId,
        month: toMonth,
        totalIncome,
        availableToBudget: totalIncome - totalAllocations,
        createdAt: now,
        updatedAt: now,
        allocations: newAllocationsMap,
        incomeSources: newIncomeSources
      };
      
      await setDoc(doc(db, 'users', userId, 'monthlyBudgets', toMonth), firestoreData);

    } catch (error) {
      console.error('Error copying month data:', error);
      throw error;
    }
  }

  // Delete methods
  async deleteIncomeSource(userId: string, sourceId: string, month: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return;
      
      const data = docSnap.data();
      const currentSources = data.incomeSources || [];
      const updatedSources = currentSources.filter((s: any) => s.id !== sourceId);
      
      await updateDoc(docRef, { 
        incomeSources: updatedSources,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error deleting income source:', error);
      throw error;
    }
  }

  async updateIncomeSource(userId: string, sourceId: string, month: string, updates: Partial<Omit<FirestoreIncomeSource, 'id' | 'userId' | 'month' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return;
      
      const data = docSnap.data();
      const currentSources = data.incomeSources || [];
      const updatedSources = currentSources.map((s: any) => 
        s.id === sourceId ? { ...s, ...updates, updatedAt: Timestamp.now() } : s
      );
      
      await updateDoc(docRef, { 
        incomeSources: updatedSources,
        updatedAt: Timestamp.now() 
      });
    } catch (error) {
      console.error('Error updating income source:', error);
      throw error;
    }
  }

  async deleteEnvelopeAllocation(userId: string, allocationId: string, month: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      await updateDoc(docRef, {
        [`allocations.${allocationId}`]: deleteField(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error deleting envelope allocation:', error);
      throw error;
    }
  }

  async updateEnvelopeAllocation(userId: string, allocationId: string, month: string, updates: Partial<Omit<FirestoreEnvelopeAllocation, 'id' | 'userId' | 'month' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      
      if (updates.budgetedAmount !== undefined) {
        await updateDoc(docRef, {
          [`allocations.${allocationId}`]: updates.budgetedAmount,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error updating envelope allocation:', error);
      throw error;
    }
  }

  // Clear all data for a month
  async clearMonthData(userId: string, month: string): Promise<void> {
    try {
      // 1. Clear the monthly budget document
      const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
      await updateDoc(docRef, {
        totalIncome: 0,
        availableToBudget: 0,
        incomeSources: [],
        allocations: {},
        updatedAt: Timestamp.now()
      });

      // 2. Delete all transactions for that month
      const transactionsQuery = query(
        collection(db, 'users', userId, 'transactions'),
        where('month', '==', month)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      if (transactionsSnapshot.size > 0) {
        const deletePromises = transactionsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        
        await Promise.all(deletePromises);
        console.log(`🗑️ Deleted ${transactionsSnapshot.size} transactions for month ${month}`);
      } else {
        console.log(`📭 No transactions found for month ${month}`);
      }
    } catch (error) {
      console.error('Error clearing month data:', error);
      throw error;
    }
  }

  // Calculate available to budget for a month
  async calculateAvailableToBudget(userId: string, month: string): Promise<number> {
    try {
      const data = await this.getMonthData(userId, month);
      const totalIncome = data.incomeSources.reduce((sum, source) => sum + source.amount, 0);
      const totalAllocations = data.allocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);
      return totalIncome - totalAllocations;
    } catch (error) {
      console.error('Error calculating available to budget:', error);
      throw error;
    }
  }

  // Real-time subscription methods
  subscribeToMonthlyBudget(userId: string, month: string, callback: (budget: FirestoreMonthlyBudget | null) => void): Unsubscribe {
    const docRef = doc(db, 'users', userId, 'monthlyBudgets', month);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as FirestoreMonthlyBudget);
      } else {
        callback(null);
      }
    });
  }
}

// Export singleton instance
export const monthlyBudgetService = MonthlyBudgetService.getInstance();
