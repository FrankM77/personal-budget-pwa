import { Timestamp } from 'firebase/firestore';
import type { Transaction } from '../models/types';
import type { FirestoreTransactionType } from '../types/firestore';
import { toISOString, toMonthKey, toDate } from '../utils/dateUtils';

// 1. Define the messy shape of data coming from Firebase
export interface FirestoreTransaction {
  id?: string;
  amount: string | number; // Safety: allow both
  date: Timestamp | string | Date;
  description?: string;
  merchant?: string | null;
  envelopeId: string;
  type: string;
  userId: string;
  reconciled?: boolean;
  transferId?: string | null;
  isAutomatic?: boolean;
  paymentMethod?: string | {
    id: string;
    name: string;
    network: 'Visa' | 'Mastercard' | 'Amex';
    last4: string;
    color: string;
  };
  month?: string;
}

const toTitleCaseType = (type: FirestoreTransactionType | string): Transaction['type'] => {
  const lower = type.toLowerCase();
  if (lower === 'income') return 'Income';
  if (lower === 'expense') return 'Expense';
  if (lower === 'transfer') return 'Transfer';
  return 'Expense'; // Default fallback
};

const toLowerCaseType = (type: Transaction['type'] | string): FirestoreTransactionType => {
  const lower = type.toLowerCase();
  if (lower === 'income' || lower === 'expense' || lower === 'transfer') return lower;
  return 'expense';
};

/**
 * CONVERTER: Firestore (Messy) -> App (Clean)
 */
export const fromFirestore = (doc: any): Transaction => {
  const data = doc as FirestoreTransaction;
  
  // Safety: Handle string "12.50", number 12.50, or missing/null
  let cleanAmount = 0;
  if (typeof data.amount === 'number') {
    cleanAmount = data.amount;
  } else if (typeof data.amount === 'string') {
    cleanAmount = parseFloat(data.amount);
  }
  if (isNaN(cleanAmount)) cleanAmount = 0;

  // Use date utility for safe conversion
  const dateStr = toISOString(data.date);

  return {
    id: data.id || '',
    userId: data.userId || '',
    envelopeId: data.envelopeId || '',
    amount: cleanAmount, // App always gets a number
    date: dateStr,
    month: data.month || toMonthKey(dateStr),
    description: data.description || '',
    merchant: data.merchant || undefined,
    type: toTitleCaseType(data.type || 'expense'),
    reconciled: data.reconciled ?? false,
    transferId: data.transferId || undefined,
    isAutomatic: data.isAutomatic || undefined,
    paymentMethod: data.paymentMethod ? 
      (typeof data.paymentMethod === 'string' ? {
        id: data.paymentMethod,
        name: data.paymentMethod,
        network: 'Visa' as const,
        last4: '****',
        color: '#000000'
      } : data.paymentMethod) : undefined,
  };
};

/**
 * CONVERTER: App (Clean) -> Firestore (Messy)
 */
export const toFirestore = (
  tx: Partial<Transaction>, 
  userId?: string
): Record<string, any> => {
  const data: Record<string, any> = { ...tx };

  // Ensure userId is present
  if (userId) data.userId = userId;

  // 1. Convert Date to Firestore Timestamp
  if (tx.date) {
    data.date = Timestamp.fromDate(toDate(tx.date));
  }

  // 2. Amount is now stored as number (Normalized Schema)
  if (tx.amount !== undefined) {
    // Force number type
    data.amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
  }

  // 3. Format Type
  if (tx.type) {
    data.type = toLowerCaseType(tx.type);
  }

  // 4. Handle Nullables explicitly (Firebase prefers null over undefined)
  if (tx.merchant === undefined) data.merchant = null;
  if (tx.transferId === undefined) data.transferId = null;

  // 5. Add Month Field (Denormalized for Querying)
  if (tx.date && !data.month) {
    try {
      data.month = toMonthKey(toDate(tx.date));
    } catch (e) {
      // Ignore invalid dates
    }
  }
  
  return data;
};

// Legacy exports for backward compatibility
export const transactionFromFirestore = fromFirestore;
export const transactionToFirestore = toFirestore;
export const transactionUpdatesToFirestore = (tx: Transaction): Omit<FirestoreTransaction, 'id' | 'userId'> => {
  const updates: any = {
    envelopeId: tx.envelopeId,
    amount: tx.amount, // Store as number
    date: Timestamp.fromDate(toDate(tx.date)),
    description: tx.description,
    merchant: tx.merchant || null,
    reconciled: tx.reconciled ?? false,
    type: toLowerCaseType(tx.type),
    transferId: tx.transferId ?? null,
  };
  
  // Only include isAutomatic if it's explicitly true
  if (tx.isAutomatic === true) {
    updates.isAutomatic = true;
  }
  
  // Include paymentMethod if it exists
  if (tx.paymentMethod) {
    updates.paymentMethod = tx.paymentMethod;
  }
  
  return updates as Omit<FirestoreTransaction, 'id' | 'userId'>;
};