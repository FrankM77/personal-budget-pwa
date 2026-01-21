# Comprehensive Bug Testing Guide
**Personal Budget PWA**  
**Version:** 1.3.0  
**Last Updated:** January 21, 2026

---

## Overview

This guide provides comprehensive testing scenarios to discover bugs in the Personal Budget PWA when online or offline. The app is a zero-based budgeting PWA with offline-first architecture, Firebase sync, and monthly budgeting workflows.

## Testing Environment Setup

### Required Tools
- **Chrome DevTools** (Network tab, Application tab, Console)
- **Firebase Console** access (to verify backend data)
- **Multiple browsers** (Chrome, Firefox, Safari for cross-browser testing)
- **Mobile devices** (iOS Safari, Android Chrome for PWA testing)

### Preparation Steps
1. **Clear browser data** before each test session:
   - DevTools → Application → Clear storage → Clear site data
   - DevTools → Application → Service Workers → Unregister
2. **Enable DevTools Network throttling** for offline/slow connection testing
3. **Open Firebase Console** to monitor real-time data changes
4. **Keep Console open** to monitor errors and warnings

---

## Critical Test Categories

### 1. Authentication & User Management

#### Test Case AUTH-001: Login Flow
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

#### Test Case AUTH-002: Offline Grace Period
**Priority:** High
**Online/Offline:** Both

**Steps:**
1. Login successfully online
2. Go offline (DevTools Network → Offline)
3. Refresh page
4. Verify offline grace period banner appears
5. Navigate through app features
6. Wait 7+ days, then test (simulated)

**Expected Results:**
- ✅ Offline grace banner shows remaining days
- ✅ App remains functional for 7 days offline
- ✅ After grace period, requires re-authentication

**Bug Indicators:**
- ❌ App immediately blocks access offline
- ❌ Grace period calculation incorrect
- ❌ Banner shows wrong expiration time

---

### 2. Data Loading & Display

#### Test Case DATA-001: Initial Load Performance
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

#### Test Case DATA-002: Offline Data Persistence
**Priority:** Critical
**Online/Offline:** Offline

**Steps:**
1. Load app online with data
2. Go offline
3. Navigate between all views
4. Refresh page offline
5. Verify all data persists

**Expected Results:**
- ✅ All data visible offline
- ✅ Navigation works seamlessly
- ✅ Page refresh works (production build)
- ✅ Calculations remain accurate

**Bug Indicators:**
- ❌ Data disappears when offline
- ❌ Navigation gets stuck on loading
- ❌ Page refresh fails offline
- ❌ Calculations become incorrect

---

### 3. Monthly Budget Operations

#### Test Case BUDGET-001: Month Navigation
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

#### Test Case BUDGET-002: Copy Previous Month
**Priority:** High
**Online/Offline:** Both

**Steps:**
1. Navigate to empty month
2. Accept copy previous month prompt
3. Verify all data copies correctly
4. Check piggybank contributions included
5. Verify calculations update

**Expected Results:**
- ✅ All income sources copied
- ✅ All envelope allocations copied
- ✅ Piggybank contributions included
- ✅ Available to Budget recalculates

**Bug Indicators:**
- ❌ Incomplete data copying
- ❌ Missing piggybank contributions
- ❌ Negative budgets after copy
- ❌ Copy prompt race conditions

---

### 4. Envelope Management

#### Test Case ENV-001: Create Envelope Offline
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

#### Test Case ENV-002: Envelope Budget Updates
**Priority:** High
**Online/Offline:** Both

**Steps:**
1. Update envelope budget amount
2. Verify "Available to Budget" updates
3. Test negative budget scenarios
4. Verify calculations persist
5. Test rapid successive updates

**Expected Results:**
- ✅ Real-time budget updates
- ✅ Available to Budget recalculates
- ✅ Negative budgets handled correctly
- ✅ No calculation errors

**Bug Indicators:**
- ❌ Budget updates don't save
- ❌ Available to Budget incorrect
- ❌ Negative budget warnings missing
- ❌ Calculation inconsistencies

---

### 5. Transaction Management

#### Test Case TXN-001: Add Transaction Offline
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

#### Test Case TXN-002: Transaction History
**Priority:** Medium
**Online/Offline:** Both

**Steps:**
1. Navigate to transaction history
2. Verify all transactions listed
3. Test filtering and sorting
4. Check transaction details
5. Verify offline functionality

**Expected Results:**
- ✅ Complete transaction history
- ✅ Filters work correctly
- ✅ Transaction details accurate
- ✅ Offline access works

**Bug Indicators:**
- ❌ Missing transactions
- ❌ Filters don't work
- ❌ Incorrect transaction details
- ❌ Offline access fails

---

### 6. Sync & Offline Operations

#### Test Case SYNC-001: Online to Offline Transition
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

#### Test Case SYNC-002: Conflict Resolution
**Priority:** Medium
**Online/Offline:** Both

