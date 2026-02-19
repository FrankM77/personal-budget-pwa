# House Budget PWA: Project Summary - 2026-02-18

## Changelog (Highlights)
- **2026-02-18**: **Analytics Fixes & UI Improvements**: Fixed critical savings calculation and donut chart interaction issues.
  - **Savings Calculation Fix**: Corrected savings rate calculation to prevent cross-category contamination from piggybank envelope categories.
  - **Category Detection**: Savings category spending now only includes transactions in categories explicitly named "Savings" (case-insensitive).
  - **Piggybank Contributions**: Properly separated from savings category spending to eliminate double-counting.
  - **Donut Chart Tooltip**: Replaced floating tooltip with below-chart info bar to prevent slice overlap and off-screen rendering.
  - **Enhanced Logging**: Added detailed per-envelope breakdown for savings calculations to aid debugging.
  - **Visual Feedback**: Non-active donut slices dim to 50% opacity with hover/click selection.
  - **Version Bump**: Updated to v1.11.2 with all fixes deployed to production.
- **2026-02-15**: **CSV Export with Time Frame Selection**: Added modal interface for exporting transactions with flexible date ranges.
  - **Time Frame Presets**: 1 month, 3 months, 6 months, 12 months, or by year (2024-2026).
  - **Dynamic Filenames**: Export files include date range (e.g., `budgetTransactions_Dec2025-Feb2026.csv`).
  - **Preview Interface**: Shows selected months before exporting.
  - **Split Transaction Support**: Maintains grouping of split transactions in exports.
  - **Updated Naming**: Changed from `HouseBudget_*` to `budget*` for cleaner filenames.
- **2026-02-12**: **Move to Category Feature**: Added ability to move envelopes and piggybanks between categories via folder icon.
  - **Category Movement**: Folder icon on envelope/piggybank items opens bottom sheet modal for category selection.
  - **Enhanced Category Management**: Delete category creates fresh "Uncategorized" for orphaned envelopes.
  - **Analytics Improvements**: All categories now appear in analytics charts, including those with $0 spending.
  - **Mobile Fixes**: Fixed scrolling and dock interference issues in modal on mobile devices.
  - **Bug Fixes**: Fixed modal update failures and ensured proper envelope category changes.
- **2026-02-12**: **Database Migration & Performance Optimization**: Embedded allocations to reduce Firestore reads by 50%+.
  - **Performance Gains**: Allocations now embedded in monthly budget documents instead of separate collection.
  - **Code Cleanup**: Removed debug code, unused TODOs, and backup files. Fixed all linting errors.
- **2026-02-11**: **Major Security Enhancement: Firebase App Check Enforcement**: Complete security coverage across all Firebase services.
  - **App Check Implementation**: Firebase App Check with reCAPTCHA Enterprise provider for comprehensive protection.
  - **Three-Layer Security**: API key restrictions + Rate limiting + App Check enforcement.
  - **Full Enforcement**: Cloud Firestore, Authentication, and Cloud Functions all protected.
  - **Enhanced Logging System**: Real-time log collection with filtering, export, and mobile/desktop access.
  - **Mobile Bug Fix**: Touch event handlers for long-press LogViewer access on mobile devices.
- **2026-02-07**: **Major Feature: Siri Integration**: Implemented voice-powered transaction entry with AI parsing.
  - **AI-Powered Parsing**: Firebase Cloud Function with Gemini AI parses natural language input into structured transaction data.
  - **Regex Fallback**: Local parser ensures graceful degradation when offline or AI fails.
  - **Payment Method Support**: Recognizes "with" or "using" to auto-select payment methods (e.g., "with Chase Amazon").
  - **Fuzzy Envelope Matching**: AI matches common variations (e.g., "Grocery" → "Groceries").
  - **Pre-filled Forms**: Amount, merchant, envelope, payment method, and transaction type are auto-populated.
  - **iOS Shortcuts**: Users can create shortcuts to add transactions via Siri voice commands.
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

## 4. Security Architecture

### Firebase App Check Implementation (Complete)

**Three-Layer Security Stack:**
1. **API Key Restrictions** - Prevent unauthorized API usage
2. **Rate Limiting** - 30 calls/minute per user for Cloud Functions  
3. **App Check** - Verify requests come from legitimate app instances

#### Services Protected 
- **Cloud Firestore** - Budget data protection
- **Authentication** - User account protection
- **Cloud Functions** - Siri integration protection

