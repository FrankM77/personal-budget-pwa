# TODO - Scroll Position Restoration

## Plan
- [x] Reproduce and confirm when scroll is saved as `0` (open envelope -> Done -> back to main list)
- [x] Replace unmount-only save logic with continuous scroll tracking on list view
- [x] Restore scroll only after list content is fully loaded/rendered
- [x] Prevent repeated restore on subsequent rerenders
- [x] Verify behavior across navigation and month switches

## Verification Checklist
- [x] Scroll to bottom of main view
- [x] Open an envelope
- [x] Tap/click Done to return to main view
- [x] Confirm previous scroll position is restored (does not jump to top)
- [x] Switch months and confirm behavior is still stable

## Review Notes
- Final implementation uses explicit intent flag (`envelopeListShouldRestoreScroll`) set only when navigating to envelope detail
- Scroll position saved at navigation time, restored once on return with useLayoutEffect, then flag cleared
- No timing dependencies, no race conditions, no interference with normal navigation
- Pattern: Intent > Timing - explicit state beats complex DOM timing hacks

## Status
✅ **COMPLETED** - Scroll position restoration working correctly across envelope navigation
