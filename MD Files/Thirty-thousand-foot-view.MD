# Thirty-Thousand-Foot View: Architecture Analysis

**Date:** 2026-01-15  
**Author:** Senior Principal Software Architect  
**Subject:** Greenfield vs. Brownfield Analysis for Zero-Based Budgeting PWA

---

## Table of Contents
1. [The "Greenfield" Ideal Architecture](#1-the-greenfield-ideal-architecture)
2. [The "Brownfield" Audit (Current State)](#2-the-brownfield-audit-current-state)
3. [The Gap Analysis](#3-the-gap-analysis)
4. [Refactoring Roadmap](#4-refactoring-roadmap)

---

## 1. The "Greenfield" Ideal Architecture

If building this Zero-Based Budgeting PWA from scratch today, here's the architecture I would enforce:

### 1.1 Tech Stack & Patterns

| Layer | Technology | Pattern |
|-------|------------|---------|
| **View** | React + TypeScript | Presentational Components (dumb) |
| **ViewModel** | Custom Hooks | MVVM - One hook per view |
| **Domain** | Pure TypeScript Classes | Domain-Driven Design |
| **Service** | Firebase SDK Wrappers | Repository Pattern |
| **State** | Zustand (single store) | Single Source of Truth |

#### Key Design Patterns

1. **MVVM (Model-View-ViewModel)**
   - Views are purely presentational (no business logic)
   - ViewModels (custom hooks) handle all logic and state derivation
   - Models are plain TypeScript interfaces

2. **Repository Pattern for Firebase**
   - One repository per aggregate root (Budget, Envelope, Transaction)
   - Repositories handle all Firebase operations and type conversions
   - No Firebase imports in stores or views

3. **Observer Pattern via Zustand Subscriptions**
   - Single store with computed selectors
   - Views subscribe to specific slices
   - Derived state computed via selectors, not stored

4. **Command Pattern for Mutations**
   - All write operations go through explicit commands
   - Commands are auditable and reversible
   - Enables undo/redo functionality

### 1.2 Ideal Firestore Schema

```
users/{userId}/
├── profile                          # User settings document
│   ├── theme: 'light' | 'dark' | 'system'
│   └── preferences: { ... }
│
├── budgets/{month}/                 # e.g., "2025-01"
│   ├── totalIncome: number
│   ├── availableToBudget: number    # COMPUTED on write, not read
│   ├── incomeSources: [             # EMBEDDED array (not subcollection)
│   │   { id, name, amount, frequency }
│   │ ]
│   └── allocations: {               # EMBEDDED map (not subcollection)
│       [envelopeId]: { budgetedAmount, spent, remaining }
│     }
│
├── envelopes/{envelopeId}/
│   ├── name: string
│   ├── orderIndex: number
│   ├── isActive: boolean
│   ├── isPiggybank: boolean
│   ├── piggybankConfig?: { ... }
│   └── createdAt: Timestamp
│
└── transactions/{transactionId}/
    ├── envelopeId: string
    ├── amount: number               # ALWAYS number, never string
    ├── date: Timestamp              # ALWAYS Timestamp, never string
    ├── month: string                # Denormalized for efficient queries
    ├── type: 'income' | 'expense' | 'transfer'
    ├── description: string
    └── reconciled: boolean
```

#### Schema Design Principles

1. **Embed what you read together** - Income sources and allocations are embedded in the budget document because they're always read together
2. **Denormalize for queries** - `month` field on transactions enables efficient monthly queries
3. **Compute on write, not read** - `availableToBudget` is calculated when income/allocations change, not on every read
4. **Consistent types** - Amounts are always numbers, dates are always Timestamps

### 1.3 State Management (The "Left to Budget" Problem)

The ideal approach uses **derived state** with memoized selectors:

```typescript
// IDEAL: Single store with computed selectors
interface BudgetStore {
  // Raw data (from Firebase)
  budgets: Record<string, MonthlyBudget>;
  envelopes: Envelope[];
  transactions: Transaction[];
  
  // Current context
  currentMonth: string;
  
  // Actions (commands)
  setAllocation: (envelopeId: string, amount: number) => Promise<void>;
  addIncome: (source: IncomeSource) => Promise<void>;
}

// Derived state via selectors (computed, not stored)
const useAvailableToBudget = () => {
  const budget = useBudgetStore(state => state.budgets[state.currentMonth]);
  const allocations = useBudgetStore(state => 
    state.budgets[state.currentMonth]?.allocations ?? {}
  );
  
  return useMemo(() => {
    const totalIncome = budget?.totalIncome ?? 0;
    const totalAllocated = Object.values(allocations)
      .reduce((sum, a) => sum + a.budgetedAmount, 0);
    return totalIncome - totalAllocated;
  }, [budget, allocations]);
};
```

**Key Insight:** "Available to Budget" should NEVER be stored. It's always derived from `totalIncome - sum(allocations)`.

### 1.4 Offline/PWA Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    OFFLINE-FIRST FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Action → Optimistic Update → Queue Sync → Firebase    │
│       │              │                  │            │       │
│       │              ▼                  │            │       │
│       │     Local State Updated         │            │       │
│       │     (immediate feedback)        │            │       │
│       │              │                  │            │       │
│       │              ▼                  ▼            │       │
│       │     Zustand Persist ←── Sync Queue ──→ Firestore    │
│       │     (IndexedDB)         (pending ops)               │
│       │                                                      │
└─────────────────────────────────────────────────────────────┘
```

**Ideal Offline Strategy:**

1. **Firebase's Built-in Persistence** - Enable `enablePersistence()` and let Firebase handle caching
2. **Optimistic UI** - Update local state immediately, sync in background
3. **Conflict Resolution** - Last-write-wins with timestamps, or explicit merge for conflicts
4. **Sync Queue** - Minimal custom queue only for operations that fail Firebase's built-in retry

```typescript
// IDEAL: Let Firebase handle offline
import { enableIndexedDbPersistence } from 'firebase/firestore';

// Initialize once at app start
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support
  }
});

// Then just use Firebase normally - it handles offline automatically
```

---

## 2. The "Brownfield" Audit (Current State)

### 2.1 Architecture Overview

```
Current Architecture (Actual)
─────────────────────────────
┌─────────────────────────────────────────────────────────────┐
│                         VIEWS                                │
│  EnvelopeListView.tsx (1,148 lines) ◄── GOD COMPONENT       │
│  SettingsView.tsx (26,576 bytes)                            │
│  EnvelopeDetail.tsx, AddTransactionView.tsx, etc.           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ZUSTAND STORES                            │
│  envelopeStore.ts ──┬── envelopeStoreSync.ts (832 lines)    │
│                     ├── envelopeStoreEnvelopes.ts (539 lines)│
│                     ├── envelopeStoreTransactions.ts        │
│                     ├── envelopeStoreTemplates.ts           │
│                     ├── envelopeStoreSettings.ts            │
│                     ├── envelopeStoreRealtime.ts            │
│                     └── envelopeStoreNetwork.ts             │
│                                                              │
│  monthlyBudgetStore.ts (1,044 lines) ◄── SECOND GOD OBJECT  │
│  monthlyBudgetStoreRealtime.ts                              │
│  authStore.ts                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICES                               │
│  EnvelopeService.ts, TransactionService.ts                  │
│  MonthlyBudgetService.ts, AppSettingsService.ts             │
│  DistributionTemplateService.ts                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       FIREBASE                               │
│  users/{userId}/envelopes, transactions, incomeSources,     │
│  envelopeAllocations, monthlyBudgets, appSettings           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 God Objects Identified

#### **God Object #1: `EnvelopeListView.tsx` (1,148 lines)**

This component is doing FAR too much:

```typescript
// CURRENT: EnvelopeListView.tsx - Lines 336-375
export const EnvelopeListView: React.FC = () => {
  // 🚨 PROBLEM: Pulling from TWO stores with massive destructuring
  const { 
    envelopes, transactions, fetchData, isLoading, isOnline, 
    pendingSync, syncData, testingConnectivity, reorderEnvelopes 
  } = useEnvelopeStore();

  const {
    currentMonth, fetchMonthlyData, incomeSources, envelopeAllocations,
    calculateAvailableToBudget, deleteIncomeSource, restoreIncomeSource,
    clearMonthData, copyFromPreviousMonth, setEnvelopeAllocation,
    isLoading: isBudgetLoading,
  } = useMonthlyBudgetStore();
  
  // 🚨 PROBLEM: Business logic in the view layer
  const getEnvelopeBalance = (envelopeId: string) => {
    const envelope = envelopes.find(e => e.id === envelopeId);
    if (envelope?.isPiggybank) {
      return useEnvelopeStore.getState().getEnvelopeBalance(envelopeId);
    }
    // ... 20 more lines of calculation logic
  };
  
  // 🚨 PROBLEM: Complex filtering/sorting in component
  const piggybanks = envelopes.filter(env => {
    if (!env.isPiggybank || !env.isActive) return false;
    // ... date parsing and comparison logic
  });
```

**Issues:**
- Mixes UI rendering with business logic
- Contains balance calculation logic (should be in store/service)
- Has complex filtering logic (should be a selector)
- Manages multiple unrelated concerns (reordering, editing, navigation)
- 1,148 lines is 10x too long for a React component

#### **God Object #2: `monthlyBudgetStore.ts` (1,044 lines)**

```typescript
// CURRENT: monthlyBudgetStore.ts - Lines 78-166
const syncBudgetAllocationTransaction = async (...) => {
  const { transactions, addTransaction, deleteTransaction, updateTransaction } 
    = useEnvelopeStore.getState();
  
  // 🚨 PROBLEM: Cross-store mutation from inside a store
  // 🚨 PROBLEM: 90 lines of transaction sync logic in budget store
  // 🚨 PROBLEM: Date parsing scattered throughout
  const existingTxs = transactions.filter(tx => {
    // ... complex date parsing and matching
    try {
      let txDate;
      if (typeof tx.date === 'string') {
        txDate = new Date(tx.date);
      } else if ((tx.date as any)?.toDate) {
        txDate = (tx.date as any).toDate();
      }
      // ...
    }
  });
```

**Issues:**
- Reaches into `envelopeStore` to mutate transactions
- Contains transaction creation logic (belongs in TransactionService)
- Date parsing logic duplicated throughout
- Mixes budget concerns with transaction concerns

#### **God Object #3: `envelopeStoreSync.ts` (832 lines)**

```typescript
// CURRENT: envelopeStoreSync.ts - Lines 477-688
const importData = async (data: any) => {
  // 🚨 PROBLEM: 200+ lines for a single function
  // 🚨 PROBLEM: Mixes import, sync, and cleanup logic
  // 🚨 PROBLEM: Manual Firebase operations instead of using services
  
  for (const envelope of newEnvelopes) {
    try {
      await EnvelopeService.saveEnvelope(userId, envelope);
    } catch (error) {
      console.error(`❌ Failed to sync envelope ${envelope.name}:`, error);
    }
  }
  
  for (const transaction of newTransactions) {
    // ... another 50 lines
  }
  
  // ... continues for allocations, income sources, settings
};
```

### 2.3 Specific Pain Points

#### **Pain Point #1: Dual Store Architecture**

```typescript
// CURRENT: Two stores that constantly reach into each other
// envelopeStoreSync.ts line 316
const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
const budgetStore = useMonthlyBudgetStore.getState();

// monthlyBudgetStore.ts line 79
const { transactions, addTransaction } = useEnvelopeStore.getState();
```

**Problem:** Circular dependencies and unclear ownership of data.

#### **Pain Point #2: Type Inconsistency**

```typescript
// CURRENT: Amounts stored as strings in Firebase, numbers in app
// types/firestore.ts
export interface FirestoreTransaction {
  amount: string;  // 🚨 String in Firebase
}

// models/types.ts
export interface Transaction {
  amount: number;  // 🚨 Number in app
}

// Conversion scattered everywhere:
// envelopeStoreSync.ts line 122
amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount
```

#### **Pain Point #3: Date Handling Chaos**

```typescript
// CURRENT: Dates handled inconsistently throughout
// Sometimes ISO strings:
date: string; // "2024-01-01T12:00:00Z"

// Sometimes Timestamps:
date: Timestamp;

// Sometimes Date objects:
const txDate = new Date(tx.date);

// Conversion logic duplicated in:
// - envelopeStoreSync.ts (lines 115-124)
// - envelopeStoreEnvelopes.ts (lines 45-55)
// - monthlyBudgetStore.ts (lines 96-108)
// - TransactionService.ts (lines 49-54)
```

#### **Pain Point #4: Manual Offline Sync**

```typescript
// CURRENT: 200+ lines of manual sync logic
// envelopeStoreSync.ts lines 259-458
const syncData = async () => {
  // Sync pending envelope deletions
  for (const envelopeId of state.pendingDeletes) { ... }
  
  // Sync pending transaction deletions
  for (const transactionId of state.pendingDeletedTransactions) { ... }
  
  // Sync pending income source deletions
  for (const incomeSourceId of budgetStore.pendingDeletedIncomeSources) { ... }
  
  // Sync temp envelopes
  for (const tempEnv of tempEnvelopes) { ... }
  
  // Sync temp allocations
  for (const tempAlloc of tempAllocations) { ... }
};
```

**Problem:** Firebase's built-in offline persistence handles most of this automatically.

#### **Pain Point #5: Redundant Balance Calculations**

```typescript
// CURRENT: Balance calculated in multiple places

// EnvelopeListView.tsx lines 411-433
const getEnvelopeBalance = (envelopeId: string) => {
  const envelopeTransactions = transactions.filter(...);
  const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
  // ... calculation
};

// envelopeStore.ts (via slice)
getEnvelopeBalance: (envelopeId: string) => Decimal;

// EnvelopeDetail.tsx (likely has its own)
// TransactionHistoryView.tsx (likely has its own)
```

---

## 3. The Gap Analysis

### 3.1 Data Structures Fighting the Database

| Issue | Current | Ideal | Impact |
|-------|---------|-------|--------|
| **Subcollection Overuse** | `incomeSources` and `envelopeAllocations` are separate subcollections | Embed in `budgets/{month}` document | Extra reads, complex sync |
| **String Amounts** | `amount: string` in Firestore | `amount: number` everywhere | Parsing overhead, bugs |
| **Date Inconsistency** | Mix of ISO strings and Timestamps | Always Timestamps in Firebase | Conversion bugs |
| **Computed Values Stored** | `availableToBudget` stored | Computed on read | Stale data risk |

### 3.2 Logic Scattered Across Layers

| Logic Type | Should Be In | Currently In |
|------------|--------------|--------------|
| Balance calculation | Store selector | View component, Store, multiple places |
| Date parsing | Utility function | Inline in 5+ files |
| Type conversion | Mapper layer | Scattered in stores and services |
| Filtering (piggybanks) | Store selector | View component |
| Available to budget | Derived selector | Stored + recalculated |

### 3.3 Manual Work Firebase Could Handle

| Manual Implementation | Firebase Alternative |
|----------------------|---------------------|
| `pendingDeletes` queue | `enablePersistence()` + automatic retry |
| `pendingSync` flag | Firebase handles offline writes |
| `testingConnectivity` | Firebase connection state listener |
| Real-time sync setup | `onSnapshot` with proper cleanup |
| Temp ID replacement | Firebase generates IDs, use `addDoc` |

### 3.4 Complexity Metrics

| File | Lines | Ideal Max | Over By |
|------|-------|-----------|---------|
| `EnvelopeListView.tsx` | 1,148 | 200 | 5.7x |
| `monthlyBudgetStore.ts` | 1,044 | 300 | 3.5x |
| `envelopeStoreSync.ts` | 832 | 200 | 4.2x |
| `envelopeStoreEnvelopes.ts` | 539 | 200 | 2.7x |
| `SettingsView.tsx` | ~800 | 200 | 4x |

---

## 4. Refactoring Roadmap

### Phase 1: Low-Hanging Fruit (1-2 weeks)

**Goal:** Reduce complexity without structural changes.

#### 1.1 Extract Balance Calculation to Single Location

```typescript
// BEFORE (scattered in views)
const getEnvelopeBalance = (envelopeId: string) => {
  const envelope = envelopes.find(e => e.id === envelopeId);
  if (envelope?.isPiggybank) {
    return useEnvelopeStore.getState().getEnvelopeBalance(envelopeId);
  }
  // ... 20 lines of calculation
};

// AFTER (single selector in store)
// stores/selectors/balanceSelectors.ts
export const useEnvelopeBalance = (envelopeId: string) => {
  return useEnvelopeStore(
    useCallback(state => {
      const envelope = state.envelopes.find(e => e.id === envelopeId);
      const transactions = state.transactions.filter(
        t => t.envelopeId === envelopeId
      );
      
      if (envelope?.isPiggybank) {
        // Cumulative balance for piggybanks
        return transactions.reduce((sum, t) => 
          t.type === 'Income' ? sum.plus(t.amount) : sum.minus(t.amount),
          new Decimal(0)
        );
      }
      
      // Monthly balance for regular envelopes
      const currentMonth = useMonthlyBudgetStore.getState().currentMonth;
      const monthlyTxs = transactions.filter(t => t.month === currentMonth);
      // ... calculation
    }, [envelopeId])
  );
};
```

#### 1.2 Create Date Utility Module

```typescript
// BEFORE (inline everywhere)
if (typeof tx.date === 'string') {
  txDate = new Date(tx.date);
} else if ((tx.date as any)?.toDate) {
  txDate = (tx.date as any).toDate();
}

// AFTER
// utils/dateUtils.ts
export const toDate = (value: string | Timestamp | Date): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value?.toDate) return value.toDate();
  throw new Error(`Invalid date value: ${value}`);
};

export const toISOString = (value: string | Timestamp | Date): string => {
  return toDate(value).toISOString();
};

export const toMonth = (value: string | Timestamp | Date): string => {
  const date = toDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
```

#### 1.3 Create Type Conversion Mappers

```typescript
// BEFORE (inline in multiple stores)
const convertFirebaseTransaction = (firebaseTx: any): Transaction => ({
  id: firebaseTx.id,
  date: firebaseTx.date?.toDate?.() ? firebaseTx.date.toDate().toISOString() : firebaseTx.date,
  amount: parseFloat(firebaseTx.amount) || 0,
  // ...
});

// AFTER
// mappers/transactionMapper.ts (already exists, expand it)
import { toISOString } from '../utils/dateUtils';

export const fromFirestore = (doc: FirestoreTransaction): Transaction => ({
  id: doc.id,
  date: toISOString(doc.date),
  amount: typeof doc.amount === 'string' ? parseFloat(doc.amount) : doc.amount,
  description: doc.description ?? '',
  envelopeId: doc.envelopeId,
  reconciled: doc.reconciled ?? false,
  type: normalizeTransactionType(doc.type),
  month: doc.month ?? toMonth(doc.date),
});

export const toFirestore = (tx: Transaction): FirestoreTransaction => ({
  ...tx,
  amount: tx.amount.toString(),
  date: Timestamp.fromDate(new Date(tx.date)),
  type: tx.type.toLowerCase() as FirestoreTransactionType,
});
```

#### 1.4 Extract EnvelopeListView Logic to Custom Hook

```typescript
// BEFORE: 1,148 line component

// AFTER: ~200 line component + ~300 line hook
// hooks/useEnvelopeList.ts
export const useEnvelopeList = () => {
  const { envelopes, transactions, fetchData, isLoading } = useEnvelopeStore();
  const { currentMonth, incomeSources, envelopeAllocations } = useMonthlyBudgetStore();
  
  // All the filtering, sorting, and derived state
  const visibleEnvelopes = useMemo(() => 
    envelopes
      .filter(env => !env.isPiggybank && env.isActive !== false)
      .filter(env => envelopeAllocations.some(a => a.envelopeId === env.id))
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [envelopes, envelopeAllocations]
  );
  
  const piggybanks = useMemo(() => 
    envelopes.filter(env => env.isPiggybank && env.isActive),
    [envelopes]
  );
  
  const availableToBudget = useMemo(() => {
    const totalIncome = incomeSources.reduce((sum, s) => sum + s.amount, 0);
    const totalAllocated = envelopeAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0);
    return totalIncome - totalAllocated;
  }, [incomeSources, envelopeAllocations]);
  
  return {
    visibleEnvelopes,
    piggybanks,
    availableToBudget,
    isLoading,
    // ... other derived state and handlers
  };
};

// views/EnvelopeListView.tsx - Now just renders
export const EnvelopeListView: React.FC = () => {
  const { visibleEnvelopes, piggybanks, availableToBudget } = useEnvelopeList();
  
  return (
    <div>
      <AvailableToBudget amount={availableToBudget} />
      <EnvelopeSection envelopes={visibleEnvelopes} />
      <PiggybankSection piggybanks={piggybanks} />
    </div>
  );
};
```

### Phase 2: Structural Changes (2-4 weeks)

**Goal:** Consolidate stores and establish clear boundaries.

#### 2.1 Merge Stores into Single BudgetStore

```typescript
// BEFORE: Two stores with circular dependencies
// useEnvelopeStore + useMonthlyBudgetStore

// AFTER: Single unified store
// stores/budgetStore.ts
interface BudgetStore {
  // === DATA ===
  envelopes: Envelope[];
  transactions: Transaction[];
  currentMonth: string;
  incomeSources: Record<string, IncomeSource[]>;  // Keyed by month
  allocations: Record<string, EnvelopeAllocation[]>;  // Keyed by month
  
  // === UI STATE ===
  isLoading: boolean;
  isOnline: boolean;
  
  // === ACTIONS ===
  // Envelope actions
  createEnvelope: (envelope: Omit<Envelope, 'id'>) => Promise<Envelope>;
  updateEnvelope: (id: string, updates: Partial<Envelope>) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  
  // Transaction actions
  addTransaction: (tx: Omit<Transaction, 'id'>) => Promise<Transaction>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Budget actions
  setAllocation: (envelopeId: string, amount: number) => Promise<void>;
  addIncomeSource: (source: Omit<IncomeSource, 'id'>) => Promise<void>;
  
  // Month actions
  setCurrentMonth: (month: string) => void;
  copyFromPreviousMonth: () => Promise<void>;
}
```

#### 2.2 Introduce Repository Layer

```typescript
// BEFORE: Services called directly from stores with inline conversions

// AFTER: Repositories handle all Firebase + conversion
// repositories/TransactionRepository.ts
export class TransactionRepository {
  constructor(private userId: string) {}
  
  async getAll(): Promise<Transaction[]> {
    const snapshot = await getDocs(this.collectionRef);
    return snapshot.docs.map(doc => fromFirestore(doc.data()));
  }
  
  async getByMonth(month: string): Promise<Transaction[]> {
    const q = query(this.collectionRef, where('month', '==', month));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => fromFirestore(doc.data()));
  }
  
  async create(tx: Omit<Transaction, 'id'>): Promise<Transaction> {
    const docRef = await addDoc(this.collectionRef, toFirestore(tx));
    return { ...tx, id: docRef.id };
  }
  
  subscribe(callback: (txs: Transaction[]) => void): Unsubscribe {
    return onSnapshot(this.collectionRef, snapshot => {
      callback(snapshot.docs.map(doc => fromFirestore(doc.data())));
    });
  }
  
  private get collectionRef() {
    return collection(db, 'users', this.userId, 'transactions');
  }
}
```

#### 2.3 Simplify Offline Handling

```typescript
// BEFORE: 200+ lines of manual sync logic

// AFTER: Let Firebase handle it
// firebase.ts
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: false,
});

// Enable offline persistence (Firebase handles sync automatically)
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Offline persistence failed:', err.code);
});

// Simple online/offline state
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};
```

### Phase 3: Data Migration (1-2 weeks)

**Goal:** Optimize Firestore schema for reads.

#### 3.1 Embed Allocations in Budget Document

```typescript
// Migration script
async function migrateAllocations(userId: string) {
  const months = await getDistinctMonths(userId);
  
  for (const month of months) {
    // Read current allocations
    const allocations = await getEnvelopeAllocations(userId, month);
    const incomeSources = await getIncomeSources(userId, month);
    
    // Write to new embedded structure
    await setDoc(doc(db, 'users', userId, 'budgets', month), {
      allocations: Object.fromEntries(
        allocations.map(a => [a.envelopeId, {
          budgetedAmount: a.budgetedAmount,
          createdAt: a.createdAt,
        }])
      ),
      incomeSources: incomeSources.map(s => ({
        id: s.id,
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
      })),
      totalIncome: incomeSources.reduce((sum, s) => sum + s.amount, 0),
      updatedAt: Timestamp.now(),
    });
  }
}
```

#### 3.2 Normalize Amount Types

```typescript
// Migration: Convert string amounts to numbers
async function normalizeAmounts(userId: string) {
  const transactions = await TransactionService.getAllTransactions(userId);
  
  for (const tx of transactions) {
    if (typeof tx.amount === 'string') {
      await updateDoc(doc(db, 'users', userId, 'transactions', tx.id), {
        amount: parseFloat(tx.amount),
      });
    }
  }
}
```

#### 3.3 Add Month Field to All Transactions

```typescript
// Migration: Ensure all transactions have month field
async function addMonthField(userId: string) {
  const transactions = await TransactionService.getAllTransactions(userId);
  
  for (const tx of transactions) {
    if (!tx.month) {
      const month = toMonth(tx.date);
      await updateDoc(doc(db, 'users', userId, 'transactions', tx.id), {
        month,
      });
    }
  }
}
```

---

## Summary

### Critical Issues (Fix First)
1. **EnvelopeListView is a God Component** - Extract to hook + presentational component
2. **Two stores with circular dependencies** - Merge into single BudgetStore
3. **Manual offline sync** - Replace with Firebase's built-in persistence
4. **Type inconsistencies** - Centralize all conversions in mapper layer

### Medium Priority
1. Date handling scattered - Create `dateUtils.ts`
2. Balance calculation duplicated - Single selector
3. Services doing too little - Expand to Repository pattern

### Nice to Have
1. Schema optimization (embed allocations)
2. Amount type normalization
3. Comprehensive test coverage

### Estimated Timeline
- **Phase 1:** 1-2 weeks (immediate complexity reduction)
- **Phase 2:** 2-4 weeks (structural improvements)
- **Phase 3:** 1-2 weeks (data migration)

**Total: 4-8 weeks for complete refactor**

---

*Document generated: 2026-01-15*
