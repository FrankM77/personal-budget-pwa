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

## Offline Write Operations (January 12, 2026)

### Problem: Envelopes Created Offline Not Appearing in UI

After fixing the initial offline read operations, a new issue emerged: envelopes created while offline would not appear in the UI immediately, or would disappear when going back online.

### Root Causes Identified

#### Issue 1: Allocation Not Created Before Navigation
**Problem:** Envelope was created with optimistic update, but the allocation was created in a `.then()` callback after navigation had already occurred. The `EnvelopeListView` filters envelopes to only show those with allocations:

```typescript
envelopes.filter(env => 
  envelopeAllocations.some(alloc => alloc.envelopeId === env.id)
)
```

Without an allocation, the envelope was filtered out even though it existed in the store.

**Fix:** Added 50ms delay before navigation to ensure both envelope and allocation optimistic updates complete:

```typescript
// AddEnvelopeView.tsx
const envelopePromise = addEnvelope(envelopeData);

envelopePromise.then((newEnvelopeId) => {
  if (newEnvelopeId) {
    setEnvelopeAllocation(newEnvelopeId, 0).catch(err => 
      console.error('Failed to create allocation:', err)
    );
  }
}).catch(err => {
  console.error('Failed to create envelope:', err);
});

// Small delay to ensure optimistic updates complete before navigation
setTimeout(() => {
  navigate('/');
}, 50);
```

#### Issue 2: Allocation Missing Optimistic Update
**Problem:** `createEnvelopeAllocation` in `monthlyBudgetStore` was waiting for Firebase to complete before adding the allocation to the store. This meant the allocation didn't exist when the component rendered.

**Fix:** Added optimistic update to `createEnvelopeAllocation`:

```typescript
// monthlyBudgetStore.ts - createEnvelopeAllocation
// Optimistic update - add allocation immediately to local state
const tempId = `temp-${Date.now()}-${Math.random()}`;
const now = new Date().toISOString();
const tempAllocation: EnvelopeAllocation = {
  ...allocationData,
  id: tempId,
  userId,
  month: currentMonth,
  createdAt: now,
  updatedAt: now
};

set(state => ({
  envelopeAllocations: [...state.envelopeAllocations, tempAllocation]
}));

// Try to sync with Firebase (with timeout)
try {
  const firebasePromise = service.createEnvelopeAllocation({...});
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firebase timeout - likely offline')), 3000)
  );
  
  await Promise.race([firebasePromise, timeoutPromise]);
  
  // If successful, refresh to get real ID
  const refreshedAllocations = await service.getEnvelopeAllocations(userId, currentMonth);
  set({ envelopeAllocations: refreshedAllocations });
} catch (err: any) {
  const isOffline = err.message?.includes('timeout') || !navigator.onLine;
  if (isOffline) {
    // Keep the temp allocation
  } else {
    // Remove temp allocation on real error
    set(state => ({
      envelopeAllocations: state.envelopeAllocations.filter(a => a.id !== tempId)
    }));
    throw err;
  }
}
```

#### Issue 3: Allocation EnvelopeId Not Updated When Envelope Syncs
**Problem:** When going back online, the envelope would sync to Firebase and get a real ID, but the allocation's `envelopeId` field still pointed to the old temp envelope ID. This caused the envelope to be filtered out because the allocation no longer matched.

**Fix:** Update allocation `envelopeId` when envelope syncs successfully:

```typescript
// envelopeStoreEnvelopes.ts - createEnvelope
// After envelope syncs to Firebase and gets real ID
const savedEnv: Envelope = await Promise.race([firebasePromise, timeoutPromise]);

// Replace temp envelope with real one
set((state: any) => ({
  envelopes: state.envelopes.map((env: Envelope) =>
    env.id === tempId ? storeEnvelope : env
  )
}));

// Update transactions to point to new envelope ID
set((state: any) => ({
  transactions: state.transactions.map((tx: Transaction) =>
    tx.envelopeId === tempId ? { ...tx, envelopeId: savedEnv.id } : tx
  )
}));

// Update allocations to point to new envelope ID
const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
const budgetStore = useMonthlyBudgetStore.getState();
const updatedAllocations = budgetStore.envelopeAllocations.map(alloc =>
  alloc.envelopeId === tempId ? { ...alloc, envelopeId: savedEnv.id } : alloc
);
useMonthlyBudgetStore.setState({ envelopeAllocations: updatedAllocations });
```

