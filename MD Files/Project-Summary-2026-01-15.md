# House Budget PWA: Project Summary - 2026-01-15

## Changelog (Highlights)
- **2026-01-15**: UI polish: Centered "Settings" title and fixed "Budget Allocations" layout on Settings page.
- **2026-01-15**: Fixed transaction duplication bug by adding race-condition protection in optimistic updates.
- **2026-01-15**: Implemented "Self-Healing" sync to automatically repair budget vs ledger discrepancies on month load.
- **2026-01-15**: Corrected "Current Balance" calculation for spending envelopes to be strictly transaction-based (Income - Expenses).
- **2026-01-15**: Fixed missing month data bug by implementing `fetchMonthData` on navigation.
- **2026-01-15**: Fixed TypeScript build errors in EnvelopeListView (missing closing brace, undefined variable).
- **2026-01-15**: Consolidated MD Files into this project summary (full merge, no trimming).
- **2026-01-15**: Apple Wallet-style Card Stack demo implemented with swipe-to-delete functionality.
- **2026-01-14**: Piggybank fixes (month filtering, balance consistency, timing, missing transactions), orphaned allocation cleanup.
- **2026-01-12**: Firebase data structure reorg, monthly budget auto-calculation, envelope deletion cascade.
- **2026-01-11**: Offline navigation loading fix approach and persistence troubleshooting documented.
- **2026-01-11**: Moveable reordering migration completed (default reordering path).

## 1. Executive Summary

- Transformation from iOS app to high-performance PWA with full feature parity.
- Complete Firebase cloud synchronization (envelopes, transactions, allocations, income sources, app settings) with real-time cross-device updates.
- Robust offline-first architecture with optimistic UI updates and automatic recovery.
- Advanced connectivity detection with multi-endpoint testing and automatic retry for restricted networks.
- 3-way theme switching (Light/Dark/System) with Firebase persistence.
- Service worker caching for complete offline functionality.
- Professional data export/import with all data types supported.
- **Complete Authentication System**: Email verification, account deletion, enhanced login security.
- Enhanced user experience with streamlined navigation, account management, and connectivity troubleshooting.
- **🏆 Recent Achievements**:
  - **Stability & Polish**: Resolved critical race conditions causing duplicate transactions and delayed balance updates.
  - **Data Integrity**: Implemented self-healing logic to ensure budget allocations always match the transaction ledger.
  - **UI Refinements**: Polished Settings page layout, centered titles, and improved data summary readability.
  - Fixed TypeScript build errors in EnvelopeListView (missing closing brace, undefined variable)
  - Apple Wallet-style Card Stack demo with swipe-to-delete functionality
  - Firebase data structure reorganization for improved security and consistency
  - Monthly budget auto-calculation on income source and allocation changes
  - Envelope deletion now properly removes associated allocations
  - Complete Zustand store refactor (7 focused slices, zero breaking changes)
  - Email verification system with secure account access
  - Account deletion functionality with GDPR compliance
  - Dynamic version management from package.json
  - Improved login error feedback and user experience
  - Password strength validation with real-time feedback and 12-character minimum requirement
  - Backup/restore transaction duplication fix with real-time sync management
  - Orphaned transaction cleanup for proper envelope deletion
  - Piggybank month filtering fix (creation month onward)
  - START FRESH piggybank cleanup and month-scoped deletion
  - Orphaned allocation cleanup (ghost allocations removed)
  - Piggybank transaction filtering fix (creation date forward)
  - Piggybank balance consistency fix (list and detail views align)
  - Piggybank contribution timing fixes (real calendar month only)
  - Piggybank future month contribution blocking
  - Piggybank missing transaction recovery

## 2. Architecture & Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **State Management**: Zustand with Firebase integration (refactored into focused slices)
- **Backend**: Firebase Firestore with offline persistence
- **Offline Strategy**: Optimistic UI updates with eventual consistency
- **PWA Features**: Service worker caching, navigation fallbacks, app shell caching

### Firebase Data Structure

All user data is organized under `users/{userId}/` subcollections for security and isolation:

```
users/
  {userId}/
    ├── appSettings/
    ├── envelopes/
    ├── envelopeAllocations/
    ├── incomeSources/
    ├── monthlyBudgets/
    └── transactions/
```

