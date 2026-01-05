# Test Category 2: Month Navigation Tests

## ELV-004: Month Selection
**Objective**: Verify month navigation and selection functionality

### Prerequisites
- Account with data across multiple months
- Current month: January 2026
- Previous months with data: December 2025, November 2025

### Test Steps

1. **Open Month Selector**
   - Click on the month selector in the header
   - Verify the month picker/modal opens
   - Check current month is highlighted/selected

2. **Navigate to Previous Month**
   - Click the "Previous" button or left arrow
   - Verify month changes to December 2025
   - Check that data updates to show December's income and envelopes
   - Verify Available to Budget reflects December calculations

3. **Navigate to Next Month**
   - From December, click "Next" button or right arrow
   - Verify month returns to January 2026
   - Check data updates back to January's information
   - Confirm Available to Budget updates accordingly

4. **Jump to Specific Month**
   - Click month selector to open picker
   - Select November 2025 from the calendar
   - Verify navigation works correctly
   - Check data displays for November 2025

5. **Navigate to Future Month**
   - Navigate to February 2026 (future month)
   - Verify empty state displays for future month
   - Check copy previous month prompt appears

### Expected Results
✅ Month selector opens and closes smoothly  
✅ Navigation buttons work correctly  
✅ Data updates for each selected month  
✅ Available to Budget recalculates for each month  
✅ Future months show empty state with copy prompt  
✅ No data crossover between months  

### Pass/Fail Criteria
- **PASS**: All month navigation works, data updates correctly
- **FAIL**: Navigation broken, wrong data displays, data crossover

---

## ELV-005: Month Data Persistence
**Objective**: Verify data persists correctly for each month

### Prerequisites
- Multiple months with different data
- Test account with edit permissions

### Test Steps

1. **Establish Baseline Data**
   - Navigate to January 2026
   - Note current income sources and amounts
   - Note current envelope budgets
   - Note Available to Budget amount

2. **Add Data to Different Month**
   - Navigate to February 2026
   - Add new income source: "Test Income" - $1000
   - Add envelope budget: "Test Envelope" - $500
   - Verify Available to Budget shows $500

3. **Verify Month Isolation**
   - Navigate back to January 2026
   - Confirm January data unchanged
   - Verify "Test Income" and "Test Envelope" are NOT in January
   - Check Available to Budget is still original January amount

4. **Return to Modified Month**
   - Navigate back to February 2026
   - Verify "Test Income" still exists
   - Verify "Test Envelope" budget persists
   - Confirm Available to Budget is still $500

5. **Test Multiple Month Modifications**
   - Add data to March 2026
   - Modify data in December 2025
   - Navigate between all months
   - Verify each month maintains its own data

### Expected Results
✅ Each month maintains independent data  
✅ Adding data to one month doesn't affect others  
✅ Navigation between months preserves data  
✅ Available to Budget calculated per month  
✅ No data leakage between months  

### Pass/Fail Criteria
- **PASS**: Data properly isolated per month, no crossover
- **FAIL**: Data mixing between months, lost data, incorrect calculations

---

## ELV-006: Copy Previous Month Prompt
**Objective**: Verify copy previous month functionality

### Prerequisites
- Previous month (December 2025) with existing data
- Current month (January 2026) empty or with minimal data

### Test Steps

1. **Trigger Copy Prompt**
   - Navigate to empty month (e.g., February 2026)
   - Verify copy prompt appears after short delay
   - Check prompt mentions the correct previous month
   - Verify prompt shows summary of previous month data

2. **Test Copy Functionality**
   - Click "Copy Previous Month" button
   - Verify loading indicator during copy
   - Check that previous month income sources are copied
   - Verify envelope budgets are copied
   - Confirm Available to Budget matches copied data

3. **Test Dismiss Functionality**
   - Navigate to another empty month (March 2026)
   - Wait for copy prompt to appear
   - Click "Dismiss" or "No Thanks" button
   - Verify prompt disappears
   - Navigate away and back to same month
   - Confirm prompt does not reappear after dismissal

