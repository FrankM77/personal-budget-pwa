# Categories + Envelope Grouping Plan

## Goal
Add user-defined categories to the app, assign categories at the envelope level (including piggybanks), and display the main envelope list grouped into category sections. This enables better reporting/insights without requiring category selection per transaction.

## Decisions (Locked)
- Categories are stored as first-class documents and referenced by `categoryId`.
- Users manage categories in Settings.
- Categories are included in onboarding.
- Piggybanks participate in categories (their auto-contributions are treated as spend toward insights).
- Piggybanks appear inside category sections (no separate Piggybanks section).
- Reordering is within a section (within-category). No dragging across categories.
- Piggybank toggle behavior in envelope creation uses Option A: defaults `monthlyContribution` to `0` and requires user input.

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

### A) Envelope creation: single flow with Piggybank toggle
File: `src/views/AddEnvelopeView.tsx`
- Add category selector bound to store `categories`.
- Prefill `categoryId` from query string `?categoryId=...`.
- Add toggle: "This is a Piggybank".
  - When toggled on, reveal existing piggybank fields (`targetAmount`, `monthlyContribution`, `color`).
  - Default `monthlyContribution` to `0` (Option A).
- Save envelope with:
  - `categoryId` for both normal envelopes and piggybanks.
  - `isPiggybank` + `piggybankConfig` only when piggybank toggle is enabled.

### B) Main screen: category sections
File: `src/views/EnvelopeListView.tsx`
- Replace the single "Spending Envelopes" section with multiple sections:
  - One per category (ordered by `category.orderIndex`).
  - Plus an "Uncategorized" section for envelopes with missing `categoryId`.
- Piggybanks appear in their category section (keep piggybank styling/badge).
- Section header includes `+` button that navigates to `/add-envelope?categoryId=<id>`.

### C) Reordering
- Reorder remains "within a section".
- No moving envelopes across categories via drag.
- Implementation approach:
  - V1: keep reorder using up/down controls inside each category section.
  - V2: optionally add Moveable drag reorder per category section (one Moveable container per section).

### D) Settings: category management
Add a Settings screen/section for categories:
- List categories
- Create category
- Rename category
- Archive/unarchive category
- Reorder categories (optional)

### E) Onboarding
File: `src/components/ui/NewUserOnboarding.tsx` (and any related onboarding flow)
- Add a step to create starter categories.
  - Provide quick-add suggestions (Food, Bills, Transportation, Savings, etc.).
- Require at least 1 category before proceeding to envelope creation.
- Envelope creation step should pick a category (or allow Uncategorized).

## Reporting / Insights Integration
- Category spend is computed by mapping each transaction to its envelope, then to the envelope’s `categoryId`.
- Piggybank auto-contributions should roll up into the piggybank’s category.
- Transfers should generally be excluded from category "spending" reports to prevent distortion (can be revisited).

## Known Touchpoints / Files
- `src/models/types.ts`
- `src/services/CategoryService.ts` (new)
- `src/stores/budgetStore.ts`
- `src/stores/envelopeStoreRealtime.ts`
- `src/views/AddEnvelopeView.tsx`
- `src/views/EnvelopeListView.tsx`
- `src/components/ui/NewUserOnboarding.tsx`

## Suggested Implementation Order
1) Types + CategoryService + store state/actions + realtime subscription
2) AddEnvelopeView: category selector + piggybank toggle
3) EnvelopeListView: render category sections (including piggybanks)
4) Settings: category CRUD + archive + (optional reorder)
5) Onboarding: category creation step
