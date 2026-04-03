# [ARCHIVED] TODO - Split Transaction Edit From History

**Status**: ✅ COMPLETED
**Archived Date**: April 2, 2026
**Completion Notes**: Feature implemented and verified in v1.14.6 and later versions

---

## Original Plan
- [x] Trace transaction history edit flow and identify why split edits hydrate as a single child transaction
- [x] Update edit modal and split helper to initialize with grouped total and per-envelope split amounts
- [x] Verify build succeeds and confirm the transaction history split-edit UX matches expected behavior

## Verification Checklist
- [x] Open a split transaction in transaction history and confirm the amount shows the grouped total
- [x] Open the envelope selection UI and confirm both envelopes are pre-selected
- [x] Confirm a split amount field is visible for each selected envelope
- [x] Save an edited split and confirm the split group remains consistent

## Review Notes
- Root cause: transaction history passed only the primary split child into the edit modal, and the split helper only initialized a single selected envelope
- Fix updates history modal wiring, modal prefill logic, and split helper initialization so grouped edits hydrate with full split context

## Implementation References
- Files modified: `src/components/SplitTransactionHelper.tsx`, `src/views/TransactionHistoryView.tsx`
- Related commits: Feature finalized in v1.14.6+
- No further action needed
