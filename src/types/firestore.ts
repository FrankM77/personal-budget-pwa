import type { Timestamp } from 'firebase/firestore';

export type FirestoreTransactionType = 'income' | 'expense' | 'transfer';

export interface FirestoreAppSettings {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  enableMoveableReorder?: boolean;
}

export interface FirestoreTransaction {
  id: string;
  envelopeId: string;
  amount: string;
  date: Timestamp;
  description: string;
  merchant?: string;
  reconciled: boolean;
  type: FirestoreTransactionType;
  transferId?: string | null;
  userId?: string;
  month?: string; // Format: "2025-01" for monthly budgeting
  isAutomatic?: boolean; // True for auto-generated transactions (e.g., piggybank contributions)
}

export interface FirestoreDistributionTemplate {
  id: string;
  name: string;
  distributions: Record<string, string>;
  lastUsed: Timestamp;
  note: string;
  userId?: string;
}

// Monthly Budget Types for Zero-Based Budgeting
export interface FirestoreMonthlyBudget {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  totalIncome: string; // Sum of all income sources for the month
  availableToBudget: string; // Total minus envelope allocations
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreIncomeSource {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  name: string; // e.g., "Primary Job", "Freelance", "Investments"
  amount: string; // Monthly amount
  frequency: 'monthly' | 'weekly' | 'biweekly';
  category?: string; // Optional grouping
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FirestoreEnvelopeAllocation {
  id: string;
  userId: string;
  envelopeId: string;
  month: string; // Format: "2025-01"
  budgetedAmount: string; // Allocated amount for this envelope this month
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
