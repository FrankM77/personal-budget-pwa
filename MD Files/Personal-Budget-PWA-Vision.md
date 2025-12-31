# Personal Budget PWA - Zero-Based Budgeting Vision

## Overview
Transform the Personal Budget PWA into a comprehensive **zero-based budgeting** application following the EveryDollar model, where every dollar of income is assigned a job through a unified "Available to Budget" pool that funds spending envelopes until reaching zero balance.

## Core Features

### 1. Monthly Budget Cycles
- **Separate Months**: Each month operates as an independent budget cycle
- **Month Switching**: Easy navigation between past and future months
- **Month Templates**: Ability to copy budget structure from previous months
- **Budget Status**: Clear indication of whether budget is balanced (all income allocated)

### 2. Income Management ✅ IMPLEMENTED
- **Multiple Income Sources**: Track separate income streams (salary, freelance, investments, etc.)
- **Simplified Entry**: Just name and monthly amount (removed complexity)
- **Unified Income Pool**: All income sources combine into total "Available to Budget"
- **Full CRUD Operations**: Add, edit, and delete income sources with real-time updates
- **Mobile-Optimized**: Tap to edit, swipe to delete (optimistic with Undo)
- **Desktop-Optimized**: Hover to reveal actions for clean desktop interface
- **Real-Time Calculation**: Available to Budget updates instantly when income changes

### 3. Zero-Based Allocation
- **Available to Budget**: Prominent display of unallocated income pool (like EveryDollar)
- **Envelope Funding**: Assign money from Available to Budget to spending envelopes
- **Zero Balance Goal**: Visual progress toward allocating every dollar
- **Reallocation Freedom**: Move money between envelopes as needs change

### 4. Split Transactions
- **Transaction Splitting**: Ability to split single transactions across multiple envelopes
- **Split Categories**: Assign different portions to different budget categories
- **Split Tracking**: Maintain relationships between split portions
- **Split Editing**: Modify splits after creation

### 5. Enhanced Envelope System
- **Envelope Allocation**: Allocate specific amounts from income to envelopes
- **Envelope Limits**: Set spending limits for each envelope
- **Envelope Categories**: Organize envelopes by type (Essentials, Wants, Savings, Debt)
- **Envelope Transfers**: Move money between envelopes within the same month

### 6. Budget Analytics
- **Monthly Comparison**: Compare spending vs budget by month
- **Category Analysis**: See spending patterns across categories
- **Budget Performance**: Track how well you stick to your budget
- **Trend Analysis**: Identify spending trends over time

## Technical Implementation Plan

### Phase 1: Core Infrastructure ✅ COMPLETED
1. **Database Schema Updates** ✅
   - Add month-based budget structure with availableToBudget field
   - Income sources tracking with multiple streams
   - Transaction split relationships (schema ready)
   - Envelope allocation data with monthly budgeted amounts

2. **Month Management System** ✅
   - MonthSelector component for navigation between months
   - Month creation/copying functionality in MonthlyBudgetService
   - Month-based data isolation in monthlyBudgetStore

### Phase 2: Income & Allocation ✅ COMPLETED

#### 1. Income Sources Management ✅
- **IncomeSourceModal Component**: Full-featured modal for add/edit operations
- **Simplified Form Design**: Name and Amount only (removed frequency/category for better UX)
- **Real-time Total Income Calculation**: Automatic sum of all income sources
- **Full CRUD Operations**: Create, Read, Update, Delete with Firebase persistence
- **Mobile-Optimized Interactions**:
  - Tap income source → Opens edit modal
  - Swipe left → Triggers instant optimistic deletion
  - Undo Support → Toast notification allows immediate recovery
  - Proper event handling to prevent modal conflicts
- **Desktop-Optimized Interactions**:
  - Hover over income source → Edit/Delete buttons appear
  - Clean interface with no permanent UI clutter
- **Form Validation**: Required fields, positive amounts, error handling
- **Event Management**: Timeout cancellation prevents edit modal from opening after delete actions

#### 2. Available to Budget System ✅
- **AvailableToBudget Component**: Prominent display with progress visualization
- **Real-time Calculation Engine**: Instant recalculation on income changes
- **Zero Balance Goal Tracking**: Visual progress toward allocating every dollar
- **Status Indicators**: 
  - Blue: Available to Budget (under-allocated)
  - Green: Budget Balanced (zero balance achieved)
  - Red: Over Budget (over-allocated)
- **Progress Bar**: Visual percentage of income allocated
- **Instant Updates**: Recalculates immediately when income sources are added/edited/deleted

### Phase 3: Split Transactions
1. **Split Transaction UI**
   - Split creation interface
   - Split editing capabilities
   - Split visualization

2. **Split Data Management**
   - Split relationship handling
   - Split amount validation
   - Split category assignment

### Phase 4: Enhanced Analytics
1. **Budget Dashboard**
   - Monthly overview
   - Budget vs actual comparisons
   - Progress tracking

