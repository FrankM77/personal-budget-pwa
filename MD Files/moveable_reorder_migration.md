# Moveable Reordering Migration Plan

## Overview
The current envelope reordering experience in `EnvelopeListView` uses Framer Motion's `Reorder` API. While functional, it feels stiff on touch devices and lacks the matrix-based animations present in advanced design tools. This document outlines the steps to migrate (or augment) the reordering experience using [Moveable](https://github.com/daybrush/moveable) so we can prototype a smoother, physics-like interaction layer.

## Goals
1. Deliver buttery-smooth drag interactions with `matrix3d` transforms.
2. Preserve React state as the source of truth for envelope order.
3. Support both mouse and touch without hacks (Moveable has native pointer handling).
4. Keep accessibility, keyboard navigation, and virtualization behavior intact.
5. Make the migration incremental so we can prototype and measure before committing fully.

## Current State Snapshot
- **Stack**: React + Zustand + Framer Motion `Reorder`.
- **Data**: `envelopes` array in `useEnvelopeStore` controls order index.
- **UX**: Long-press detection for touch, drag constraints handled by Framer Motion.
- **Pain Points**:
  - Drag start feels delayed on touch due to manual long-press timers.
  - Items jump instead of gliding; no inertia.
  - Layout shifts are handled by re-rendering rather than `matrix3d` transforms.

## Migration Strategy
We will layer Moveable *per envelope row*, dispatching final positions back into React state when drags settle. Steps:

### Phase 0 – Prototype Sandbox ✅ COMPLETED
1. Install Moveable: `npm install moveable`.
2. Clone a simplified list view (e.g., `EnvelopeReorderPlayground.tsx`).
3. Wrap each row in `<Moveable target={ref} draggable snappable>`.
4. Track `x/y` via Moveable's `onDrag` events; snap to row height increments.
5. On `onDragEnd`, compute the new index and update a local array.
6. Record notes on latency, mobile feel, and code complexity.

### Phase 1 – Integrate Into EnvelopeListView (Opt-in) ✅ COMPLETED
1. **Feature Flag**: Add a `useSettingsStore` flag `enableMoveableReorder` to toggle new behavior.
2. **Ref Management**: Create a ref map `{[envelopeId]: HTMLLIElement | null}` so Moveable can target DOM nodes without re-mounting.
3. **Moveable Instance**: Either instantiate one Moveable per row or a single shared instance that re-targets on pointer down. Prototype both for perf.
4. **Drag Logic**:
   - Use Moveable's `draggable` with `throttleDrag` to control update frequency.
   - Combine with `snappable` or custom snapping grid equal to row height + gap.
5. **Ordering Logic**:
   - Track interim `y` offsets in component state so React knows which items are "hovered".
   - On drop, compute final index and dispatch to `reorderEnvelopes(fromId, toIndex)` action in the store.
6. **Visual Feedback**:
   - Apply `matrix3d` transforms Moveable supplies for buttery motion.
   - Add subtle shadows / scale to active card (similar to Framer but smoother).

**Phase 1 Notes (Jan 11, 2026)**
1. Added `enableMoveableReorder` flag support end-to-end and guarded the legacy Framer path so Moveable owns drag UX when enabled.
2. Introduced a ref map + Moveable-per-row setup that constrains transforms to the Y-axis and uses snap-to-row math derived from row height + gap.
3. Implemented visual offset handling so non-dragged rows slide smoothly using CSS transforms while the dragged row stays under Moveable control.
4. Reordered data only after drag end, preventing flicker and ensuring store persistence stays in sync with UI order.
5. Hooked Moveable's native click handler to preserve tap-to-open behavior while still preventing accidental navigation right after a drag.

All previously logged bugs (conflicting drag handlers, snap-back, stuck animations, and lost navigation) are resolved.

**Phase 1 Cleanup (Jan 11, 2026)**
1. Removed the Moveable reorder toggle from Settings page - Moveable is now the default.
2. Removed the 'clean up orphaned templates' action from Settings page as templates are no longer used.
3. Removed all feature flag logic from EnvelopeListView - deleted Framer Motion Reorder code path.
4. Cleaned up unused parameters and functions from the codebase.

### Phase 2 – Polish & Accessibility ✅ COMPLETED
1. ✅ Added keyboard accessibility with up/down arrow buttons on each envelope card for users who prefer button-based reordering.

## Technical Considerations
- **Performance**: Moveable manipulates transforms without forcing React renders, but we must avoid re-rendering the entire list on every `onDrag` tick. Keep derived positions in refs or a lightweight store slice.
- **Collision Detection**: Moveable doesn’t automatically swap list items. We’ll need to detect when the dragged card crosses another card’s midpoint and reorder the backing array accordingly.
- **Virtualization**: If we later virtualize the list, ensure Moveable references stay valid when rows unmount.
- **SSR**: Moveable is browser-only. Guard imports if we ever render on the server.

## Implementation Status
- [x] **Phase 0 Sandbox**: Playground validates Moveable APIs
- [x] **Moveable-Only Drag Path**: Framer Motion Reorder code removed - Moveable is now the default
- [x] **Snap-to-row Logic**: Drag math snaps consistently across desktop + mobile
- [x] **State Reconciliation**: Order persistence batched and `localEnvelopes` stays in sync without flicker
- [x] **Visual Feedback**: Matrix transforms/shadows working smoothly
- [x] **Touch Support**: Native pointer handling confirmed (no hacks needed)
- [x] **Keyboard Accessibility**: Up/down arrow buttons added to each envelope card
- [x] **Feature Flag Removed**: Moveable is now the default and only reordering method

## Resolved Decisions
1. **Framer Motion**: Removed - Moveable is now the default and only reordering method
2. **Multi-select**: Not needed for current use case - single envelope reordering is sufficient
3. **Partial States**: Not persisting - drag operations are atomic (complete or cancel)
4. **Keyboard Accessibility**: Implemented via up/down arrow buttons on each card

## Future Enhancements (Optional)
1. **Performance Tuning**: Monitor Moveable instances and memory usage in production
2. **Analytics**: Track reordering usage patterns to inform future UX improvements
3. **Animations**: Consider adding more sophisticated spring animations for button-based reordering

---
**Status**: Phase 0, 1, & 2 ✅ COMPLETED - Moveable reordering is now the default reordering method. The implementation provides buttery-smooth drag interactions with native touch support, keyboard accessibility via arrow buttons, and preserves all existing functionality. Feature flag and legacy Framer Motion code have been removed.
