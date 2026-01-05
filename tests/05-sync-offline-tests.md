# Test Category 5: Sync and Offline Tests

## ELV-015: Online Sync Status
**Objective**: Verify sync status indicators and online functionality

### Prerequisites
- Stable internet connection
- Account with existing data
- Dev tools network tab open

### Test Steps

1. **Initial Online Status**
   - Load envelope list view
   - Verify sync status shows "Online" in green
   - Check Wifi icon is displayed
   - Confirm no "Sync" button is visible (no pending changes)

2. **Sync During Data Operations**
   - Add a new income source
   - Watch sync status change to "Syncing..."
   - Verify spinner animation on refresh icon
   - Confirm status returns to "Online" after completion
   - Check no sync button appears after successful sync

3. **Manual Sync Button**
   - Make changes while offline (next test)
   - Return online
   - Verify "Sync" button appears in orange
   - Click the sync button
   - Verify manual sync completes successfully
   - Confirm button disappears after sync

4. **Sync Status During Loading**
   - Clear browser cache
   - Reload page with network throttling
   - Verify "Syncing..." shows during initial data load
   - Check status transitions correctly as data loads
   - Confirm final status is "Online"

5. **Multiple Operations Sync**
   - Add income source
   - Edit envelope budget
   - Delete another income source
   - Verify all operations sync automatically
   - Check no pending sync remains
   - Confirm status returns to "Online"

### Expected Results
✅ "Online" status shows when connected and synced  
✅ "Syncing..." appears during data operations  
✅ Manual sync button appears only when needed  
✅ Status transitions are smooth and accurate  
✅ All operations sync automatically when online  

### Pass/Fail Criteria
- **PASS**: All sync states work correctly, status accurate
- **FAIL**: Wrong status indicators, sync failures, UI issues

---

## ELV-016: Offline Functionality
**Objective**: Verify app works correctly when offline

### Prerequisites
- Ability to disconnect network
- Account with existing data
- Service worker installed

### Test Steps

1. **Go Offline**
   - Open dev tools network tab
   - Select "Offline" mode
   - Verify sync status changes to "Offline"
   - Check WifiOff icon displays
   - Confirm app remains functional

2. **Offline Data Operations**
   - Add new income source "Offline Test" - $1000
   - Edit existing envelope budget
   - Delete an income source
   - Verify all changes appear immediately in UI
   - Check Available to Budget updates correctly

3. **Offline Navigation**
   - Navigate to envelope detail view
   - Navigate to transaction history
   - Navigate back to envelope list
   - Verify all navigation works offline
   - Check data persists across views

4. **Offline Data Persistence**
   - Make several changes while offline
   - Refresh the page (still offline)
   - Verify all changes are preserved
   - Check data loads from local storage
   - Confirm no data loss

5. **Return Online**
   - Switch network back to "Online"
   - Verify sync status changes to "Online"
   - Check "Sync" button appears (pending changes)
   - Click sync button or wait for auto-sync
   - Verify all offline changes sync to server

6. **Sync Conflict Resolution**
   - Make changes offline
   - Make conflicting changes online (different device)
   - Return online and sync
   - Verify conflict handling works
   - Check data integrity is maintained

### Expected Results
✅ "Offline" status shows when disconnected  
✅ All CRUD operations work offline  
✅ Data persists across page refreshes  
✅ Navigation works completely offline  
✅ Changes sync when returning online  
✅ Conflicts handled appropriately  

### Pass/Fail Criteria
- **PASS**: Full offline functionality, data persistence, sync works
- **FAIL**: App breaks offline, data loss, sync failures

---

## ELV-017: Poor Connectivity Handling
**Objective**: Verify app handles slow/unstable connections gracefully

### Prerequisites
- Network throttling capabilities
- Ability to simulate connection drops
- Test account with data

### Test Steps

1. **Slow Connection Test**
   - Set network throttling to "Slow 3G"
   - Add income source
   - Verify UI remains responsive during slow sync
   - Check loading indicators provide feedback
   - Confirm operation completes eventually

2. **Intermittent Connection**
   - Set network to "Online" with packet loss
   - Make rapid data changes
   - Verify app handles connection drops
   - Check retry mechanisms work
   - Confirm no data corruption occurs

3. **Connection During Operation**
   - Start adding income source online
   - Disconnect network mid-operation
   - Reconnect network
   - Verify operation completes or fails gracefully
   - Check data integrity maintained

4. **Timeout Scenarios**
   - Set very slow network speed
   - Make large data changes
   - Verify timeout handling works
   - Check error messages are helpful
   - Confirm app doesn't hang indefinitely

5. **Concurrent Operations**
   - Start multiple operations simultaneously
   - Simulate connection issues
   - Verify operation queuing works
   - Check no data loss or corruption
   - Confirm all operations complete eventually

