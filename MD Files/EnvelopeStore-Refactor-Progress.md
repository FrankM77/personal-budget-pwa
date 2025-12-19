# Envelope Store Refactor Progress

_Last updated: 2025-12-18_

## Goal
Incrementally break the monolithic `src/stores/envelopeStore.ts` Zustand store into focused slices without changing the public API or runtime behavior. Each extraction keeps the store compiling and verified via `npm run build`.

## Completed Extractions
1. **Network helpers** – `src/stores/envelopeStoreNetwork.ts`
   - Centralizes online/offline detection (`checkOnlineStatus`) and `isNetworkError` logic for reuse.
2. **Realtime subscriptions** – `src/stores/envelopeStoreRealtime.ts`
   - Houses Firebase listeners (envelopes, transactions, templates, settings) and subscription cleanup.
3. **Transaction actions** – `src/stores/envelopeStoreTransactions.ts`
   - `addTransaction`, `deleteTransaction`, `updateTransaction`, `restoreTransaction` with optimistic UI + Firebase sync.
4. **Envelope actions** – `src/stores/envelopeStoreEnvelopes.ts`
   - `createEnvelope`, `addToEnvelope`, `spendFromEnvelope`, `transferFunds`, `deleteEnvelope`; preserves Timestamp + string conversions.
5. **Template actions & cleanup utilities** – `src/stores/envelopeStoreTemplates.ts`
   - `saveTemplate`, `deleteTemplate`, `cleanupOrphanedTemplates`, `updateTemplateEnvelopeReferences`, `removeEnvelopeFromTemplates` with offline fallbacks.

**MAJOR PROGRESS UPDATE**: All slice integrations completed! Settings, templates, envelopes, and transactions are now fully delegated to their respective slice files. The refactor has progressed from ~60% to ~95% completion.

## Verification
- `npm run build` → ✅ (TypeScript + Vite) after each set of changes.
- Restored `handleUserLogout` in the store interface to satisfy `UserMenu` consumer.

## Remaining Work
1. ✅ **Settings slice delegation** - COMPLETED
   - `updateAppSettings` / `initializeAppSettings` successfully wired from `envelopeStoreSettings.ts` to root store.
2. ✅ **Template slice delegation** - COMPLETED
   - `saveTemplate`, `deleteTemplate`, `cleanupOrphanedTemplates`, `updateTemplateEnvelopeReferences`, `removeEnvelopeFromTemplates` all successfully wired from `envelopeStoreTemplates.ts`
3. ✅ **Envelope actions delegation** - COMPLETED
   - `createEnvelope`, `addToEnvelope`, `spendFromEnvelope`, `transferFunds`, `deleteEnvelope` successfully wired from `envelopeStoreEnvelopes.ts`
4. ✅ **Transaction actions delegation** - COMPLETED
   - All transaction methods successfully integrated from `envelopeStoreTransactions.ts`:
   - `addTransaction`, `deleteTransaction`, `updateTransaction`, `restoreTransaction`
5. **Sync slice integration** - READY FOR IMPLEMENTATION
   - All slice delegations now compile cleanly
   - Ready to wire `createSyncSlice` and migrate shared converters/helpers into a common utility
   - Final integration phase can now begin
5. **Verification**
   - `npm run build` and basic smoke tests (login, envelope CRUD, template operations, offline toggles).

## Notes from 2025-12-17 Session
- Multiple attempts to instantiate slices directly inside `useEnvelopeStore` introduced scope/type recursion (due to slice factories calling `get()` methods they redefine). Need to create factories once outside the returned object and reuse their bindings.
- To avoid breaking the working store, reverted `envelopeStore.ts` to pre-delegation state while keeping slice files intact.
- Next session: start by instantiating `const transactionSlice = createTransactionSlice({...})` immediately before the `return {}` and spread its members into the object literal (`...transactionSlice`). Repeat for other slices to minimize boilerplate and reduce lint noise.


## Notes & Decisions
- No behavioral changes introduced; all network/service calls remain untouched.
- Offline-first logic preserved with `pendingSync` flags and Firebase fallbacks.
- Template slice retains timeout-based offline detection to avoid silent failures.

## Next Steps
1. ✅ Settings slice integration completed - build verified
2. ✅ Template slice integration completed - all template operations and cleanup utilities wired
3. ✅ Envelope actions integration completed - all envelope CRUD operations wired
4. ✅ Transaction actions integration completed - all transaction CRUD operations wired
5. **FINAL STEP**: Sync/reset/import logic extraction and final integration
6. Compile final regression checklist + smoke results in this document.