#### Configuration Details
- **Provider**: reCAPTCHA Enterprise
- **Site Key**: `6Lf31GMsAAAAAHqILQS1jVjTe51WHK6lfIyxmsFT`
- **Enforcement**: All Firebase services enforced
- **Rate Limiting**: 30 calls/minute per user (parseTransaction function)

#### Security Benefits
- API key restricted to authorized domains
- Cloud Function cost protection
- Billing alerts ($5/month cap)
- Protection against automated abuse
- Enterprise-grade security posture

### Enhanced Logging System

**Real-time Log Collection:**
- **LogViewer Component**: Professional UI with filtering, search, export
- **Access Methods**: Long-press (mobile) or double-click (desktop) on version info
- **Log Levels**: DEBUG, INFO, WARN, ERROR with color coding
- **Smart Source Extraction**: Auto-categorizes logs from component names
- **Export Capability**: Download logs as JSON with full metadata
- **Mobile Support**: Touch event handlers for proper mobile interaction

**Coverage:**
- All 39 components automatically feed into enhanced logger
- Authentication events, budget operations, Siri integration
- Real-time sync, error tracking, performance monitoring
- Session tracking with user association

---

## 5. Siri Integration Architecture

### Overview
Voice-powered transaction entry using AI parsing with iOS Shortcuts integration.

### The Architecture: "Cloud Function Bridge"

**Workflow:**
1. **User**: Says "Hey Siri, Add Transaction..."
2. **Siri**: Asks "What's the text?"
3. **User**: "Grocery transaction at Walmart for $33.28 with Chase Amazon"
4. **Shortcuts App**: 
   - Calls Cloud Function to store query in Firestore
   - Waits 3 seconds
   - Opens PWA via custom URL scheme
5. **PWA**: Retrieves query, parses with AI, pre-fills form
6. **User**: Reviews and saves transaction

### Implementation Details

#### Frontend Components
- **`smartTransactionParser.ts`**: Regex-based fallback parser
- **`SiriService.ts`**: Service layer with AI/regex fallback logic
- **`useSiriQuery.ts`**: React hook for URL parameter detection
- **`SiriQueryHandler.tsx`**: Firestore listener for pending queries
- **`SiriPasteBanner.tsx`**: Visual feedback component
- **`AddTransactionView.tsx`**: Pre-fill form integration

#### Backend Cloud Functions
- **`parseTransaction`**: AI-powered parsing with Gemini 2.0 Flash
- **`siriStoreQuery`**: HTTP endpoint for Siri Shortcuts

#### AI Capabilities
- **Natural Language Processing**: Extracts amount, merchant, envelope, payment method
- **Fuzzy Matching**: "Grocery" → "Groceries", "Restaurant" → "Restaurants"
- **Payment Detection**: "with Chase Amazon", "using Venmo"
- **Income Detection**: "paycheck", "salary", "refund" → Income type
- **Confidence Scoring**: AI (0.9) vs Regex fallback (0.7)

### User Experience

#### Setup (One-time)
1. Generate Siri token in PWA Settings
2. Create iOS Shortcut with token
3. Name shortcut "Add Transaction"

#### Daily Use
1. Say "Hey Siri, Add Transaction"
2. Speak naturally: "$45 at Target for groceries"
3. PWA opens with purple Siri banner
4. Review pre-filled form
5. Tap "Save Transaction"

#### Error Handling
- AI parsing fails → Falls back to regex parser
- No envelope match → Shows "Uncategorized"
- Payment method not found → Leaves field empty
- Banner shows confidence score and allows corrections

### Security & Performance

#### Security Measures
- **Authentication Required**: Cloud Functions require user login
- **Rate Limiting**: 30 calls/minute per user
- **Token-based Access**: Unique revocable tokens per user
- **App Check Protection**: All Cloud Functions protected

#### Cost Estimate
- **Gemini API**: ~$0.00025 per 1K tokens
- **Cloud Functions**: $0.40 per million invocations
- **Estimated**: ~$0.05 for 100 transactions/month

---

## 6. Next Steps & Roadmap

### Current Priorities 
- Categories Implementation (Done)
- UI UX Compression (Done)
- Reorder Restoration (Done)
- Firebase Configuration Security (Done)
- Firebase App Check Enforcement (Done)
- Siri Integration (Done)
- Enhanced Logging System (Done)
- Database Migration (Done)
- Code Cleanup (Done)

### Future Enhancements
- Advanced reporting and analytics.
- Data visualization.

## 7. Firebase App Check Development Guide

### Debug Token Workflow for Local Development

