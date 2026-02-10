# Categories + Envelope Grouping

**Status:** ✅ IMPLEMENTED (February 2026) - Enhanced with Payment Method Reordering

## Overview
User-defined categories for organizing envelopes, with category-based grouping on the main screen. Categories are assigned at the envelope level (including piggybanks), enabling better reporting/insights without requiring category selection per transaction.

## Decisions (Locked)
- Categories are stored as first-class documents and referenced by `categoryId`.
- Users setup categories in onboarding. Default categories are provided (Giving, Savings, Housing, Transportation, Food, Personal, Health, Insurance, Debt).
- Categories are included in onboarding.
- Piggybanks participate in categories (their auto-contributions are treated as spend toward insights).
- Piggybanks appear inside category sections (no separate Piggybanks section).
- Reordering is within a section (within-category). No dragging across categories.
- Piggybank toggle behavior in envelope creation uses Option A: defaults `monthlyContribution` to `0` and requires user input.
- Debt will be a new envelope type that appears in the Debt category.
- Debt envelopes will have a `monthlyPayment` field.
- Debt envelopes will have a `currentBalance` field.
- Debt envelopes will have a `startingBalance` field.
- Debt envelopes will have a `debtType` field (credit_card, student_loan, auto_loan, mortgage, personal_loan, other).
- Debt envelopes will have an `interestRate` field (optional, for future calculations).
- Debt envelopes will have a `minimumPayment` field.
- Debt envelopes will have a `targetPayoffDate` field (optional).
- Debt envelopes are basically reverse piggybanks. Instead of a goal amount, they have a starting balance and a monthly payment amount.
- Debt envelopes track progress toward payoff (balance decreasing over time).

## Data Model
### Firestore
- `users/{userId}/categories/{categoryId}`
  - Fields: `name`, `orderIndex`, `isArchived?`, `createdAt`, `updatedAt` (and `userId` optionally)
- `users/{userId}/envelopes/{envelopeId}`
  - Add: `categoryId?: string`

### TypeScript
- `src/models/types.ts`
  - Add `Category` interface.
  - Add `categoryId?: string` to `Envelope`.
  - Add `debtConfig?: DebtConfig` to `Envelope`.
  - Add `DebtConfig` interface: `startingBalance`, `currentBalance`, `monthlyPayment`, `minimumPayment`, `debtType`, `interestRate?`, `targetPayoffDate?`.
  - Add `DebtType` enum: `credit_card`, `student_loan`, `auto_loan`, `mortgage`, `personal_loan`, `other`.

## Services / Realtime Sync
### CategoryService
Create `src/services/CategoryService.ts` mirroring existing Firebase service patterns:
- `subscribeToCategories(userId, onUpdate)`
- `getAllCategories(userId)`
- `createCategory(category)`
- `updateCategory(userId, categoryId, updates)`
- `archiveCategory(userId, categoryId)` (preferred over hard delete)

### Store wiring
- `src/stores/budgetStore.ts`
  - Add state: `categories: Category[]`
  - Add actions: `fetchCategories`, `addCategory`, `updateCategory`, `archiveCategory`, `reorderCategories` (optional)

### Realtime subscriptions
- `src/stores/envelopeStoreRealtime.ts`
  - Add a `CategoryService.subscribeToCategories(...)` subscription.
  - Merge updates into store state like envelopes/transactions.

## UI/UX

### A) Envelope creation: single flow with Piggybank toggle ✅ COMPLETED
File: `src/views/AddEnvelopeView.tsx` (implemented)
- **Category selector**: Bound to store `categories` with real-time updates
- **Query string prefill**: `categoryId` from `?categoryId=...` parameter
- **Envelope type selector**: "Spending", "Piggybank", or "Debt" with conditional fields
- **Piggybank fields**: `targetAmount`, `monthlyContribution`, `color` (defaults to 0)
- **Debt fields**: `startingBalance`, `monthlyPayment`, `minimumPayment`, `debtType`, `interestRate`, `targetPayoffDate`
- **Smart defaults**: `monthlyContribution` defaults to 0 for piggybanks, `currentBalance` defaults to `startingBalance` for debt
- **Conditional saving**: Only saves relevant config based on envelope type
- **Form validation**: Required fields, positive amounts, proper error handling
- **Visual feedback**: Clear indication of envelope type with icons and colors
- **Responsive design**: Mobile-optimized layout with proper touch targets

### B) Main screen: category sections ✅ COMPLETED
File: `src/views/EnvelopeListView.tsx` (implemented)
- **Multiple sections**: Replaced single "Spending Envelopes" with category-based sections
- **Category ordering**: Sections ordered by `category.orderIndex`
- **Uncategorized section**: Handles envelopes with missing `categoryId`
- **Piggybank integration**: Piggybanks appear in their category sections with styling/badge
- **Debt envelope styling**: Distinct red/orange accent with negative balance indicators
- **Section headers**: Include `+` button that navigates to `/add-envelope?categoryId=<id>`
- **Debt progress display**: Shows payoff progress (e.g., "$2,500 of $5,000 paid off")
- **Real-time updates**: Category changes reflect immediately in section layout
- **Empty states**: Proper handling when categories have no envelopes
- **Visual hierarchy**: Clear separation between category sections with headers