### Core File Structure (Snapshot)

```text
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
├── postcss.config.cjs
├── firebase.json
├── firestore.rules
├── public/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── vite.svg
├── MD Files/
│   ├── OFFLINE_TROUBLESHOOTING.md
│   ├── Personal-Budget-PWA-Vision.md
│   ├── Project-Summary-2026-01-15.md
│   └── moveable_reorder_migration.md
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── firebase.ts
    ├── components/
    │   ├── modals/
    │   ├── ui/
    │   ├── BottomNavigation.tsx
    │   ├── PiggybankListItem.tsx
    │   └── SplitTransactionHelper.tsx
    ├── models/
    ├── mappers/
    ├── services/
    │   ├── AppSettingsService.ts
    │   ├── DistributionTemplateService.ts
    │   ├── EnvelopeService.ts
    │   ├── MonthlyBudgetService.ts
    │   └── TransactionService.ts
    ├── stores/
    ├── types/
    ├── utils/
    └── views/
```

## 3. Version Management & Release Process

### Semantic Versioning Workflow

| Change Type | Command | Version Bump | Example | Description |
|-------------|---------|--------------|---------|-------------|
| Bug fixes | `npm version patch` | 1.0.0 → 1.0.1 | Fix login error feedback | Backwards compatible bug fixes |
| New features | `npm version minor` | 1.0.0 → 1.1.0 | Add email verification | Backwards compatible new features |
| Breaking changes | `npm version major` | 1.0.0 → 2.0.0 | Major API changes | Breaking changes requiring migration |

### Automated Version Updates
- **package.json** updated via `npm version` commands
- **UI display** dynamically imports from package.json (no manual edits)
- **Git integration** creates commits and tags automatically

## 4. Major Milestones & Features

### Zustand Store Refactor (2025-12-19) ✅
Successfully broke down the monolithic `src/stores/envelopeStore.ts` Zustand store into focused slices without changing the public API or runtime behavior.

### Piggybank Feature (2025-12-20) ✅
Piggybanks are special envelopes that persist across months with auto-contributions and progress tracking.

### Offline Reliability ✅
- Optimistic UI updates for all CRUD actions
- Local storage + IndexedDB persistence
- 5s Firebase timeout fallback
- Robust sync and recovery on reconnect

## 5. Critical Bug Fixes & Resolutions (Selected)

### Data Integrity & Synchronization
- Firebase data structure reorg to user subcollections
- Monthly budget auto-calculation
- Envelope deletion cascade cleanup
- Backup/restore duplication fix with real-time sync gating

### Piggybank System Fixes
- Month filtering and UTC date handling
- Creation-date transaction filtering
- Balance consistency between list and detail views
- Contribution timing aligned to real calendar month
- Missing transaction recovery on month transition

### Authentication & Security
- Email verification workflow with resend throttling
- Account deletion with re-authentication
- 7-day offline authentication grace period
- Password strength validation (12-char minimum)

## 6. Firebase Testing Guide Summary

- Verify development server and Firebase connection
- Test envelope/transaction CRUD and cross-device sync
- Test offline creation and online reconciliation
- Test import/export and verify in Firebase console
- Verify settings persistence

## 7. Deployment Guide Summary

### Quick Deploy Routine
1. `git add . && git commit -m "Update: Description" && git push origin main`
2. `npm run build && npm run deploy`

### Configuration
- **package.json**: `homepage` set to GitHub Pages URL
- **vite.config.ts**: `base` path set to repo name

## 8. Next Steps & Roadmap

### Current Priorities ✅
- Firebase data structure reorg
- Monthly budget auto-calculation
- Envelope deletion cascade
- Store refactor
- Email verification, account deletion, password strength validation

### Future Enhancements
- Enhance CSV export to match new data structure
- Advanced reporting and analytics
- Data visualization
- Performance testing
- Error boundaries

---

## 9. Personal Budget PWA - Zero-Based Budgeting Vision

## Overview
Transform the Personal Budget PWA into a comprehensive **zero-based budgeting** application following the EveryDollar model, where every dollar of income is assigned a job through a unified "Available to Budget" pool that funds spending envelopes until reaching zero balance.

