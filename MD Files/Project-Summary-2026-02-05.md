# House Budget PWA: Project Summary - 2026-02-05

## Changelog (Highlights)
- **2026-02-04**: **Major Feature: Categories**: Implemented full category support for organizing envelopes.
  - **Category Management**: Added a new settings view to create, rename, delete, and reorder categories.
  - **Envelope Grouping**: The main envelope list is now grouped by user-defined categories instead of a single list.
  - **Onboarding Integration**: New users can select starter categories during the onboarding process.
  - **Unified Creation**: Simplified the "Add Envelope" flow with a category selector and a toggle for "Spending" vs "Piggybank".
  - **Restored Reordering**: Re-engineered the interactive reordering logic to work seamlessly within the new category sections using long-press drag-and-drop.
- **2026-02-04**: **UI/UX Optimization: Compressed Layout**: Re-engineered the main list view to maximize information density.
  - **Reduced Vertical Footprint**: Trimmed padding and margins across all list items and section containers.
  - **Header Controls**: Integrated "Add" buttons into section headers to save vertical space.
  - **Slimmer Progress Bars**: Refined the visual weight of budget indicators for a cleaner, more modern look.
  - **Settings Refinement**: Unified the visual style of action buttons in Settings by removing redundant borders and padding from the CSV export control.
- **2026-02-04**: **Security & Dev Workflow**: Resolved critical infrastructure issues.
  - **Environment Variables**: Migrated `src/firebase.ts` from hardcoded values to `import.meta.env` for better security.
  - **Complete Firebase Config**: All Firebase configuration values now use environment variables for single-source-of-truth management.
  - **Dev Environment Login Fix**: Resolved a 403 Forbidden error by correcting API key mismatches and whitelisting local domains.
  - **Month-to-Month Continuity**: Fixed a bug where data failed to copy between months if the previous month hadn't been loaded into the store cache yet.
- **2026-02-04**: **Enhanced Accessibility: 5 Font Size Options**: Expanded the font size selection to provide more granular control.
  - **Expanded Range**: Added 'Extra-Small' and 'Extra-Large' options to the existing 'Small', 'Medium', and 'Large' choices.
- **2026-02-04**: **UI/UX Decluttering: Hidden Internal Transactions**: Improved the transaction history and envelope detail views by hiding auto-generated allocation transactions.
  - **Transaction List Filtering**: "Budgeted" and "Piggybank Contribution" transactions are now hidden from the Envelope Detail and All Transactions views.
  - **Cleaner CSV Exports**: These internal transactions are also excluded from CSV exports to ensure the data is focused on actual spending and income.

## 1. Executive Summary

- Transformation from iOS app to high-performance PWA with full feature parity.
- Complete Firebase cloud synchronization with real-time cross-device updates.
- Robust offline-first architecture with optimistic UI updates and automatic recovery.
- **🏆 Recent Achievements**:
  - **UI/UX Polish**: Successfully implemented Category grouping and compressed the UI for better information density.
  - **Interactive Reordering**: Restored the preferred long-press drag-and-drop logic within the new category structure.
  - **Infrastructure Stability**: Secured the Firebase configuration and resolved environment-specific login blockers.

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
- Categories Implementation (Done)
- UI UX Compression (Done)
- Reorder Restoration (Done)
- Firebase Configuration Security (Done)

### Future Enhancements
- **Database Migration (High Priority)**: Normalize Firestore data types and embed allocations to reduce reads.
- Advanced reporting and analytics.
- Data visualization.

## 5. API Key Rotation Guide

### When to Rotate API Keys
- **Security**: If key is accidentally exposed or compromised
- **Expiration**: When Firebase/Google Cloud shows key as expired
- **Environment Changes**: When moving between different development environments
- **Routine Maintenance**: Periodic security rotation (recommended annually)

### Step-by-Step Rotation Process

#### 1. Generate New API Key
1. Go to [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your Firebase project's API key
3. Click **Duplicate** to create a new key (preserves restrictions)
4. Copy the new API key immediately

#### 2. Update Firebase Console
1. Go to [Firebase Console → Project Settings → General](https://console.firebase.google.com/project/_/settings/general)
2. Scroll to **Your apps** section
3. Click the web app configuration
4. Replace the old `apiKey` with the new one
5. Save changes

#### 3. Update Local Environment
1. Update `.env` file with ALL Firebase config values:
   ```
   VITE_FIREBASE_API_KEY=your-new-api-key-here
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
2. `src/firebase.ts` should use environment variables (no code changes needed):
   ```ts
   const firebaseConfig = {
     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
     appId: import.meta.env.VITE_FIREBASE_APP_ID,
     measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
   };
   ```

#### 4. Update Application Restrictions (Critical!)
If the API key has restrictions:
1. In Google Cloud Console → API Key settings
2. Check **Application restrictions** section
3. Ensure all required domains/refs are whitelisted:
   - `localhost:*` (for local development)
   - `127.0.0.1:*` (for local development)
   - Your production domains
   - Any staging/testing domains

#### 5. Restart Development Server
```bash
npm run dev
# OR
yarn dev
```
Environment changes require server restart.

#### 6. Test Authentication
1. Clear browser cache/storage to force fresh auth
2. Attempt login/logout flow
3. Verify Firebase operations work (Firestore reads/writes)
4. Test on multiple devices/browsers if applicable

#### 7. Clean Up (After Verification)
1. **Delete the old API key** in Google Cloud Console
2. Verify no other services reference the old key
3. Update any documentation that contains the old key

### Common Issues & Solutions

#### Error: `auth/api-key-expired.-please-renew-the-api-key.`
- **Cause**: Key is actually expired or has restrictions blocking current IP/domain
- **Fix**: Check key status in Google Cloud Console, verify application restrictions

#### Error: `auth/invalid-api-key`
- **Cause**: Key format is wrong or key doesn't exist
- **Fix**: Verify key was copied correctly, check for extra spaces/characters

#### Works on Desktop but Not Laptop
- **Cause**: API key restrictions (HTTP referrers or IP addresses)
- **Fix**: Add laptop's IP/localhost to allowed list, or remove restrictions temporarily

#### Browser Cache Issues
- **Cause**: Old Firebase config cached in browser
- **Fix**: Clear browser storage, hard refresh (Ctrl+Shift+R), or use incognito mode

### Security Best Practices
- **Never commit API keys to git** (ensure they're in `.gitignore`)
- **Use environment variables for ALL Firebase config values** (not just API key)
- **Create `.env.example`** with variable names but placeholder values (commit this)
- **Restrict API keys** to specific domains when possible
- **Monitor API usage** in Google Cloud Console for unusual activity
- **Rotate keys regularly** as part of security maintenance
- **Single source of truth**: Only `.env` needs updating during rotations

### Quick Reference Commands
```bash
# Check current API key in use (grep search)
grep -r "AIzaSy" src/

# Restart dev server after env changes
npm run dev

# Clear browser storage (in browser console)
localStorage.clear();
sessionStorage.clear();
```