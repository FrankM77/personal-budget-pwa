# Changelog

All notable changes to Personal Budget PWA will be documented in this file.

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
