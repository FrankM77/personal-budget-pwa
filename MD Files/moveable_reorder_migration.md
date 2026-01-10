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

### Phase 0 – Prototype Sandbox
1. Install Moveable: `npm install moveable`.
2. Clone a simplified list view (e.g., `EnvelopeReorderPlayground.tsx`).
3. Wrap each row in `<Moveable target={ref} draggable snappable>`.
4. Track `x/y` via Moveable's `onDrag` events; snap to row height increments.
5. On `onDragEnd`, compute the new index and update a local array.
6. Record notes on latency, mobile feel, and code complexity.

### Phase 1 – Integrate Into EnvelopeListView (Opt-in)
1. **Feature Flag**: Add a `useSettingsStore` flag `enableMoveableReorder` to toggle new behavior.
2. **Ref Management**: Create a ref map `{[envelopeId]: HTMLLIElement | null}` so Moveable can target DOM nodes without re-mounting.
3. **Moveable Instance**: Either instantiate one Moveable per row or a single shared instance that re-targets on pointer down. Prototype both for perf.
4. **Drag Logic**:
   - Use Moveable's `draggable` with `throttleDrag` to control update frequency.
   - Combine with `snappable` or custom snapping grid equal to row height + gap.
5. **Ordering Logic**:
   - Track interim `y` offsets in component state so React knows which items are “hovered”.
   - On drop, compute final index and dispatch to `reorderEnvelopes(fromId, toIndex)` action in the store.
6. **Visual Feedback**:
   - Apply `matrix3d` transforms Moveable supplies for buttery motion.
   - Add subtle shadows / scale to active card (similar to Framer but smoother).

### Phase 2 – Polish & Replace Legacy Path
1. Remove manual long-press timers; rely on Moveable's press + drag detection.
2. Ensure keyboard accessibility by providing fallback reorder buttons (up/down arrows) per card.
3. Add analytics/telemetry to compare drag success rate between Framer vs Moveable.
4. If metrics look good, flip the feature flag default to Moveable and delete the old Framer Motion branch.

## Technical Considerations
- **Performance**: Moveable manipulates transforms without forcing React renders, but we must avoid re-rendering the entire list on every `onDrag` tick. Keep derived positions in refs or a lightweight store slice.
- **Collision Detection**: Moveable doesn’t automatically swap list items. We’ll need to detect when the dragged card crosses another card’s midpoint and reorder the backing array accordingly.
- **Virtualization**: If we later virtualize the list, ensure Moveable references stay valid when rows unmount.
- **SSR**: Moveable is browser-only. Guard imports if we ever render on the server.

## Prototype Checklist
- [ ] Spike playground with 5 mock envelopes using Moveable.
- [ ] Implement snap-to-row logic and confirm smoothness on mobile Safari/Chrome.
- [ ] Emit `onReorder(fromId, toIndex)` events and reconcile with Zustand store.
- [ ] Compare interaction metrics (time-to-reorder, drop accuracy) with Framer version.

## Open Questions
1. Should we keep Framer Motion for animations (opacity, scale) while Moveable handles drag math, or fully remove Framer `Reorder`?
2. Do we need multi-select or group drag support in the future? If so, plan combined dragging up front.
3. How do we persist partially-dragged states across navigation (e.g., user drags but cancels)?

## Next Steps
1. Build the sandbox prototype (Phase 0) and capture video/GIF for stakeholder review.
2. If approved, implement Phase 1 behind a feature flag and ship to beta users.
3. Gather feedback, tune snapping/inertia, then proceed to Phase 2 cleanup.

---
This plan gives us a clear path to prototype Moveable-powered reordering without disrupting the production experience. Once the sandbox proves the interaction quality, we can invest in wiring it into `EnvelopeListView` for all users.