### C) Reordering ✅ COMPLETED (V2)
- Reorder remains "within a section" - no moving envelopes across categories via drag.
- **V2 Implemented**: Moveable drag-and-drop per category section
- **Visual feedback**: Semi-transparent dragging, scale animations, drop zone indicators
- **Touch-optimized**: Long-press to initiate drag on mobile devices
- **Desktop support**: Click and drag with mouse cursor changes
- **Real-time updates**: Order persists immediately to Firebase
- **One Moveable container**: Each category section has its own Moveable instance
- **Smooth animations**: CSS transitions for reordering operations

### D) Settings: category management ✅ COMPLETED
File: `src/views/CategorySettingsView.tsx` (implemented)
- **List categories**: Display all categories with order and envelope count
- **Create category**: Modal form with name input and color selection
- **Rename category**: Inline editing with validation to prevent duplicates
- **Archive/unarchive category**: Soft delete with confirmation dialog
- **Reorder categories**: Drag-and-drop interface with visual feedback
- **Delete protection**: Prevents deletion of categories with assigned envelopes
- **Real-time sync**: Changes reflect immediately across all app components
- **Envelope count**: Shows how many envelopes use each category
- **Visual indicators**: Color-coded categories with status badges

### E) Onboarding
File: `src/components/ui/NewUserOnboarding.tsx` (and any related onboarding flow)
- Add a step to create starter categories.
  - Provide quick-add suggestions (Food, Bills, Transportation, Savings, etc.).
- Require at least 1 category before proceeding to envelope creation.
- Envelope creation step should pick a category (or allow Uncategorized).

## Reporting / Insights Integration
- Category spend is computed by mapping each transaction to its envelope, then to the envelope's `categoryId`.
- Piggybank auto-contributions should roll up into the piggybank's category.
- Debt payments should appear as negative spend in the Debt category (reducing overall debt).
- Transfers should generally be excluded from category "spending" reports to prevent distortion (can be revisited).
- Debt progress metrics: total debt by category, debt payoff progress, interest savings opportunities.

## Debt Envelope Specific Features

### Debt Validation
- `monthlyPayment` must be >= `minimumPayment`.
- `startingBalance` must be > 0.
- `currentBalance` must be <= `startingBalance`.
- `interestRate` must be between 0-100% if provided.

### Debt Progress Tracking
- Automatically update `currentBalance` when payments are recorded.
- Calculate payoff date based on current payment rate.
- Show progress percentage: `((startingBalance - currentBalance) / startingBalance) * 100`.

### Debt Notifications (Future)
- Minimum payment reminders.
- Payoff milestone celebrations.
- Interest rate change alerts.

## Known Touchpoints / Files
- `src/models/types.ts`
- `src/services/CategoryService.ts` (new)
- `src/stores/budgetStore.ts`
- `src/stores/envelopeStoreRealtime.ts`
- `src/views/AddEnvelopeView.tsx`
- `src/views/EnvelopeListView.tsx`
- `src/components/ui/NewUserOnboarding.tsx`
- `src/components/envelopes/DebtEnvelopeCard.tsx` (new)
- `src/utils/debtCalculations.ts` (new)
- `src/validation/envelopeValidation.ts` (update)

## Implementation Status

### ✅ Completed Features (v1.6.9)
1. ✅ Types + CategoryService + store state/actions + realtime subscription
2. ✅ AddEnvelopeView: category selector + envelope type selector (spending/piggybank)
3. ✅ EnvelopeListView: render category sections (including piggybanks)
4. ✅ Settings: category CRUD + archive + reorder
5. ✅ Onboarding: category creation step
6. ✅ Interactive reordering with long-press drag-and-drop
7. ✅ Payment Method Reordering: Drag-and-drop card stack with visual feedback
8. ✅ Deduplication: Automatic cleanup of duplicate categories
9. ✅ Enhanced UI: Visual feedback for drag operations and category management

### 🚧 Planned Features (Phase 5)
- **Debt Envelopes** (Phase 5 - Priority #5): Debt envelope type with tracking, payoff calculators, and progress visualization
- **Debt Progress Tracking**: Automatic balance updates and payoff date calculations
- **Debt Reporting**: Category-based debt metrics and interest savings opportunities

---

## Recent Enhancements (v1.6.9)

### Payment Method Reordering
- **Drag & Drop Interface**: Users can now reorder payment methods in the card stack
- **Visual Feedback**: Semi-transparent dragging, blue dashed border on drop target
- **Persistent Order**: New order saves to app settings and survives app restarts
- **Instructional UI**: "💡 Drag and drop cards to reorder" hint appears with 2+ cards
- **Smooth Animations**: Scale and opacity transitions during drag operations

### Category Deduplication
- **Automatic Cleanup**: `CategoryService.deduplicateCategories()` removes duplicate category names
- **Firestore Integration**: Cleanup runs during initial load and when duplicates detected
- **User Safety**: Keeps oldest occurrence, removes newer duplicates
- **Real-time Sync**: Deduplication works with real-time subscriptions

### Enhanced User Experience
- **Better Error Handling**: Graceful fallbacks for failed operations
- **Improved Visual Feedback**: Clear indicators for all interactive elements
- **Consistent Patterns**: Mobile tap-to-edit, desktop hover-to-reveal actions
