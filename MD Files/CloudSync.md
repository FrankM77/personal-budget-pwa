# CloudSync.md: Phase 2 Architecture & Next Steps

## 1. Phase 1 Status & Key Findings

| Area | Status | Notes |
| :--- | :--- | :--- |
| **PWA Feature Parity** | **🟢 COMPLETE** | UI gestures, Undo system, Template logic, and CSV Export are all functional. |
| **Code Architecture** | **🟢 CLEAN** | Project restructuring (Views vs. Components, consolidated Stores) is complete and committed to Git. |
| **Cloud Sync Status** | **Net-New Feature** | Cloud Synchronization is a **new capability** being added to the PWA, as the original Swift app was local-only. |

---

## 2. Firebase Schema Design: Core Proposal

The goal is to design a resilient Firestore schema based on the imported Swift data models, ensuring integrity and efficiency for real-time sync.

### A. Envelope Model Analysis

The `Envelope.swift` model established the basic fields and highlighted a critical constraint:

| Swift Field | Swift Type | Critical Constraint | PWA/Firestore Type |
| :--- | :--- | :--- | :--- |
| `currentBalance` | `Double` | **Financial Accuracy** | **String** (to be used with `decimal.js` locally to prevent floating-point errors). |
| `lastUpdated` | `Date` | Sync Conflict Resolution | **Timestamp** (Firestore Native Type). |
| `id` | `UUID` | Primary Key | **Document ID (String)**. |

### B. Immediate Architectural Requirement (Critical Path)

The Firebase database design is currently blocked by missing relationship details.

* **Blocking Information:** The exact structure and relationships defined in the **`Transaction`** and **`DistributionTemplate`** models.
* **Why it's needed:** We cannot decide the optimal location (root collection or sub-collection) for Transactions until we see the model definition and know the intended data relationships (e.g., how foreign keys are handled).

---

## 3. Next Action Item

When you return, we need the blueprint for the related objects.

**Action:** Please provide the Swift code content for your **`Transaction`** and **`DistributionTemplate`** data models.