**Steps:**
1. Make changes on device A
2. Make conflicting changes on device B
3. Bring both devices online
4. Verify conflict handling
5. Check data integrity

**Expected Results:**
- ✅ Conflicts resolved gracefully
- ✅ No data loss
- ✅ User notified of conflicts
- ✅ Final state consistent

**Bug Indicators:**
- ❌ Data overwritten silently
- ❌ Duplicate entries created
- ❌ App crashes on conflicts
- ❌ Inconsistent final state

---

### 7. PWA Functionality

#### Test Case PWA-001: Installation
**Priority:** Medium
**Online/Offline:** Online

**Steps:**
1. Navigate to app in Chrome
2. Look for install prompt
3. Install PWA
4. Launch from home screen
5. Verify full functionality

**Expected Results:**
- ✅ Install prompt appears
- ✅ Installation succeeds
- ✅ App launches from home screen
- ✅ All features work installed

**Bug Indicators:**
- ❌ No install prompt
- ❌ Installation fails
- ❌ Installed app missing features
- ❌ Different behavior installed vs browser

#### Test Case PWA-002: Service Worker
**Priority:** High
**Online/Offline:** Both

**Steps:**
1. Check service worker registration
2. Verify caching strategies
3. Test offline page serving
4. Check update mechanisms
5. Monitor service worker logs

**Expected Results:**
- ✅ Service worker registered
- ✅ Proper caching implemented
- ✅ Offline page serves correctly
- ✅ Updates work smoothly

**Bug Indicators:**
- ❌ Service worker not registered
- ❌ Caching issues
- ❌ Offline dinosaur appears
- ❌ Update problems

---

### 8. Data Export & Import

#### Test Case EXPORT-001: CSV Export
**Priority:** Medium
**Online/Offline:** Both

**Steps:**
1. Navigate to settings
2. Click export CSV button
3. Verify download starts
4. Check CSV file content
5. Test with large datasets

**Expected Results:**
- ✅ Export button shows loading state
- ✅ CSV downloads successfully
- ✅ Data format correct
- ✅ Large exports handled

**Bug Indicators:**
- ❌ Export button doesn't work
- ❌ No loading indicator
- ❌ CSV format incorrect
- ❌ Large exports fail

---

## Performance & Stress Testing

### Test Case PERF-001: Large Dataset
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

### Test Case PERF-002: Network Conditions
**Priority:** Medium
**Online/Offline:** Various

**Steps:**
1. Test with slow 3G connection
2. Test with intermittent connectivity
3. Test during network switches
4. Verify timeout handling
5. Check retry mechanisms

**Expected Results:**
- ✅ Graceful degradation
- ✅ Proper timeout handling
- ✅ Automatic retries
- ✅ User feedback provided

**Bug Indicators:**
- ❌ App hangs on slow networks
- ❌ No timeout handling
- ❌ No retry mechanism
- ❌ Poor user experience

---

## Cross-Browser Testing

### Test Case BROWSER-001: Desktop Browsers
**Priority:** Medium
**Online/Offline:** Both

**Browsers to Test:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Key Areas:**
- Authentication flow
- Data display
- Navigation
- Offline functionality

### Test Case BROWSER-002: Mobile Browsers
**Priority:** Medium
**Online/Offline:** Both

**Platforms/Browsers:**
- iOS Safari
- Android Chrome
- Samsung Internet
- Mobile Firefox

**Key Areas:**
- Touch interactions
- PWA installation
- Offline behavior
- Performance

---

## Accessibility Testing

### Test Case A11Y-001: Screen Reader Support
**Priority:** Low
**Online/Offline:** Both

**Steps:**
1. Enable screen reader
2. Navigate app using keyboard
3. Verify all elements announced
4. Check form accessibility
5. Test with voice commands

**Expected Results:**
- ✅ All elements accessible
- ✅ Proper labels and descriptions
- ✅ Keyboard navigation works
- ✅ Voice commands functional

---

## Bug Reporting Template

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

## Known Issues to Watch For

Based on existing documentation, monitor these specific areas:

1. **Copy Prompt Race Conditions** (KNOWN_ISSUES.md)
2. **Month Selector State Sync** (KNOWN_ISSUES.md)
3. **Navigation Data Loss** (KNOWN_ISSUES.md)
4. **Offline Loading States** (OFFLINE_TROUBLESHOOTING.md)
5. **Piggybank Allocation Copying** (KNOWN_ISSUES.md)

---

## Automated Testing Commands

### Build and Test
```bash
# Production build testing
npm run build
npm run preview

# Development testing
npm run dev

# Linting
npm run lint
```

### Debug Commands
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

## Testing Checklist Summary

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

---

## Conclusion

This comprehensive testing guide covers all major functionality areas of the Personal Budget PWA. Focus on the critical and high-priority test cases first, especially those related to offline functionality and data persistence, as these are core to the app's value proposition.

Regular testing using this guide will help identify bugs early and ensure a robust, reliable user experience across all network conditions and devices.
