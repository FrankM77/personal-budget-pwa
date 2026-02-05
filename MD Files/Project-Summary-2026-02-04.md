# House Budget PWA: Project Summary - 2026-02-04

## Changelog (Highlights)
- **2026-02-04**: **UI/UX Decluttering: Hidden Internal Transactions**: Improved the transaction history and envelope detail views by hiding auto-generated allocation transactions.
  - **Transaction List Filtering**: "Budgeted" and "Piggybank Contribution" transactions are now hidden from the Envelope Detail and All Transactions views.
  - **Cleaner CSV Exports**: These internal transactions are also excluded from CSV exports to ensure the data is focused on actual spending and income.
  - **Zero Impact on Balances**: Confirmed that hiding these from the UI does not affect any balance or budget calculations.
- **2026-02-04**: **Dev Environment Login Fix**: Resolved a 403 Forbidden error blocking logins on the local development server.
  - **Environment Variables**: Migrated `src/firebase.ts` from hardcoded values to `import.meta.env` for better security and flexibility.
  - **API Key Mismatch**: Identified and corrected a mismatch between the local `.env` key and the active Google Cloud Console key.
- **2026-02-02**: **UX Refinement: Envelope List Add Buttons**: Improved the usability of adding new items to the budget.
  - **Bottom-Aligned Add Buttons**: Moved the '+' add buttons for Income Sources, Spending Envelopes, and Piggybanks from the section headers to the bottom-right of each respective section.
- **2026-02-01**: **UI & Data Integrity Overhaul**: Major refactor of Envelope List/Detail views and resolution of critical data corruption bugs.
  - **Budget Editing UX**: Moved "Budgeted" amount editing from the list view to the Envelope Detail view for a cleaner, native-app feel.
  - **Simplified List Items**: Redesigned `EnvelopeListItem` and `PiggybankListItem` to be vertically shorter with a thinner progress bar.
  - **Real-Time "Left to Budget"**: Added a dynamic banner in Envelope Detail that updates instantly as the user types.

## 1. Executive Summary

- Transformation from iOS app to high-performance PWA with full feature parity.
- Complete Firebase cloud synchronization (envelopes, transactions, allocations, income sources, app settings) with real-time cross-device updates.
- Robust offline-first architecture with optimistic UI updates and automatic recovery.
- **🏆 Recent Achievements**:
  - **UI/UX Polish**: Successfully "decluttered" the transaction history by hiding internal allocation records from the UI and exports while maintaining balance integrity.
  - **Improved Dev Workflow**: Secured the Firebase configuration using environment variables and resolved local domain blocking.
  - **Data Integrity & Safety**: Eliminated "Unknown Envelope" transactions and hardened month-copy logic.
  - **UX Modernization**: Streamlined core budgeting flow and improved ergonomics of the add-item buttons.

## 2. Architecture & Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **State Management**: Zustand with Firebase integration (refactored into focused slices)
- **Backend**: Firebase Firestore with offline persistence
- **Offline Strategy**: Optimistic UI updates with eventual consistency

## 3. Version Management & Release Process

### Semantic Versioning Workflow

| Change Type | Command | Version Bump | Description |
|-------------|---------|--------------|-------------|
| Bug fixes | `npm version patch` | 1.0.0 → 1.0.1 | Backwards compatible bug fixes |
| New features | `npm version minor` | 1.0.0 → 1.1.0 | Backwards compatible new features |
| Breaking changes | `npm version major` | 1.0.0 → 2.0.0 | Breaking changes requiring migration |

## 4. Next Steps & Roadmap

### Current Priorities ✅
- UI UX Overhaul (Phase 4) (Done)
- UI Decluttering (Hiding internal transactions) (Done)
- Firebase Configuration Security (Done)

### Future Enhancements
- **Database Migration (High Priority)**: Normalize Firestore data types and embed allocations to reduce reads.
- Advanced reporting and analytics.
- Data visualization.