## Core Features

### 1. Monthly Budget Cycles
- **Separate Months**: Each month operates as an independent budget cycle
- **Month Switching**: Easy navigation between past and future months
- **Month Templates**: Ability to copy budget structure from previous months
- **Budget Status**: Clear indication of whether budget is balanced (all income allocated)

### 2. Income Management ✅ IMPLEMENTED
- **Multiple Income Sources**: Track separate income streams (salary, freelance, investments, etc.)
- **Simplified Entry**: Just name and monthly amount (removed complexity)
- **Unified Income Pool**: All income sources combine into total "Available to Budget"
- **Full CRUD Operations**: Add, edit, and delete income sources with real-time updates
- **Mobile-Optimized**: Tap to edit, swipe to delete (optimistic with Undo)
- **Desktop-Optimized**: Hover to reveal actions for clean desktop interface
- **Real-Time Calculation**: Available to Budget updates instantly when income changes

### 3. Zero-Based Allocation
- **Available to Budget**: Prominent display of unallocated income pool (like EveryDollar)
- **Envelope Funding**: Assign money from Available to Budget to spending envelopes
- **Zero Balance Goal**: Visual progress toward allocating every dollar
- **Reallocation Freedom**: Move money between envelopes as needs change

### 4. Split Transactions
- **Transaction Splitting**: Ability to split single transactions across multiple envelopes
- **Split Categories**: Assign different portions to different budget categories
- **Split Tracking**: Maintain relationships between split portions
- **Split Editing**: Modify splits after creation

### 5. Piggybanks (Savings Goals) ✅ CORE EXPERIENCE LIVE
- **Savings Goals**: Create and manage specific savings targets (vacation, emergency fund, etc.)
- **Goal Tracking**: Visual progress bars showing savings progress toward each goal
- **Automatic Transfers**: Schedule automatic contributions to piggybanks
- **Goal Milestones**: Celebrate milestones and achievements along the savings journey
- **Flexible Funding**: Add money from any envelope or directly from income
- **Recent Progress**:
  - Inline monthly contribution editing directly within the piggybank list, consistent with envelope budget editing UX
  - Auto-contribution engine capped to the real-world current month so navigating to future months no longer queues premature deposits
  - Piggybank balances on the list now reflect cumulative savings to stay in sync with detail view totals

### 6. Enhanced Envelope System
- **Envelope Allocation**: Allocate specific amounts from income to envelopes
- **Envelope Limits**: Set spending limits for each envelope
- **Envelope Categories**: Organize envelopes by type (Essentials, Wants, Savings, Debt)
- **Envelope Transfers**: Move money between envelopes within the same month

### 7. Budget Analytics
- **Monthly Comparison**: Compare spending vs budget by month
- **Category Analysis**: See spending patterns across categories
- **Budget Performance**: Track how well you stick to your budget
- **Trend Analysis**: Identify spending trends over time

## Technical Implementation Plan

### Phase 1: Core Infrastructure ✅ COMPLETED
1. **Database Schema Updates** ✅
   - Add month-based budget structure with availableToBudget field
   - Income sources tracking with multiple streams
   - Transaction split relationships (schema ready)
   - Envelope allocation data with monthly budgeted amounts

2. **Month Management System** ✅
   - MonthSelector component for navigation between past and future months
   - Month creation/copying functionality in MonthlyBudgetService
   - Month-based data isolation in monthlyBudgetStore

### Phase 2: Income & Allocation ✅ COMPLETED

#### 1. Income Sources Management ✅
- **IncomeSourceModal Component**: Full-featured modal for add/edit operations
- **Simplified Form Design**: Name and Amount only (removed frequency/category for better UX)
- **Real-time Total Income Calculation**: Automatic sum of all income sources
- **Full CRUD Operations**: Create, Read, Update, Delete with Firebase persistence
- **Mobile-Optimized Interactions**:
  - Tap income source → Opens edit modal
  - Swipe left → Triggers instant optimistic deletion
  - Undo Support → Toast notification allows immediate recovery
  - Proper event handling to prevent modal conflicts
