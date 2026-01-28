# Categories + Envelope Grouping Plan

## Goal
Add user-defined categories to the app, assign categories at the envelope level (including piggybanks), and display the main envelope list grouped into category sections. This enables better reporting/insights without requiring category selection per transaction.

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

### A) Envelope creation: single flow with Piggybank toggle
File: `src/views/AddEnvelopeView.tsx`
- Add category selector bound to store `categories`.
- Prefill `categoryId` from query string `?categoryId=...`.
- Add envelope type selector: "Spending", "Piggybank", or "Debt".
  - When "Piggybank" selected, reveal piggybank fields (`targetAmount`, `monthlyContribution`, `color`).
  - When "Debt" selected, reveal debt fields (`startingBalance`, `monthlyPayment`, `minimumPayment`, `debtType`, `interestRate`, `targetPayoffDate`).
  - Default `monthlyContribution` to `0` for piggybanks (Option A).
  - Default `currentBalance` to `startingBalance` for debt envelopes.
- Save envelope with:
  - `categoryId` for all envelope types.
  - `isPiggybank` + `piggybankConfig` only when piggybank type selected.
  - `isDebt` + `debtConfig` only when debt type selected.

### B) Main screen: category sections
File: `src/views/EnvelopeListView.tsx`
- Replace the single "Spending Envelopes" section with multiple sections:
  - One per category (ordered by `category.orderIndex`).
  - Plus an "Uncategorized" section for envelopes with missing `categoryId`.
- Piggybanks appear in their category section (keep piggybank styling/badge).
- Debt envelopes appear in their category section with distinct styling (red/orange accent, negative balance indicator).
- Section header includes `+` button that navigates to `/add-envelope?categoryId=<id>`.
- Debt envelopes show progress as balance decreasing (e.g., "$2,500 of $5,000 paid off").

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

## Suggested Implementation Order
1) Types + CategoryService + store state/actions + realtime subscription
2) AddEnvelopeView: category selector + envelope type selector (spending/piggybank/debt)
3) EnvelopeListView: render category sections (including piggybanks and debt envelopes)
4) Debt envelope components and validation
5) Settings: category CRUD + archive + (optional reorder)
6) Onboarding: category creation step
7) Debt progress tracking and calculations
8) Debt-specific reporting features
