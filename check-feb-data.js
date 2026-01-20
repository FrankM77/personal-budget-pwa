// Check what's actually in February data
// Find the store in the React component tree
const store = document.querySelector('#root')?._reactRootContainer?._internalRoot?.current?.child?.memoizedState?.memoizedState?.next?.memoizedState?.memoizedState?.store || 
             window.useBudgetStore?.getState() || 
             (typeof useBudgetStore !== 'undefined' ? useBudgetStore.getState() : null);

if (!store) {
  console.error('❌ Store not found. Try this instead:');
  console.log('Direct access: useBudgetStore.getState()');
} else {

console.log('🔍 Current month:', store.currentMonth);
console.log('📊 All months with allocations:', Object.keys(store.allocations));
console.log('💰 All months with income:', Object.keys(store.incomeSources));

// Check February specifically
const febIncome = store.incomeSources['2026-02'] || [];
const febAllocations = store.allocations['2026-02'] || [];

console.log('📋 February details:', {
  incomeCount: febIncome.length,
  allocationCount: febAllocations.length,
  incomeDetails: febIncome.map(s => ({ name: s.name, amount: s.amount })),
  allocationDetails: febAllocations.map(a => ({ 
    envelopeId: a.envelopeId, 
    amount: a.budgetedAmount,
    envelopeName: store.envelopes.find(e => e.id === a.envelopeId)?.name || 'Unknown'
  }))
});

// Test the copy function manually
console.log('🧪 Testing manual copy to March...');
try {
  store.copyPreviousMonthAllocations('2026-03');
  console.log('✅ Copy function completed');
  
  // Check March after copy
  const marIncome = store.incomeSources['2026-03'] || [];
  const marAllocations = store.allocations['2026-03'] || [];
  
  console.log('📊 March after copy:', {
    incomeCount: marIncome.length,
    allocationCount: marAllocations.length,
    totalIncome: marIncome.reduce((sum, s) => sum + s.amount, 0),
    totalAllocated: marAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)
  });
} catch (error) {
  console.error('❌ Copy failed:', error);
}
}