### Files Modified

1. **`src/views/AddEnvelopeView.tsx`**
   - Added 50ms delay before navigation to ensure optimistic updates complete
   - Chain allocation creation after envelope creation

2. **`src/stores/monthlyBudgetStore.ts`**
   - Added optimistic update to `createEnvelopeAllocation`
   - Added timeout handling for Firebase calls
   - Keep temp allocation when offline, remove only on real errors

3. **`src/stores/envelopeStoreEnvelopes.ts`**
   - Update allocation `envelopeId` when envelope syncs to Firebase
   - Cross-store update to keep allocation pointing to correct envelope

### Test Results

✅ **Create envelope offline:** Envelope appears immediately in UI after short delay  
✅ **Envelope persists offline:** Envelope stays visible during navigation  
✅ **Go back online:** Envelope syncs to Firebase and stays visible  
✅ **Navigate after sync:** Envelope remains visible with real Firebase ID  
✅ **Allocation stays linked:** Allocation `envelopeId` updated to match real envelope ID

### Key Learnings

1. **Optimistic updates must be synchronous:** Both envelope and allocation need to be added to store immediately, before any async operations
2. **Timing matters:** Small delay needed to ensure both optimistic updates complete before navigation
3. **Cross-store updates required:** When envelope ID changes, must update references in both envelope store (transactions) and budget store (allocations)
4. **Filter logic dependencies:** UI filters based on relationships (envelope must have allocation), so both entities must exist and be linked correctly

---

## Offline Write Operations - Refresh Persistence (January 12, 2026)

### Problem: Envelope Disappears After Page Refresh

After implementing the initial offline write solution, envelopes created offline would appear immediately and stay visible when going online, but would **disappear after page refresh**.

### Root Cause Analysis

The issue had three parts:

#### Issue 1: `pendingSync` Flag Not Set
**Problem:** When allocation was created offline and timed out, `pendingSync` was never set to `true` in `monthlyBudgetStore`. This meant the auto-sync mechanism didn't trigger when going back online.

**Fix:** Set `pendingSync: true` when allocation is kept offline:

```typescript
// monthlyBudgetStore.ts - createEnvelopeAllocation
} catch (err: any) {
  const isOffline = err.message?.includes('timeout') || !navigator.onLine;
  if (isOffline) {
    console.log('📴 Offline - keeping allocation locally, will sync when online');
    // Keep the temp allocation and mark for sync
    set({ pendingSync: true });
  }
}
```

#### Issue 2: Envelope Not Syncing When Going Online
**Problem:** The envelope's `createEnvelope` function timed out when created offline and finished executing. When going back online, there was no mechanism to retry syncing temp envelopes. The `syncData` function only called `fetchData`, which merges data but doesn't push local changes to Firebase.

**Result:** Envelope stayed in localStorage with temp ID, never synced to Firebase.

#### Issue 3: Allocation Syncing with Temp Envelope ID
**Problem:** Even if we tried to sync the allocation, it would sync with the temp envelope ID because the envelope hadn't synced yet. When you refresh, the allocation in Firebase points to a non-existent temp envelope ID.

**Result:** Envelope filtered out because allocation doesn't match.

### Complete Solution

Added comprehensive sync logic to `envelopeStoreSync.syncData()`:

