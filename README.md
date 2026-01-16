# House Budget PWA

House Budget PWA is a zero-based budgeting app inspired by the envelope method and EveryDollar-style allocation. It’s an offline-first PWA with optimistic UI updates, Firebase persistence, and monthly budgeting workflows (income sources, allocations, and piggybanks).

## Key Features

- **Zero-based budgeting** with an “Available to Budget” pool.
- **Monthly budgets** with income sources and envelope allocations.
- **Piggybanks** (savings goals) with auto-contributions and progress tracking.
- **Offline-first** experience with automatic sync when back online.
- **PWA installable** with service worker caching.
- **Firebase sync** for cross-device data updates.
- **Authentication** with email verification and account deletion.

## Tech Stack

- **React + TypeScript + Vite**
- **Tailwind CSS**
- **Zustand** state management
- **Firebase (Firestore + Auth)**
- **Vite PWA**

## Getting Started

### Prerequisites
- Node.js 18+
- Firebase project with Firestore and Auth enabled

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local env file:
   ```bash
   copy .env.example .env
   ```
3. Update `.env` with your Firebase project configuration.
4. Run the dev server:
   ```bash
   npm run dev
   ```

## Scripts

```bash
npm run dev      # start dev server
npm run build    # type-check + production build
npm run preview  # preview production build
npm run lint     # run eslint
```

## Offline + PWA Behavior

- The app caches the shell and uses Firebase offline persistence.
- You can create/edit data offline; it syncs automatically when online.
- The PWA install prompt depends on browser and platform rules.

## Deployment (GitHub Pages)

```bash
npm run build
npm run deploy
```

Ensure:
- `package.json` has the correct `homepage`.
- `vite.config.ts` uses the repo name in `base`.

## Project Docs

- `MD Files/Personal-Budget-PWA-Vision.md`
- `MD Files/Project-Summary-2026-01-15.md`
- `MD Files/OFFLINE_TROUBLESHOOTING.md`

## License

Private project. All rights reserved.
