# Project Summary: Swift-to-PWA Migration (House Budget App)

## 1. Executive Summary
This project involved porting a native iOS application (built with Swift, SwiftUI, and Core Data) into a high-performance Progressive Web App (PWA). The goal was to maintain the business logic, data persistence, and "native feel" while moving to a web-based stack (React, TypeScript, Vite, Tailwind CSS).

**Final Status:** Production Ready 🟢
**Deploy Strategy:** GitHub Pages with PWA Offline Capabilities.

---

## 2. Technology Stack Transition

| Feature | Native iOS (Original) | PWA (New) |
| :--- | :--- | :--- |
| **UI Framework** | SwiftUI | React + Tailwind CSS |
| **Language** | Swift | TypeScript |
| **State Management** | `@State`, `@ObservedObject` | React Hooks (`useState`) |
| **Global Store** | `EnvironmentObject` | Zustand |
| **Persistence** | Core Data / CloudKit | Zustand Middleware (`localStorage`) |
| **Navigation** | `NavigationStack` | `react-router-dom` (HashRouter) |
| **Deployment** | App Store / TestFlight | GitHub Pages (Service Worker) |

---

## 3. Key Architectural Decisions

### A. The PWA Shell (Infrastructure)
* **Offline First:** Implemented `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Verified functionality in Airplane Mode.
* **Native Physics:** Added global CSS to `index.css` to prevent "rubber-banding" (overscroll), disable text selection on UI elements, and remove tap highlights to mimic UIKit behavior.
* **Safe Areas (Dynamic Island):** Implemented dynamic padding logic (`pt-[calc(env(safe-area-inset-top)+12px)]`) across all sticky headers. This ensures buttons remain clickable and visible on iPhone 15/16 Pro Max devices.

### B. State Management (The Brain)
* **Persist Middleware:** Replaced Core Data with `zustand/persist`. Data is automatically saved to the browser's Local Storage on every change.
* **Direct Store Access:** Views connect directly to the store (e.g., `const { envelopes } = useEnvelopeStore()`) rather than passing data down via props, preventing prop-drilling.

### C. Navigation & Routing
* **State Restoration:** Unlike iOS (passing objects), the PWA passes IDs in the URL (e.g., `/envelope/:id`). The view looks up the object from the store upon loading.
* **The "Dispatcher" Pattern:** The global Floating Action Button (FAB) on the dashboard was converted from a generic form into an **Envelope Selector**. It routes the user to the specific `EnvelopeDetail` view, streamlining the UI.

---

## 4. Component Implementation

### Core Views
1.  **`EnvelopeListView` (Dashboard):** Mirrors the main iOS screen. Handles sorting by `orderIndex` and calculating global totals.
2.  **`EnvelopeDetail`:** The "Detail View." Handles navigation parameters and serves as the hub for adding/spending money.
3.  **`TransactionHistoryView`:** A global list of all transactions. Features a native-style **Collapsible Filter Panel** (ported from SwiftUI) allowing deep searching, date filtering, and type filtering.

### Modals & Forms
1.  **`TransactionModal`:** A reusable component for "Add," "Spend," and "Edit" actions. It preserves the user's context (staying inside the Envelope view) rather than navigating away.
2.  **`TransferModal`:** Specialized logic to move funds between envelopes (preventing self-transfers).
3.  **`DistributeFundsModal`:** A "Payday" tool that allows allocating a lump sum across multiple envelopes with percentage calculations.
4.  **`EnvelopeTransactionRow`:** A highly polished, reusable list item component. It features conditional rendering for badges (Expense/Income/Transfer), displays Envelope Names in global views, and handles interaction logic.

### Settings & Data Safety
* **`SettingsView`:** Includes a custom Data Management engine.
    * **JSON Import/Export:** Allows full backup/restore to iOS Files.
    * **CSV Export:** Allows exporting transaction history to Excel/Numbers.
* **Theme Toggle:** Supports Light, Dark, and System modes.

---

## 5. Solved Challenges & Regression Fixes

* **The "Zombie Cache":** Early development faced issues where the Service Worker served old code. Resolved by implementing a "Hard Refresh" protocol and Unregistering workers in DevTools.
* **iOS Inputs:** Fixed the numeric keypad to ensure the decimal point appears on iOS (`inputMode="decimal"`) and fixed Date Pickers appearing white-on-white in Dark Mode.
* **Edit Functionality:** Restored the ability to edit transactions by clicking rows in the Global History, which required dynamic parent-envelope lookups.
* **Visual Consistency:** Standardized the "Inset Grouped" look for lists and ensured full Dark Mode compatibility across all components.
* **Dynamic Island Occlusion:** Fixed headers on iPhone Pro Max devices where the status bar blocked interaction.

---

## 6. Next Steps / Maintenance
* **Deploy:** The app is live. To update, run `npm run build`, commit, push, and perform the "PWA Two-Step" (Force quit and reopen) on the device.
* **Data:** Encourage regular backups via the Settings menu since `localStorage` is not permanent cloud storage.

## 7. Future Roadmap & To-Dos
* **Distribute Funds Templates:** Port the "Save/Load Template" functionality from the iOS app. This includes logic to save a distribution pattern when the remaining balance is $0 and a UI to recall saved templates for quick allocations.
* **Cloud Sync:** Migrate the persistence layer from `localStorage` to **Firebase** (or Supabase). This is required to enable real-time multi-device synchronization (e.g., using the budget on both iPad and iPhone simultaneously).
* **Cloud Backup & Restore:** Implement remote snapshotting/auth. This allows users to log in and restore their data if a device is lost, moving beyond the current manual file-based export system.