```typescript
// envelopeStoreSync.ts - syncData function

// 1. Sync temp envelopes to Firebase first
const tempEnvelopes = state.envelopes.filter((env: Envelope) => env.id.startsWith('temp-'));
if (tempEnvelopes.length > 0) {
  console.log(`🔄 Syncing ${tempEnvelopes.length} temp envelopes to Firebase...`);
  
  for (const tempEnv of tempEnvelopes) {
    const { id, ...envelopeData } = tempEnv;
    // Ensure userId is present
    if (!envelopeData.userId) {
      envelopeData.userId = getCurrentUserId();
    }
    const savedEnv = await EnvelopeService.createEnvelope(envelopeData);
    console.log(`✅ Synced temp envelope ${id} -> ${savedEnv.id}`);
    
    // 2. Replace temp envelope with real one in store
    set((state: any) => ({
      envelopes: state.envelopes.map((env: Envelope) =>
        env.id === id ? { ...savedEnv, order: tempEnv.order } : env
      )
    }));
    
    // 3. Update transactions to point to new envelope ID
    set((state: any) => ({
      transactions: state.transactions.map((tx: Transaction) =>
        tx.envelopeId === id ? { ...tx, envelopeId: savedEnv.id } : tx
      )
    }));
    
    // 4. Update allocations to point to new envelope ID
    const { useMonthlyBudgetStore } = await import('./monthlyBudgetStore');
    const budgetStore = useMonthlyBudgetStore.getState();
    const updatedAllocations = budgetStore.envelopeAllocations.map(alloc =>
      alloc.envelopeId === id ? { ...alloc, envelopeId: savedEnv.id } : alloc
    );
    useMonthlyBudgetStore.setState({ envelopeAllocations: updatedAllocations });
    
    // 5. Sync allocation for this envelope with correct envelope ID
    const tempAllocsForThisEnvelope = updatedAllocations.filter(alloc =>
      alloc.envelopeId === savedEnv.id && alloc.id?.startsWith('temp-')
    );
    
    if (tempAllocsForThisEnvelope.length > 0) {
      const { MonthlyBudgetService } = await import('../services/MonthlyBudgetService');
      const service = MonthlyBudgetService.getInstance();
      
      for (const tempAlloc of tempAllocsForThisEnvelope) {
        await service.createEnvelopeAllocation({
          envelopeId: tempAlloc.envelopeId,
          budgetedAmount: tempAlloc.budgetedAmount,
          userId: tempAlloc.userId,
          month: tempAlloc.month
        });
        console.log(`✅ Synced allocation for envelope ${savedEnv.id}`);
      }
      
      // 6. Refresh allocations to get real IDs
      const refreshedAllocations = await service.getEnvelopeAllocations(
        tempAllocsForThisEnvelope[0].userId,
        budgetStore.currentMonth
      );
      useMonthlyBudgetStore.setState({ envelopeAllocations: refreshedAllocations });
    }
  }
}
```

### Files Modified

1. **`src/stores/monthlyBudgetStore.ts`**
   - Set `pendingSync: true` when allocation kept offline

2. **`src/stores/envelopeStoreSync.ts`**
   - Added temp envelope sync logic to `syncData`
   - Sync envelopes first, then allocations with correct envelope IDs
   - Ensure `userId` is present when syncing envelopes

### Complete Test Results

✅ **Create envelope offline:** Envelope appears immediately in UI  
✅ **Navigate away and back:** Envelope persists offline  
✅ **Go back online:** Envelope syncs to Firebase with real ID  
✅ **Allocation syncs:** Allocation saved to Firebase with correct envelope ID  
✅ **Refresh page:** Envelope persists in UI  
✅ **Navigate after refresh:** Envelope remains visible  
✅ **Check Firebase console:** Both envelope and allocation exist with correct IDs

### Sync Flow Summary

**Offline Creation:**
1. User creates envelope offline
2. Envelope added to store with temp ID (optimistic update)
3. Allocation added to store with temp envelope ID (optimistic update)
4. Firebase calls timeout → `pendingSync: true` set
5. Envelope and allocation stay in localStorage

**Going Back Online:**
6. `updateOnlineStatus` detects online status
7. Auto-sync triggered because `pendingSync: true`
8. `syncData` runs:
   - Syncs temp envelope → gets real Firebase ID
   - Updates allocation's `envelopeId` to real ID in store
   - Syncs allocation to Firebase with correct envelope ID
   - Refreshes allocations from Firebase
9. Both envelope and allocation now in Firebase with correct IDs

**Page Refresh:**
10. `fetchData` and `fetchMonthlyData` run
11. Envelope fetched from Firebase
12. Allocation fetched from Firebase (points to correct envelope ID)
13. Envelope passes filter (has matching allocation)
14. Envelope appears in UI ✅

---

**Last Updated:** January 12, 2026, 4:10 PM  
**Status:** Offline read and write operations fully working with refresh persistence
