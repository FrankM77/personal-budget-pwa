import { Timestamp } from 'firebase/firestore';
import type { Transaction } from '../models/types';
import type { FirestoreTransaction, FirestoreTransactionType } from '../types/firestore';

const toTitleCaseType = (type: FirestoreTransactionType | string): Transaction['type'] => {
  if (type === 'income') return 'Income';
  if (type === 'expense') return 'Expense';
  if (type === 'transfer') return 'Transfer';
  return type as Transaction['type'];
};

const toLowerCaseType = (type: Transaction['type'] | string): FirestoreTransactionType => {
  const lower = type.toLowerCase();
  if (lower === 'income' || lower === 'expense' || lower === 'transfer') return lower;
  return 'expense';
};

export const transactionFromFirestore = (firebaseTx: FirestoreTransaction): Transaction => {
  const date = firebaseTx.date?.toDate?.() ? firebaseTx.date.toDate().toISOString() : (firebaseTx.date as unknown as string);
  const dateObj = new Date(date);
  const month = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
  
  return {
    id: firebaseTx.id,
    date,
    amount: typeof firebaseTx.amount === 'string' ? parseFloat(firebaseTx.amount) || 0 : (firebaseTx.amount as unknown as number),
    description: firebaseTx.description || '',
    merchant: firebaseTx.merchant || undefined,
    envelopeId: firebaseTx.envelopeId || '',
    reconciled: firebaseTx.reconciled ?? false,
    type: toTitleCaseType(firebaseTx.type),
    transferId: firebaseTx.transferId ?? undefined,
    userId: firebaseTx.userId,
    month,
    isAutomatic: firebaseTx.isAutomatic ?? undefined,
  };
};

export const transactionToFirestore = (
  tx: Transaction,
  userId: string
): FirestoreTransaction => {
  const firestoreTx: any = {
    id: tx.id,
    userId,
    envelopeId: tx.envelopeId,
    amount: tx.amount.toString(),
    date: Timestamp.fromDate(new Date(tx.date)),
    description: tx.description,
    merchant: tx.merchant || null,
    reconciled: tx.reconciled ?? false,
    type: toLowerCaseType(tx.type),
    transferId: tx.transferId ?? null,
  };
  
  // Only include isAutomatic if it's explicitly true
  if (tx.isAutomatic === true) {
    firestoreTx.isAutomatic = true;
  }
  
  return firestoreTx as FirestoreTransaction;
};

export const transactionUpdatesToFirestore = (tx: Transaction): Omit<FirestoreTransaction, 'id' | 'userId'> => {
  const updates: any = {
    envelopeId: tx.envelopeId,
    amount: tx.amount.toString(),
    date: Timestamp.fromDate(new Date(tx.date)),
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
  
  return updates as Omit<FirestoreTransaction, 'id' | 'userId'>;
};
