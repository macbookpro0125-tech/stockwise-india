// Some NSE filings state a whole year in the wrong unit — lakhs or thousands
// filed as rupees, or the reverse — so that year's revenue, profit, assets and
// share capital are all off by exactly 100, 1,000 or 100,000 while its EPS
// (a per-share figure, in rupees either way) is in line with the years around
// it. SRF's FY23 revenue read ₹149 Cr between ₹12,434 Cr and ₹13,139 Cr, which
// made its 3-year sales growth 374% a year; Graphite India's FY22 read ₹3.03
// lakh Cr. Such a year is put back on the scale most of the company's years
// share, and marked, so the page can say so.

const SLIPS = [2, 3, 5]; // powers of ten seen in the filings
// Figures per share or per unit — never part of a unit slip
const NOT_MONEY = new Set(["eps", "faceValue"]);
const log10 = (a, b) => Math.log10(a / b);

const median = values => {
  const v = values.filter(x => x > 0).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};

// A year is put back only when every test agrees:
// - its revenue is off by a power of ten from the company's typical (median)
//   year AND from a neighbouring year — a real collapse or take-off moves
//   step by step (SVP Global 1,720 → 918 → 302 → 92 → 5 is real), a slip jumps;
// - and the rest of that filing moved by the same power: share capital (which
//   almost never changes 100-fold), total assets, or profit with EPS in line.
// years: newest first. Returns the same array when nothing needs fixing.
export function fixUnitSlips(years) {
  if (years.filter(y => y.revenue > 0).length < 3) return years; // too few to know which year is off
  const typical = {};
  for (const k of ["revenue", "eps", "totalAssets", "paidUp", "profit"]) typical[k] = median(years.map(y => y[k]));
  const offBy = (y, k, step, tol) => y[k] > 0 && typical[k] > 0 && Math.abs(log10(y[k], typical[k]) - step) < tol;
  let changed = false;
  const out = years.map((y, i) => {
    if (!(y.revenue > 0)) return y;
    const r = log10(y.revenue, typical.revenue);
    const k = SLIPS.find(p => Math.abs(Math.abs(r) - p) < 0.3);
    if (!k) return y;
    const step = Math.sign(r) * k;
    const jumps = [years[i - 1], years[i + 1]].some(n => n?.revenue > 0 && Math.abs(log10(y.revenue, n.revenue) - step) < 0.3);
    const wholeFiling = offBy(y, "paidUp", step, 0.15) || offBy(y, "totalAssets", step, 0.35) ||
      (offBy(y, "profit", step, 0.5) && offBy(y, "eps", 0, 0.7));
    if (!jumps || !wholeFiling) return y;
    changed = true;
    const factor = 10 ** -step;
    const fixed = { ...y, unitFix: factor };
    for (const [key, v] of Object.entries(y)) {
      if (typeof v === "number" && !NOT_MONEY.has(key)) fixed[key] = v * factor;
    }
    return fixed;
  });
  return changed ? out : years;
}
