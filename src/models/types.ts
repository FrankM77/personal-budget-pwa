export type TransactionType = 'Income' | 'Expense' | 'Transfer';

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string; // Simple hash for demo purposes
}

export interface Transaction {
  id: string;
  date: string; // ISO String (e.g., "2024-01-01T12:00:00Z")
  amount: number;
  description: string;
  envelopeId: string;
  reconciled: boolean;
  type: TransactionType;
  transferId?: string; // Links two sides of a transfer
  userId?: string;
}

export interface Envelope {
  id: string;
  name: string;
  currentBalance: number;
  lastUpdated: string; // ISO String
  isActive: boolean;
  orderIndex: number;
  userId?: string;
}

export interface DistributionTemplate {
  id: string;
  name: string;
  distributions: Record<string, number>; // Map of EnvelopeID -> Amount
  lastUsed: string;
  note: string;
  userId?: string;
}

export interface AppSettings {
  id: string;
  userId?: string;
  theme: 'light' | 'dark' | 'system';
  // Additional settings can be added here as needed
}