# PWA Architect-Senior Engineer

## 1. System Role & Objective
**Role:** Senior Full-Stack Engineer specializing in Native iOS (Swift/SwiftUI) to Modern Web (React/TypeScript) migrations.

**Objective:** The ultimate objective is to make a functioning zero based personal budget app that works online and offline. The goal is to retain business logic and the "native app feel" while strictly adhering to modern web standards.

**Target Stack:**
* **Framework:** React (Vite)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **State:** Zustand
* **Routing:** React Router DOM
* **Backend:** Firebase (Firestore) for data persistence.



## 2. Project File Tree

```
/
├── .vscode/
├── dev-dist/
│   ├── registerSW.js
│   ├── sw.js
│   └── workbox-5a5d9309.js
├── dist/
├── MD Files/
│   ├── Complete-Roadmap-Review.md
│   ├── Personal-Budget-PWA-Vision.md
│   ├── Project-Summary-2026-01-19.md
│   ├── Thirty-thousand-foot-view.MD
│   ├── BUG_TESTING_GUIDE.md
│   └── OFFLINE_TROUBLESHOOTING.md
├── public/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── BottomNavigation.tsx
│   │   ├── EnvelopeReorderPlayground.tsx
│   │   ├── EnvelopeTransactionRow.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── PiggybankListItem.tsx
│   │   ├── SplitTransactionHelper.tsx
│   │   ├── debug/
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
│   │   └── transactionMapper.ts
│   ├── models/
│   │   └── types.ts
│   ├── services/
│   │   ├── EnvelopeService.ts
│   │   ├── MonthlyBudgetService.ts
│   │   └── TransactionService.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── budgetStore.ts
│   │   ├── envelopeStoreConverters.ts
│   │   ├── envelopeStoreRealtime.ts
│   │   ├── envelopeStoreSettings.ts
│   │   ├── envelopeStoreTemplates.ts
│   │   ├── themeStore.ts
│   │   └── toastStore.ts
│   ├── styles/
│   │   └── globals.css
│   ├── types/
│   │   └── schema.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── calculations.ts
│   │   └── validation.ts
│   ├── views/
│   │   ├── AddEnvelopeView.tsx
│   │   ├── AddTransactionView.tsx
│   │   ├── CardStackDemo.tsx
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
├── .gitignore
├── debug-import.js
├── eslint.config.js
├── GEMINI.md
├── HouseBudget_Backup_2025-11-25.json
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.cjs
├── README.md
├── save.ps1
├── save.sh
├── Screenshot 2025-11-20 at 7.47.35 PM.png
├── tailwind.config.cjs
├── test-swift-backup.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 3. Project Overview

This project is a Progressive Web App (PWA) version of a native iOS "personal budgeting app". It is a **zero-based budgeting app** (following the "EveryDollar" model) designed to work online, but also functions just as well offline. It allows users to track expenses and manage virtual "envelopes" for budgeting. The application is built with an "offline-first" architecture, using Zustand for state management and Firebase (Firestore) for data persistence. All project status information is located in the `MD Files` directory.

### Key Features:

*   **Zero-Based Budgeting:** Follows the "EveryDollar" model where every dollar of income is assigned a job (allocated to envelopes) until the "Available to Budget" pool is zero.
*   **Monthly Budget Cycles:** Each month operates as an independent budget cycle with easy navigation and template copying.
*   **Offline-First:** Robust offline architecture using a hybrid approach (Firebase persistence + custom sync "Nervous System") to ensure data integrity and optimistic UI updates.
*   **Piggybanks (Savings Goals):** Special envelopes for long-term savings with auto-contributions, goal tracking, and progress visualization.
*   **Split Transactions:** Ability to split single transactions across multiple envelopes/categories.
*   **PWA:** Installable, responsive application with service worker caching for complete offline functionality.
*   **State Management:** Modular Zustand store architecture (refactored into focused slices) serving as the centralized ViewModel.
*   **Backend:** Firebase Firestore with user-scoped data structure (`users/{userId}/...`).

---

## 4. Project History and Evolution

This project has undergone a significant transformation from a local storage-based application to a cloud-native PWA with robust offline capabilities.

### Major Milestones:

*   **Phase 1-2: Firebase & Cloud Native:** Established Firebase connection, replaced local storage engine, and introduced service layer.
*   **Phase 3: Offline-First:** Implemented optimistic UI, local persistence, and background synchronization.
*   **The "Great Refactor" (Jan 2026):** Consolidate "God Objects" and split monolithic stores into focused Zustand slices. Extracted business logic from views into custom hooks (e.g., `useEnvelopeList`) and implemented strict type mappers.
*   **UX Enhancements:**
    *   **Moveable Reordering:** Migrated from Framer Motion Reorder to `moveable` for buttery-smooth, native-feeling drag-and-drop.
    *   **Card Stack:** Implemented Apple Wallet-style payment method selector.
    *   **Piggybanks:** Launched comprehensive savings goal system.

### Current Status:
While the application is largely stable and feature-rich, a number of bugs still need fixing before continuing with the 30,000-foot-view MD file goals. Critical offline navigation bugs have been resolved, and the focus is on stability before database optimization and polish.

### Next Steps & Roadmap:

*   **Database Migration (High Priority):**
    *   Normalize Firestore data types (convert string amounts to numbers).
    *   Embed allocations within budget documents to reduce reads.
    *   Add denormalized fields (e.g., `month`) to transactions for efficient querying.
*   **Refactoring:** Continue moving towards a strict Repository pattern to isolate Firebase logic.
*   **Features:** Enhanced Analytics, Automated Rules, and User Authentication polish.

---

## 5. Building and Running

### Prerequisites:

*   Node.js and npm (or yarn)
*   A Firebase project with Firestore enabled. You will need to add your Firebase configuration to `src/firebase.ts`.

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
*   **State Management:** Zustand stores are refactored into focused slices. They act as the single source of truth.
*   **Data Layer:**
    *   **Services/Repositories:** Handle all Firebase interaction.
    *   **Mappers:** Use `src/mappers/` to strictly convert between Firestore data (e.g., string amounts) and App models (number amounts).
    *   **Date Utils:** ALWAYS use `src/utils/dateUtils.ts` for date manipulation to ensure consistency between ISO strings, Timestamps, and Date objects.
*   **Offline Strategy:** Hybrid approach.
    *   **Read:** Relies on Firebase's `enableIndexedDbPersistence`.
    *   **Write:** Optimistic updates + Custom "Nervous System" sync queue for resilience.
*   **Styling:** Tailwind CSS is used for styling.
*   **Version Control:** Semantic versioning. **CRITICAL: STOP AND ASK.** You are FORBIDDEN from committing or pushing changes to GitHub without explicit, verbal permission from the user for *each specific commit*. Do not assume permission carries over. Always ask: "Shall I commit and push these changes?" **IMPORTANT:** When executing Git commands (add, commit, push), run them as separate, individual commands. Do NOT use `&&` to chain them, as it is not supported by default in PowerShell on Windows.
*   **Mandatory Build & Test Check:** After applying any code changes and *before* asking to commit, you MUST run `npm run build` to verify there are no TypeScript or compilation errors. Additionally, if the user asks to "test before commit", you must provide clear manual testing steps or execute automated tests if available.

run git commands sequentially, one at a time, and wait for each to complete before moving on to the next. Do NOT use `&&` to chain them, as it is not supported by default in PowerShell on Windows.
