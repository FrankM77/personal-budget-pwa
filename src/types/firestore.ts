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
  amount: number; // Normalized: number instead of string
  date: Timestamp;
  description: string;
  merchant?: string;
  reconciled: boolean;
  type: FirestoreTransactionType;
  transferId?: string | null;
  userId?: string;
  month?: string; // Format: "2025-01" for monthly budgeting
  isAutomatic?: boolean; // True for auto-generated transactions (e.g., piggybank contributions)
  paymentMethod?: {
    id: string;
    name: string;
    network: 'Visa' | 'Mastercard' | 'Amex';
    last4: string;
    color: string;
  };
}

export interface FirestoreDistributionTemplate {
  id: string;
  name: string;
  distributions: Record<string, number>; // Normalized
  lastUsed: Timestamp;
  note: string;
  userId?: string;
}

// Monthly Budget Types for Zero-Based Budgeting
export interface FirestoreMonthlyBudget {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  totalIncome: number; // Normalized
  availableToBudget: number; // Normalized
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Embedded Data (Phase 3.1)
  allocations?: Record<string, number>; // Map: envelopeId -> budgetedAmount
  incomeSources?: FirestoreIncomeSource[]; // Embedded Array
}

export interface FirestoreIncomeSource {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  name: string; // e.g., "Primary Job", "Freelance", "Investments"
  amount: number; // Normalized
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
  budgetedAmount: number; // Normalized
  createdAt: Timestamp;
  updatedAt: Timestamp;
}