- **Desktop-Optimized Interactions**:
  - Hover over income source → Edit/Delete buttons appear
  - Clean interface with no permanent UI clutter
- **Form Validation**: Required fields, positive amounts, error handling
- **Event Management**: Timeout cancellation prevents edit modal from opening after delete actions

#### 2. Envelope Allocation Management ✅
- **EnvelopeAllocationModal Component**: Modal for editing envelope name and budgeted amount
- **Identical UX Pattern**: Same tap-to-edit and swipe-to-delete as income sources
- **Full CRUD Operations**: Create, Read, Update, Delete envelope allocations
- **Real-Time Updates**: Available to Budget recalculates instantly on allocation changes
- **Custom Envelope Names**: Support for renaming envelope categories
- **Form Validation**: Required fields, positive amounts, proper error handling
- **Mobile Interactions**:
  - Tap envelope allocation → Opens edit modal (name + amount)
  - Swipe left → Instant optimistic deletion with undo
- **Desktop Interactions**: Hover to reveal actions, click to edit
- **DemoEnvelopeModal Integration**: Separate modal for creating new envelope categories
- **State Management**: Proper integration with monthlyBudgetStore

#### 3. Available to Budget System ✅
- **AvailableToBudget Component**: Prominent display with progress visualization
- **Real-time Calculation Engine**: Instant recalculation on income/allocation changes
- **Zero Balance Goal Tracking**: Visual progress toward allocating every dollar
- **Status Indicators**:
  - Blue: Available to Budget (under-allocated)
  - Green: Budget Balanced (zero balance achieved)
  - Red: Over Budget (over-allocated)
- **Progress Bar**: Visual percentage of income allocated
- **Instant Updates**: Recalculates immediately when income sources or allocations change

### Phase 3: Split Transactions ✅ COMPLETED
1. **Split Transaction UI**
   - Split creation interface
   - Split editing capabilities
   - Split visualization

2. **Split Data Management**
   - Split relationship handling
   - Split amount validation
   - Split category assignment

### Phase 4: Enhanced Analytics (In Progress)
1. **Budget Dashboard**
   - Monthly overview
   - Budget vs actual comparisons
   - Progress tracking

2. **Reporting Features**
   - Category breakdowns
   - Trend analysis
   - Budget performance metrics

## Data Model Changes

### New Collections/Tables:
- `monthlyBudgets`: Core budget data per month with availableToBudget field
- `incomeSources`: User income entries per month (reference only)
- `transactionSplits`: Split transaction relationships
- `envelopeAllocations`: Monthly budgeted amounts per envelope

### Updated Collections:
- `transactions`: Add month reference and split relationships
- `envelopes`: Add category grouping and spending tracking
- `users`: Add budget preferences

## User Experience Flow

1. **New User Onboarding**
   - Set up first month's budget
   - Add income sources (creates total pool)
   - Create spending envelopes
   - Fund envelopes from "Available to Budget"

2. **Monthly Workflow**
   - Review previous month performance
   - Create/copy budget for new month
   - Add income sources (updates Available to Budget)
   - Fund envelopes until Available to Budget = $0
   - Track spending throughout month
   - Reallocate between envelopes as needed

3. **Daily Usage**
   - Record transactions (with split capability)
   - Monitor envelope balances vs budgeted amounts
   - Track progress toward zero Available to Budget
   - Adjust envelope allocations as needed

## Success Metrics
- **Budget Completion Rate**: % of months where budget reaches zero balance
- **Transaction Split Usage**: How often users split transactions
- **Monthly Active Users**: Consistent monthly usage
- **User Retention**: Continued app usage over time

## Future Enhancements
- **Automated Rules**: Set up recurring allocations (not yet implemented)
- **Goal Tracking**: Savings goals with progress tracking
- **Collaborative Budgeting**: Share budgets with partners
- **AI Insights**: Spending pattern analysis and suggestions
- **Integration**: Bank account syncing for automatic transaction import
- **Backup/Export UX**: Show clear success/failure feedback after CSV exports or backup generation so users know when downloads are ready
- **Smart Month Onboarding**: Auto-select the real current month on launch and, when the month has no data, prompt the user to create that month’s budget (e.g., open Feb 2026 on Feb 1 and guide them to start budgeting)
- **Settings Cleanup**: Remove the obsolete “Clean up orphaned templates” action so the Settings screen only lists still-supported tools
- **Transaction Field Updates**: Merchant field is implemented; continue refining filters and metadata usage

