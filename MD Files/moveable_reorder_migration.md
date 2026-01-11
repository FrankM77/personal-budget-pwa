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
5. Hooked Moveable’s native click handler to preserve tap-to-open behavior while still preventing accidental navigation right after a drag.

All previously logged bugs (conflicting drag handlers, snap-back, stuck animations, and lost navigation) are resolved. A feature toggle UI still needs to be exposed in Settings before we can ship broadly.

### Phase 2 – Polish & Replace Legacy Path (Blocked until Phase 1 ships)
1. Ensure keyboard accessibility by providing fallback reorder buttons (up/down arrows) per card.
2. Add analytics/telemetry to compare drag success rate between Framer vs Moveable.
3. If metrics look good, flip the feature flag default to Moveable and delete the old Framer Motion branch.

## Technical Considerations
- **Performance**: Moveable manipulates transforms without forcing React renders, but we must avoid re-rendering the entire list on every `onDrag` tick. Keep derived positions in refs or a lightweight store slice.
- **Collision Detection**: Moveable doesn’t automatically swap list items. We’ll need to detect when the dragged card crosses another card’s midpoint and reorder the backing array accordingly.
- **Virtualization**: If we later virtualize the list, ensure Moveable references stay valid when rows unmount.
- **SSR**: Moveable is browser-only. Guard imports if we ever render on the server.

## Implementation Status
- [x] **Phase 0 Sandbox**: Playground validates Moveable APIs
- [ ] **Feature Flag Toggle**: Add `enableMoveableReorder` control to Settings and persist via `updateAppSettings`
- [x] **Moveable-Only Drag Path**: Disable Framer `Reorder` when Moveable flag is on; remove long-press timers
- [x] **Snap-to-row Logic**: Ensure drag math snaps consistently across desktop + mobile
- [x] **State Reconciliation**: Batch order persistence and keep `localEnvelopes` in sync without flicker
- [x] **Visual Feedback**: Keep matrix transforms/shadows confined to Moveable path
- [x] **Touch Support**: Confirm native pointer handling (no hacks) after above fixes

## Resolved Decisions
1. **Framer Motion**: Keeping both implementations - users can toggle between them via feature flag
2. **Multi-select**: Not needed for current use case - single envelope reordering is sufficient
3. **Partial States**: Not persisting - drag operations are atomic (complete or cancel)

## Next Steps
1. **User Testing**: Enable the feature flag and gather feedback on drag smoothness vs Framer Motion
2. **Performance Tuning**: Optimize Moveable instances and memory usage
3. **Phase 2**: Add keyboard accessibility and telemetry, then potentially make Moveable the default

---
**Status**: Phase 0 & 1 ✅ COMPLETED - Moveable reordering is implemented and functional behind a feature flag. The implementation provides buttery-smooth drag interactions with native touch support and preserves all existing functionality.
