# Test Category 1: Initial Load & Data Display Tests

## ELV-001: Basic Page Load
**Objective**: Verify the envelope list view loads correctly with all UI elements

### Prerequisites
- Fresh browser session
- User logged in
- Stable internet connection

### Test Steps

1. **Navigate to Envelope List**
   - Open browser
   - Navigate to the envelope list view URL
   - Wait for page to fully load

2. **Verify Header Elements**
   - Check sync status indicator is visible
   - Verify action buttons (Transaction History, Monthly Budget Demo, Start Fresh, User Menu)
   - Confirm "Personal Budget" title displays
   - Check month selector is present and shows current month

3. **Verify Main Content Sections**
   - Confirm "Available to Budget" section displays
   - Verify "Income Sources" section with "+" button
   - Check "Spending Envelopes" section with "+" button
   - Confirm floating add transaction button is visible

4. **Verify Responsive Layout**
   - Resize browser window to different sizes
   - Ensure layout adapts properly
   - Check no horizontal scrolling occurs

### Expected Results
✅ Page loads without JavaScript errors  
✅ All header elements visible and functional  
✅ All main content sections display correctly  
✅ Layout is responsive across different screen sizes  
✅ No console errors or warnings  

### Pass/Fail Criteria
- **PASS**: All UI elements visible, no errors, responsive layout works
- **FAIL**: Missing elements, console errors, broken layout

---

## ELV-002: Empty State Display
**Objective**: Verify proper display when user has no data

### Prerequisites
- Fresh account with no existing data
- User logged in

### Test Steps

1. **Navigate to Empty Account**
   - Log in with fresh test account
   - Navigate to envelope list view

2. **Verify Income Sources Empty State**
   - Check for "No income sources yet" message
   - Verify message text: "Add your monthly income"
   - Confirm "+" button is still visible and functional

3. **Verify Envelopes Empty State**
   - Check for "No envelopes yet" message
   - Verify wallet icon displays
   - Confirm "Create First Envelope" button works
   - Click button and verify navigation to add envelope

4. **Verify Available to Budget**
   - Check amount shows "$0.00"
   - Verify total income shows "$0.00"
   - Confirm total allocated shows "$0.00"

### Expected Results
✅ Empty state messages display correctly  
✅ Icons and buttons are visible in empty states  
✅ "Create First Envelope" button navigates correctly  
✅ All monetary amounts show as $0.00  
✅ UI remains functional despite no data  

### Pass/Fail Criteria
- **PASS**: All empty states display properly, buttons work
- **FAIL**: Missing empty states, broken buttons, incorrect amounts

---

## ELV-003: Data Loading States
**Objective**: Verify loading indicators and progressive data loading

### Prerequisites
- Account with existing data
- Ability to clear browser cache
- Network throttling capabilities

### Test Steps

1. **Clear Cache and Reload**
   - Clear browser cache and cookies
   - Open network tab in dev tools
   - Navigate to envelope list view

2. **Monitor Initial Loading**
   - Watch sync status indicator
   - Verify "Syncing..." appears during initial load
   - Check that UI remains interactive during loading
   - Note the order data appears (income sources, then envelopes)

3. **Test Progressive Loading**
   - Observe if sections load independently
   - Check if loading states block interactions
   - Verify data appears smoothly without layout shifts

4. **Test Slow Network**
   - Enable network throttling (Slow 3G)
   - Refresh page
   - Verify loading indicators work properly
   - Check app remains responsive

### Expected Results
✅ Loading indicators appear during data fetch  
✅ UI remains interactive during loading  
✅ Data loads progressively without breaking layout  
✅ Slow network handled gracefully  
✅ No timeout errors with reasonable delay  

### Pass/Fail Criteria
- **PASS**: Loading states work correctly, UI responsive
- **FAIL**: Broken UI during loading, timeouts, poor progressive loading

---

## Additional Test Data Setup

### Test Data Creation
For comprehensive testing, create the following test data:

1. **Income Sources**:
   - "Primary Salary" - $5000.00
   - "Side Hustle" - $500.00
   - "Investment Dividends" - $200.00

2. **Envelopes**:
   - "Groceries" - $600.00 budget
   - "Gas/Transport" - $200.00 budget
   - "Entertainment" - $150.00 budget
   - "Utilities" - $300.00 budget
   - "Savings" - $1000.00 budget

3. **Transactions** (for balance testing):
   - Various transactions to create positive/negative balances

### Environment Check
Before running tests, verify:
- [ ] Browser console is clear of errors
- [ ] Network connection is stable
- [ ] Test account is properly set up
- [ ] Dev tools are open for monitoring
- [ ] Screen recording ready for documentation

### Test Execution Notes
- Take screenshots of each step
- Record any console errors or warnings
- Note performance metrics (load times)
- Document any deviations from expected results
- Test in multiple browsers if possible

---

## Troubleshooting Guide

### Common Issues and Solutions

1. **Page Not Loading**
   - Check network connection
   - Verify Firebase configuration
   - Clear browser cache
   - Check console for JavaScript errors

2. **Missing UI Elements**
   - Verify CSS files are loading
   - Check for JavaScript errors
   - Confirm responsive breakpoints
   - Test with different screen sizes

3. **Loading States Not Working**
   - Check network requests in dev tools
   - Verify loading state management
   - Test with different network speeds
   - Check for race conditions

4. **Empty States Not Showing**
   - Verify data store initialization
   - Check for cached data
   - Test with truly empty account
   - Confirm conditional rendering logic

### Success Metrics
- Page loads in under 3 seconds on 3G
- All UI elements visible within 2 seconds
- No console errors or warnings
- Responsive layout works on all target devices
- Loading states provide good user feedback
