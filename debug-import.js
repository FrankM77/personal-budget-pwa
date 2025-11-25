// Debug script to test import functionality
const { parseDate } = require('./src/store/envelopeStore.ts');

// Test with the test data
const testData = {
  envelopes: [
    {
      id: "env-1",
      name: "Groceries", 
      currentBalance: 150.50,
      lastUpdated: 1728000000,
      isActive: true,
      orderIndex: 0
    }
  ],
  transactions: [
    {
      id: "tx-1",
      date: 1727000000,
      amount: 50.25,
      description: "Weekly groceries",
      envelopeId: "env-1",
      reconciled: false,
      type: "Expense"
    }
  ]
};

console.log("Original transaction date:", testData.transactions[0].date);
console.log("Parsed date:", parseDate(testData.transactions[0].date));
console.log("Parsed date type:", typeof parseDate(testData.transactions[0].date));
