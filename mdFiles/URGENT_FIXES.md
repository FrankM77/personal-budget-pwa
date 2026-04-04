# Urgent Fixes - Security & Performance Issues

---

## 🟢 LOW PRIORITY (Security/Polish)

### 1. Siri Integration: No Input Sanitization
**Severity:** LOW (Single User Environment)
**Resolution:** Since the app is currently for a single user, the risk of malicious prompt injection is negligible. Stability is prioritized over sanitization.

---

## ✅ COMPLETED TASKS

### 2. Inefficient Deleted Transactions Query (BUG-2)
**Status:** ✅ COMPLETED (v1.17.10)
**Resolution:** Removed soft-delete system entirely. Migrated to Hard Delete + UI Undo model.

### 4. useSiriQuery Dependency Array
**Status:** ✅ COMPLETED (v1.17.11)
**Resolution:** Corrected dependency array and added "Wait for Context" logic to prevent blank modals.

### 5. Replace alert() with Toast Notifications
**Status:** ✅ COMPLETED (v1.17.12)
**Resolution:** All native browser alerts replaced with app-styled Toasts.

---

## 🟠 HIGH PRIORITY (Planned)

### 3. Pinned Gemini Model Version
**Status:** PLANNED
**Task:** Pin to `gemini-2.0-flash-001` in Cloud Functions.

### 6. Siri Cold-Start Fix (Hash-Based)
**Status:** PLANNED
**Task:** Bypassing iOS URL stripping by moving from query params to Hash fragments (#siri/...).
