# Test Category 4: Spending Envelope Tests

## ELV-011: Navigate to Envelope Detail
**Objective**: Verify navigation from envelope list to envelope detail view

### Prerequisites
- Account with existing envelopes
- At least 3 envelopes with different names and balances
- Stable internet connection

### Test Steps

1. **Basic Navigation Test**
   - Click on any envelope in the Spending Envelopes section
   - Verify navigation to envelope detail view
   - Check URL changes to include envelope ID
   - Confirm detail view loads with correct envelope data

2. **Verify Correct Envelope Data**
   - Check envelope name matches clicked envelope
   - Verify envelope balance is correct
   - Confirm transactions belong to correct envelope
   - Check envelope metadata displays properly

3. **Test Different Envelopes**
   - Navigate back to envelope list
   - Click on a different envelope
   - Verify navigation to correct detail view
   - Repeat for 3-4 different envelopes
   - Ensure each loads correct data

4. **Test Browser Navigation**
   - Navigate to envelope detail
   - Use browser back button
   - Verify return to envelope list
   - Use browser forward button
   - Verify return to envelope detail

5. **Test Direct URL Navigation**
   - Copy envelope detail URL
   - Paste into new browser tab
   - Verify direct navigation works
   - Check envelope loads correctly

### Expected Results
✅ Click navigation works smoothly  
✅ Correct envelope ID in URL  
✅ Detail view shows correct envelope data  
✅ Browser back/forward navigation works  
✅ Direct URL navigation functions properly  

### Pass/Fail Criteria
- **PASS**: All navigation methods work, correct data displayed
- **FAIL**: Navigation broken, wrong data, URL issues

---

## ELV-012: Inline Budget Editing
**Objective**: Verify inline editing of envelope budget amounts

### Prerequisites
- Account with existing envelopes and budgets
- Current month with envelope allocations

### Test Steps

1. **Start Inline Editing**
   - Click on the budgeted amount for any envelope
   - Verify input field appears immediately
   - Check input is focused and auto-selected
   - Confirm current amount is pre-filled

2. **Test Input Field Behavior**
   - Type new amount: "750.50"
   - Verify input accepts decimal numbers
   - Test arrow keys for navigation
   - Verify step="0.01" works correctly
   - Test minimum value validation (no negative amounts)

3. **Save on Blur**
   - Click outside the input field
   - Verify save is triggered automatically
   - Check amount updates in display
   - Confirm Available to Budget recalculates
   - Verify input field disappears

4. **Save on Enter Key**
   - Click another envelope's budget amount
   - Type new amount and press Enter key
   - Verify save is triggered
   - Check amount updates correctly
   - Confirm focus moves appropriately

5. **Cancel on Escape Key**
   - Click envelope budget amount
   - Type new amount but press Escape key
   - Verify edit is cancelled
   - Check original amount is restored
   - Confirm input field disappears

6. **Test Invalid Input**
   - Start editing and enter negative amount
   - Try to save with negative value
   - Verify validation prevents negative amounts
   - Test with non-numeric input
   - Verify input sanitization or rejection

### Expected Results
✅ Click triggers inline edit mode  
✅ Input field focuses and selects current value  
✅ Save works on blur and Enter key  
✅ Cancel works on Escape key  
✅ Validation prevents invalid amounts  
✅ Available to Budget updates in real-time  

### Pass/Fail Criteria
- **PASS**: All inline editing functions work correctly
- **FAIL**: Editing broken, validation issues, UI not updating

---

## ELV-013: Budget Calculation Validation
**Objective**: Verify budget calculations and Available to Budget accuracy

### Prerequisites
- Account with income sources and envelopes
- Understanding of zero-based budgeting calculations

### Test Steps

1. **Establish Baseline**
   - Note total income amount
   - Note current Available to Budget
   - Document individual envelope budgets
   - Verify calculation: Income - Allocated = Available

2. **Test Over-Budgeting**
   - Set envelope budgets that exceed total income
   - Example: Income $5000, allocate $6000 across envelopes
   - Verify Available to Budget shows negative amount
   - Check negative amount displays in red color
   - Verify formatting: "-$1,000.00"

3. **Test Perfect Budgeting**
   - Adjust envelope budgets to exactly match income
   - Example: Income $5000, allocate exactly $5000
   - Verify Available to Budget shows $0.00
   - Check color is neutral or appropriate
   - Verify no negative or positive display

4. **Test Under-Budgeting**
   - Set envelope budgets less than total income
   - Example: Income $5000, allocate $4000
   - Verify Available to Budget shows positive amount
   - Check positive amount displays in green
   - Verify formatting: "$1,000.00"

5. **Test Real-Time Updates**
   - Start with balanced budget (Available = $0)
   - Increase one envelope budget by $100
   - Verify Available immediately shows -$100
   - Decrease same envelope budget by $100
   - Verify Available returns to $0
   - Test rapid changes to ensure no calculation errors

6. **Test Complex Calculations**
   - Use multiple income sources
   - Use many envelopes with decimal amounts
   - Verify calculations remain accurate
   - Test with .99 cent precision
   - Check for rounding errors

### Expected Results
✅ Available to Budget calculated correctly  
✅ Negative amounts show in red with "-" prefix  
✅ Zero amounts show appropriately  
✅ Positive amounts show in green  
✅ Real-time updates work instantly  
✅ Complex calculations remain accurate  

### Pass/Fail Criteria
- **PASS**: All calculations correct, colors appropriate, real-time updates
- **FAIL**: Calculation errors, wrong colors, delayed updates

---

## ELV-014: Envelope Balance Display
**Objective**: Verify envelope balance display and color coding

### Prerequisites
- Envelopes with various balance states
- Transactions creating positive, negative, and zero balances

