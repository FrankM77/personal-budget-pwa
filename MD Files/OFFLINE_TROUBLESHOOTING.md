# Offline Capability Troubleshooting

**Date:** January 11-12, 2026  
**Status:** ✅ **RESOLVED** - Offline functionality fully restored

---

## Problem Statement

The app did not work properly offline. Specifically:
- ✅ Initial load worked (data appeared from cache)
- ❌ **Navigation back to main view got stuck on "Loading your budget" spinner**
- User reported: "when navigating away from main view and back it gets stuck on loading main"

## Solution Summary

**Root Cause:** Component loading state (`hasInitialLoadStarted`) was never set to `true` when navigating back because `Promise.all` was waiting for the 5-second Firebase timeout to complete, even though stores had already loaded data from cache and set `isLoading: false`.

**Fix:** Changed loading state to be derived purely from store states without waiting for Promise completion. Set `initialFetchTriggered` immediately when component mounts, allowing `isInitialLoading` to become `false` as soon as both stores finish loading from cache.

### Expected Behavior
- App should load instantly from cached data when offline
- Navigation between views should work seamlessly
- Data should persist across page refreshes and navigation
- Firebase sync should happen in background when online

### Actual Behavior
1. Initial load offline: **Works** - data appears from localStorage/IndexedDB
2. Navigate away from main view: **Works**
3. Navigate back to main view: **FAILS** - infinite loading spinner
4. Page refresh offline (dev mode): **FAILS** - offline dinosaur (expected in dev)
5. Page refresh offline (production): **Works** - service worker serves cached page

---

## Root Cause Analysis

### Issue 1: Missing Offline Persistence Configuration
**Problem:** `monthlyBudgetStore` was not persisting data to localStorage.

**Evidence:**
```typescript
// BEFORE (monthlyBudgetStore.ts line 665)
partialize: (_state) => ({})  // ❌ Nothing was being cached!
```

**Fix Applied:**
```typescript
// AFTER
partialize: (state) => ({
  incomeSources: state.incomeSources,
  envelopeAllocations: state.envelopeAllocations,
  monthlyBudget: state.monthlyBudget,
})
```

**Files Modified:**
- `src/stores/monthlyBudgetStore.ts` (lines 665-671)

---

### Issue 2: Firebase Queries Hanging Indefinitely When Offline
**Problem:** Firebase queries would wait forever when offline, causing infinite loading.

**Evidence:**
- No timeout mechanism on Firebase queries
- `Promise.all()` in `EnvelopeListView` would hang waiting for Firebase

**Fix Applied:**
Added 5-second timeout with `Promise.race`:

```typescript
// monthlyBudgetStore.ts (lines 173-188)
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Firebase query timeout')), 5000);
});

const [monthlyBudget, incomeSources, envelopeAllocations] = await Promise.race([
  fetchPromise,
  timeoutPromise
]) as [any, any[], any[]];
```

**Files Modified:**
- `src/stores/monthlyBudgetStore.ts` (lines 150-226)
- `src/stores/envelopeStoreSync.ts` (lines 27-241)

---

### Issue 3: Fetch Functions Could Reject, Breaking Promise.all
**Problem:** Even with timeout handling, if fetch functions rejected, `Promise.all()` in `EnvelopeListView` would fail.

**Fix Applied:**
Wrapped entire fetch functions in try-catch to ensure they **never reject**:

```typescript
// Both stores now have this pattern:
const fetchData = async () => {
  try {
    // ... fetch logic with timeout ...
  } catch (err) {
    console.error('⚠️ Firebase fetch failed:', err);
    // Fall back to cached data
    if (hasCachedData) {
      console.log('📦 Using cached data due to timeout/network error');
      set({ isLoading: false, pendingSync: true });
    }
  }
  // NEVER rejects - always resolves
};
```

**Files Modified:**
- `src/stores/monthlyBudgetStore.ts` (lines 150-226)
- `src/stores/envelopeStoreSync.ts` (lines 27-241)

---

### Issue 4: Firebase Offline Persistence Not Enabled
**Problem:** Firestore offline persistence was not enabled.

**Fix Applied:**
```typescript
// firebase.ts (lines 24-33)
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence enabled in first tab only');
  } else if (err.code === 'unimplemented') {
    console.warn('Browser does not support offline persistence');
  }
});
```

**Files Modified:**
- `src/firebase.ts` (lines 4, 24-33)

---

### Issue 5: Service Worker Conflicts in Dev Mode
**Problem:** Service worker in dev mode was trying to cache Vite dev files, causing errors.

**Evidence:**
```
workbox Precaching did not find a match for /personal-budget-pwa/@vite/client
workbox No route found for: /personal-budget-pwa/@vite/client
```

**Fix Applied:**
```typescript
// vite.config.ts (line 78)
devOptions: {
  enabled: false // Disable SW in dev mode - it conflicts with Vite's module resolution
}
```

**Files Modified:**
- `vite.config.ts` (line 78)

---

### Issue 6: Component Loading State Not Reactive to Store States
**Problem:** `EnvelopeListView` used local `isInitialLoading` state that waited for `Promise.all` to complete, even when stores had already loaded cached data.

