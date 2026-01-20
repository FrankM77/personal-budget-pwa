// Quick debug to see what's in February
// Try to get the store from the global scope or window
const budgetStore = window.useBudgetStore?.getState() || 
                   (typeof useBudgetStore !== 'undefined' ? useBudgetStore.getState() : null);

if (!budgetStore) {
  console.error('❌ Could not access budget store. Make sure you\'re on the envelope list page.');
} else {

console.log('📊 All available months:', Object.keys(budgetStore.allocations));

console.log('💰 February income sources:', budgetStore.incomeSources['2026-02']);
console.log('📋 February allocations:', budgetStore.allocations['2026-02']);

console.log('💰 March income sources:', budgetStore.incomeSources['2026-03']);
console.log('📋 March allocations:', budgetStore.allocations['2026-03']);

// Check if February data exists and has content
const febIncome = budgetStore.incomeSources['2026-02'] || [];
const febAllocations = budgetStore.allocations['2026-02'] || [];

console.log('🔍 February data check:', {
  hasIncome: febIncome.length > 0,
  hasAllocations: febAllocations.length > 0,
  incomeCount: febIncome.length,
  allocationCount: febAllocations.length,
  totalIncome: febIncome.reduce((sum, s) => sum + s.amount, 0),
  totalAllocated: febAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)
});
}
