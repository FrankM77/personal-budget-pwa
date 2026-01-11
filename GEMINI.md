# Swift-to-PWA Architect: Migration Protocol

## 1. System Role & Objective
**Role:** Senior Full-Stack Engineer specializing in Native iOS (Swift/SwiftUI) to Modern Web (React/TypeScript) migrations.

**Objective:** Port existing Xcode projects into high-performance Progressive Web Apps (PWAs). The goal is to retain business logic and the "native app feel" while strictly adhering to modern web standards.

**Target Stack:**
* **Framework:** React (Vite)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **State:** Zustand
* **Routing:** React Router DOM
* **Backend:** Firebase (Firestore) for data persistence.

---

## 2. Architecture Comparison

When restructuring files from Xcode to VS Code, use this directory mapping:

```text
iOS Project (Xcode)              PWA Project (React/Vite)
├── App.swift                 -> src/main.tsx & src/App.tsx
├── Models/                   -> src/models/ (Interfaces for types)
├── Views/                    -> src/views/ & src/components/
├── ViewModels/               -> src/stores/ (Zustand stores as ViewModels)
├── Managers/ (Services)      -> src/services/ (API calls, Firebase config)
└── Assets.xcassets           -> public/ or src/assets/
```

---

## 3. Project File Tree

```
/
├── .vscode/
├── dev-dist/
│   ├── registerSW.js
│   ├── sw.js
│   └── workbox-5a5d9309.js
├── dist/
├── MD Files/
│   ├── CloudSync.md
│   ├── Deploy.md
│   ├── Phase2_Status_Roadmap.md
│   └── Project Summary.md
├── public/
│   ├── apple-touch-icon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── vite.svg
├── src/
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── modals/
│   │   │   ├── DistributeFundsModal.tsx
│   │   │   ├── TransactionModal.tsx
│   │   │   └── TransferModal.tsx
│   │   ├── ui/
│   │       ├── SwipeableRow.tsx
│   │       └── Toast.tsx
│   │   └── EnvelopeTransactionRow.tsx
│   ├── models/
│   │   └── types.ts
│   ├── services/
│   │   ├── EnvelopeService.ts
│   │   └── TransactionService.ts
│   ├── stores/
│   │   ├── envelopeStore.ts
│   │   ├── themeStore.ts
│   │   └── toastStore.ts
│   ├── types/
│   │   └── schema.ts
│   ├── utils/
│   │   └── formatters.ts
│   ├── views/
│   │   ├── AddEnvelopeView.tsx
│   │   ├── AddTransactionView.tsx
│   │   ├── EnvelopeDetail.tsx
│   │   ├── EnvelopeListView.tsx
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

## 4. Project Overview

This project is a Progressive Web App (PWA) version of a native iOS "House Budget" application. It allows users to track expenses and manage virtual "envelopes" for budgeting. The application is built with an "offline-first" architecture, using Zustand for state management and Firebase (Firestore) for data persistence.

### Key Features:

*   **PWA:** The application is a PWA, meaning it can be installed on a user's device and can work offline.
*   **Offline-First:** The application is designed to work offline, with data being synced to Firebase when a connection is available. The Zustand store handles optimistic updates and data synchronization.
*   **State Management:** Zustand is used for state management. The main store, `useEnvelopeStore`, acts as a centralized "ViewModel" for the entire application, managing envelopes, transactions, and their interactions.
*   **Routing:** React Router DOM is used for routing. The main views are:
    *   `EnvelopeListView`: The main screen, showing all envelopes and the total balance.
    *   `EnvelopeDetail`: Shows the transaction history for a single envelope.
    *   `AddEnvelopeView`: A form to create a new envelope.
    *   `AddTransactionView`: A form to add a new transaction (income or expense).
    *   `TransactionHistoryView`: Shows all transactions across all envelopes.
    *   `SettingsView`: Contains application settings.
*   **Styling:** Tailwind CSS is used for styling, providing a utility-first CSS framework for rapidly building custom designs.
*   **Backend:** Firebase (Firestore) is used for data persistence. The data is structured under a `users/{userId}` collection, with sub-collections for `envelopes` and `transactions`.

---

## 5. Project History and Evolution

This project has undergone a significant transformation from a local storage-based application to a cloud-native PWA with robust offline capabilities. The development was divided into several phases:

*   **Phase 1: Firebase Connection Setup:** A connection to Firebase was established and tested.
*   **Phase 2: Engine Swap to Firebase:** The state management was completely refactored to use Firebase as the backend, replacing the local storage-based persistence. A service layer was introduced to handle all Firebase operations.
*   **Phase 3: Offline-First Implementation:** An optimistic UI pattern was implemented, allowing for immediate local updates and background synchronization with Firebase.
*   **Phase 4: Bug Fixes and Polish:** Various bugs related to navigation, UI, network status, and data synchronization were fixed.
*   **Phase 5: Current Status:** The application now has a stable offline-first architecture, with all major features implemented and tested.

### Next Steps:

*   Performance testing with large datasets.
*   Implementation of error boundaries.
*   User authentication with Firebase Auth.
*   Enhanced data export/import functionality.
*   Storage of distribution templates and app settings in Firebase.

---

## 6. Building and Running

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

## 7. Development Conventions

*   **State Management:** State is managed using Zustand. The `useEnvelopeStore` is the single source of truth for the application's data. Actions that modify the state are designed to work offline and sync with Firebase when a connection is available.
*   **Firebase Services:** All interactions with Firebase are abstracted into service files in the `src/services` directory. This keeps the state management logic clean and separated from the data fetching logic.
*   **Optimistic UI:** The application uses an optimistic UI pattern, where the UI is updated immediately on user actions, and data is synced with the backend in the background.
*   **Temporary IDs:** When creating new items offline, temporary client-side IDs are used, which are later replaced with the actual Firebase document IDs upon successful synchronization.
*   **Styling:** Tailwind CSS is used for styling.
*   **PWA:** The application is a PWA, with a service worker and manifest generated by `vite-plugin-pwa`.
*   **Data Models:** TypeScript interfaces for the data models are defined in `src/models/types.ts`.
*   **Version Control:** Only commit changes to GitHub when explicitly initiated or requested by the user. Do not automate commits or pushes without direct user instruction.