Based on the "Thirty-Thousand-Foot View" document and the work we just completed in the previous session, here is the audit of what has been accomplished and, more importantly, what is **still uncompleted**.

### **Current Status: Ahead of Schedule**

According to the **Status Log**, **Phase 1 (Low-Hanging Fruit)** is marked as **Complete**.

However, based on our recent "Great Refactor" session, you have effectively completed **Phase 2.1 (Merge Stores)** as well, which is listed as "Structural Changes" in the roadmap. The document is now slightly outdated because you have already consolidated envelopeStore and monthlyBudgetStore into a single BudgetStore.

### ---

**What We Have Missed / Uncompleted Tasks**

While the app is stable and unified, we have not yet fully achieved the **"Greenfield Ideal Architecture"** described in Section 1\. Here are the specific gaps:

#### **1\. The Offline Strategy (Phase 2.3 \- Complete)**

* **The Plan:** The roadmap calls for **replacing manual sync logic** with "Firebase's Built-in Persistence". The goal was to remove the custom sync queue and let enableIndexedDbPersistence handle it.  
* **The Reality:** We have successfully removed the "blocking" logic from `envelopeStoreRealtime.ts` and the manual "sync pending" states from `budgetStore.ts`. The app now relies entirely on Firestore's `enableIndexedDbPersistence` and `onSnapshot` listeners to handle offline/online transitions seamlessly.
* **Status:** **Complete.** The custom "Nervous System" has been dismantled. We also standardized data access to use the Collection-based pattern (in `BudgetService`), reverting a partial implementation of Embedded Allocations (Phase 3.1) to ensure consistency between Reads and Writes while offline.

#### **2\. The Repository Pattern (Phase 2.2 \- Partial)**

* **The Plan:** The doc describes a strict **Repository Pattern** (e.g., TransactionRepository) that wraps all Firebase operations so that "No Firebase imports \[exist\] in stores".  
* **The Reality:** You are using BudgetService. While this centralizes logic, it likely still contains a mix of business logic and data fetching, rather than being a pure repository layer.  
* **Status:** **Acceptable / Partial.** This is less critical now that the stores are merged, but strict adherence would require further refactoring of BudgetService.

#### **3\. Data Migration (Phase 3 \- Not Started)**

This is the biggest remaining chunk of work. We fixed the *code*, but we haven't touched the *database structure*.

* **3.1 Embed Allocations:** The roadmap suggests moving allocations from a subcollection to an **embedded map** inside the budgets/{month} document to reduce reads.  
  * *Current State:* Still fetching separate collections.  
* **3.2 Normalize Amount Types:** The roadmap wants to convert all string amounts in Firestore to numbers (amount: parseFloat(tx.amount)).  
  * *Current State:* We added *mappers* in the code to handle the strings, but the database still contains strings.  
* **3.3 Add Month Field:** The roadmap suggests adding a month field to all transactions for efficient queries.  
  * *Current State:* Queries likely still rely on date range filtering.

### ---

**Updated Roadmap Recommendation**

Since the "Emergency Repair" is done, you can now decide if you want to pursue the **"Ideal Architecture"** or stop here.

| Task | Priority | Risk | Benefit |
| :---- | :---- | :---- | :---- |
| **Normalize DB Types (Phase 3.2)** | High | Low | Removes the need for complex "Mappers" in your code; faster math. |
| **Embed Allocations (Phase 3.1)** | Medium | High | Drastically reduces Firebase reads (costs) and speeds up load times. |
| **Native Offline Mode (Phase 2.3)** | Done | Done | **Completed.** Manual sync logic removed. |

**Verdict:** You haven't "missed" anything critical for *stability*, but you have uncompleted tasks regarding **Database Optimization** (Phase 3).