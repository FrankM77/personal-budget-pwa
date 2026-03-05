# Comprehensive App Review — Personal Budget PWA

**Date**: March 5, 2026  
**Version Reviewed**: v1.14.6  
**Scope**: Full codebase audit — bugs, data integrity, security, performance, UX/UI, architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What the App Does Well](#what-the-app-does-well)
3. [Bugs Found](#bugs-found)
4. [Data Integrity Issues](#data-integrity-issues)
5. [Security Review](#security-review)
6. [Performance & Bundle](#performance--bundle)
7. [Architecture & Code Quality](#architecture--code-quality)
8. [UX/UI Review](#uxui-review)
9. [PWA-Specific Review](#pwa-specific-review)
10. [Prioritized Recommendations](#prioritized-recommendations)

---

## Executive Summary

The app is a **well-built, feature-rich envelope budgeting PWA** with real-time Firestore sync, soft-delete with undo, split transactions, piggybanks, Siri integration, and multi-device support. The architecture (Zustand slices + service singletons + real-time listeners) is sound and maintainable. The recent refactor significantly improved stability.

**Key findings:**
- **5 bugs** (2 high severity, 3 medium)
- **4 data integrity risks** (1 high, 3 medium)
- **2 security improvements** recommended
- **6 UX/UI refinements** identified
- **3 performance optimizations** available

---

## What the App Does Well

### Architecture
- **Clean separation of concerns** — Service layer (`budgetService.ts`) handles all Firestore interaction, Zustand slices handle state, views handle presentation
- **Singleton service pattern** — `BudgetService.getInstance()` prevents duplicate instances
- **Optimistic updates** — Local state updates first, backend fire-and-forget. This gives the app a snappy, native feel
- **Real-time sync** — Cross-device/tab sync via Firestore `onSnapshot` listeners with intelligent deduplication
- **Pending deletion tracking** — `pendingTransactionDeletions` Set prevents the real-time listener from overwriting optimistic deletes — an elegant race condition fix

### Features
- **Soft-delete with undo** — Proper implementation across envelopes, transactions, and income sources
- **Split transactions** — GroupId-based linking with correct display aggregation
- **Piggybanks** — Separate savings tracking with cumulative balance calculation across months
- **Backup/Restore** — Full JSON export/import with progress overlay
- **Siri integration** via token-based API
- **Category organization** — Envelopes grouped into user-defined categories
- **Copy previous month** — Smart allocation copying that respects piggybank pausing
- **Self-healing** — `verifyAndRepairAllocations` auto-fixes allocation/transaction mismatches

### Code Quality
- **TypeScript throughout** with well-defined interfaces in `models/types.ts`
- **Error boundaries** at the app root with dev-mode error details
- **Firebase App Check** (ReCaptcha Enterprise) for API abuse prevention
- **Firestore persistence** with multi-tab support
- **Dark mode** with system preference detection
- **Comprehensive logging** via custom logger

---

## Bugs Found

### BUG-1: `getTransactions` does not filter soft-deleted transactions [HIGH]

**File**: `src/services/budgetService.ts:220-238`  
**Impact**: When `fetchAllTransactions()` is called (e.g., "All Time" toggle in Transaction History), **all soft-deleted transactions are returned** and displayed in the UI.

```typescript
// getTransactions does NOT filter deletedAt
async getTransactions(userId: string): Promise<Transaction[]> {
  const snapshot = await getDocs(q);
  const transactions = snapshot.docs.map(doc => {
    const firebaseTx = { id: doc.id, ...doc.data() } as any;
    return fromFirestore(firebaseTx);
  });
  // Missing: .filter(tx => !tx.deletedAt)
  return transactions;
}
```

Compare with `getTransactionsByMonth` (line 267) and `getTransactionsByEnvelope` (line 301) which both correctly filter `.filter(tx => !tx.deletedAt)`.

**Fix**: Add `.filter(tx => !tx.deletedAt)` to `getTransactions()` return.

---

### BUG-2: `getDeletedTransactions` fetches ALL transactions to find deleted ones [HIGH]

**File**: `src/services/budgetService.ts:607-632`  
**Impact**: This method calls `getDocs` on the **entire transactions collection** without any query filter, then filters client-side. For users with thousands of transactions, this is both a performance problem and a cost problem (Firestore reads are billed per document).

```typescript
async getDeletedTransactions(userId: string, month: string): Promise<Transaction[]> {
  const collectionRef = collection(db, 'users', userId, 'transactions');
  const snapshot = await getDocs(collectionRef); // Reads EVERY transaction
  // Then filters client-side...
}
```

**Fix**: Add a Firestore `where` clause for `deletedAt != null` or at minimum `where('month', '==', month)` to narrow the scan.

---

### BUG-3: Envelope real-time listener does not filter soft-deleted envelopes [MEDIUM]

**File**: `src/stores/envelopeStoreRealtime.ts:73-90`  
**Impact**: The `subscribeToEnvelopes` callback maps all Firebase envelopes through `convertFirebaseEnvelope` but **never checks `deletedAt`**. A soft-deleted envelope could briefly reappear in the UI if the real-time listener fires between the optimistic delete and the backend write completing.

The logic at lines 84-87 tries to preserve locally-deleted envelopes but doesn't explicitly filter `env.deletedAt`, so a soft-deleted envelope from Firebase (with `deletedAt` set) would be included in the `updatedEnvelopes` array.

**Fix**: Add `.filter(env => !env.deletedAt)` after the `convertFirebaseEnvelope` map step.

---

### BUG-4: `resetData` does not clear `categories` or `loadedTransactionMonths` [MEDIUM]

**File**: `src/stores/budgetStoreData.ts:369-377`

```typescript
set({
  envelopes: [],
  transactions: [],
  appSettings: null,
  incomeSources: {},
  allocations: {},
  isLoading: false,
  error: null
});
// Missing: categories: [], loadedTransactionMonths: [], areAllTransactionsLoaded: false
```

**Impact**: After a reset, stale categories remain in state and `loadedTransactionMonths` is stale, which could cause `fetchTransactionsForMonth` to skip fetching because it thinks months are already loaded. The `areAllTransactionsLoaded` flag also persists as `true`, meaning subsequent calls to `fetchAllTransactions` would return early with empty data.

**Fix**: Add `categories: []`, `loadedTransactionMonths: []`, `areAllTransactionsLoaded: false` to the reset state.

---

### BUG-5: `deleteAllUserData` reads `incomeSources` and `envelopeAllocations` collections that may not exist [LOW]

**File**: `src/services/budgetService.ts:1169-1177`

```typescript
const collections = [
  'envelopes', 'transactions', 'categories',
  'incomeSources',       // Legacy — data is now embedded in monthlyBudgets
  'envelopeAllocations', // Legacy — data is now embedded in monthlyBudgets
  'monthlyBudgets', 'appSettings'
];
```

**Impact**: Not a crash-causing bug since empty collections are handled gracefully, but it adds unnecessary Firestore reads for collections that no longer exist in the current data model. Every wipe reads 7 collections when only 5 are needed.

**Fix**: Remove `incomeSources` and `envelopeAllocations` from the list, or keep them as cleanup for legacy data migration (document intent with a comment).

---

## Data Integrity Issues

### DI-1: No automatic cleanup of soft-deleted items [HIGH]

**Impact**: Soft-deleted items accumulate indefinitely in Firestore. The UI says "Deleted items are kept for 30 days" but there is **no scheduled cleanup job** to actually enforce this. Over time, this will:
- Increase Firestore storage costs
- Slow down queries that scan full collections (e.g., `getDeletedTransactions`)
- Show items in "Recently Deleted" far beyond 30 days

**Fix**: Either:
- Add a Firebase Cloud Function triggered on a schedule (e.g., daily) that hard-deletes items where `deletedAt < 30 days ago`
- Or add client-side cleanup during `init()` that checks and purges expired soft-deleted items

---

### DI-2: `getEnvelopeBalance` for piggybanks depends on all transactions being loaded [MEDIUM]

**File**: `src/stores/budgetStoreTransactions.ts:311-326`

```typescript
if (envelope.isPiggybank) {
  const envelopeTransactions = state.transactions.filter(t => 
    t.envelopeId === envelopeId && 
    (!t.month || t.month <= viewMonth)
  );
  // ... calculates cumulative balance
}
```

**Impact**: Piggybank balances are only correct if **all historical transactions for that envelope have been loaded**. If only the current month's transactions are in memory (the default lazy-load behavior), the piggybank balance will be incorrect — potentially showing $0 for a piggybank with months of contributions.

The `fetchTransactionsForEnvelope` call in `EnvelopeDetail.tsx:79-82` partially mitigates this, but the balance shown on the **main list view** (`EnvelopeListView.tsx`) does not trigger this fetch. Piggybank balances on the main list may be wrong until the user visits the detail view.

**Fix**: Either fetch all transactions for piggybank envelopes during `init()`, or store a computed `cumulativeBalance` field on the piggybank envelope document in Firestore.

---

### DI-3: `updateIncomeSource` uses fire-and-forget read-modify-write [MEDIUM]

**File**: `src/services/budgetService.ts:707-731`

```typescript
async updateIncomeSource(...) {
  // Read-modify-write pattern for array update
  getDoc(docRef).then((snap: any) => {
    // ... modify and write back
  }).catch((err: any) => logger.warn(`Update income failed: ${err}`));
}
```

**Impact**: This is a non-awaited read-modify-write on an embedded Firestore array. If two concurrent updates happen (e.g., user edits income source on phone and tablet simultaneously), the last write wins and one update is silently lost. This is inherent to the optimistic pattern, but the `getDoc` read happens asynchronously after the function returns, meaning the caller has no way to know if the update succeeded.

**Note**: This is an accepted trade-off for the optimistic UX pattern, but worth documenting.

---

### DI-4: Transfer transactions use `Date.now()` for transferId [LOW]

**File**: `src/stores/budgetStoreTransactions.ts:170`

```typescript
const transferId = `transfer-${Date.now()}-${Math.random()}`;
```

**Impact**: `Math.random()` is not cryptographically secure and `Date.now()` has millisecond resolution. In practice, the collision probability is negligible for a single-user app, but if this ever becomes multi-user or high-frequency, a proper UUID would be safer.

---

## Security Review

### SEC-1: Firebase configuration is properly env-variable based ✅

`src/firebase.ts` loads all config from `import.meta.env.VITE_*` — no hardcoded keys. App Check with ReCaptcha Enterprise is enabled.

### SEC-2: `siriToken` stored in Firestore without expiry

**File**: `models/types.ts:92`  
**Impact**: The Siri token is a simple 16-character hex string stored in `appSettings`. It has no expiry, no rotation schedule, and no rate limiting on the token itself. If leaked, it provides permanent access to the user's transaction parsing endpoint.

**Recommendation**: Add a `siriTokenCreatedAt` field and optionally auto-rotate tokens after 90 days. The Cloud Function should reject tokens older than the configured max age.

### SEC-3: No input sanitization on backup import

**File**: `src/services/budgetService.ts:40-141`  
**Impact**: `restoreUserData` writes `backupData` items directly to Firestore with only a userId override. A maliciously crafted backup file could inject unexpected fields into Firestore documents. While Firestore Security Rules should catch any cross-user writes, the method does not validate the schema of each item.

**Recommendation**: Add basic schema validation to `restoreUserData` — at minimum, verify that required fields exist and types match expectations before writing.

---

## Performance & Bundle

### PERF-1: Bundle size is 1.83MB (541KB gzipped)

The single `index.js` chunk is quite large. Main contributors:
- **Framer Motion** — animation library used for toast, transitions
- **Firebase SDK** — largest contributor
- **Moveable** — drag/drop library for envelope reordering

**Recommendation**: Consider code-splitting with `React.lazy()` for:
- `AnalyticsView` (26KB) — only loaded when user navigates to analytics
- `NewUserOnboarding` (42KB) — only needed for new users
- `LogViewer` (13KB) — only accessible via hidden long-press
- `ExportModal` (21KB) — only needed on demand

### PERF-2: `EnvelopeListItem` recalculates transactions on every render

**File**: `src/views/EnvelopeListView.tsx:83-90`

```typescript
const envelopeTransactions = transactions.filter(t => 
  t.envelopeId === env.id && t.month === currentMonth
);
const expenses = envelopeTransactions.filter(t => t.type === 'Expense');
// ...
```

This runs for **every envelope on every re-render** of the list. With 30+ envelopes and 200+ transactions, this is O(envelopes × transactions) per render.

**Recommendation**: Memoize with `useMemo` or pre-compute a `Map<envelopeId, { totalSpent, totalIncome }>` once at the list level and pass computed values down.

### PERF-3: Excessive logging in production

Multiple files log full transaction arrays, including:
- `TransactionHistoryView.tsx:87-92` logs ALL transaction months every filter change
- `TransactionHistoryView.tsx:193-203` logs all filtered transactions after every filter

**Recommendation**: Guard verbose logging behind `if (import.meta.env.DEV)` checks, or configure the custom logger to suppress verbose messages in production builds.

---

## Architecture & Code Quality

### ARCH-1: Duplicated `requireAuth` helper across 5 files

Each store slice has its own copy of:
```typescript
const requireAuth = () => {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};
```

**Recommendation**: Extract to a shared utility, e.g., `src/utils/auth.ts`.

### ARCH-2: Service layer duplication

Both `BudgetService` and standalone services (`TransactionService`, `EnvelopeService`, etc.) exist. The standalone services are mainly used for real-time subscriptions while `BudgetService` handles CRUD. This creates confusion about which service to use for what.

**Recommendation**: Either consolidate all operations into `BudgetService` (current trend), or clearly document which service owns which operations.

### ARCH-3: `cleanupOrphanedData` still references legacy `envelopeAllocations` collection

**File**: `src/services/budgetService.ts:991-1016`

The cleanup function queries both the legacy `envelopeAllocations` collection and the current embedded `monthlyBudgets` collection. Since allocations moved to embedded format, the legacy query is likely scanning an empty collection on every cleanup run.

**Recommendation**: Remove the legacy collection scan after confirming no users have orphaned legacy data.

### ARCH-4: `isLoading` flag is shared globally

Every action sets `isLoading: true` on the global store. If two actions fire concurrently (e.g., adding a transaction while fetching month data), the first to complete sets `isLoading: false`, potentially hiding the loading state for the still-running action.

**Recommendation**: Use per-feature loading flags (e.g., `isTransactionLoading`, `isEnvelopeLoading`) or a loading counter.

---

## UX/UI Review

### UX-1: No confirmation before restoring from backup

**File**: `src/views/SettingsView.tsx:220-266`

Selecting a backup file immediately starts the restore process, which **wipes all existing data first**. There is no confirmation dialog. A user who accidentally selects a file (or picks the wrong file) loses all current data with no way to cancel.

**Recommendation**: Add a confirmation modal showing what will be imported (e.g., "This will replace your current data with: 30 envelopes, 150 transactions, 14 months of budget data. Continue?").

### UX-2: No "Empty State" guidance for new months

When a user navigates to a new month with no allocations or transactions, they see an empty envelope list with no guidance on what to do. The "Copy Previous Month" prompt exists but may not be immediately visible.

**Recommendation**: Make the copy prompt more prominent, or show a clear empty state card like "This month is empty. Copy last month's budget or start fresh."

### UX-3: Toast position can overlap bottom navigation

**File**: `src/components/ui/Toast.tsx:29`

```typescript
className="fixed bottom-24 right-6 z-[110] max-w-xs"
```

The toast is positioned at `bottom-24` (96px), and the bottom navigation bar is approximately 80px tall. On smaller screens or with safe-area-inset-bottom, the toast may overlap or be partially hidden behind the navigation.

**Recommendation**: Use `bottom-[calc(6rem+env(safe-area-inset-bottom)+1rem)]` or similar to account for the nav bar + safe area.

### UX-4: Progress bar labels inconsistent in "Available to Budget"

The `AvailableToBudget.tsx` component shows income vs. allocated, but the terminology differs from the envelope detail view. "Available to Budget" in one place refers to unallocated income, while in another it refers to unspent allocation.

**Recommendation**: Standardize terminology: "Unallocated" for income not yet assigned, "Remaining" for budget minus spending.

### UX-5: No visual indicator for overbudgeted state

When total allocations exceed total income (overbudgeted), there's no prominent warning. The "Available to Budget" number goes negative, but there's no red warning banner or alert.

**Recommendation**: Show a warning when `availableToBudget < 0` with a message like "You've allocated $X more than your income this month."

### UX-6: Date range filter UX could be streamlined

The date range filter requires a toggle to enable, then manual start/end date entry. Common use cases like "Last 7 days", "Last 30 days", "This month" require manual date calculation by the user.

**Recommendation**: Add preset buttons (7d / 30d / 90d / Custom) that auto-populate the date range.

---

## PWA-Specific Review

### PWA-1: Firestore persistence is correctly configured ✅

```typescript
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
```

Multi-tab persistence is enabled, which is best practice for PWAs.

### PWA-2: Offline experience could be improved

While Firestore persistence handles data availability offline, the app doesn't provide clear feedback about the offline state beyond the yellow "Offline Access" banner. Operations that fail silently (fire-and-forget writes) when offline will queue in Firestore's offline cache, but there's no indication to the user that changes are pending sync.

**Recommendation**: Show a subtle "Changes pending sync" indicator when the app detects offline + pending writes.

### PWA-3: Service Worker uses generateSW mode ✅

The Vite PWA plugin uses `generateSW` mode with precaching, which is appropriate for this app size. All 15 assets are precached.

---

## Prioritized Recommendations

### Critical (Fix Now)
| # | Issue | Effort |
|---|-------|--------|
| BUG-1 | `getTransactions` missing soft-delete filter | 1 line |
| BUG-4 | `resetData` not clearing categories/loadedMonths | 3 lines |
| DI-1 | No cleanup of expired soft-deleted items | Cloud Function (medium) |

### High (Fix Soon)
| # | Issue | Effort |
|---|-------|--------|
| BUG-2 | `getDeletedTransactions` full collection scan | Small refactor |
| BUG-3 | Envelope realtime listener missing deletedAt filter | 1 line |
| DI-2 | Piggybank balance incorrect on main list | Medium |
| UX-1 | No confirmation before restore | Small modal |

### Medium (Plan For)
| # | Issue | Effort |
|---|-------|--------|
| PERF-1 | Code-split large views | Medium refactor |
| PERF-2 | Memoize envelope list calculations | Small refactor |
| PERF-3 | Strip verbose logging in production | Small |
| UX-3 | Toast overlapping bottom nav | CSS tweak |
| UX-5 | No overbudget warning | Small component |
| ARCH-4 | Shared isLoading flag race condition | Medium refactor |

### Low (Nice To Have)
| # | Issue | Effort |
|---|-------|--------|
| SEC-2 | Siri token rotation | Small |
| SEC-3 | Backup import schema validation | Medium |
| ARCH-1 | Deduplicate requireAuth | Trivial |
| ARCH-2 | Consolidate service layer | Large refactor |
| UX-6 | Date range presets | Small |
| BUG-5 | Legacy collection cleanup | Trivial |

---

## Summary Statistics

| Category | Count | Breakdown |
|----------|-------|-----------|
| Bugs | 5 | 2 high, 2 medium, 1 low |
| Data Integrity | 4 | 1 high, 2 medium, 1 low |
| Security | 2 | 2 medium |
| Performance | 3 | 1 high, 2 medium |
| Architecture | 4 | 4 medium |
| UX/UI | 6 | 1 high, 5 medium |
| PWA | 1 | 1 low |

**Overall Health Score: 8/10** — The app is well-architected and functional. The most impactful bugs (BUG-1, BUG-4) are simple fixes. The biggest improvement opportunities are in data integrity (soft-delete cleanup) and performance (code splitting, memoization).

---

*Report generated from full codebase review of v1.14.6 on March 5, 2026.*
