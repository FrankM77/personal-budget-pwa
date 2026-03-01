# TODO - Scroll Position Restoration

## Plan
- [x] Reproduce and confirm when scroll is saved as `0` (open envelope -> Done -> back to main list)
- [x] Replace unmount-only save logic with continuous scroll tracking on list view
- [x] Restore scroll only after list content is fully loaded/rendered
- [x] Prevent repeated restore on subsequent rerenders
- [ ] Verify behavior across navigation and month switches

## Verification Checklist
- [ ] Scroll to bottom of main view
- [ ] Open an envelope
- [ ] Tap/click Done to return to main view
- [ ] Confirm previous scroll position is restored (does not jump to top)
- [ ] Switch months and confirm behavior is still stable

## Review Notes
- Implemented in `EnvelopeListView`:
  - Save scroll on every scroll event (not only unmount)
  - Save scroll immediately before navigating into envelope detail
  - Restore scroll only after loading/onboarding gates are cleared
  - Guard with one-time restore ref to avoid jumpy rerenders
