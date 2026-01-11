import type { Transaction, Envelope, DistributionTemplate } from '../models/types';

export const convertFirebaseTransaction = (firebaseTx: any): Transaction => ({
  id: firebaseTx.id,
  date: firebaseTx.date?.toDate?.() ? firebaseTx.date.toDate().toISOString() : firebaseTx.date,
  amount: parseFloat(firebaseTx.amount) || 0,
  description: firebaseTx.description || '',
  merchant: firebaseTx.merchant || undefined,
  envelopeId: firebaseTx.envelopeId || '',
  reconciled: firebaseTx.reconciled || false,
  type: firebaseTx.type === 'income' ? 'Income' : firebaseTx.type === 'expense' ? 'Expense' : 'Transfer',
  transferId: firebaseTx.transferId || undefined,
  userId: firebaseTx.userId || undefined,
  isAutomatic: firebaseTx.isAutomatic || false,
  month: firebaseTx.month || undefined
});

export const convertFirebaseEnvelope = (firebaseEnv: any): Envelope => ({
  id: firebaseEnv.id,
  name: firebaseEnv.name || '',
  currentBalance: firebaseEnv.currentBalance || 0,
  lastUpdated: firebaseEnv.lastUpdated,
  isActive: firebaseEnv.isActive ?? true,
  orderIndex: firebaseEnv.orderIndex ?? 0,
  userId: firebaseEnv.userId || undefined,
  createdAt: firebaseEnv.createdAt,
  isPiggybank: firebaseEnv.isPiggybank,
  piggybankConfig: firebaseEnv.piggybankConfig
});

export const convertFirebaseTemplate = (firebaseTemplate: any): DistributionTemplate => ({
  id: firebaseTemplate.id,
  name: firebaseTemplate.name || '',
  distributions: firebaseTemplate.distributions || {},
  lastUsed: firebaseTemplate.lastUsed?.toDate?.() ? firebaseTemplate.lastUsed.toDate().toISOString() : firebaseTemplate.lastUsed || new Date().toISOString(),
  note: firebaseTemplate.note || '',
  userId: firebaseTemplate.userId || undefined
});
