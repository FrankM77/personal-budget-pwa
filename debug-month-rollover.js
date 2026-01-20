// Diagnostic script to check month rollover issues
// Run this in browser console when on the envelope list view

(async () => {
  console.log('🔍 Diagnosing month rollover issue...');
  
  const budgetStore = useBudgetStore.getState();
  
  // Check all months we have data for
  const months = Object.keys(budgetStore.allocations).sort();
  console.log('📅 Available months with allocations:', months);
  
  // Check February data (what we're copying FROM)
  const febIncome = budgetStore.incomeSources['2026-02'] || [];
  const febAllocations = budgetStore.allocations['2026-02'] || [];
  
  console.log('📊 February data (source):', {
    incomeSources: febIncome.length,
    allocations: febAllocations.length,
    totalIncome: febIncome.reduce((sum, s) => sum + s.amount, 0),
    totalAllocated: febAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0),
    incomeDetails: febIncome.map(s => ({ name: s.name, amount: s.amount })),
    allocationDetails: febAllocations.map(a => ({ 
      envelopeId: a.envelopeId, 
      amount: a.budgetedAmount,
      envelopeName: budgetStore.envelopes.find(e => e.id === a.envelopeId)?.name || 'Unknown'
    }))
  });
  
  // Check March data (what we're copying TO)
  const marIncome = budgetStore.incomeSources['2026-03'] || [];
  const marAllocations = budgetStore.allocations['2026-03'] || [];
  
  console.log('📊 March data (target):', {
    incomeSources: marIncome.length,
    allocations: marAllocations.length,
    totalIncome: marIncome.reduce((sum, s) => sum + s.amount, 0),
    totalAllocated: marAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)
  });
  
  // Test the actual copy operation
  console.log('🧪 Testing Feb→Mar copy...');
  try {
    await budgetStore.copyPreviousMonthAllocations('2026-03');
    console.log('✅ Copy completed');
    
    // Check March again
    const newMarIncome = budgetStore.incomeSources['2026-03'] || [];
    const newMarAllocations = budgetStore.allocations['2026-03'] || [];
    
    console.log('📊 March data after copy:', {
      incomeSources: newMarIncome.length,
      allocations: newMarAllocations.length,
      totalIncome: newMarIncome.reduce((sum, s) => sum + s.amount, 0),
      totalAllocated: newMarAllocations.reduce((sum, a) => sum + a.budgetedAmount, 0)
    });
    
    // Compare what was copied
    console.log('🔄 Comparison:', {
      incomeCopied: newMarIncome.length > 0,
      allocationsCopied: newMarAllocations.length > 0,
      incomeMatch: newMarIncome.length === febIncome.length,
      allocationMatch: newMarAllocations.length === febAllocations.length
    });
    
  } catch (error) {
    console.error('❌ Copy failed:', error);
  }
  
  // Check piggybank status
  const piggybanks = budgetStore.envelopes.filter(e => e.isPiggybank);
  console.log('🐷 Piggybank status:', piggybanks.map(p => ({
    name: p.name,
    contribution: p.piggybankConfig?.monthlyContribution,
    paused: p.piggybankConfig?.paused,
    hasFebAllocation: febAllocations.some(a => a.envelopeId === p.id),
    hasMarAllocation: marAllocations.some(a => a.envelopeId === p.id)
  })));
})();
