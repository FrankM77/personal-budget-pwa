# Quality Assurance: Testing & Issue Tracking

**Date:** February 5, 2026  
**Status:** Active QA Process

This document combines known issues tracking with comprehensive testing procedures for the Personal Budget PWA.

---

## Table of Contents
1. [Current Known Issues](#1-current-known-issues)
2. [Comprehensive Testing Guide](#2-comprehensive-testing-guide)
3. [Bug Reporting Template](#3-bug-reporting-template)
4. [Debug Commands](#4-debug-commands)
5. [Test Execution Checklist](#5-test-execution-checklist)

---

## 1. Current Known Issues

### 🐷 Resolved Issues

#### ✅ FIXED: Piggybank Allocation Copying
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** When copying previous month allocations, piggybank contributions were not included, causing budgets to go negative when auto-contributions triggered later.
**Fix:** Enhanced `copyPreviousMonthAllocations()` to include piggybank allocations and income sources.

#### ✅ FIXED: Month Targeting Bug  
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** Copy function was using stale `currentMonth` from hook closure instead of UI-selected month.
**Fix:** Modified `copyFromPreviousMonthWithToast()` to accept target month parameter.

#### ✅ FIXED: Export Button State Management
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** Export button didn't show loading states or error handling.
**Fix:** Added `isExportingCSV` state with loading indicators and error messages.

### 🔄 Partially Fixed Issues

#### 🔄 PARTIALLY FIXED: Copy Prompt Race Condition
**Status:** PARTIALLY FIXED (Commit: 2ad1b17)
**Issue:** Copy prompt appears even when data exists due to race condition between data loading and prompt logic.
**Current Fix:** Added 500ms delay and better loading state checks.
**Remaining Issue:** May still occur on slow connections or complex data loads.

### 🐛 Open Issues

#### 🐛 Navigation Data Loss
**Status:** OPEN
**Issue:** When navigating away from and back to a month, copy prompt may appear even though data exists in backend.
**Symptoms:**
- Data visible in React DevTools but copy prompt still shows
- Console shows data exists but UI thinks month is empty
**Root Cause:** Race condition between backend data loading and copy prompt logic.
**Debug:** Added logging `🔍 Copy prompt check:` to diagnose.

#### 🐛 Month Selector State Sync
**Status:** OPEN
**Issue:** Month selector UI may not properly sync with store state, causing copy function to target wrong month.
**Symptoms:**
- UI shows April but copy targets February
- `currentMonth` prop stale in components
**Debug:** Check React DevTools for component prop vs store state mismatches.

---

## 2. Comprehensive Testing Guide

### Testing Environment Setup

#### Required Tools
- **Chrome DevTools** (Network tab, Application tab, Console)
- **Firebase Console** access (to verify backend data)
- **Multiple browsers** (Chrome, Firefox, Safari for cross-browser testing)
- **Mobile devices** (iOS Safari, Android Chrome for PWA testing)

#### Preparation Steps
1. **Clear browser data** before each test session:
   - DevTools → Application → Clear storage → Clear site data
   - DevTools → Application → Service Workers → Unregister
2. **Enable DevTools Network throttling** for offline/slow connection testing
3. **Open Firebase Console** to monitor real-time data changes
4. **Keep Console open** to monitor errors and warnings

### Critical Test Categories

#### 1. Authentication & User Management

**Test Case AUTH-001: Login Flow**
**Priority:** Critical
**Online/Offline:** Online only

**Steps:**
1. Navigate to app with fresh browser session
2. Enter valid email/password
3. Verify email verification requirement
4. Complete email verification process
5. Attempt login again

**Expected Results:**
- ✅ Login redirects to main app
- ✅ User session persists across page refresh
- ✅ Auth state shows in Firebase Console
- ✅ No console authentication errors

**Bug Indicators:**
- ❌ Login redirects back to login page
- ❌ "Email not verified" error after verification
- ❌ Console shows Firebase auth errors
- ❌ User session lost on refresh

#### 2. Data Loading & Display

**Test Case DATA-001: Initial Load Performance**
**Priority:** Critical
**Online/Offline:** Both

**Steps:**
1. Clear browser data
2. Navigate to app
3. Time initial load to completion
4. Check all UI elements render
5. Verify data appears correctly

**Expected Results:**
- ✅ Load time < 3 seconds online, < 1 second from cache
- ✅ All sections render (Available to Budget, Income, Envelopes)
- ✅ No "stuck on loading" issues
- ✅ Data calculations correct

**Bug Indicators:**
- ❌ Loading spinner never disappears
- ❌ Missing UI sections
- ❌ Incorrect budget calculations
- ❌ Console shows data loading errors

#### 3. Monthly Budget Operations

**Test Case BUDGET-001: Month Navigation**
**Priority:** High
**Online/Offline:** Both

**Steps:**
1. Navigate to different months
2. Verify data loads for each month
3. Test month selector functionality
4. Check copy previous month prompt
5. Verify month-specific calculations

**Expected Results:**
- ✅ Smooth month transitions
- ✅ Correct data for each month
- ✅ Copy prompt appears appropriately
- ✅ No data mixing between months

**Bug Indicators:**
- ❌ Month navigation hangs
- ❌ Wrong month data displayed
- ❌ Copy prompt appears incorrectly
- ❌ Race conditions in month switching

#### 4. Envelope Management

**Test Case ENV-001: Create Envelope Offline**
**Priority:** Critical
**Online/Offline:** Offline

**Steps:**
1. Go offline
2. Create new envelope
3. Set initial allocation
4. Navigate back to main view
5. Verify envelope appears immediately
6. Go back online
7. Verify sync to Firebase

**Expected Results:**
- ✅ Envelope appears immediately in UI
- ✅ Envelope persists during navigation
- ✅ Sync occurs when back online
- ✅ Envelope persists after page refresh

**Bug Indicators:**
- ❌ Envelope doesn't appear immediately
- ❌ Envelope disappears on navigation
- ❌ Sync fails when going online
- ❌ Envelope missing after refresh

#### 5. Transaction Management

**Test Case TXN-001: Add Transaction Offline**
**Priority:** High
**Online/Offline:** Offline

**Steps:**
1. Go offline
2. Add transaction to envelope
3. Verify envelope balance updates
4. Navigate away and back
5. Verify transaction persists
6. Go online and verify sync

**Expected Results:**
- ✅ Transaction appears immediately
- ✅ Envelope balance updates correctly
- ✅ Transaction persists offline
- ✅ Sync occurs when online

**Bug Indicators:**
- ❌ Transaction doesn't appear
- ❌ Balance doesn't update
- ❌ Transaction lost offline
- ❌ Sync fails or duplicates

#### 6. Sync & Offline Operations

**Test Case SYNC-001: Online to Offline Transition**
**Priority:** Critical
**Online/Offline:** Both

**Steps:**
1. Load app online
2. Make data changes
3. Go offline
4. Continue making changes
5. Navigate extensively
6. Go back online
7. Verify all changes sync

**Expected Results:**
- ✅ Seamless online/offline transition
- ✅ All changes saved locally
- ✅ Automatic sync when online
- ✅ No data loss or corruption

**Bug Indicators:**
- ❌ App crashes on transition
- ❌ Changes lost offline
- ❌ Sync fails or incomplete
- ❌ Data corruption occurs

### Performance & Stress Testing

#### Test Case PERF-001: Large Dataset
**Priority:** Medium
**Online/Offline:** Both

**Steps:**
1. Create 100+ envelopes
2. Add 1000+ transactions
3. Test navigation performance
4. Verify calculation speed
5. Check memory usage

**Expected Results:**
- ✅ App remains responsive
- ✅ Calculations complete quickly
- ✅ No memory leaks
- ✅ Navigation stays smooth

**Bug Indicators:**
- ❌ App becomes sluggish
- ❌ Calculations timeout
- ❌ Memory usage grows
- ❌ Navigation hangs

---

## 3. Bug Reporting Template

When reporting bugs, include:

### Environment
- Browser version and OS
- Network conditions (online/offline)
- Device type (desktop/mobile)
- App version

### Steps to Reproduce
1. Clear, numbered steps
2. Include exact user actions
3. Note timing and sequence

### Expected vs Actual
- What should happen
- What actually happened
- Error messages (if any)

### Supporting Evidence
- Screenshots/screen recordings
- Console logs
- Network requests
- Firebase Console state

### Severity Assessment
- **Critical:** App unusable, data loss
- **High:** Major feature broken
- **Medium:** Feature partially broken
- **Low:** Minor issues, cosmetic

---

## 4. Debug Commands

### Check Store State:
```javascript
// In browser console
const store = useBudgetStore.getState();
console.log('Current month:', store.currentMonth);
console.log('Available months:', Object.keys(store.allocations));
console.log('Income sources:', Object.keys(store.incomeSources));
```

### Test Copy Function:
```javascript
// Manual copy test
await useBudgetStore.getState().copyPreviousMonthAllocations('2026-04');
```

### Check Month Data:
```javascript
// Specific month data
const month = '2026-02';
const income = store.incomeSources[month] || [];
const allocations = store.allocations[month] || [];
console.log(`${month}:`, { income: income.length, allocations: allocations.length });
```

### Comprehensive Store Debug:
```javascript
// Browser console debugging
const budgetStore = useBudgetStore.getState();
const authStore = useAuthStore.getState();

// Check store states
console.log('Budget store:', budgetStore);
console.log('Auth store:', authStore);

// Verify data
console.log('Envelopes:', budgetStore.envelopes);
console.log('Current month:', budgetStore.currentMonth);
```

---

## 5. Test Execution Checklist

### Before Each Test Session
- [ ] Clear browser data
- [ ] Open DevTools
- [ ] Verify Firebase Console access
- [ ] Check network conditions

### Core Functionality Tests
- [ ] Authentication flow
- [ ] Data loading and display
- [ ] Offline functionality
- [ ] Month navigation
- [ ] Envelope operations
- [ ] Transaction management
- [ ] Sync operations

### Edge Cases
- [ ] Network interruptions
- [ ] Large datasets
- [ ] Concurrent operations
- [ ] Browser compatibility
- [ ] PWA functionality

### Performance Tests
- [ ] Load times
- [ ] Memory usage
- [ ] Calculation speed
- [ ] Network performance

### Automated Testing Commands
```bash
# Production build testing
npm run build
npm run preview

# Development testing
npm run dev

# Linting
npm run lint
```

---

## Priority Matrix

| Priority | Test Categories | Reason |
|----------|----------------|--------|
| **P0** | Basic functionality, CRUD operations, Sync | Core features must work |
| **P1** | Offline support, Error handling, Navigation | High impact on user experience |
| **P2** | Performance, Accessibility, UI/UX | Important quality metrics |
| **P3** | Edge cases, Integration, Regression | Comprehensive coverage |

---

## Known Issues to Watch For

Based on existing documentation, monitor these specific areas:

1. **Copy Prompt Race Conditions** - Navigation data loss issues
2. **Month Selector State Sync** - State synchronization problems
3. **Offline Loading States** - Cache-first loading behavior
4. **Piggybank Allocation Copying** - Ensure fixed features stay fixed

---

## Conclusion

This comprehensive testing guide covers all major functionality areas of the Personal Budget PWA. Focus on the critical and high-priority test cases first, especially those related to offline functionality and data persistence, as these are core to the app's value proposition.

Regular testing using this guide will help identify bugs early and ensure a robust, reliable user experience across all network conditions and devices.

---

*Document created: February 5, 2026*  
*Combined from: KNOWN_ISSUES.md, BUG_TESTING_GUIDE.md*