### Test Steps

1. **Positive Balance Display**
   - Find envelope with positive balance
   - Verify amount shows in green color
   - Check formatting: "$250.50"
   - Verify no "-" prefix for positive amounts
   - Test with various positive amounts

2. **Negative Balance Display**
   - Find or create envelope with negative balance
   - Verify amount shows in red color
   - Check formatting: "-$75.25"
   - Verify "-" prefix is present
   - Test with various negative amounts

3. **Zero Balance Display**
   - Find envelope with exactly zero balance
   - Verify color is neutral (not red or green)
   - Check formatting: "$0.00"
   - Verify no "-" prefix
   - Test envelope with tiny amounts near zero

4. **Balance Calculation Accuracy**
   - Add transaction to envelope
   - Verify balance updates immediately
   - Check calculation: Starting + Income - Expenses
   - Test with multiple transactions
   - Verify running balance accuracy

5. **Large Balance Display**
   - Create envelope with large balance ($10,000+)
   - Verify formatting with commas
   - Check color coding works with large amounts
   - Test display doesn't break layout
   - Verify readability maintained

6. **Decimal Precision**
   - Create transactions with .99 cent amounts
   - Verify decimal precision maintained
   - Check rounding works correctly
   - Test with various decimal combinations
   - Verify no floating-point errors

### Expected Results
✅ Positive balances show in green without "-"  
✅ Negative balances show in red with "-" prefix  
✅ Zero balances show in neutral color  
✅ Balance calculations are accurate  
✅ Large numbers formatted with commas  
✅ Decimal precision maintained  

### Pass/Fail Criteria
- **PASS**: All balance displays correct, colors accurate, calculations precise
- **FAIL**: Wrong colors, calculation errors, formatting issues

---

## ELV-015: Envelope Interaction Edge Cases
**Objective**: Test edge cases and special scenarios for envelope interactions

### Prerequisites
- Account with envelopes and transactions
- Ability to test various edge cases

### Test Steps

1. **Empty Envelope List**
   - Navigate to account with no envelopes
   - Verify empty state displays correctly
   - Check wallet icon is visible
   - Test "Create First Envelope" button
   - Verify navigation to add envelope

2. **Single Envelope**
   - Create account with only one envelope
   - Verify display works correctly
   - Test inline editing on single envelope
   - Check calculations with single envelope
   - Verify layout doesn't break

3. **Many Envelopes**
   - Create 20+ envelopes
   - Verify scrolling works smoothly
   - Test performance with many envelopes
   - Check inline editing on long list
   - Verify no layout issues

4. **Envelope with No Budget**
   - Create envelope with $0 budget
   - Verify display shows "$0.00"
   - Test inline editing from zero
   - Check calculations work with zero budget
   - Verify color coding is appropriate

5. **Envelope Name Length**
   - Create envelope with very long name
   - Verify text truncation or wrapping
   - Check layout remains intact
   - Test inline editing with long names
   - Verify no display issues

6. **Rapid Budget Changes**
   - Quickly change multiple envelope budgets
   - Verify no calculation errors
   - Check Available to Budget updates correctly
   - Test concurrent editing attempts
   - Verify final state is accurate

7. **Network Issues During Editing**
   - Start editing envelope budget
   - Disconnect network during save
   - Reconnect network
   - Verify operation completes or fails gracefully
   - Check data integrity

### Expected Results
✅ Empty states display correctly  
✅ Single envelope works properly  
✅ Many envelopes perform well  
✅ Zero budgets handled correctly  
✅ Long names don't break layout  
✅ Rapid changes don't cause errors  
✅ Network issues handled gracefully  

### Pass/Fail Criteria
- **PASS**: All edge cases handled without errors or display issues
- **FAIL**: Layout breaks, calculation errors, performance issues

---

## Test Data Setup for Envelope Tests

### Sample Envelopes for Testing

1. **Groceries** - Budget: $600.00, Balance: $450.25
2. **Gas/Transport** - Budget: $200.00, Balance: -$15.50
3. **Entertainment** - Budget: $150.00, Balance: $0.00
4. **Utilities** - Budget: $300.00, Balance: $125.75
5. **Savings** - Budget: $1000.00, Balance: $2500.00
6. **Emergency Fund** - Budget: $500.00, Balance: -$200.00

### Test Environment Preparation

Before testing:
- [ ] Create test envelopes with various balances
- [ ] Add transactions to create positive/negative balances
- [ ] Note initial Available to Budget
- [ ] Open dev tools for monitoring
- [ ] Prepare calculator for verification

### Test Execution Checklist

For each test:
- [ ] Document starting state
- [ ] Record all envelope budgets and balances
- [ ] Note Available to Budget amount
- [ ] Follow steps precisely
- [ ] Verify calculations manually
- [ ] Capture screenshots of failures

### Common Issues and Solutions

1. **Navigation Not Working**
   - Check click handlers on envelope items
   - Verify routing configuration
   - Test with different envelopes
   - Check URL generation

2. **Inline Editing Issues**
   - Verify focus management
   - Check event handlers
   - Test input validation
   - Monitor state updates

3. **Calculation Errors**
   - Verify mathematical operations
   - Check floating-point precision
   - Test with various amounts
   - Monitor real-time updates

4. **Display Issues**
   - Check CSS for color coding
   - Verify text formatting
   - Test with various screen sizes
   - Check responsive behavior

### Success Metrics
- Navigation completes under 500ms
- Inline edits save under 200ms
- Calculations update instantly
- Zero display errors
- All color coding accurate

### Performance Considerations
- Monitor memory usage with many envelopes
- Check render performance with rapid changes
- Verify no unnecessary re-renders
- Test with slow network connections
- Ensure smooth scrolling with long lists
