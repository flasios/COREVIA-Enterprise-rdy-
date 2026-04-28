const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('/tmp/report.json', 'utf8'));
const d = raw.data || raw;
const bc = d.businessCase || d.report?.businessCase || {};
const cfm = bc.computedFinancialModel;
if (cfm === undefined) { console.log('no cfm, bc keys:', Object.keys(bc)); process.exit(); }

console.log('=== COSTS ===');
const costs = cfm.costs || [];
costs.forEach(c => {
  const t = c.year0 + c.year1 + c.year2 + c.year3 + c.year4 + c.year5;
  console.log(`  ${t.toLocaleString().padStart(12)} | ${c.name} | y0=${c.year0} y1=${c.year1} y2=${c.year2}`);
});
console.log(`  Items: ${costs.length}, Sum: ${costs.reduce((s,c)=>s+c.year0+c.year1+c.year2+c.year3+c.year4+c.year5,0).toLocaleString()}`);

console.log('\n=== BENEFITS ===');
const bens = cfm.benefits || [];
bens.forEach(b => {
  const t = b.year1 + b.year2 + b.year3 + b.year4 + b.year5;
  console.log(`  ${t.toLocaleString().padStart(12)} | ${b.name} | y1=${b.year1} y2=${b.year2}`);
});
console.log(`  Items: ${bens.length}, Sum: ${bens.reduce((s,b)=>s+b.year1+b.year2+b.year3+b.year4+b.year5,0).toLocaleString()}`);

console.log('\n=== CASH FLOWS ===');
(cfm.cashFlows || []).forEach(f => {
  console.log(`  Y${f.year} | Benefits=${f.benefits?.toLocaleString()} Costs=${f.costs?.toLocaleString()} Net=${f.netCashFlow?.toLocaleString()} Cumul=${f.cumulativeCashFlow?.toLocaleString()}`);
});

console.log('\n=== METRICS ===');
const m = cfm.metrics || {};
console.log(`  totalCosts=${m.totalCosts} totalBenefits=${m.totalBenefits} npv=${m.npv} roi=${m.roi5Year}`);
