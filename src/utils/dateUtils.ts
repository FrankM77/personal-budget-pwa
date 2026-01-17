import { Timestamp } from 'firebase/firestore';

/**
 * Universal date converter.
 * Handles strings, numbers, Dates, and Firestore Timestamps safely.
 */
export const toDate = (value: string | number | Timestamp | Date | null | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'number') return new Date(value);
  
  // Check for Firestore Timestamp (duck typing to avoid heavy import dependency if possible)
  if ((value as any)?.toDate && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return new Date();
};

export const toISOString = (value: string | Timestamp | Date): string => {
  return toDate(value).toISOString();
};

/**
 * Returns YYYY-MM string for grouping
 */
export const toMonthKey = (value: string | Timestamp | Date): string => {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Formats date for display (e.g. "Jan 1, 2025")
 */
export const formatDisplayDate = (value: string | Timestamp | Date): string => {
  return toDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};