4. **Test Copy with Existing Data**
   - Navigate to month with some existing data
   - Verify copy prompt does NOT appear
   - Add small amount of data to empty month
   - Verify prompt behavior with partial data

5. **Test Copy Accuracy**
   - Compare copied data with original month
   - Verify all income sources copied correctly
   - Check envelope budget amounts match
   - Confirm calculations are accurate

### Expected Results
✅ Copy prompt appears only for empty months  
✅ Copy functionality duplicates data accurately  
✅ Dismiss prevents prompt from reappearing  
✅ Prompt doesn't show with existing data  
✅ Copied data matches original exactly  

### Pass/Fail Criteria
- **PASS**: Copy prompt works correctly, data copies accurately
- **FAIL**: Prompt timing wrong, copy fails, data mismatch

---

## ELV-007: Month Navigation Edge Cases
**Objective**: Test edge cases and error conditions in month navigation

### Prerequisites
- Account with data spanning multiple months
- Ability to test various scenarios

### Test Steps

1. **Rapid Month Navigation**
   - Click month navigation buttons rapidly
   - Try to break navigation with quick clicks
   - Verify app remains stable
   - Check data loads correctly for each month

2. **Month Boundary Navigation**
   - Navigate from January to December of previous year
   - Navigate from December to January of next year
   - Test year boundary transitions
   - Verify data displays correctly across year boundaries

3. **Invalid Month Handling**
   - Try to access non-existent month URL parameters
   - Test with malformed month strings
   - Verify graceful fallback to current month
   - Check no errors occur with invalid input

4. **Concurrent Month Changes**
   - Start navigation, then quickly change month again
   - Test during data loading
   - Verify no race conditions occur
   - Check final state is correct

5. **Memory and Performance**
   - Navigate through 12+ months quickly
   - Monitor memory usage
   - Check for memory leaks
   - Verify performance remains acceptable

### Expected Results
✅ Rapid navigation doesn't break the app  
✅ Year boundaries work correctly  
✅ Invalid months handled gracefully  
✅ No race conditions with concurrent changes  
✅ Memory usage remains stable  

### Pass/Fail Criteria
- **PASS**: All edge cases handled gracefully, no crashes
- **FAIL**: App breaks, crashes, or performs poorly with edge cases

---

## Test Data Setup for Month Navigation

### Preparing Test Data

1. **December 2025 Data**:
   - Income: "Salary" $4000, "Bonus" $1000
   - Envelopes: "Gifts" $500, "Holiday Food" $300
   - Available: $4200

2. **January 2026 Data**:
   - Income: "Salary" $4500 (raise), "Side Job" $200
   - Envelopes: "Groceries" $600, "Utilities" $400
   - Available: $3700

3. **February 2026**: Empty (for copy prompt testing)

4. **March 2026**: Empty (for dismissal testing)

### Environment Preparation

Before testing:
- [ ] Clear browser cache
- [ ] Verify test account has data for multiple months
- [ ] Open dev tools for monitoring
- [ ] Note current month for reference
- [ ] Prepare screenshot capability

### Test Execution Checklist

For each test:
- [ ] Document starting state
- [ ] Follow steps precisely
- [ ] Note any deviations
- [ ] Capture screenshots of failures
- [ ] Record console errors
- [ ] Verify final state matches expected

### Common Issues and Solutions

1. **Month Navigation Not Working**
   - Check month selector component
   - Verify state management
   - Test with different browsers
   - Check for JavaScript errors

2. **Data Not Updating**
   - Verify data fetching for new month
   - Check loading states
   - Test with network throttling
   - Confirm store updates

3. **Copy Prompt Issues**
   - Check timing logic for prompt display
   - Verify empty state detection
   - Test dismissal persistence
   - Check copy data accuracy

4. **Performance Issues**
   - Monitor memory usage
   - Check for unnecessary re-renders
   - Verify data caching
   - Test with large datasets

### Success Metrics
- Month navigation under 500ms
- Data switches correctly between months
- Copy prompt appears within 2 seconds
- No memory leaks during navigation
- All edge cases handled gracefully