**Fix Applied:**
Changed from local state to derived state from stores:

```typescript
// BEFORE
const [isInitialLoading, setIsInitialLoading] = useState(true);
// ... wait for Promise.all to complete before setting to false

// AFTER
const [hasInitialLoadStarted, setHasInitialLoadStarted] = useState(false);
const isInitialLoading = !hasInitialLoadStarted || isLoading || isBudgetLoading;
```

**Files Modified:**
- `src/views/EnvelopeListView.tsx` (lines 385-391, 428-458)

**Result:** ❌ **Still doesn't work** - navigation back to main view still hangs

---

## Current Status

### What Works ✅
1. Initial page load offline (production build)
2. Data persists in localStorage (`envelope-storage`, `monthly-budget-store`)
3. Firebase offline persistence enabled
4. Fetch functions timeout after 5 seconds and fall back to cache
5. Console shows correct logs: "📦 Using cached data..."

### What Doesn't Work ❌
1. **Navigation back to main view when offline** - gets stuck on loading spinner
2. Dev mode offline testing (expected - no service worker)

### Observations
- localStorage contains correct data
- Console logs show cached data being used
- Store `isLoading` states should be set to `false` when using cache
- Component should hide loading screen when both stores finish loading
- **Something is preventing the loading screen from hiding on navigation**

---

## Files Modified Summary

### Core Store Changes
1. **`src/firebase.ts`**
   - Added `enableIndexedDbPersistence`

2. **`src/stores/monthlyBudgetStore.ts`**
   - Fixed `partialize` to cache income sources, allocations, and monthly budget
   - Added timeout handling to `fetchMonthlyData`
   - Made `fetchMonthlyData` never reject
   - Added cached data fallback logic

3. **`src/stores/envelopeStoreSync.ts`**
   - Added timeout handling to `fetchData`
   - Made `fetchData` never reject
   - Added cached data fallback logic

### UI Changes
4. **`src/views/EnvelopeListView.tsx`**
   - Changed loading state from local to derived from stores
   - Simplified data loading effect

### Configuration Changes
5. **`vite.config.ts`**
   - Disabled service worker in dev mode

---

## Next Steps for Investigation

### Hypothesis: Loading State Race Condition
The component's `isInitialLoading` is derived from:
```typescript
const isInitialLoading = !hasInitialLoadStarted || isLoading || isBudgetLoading;
```

**Potential Issues:**
1. `hasInitialLoadStarted` might not be set to `true` if `Promise.all` never resolves
2. Store `isLoading` states might not be updating correctly on subsequent fetches
3. React re-render might not be triggered when store states change

### Debug Steps to Try
1. **Add extensive console logging:**
   - Log store `isLoading` states in component
   - Log `hasInitialLoadStarted` state changes
   - Log when `isInitialLoading` computed value changes
   - Log when stores set `isLoading: false`

2. **Check if stores are actually being called:**
   - Verify `fetchData()` and `fetchMonthlyData()` are called on navigation
   - Check if they complete successfully
   - Verify they set `isLoading: false` in store state

3. **Verify Zustand reactivity:**
   - Ensure component re-renders when store states change
   - Check if `useEnvelopeStore()` and `useMonthlyBudgetStore()` are reactive

4. **Test with simpler loading logic:**
   - Try removing derived state and using only store loading states
   - Test with just one store at a time

### Alternative Approaches to Consider

#### Option A: Remove Loading Screen on Navigation
```typescript
// Only show loading on initial mount, not on navigation
const [isFirstMount, setIsFirstMount] = useState(true);
const isInitialLoading = isFirstMount && (isLoading || isBudgetLoading);

useEffect(() => {
  setIsFirstMount(false);
}, []);
```

#### Option B: Use Store Loading States Directly
```typescript
// Remove all local loading state management
const isInitialLoading = isLoading || isBudgetLoading;
```

#### Option C: Add Loading State Reset on Navigation
```typescript
// Reset loading state when component mounts
useEffect(() => {
  set({ isLoading: false }); // in both stores
}, []);
```

#### Option D: Investigate Real-Time Subscriptions
- Check if real-time Firebase subscriptions are interfering
- Verify `setupEnvelopeStoreRealtime` and `setupMonthlyBudgetStoreRealtime`
- Consider disabling real-time updates when offline

---

## Testing Checklist

### Dev Mode Testing (Limited)
- [ ] App loads online
- [ ] Data appears correctly
- [ ] Go offline (DevTools) without refresh
- [ ] Navigate between views
- [ ] Data persists during navigation
- ⚠️ Cannot test page refresh (no service worker)

### Production Build Testing (Full)
- [x] Build: `npm run build`
- [x] Preview: `npm run preview` (port 4000)
- [x] Load online and sign in
- [x] Data appears correctly
- [x] Go offline (DevTools)
- [x] Refresh page - ✅ Works
- [x] Navigate to envelope detail - ✅ Works
- [ ] Navigate back to main view - ❌ **FAILS - STUCK ON LOADING**

