import type { Envelope, Transaction, IncomeSource, EnvelopeAllocation, AppSettings, Category } from '../models/types';

export interface BudgetState {
  // === DATA ===
  envelopes: Envelope[];
  transactions: Transaction[];
  categories: Category[];
  appSettings: AppSettings | null;
  
  // Organized by Month (e.g., "2026-01")
  incomeSources: Record<string, IncomeSource[]>;
  allocations: Record<string, EnvelopeAllocation[]>;
  loadedTransactionMonths: string[]; // Track which months of transactions are loaded
  areAllTransactionsLoaded: boolean; // Flag to indicate if full history is loaded
  
  // === CONTEXT ===
  currentMonth: string; // "YYYY-MM"
  isOnline: boolean;
  isOnboardingActive: boolean; // UI State for guide
  isOnboardingCompleted: boolean; // Persistent State
  guidedTutorialStep: number | null; // null = not active, 0-3 = active step
  guidedTutorialCompleted: boolean; // Persistent State
  isLoading: boolean;
  error: string | null;

  // === ACTIONS ===
  setMonth: (month: string) => void;
  init: () => Promise<void>;
  setIsOnboardingActive: (active: boolean) => void; // UI Action
  checkAndStartOnboarding: () => Promise<void>; // Action to check and start onboarding for new users
  completeOnboarding: () => void; // Action to mark onboarding as complete
  resetOnboarding: () => void; // Action to reset onboarding status
  startGuidedTutorial: () => void; // Start the guided tutorial
  advanceGuidedTutorial: () => void; // Move to next guided tutorial step
  skipGuidedTutorial: () => void; // Skip/exit the guided tutorial
  completeGuidedTutorial: () => void; // Mark guided tutorial as complete
  resetGuidedTutorial: () => void; // Reset guided tutorial for replay
  addEnvelope: (envelope: Omit<Envelope, 'id'>) => Promise<string>;
  updateEnvelope: (envelope: Envelope) => Promise<void>;
  deleteEnvelope: (envelopeId: string) => Promise<void>;
  reorderEnvelopes: (orderedIds: string[]) => Promise<void>;
  handleUserLogout: () => void;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<void>;
  restoreTransaction: (transaction: Transaction) => Promise<void>;
  transferFunds: (fromEnvelopeId: string, toEnvelopeId: string, amount: number, note: string, date?: Date | string) => Promise<void>;
  fetchData: () => Promise<void>;
  renameEnvelope: (envelopeId: string, newName: string) => Promise<void>;
  getEnvelopeBalance: (envelopeId: string, month?: string) => number;
  resetData: () => Promise<void>;
  clearMonthData: (month: string) => Promise<void>; // Clear specific month data
  importData: (data: any) => Promise<{ success: boolean; message: string }>;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  initializeAppSettings: () => Promise<void>;
  updateOnlineStatus: () => Promise<void>;
  updatePiggybankContribution: (envelopeId: string, newAmount: number) => Promise<void>;
  fetchMonthData: (month: string) => Promise<void>;
  fetchTransactionsForMonth: (month: string) => Promise<void>;
  fetchTransactionsForEnvelope: (envelopeId: string) => Promise<void>;
  fetchAllTransactions: () => Promise<void>;
  removeEnvelopeFromMonth: (envelopeId: string, month: string) => Promise<void>;
  
  // Category Actions
  fetchCategories: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'userId'>) => Promise<string>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;

  // Income Source Actions
  addIncomeSource: (month: string, source: Omit<IncomeSource, 'id'>) => Promise<void>;
  updateIncomeSource: (month: string, source: IncomeSource) => Promise<void>;
  deleteIncomeSource: (month: string, sourceId: string) => Promise<void>;
  copyPreviousMonthAllocations: (currentMonth: string) => Promise<void>;
  
  // Allocation Actions
  setEnvelopeAllocation: (envelopeId: string, budgetedAmount: number) => Promise<void>;
  createEnvelopeAllocation: (allocation: Omit<EnvelopeAllocation, 'id'>) => Promise<void>;
  updateEnvelopeAllocation: (id: string, updates: Partial<EnvelopeAllocation>) => Promise<void>;
  deleteEnvelopeAllocation: (id: string) => Promise<void>;
  refreshAvailableToBudget: () => Promise<number>;
}

// Shared slice params type for all slice creators
export type SliceParams = {
  set: (partial: Partial<BudgetState> | ((state: BudgetState) => Partial<BudgetState>)) => void;
  get: () => BudgetState;
};
