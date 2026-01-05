# Test Category 3: Income Source Management Tests

## ELV-007: Add Income Source
**Objective**: Verify adding new income sources works correctly

### Prerequisites
- User logged in with appropriate permissions
- Current month selected
- Stable internet connection

### Test Steps

1. **Open Add Income Modal**
   - Click the "+" button in the Income Sources section
   - Verify modal opens with "Add Income Source" title
   - Check form fields are empty and ready for input
   - Verify modal overlay and close button work

2. **Fill Valid Income Data**
   - Enter "Test Salary" in the name field
   - Enter "5000" in the amount field
   - Leave frequency as default (monthly)
   - Optionally add category "Employment"
   - Click "Save" or "Add Income Source" button

3. **Verify Successful Addition**
   - Confirm modal closes after successful save
   - Check new income source appears in the list
   - Verify name displays as "Test Salary"
   - Confirm amount shows as "$5,000.00"
   - Check Available to Budget increases by $5,000

4. **Test Form Validation**
   - Reopen add income modal
   - Try to save with empty name field
   - Verify validation error appears
   - Try to save with empty amount field
   - Verify validation error appears
   - Try to save with negative amount
   - Verify validation error or rejection

5. **Test Special Characters**
   - Add income with name: "Freelance @ Company"
   - Add income with name: "Part-Time Job (Weekends)"
   - Verify special characters display correctly
   - Check no rendering issues occur

### Expected Results
✅ Modal opens and closes correctly  
✅ Form validation prevents invalid submissions  
✅ New income source appears immediately in list  
✅ Available to Budget updates in real-time  
✅ Special characters in names handled properly  
✅ Success toast notification appears  

### Pass/Fail Criteria
- **PASS**: Income sources add correctly, validation works, UI updates
- **FAIL**: Broken modal, validation bypassed, data not saved, UI not updating

---

## ELV-008: Edit Income Source
**Objective**: Verify editing existing income sources works correctly

### Prerequisites
- Account with existing income sources
- At least 2-3 income sources for testing

### Test Steps

1. **Open Edit Modal**
   - Click on an existing income source in the list
   - Verify modal opens with "Edit Income Source" title
   - Check current data is pre-filled in form
   - Verify name and amount match the selected source

2. **Modify Income Source Data**
   - Change the name from "Test Salary" to "Updated Salary"
   - Change amount from "5000" to "5500"
   - Modify category if applicable
   - Click "Save" or "Update" button

3. **Verify Successful Update**
   - Confirm modal closes after successful update
   - Check income source shows updated name "Updated Salary"
   - Verify amount displays as "$5,500.00"
   - Confirm Available to Budget reflects new amount ($500 increase)
   - Check toast notification shows success message

4. **Test Edit Validation**
   - Open edit modal for another income source
   - Clear the name field and try to save
   - Verify validation error prevents empty name
   - Set amount to negative value and try to save
   - Verify validation error or rejection

5. **Test Cancel Edit**
   - Open edit modal and make changes
   - Click "Cancel" button or close modal
   - Verify original data remains unchanged
   - Check no toast notification appears
   - Confirm Available to Budget unchanged

### Expected Results
✅ Edit modal opens with correct pre-filled data  
✅ Changes save and update correctly  
✅ Available to Budget recalculates immediately  
✅ Validation works during editing  
✅ Cancel preserves original data  
✅ Toast notifications provide appropriate feedback  

### Pass/Fail Criteria
- **PASS**: All edits work correctly, validation functions, UI updates
- **FAIL**: Edit fails, data corruption, validation bypassed, UI not updating

---

## ELV-009: Delete Income Source
**Objective**: Verify deleting income sources works correctly with undo functionality

### Prerequisites
- Account with multiple income sources
- At least 3 income sources for testing deletion

### Test Steps

1. **Perform Swipe Delete**
   - Swipe left on an income source item
   - Verify delete action appears (red background, delete icon)
   - Release swipe to trigger deletion
   - Confirm income source disappears from list immediately

2. **Verify Immediate Effects**
   - Check income source is removed from UI
   - Verify Available to Budget decreases by deleted amount
   - Confirm toast notification appears with undo option
   - Note the toast message: "Deleted '[Income Name]'"

3. **Test Undo Functionality**
   - Quickly click "Undo" in the toast notification
   - Verify income source reappears in list
   - Check Available to Budget returns to previous amount
   - Confirm income source is in original position

4. **Test Permanent Deletion**
   - Delete another income source
   - Wait for toast notification to disappear (30 seconds)
   - Try to undo after timeout
   - Verify undo is no longer available
   - Confirm deletion is permanent