## Implementation Priority
1. **✅ COMPLETED**: Month management, income tracking, basic allocation (Phase 1)
2. **✅ COMPLETED**: Full income and envelope allocation management with interactive UI (Phase 2)
3. **✅ COMPLETED**: Split transactions (Phase 3)
4. **🎯 NEXT PRIORITY**: Piggybanks (savings goals) and enhanced analytics
5. **Low Priority**: Enhanced analytics, advanced features, integrations

## Current Status: Phase 3 Complete - Moving to Piggybanks! ✅

Phase 3 has been fully implemented with split transaction functionality. The demo page now provides a complete monthly budgeting experience with:

- **Interactive Income Management**: Add/edit/delete income sources with swipe and tap gestures
- **Interactive Envelope Allocation**: Edit envelope names and amounts with identical UX patterns
- **Real-Time Calculations**: Available to Budget updates instantly as you make changes
- **Zero-Based Budgeting Logic**: EveryDollar-style allocation workflow

The foundation is now ready for integrating these features into the main app views (EnvelopeListView and EnvelopeDetail).

## Live Demo

Scan this QR code to access the live demo on your mobile device:

![QR Code](https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://FrankM77.github.io/personal-budget-pwa/)

Or visit: [https://FrankM77.github.io/personal-budget-pwa/](https://FrankM77.github.io/personal-budget-pwa/)

### ✅ **Phase 1 Achievements (COMPLETED)**
- **Demo Page**: `/monthly-budget-demo` showcases all Phase 1 components
  - **Offline Demo Mode**: Works completely offline with mock data (no Firebase dependency)
  - **Month-Specific Data**: Demo data only shows for January 2025, other months remain empty
  - **Copy Month Functionality**: Copy demo data to any month for testing
  - **Data Persistence**: Demo data reloads correctly when switching months
- **Available to Budget**: Core logic and UI component complete with real-time updates
- **Month Navigation**: Fully functional with data isolation and copy functionality
- **Zero-Based Budgeting**: Mathematical accuracy verified and tested

### ✅ **Phase 2 Achievements - Income Management (COMPLETED)**
- **IncomeSourceModal Component**: Full-featured modal for add/edit operations
- **Simplified Form Design**: Streamlined to just Name and Amount (removed frequency/category complexity)
- **Full CRUD Operations**: Create, Read, Update, Delete with Firebase persistence
- **Mobile-First Interactions**:
  - **Tap to Edit**: Tap any income source to open edit modal
  - **Swipe to Delete**: Smooth, iOS-style swipe with instant optimistic deletion
  - **Undo Capability**: Delete actions can be instantly reversed via toast notification
- **Desktop Interactions**: Hover to reveal edit/delete buttons
- **Real-Time Updates**: Available to Budget recalculates instantly on any income change
- **Form Validation**: Required fields, positive amounts, error handling
- **Event Management**: Proper timeout cancellation to prevent modal conflicts

### ✅ **Phase 2 Achievements - Envelope Allocation (COMPLETED)**
- **DemoEnvelopeModal Component**: Modal for creating new envelope categories
- **Dynamic Envelope Creation**: Users can add custom envelope categories with names and budgeted amounts
- **Envelope Allocation Management**: Forms to fund envelopes from Available to Budget
- **Real-Time Allocation Updates**: Instant recalculation when allocations change
- **Allocation Validation**: Prevents over-allocation beyond Available to Budget
- **Custom Envelope Names**: Support for both mock and user-created envelope categories
- **Form Validation**: Required fields, positive amounts, proper error handling
- **Success Feedback**: Visual confirmation when envelopes are created
- **Demo Mode Integration**: All envelope functionality works offline with mock data

### 🎯 **Next Steps - Phase 3**
- **✅ Split Transactions**: Completed with multi-envelope support, validation, and UI polish
- **🚀 IMMEDIATE FOCUS - Piggybanks (Savings Goals)**: Build savings goal experience
- **Enhanced Analytics**: Spending patterns, budget variance analysis (after piggybanks)
- **Transaction Management Enhancements**: Advanced filtering/editing (after analytics)

### 📱 **Mobile/Desktop UX Patterns Established**
- **Mobile**: Tap for primary action (edit), swipe for secondary action (delete)
- **Desktop**: Hover to reveal actions, click to perform
- **Responsive Design**: Seamless experience across all device sizes
- **Accessibility**: Proper touch targets, keyboard navigation, screen reader support

---
*Document created: December 27, 2025*
*Last updated: January 7, 2026*

## 11. Moveable Reordering Migration

### Overview
The current envelope reordering experience in `EnvelopeListView` uses Framer Motion's `Reorder` API. While functional, it feels stiff on touch devices and lacks the matrix-based animations present in advanced design tools. This document outlines the steps to migrate (or augment) the reordering experience using [Moveable](https://github.com/daybrush/moveable) so we can prototype a smoother, physics-like interaction layer.

### Goals
1. Deliver buttery-smooth drag interactions with `matrix3d` transforms.
2. Preserve React state as the source of truth for envelope order.
3. Support both mouse and touch without hacks (Moveable has native pointer handling).
4. Keep accessibility, keyboard navigation, and virtualization behavior intact.
5. Make the migration incremental so we can prototype and measure before committing fully.

### Current State Snapshot
- **Stack**: React + Zustand + Framer Motion `Reorder`.
- **Data**: `envelopes` array in `useEnvelopeStore` controls order index.
- **UX**: Long-press detection for touch, drag constraints handled by Framer Motion.
- **Pain Points**:
  - Drag start feels delayed on touch due to manual long-press timers.
  - Items jump instead of gliding; no inertia.
  - Layout shifts are handled by re-rendering rather than `matrix3d` transforms.

### Migration Strategy
We will layer Moveable *per envelope row*, dispatching final positions back into React state when drags settle. Steps:

#### Phase 0 – Prototype Sandbox ✅ COMPLETED
1. Install Moveable: `npm install moveable`.
2. Clone a simplified list view (e.g., `EnvelopeReorderPlayground.tsx`).
3. Wrap each row in `<Moveable target={ref} draggable snappable>`.
4. Track `x/y` via Moveable's `onDrag` events; snap to row height increments.
5. On `onDragEnd`, compute the new index and update a local array.
6. Record notes on latency, mobile feel, and code complexity.

#### Phase 1 – Integrate Into EnvelopeListView (Opt-in) ✅ COMPLETED
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

#### Phase 2 – Polish & Accessibility ✅ COMPLETED
1. ✅ Added keyboard accessibility with up/down arrow buttons on each envelope card for users who prefer button-based reordering.

### Technical Considerations
- **Performance**: Moveable manipulates transforms without forcing React renders, but we must avoid re-rendering the entire list on every `onDrag` tick. Keep derived positions in refs or a lightweight store slice.
- **Collision Detection**: Moveable doesn't automatically swap list items. We'll need to detect when the dragged card crosses another card's midpoint and reorder the backing array accordingly.
- **Virtualization**: If we later virtualize the list, ensure Moveable references stay valid when rows unmount.
- **SSR**: Moveable is browser-only. Guard imports if we ever render on the server.

### Implementation Status
- [x] **Phase 0 Sandbox**: Playground validates Moveable APIs
- [x] **Moveable-Only Drag Path**: Framer Motion Reorder code removed - Moveable is now the default
- [x] **Snap-to-row Logic**: Drag math snaps consistently across desktop + mobile
- [x] **State Reconciliation**: Order persistence batched and `localEnvelopes` stays in sync without flicker
- [x] **Visual Feedback**: Matrix transforms/shadows working smoothly
- [x] **Touch Support**: Native pointer handling confirmed (no hacks needed)
- [x] **Keyboard Accessibility**: Up/down arrow buttons added to each envelope card
- [x] **Feature Flag Removed**: Moveable is now the default and only reordering method

### Resolved Decisions
1. **Framer Motion**: Removed - Moveable is now the default and only reordering method
2. **Multi-select**: Not needed for current use case - single envelope reordering is sufficient
3. **Partial States**: Not persisting - drag operations are atomic (complete or cancel)
4. **Keyboard Accessibility**: Implemented via up/down arrow buttons on each card

### Future Enhancements (Optional)
1. **Performance Tuning**: Monitor Moveable instances and memory usage in production
2. **Analytics**: Track reordering usage patterns to inform future UX improvements
3. **Animations**: Consider adding more sophisticated spring animations for button-based reordering

---
**Status**: Phase 0, 1, & 2 ✅ COMPLETED - Moveable reordering is now the default reordering method. The implementation provides buttery-smooth drag interactions with native touch support, keyboard accessibility via arrow buttons, and preserves all existing functionality. Feature flag and legacy Framer Motion code have been removed.

---

## 12. Recent Bug Fixes & Improvements (2026-01-04)

### 🐛 **Critical Bug Fixes**
- **Income Source Duplication**: Fixed issue where deleted income sources reappeared after page refresh
  - Root cause: `deleteIncomeSource` only removed from local state, not Firebase
  - Solution: Added proper Firebase deletion with optimistic UI updates
  - Result: Deleted items now stay deleted across page refreshes

- **Offline Swipe-to-Delete**: Fixed stuck red swipe state when offline
  - Root cause: Delete operations awaited Firebase calls, causing UI to hang
  - Solution: Made delete handlers fire-and-forget Firebase calls
  - Result: Immediate UI feedback both online and offline

- **Budget Amount Editing**: Fixed "failed to update budget" error
  - Root cause: `updateEnvelopeAllocation` passed undefined `envelopeId` to Firebase
  - Solution: Only pass defined fields to Firebase updates
  - Result: Budget amounts now edit successfully

- **Duplicate Allocation Transactions**: Fixed inflated allocated budget amounts
  - Root cause: `syncBudgetAllocationTransaction` created new transactions instead of updating existing ones
  - Solution: Delete all existing allocation transactions first, then create one new one
  - Result: Accurate budget calculations with no duplicate transactions

### 🚀 **Performance Improvements**
- **Immediate UI Updates**: Added manual state refreshes after create/update operations
- **Optimistic Updates**: All CRUD operations now provide instant UI feedback
- **Offline Resilience**: Enhanced offline behavior with proper Firebase queuing

### 📱 **Enhanced User Experience**
- **Inline Budget Editing**: Direct budget amount editing without modals
- **Consistent Behavior**: Online/offline operations now behave identically
- **Error Handling**: Better error messages and recovery options

### 🔧 **Technical Improvements**
- **State Management**: Fixed race conditions in real-time listeners
- **Firebase Integration**: Proper error handling and offline queuing
- **Transaction Sync**: Clean allocation transaction management

---

## 10. Offline Capability Troubleshooting

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

4. **Is Promise.all completing?**
   - Add console.log in .then() and .catch() of Promise.all
   - Check if hasInitialLoadStarted is being set to true

5. **Is there a different code path on navigation vs initial mount?**
   - Check if useEffect dependency array should include something
   - Verify component lifecycle on navigation

---

## Alternative Approaches to Consider

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

---

## 11. Moveable Reordering Migration Plan

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
**Status**: Phase 0, 1, & 2 - Moveable reordering is now the default reordering method. The implementation provides buttery-smooth drag interactions with native touch support, keyboard accessibility via arrow buttons, and preserves all existing functionality. Feature flag and legacy Framer Motion code have been removed.

## 12. Apple Wallet-Style Card Stack Implementation

## Overview
A premium payment method selector inspired by Apple Wallet's card stack interface, featuring a vertical overlapping card layout with smooth animations and intuitive interactions. This implementation provides a modern, familiar payment selection experience for the budget app.

## Features Implemented

### Visual Design
- **Vertical Card Stack**: Cards overlap using negative margins (-120px) creating a fanned-out appearance
- **CSS-Only Mini Cards**: No images used - pure CSS styling with network logos and last 4 digits
- **Card Colors**: 12 preset colors including bank-style options (Chase blue, Amex gold, etc.)
- **Dark Mode Support**: Full theme compatibility with proper contrast adjustments
- **Realistic Shadows**: Multi-layered shadows for depth perception

### Interaction Design
- **Dropdown Interface**: Click-to-open card stack below payment method field
- **Single-Tap Selection**: Immediate card selection without multi-step process
- **Swipe-to-Delete**: Left swipe reveals red delete zone with trash icon
- **Confirmation Dialog**: Destructive action protection with card name display
- **Smooth Animations**: 60fps transitions using Framer Motion
- **Touch & Mouse Support**: Cross-platform gesture handling

### Card Management
- **Add New Cards**: Modal form with name, network, last 4 digits, and color selection
- **Custom Card Creation**: Users can add personalized payment methods
- **Delete Any Card**: All cards (including defaults) can be removed
- **Auto-Selection**: Smart selection handling when cards are deleted
- **Persistent Storage**: Cards remain available across sessions

## Technical Implementation

### Architecture
- **React Component**: `CardStackDemo.tsx` with TypeScript interfaces
- **State Management**: Local state with hooks for demo purposes
- **Animation Library**: Framer Motion for smooth transitions
- **Swipe Gestures**: `SwipeableRow` component for delete functionality
- **CSS Styling**: Separate CSS file for maintainable styles

### Key Components
```typescript
interface PaymentSource {
  id: string;
  name: string;
  network: 'Visa' | 'Mastercard' | 'Amex';
  last4: string;
  color: string;
}
```

### File Structure
- `src/views/CardStackDemo.tsx` - Main component implementation
- `src/styles/CardStack.css` - Card stack styling
- `src/components/ui/SwipeableRow.tsx` - Swipe gesture handling

## User Experience Flow

1. **Payment Field Click** → Card stack dropdown opens
2. **Card Selection** → Single tap selects and closes dropdown
3. **Add New Card** → Opens modal with form fields
4. **Card Creation** → Real-time preview and validation
5. **Swipe to Delete** → Left swipe reveals delete option
6. **Confirmation** → Modal dialog prevents accidental deletion

## Future Integration Plan

### Phase 1: Integration into Add Transaction Flow
- **Target**: Replace existing payment method selector in `AddTransactionView.tsx`
- **Scope**: Integrate CardStack component with transaction creation
- **Data Persistence**: Connect to Firebase for card storage
- **Validation**: Add card number validation (Luhn algorithm)

### Phase 2: Payment Method Management
- **Target**: Add dedicated payment method management in Settings
- **Scope**: Full CRUD operations for payment methods
- **Security**: Encrypt sensitive card data in Firebase
- **Sync**: Cross-device payment method synchronization

### Phase 3: Enhanced Features
- **Target**: Advanced payment method features
- **Scope**: Card scanning, automatic detection, recurring payments
- **Analytics**: Payment method usage tracking
- **Integration**: Connect with actual payment processors

### Technical Considerations
- **Firebase Security Rules**: Implement proper access controls for payment data
- **Encryption**: Encrypt card numbers and sensitive information
- **Compliance**: PCI DSS considerations for payment data handling
- **Performance**: Optimize card loading and caching strategies

## Implementation Status
- [x] **Demo Component**: Fully functional CardStackDemo with all features
- [x] **Swipe-to-Delete**: Integrated with confirmation dialog
- [x] **Add Card Modal**: Complete form with validation and preview
- [x] **Animation System**: Smooth transitions and micro-interactions
- [x] **Responsive Design**: Works across all device sizes
- [ ] **Firebase Integration**: Planned for Phase 1
- [ ] **Payment Processing**: Planned for Phase 3
- [ ] **Security Implementation**: Planned for Phase 2

## Design Decisions
1. **Card Stack Layout**: Vertical overlapping chosen over horizontal carousel for better space utilization
2. **Single-Tap Selection**: Simplified UX over multi-step selection processes
3. **Swipe Gestures**: Native swipe-to-delete for familiar mobile interaction patterns
4. **CSS-Only Cards**: No images for performance and maintainability
5. **Color Customization**: User-selectable colors for personalization

---
**Status**: Demo implementation - The Apple Wallet-style Card Stack provides a premium, intuitive payment method selection experience with smooth animations, swipe-to-delete functionality, and comprehensive card management features. Ready for integration into the main application in future phases.