6. **Large Data Sync**
   - Create many transactions/envelopes
   - Go offline and make changes
   - Return online with slow connection
   - Verify large dataset syncs properly
   - Check progress indicators if available

### Expected Results
✅ App remains responsive during slow sync  
✅ Intermittent connections handled gracefully  
✅ Operations complete or fail cleanly  
✅ Timeouts handled appropriately  
✅ Concurrent operations don't cause corruption  
✅ Large datasets sync successfully  

### Pass/Fail Criteria
- **PASS**: Poor connectivity handled well, no data loss
- **FAIL**: App hangs, data corruption, poor error handling

---

## ELV-018: Sync Data Integrity
**Objective**: Verify data integrity during sync operations

### Prerequisites
- Multiple test scenarios
- Ability to monitor data states
- Test account with various data types

### Test Steps

1. **Basic Data Integrity**
   - Note current state of all data
   - Add income source and envelope
   - Sync and verify data matches
   - Edit and delete items
   - Confirm all changes persist correctly

2. **Partial Sync Recovery**
   - Make multiple changes
   - Interrupt sync process
   - Return online
   - Verify partial sync completes
   - Check no data duplication or loss

3. **Cross-Device Sync**
   - Make changes on device A
   - Sync to server
   - Load on device B
   - Verify all changes present
   - Make changes on device B
   - Sync back to device A
   - Confirm bidirectional sync works

4. **Data Type Sync**
   - Test all data types: income, envelopes, transactions
   - Verify special characters sync correctly
   - Test large numbers and decimals
   - Check date/time fields sync properly
   - Confirm all data types maintain integrity

5. **Sync Order Dependencies**
   - Create related data (envelope then transaction)
   - Verify sync order doesn't break relationships
   - Test deletion dependencies
   - Check referential integrity maintained
   - Confirm no orphaned data

### Expected Results
✅ All data types sync correctly  
✅ No data loss or corruption during sync  
✅ Cross-device sync works bidirectionally  
✅ Data relationships maintained  
✅ Sync order doesn't break integrity  

### Pass/Fail Criteria
- **PASS**: All data maintains integrity through sync operations
- **FAIL**: Data loss, corruption, relationship breaks

---

## Test Environment Setup for Sync Tests

### Network Simulation Setup

1. **Chrome Dev Tools**:
   - Network tab → Throttling → Presets
   - Test: Offline, Slow 3G, Fast 3G, Online

2. **Connection Scenarios**:
   - Stable broadband
   - Mobile 3G/4G
   - Intermittent WiFi
   - Complete offline

3. **Service Worker Testing**:
   - Application tab → Service Workers
   - Verify service worker is active
   - Test offline functionality
   - Check cache storage

### Test Data Preparation

1. **Baseline Data**:
   - 3-5 income sources
   - 5-10 envelopes with budgets
   - Various transactions
   - Mixed positive/negative balances

2. **Test Scenarios**:
   - Small datasets (quick sync)
   - Large datasets (stress test)
   - Complex relationships
   - Edge case data

### Test Execution Checklist

For each test:
- [ ] Note starting network status
- [ ] Document data state before test
- [ ] Monitor console for errors
- [ ] Watch network requests
- [ ] Verify UI updates
- [ ] Check final data integrity

### Common Issues and Solutions

1. **Service Worker Issues**
   - Verify service worker registration
   - Check cache storage
   - Test offline functionality
   - Monitor for SW errors

2. **Sync Failures**
   - Check network connectivity
   - Verify authentication tokens
   - Monitor server responses
   - Check error handling

3. **Data Corruption**
   - Verify data validation
   - Check conflict resolution
   - Test concurrent operations
   - Monitor data integrity

4. **Performance Issues**
   - Monitor memory usage
   - Check for memory leaks
   - Optimize sync operations
   - Test with large datasets

### Success Metrics
- Sync completes within 5 seconds on good connection
- Offline operations complete under 200ms
- No data loss during sync interruptions
- Service worker caches correctly
- Cross-device sync works within 10 seconds

### Monitoring and Debugging

1. **Console Monitoring**:
   - Watch for sync-related logs
   - Check for error messages
   - Monitor performance warnings

2. **Network Tab**:
   - Watch API requests
   - Check response times
   - Verify retry attempts

3. **Application Tab**:
   - Monitor service worker status
   - Check cache storage
   - Verify local database

4. **Performance Tab**:
   - Monitor memory usage
   - Check for leaks
   - Analyze render performance

### Regression Tests

After sync fixes:
- [ ] Test ELV-015 (Online Sync)
- [ ] Test ELV-016 (Offline Functionality)
- [ ] Test ELV-017 (Poor Connectivity)
- [ ] Test ELV-018 (Data Integrity)
- [ ] Verify previous sync bugs are fixed
- [ ] Test edge cases thoroughly