2. **Reporting Features**
   - Category breakdowns
   - Trend analysis
   - Budget performance metrics

## Data Model Changes

### New Collections/Tables:
- `monthly_budgets`: Core budget data per month with availableToBudget field
- `income_sources`: User income entries per month (reference only)
- `transaction_splits`: Split transaction relationships
- `envelope_allocations`: Monthly budgeted amounts per envelope

### Updated Collections:
- `transactions`: Add month reference and split relationships
- `envelopes`: Add category grouping and spending tracking
- `users`: Add budget preferences

## User Experience Flow

1. **New User Onboarding**
   - Set up first month's budget
   - Add income sources (creates total pool)
   - Create spending envelopes
   - Fund envelopes from "Available to Budget"

2. **Monthly Workflow**
   - Review previous month performance
   - Create/copy budget for new month
   - Add income sources (updates Available to Budget)
   - Fund envelopes until Available to Budget = $0
   - Track spending throughout month
   - Reallocate between envelopes as needed

3. **Daily Usage**
   - Record transactions (with split capability)
   - Monitor envelope balances vs budgeted amounts
   - Track progress toward zero Available to Budget
   - Adjust envelope allocations as needed

## Success Metrics
- **Budget Completion Rate**: % of months where budget reaches zero balance
- **Transaction Split Usage**: How often users split transactions
- **Monthly Active Users**: Consistent monthly usage
- **User Retention**: Continued app usage over time

## Future Enhancements
- **Automated Rules**: Set up recurring allocations
- **Goal Tracking**: Savings goals with progress tracking
- **Collaborative Budgeting**: Share budgets with partners
- **AI Insights**: Spending pattern analysis and suggestions
- **Integration**: Bank account syncing for automatic transaction import

## Implementation Priority
1. **✅ COMPLETED**: Month management, income tracking, basic allocation (Phase 1)
2. **✅ COMPLETED**: Income source management with full CRUD operations (Phase 2)
3. **🚧 CURRENT FOCUS**: Envelope allocation UI and management (Phase 2 continuation)
4. **Medium Priority**: Split transactions, enhanced analytics
5. **Low Priority**: Advanced features, integrations

## Current Status: Phase 2 - Income Management Complete ✅

## Live Demo

Scan this QR code to access the live demo on your mobile device:

![QR Code](https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://FrankM77.github.io/personal-budget-pwa/)

Or visit: [https://FrankM77.github.io/personal-budget-pwa/](https://FrankM77.github.io/personal-budget-pwa/)

### ✅ **Phase 1 Achievements (COMPLETED)**
- **Demo Page**: `/monthly-budget-demo` showcases all Phase 1 components
  - **Offline Demo Mode**: Works completely offline with mock data (no Firebase dependency)
  - **Month-Specific Data**: Demo data only shows for January 2025, other months remain empty
  - **Copy Month Functionality**: Copy demo data to any month for testing
  - **Data Persistence**: Demo data reloads correctly when switching months
- **Available to Budget**: Core logic and UI component complete with real-time updates
- **Month Navigation**: Fully functional with data isolation and copy functionality
- **Zero-Based Budgeting**: Mathematical accuracy verified and tested

### ✅ **Phase 2 Achievements - Income Management (COMPLETED)**
- **IncomeSourceModal Component**: Full-featured modal for add/edit operations
- **Simplified Form Design**: Streamlined to just Name and Amount (removed frequency/category complexity)
- **Full CRUD Operations**: Create, Read, Update, Delete with Firebase persistence
- **Mobile-First Interactions**:
  - **Tap to Edit**: Tap any income source to open edit modal
  - **Swipe to Delete**: Smooth, iOS-style swipe with instant optimistic deletion
  - **Undo Capability**: Delete actions can be instantly reversed via toast notification
- **Desktop Interactions**: Hover to reveal edit/delete buttons
- **Real-Time Updates**: Available to Budget recalculates instantly on any income change
- **Form Validation**: Required fields, positive amounts, error handling
- **Event Management**: Proper timeout cancellation to prevent modal conflicts

### 🚧 **Next Steps - Phase 2 Continuation**
- **Envelope Allocation Management**: Forms to fund envelopes from Available to Budget
- **Envelope Allocation UI**: Display and manage monthly envelope funding
- **Allocation Validation**: Prevent over-allocation beyond Available to Budget
- **Real-Time Allocation Updates**: Instant recalculation when allocations change

### 📱 **Mobile/Desktop UX Patterns Established**
- **Mobile**: Tap for primary action (edit), swipe for secondary action (delete)
- **Desktop**: Hover to reveal actions, click to perform
- **Responsive Design**: Seamless experience across all device sizes
- **Accessibility**: Proper touch targets, keyboard navigation, screen reader support

---
*Document created: December 27, 2025*  
*Last updated: December 31, 2025*