**Issue**: Firebase App Check generates new debug tokens each time the dev server restarts, requiring manual registration.

#### Current Setup
- App Check is configured in `src/firebase.ts` with debug mode for development
- Debug tokens are automatically generated when `import.meta.env.DEV` is true
- Production uses real reCAPTCHA Enterprise provider

#### Development Options

**Option 1: Register Debug Tokens (Official Firebase Method)**
1. Start dev server → Check browser console for debug token
2. Go to Firebase Console → App Check → Manage debug tokens
3. Register the new token
4. Repeat for each dev server restart

**Option 2: Unenforce App Check (Easiest for Development)**
1. Firebase Console → App Check → Find Web app → 3-dot menu → "Unenforce"
2. Development works without token registration
3. Re-enforce before deploying to production

**Option 3: Keep Server Running**
- Avoid unnecessary dev server restarts
- Use Vite's hot reload for most code changes
- Only restart when environment variables change

#### Debug Token Examples
- Token format: `"ec873e11-12e2-488c-842a-b4fa1040e1a7"`
- New token generated per browser session and server restart
- Multiple tokens can be registered simultaneously

#### Production Deployment
- Always re-enforce App Check before deploying
- Production automatically uses real reCAPTCHA (no debug tokens)
- Security remains intact for live users

## 8. Budget Breakdown: Piggybank Spending Logic

### Problem Solved
**Issue**: Piggybank withdrawals were incorrectly counting as "over budget" spending in Budget Breakdown view.

**Example**: 
- Car Fund piggybank: $1,000 saved (in Transportation category)
- Monthly Transportation budget: $800
- Spend $1,000 from Car Fund → Shows as $200 over budget (incorrect)
- Reality: Using saved money as intended, not over budget

### Solution Implemented
**Budget vs Actual Comparison** excludes piggybank spending:

#### Budget vs Actual Chart
- **Budgeted**: Sum of envelope allocations in category
- **Spent**: Only regular envelope spending (excludes piggybank withdrawals)
- **Purpose**: Shows true monthly budget performance

#### Summary Cards
- **Income**: Total monthly income sources
- **Spent**: ALL spending including piggybank withdrawals
- **Remaining**: Income minus all outflows
- **Purpose**: Shows complete financial picture

#### Logic Details
```typescript
// Budget vs Actual (excludes piggybank)
const spent = monthTransactions
  .filter(t => {
    const envelope = envelopes.find(env => env.id === t.envelopeId);
    return envelope?.categoryId === category.id && !envelope.isPiggybank;
  })
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);

// Overall spending (includes piggybank)
const totalAllSpending = transactions
  .filter(t => t.month === currentMonth && t.type === 'Expense')
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);
```

### Benefits
- ✅ **Accurate budget performance**: Shows if you stayed within monthly budget
- ✅ **Complete financial picture**: Summary cards show all money movement
- ✅ **Encourages savings**: Rewards using saved money as intended
- ✅ **Clear separation**: Budget planning vs overall cash flow

### User Experience
- **Budget vs Actual chart**: "Did I stick to my monthly budget?"
- **Summary cards**: "What's my overall financial position?"
- **No false "over budget" alerts** when using piggybank savings

### Important Note: Spent Can Exceed Income
**Scenario**: 
- Income: $5,000 (current month)
- Spent: $6,000 (includes $2,000 from piggybank savings)
- Remaining: -$1,000 (shows as negative/red)

**This is correct behavior** because:

#### Summary Cards: Complete Financial Picture
- **Shows actual cash flow**: What really came in vs went out this month
- **Includes all money movement**: Regular spending + piggybank withdrawals
- **Accurate remaining**: True financial position (drawing down savings is expected)

#### Budget vs Actual: Budget Performance
- **Separate concern**: Budget discipline vs overall cash flow
- **Excludes piggybank**: Shows if you stayed within monthly budget limits

#### User Interpretation
**Summary cards tell you**: "I spent more than I earned this month, but $2,000 was from savings I accumulated for this purpose."

**Budget vs Actual tells you**: "I stayed within my $5,000 monthly budget."

#### Why This Design Works
- ✅ **Financial transparency**: Shows when you're drawing down savings (expected for large purchases)
- ✅ **Budget accuracy**: Rewards staying within monthly limits
- ✅ **Planning insight**: Helps you see impact of big purchases on cash flow
- ✅ **Realistic picture**: Negative remaining indicates planned savings usage, not overspending

## 9. API Key Rotation Guide

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