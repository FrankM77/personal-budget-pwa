# Firestore Index Error - verifyPiggybankBalances

## Problem

The app was experiencing an infinite error loop due to a missing Firestore composite index. This was causing:
- Hundreds of uncategorized envelopes to appear in the envelope list
- Repeated "query requires an index" errors in the console
- Potential data corruption and performance issues

## Root Cause

The `verifyPiggybankBalances()` function in `budgetStoreData.ts` calls `budgetService.getTransactionsByEnvelope()` which performs a Firestore query:

```typescript
const q = query(
  collectionRef, 
  where('envelopeId', '==', envelopeId),
  orderBy('date', 'desc')
);
```

This query requires a **composite index** on the `transactions` collection with:
- `envelopeId` (Ascending)
- `date` (Descending)

Without this index, Firestore throws a `failed-precondition` error on every query.

## Error Message

```
FirebaseError: [code=failed-precondition]: The query requires an index. 
You can create it here: https://console.firebase.google.com/v1/r/project/personal-budget-pwa-5defb/firestore/indexes?create_composite=...
```

## Temporary Fix (v1.17.4)

The `verifyPiggybankBalances()` function has been temporarily disabled:

1. **In `src/stores/budgetStoreData.ts`**:
   - Commented out the call in `init()` function
   - Replaced the implementation with a stub that just logs a message

2. **In `src/hooks/useEnvelopeList.ts`**:
   - Commented out the call in the cached session handler

## Permanent Fix

To re-enable the piggybank balance verification feature, create the required Firestore index:

1. Go to: https://console.firebase.google.com/v1/r/project/personal-budget-pwa-5defb/firestore/indexes

2. Create a new composite index:
   - **Collection**: `transactions`
   - **Field 1**: `envelopeId` (Ascending)
   - **Field 2**: `date` (Descending)

3. Wait for the index to build (usually 1-2 minutes)

4. Re-enable the `verifyPiggybankBalances()` function by:
   - Uncommenting the implementation in `src/stores/budgetStoreData.ts`
   - Uncommenting the calls in `init()` and `useEnvelopeList.ts`

## Impact

- **Piggybank balance verification**: Temporarily disabled
- **Self-healing feature**: Not running until index is created
- **App functionality**: Working normally (no more error loop)

## Files Modified

- `src/stores/budgetStoreData.ts` - Disabled verifyPiggybankBalances
- `src/hooks/useEnvelopeList.ts` - Disabled verifyPiggybankBalances call

## Version

- Introduced in: v1.17.4
- Fixed in: Pending index creation
