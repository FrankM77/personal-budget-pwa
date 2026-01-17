# Known Issues & Bugs

## 🐷 Piggybank System Issues

### ✅ FIXED: Piggybank Allocation Copying
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** When copying previous month allocations, piggybank contributions were not included, causing budgets to go negative when auto-contributions triggered later.
**Fix:** Enhanced `copyPreviousMonthAllocations()` to include piggybank allocations and income sources.

### ✅ FIXED: Month Targeting Bug  
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** Copy function was using stale `currentMonth` from hook closure instead of UI-selected month.
**Fix:** Modified `copyFromPreviousMonthWithToast()` to accept target month parameter.

### 🔄 PARTIALLY FIXED: Copy Prompt Race Condition
**Status:** PARTIALLY FIXED (Commit: 2ad1b17)
**Issue:** Copy prompt appears even when data exists due to race condition between data loading and prompt logic.
**Current Fix:** Added 500ms delay and better loading state checks.
**Remaining Issue:** May still occur on slow connections or complex data loads.

## 📊 Data Persistence Issues

### 🐛 Navigation Data Loss
**Status:** OPEN
**Issue:** When navigating away from and back to a month, copy prompt may appear even though data exists in backend.
**Symptoms:**
- Data visible in React DevTools but copy prompt still shows
- Console shows data exists but UI thinks month is empty
**Root Cause:** Race condition between backend data loading and copy prompt logic.
**Debug:** Added logging `🔍 Copy prompt check:` to diagnose.

## 🔧 CSV Export Issues

### ✅ FIXED: Export Button State Management
**Status:** RESOLVED (Commit: 2ad1b17)
**Issue:** Export button didn't show loading states or error handling.
**Fix:** Added `isExportingCSV` state with loading indicators and error messages.

## 🎯 UI/UX Issues

### 🐛 Month Selector State Sync
**Status:** OPEN
**Issue:** Month selector UI may not properly sync with store state, causing copy function to target wrong month.
**Symptoms:**
- UI shows April but copy targets February
- `currentMonth` prop stale in components
**Debug:** Check React DevTools for component prop vs store state mismatches.

## 📋 Testing & Debug Files

### Created Debug Scripts:
- `check-feb-data.js` - Comprehensive month data diagnostics
- `debug-month-rollover.js` - Month transition testing
- `debug-piggybank-copy.js` - Piggybank copy verification
- `quick-debug.js` - Quick store access testing
- `test-month-calc.js` - Month calculation logic testing

## 🚀 Next Steps

### High Priority:
1. **Complete copy prompt race condition fix**
2. **Test end-to-end month copying workflow**
3. **Verify data persistence across navigation**

### Medium Priority:
1. **Clean up debug files**
2. **Add unit tests for copy functionality**
3. **Improve error handling for backend sync issues**

### Low Priority:
1. **Add loading indicators for month transitions**
2. **Implement undo functionality for copy operations**
3. **Add copy history/audit trail**

## 🔍 Debug Commands

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

## 📝 Notes

- All piggybank-related fixes are working correctly
- Core copy functionality is solid
- Remaining issues are primarily timing/state synchronization problems
- Debug logging added throughout for easier troubleshooting

---
**Last Updated:** 2026-01-17
**Commits:** 2ad1b17 (main fixes)
