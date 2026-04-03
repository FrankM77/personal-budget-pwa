# Urgent Fixes - Security & Performance Issues

**Date:** April 2, 2026
**Priority Level:** HIGH
**Total Estimated Time:** 60-90 minutes
**Impact:** Security hardening, cost optimization, code quality

---

## Overview

Critical issues that should be addressed before next feature work. Categorized by severity and effort.

---

## 🟢 LOW PRIORITY (Security/Polish)

### 1. Siri Integration: No Input Sanitization
**Severity:** LOW (Single User Environment)
**Resolution:** Since the app is currently for a single user, the risk of malicious prompt injection is negligible. Functional reliability is handled by the "Wait for Data" fix in v1.17.11.

---

## 🟠 HIGH PRIORITY (Performance/Cost)

### 2. Inefficient Deleted Transactions Query (BUG-2)
**Status:** ✅ COMPLETED (v1.17.10)
**Resolution:** Instead of optimizing the query, the entire soft-delete system was removed. The app now uses hard-deletes combined with a copy-and-reinsert UI "Undo" pattern. This eliminates all "God-fetches" and Firestore read costs associated with soft-deleted items.

---

## 🟡 MEDIUM PRIORITY (Quality)

### 3. Pinned Gemini Model Version
**Severity:** MEDIUM (Stability Risk)
**File:** `functions/src/index.ts`
**Issue:** Cloud Function uses unpinned Gemini model (auto-updates)
**Risk:** Model updates could change:
- Parsing behavior for transaction requests
- Natural language understanding
- Output format

**Current:** `"gemini-2.0-flash"` (latest version)
**Should Be:** `"gemini-2.0-flash-001"` (specific version)

**Fix:**
```typescript
// BEFORE
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

// AFTER
const model = genai.getGenerativeModel({ model: "gemini-2.0-flash-001" });
```

**Effort:** 2-3 minutes
**Verification:**
```bash
# Check Google Cloud documentation for available versions
# Update to latest stable version number
# Deploy and test Siri integration still works
```

**Reference:** https://cloud.google.com/vertex-ai/docs/reference/rest/v1/models/list

---

## 🟡 MEDIUM PRIORITY (Code Quality)

### 4. useSiriQuery Dependency Array
**Status:** ✅ COMPLETED (v1.17.11)
**Resolution:** Completely refactored `useSiriQuery` hook to implement "Wait for Data" logic. It now correctly includes all dependencies and uses a `processedQueryRef` to prevent race conditions and duplicate parsing during app initialization.

---

## 🟡 MEDIUM PRIORITY (UX/Polish)

### 5. Replace alert() with Toast Notifications
**Status:** ✅ COMPLETED (v1.17.12)
**Resolution:** Replaced all native browser `alert()` calls with the app's internal Toast system across `AddTransactionView`, `PiggybankModal`, `TransactionModal`, `CardStack`, and `TransactionHistoryView`.

---

## 🟢 LOW PRIORITY (Polish)

### 6. PWA Icon Configuration
**Severity:** LOW (Device Compatibility)
**File:** `vite.config.ts` - PWA config
**Issue:** Icon purposes not properly separated
**Current:** `'any maskable'` should be separate entries

**Fix:** Separate icon definitions by purpose for better device compatibility

**Effort:** 5 minutes

---

### 7. Remove Hardcoded Deploy Timestamp
**Severity:** LOW (Maintenance)
**File:** `index.html` line 25
**Issue:** Manual maintenance overhead for deployment timestamp comment

**Fix:** Remove or use automated timestamp injection if needed

**Effort:** 2 minutes

---

### 8. Add PWA Home Screen Shortcuts
**Severity:** LOW (Enhancement)
**File:** `vite.config.ts`
**Issue:** No quick action shortcuts configured
**Enhancement:** Add "Add Transaction" shortcut to home screen menu

**Effort:** 10 minutes
**Impact:** Faster access to common features from home screen

---

## Implementation Priority Order

### Batch 1 - Security (20 minutes)
- [ ] #1 - Siri Input Sanitization

### Batch 2 - Cost/Performance (15 minutes)
- [ ] #2 - Deleted Transactions Query Fix
- [ ] #3 - Pin Gemini Model Version

### Batch 3 - Quality (15 minutes)
- [ ] #4 - useSiriQuery Dependencies
- [ ] #5 - Replace alert() with Toast

### Batch 4 - Polish (20 minutes)
- [ ] #6 - PWA Icon Configuration
- [ ] #7 - Remove Deploy Timestamp
- [ ] #8 - Add PWA Shortcuts

---

## Testing Checklist

After implementing all fixes:
- [ ] No React warnings in console
- [ ] No TypeScript errors: `npm run build`
- [ ] Siri integration still works with injected prompts
- [ ] Email verification uses toast
- [ ] PWA shortcuts appear on home screen
- [ ] No regressions in authentication flow
- [ ] All modified code lints: `npm run lint`

---

## Blocking Dependencies

None - all fixes are independent and can be done in any order.

---

## Success Metrics

✅ All 8 items completed
✅ Build succeeds with no errors
✅ Zero React/TypeScript warnings
✅ Siri integration secure against prompt injection
✅ Firestore reads optimized
✅ PWA more polished with shortcuts

---

*Estimate: 60-90 minutes total for all 8 fixes*
*Recommended: Batch 1-3 (critical), Batch 4 (nice to have)*
