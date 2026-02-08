export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface User {
  id: string;
  username: string; // Will be email for Firebase users
  displayName: string;
  email?: string;
}

export interface Transaction {
  id: string;
  date: string; // ISO String (e.g., "2024-01-01T12:00:00Z")
  amount: number;
  description: string;
  merchant?: string; // Merchant or vendor name
  envelopeId: string;
  reconciled: boolean;
  type: TransactionType;
  transferId?: string; // Links two sides of a transfer
  userId?: string;
  month?: string; // Format: "2025-01" for monthly budgeting
  isAutomatic?: boolean; // True for piggybank auto-contributions
  paymentMethod?: {
    id: string;
    name: string;
    network: 'Visa' | 'Mastercard' | 'Amex' | 'Cash' | 'Venmo';
    last4?: string;
    color: string;
  };
}

export interface Envelope {
  id: string;
  name: string;
  currentBalance: number;
  lastUpdated: string; // ISO String
  isActive: boolean;
  orderIndex: number;
  userId?: string;
  createdAt?: string; // ISO String - when envelope was created
  
  // Piggybank fields
  isPiggybank?: boolean;
  piggybankConfig?: {
    targetAmount?: number;
    monthlyContribution: number;
    color?: string;
    icon?: string;
    paused?: boolean;
  };
  categoryId?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  orderIndex: number;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionTemplate {
  id: string;
  name: string;
  distributions: Record<string, number>; // Map of EnvelopeID -> Amount
  lastUsed: string;
  note: string;
  userId?: string;
}

export interface PaymentSource {
  id: string;
  name: string;
  network: 'Visa' | 'Mastercard' | 'Amex' | 'Cash' | 'Venmo';
  last4?: string;
  color: string;
}

export interface AppSettings {
  id: string;
  userId?: string;
  theme: 'light' | 'dark' | 'system';
  fontSize?: 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large';
  enableMoveableReorder?: boolean;
  paymentSources?: PaymentSource[];
  siriToken?: string;
}

// Zero-Based Budgeting Types
export interface MonthlyBudget {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  totalIncome: number;
  availableToBudget: number;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSource {
  id: string;
  userId: string;
  month: string; // Format: "2025-01"
  name: string;
  amount: number;
  frequency?: 'monthly' | 'weekly' | 'biweekly'; // Optional, defaults to monthly
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnvelopeAllocation {
  id: string;
  userId: string;
  envelopeId: string;
  month: string; // Format: "2025-01"
  budgetedAmount: number;
  createdAt: string;
  updatedAt: string;
}