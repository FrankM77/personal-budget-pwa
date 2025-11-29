import { Timestamp } from 'firebase/firestore';
import Decimal from 'decimal.js';

// 4. App Settings Type
// Equivalent to your Swift 'struct AppSettings'
export interface AppSettings {
  id: string;
  userId: string;
  theme: 'light' | 'dark' | 'system';
  // Additional settings can be added here as needed
}

// 1. Transaction Type
// Equivalent to your Swift 'struct Transaction'
export interface Transaction {
  id: string;
  envelopeId: string;
  amount: string; // Stored as string to prevent math errors
  date: Timestamp;
  description: string;
  reconciled: boolean;
  type: 'income' | 'expense' | 'transfer';
  transferId?: string | null;
  userId?: string;
}

// 2. Distribution Template Type
// Equivalent to your Swift 'struct DistributionTemplate'
export interface DistributionTemplate {
  id: string;
  name: string;
  // Key is EnvelopeID, Value is amount string
  distributions: Record<string, string>; 
  lastUsed: Timestamp;
  note: string;
}

// 3. Helper for Money Math
// Use this whenever you need to do math (add/subtract) on the amounts above
export const toDecimal = (val: string | number) => new Decimal(val);