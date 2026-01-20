// Enhanced debug script to verify complete monthly copying
// Run this in browser console when on the envelope list view

(async () => {
  console.log('🧪 Testing complete monthly copy...');
  
  // Get current state
  const budgetStore = useBudgetStore.getState();
  const currentMonth = '2026-02'; // Change to your test month
  const prevMonth = '2026-01';   // Previous month to copy from
  
  // Check what we have in previous month
  const previousIncomeSources = budgetStore.incomeSources[prevMonth] || [];
  const previousAllocations = budgetStore.allocations[prevMonth] || [];
  const piggybanks = budgetStore.envelopes.filter(e => e.isPiggybank);
  
  console.log('📊 Previous month data:', {
    incomeSources: previousIncomeSources.length,
    allocations: previousAllocations.length,
    piggybanks: piggybanks.length,
    totalIncome: previousIncomeSources.reduce((sum, s) => sum + s.amount, 0),
    totalAllocated: previousAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)
  });
  
  console.log('🐷 Found piggybanks:', piggybanks.map(p => ({
    name: p.name,
    contribution: p.piggybankConfig?.monthlyContribution,
    paused: p.piggybankConfig?.paused
  })));
  
  // Test the enhanced copy function
  try {
    await budgetStore.copyPreviousMonthAllocations(currentMonth);
    console.log('✅ Copy completed successfully');
    
    // Check results
    const newIncomeSources = budgetStore.incomeSources[currentMonth] || [];
    const newAllocations = budgetStore.allocations[currentMonth] || [];
    const piggybankAllocations = newAllocations.filter(alloc => 
      piggybanks.some(p => p.id === alloc.envelopeId)
    );
    
    console.log('📊 Results:', {
      incomeSources: {
        copied: newIncomeSources.length,
        total: newIncomeSources.reduce((sum, s) => sum + s.amount, 0)
      },
      allocations: {
        total: newAllocations.length,
        totalAllocated: newAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0),
        piggybankAllocations: piggybankAllocations.length,
        piggybankTotal: piggybankAllocations.reduce((sum, alloc) => sum + alloc.budgetedAmount, 0)
      }
    });
    
    // Verify available to budget calculation
    const totalIncome = newIncomeSources.reduce((sum, s) => sum + s.amount, 0);
    const totalAllocated = newAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0);
    const available = totalIncome - totalAllocated;
    
    console.log('💰 Budget summary:', {
      totalIncome,
      totalAllocated,
      available,
      isBalanced: Math.abs(available) < 0.01
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
})();
