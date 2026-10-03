// A year filed in the wrong unit is rescaled; real swings in a business aren't.
import { fixUnitSlips } from "./unit-slips.js";

let failed = 0;
const ok = (cond, msg) => { if (cond) console.log(`ok: ${msg}`); else { failed++; console.error(`FAIL: ${msg}`); } };
const CR = 1e7;
const year = (fy, revenue, { eps = 70, paidUp = 296, totalAssets = revenue * 1.5, profit = revenue * 0.12 } = {}) =>
  ({ fyEnd: `20${fy}-03-31`, revenue: revenue * CR, eps, paidUp: paidUp * CR, totalAssets: totalAssets * CR, profit: profit * CR, faceValue: 10 });

// SRF as filed: FY23 at 1/100, share capital included
const srf = [year(26, 15787), year(25, 14693), year(24, 13139), year(23, 148.7, { paidUp: 2.96, totalAssets: 210 }), year(22, 12434), year(21, 8400)];
const fixed = fixUnitSlips(srf);
ok(Math.round(fixed[3].revenue / CR) === 14870 && fixed[3].unitFix === 100, "a year filed 100x too small is put back (SRF FY23: ₹149 Cr → ₹14,870 Cr)");
ok(fixed[3].eps === 70 && fixed[3].faceValue === 10, "per-share figures are left as filed");
ok(fixed.filter(y => y.unitFix).length === 1, "only the slipped year changes");

// Graphite India as filed: FY22 100x too large, next to a loss year
const graphite = [year(26, 2852), year(25, 2560), year(24, 2950), year(23, 3181), year(22, 302600, { paidUp: 3900, totalAssets: 500000 }), year(21, 1958, { eps: -1.6 })];
const g = fixUnitSlips(graphite);
ok(Math.round(g[4].revenue / CR) === 3026 && g[5].unitFix == null, "a year 100x too large is put back, and the loss year beside it is left alone");

// SVP Global: a real collapse, step by step — no single jump of 100x
const svp = [year(26, 5, { paidUp: 12.6 }), year(25, 92, { paidUp: 12.6 }), year(24, 302, { paidUp: 12.6 }), year(23, 918, { paidUp: 12.6 }), year(22, 1720, { paidUp: 12.6 })];
ok(fixUnitSlips(svp) === svp, "a business that really shrank year after year isn't 'corrected'");

// A real take-off: revenue, profit and EPS all jump; share capital and assets don't
const takeoff = [year(26, 7500, { paidUp: 40, totalAssets: 3000, eps: 70 }), year(25, 75, { paidUp: 40, totalAssets: 2900, eps: 0.7 }), year(24, 70, { paidUp: 40, totalAssets: 2800, eps: 0.65 })];
ok(fixUnitSlips(takeoff) === takeoff, "a real 100x take-off (EPS jumps too, share capital doesn't) is left as filed");

ok(fixUnitSlips([year(26, 7), year(25, 631)]).every(y => !y.unitFix), "two years can't say which one is off, so neither changes");

if (failed) { console.error(`\n${failed} unit-slip check(s) failed.`); process.exit(1); }
console.log("\nAll unit-slip checks passed.");
