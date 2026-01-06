import { collection, doc, getDoc, setDoc, deleteDoc, query, where, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  FirestoreMonthlyBudget,
  FirestoreIncomeSource,
  FirestoreEnvelopeAllocation
} from '../types/firestore';
import type { MonthlyBudget, IncomeSource, EnvelopeAllocation } from '../models/types';

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
      const docRef = doc(db, 'monthlyBudgets', `${userId}_${month}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirestoreMonthlyBudget;
        return {
          id: data.id,
          userId: data.userId,
          month: data.month,
          totalIncome: parseFloat(data.totalIncome),
          availableToBudget: parseFloat(data.availableToBudget),
          createdAt: data.createdAt.toDate().toISOString(),
          updatedAt: data.updatedAt.toDate().toISOString(),
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
        totalIncome: budget.totalIncome.toString(),
        availableToBudget: budget.availableToBudget.toString(),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'monthlyBudgets', id), firestoreData);

      return {
        ...budget,
        id,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    } catch (error) {
      console.error('Error creating/updating monthly budget:', error);
      throw error;
    }
  }

  // Income Sources CRUD
  async getIncomeSources(userId: string, month: string): Promise<IncomeSource[]> {
    try {
      const q = query(
        collection(db, 'incomeSources'),
        where('userId', '==', userId),
        where('month', '==', month)
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreIncomeSource;
        return {
          id: data.id,
          userId: data.userId,
          month: data.month,
          name: data.name,
          amount: parseFloat(data.amount),
          frequency: data.frequency,
          category: data.category,
          createdAt: data.createdAt.toDate().toISOString(),
          updatedAt: data.updatedAt.toDate().toISOString(),
        };
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (error) {
      console.error('Error getting income sources:', error);
      throw error;
    }
  }

  async createIncomeSource(source: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<IncomeSource> {
    try {
      const now = Timestamp.now();
      const docRef = doc(collection(db, 'incomeSources'));

      const firestoreData: FirestoreIncomeSource = {
        id: docRef.id,
        userId: source.userId,
        month: source.month,
        name: source.name,
        amount: source.amount.toString(),
        frequency: source.frequency || 'monthly',
        ...(source.category && { category: source.category }),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(docRef, firestoreData);

      return {
        ...source,
        frequency: source.frequency || 'monthly',
        id: docRef.id,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
      };
    } catch (error) {
      console.error('Error creating income source:', error);
      throw error;
    }
  }

  // Envelope Allocations CRUD
  async getEnvelopeAllocations(userId: string, month: string): Promise<EnvelopeAllocation[]> {
    try {
      const q = query(
        collection(db, 'envelopeAllocations'),
        where('userId', '==', userId),
        where('month', '==', month)
      );
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map(doc => {
        const data = doc.data() as FirestoreEnvelopeAllocation;
        return {
          id: data.id,
          userId: data.userId,
          envelopeId: data.envelopeId,
          month: data.month,
          budgetedAmount: parseFloat(data.budgetedAmount),
          createdAt: data.createdAt.toDate().toISOString(),
          updatedAt: data.updatedAt.toDate().toISOString(),
        };
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (error) {
      console.error('Error getting envelope allocations:', error);
      throw error;
    }
  }

  async createEnvelopeAllocation(allocation: Omit<EnvelopeAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvelopeAllocation> {
    try {
      const now = Timestamp.now();
      const docRef = doc(collection(db, 'envelopeAllocations'));

      const firestoreData: FirestoreEnvelopeAllocation = {
        id: docRef.id,
        userId: allocation.userId,
        envelopeId: allocation.envelopeId,
        month: allocation.month,
        budgetedAmount: allocation.budgetedAmount.toString(),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(docRef, firestoreData);

      return {
        ...allocation,
        id: docRef.id,
        createdAt: now.toDate().toISOString(),
        updatedAt: now.toDate().toISOString(),
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
      // Copy income sources
      const incomeSources = await this.getIncomeSources(userId, fromMonth);
      for (const source of incomeSources) {
        await this.createIncomeSource({
          ...source,
          month: toMonth,
        });
      }

      // Copy envelope allocations
      const allocations = await this.getEnvelopeAllocations(userId, fromMonth);
      for (const allocation of allocations) {
        await this.createEnvelopeAllocation({
          ...allocation,
          month: toMonth,
        });
      }

      // Calculate total income and create new monthly budget
      const totalIncome = incomeSources.reduce((sum, source) => sum + source.amount, 0);
      const totalAllocations = allocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);
      const availableToBudget = totalIncome - totalAllocations;

      await this.createOrUpdateMonthlyBudget({
        userId,
        month: toMonth,
        totalIncome,
        availableToBudget,
      });

    } catch (error) {
      console.error('Error copying month data:', error);
      throw error;
    }
  }

  // Delete methods
  async deleteIncomeSource(sourceId: string): Promise<void> {
    try {
      const docRef = doc(db, 'incomeSources', sourceId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting income source:', error);
      throw error;
    }
  }

  async updateIncomeSource(sourceId: string, updates: Partial<Omit<FirestoreIncomeSource, 'id' | 'userId' | 'month' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, 'incomeSources', sourceId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      await setDoc(docRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating income source:', error);
      throw error;
    }
  }

  async deleteEnvelopeAllocation(allocationId: string): Promise<void> {
    try {
      const docRef = doc(db, 'envelopeAllocations', allocationId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting envelope allocation:', error);
      throw error;
    }
  }

  async updateEnvelopeAllocation(allocationId: string, updates: Partial<Omit<FirestoreEnvelopeAllocation, 'id' | 'userId' | 'month' | 'createdAt'>>): Promise<void> {
    try {
      const docRef = doc(db, 'envelopeAllocations', allocationId);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };
      await setDoc(docRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating envelope allocation:', error);
      throw error;
    }
  }

  // Clear all data for a month
  async clearMonthData(userId: string, month: string): Promise<void> {
    try {
      // Get all data for this month
      const [incomeSources, allocations] = await Promise.all([
        this.getIncomeSources(userId, month),
        this.getEnvelopeAllocations(userId, month)
      ]);

      // Delete all income sources
      const incomeDeletePromises = incomeSources.map(source =>
        this.deleteIncomeSource(source.id)
      );

      // Delete all envelope allocations
      const allocationDeletePromises = allocations.map(allocation =>
        this.deleteEnvelopeAllocation(allocation.id)
      );

      // Execute all deletions
      await Promise.all([...incomeDeletePromises, ...allocationDeletePromises]);

      // Update or reset the monthly budget
      await this.createOrUpdateMonthlyBudget({
        userId,
        month,
        totalIncome: 0,
        availableToBudget: 0,
      });

    } catch (error) {
      console.error('Error clearing month data:', error);
      throw error;
    }
  }

  // Calculate available to budget for a month
  async calculateAvailableToBudget(userId: string, month: string): Promise<number> {
    try {
      const incomeSources = await this.getIncomeSources(userId, month);
      const allocations = await this.getEnvelopeAllocations(userId, month);

      const totalIncome = incomeSources.reduce((sum, source) => sum + source.amount, 0);
      const totalAllocations = allocations.reduce((sum, allocation) => sum + allocation.budgetedAmount, 0);

      return totalIncome - totalAllocations;
    } catch (error) {
      console.error('Error calculating available to budget:', error);
      throw error;
    }
  }

  // Real-time subscription methods
  subscribeToMonthlyBudget(userId: string, month: string, callback: (budget: any | null) => void): Unsubscribe {
    const docRef = doc(db, 'monthlyBudgets', `${userId}_${month}`);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        callback(data);
      } else {
        callback(null);
      }
    });
  }

  subscribeToIncomeSources(userId: string, month: string, callback: (sources: any[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'incomeSources'),
      where('userId', '==', userId),
      where('month', '==', month)
    );
    return onSnapshot(q, (querySnapshot) => {
      const sources = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeA - timeB;
      });
      callback(sources);
    });
  }

  subscribeToEnvelopeAllocations(userId: string, month: string, callback: (allocations: any[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'envelopeAllocations'),
      where('userId', '==', userId),
      where('month', '==', month)
    );
    return onSnapshot(q, (querySnapshot) => {
      const allocations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(allocations);
    });
  }
}