---

## Console Logs Reference

### Expected Logs (Working Offline)
```
🚀 Starting initial data load
📡 Fetching data in parallel...
📦 Using cached envelope data, fetching updates in background...
📦 Using cached monthly budget data, fetching updates in background...
⚠️ Firebase fetch failed: Error: Firebase query timeout
📦 Using cached envelope data due to timeout/network error (likely offline)
📦 Using cached monthly budget data due to fetch error (likely offline)
✅ Envelope data fetched
✅ Monthly budget data fetched
🎉 Data load complete
```

### Actual Logs (Need to Verify)
- User should provide console logs when navigating back to main view offline
- Look for: Are fetch functions being called? Do they complete? Do they set isLoading: false?

---

## Questions to Answer Tomorrow

1. **Are the fetch functions actually being called on navigation?**
   - Add console.log at start of fetchData and fetchMonthlyData
   - Check if they appear when navigating back to main view

2. **Do the stores actually set isLoading: false?**
   - Add console.log when setting isLoading state
   - Verify it happens after cached data is used

3. **Does the component re-render when store states change?**
   - Add console.log in component body to track re-renders
   - Log isLoading and isBudgetLoading values on each render

4. **Is Promise.all completing?**
   - Add console.log in .then() and .catch() of Promise.all
   - Check if hasInitialLoadStarted is being set to true

5. **Is there a different code path on navigation vs initial mount?**
   - Check if useEffect dependency array should include something
   - Verify component lifecycle on navigation

---

## Related Files to Review Tomorrow

### Store Files
- `src/stores/envelopeStore.ts` - Main store definition
- `src/stores/envelopeStoreSync.ts` - Fetch and sync logic
- `src/stores/envelopeStoreRealtime.ts` - Real-time subscriptions
- `src/stores/monthlyBudgetStore.ts` - Monthly budget store
- `src/stores/monthlyBudgetStoreRealtime.ts` - Real-time subscriptions

### Component Files
- `src/views/EnvelopeListView.tsx` - Main view with loading logic
- `src/components/LoadingScreen.tsx` - Loading screen component

### Service Files
- `src/services/EnvelopeService.ts` - Firebase envelope queries
- `src/services/TransactionService.ts` - Firebase transaction queries
- `src/services/MonthlyBudgetService.ts` - Firebase monthly budget queries

### Config Files
- `src/firebase.ts` - Firebase initialization and offline persistence
- `vite.config.ts` - Service worker configuration

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)

# Production Testing
npm run build            # Build for production
npm run preview          # Preview production build (port 4000)

# Clear Browser Data
# DevTools → Application → Clear storage → Clear site data
# DevTools → Application → Service Workers → Unregister

# Test Offline
# DevTools → Network → Offline
```

---

## Notes

- Service worker only works in production builds, not dev mode
- Dev mode offline testing is limited (can't refresh page)
- Production build must be rebuilt after code changes
- localStorage keys: `envelope-storage`, `monthly-budget-store`
- Firebase offline persistence uses IndexedDB
- Timeout for Firebase queries: 5 seconds
- Timeout for loading message: 8 seconds

---

## Final Solution (January 12, 2026)

### The Fix

**File:** `src/views/EnvelopeListView.tsx`

**Before:**
```typescript
const [hasInitialLoadStarted, setHasInitialLoadStarted] = useState(false);
const isInitialLoading = !hasInitialLoadStarted || isLoading || isBudgetLoading;

// In useEffect:
Promise.all([fetchData(), fetchMonthlyData()])
  .then(() => setHasInitialLoadStarted(true))  // ❌ Never reached when offline
```

**After:**
```typescript
const [initialFetchTriggered, setInitialFetchTriggered] = useState(false);
const isInitialLoading = !initialFetchTriggered || isLoading || isBudgetLoading;

// In useEffect:
fetchData();
fetchMonthlyData();
setInitialFetchTriggered(true);  // ✅ Set immediately
```

### Why It Works

1. **Before:** Component waited for `Promise.all` to resolve before setting `hasInitialLoadStarted=true`. When offline, Firebase queries timeout after 5 seconds, so `Promise.all` took 5+ seconds to resolve, keeping the loading screen visible even though stores had already loaded from cache.

2. **After:** `initialFetchTriggered` is set to `true` immediately when component mounts. The loading state derives from:
   - `!initialFetchTriggered` → becomes `false` immediately
   - `isLoading` → becomes `false` when envelope store loads from cache
   - `isBudgetLoading` → becomes `false` when budget store loads from cache
   
   Result: `isInitialLoading` becomes `false` instantly when both stores finish loading from cache, showing main content immediately.

### Test Results

✅ **Initial load offline:** Works - data loads from cache instantly  
✅ **Navigation away:** Works  
✅ **Navigation back to main view:** Works - data loads from cache instantly  
✅ **Page refresh offline (production):** Works - service worker serves cached page  
✅ **All data persists:** Income sources, envelopes, transactions, allocations

---

**Last Updated:** January 12, 2026, 10:40 AM  
**Status:** Offline functionality fully restored and tested
