# Changelog

All notable changes to Personal Budget PWA will be documented in this file.

## [1.9.3] - 2026-02-10

### ✨ **IMPROVEMENTS**
- **Transaction Editing**: Envelope selector now displays envelopes in the same order as the main budget view (sorted by orderIndex, then by name, and filtered to show only active envelopes).

## [1.9.2] - 2026-02-10

### 🐛 **BUG FIXES**
- **Transaction Modal**: Fixed scrolling issue where the background page would scroll instead of the modal content when the envelope selector expanded beyond the viewport height.

## [1.9.1] - 2026-02-10

### ✨ **IMPROVEMENTS**
- **Transaction Editing**: Replaced simple envelope dropdown with SplitTransactionHelper component for consistency with AddTransactionView. The envelope selector now appears in the same position (after date) and uses the same UI component across the app.

## [1.9.0] - 2026-02-10

### ✨ **NEW FEATURES**
- **Transaction Editing**: Added ability to change the envelope when editing a transaction. Users can now easily move transactions between envelopes if they accidentally categorize them incorrectly.

## [1.8.9] - 2026-02-10

### ✨ **NEW FEATURES**
- **Siri Integration**: Added comprehensive user documentation for Siri setup with step-by-step instructions, troubleshooting, and advanced tips.

## [1.8.8] - 2026-02-10

### ✨ **NEW FEATURES**
- **Siri Integration**: Added a "Regenerate Token" button in Settings to allow users to reset their Siri token if needed.

## [1.8.7] - 2026-02-10

### 🐛 **BUG FIXES**
- **Siri Shortcuts**: Fixed foreground interaction where Siri Shortcuts failed to pre-fill data when the app was already open and in view.
  - Added cache-busting query param to navigation (`/add-transaction?siri=${timestamp}`) to force route re-evaluation
  - Added custom DOM event (`siri-query-ready`) to notify AddTransactionView to re-read sessionStorage in real-time
  - Extracted sessionStorage reading logic into reusable helper function

## [1.8.6] - 2026-02-10

### 🐛 **BUG FIXES**
- **Siri Shortcuts**: Fixed issue where Siri Shortcuts deep links failed if the app was already open and in the foreground.
  - Updated `useSiriQuery` to react to URL parameter changes while mounted.
  - Updated `SiriQueryHandler` to use real-time Firestore listeners instead of polling, ensuring immediate detection of new queries even when the app is focused.

## [1.8.5] - 2026-02-10

### 🐛 **BUG FIXES**
- **Analytics Charts: Bar Highlight**: Removed the grey highlight behind bars by disabling the Recharts tooltip cursor in Spending Breakdown and Monthly Income
- **Analytics Charts: Focus Outline**: Removed the white focus outline rectangle that appeared when tapping chart areas

### 🧹 **MAINTENANCE**
- Removed accumulated Recharts CSS override rules from `src/index.css` and replaced with a minimal focus-outline fix

## [1.8.4] - 2026-02-10

### 🐛 **BUG FIXES**
- **Transaction Undo Functionality**: Fixed issue where deleted transactions didn't immediately reappear after tapping "Undo" in toast messages
- **UI State Synchronization**: Restored transactions now immediately update the UI without requiring navigation away and back
- **State Management**: Improved `restoreTransaction` to properly add deleted transactions back to the state array

### 🔧 **TECHNICAL IMPROVEMENTS**
- **Budget Store Enhancement**: Rewrote `restoreTransaction` to handle both existing and deleted transaction scenarios
- **Immediate Feedback**: Users now see instant visual confirmation that undo actions worked correctly
- **Consistent Experience**: Fix applies to all transaction views (Transaction History, Envelope Detail, etc.)

---

## [1.8.3] - 2026-02-10

### 🐛 **BUG FIXES**
- **Donut Chart Tooltip Z-Index**: Fixed tooltips appearing behind center label by adding proper z-index hierarchy
- **Blue Selection Box Removal**: Eliminated blue rectangular selection boxes when tapping donut chart segments
- **Mobile Status Bar Overlap**: Fixed Analytics header being hidden behind phone's system status bar
- **Tab Selector Layout**: Changed from horizontal scrolling to two-row wrap layout for better mobile fit

### 📱 **MOBILE IMPROVEMENTS**
- **Safe Area Support**: Added CSS utilities for proper mobile PWA safe area handling
- **Touch Interaction**: Improved touch feedback and removed unwanted visual artifacts
- **Responsive Layout**: Tab selector now wraps to two rows on smaller screens
- **Chart Interaction**: Clean tooltips without selection boxes on mobile devices

### 🎨 **UI/UX ENHANCEMENTS**
- **Clean Chart Experience**: Removed all visual selection artifacts from donut charts
- **Proper Layering**: Ensured tooltips and overlays display in correct visual hierarchy
- **Mobile-First**: Optimized Analytics view for mobile phone usage
- **Consistent Styling**: Maintained design consistency across all interaction states

---

## [1.8.2] - 2026-02-10

### 🆕 **NEW FEATURES**
- **Analytics Dashboard** - Complete analytics section with 4 interactive tabs:
  - **Spending Totals**: Donut chart showing total spent by category with percentage breakdown
  - **Spending Breakdown**: Stacked bar chart by month and category with average spending line
  - **Monthly Income**: Stacked bar chart showing income sources over time with average reference
  - **Savings Analysis**: 100% stacked bar chart showing savings vs spending percentage over time
- **Time Frame Selection**: Flexible time periods (1, 3, 6, 9, 12 months) or specific years (2024-2026)
- **Interactive Charts**: Tooltips, legends, and responsive design using Recharts library
- **Color-Coded Categories**: Consistent color mapping across all analytics views
- **Data Pre-fetching**: Automatically fetches monthly data for selected time frames

### 📊 **Analytics Features**
- **Donut Charts**: Center labels showing totals with category legends
- **Stacked Bar Charts**: Monthly comparisons with reference lines for averages
- **100% Stacked Charts**: Savings rate visualization with "pay yourself first" design
- **Empty States**: Helpful messages when no data is available for selected time period
- **Mobile Optimized**: Responsive design that works perfectly on phones and tablets

### 🛠 **Technical Implementation**
- **New Hook**: `useAnalyticsData` - Centralized data processing for all analytics
- **New View**: `AnalyticsView` - Main analytics component with segmented controls
- **Chart Library**: Integrated Recharts v3.6.0 for data visualization
- **Routing**: Added `/analytics` route accessible via bottom navigation
- **Performance**: Efficient data aggregation and memoization

### 📱 **User Experience**
- **Segmented Control**: Easy switching between analytics tabs
- **Time Frame Picker**: Horizontal scrollable selector for time periods
- **Consistent Styling**: Matches existing app design patterns
- **Dark Mode Support**: Full compatibility with app's dark theme
- **Loading States**: Smooth transitions while data loads

### 📚 **Documentation Updates**
- Updated README.md with Analytics Dashboard feature
- Updated Personal-Budget-PWA-Vision.md with completed analytics section
- Updated implementation priority to reflect v1.8.2 completion
- Added changelog for version tracking

---

## [1.8.1] - Previous Version

### Previous Features
- Zero-based budgeting with envelope allocation
- Monthly budget cycles with income sources
- Piggybanks (savings goals) with auto-contributions
- Split transactions across multiple envelopes
- Siri Shortcuts integration with AI parsing
- Payment method drag-and-drop reordering
- Offline-first PWA functionality
- Firebase sync and authentication

---

For full project documentation, see:
- [Personal Budget PWA Vision](mdFiles/personalBudgetPwaVision.md)
- [README.md](README.md)
