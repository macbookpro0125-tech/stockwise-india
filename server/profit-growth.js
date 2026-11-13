// A quarter's net-profit growth on a year earlier, as its results page table
// shows it (/stock/SYMBOL/results/q2-fy27): the same quarter a year earlier
// (fyEnd ~365 days back, within 20 days), net profit against net profit.
//
// The stored quarter.profitYoY (metrics.js) compares the owners' share of
// profit, so for a company with minority holders it can differ from the
// table's net-profit line — 13 Nov 2026: Oil India Q2 FY27 read +61.6% on
// /results (owners' share ₹2,309 cr against ₹1,428.83 cr) while its results
// page said +53.4% (₹2,520.87 cr against ₹1,643.81 cr). Every public place
// uses this so they all agree with the table.
//
// Both profits must be positive for a percentage; otherwise, or when the
// year-ago quarter isn't on file, the stored figure stands.
const DAY = 86400000;

export function yearAgoQuarter(quarters, i = 0) {
  const q = quarters?.[i];
  if (!q?.fyEnd) return null;
  const want = Date.parse(q.fyEnd) - 365 * DAY;
  return quarters.find(x => x?.fyEnd && Math.abs(Date.parse(x.fyEnd) - want) <= 20 * DAY) ?? null;
}

export function profitGrowth(quarters, i = 0) {
  const q = quarters?.[i];
  if (!q) return null;
  const then = yearAgoQuarter(quarters, i);
  if (q.profitCr > 0 && then?.profitCr > 0) return (q.profitCr / then.profitCr - 1) * 100;
  return q.profitYoY ?? null;
}
