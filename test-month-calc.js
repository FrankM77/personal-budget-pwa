// Test month calculation logic
console.log('🧪 Testing month calculation logic...');

const testMonths = ['2026-02', '2026-03', '2026-01', '2025-12'];

testMonths.forEach(currentMonth => {
  const [year, month] = currentMonth.split('-').map(Number);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevYear = year - 1;
    prevMonth = 12;
  }
  const prevMonthString = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  console.log(`${currentMonth} → ${prevMonthString}`);
});
