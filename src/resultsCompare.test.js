// How a quarter compares (resultsCompare.js)
import assert from "node:assert/strict";
import { compareResults } from "./resultsCompare.js";

// eight quarters, newest first, sales growing every quarter on a year earlier
const ends = ["2026-09-30", "2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30", "2025-06-30", "2025-03-31", "2024-12-31"];
const sales = [1200, 1150, 1100, 1050, 1000, 980, 950, 900];
const profit = [120, 110, 100, 95, 100, 90, 85, 80];
const opm = [18.2, 17.9, 17.5, 17.0, 17.5, 16.8, 16.5, 16.0];
const qs = ends.map((end, i) => ({ end, salesCr: sales[i], profitCr: profit[i], opm: opm[i], salesYoY: i < 4 ? ((sales[i] - sales[i + 4]) / sales[i + 4]) * 100 : 5, profitYoY: i < 4 ? ((profit[i] - profit[i + 4]) / profit[i + 4]) * 100 : null }));
const r = compareResults(qs);
assert.equal(r.lines[0], "Sales ₹1,200 crore, up 20.0% on the same quarter a year earlier (₹1,000 crore).");
assert.equal(r.lines[1], "Profit ₹120 crore, up 20.0% on the same quarter a year earlier (₹100 crore).");
assert.equal(r.lines[2], "On the quarter before: sales up 4.3%, profit up 9.1%.");
assert.equal(r.lines[3], "Operating margin 18.2%, up from 17.5% a year earlier.");
assert.equal(r.lines[4], "Sales grew on a year earlier for all 8 quarters shown.");
assert.equal(r.lines[5], "Profit grew on a year earlier for 4 quarters in a row.");
assert.equal(r.bars.length, 8);
assert.equal(r.bars[0].end, "2024-12-31");
assert.equal(r.bars[7].salesCr, 1200);

// losses are said as losses, never as a percentage
const loss = compareResults([
  { end: "2026-09-30", salesCr: 500, profitCr: -20 },
  { end: "2026-06-30", salesCr: 480, profitCr: -30 },
  { end: "2025-09-30", salesCr: 450, profitCr: 15 },
]);
assert.equal(loss.lines[1], "A loss of ₹20 crore, against a profit of ₹15 crore a year earlier.");
assert.equal(loss.lines[2], "On the quarter before: sales up 4.2%.");
const smaller = compareResults([{ end: "2026-09-30", profitCr: -20 }, { end: "2025-09-30", profitCr: -35 }]);
assert.equal(smaller.lines[0], "A loss of ₹20 crore, smaller than the loss of ₹35 crore a year earlier.");

// one quarter only: what it was, nothing compared
assert.deepEqual(compareResults([{ end: "2026-09-30", salesCr: 99.5, profitCr: 4.2 }]).lines, ["Sales ₹99.5 crore.", "Profit of ₹4.2 crore."]);
assert.equal(compareResults([]), null);
console.log("resultsCompare tests passed");
