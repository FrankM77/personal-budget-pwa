# Architecture Evolution: From Brownfield to Greenfield

**Date:** February 5, 2026  
**Status:** Complete - Production Ready Architecture ✅

This document combines the original thirty-thousand-foot analysis, the post-implementation audit, and the complete roadmap review to show the complete evolution of the Personal Budget PWA architecture.

---

## Table of Contents
1. [The Original "Brownfield" State](#1-the-original-brownfield-state)
2. [The "Greenfield" Ideal](#2-the-greenfield-ideal)
3. [The Great Refactor](#3-the-great-refactor)
4. [Post-Implementation Audit](#4-post-implementation-audit)
5. [Current Architecture](#5-current-architecture)
6. [Lessons Learned](#6-lessons-learned)

---

## 1. The Original "Brownfield" State

### Critical Issues Identified

#### **God Object #1: `EnvelopeListView.tsx` (1,148 lines)**
- Mixed UI rendering with business logic
- Contained balance calculation logic (should be in store/service)
- Had complex filtering logic (should be a selector)
- Managed multiple unrelated concerns (reordering, editing, navigation)

#### **God Object #2: `monthlyBudgetStore.ts` (1,044 lines)**
- Cross-store mutation from inside a store
- 90 lines of transaction sync logic in budget store
- Date parsing logic duplicated throughout
- Mixed budget concerns with transaction concerns

#### **God Object #3: `envelopeStoreSync.ts` (832 lines)**
- 200+ lines for a single function
- Mixed import, sync, and cleanup logic
- Manual Firebase operations instead of using services

### Specific Pain Points

1. **Dual Store Architecture** - Two stores with circular dependencies
2. **Type Inconsistency** - Amounts stored as strings in Firebase, numbers in app
3. **Date Handling Chaos** - Inconsistent date handling throughout codebase
4. **Manual Offline Sync** - 200+ lines of manual sync logic fighting Firebase's native capabilities
5. **Redundant Balance Calculations** - Same logic in multiple places

---

## 2. The "Greenfield" Ideal

### Target Architecture Pattern

| Layer | Technology | Pattern |
|-------|------------|---------|
| **View** | React + TypeScript | Presentational Components (dumb) |
| **ViewModel** | Custom Hooks | MVVM - One hook per view |
| **Domain** | Pure TypeScript Classes | Domain-Driven Design |
| **Service** | Firebase SDK Wrappers | Repository Pattern |
| **State** | Zustand (single store) | Single Source of Truth |

### Ideal Firestore Schema

```
users/{userId}/
├── profile                          # User settings document
├── budgets/{month}/                 # e.g., "2025-01"
│   ├── totalIncome: number
│   ├── availableToBudget: number    # COMPUTED on write, not read
│   ├── incomeSources: [             # EMBEDDED array
│   │   { id, name, amount, frequency }
│   │ ]
│   └── allocations: {               # EMBEDDED map
│       [envelopeId]: { budgetedAmount, spent, remaining }
│     }
├── envelopes/{envelopeId}/
└── transactions/{transactionId}/
```

### Key Design Principles

1. **Embed what you read together** - Income sources and allocations embedded in budget document
2. **Denormalize for queries** - `month` field on transactions for efficient queries
3. **Compute on write, not read** - `availableToBudget` calculated when income/allocations change
4. **Consistent types** - Amounts always numbers, dates always Timestamps

---

## 3. The Great Refactor (January 2026)

### Phase 1: Low-Hanging Fruit ✅ **COMPLETE**

#### 1.1 Extract Balance Calculation to Single Location ✅
**Status:** Moved to `src/hooks/useEnvelopeList.ts`
- Centralized balance calculation logic with proper memoization
- Eliminated duplicate calculations in multiple components

#### 1.2 Create Date Utility Module ✅
**Status:** `src/utils/dateUtils.ts` is now the source of truth
- Universal date converter with comprehensive type handling
- Replaced all manual date constructions throughout codebase

#### 1.3 Create Type Conversion Mappers ✅
**Status:** `src/mappers/transaction.ts` enforces strict type safety
- Safe conversion with amount type enforcement (string → number)
- Standardized across all services and stores

#### 1.4 Extract EnvelopeListView Logic to Custom Hook ✅
**Status:** `src/hooks/useEnvelopeList.ts` created
- All filtering, sorting, and derived state logic extracted
- Component reduced from 1,148 lines to manageable size

### Phase 2: Structural Changes ✅ **COMPLETE**

#### 2.1 Merge Stores into Single BudgetStore ✅
- Merged `envelopeStore` and `monthlyBudgetStore` into unified `BudgetStore`
- Eliminated circular dependencies and simplified state management
- Single source of truth for all budget-related data

#### 2.2 Simplify Offline Handling ✅
- Dismantled custom "Nervous System" sync queue
- Now using Firebase's native `enableIndexedDbPersistence`
- Automatic sync with optimistic UI updates

### Phase 3: Data Migration ✅ **COMPLETE**

#### 3.1 Embed Allocations in Budget Document ✅
- `BudgetService` now reads/writes income sources and allocations as embedded data
- 90% reduction in read costs for budget views

#### 3.2 Normalize Amount Types ✅
- Transaction mapper enforces numeric types
- `BudgetService` casts embedded values to `Number()`

#### 3.3 Add Month Field to All Transactions ✅
- All transactions denormalized with month field
- Efficient monthly queries without expensive date filtering

---

## 4. Post-Implementation Audit

### Architecture Scorecard

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Single Source of Truth** | ⭐⭐⭐⭐⭐ | Unified `BudgetStore` achieved |
| **Offline-First** | ⭐⭐⭐⭐ | Native Firebase persistence working |
| **Type Safety** | ⭐⭐⭐⭐⭐ | Normalized amounts, proper mappers |
| **Separation of Concerns** | ⭐⭐⭐⭐ | Clean layers; minor improvements possible |
| **Performance** | ⭐⭐⭐⭐ | Embedded schema reduces reads |
| **Maintainability** | ⭐⭐⭐⭐ | Good structure; some code duplication to clean |
| **Scalability** | ⭐⭐⭐ | Fine for personal use; would need transactions for multi-user |

**Overall:** ⭐⭐⭐⭐ (4/5) - **Production-Ready Architecture**

### Validated Improvements

1. **Unified Architecture** - Single `BudgetStore` eliminates circular dependencies
2. **Native Offline** - Firebase's persistence handles all offline operations automatically
3. **Optimized Data Layer** - Embedded allocations reduce read operations by 90%
4. **Type Safety** - Strict mappers prevent data corruption
5. **MVVM Pattern** - Clean separation between views and business logic

### Minor Remaining Issues

1. **Code Duplication** - Some repeated patterns in store actions
2. **Error Handling** - Inconsistent error handling patterns
3. **Repository Pattern** - Could be stricter for testability (low priority)

---

## 5. Current Architecture

### The "Greenfield" Reality

```
Current Architecture (Achieved)
─────────────────────────────
┌─────────────────────────────────────────────────────────────┐
│                         VIEWS                                │
│  EnvelopeListView.tsx (MVVM pattern, <200 lines)             │
│  SettingsView.tsx, AddTransactionView.tsx, etc.             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    VIEWMODELS (Hooks)                        │
│  useEnvelopeList.ts (derived state, business logic)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED STORE                              │
│  budgetStore.ts (single source of truth)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICE                                │
│  BudgetService.ts (Firebase + embedded data)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       FIREBASE                               │
│  users/{userId}/monthlyBudgets/{month} (embedded allocations)│
│  users/{userId}/envelopes, transactions, categories         │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

*   **Unified Store:** Single `BudgetStore` eliminates circular dependencies
*   **Embedded Data:** Income sources and allocations embedded in monthly budget documents
*   **Native Offline:** Firebase's `enableIndexedDbPersistence` handles all offline operations
*   **Type Safety:** Strict mappers enforce data consistency between Firebase and app
*   **MVVM Pattern:** Views are presentational, ViewModels (hooks) contain business logic

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Firestore Reads** | 10-15 per budget view | 1-2 per budget view | 90% reduction |
| **Store Complexity** | 2 stores with circular deps | 1 unified store | Simplified |
| **Code Duplication** | High (date parsing, conversions) | Low (centralized utils) | DRY principle |
| **Offline Reliability** | Custom queue (buggy) | Native Firebase | Rock solid |

---

## 6. Lessons Learned

### What Worked Well

1. **Incremental Refactoring** - Phase-based approach prevented breaking changes
2. **Centralized Utilities** - `dateUtils` and `mappers` eliminated entire classes of bugs
3. **MVVM Pattern** - Custom hooks provided clean separation of concerns
4. **Firebase Native Features** - Leveraging built-in persistence simplified architecture

### What Could Be Better

1. **Earlier Architecture Planning** - Original "brownfield" state could have been avoided
2. **Consistent Error Handling** - Should have standardized error patterns from start
3. **Testing Strategy** - More comprehensive testing would have caught issues earlier

### Recommendations for Future Projects

1. **Start with Unified Store** - Avoid dual store architectures
2. **Use Platform Features** - Don't fight Firebase's built-in capabilities
3. **Invest in Type Safety** - Strict mappers prevent entire categories of bugs
4. **Plan for MVVM** - Separate views from business logic from day one

---

## Conclusion

The "Great Refactor" transformed a tangled dual-store architecture with manual sync queues into a clean, unified system that leverages Firebase's native capabilities. The architecture is now "ideal" for its intended purpose: a personal, offline-first Zero-Based Budgeting PWA.

**The architecture is production-ready and optimized for the intended use case.** Future development can focus entirely on feature development rather than architectural surgery.

---

*Document created: February 5, 2026*  
*Combined from: Thirty-thousand-foot-view.MD, Post-implementation-audit.MD, Complete-Roadmap-Review.md*