5. **Test Multiple Rapid Deletes**
   - Quickly delete 2-3 income sources
   - Verify each deletion works independently
   - Check Available to Budget updates for each
   - Test undo for each deletion
   - Verify no conflicts or errors occur

### Expected Results
✅ Swipe gesture triggers deletion smoothly  
✅ Income source disappears immediately (optimistic update)  
✅ Available to Budget updates in real-time  
✅ Undo functionality works within timeout period  
✅ Permanent deletion after timeout  
✅ Multiple deletions handled without conflicts  

### Pass/Fail Criteria
- **PASS**: Delete works correctly, undo functions, UI updates properly
- **FAIL**: Delete fails, undo broken, data corruption, UI issues

---

## ELV-010: Income Source Edge Cases
**Objective**: Test edge cases and special scenarios for income sources

### Prerequisites
- Account with existing data
- Ability to test various edge cases

### Test Steps

1. **Zero Amount Income**
   - Add income source with $0.00 amount
   - Verify it saves and displays correctly
   - Check Available to Budget doesn't change
   - Test editing to non-zero amount
   - Test deletion of zero amount income

2. **Very Large Amounts**
   - Add income source with $1,000,000
   - Verify formatting displays correctly ($1,000,000.00)
   - Check Available to Budget handles large numbers
   - Test with even larger amounts if needed
   - Verify no overflow or display issues

3. **Decimal Amounts**
   - Add income with decimal amount: $1234.56
   - Add income with .99 cents: $999.99
   - Verify decimal precision is maintained
   - Check rounding works correctly
   - Test calculations with decimal amounts

4. **Special Characters in Names**
   - Add income: "Company @ Corp"
   - Add income: "Job #1 (Main)"
   - Add income: "Freelance/Consulting"
   - Add income with emojis if supported
   - Verify all display correctly without breaking UI

5. **Very Long Names**
   - Add income with very long name (50+ characters)
   - Verify text truncation or wrapping works
   - Check UI layout remains intact
   - Test editing long names

6. **Rapid Operations**
   - Quickly add, edit, delete multiple income sources
   - Try to break the app with rapid operations
   - Verify no data corruption occurs
   - Check all operations complete successfully

7. **Network Issues During Operations**
   - Start adding income source
   - Disconnect network during save
   - Reconnect network
   - Verify operation completes or fails gracefully
   - Check data integrity

### Expected Results
✅ Zero amounts handled correctly  
✅ Large numbers formatted and calculated properly  
✅ Decimal precision maintained  
✅ Special characters display without issues  
✅ Long names handled gracefully  
✅ Rapid operations don't cause corruption  
✅ Network issues handled gracefully  

### Pass/Fail Criteria
- **PASS**: All edge cases handled without errors or data corruption
- **FAIL**: App breaks, data corruption, display issues, calculation errors

---

## Test Data Setup for Income Source Tests

### Sample Income Sources for Testing

1. **Primary Income**: "Main Salary" - $5000.00
2. **Secondary Income**: "Part-Time Job" - $800.00  
3. **Investment**: "Dividend Income" - $250.00
4. **Freelance**: "Consulting Work" - $1200.00
5. **Bonus**: "Quarterly Bonus" - $1500.00

### Test Environment Preparation

Before testing:
- [ ] Clear browser cache
- [ ] Verify user authentication
- [ ] Open dev tools for monitoring
- [ ] Note initial Available to Budget amount
- [ ] Prepare test data spreadsheet for tracking

### Test Execution Checklist

For each test:
- [ ] Document starting Available to Budget
- [ ] Record all income sources before test
- [ ] Follow steps precisely
- [ ] Note Available to Budget changes
- [ ] Capture screenshots of failures
- [ ] Verify final state matches expected

### Common Issues and Solutions

1. **Modal Not Opening**
   - Check click event handlers
   - Verify modal component mounting
   - Test with different browsers
   - Check for JavaScript errors

2. **Save Not Working**
   - Verify form validation
   - Check network requests
   - Test authentication
   - Monitor console for errors

3. **UI Not Updating**
   - Check state management
   - Verify reactive updates
   - Test component re-rendering
   - Check data flow

4. **Delete/Undo Issues**
   - Verify optimistic updates
   - Check undo timeout logic
   - Test state restoration
   - Monitor data consistency

### Success Metrics
- Add/edit operations complete under 1 second
- Delete operations complete under 500ms
- Available to Budget updates immediately
- Zero console errors during operations
- All validation rules enforced correctly

### Regression Tests

After implementing fixes:
- [ ] Test ELV-007 (Add Income)
- [ ] Test ELV-008 (Edit Income)  
- [ ] Test ELV-009 (Delete Income)
- [ ] Test ELV-010 (Edge Cases)
- [ ] Verify income source duplication bug is fixed
- [ ] Test rapid operations don't cause data loss
