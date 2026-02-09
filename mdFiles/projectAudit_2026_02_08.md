# Personal Budget PWA — Comprehensive Project Audit

**Date:** February 8, 2026  
**Version Audited:** v1.7.0  
**Scope:** Security, code efficiency, unused code, Siri/iOS integration, PWA configuration, state management, and general improvements.

---

## Table of Contents

1. [🔴 Critical — Firebase & Google Cloud Security](#1-critical--firebase--google-cloud-security)
2. [🟠 High — Code Cleanup & Dead Code](#2-high--code-cleanup--dead-code)
3. [🟡 Medium — Code Efficiency & Architecture](#3-medium--code-efficiency--architecture)
4. [🔵 Siri Integration & iOS PWA](#4-siri-integration--ios-pwa)
5. [🟣 PWA Configuration](#5-pwa-configuration)
6. [⚪ Low Priority — Polish & Best Practices](#6-low-priority--polish--best-practices)
7. [Summary Scoreboard](#7-summary-scoreboard)

---

## 1. 🔴 Critical — Firebase & Google Cloud Security

### 1A. Firebase API Key Exposure (Blaze Plan = Real Money at Stake)

**The Problem:** Your Firebase API key is embedded in the built JavaScript bundle deployed to GitHub Pages. This is by design for client-side Firebase SDKs, but on a **pay-as-you-go Blaze plan**, an exposed key without proper restrictions can lead to **unexpected billing charges** if abused.

Google has already flagged this — you received the email: *"Publicly Accessible Google API Key for Personal-Budget-PWA."*

**What to Do:**

| Action | Priority | Effort |
|--------|----------|--------|
| **Restrict the API key in Google Cloud Console** to only the APIs you use (Identity Toolkit, Cloud Firestore, Cloud Functions). Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) and set **Application restrictions** (HTTP referrers: `frankm77.github.io/*`, `localhost:*`) and **API restrictions** (only the APIs your app calls). | 🔴 Critical | 15 min |
| **Set Firebase budget alerts** in [Google Cloud Billing → Budgets & Alerts](https://console.cloud.google.com/billing). Create a budget at $5/month or $10/month with email alerts at 50%, 90%, and 100% thresholds. | 🔴 Critical | 5 min |
| **Enable Firebase App Check** to verify that requests to your backend come from your actual app, not scripts or bots. This protects Firestore reads/writes AND Cloud Functions from abuse. | 🔴 Critical | 30 min |
| **Consider a spending cap** via Cloud Billing to auto-disable billing if it exceeds a threshold. Note: this will shut down your app if exceeded, but prevents runaway costs. | 🟡 Medium | 10 min |

### 1B. Cloud Function Security

**Current State:** Your `parseTransaction` Cloud Function correctly requires authentication (`request.auth`). ✅

**Improvements:**

| Action | Priority | Effort |
|--------|----------|--------|
| ~~**Add rate limiting** to the Cloud Function. Currently any authenticated user could call `parseTransaction` thousands of times per minute, racking up Vertex AI charges. Add per-user rate limiting (e.g., max 30 calls/minute per user).~~ | ~~🔴 Critical~~ | ~~30 min~~ | ✅ **COMPLETED** - Rate limiting implemented: 30 calls/minute per user with Firestore-based tracking and cleanup |
| ~~**Add input length validation** — the `text` field is only checked for existence, not length. A malicious user could send megabytes of text to Gemini. Add `if (text.length > 500) throw new HttpsError(...)`.~~ | ~~🟠 High~~ | ~~5 min~~ | ✅ **COMPLETED** - Input length validation (500 char limit) implemented in both `siriStoreQuery` and `parseTransaction` functions |
| **Pin the Gemini model version** — `gemini-2.0-flash` may change behavior on updates. Pin to a specific stable version for consistency. | 🟡 Medium | 5 min |

### 1C. Firestore Security Rules

**Current State:** Rules are solid — every collection requires `isOwner(userId)`, meaning users can only access their own data. ✅

**One Gap:** There is **no data validation** in the rules. Any authenticated user can write arbitrary fields to their own documents. For example, they could write `{amount: "not_a_number"}` to a transaction. Consider adding:
- `request.resource.data.amount is number` on transaction writes
- `request.resource.data.name is string && request.resource.data.name.size() <= 100` on envelopes
- This is lower priority since the user is the only one writing to their own data, but it prevents bugs from corrupting the database.

### 1D. Source Control Security

**Current State:** `.env` and `src/firebase.ts` are correctly in `.gitignore`. ✅

**One Issue:** The file `HouseBudget_Backup_2026-02-07.json` is in the project root. If this contains personal financial data, it should be gitignored or moved outside the repo. Same for `test-swift-backup.json`.

---

## 2. 🟠 High — Code Cleanup & Dead Code

### 2A. Files Safe to Delete

These files exist in the project root and appear to be leftover debugging/development artifacts:

| File | Reason |
|------|--------|
| `check-feb-data.js` | Debug script, not used by the app |
| `debug-import.js` | Debug script |
| `debug-month-rollover.js` | Debug script |
| `debug-piggybank-copy.js` | Debug script |
| `quick-debug.js` | Debug script |
| `test-month-calc.js` | Test script |
| `save.ps1` | PowerShell save script |
| `save.sh` | Shell save script |
| `temp_file.txt` | Temporary file |
| `HouseBudget_Backup_2026-02-07.json` | Personal data — should not be in repo |
| `test-swift-backup.json` | Test data — should not be in repo |
| `Gmail - Fwd_...pdf` | Personal email — should not be in repo |

### 2B. Unused Source Code Components

| File / Component | Evidence | Action |
|-------------------|----------|--------|
| `src/components/EnvelopeReorderPlayground.tsx` (5.3KB) | Not imported by any other file. Self-contained playground component. | Delete |
| `src/components/debug/StoreTester.tsx` (4.3KB) | Not imported by any other file. Debug-only component. | Delete |
| `src/types/schema.ts` (41 lines) | Only imported by `TransactionService.ts`. Contains a duplicate/older `Transaction` type that conflicts with `models/types.ts`. Uses `Decimal` import and `Timestamp` types that differ from the rest of the app. | Migrate `TransactionService.ts` to use `models/types.ts`, then delete `schema.ts` |

### 2C. Duplicate Type Definitions

There are **three places** defining transaction/settings types:
- `src/models/types.ts` — the canonical source (used by stores, services, components)
- `src/types/schema.ts` — older version with `amount: string` and `Timestamp` dates
- `src/types/firestore.ts` — Firestore wire format types

**Recommendation:** Keep `models/types.ts` (domain types) and `types/firestore.ts` (wire types). Delete `types/schema.ts` after migrating its one consumer.

### 2D. `decimal.js` Dependency

`decimal.js` is imported in 3 files (`useEnvelopeList.ts`, `schema.ts`, `PiggybankListItem.tsx`) but the app primarily uses plain JavaScript `number` for all monetary calculations. The `toDecimal` helper in `schema.ts` is likely unused.

**Recommendation:** Audit actual usage. If `Decimal` is only used in 1-2 places for display rounding, native `toFixed(2)` or `Intl.NumberFormat` may suffice, saving ~32KB from the bundle.

---

## 3. 🟡 Medium — Code Efficiency & Architecture

### 3A. BudgetStore Size & Complexity

`budgetStore.ts` is **1,859 lines** — the single largest file in the project. It handles:
- All envelope CRUD
- All transaction CRUD
- All category CRUD
- All allocation CRUD
- All income source CRUD
- Onboarding logic
- Month navigation
- Data import/restore
- App settings
- Piggybank contribution management

**Recommendation:** Consider splitting into smaller, focused stores or at least extracting action groups into separate files (similar to how `envelopeStoreRealtime.ts`, `envelopeStoreTemplates.ts`, and `envelopeStoreSettings.ts` are already split). For example:
- `budgetStoreTransactions.ts` — transaction CRUD
- `budgetStoreAllocations.ts` — allocation/income CRUD
- `budgetStoreOnboarding.ts` — onboarding logic

### 3B. Excessive Console Logging

There are **269 `console.log` statements** across 26 files (74 in `budgetStore.ts` alone, 49 in `budgetService.ts`). In production, these:
- Slow down performance slightly
- Expose internal app state to anyone opening DevTools
- Clutter the console

**Recommendation:** Implement an environment-aware logger utility:
```typescript
const logger = {
  log: (...args: any[]) => { if (import.meta.env.DEV) console.log(...args); },
  warn: (...args: any[]) => { if (import.meta.env.DEV) console.warn(...args); },
  error: (...args: any[]) => console.error(...args), // Always log errors
};
```
Then replace all `console.log` calls with `logger.log`. This keeps logs in dev but strips them from production.

### 3C. Repeated Auth Store Pattern

Almost every action in `budgetStore.ts` repeats this pattern:
```typescript
const authStore = await import('./authStore').then(m => m.useAuthStore.getState());
const currentUser = authStore.currentUser;
if (!currentUser) throw new Error('No authenticated user found');
```

This appears **20+ times**. Extract it into a helper:
```typescript
const requireAuth = async () => {
  const { currentUser } = (await import('./authStore')).useAuthStore.getState();
  if (!currentUser) throw new Error('No authenticated user found');
  return currentUser;
};
```

### 3D. Dynamic Imports Where Static Would Suffice

The `authStore` is imported at the top of `budgetStore.ts` (`import { useAuthStore } from './authStore'`) but is then **dynamically imported** inside every action function (`await import('./authStore')`). The dynamic imports add latency and complexity. Since the static import already exists, just use `useAuthStore.getState()` directly.

### 3E. Optimistic Writes Without Error Recovery

In `budgetService.ts`, `createEnvelope` and `updateEnvelope` use optimistic writes (fire-and-forget with `.catch(err => console.error(...))`). If these writes fail silently, the local state diverges from Firestore. Consider:
- A retry queue for failed writes
- Or at minimum, surfacing the error to the user via toast

### 3F. Fetching ALL Transactions on Init

`budgetStore.init()` calls `budgetService.getTransactions(userId)` which fetches **all transactions ever** for the user. As the user accumulates months/years of data, this will become progressively slower and more expensive (Firestore read charges).

**Recommendation:** Scope transaction fetches to the current month (and perhaps ±1 month for transitions). Load historical transactions on-demand only when viewing transaction history.

---

## 4. 🔵 Siri Integration & iOS PWA

### 4A. Current State

The Siri integration is well-architected:
- ✅ AI-first parsing with regex fallback
- ✅ Offline detection with local-only parsing
- ✅ Payment method extraction
- ✅ Fuzzy envelope matching
- ✅ Authentication required for Cloud Function

### 4B. Known iOS PWA Limitation (Documented)

The inconsistent behavior where Siri Shortcuts sometimes opens Safari instead of the installed PWA is a known iOS platform limitation that cannot be fixed from the app side. This is properly documented in `siri.md`. ✅

### 4C. Improvement Opportunities

| Item | Details |
|------|---------|
| **Hardcoded envelope mappings in Cloud Function** | The prompt in `functions/src/index.ts` (lines 37-53) contains hardcoded envelope name mappings like `"Restaurants " (note the space)`. These are specific to your personal data. If you ever rename envelopes, the AI prompt won't match. Consider removing hardcoded mappings and letting the AI match against the dynamically-provided `userEnvelopes` list only. |
| **`useSiriQuery` dependency array** | The `useEffect` in `useSiriQuery.ts` has an empty dependency array `[]` but references `searchParams` and `envelopes` — these should be in the dependency array or the hook should use refs. Currently works because it only runs on mount, but React strict mode may cause issues. |
| **No Siri query sanitization** | The `query` URL parameter is passed directly to the AI prompt without sanitization. A crafted query could potentially manipulate the AI prompt (prompt injection). Consider basic input sanitization (strip special characters, limit length). |

---

## 5. 🟣 PWA Configuration

### 5A. What's Good

- ✅ `VitePWA` plugin with `autoUpdate` registration
- ✅ Proper `standalone` display mode
- ✅ iOS meta tags for `apple-mobile-web-app-capable`
- ✅ Custom loading screen in `index.html` for instant feedback
- ✅ `navigateFallback` configured for SPA routing
- ✅ Icons for 192px and 512px
- ✅ Workbox glob patterns for caching

### 5B. Improvements

| Item | Details |
|------|---------|
| **`icon-192.png` purpose** | Currently set to `'any maskable'` — this should be two separate icon entries: one with `purpose: 'any'` and one with `purpose: 'maskable'` (with proper safe zone padding). Using both on a single icon means the maskable version may be clipped on some devices. |
| **No `shortcuts` in manifest** | PWA manifest supports `shortcuts` for quick actions from the home screen long-press. You could add an "Add Transaction" shortcut that navigates to `/#/add-transaction`. |
| **`user-scalable=no`** | The viewport meta disables pinch-to-zoom (`user-scalable=no, maximum-scale=1.0`). This is an accessibility concern — some users need zoom. Consider removing or relaxing this. |
| **`#root:not(:empty)` CSS trick** | The inline loading screen uses `#root:not(:empty) #initial-loader { display: none; }`. This is clever but fragile — if React renders an empty error state, the loader won't hide. |
| **No runtime caching for API calls** | Workbox is only caching static assets. Firestore calls go through the Firebase SDK (not REST), so this is fine, but if you ever add REST API calls, add runtime caching strategies. |
| **Deploy timestamp hardcoded** | `index.html` line 25: `<!-- Deploy Timestamp: 2026-02-04 01:05 -->` — this is stale and requires manual updates. Remove or automate. |

---

## 6. ⚪ Low Priority — Polish & Best Practices

### 6A. `alert()` Usage

`App.tsx` line 64 uses `alert('Email verified successfully!')` and line 68 uses `alert('Email verification failed...')`. The app has a toast notification system (`Toast.tsx` + `toastStore.ts`). Use that instead for consistent UX.

### 6B. `as any` Casts

Multiple `as any` casts in `budgetStore.ts` (e.g., lines 869, 880, 1855-1856) and `envelopeStoreRealtime.ts`. These suppress TypeScript safety. Consider defining proper types instead.

### 6C. `.DS_Store` Files

`.DS_Store` files exist in `src/` and `src/components/`. Add `.DS_Store` to `.gitignore` (if not already) and remove tracked ones.

### 6D. `SettingsView.tsx` Size

At **35KB**, this is a very large view component. Consider breaking it into sub-components (AppearanceSettings, PaymentMethodSettings, DataManagement, etc.).

### 6E. Zustand `persist` + Real-Time Sync

The budget store persists to `localStorage` AND has real-time Firebase listeners. On app load, stale localStorage data flashes briefly before Firebase data overwrites it. Consider:
- Not persisting transaction/envelope data (let Firebase be the source of truth)
- Only persisting UI preferences (currentMonth, theme, etc.)

### 6F. `budgetService` Export Inconsistency

`BudgetService` is exported as a class with singleton pattern (`getInstance()`), but at the bottom of the file there's also `export const budgetService = BudgetService.getInstance()`. The real-time store imports the const, while the budget store imports the class. Pick one pattern.

### 6G. Node Engine Version

`functions/package.json` specifies `"node": "24"`. Node 24 is not yet released as of Feb 2026 (the latest LTS is Node 22). Firebase Cloud Functions supports Node 18 and 20 (with 22 in preview). Verify this matches what's actually deployed.

---

## 7. Summary Scoreboard

| Category | Grade | Key Action |
|----------|-------|------------|
| **Firebase/Cloud Security** | ⚠️ B- | Restrict API key, add budget alerts, enable App Check, rate-limit Cloud Function |
| **Firestore Rules** | ✅ A | Solid user isolation; optionally add field validation |
| **Code Cleanliness** | 🟡 C+ | Delete ~12 unused root files, 2 unused components, 1 dead type file |
| **Console Logging** | 🔴 D | 269 console.logs in production — implement logger utility |
| **Code Efficiency** | 🟡 B- | BudgetStore too large, repeated patterns, fetch-all-transactions on init |
| **Siri Integration** | ✅ A- | Well-built; remove hardcoded envelope mappings, add input sanitization |
| **PWA Configuration** | ✅ A- | Solid setup; fix icon purpose, add shortcuts |
| **State Management** | 🟡 B | Works well but localStorage + realtime has stale-data flash risk |
| **TypeScript Safety** | 🟡 B- | Multiple `as any` casts, duplicate type definitions |
| **Dependencies** | ✅ A | Up-to-date, no known vulnerabilities flagged |

### Top 5 Actions (Ordered by Impact)

1. **🔴 Restrict Firebase API key + set billing alerts** — Prevents unexpected charges on Blaze plan
2. **🔴 Add rate limiting to `parseTransaction` Cloud Function** — Prevents Vertex AI cost abuse
3. **🟠 Delete dead files and unused components** — Cleaner repo, smaller attack surface
4. **🟠 Implement production logger** — Remove 269 console.logs from production builds
5. **🟡 Scope transaction fetches to current month** — Performance and cost improvement as data grows
