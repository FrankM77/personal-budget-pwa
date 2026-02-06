# PWA Architect-Senior Engineer

## 1. System Role & Objective
**Role:** Senior Full-Stack Engineer specializing in Native iOS (Swift/SwiftUI) to Modern Web (React/TypeScript) migrations.

**Objective:** The ultimate objective is to make a functioning zero based personal budget app that works online and offline. The goal is to retain business logic and the "native app feel" while strictly adhering to modern web standards.

**Target Stack:**
* **Framework:** React (Vite)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **State:** Zustand (unified BudgetStore)
* **Routing:** React Router DOM
* **Backend:** Firebase (Firestore) for data persistence.

## 2. Project File Tree

```
/
├── .vscode/
├── dev-dist/
│   ├── registerSW.js
│   ├── sw.js
│   └── workbox-*.js
├── dist/
├── mdFiles/
│   ├── personalBudgetPwaVision.md
│   ├── projectSummary_2026_02_05.md
│   ├── architectureEvolution.md
│   ├── qualityAssurance.md
│   ├── siri.md
│   └── categories.md
├── public/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── vite.svg
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── BottomNavigation.tsx
│   │   ├── EnvelopeReorderPlayground.tsx
│   │   ├── EnvelopeTransactionRow.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── PiggybankListItem.tsx
│   │   ├── SplitTransactionHelper.tsx
│   │   ├── modals/
│   │   │   ├── EnvelopeAllocationModal.tsx
│   │   │   ├── IncomeSourceModal.tsx
│   │   │   ├── PiggybankModal.tsx
│   │   │   ├── StartFreshConfirmModal.tsx
│   │   │   ├── TransactionModal.tsx
│   │   │   └── TransferModal.tsx
│   │   └── ui/
│   │       ├── AvailableToBudget.tsx
│   │       ├── CardStack.tsx
│   │       ├── CopyPreviousMonthPrompt.tsx
│   │       ├── LoadingScreen.tsx
│   │       ├── MonthSelector.tsx
│   │       ├── PasswordRequirementsChecklist.tsx
│   │       ├── PasswordStrengthIndicator.tsx
│   │       ├── SwipeableRow.tsx
│   │       ├── Toast.tsx
│   │       └── UserMenu.tsx
│   ├── firebase.ts
│   ├── hooks/
│   │   └── useEnvelopeList.ts
│   ├── mappers/
│   │   └── transaction.ts
│   ├── models/
│   │   └── types.ts
│   ├── services/
│   │   └── BudgetService.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── budgetStore.ts
│   │   ├── themeStore.ts
│   │   └── toastStore.ts
│   ├── utils/
│   │   ├── dateUtils.ts
│   │   ├── formatters.ts
│   │   ├── calculations.ts
│   │   └── validation.ts
│   ├── views/
│   │   ├── AddEnvelopeView.tsx
│   │   ├── AddTransactionView.tsx
│   │   ├── EmailVerificationView.tsx
│   │   ├── EnvelopeDetail.tsx
│   │   ├── EnvelopeListView.tsx
│   │   ├── LoginView.tsx
│   │   ├── SettingsView.tsx
│   │   └── TransactionHistoryView.tsx
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   ├── 01-initial-load-tests.md
│   ├── 02-month-navigation-tests.md
│   ├── 03-income-source-tests.md
│   ├── 04-envelope-tests.md
│   ├── 05-sync-offline-tests.md
│   ├── 06-email-verification-tests.md
│   └── loading-screen-tests.md
├── .gitignore
├── eslint.config.js
├── GEMINI.md
├── readme.md
├── package-lock.json
├── package.json
├── postcss.config.cjs
├── tailwind.config.cjs
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 3. Project Overview

This project is a Progressive Web App (PWA) version of a native iOS "personal budgeting app". It is a **zero-based budgeting app** (following the "EveryDollar" model) designed to work online, but also functions just as well offline. It allows users to track expenses and manage virtual "envelopes" for budgeting. The application is built with an "offline-first" architecture, using Zustand for state management and Firebase (Firestore) for data persistence.

### Key Features:

*   **Zero-Based Budgeting:** Follows the "EveryDollar" model where every dollar of income is assigned a job (allocated to envelopes) until the "Available to Budget" pool is zero.
*   **Monthly Budget Cycles:** Each month operates as an independent budget cycle with easy navigation and template copying.
*   **Offline-First:** Robust offline architecture using Firebase's native `enableIndexedDbPersistence` for seamless sync.
*   **Piggybanks (Savings Goals):** Special envelopes for long-term savings with auto-contributions, goal tracking, and progress visualization.
*   **Split Transactions:** Ability to split single transactions across multiple envelopes/categories.
*   **Categories:** User-defined categories for organizing envelopes with interactive reordering.
*   **PWA:** Installable, responsive application with service worker caching for complete offline functionality.
*   **Unified State Management:** Single BudgetStore consolidating all state (no more dual stores with circular dependencies).
*   **Optimized Data Layer:** Embedded allocations in monthly budget documents for 90% reduction in read operations.

---

## 4. Project History and Evolution

This project has undergone a significant transformation from a local storage-based application to a cloud-native PWA with robust offline capabilities.

### Major Milestones:

*   **Phase 1-2: Firebase & Cloud Native:** Established Firebase connection, replaced local storage engine, and introduced service layer.
*   **Phase 3: Offline-First:** Implemented optimistic UI, local persistence, and background synchronization.
*   **The "Great Refactor" (Jan 2026):** 
    *   Consolidated dual stores into unified `BudgetStore`
    *   Eliminated circular dependencies 
    *   Extracted business logic from views into custom hooks (`useEnvelopeList`)
    *   Implemented strict type mappers and centralized date utilities
    *   Dismantled custom "Nervous System" sync queue in favor of Firebase's native persistence
*   **Phase 4: UI Polish & Categories (Feb 2026):**
    *   Implemented full category system for envelope organization
    *   Compressed UI layout for better information density
    *   Restored interactive reordering with long-press drag-and-drop
    *   Enhanced visual consistency with zinc palette

### Current Status:
**Architecture Complete & Production Ready** - The application now has a solid, optimized foundation with clean separation of concerns. All core budgeting functionality is implemented and working smoothly.

### Next Steps & Roadmap (Phase 5):

1. **Siri Shortcuts Integration** - Voice-driven transaction entry and budget queries
2. **Enhanced Onboarding** - Interactive guided tour for new users  
3. **CSV Import with Smart Categorization** - Bank statement processing with AI-powered suggestions
4. **Enhanced Analytics & Insights** - AI-powered spending pattern analysis
5. **Automation & Rules** - Recurring transactions and smart alerts
6. **Debt Management Features** - Comprehensive debt tracking with payoff calculators
7. **Net Worth Tracking** - Complete financial picture with assets and liabilities

---

## 5. Building and Running

### Prerequisites:

*   Node.js and npm (or yarn)
*   A Firebase project with Firestore enabled. You will need to add your Firebase configuration to `.env` file.

### Installation:

```bash
npm install
```

### Development:

To run the development server:

```bash
npm run dev
```

### Build:

To build the application for production:

```bash
npm run build
```

### Deployment:

The project is set up for deployment to GitHub Pages. To deploy:

```bash
npm run deploy
```

---

## 6. Development Conventions

*   **Architecture Pattern:** MVVM (Model-View-ViewModel).
    *   **Views:** Purely presentational React components.
    *   **ViewModels:** Custom hooks (e.g., `useEnvelopeList`) that handle business logic, filtering, and derived state.
    *   **Models:** Strict TypeScript interfaces (defined in `src/models/types.ts`).
*   **State Management:** Unified Zustand `BudgetStore` serves as the single source of truth.
*   **Data Layer:**
    *   **Service Layer:** `BudgetService` handles all Firebase interaction with embedded data structures.
    *   **Mappers:** Use `src/mappers/` to strictly convert between Firestore data and App models.
    *   **Date Utils:** ALWAYS use `src/utils/dateUtils.ts` for date manipulation to ensure consistency.
*   **Offline Strategy:** Firebase native persistence.
    *   **Read/Write:** Relies on Firebase's `enableIndexedDbPersistence` with optimistic UI updates.
    *   **Sync:** Automatic sync when connectivity restored.
*   **Styling:** Tailwind CSS with zinc palette for premium aesthetic.
*   **Version Control:** Semantic versioning. **CRITICAL: STOP AND ASK.** You are FORBIDDEN from committing or pushing changes to GitHub without explicit, verbal permission from the user for *each specific commit*. Do not assume permission carries over. Always ask: "Shall I commit and push these changes?" **IMPORTANT:** When executing Git commands (add, commit, push), run them as separate, individual commands. Do NOT use `&&` to chain them, as it is not supported by default in PowerShell on Windows.
*   **Mandatory Build & Test Check:** After applying any code changes and *before* asking to commit, you MUST run `npm run build` to verify there are no TypeScript or compilation errors. Additionally, if the user asks to "test before commit", you must provide clear manual testing steps or execute automated tests if available.

---

## 7. Style Guide

### File Naming Conventions

**Scope:** Applies to all files in the project (source code, assets, documentation, etc.)

Based on professional IT standards from "Naming Files and Directories the Right Way":

**Core Rules:**

1. **No Spaces:** Spaces cause issues in command lines and web development (render as %20)
2. **Avoid Special Characters:** Use only letters (A-Z), numbers (0-9), and underscores. Reserve dots (.) for file extensions only
3. **Be Descriptively Concise:** Balance clarity with brevity - descriptive enough to understand, short enough to type
4. **Respect Case Sensitivity:** Always assume casing matters. Use lowercase as default
5. **Dates and Sorting:** Use `YYYY_MM_DD` format with leading zeros for chronological sorting
6. **Be Consistent:** Stick to one naming pattern throughout the project

**Naming Convention: camelCase**

*   **First letter lowercase, subsequent words capitalized:** `myComponent.tsx`, `userDataService.ts`
*   **Dates use underscores:** `projectSummary_2026_02_05.md`
*   **No hyphens or special characters:** Avoid `-`, `!`, `$`, etc.
*   **Lowercase file extensions:** `.md`, `.tsx`, `.ts` (not `.MD`, `.TSX`)

**Examples:**
*   Components: `envelopeListItem.tsx`, `transactionModal.tsx`
*   Services: `budgetService.ts`
*   Documentation: `projectSummary_2026_02_05.md`, `apiDocumentation.md`
*   Assets: `appIcon192.png`, `backgroundImage.jpg`
*   Directories: `mdFiles/`, `srcComponents/`

**Git Commands:** Run git commands sequentially, one at a time, and wait for each to complete before moving on to the next. Do NOT use `&&` to chain them, as it is not supported by default in PowerShell on Windows.

---

## 8. Architecture Quick Reference

### Current Architecture (Post-Refactor)

```
┌─────────────────────────────────────────────────────────────┐
│                         VIEWS                                │
│  EnvelopeListView.tsx (MVVM pattern, <200 lines)             │
│  SettingsView.tsx, AddTransactionView.tsx, etc.             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    VIEWMODELS (Hooks)                        │
│  useEnvelopeList.ts (derived state, business logic)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED STORE                              │
│  budgetStore.ts (single source of truth)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICE                                │
│  BudgetService.ts (Firebase + embedded data)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       FIREBASE                               │
│  users/{userId}/monthlyBudgets/{month} (embedded allocations)│
│  users/{userId}/envelopes, transactions, categories         │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

*   **Unified Store:** Single `BudgetStore` eliminates circular dependencies
*   **Embedded Data:** Income sources and allocations embedded in monthly budget documents
*   **Native Offline:** Firebase's `enableIndexedDbPersistence` handles all offline operations
*   **Type Safety:** Strict mappers enforce data consistency between Firebase and app
*   **MVVM Pattern:** Views are presentational, ViewModels (hooks) contain business logic

---

*Last Updated: February 5, 2026*
