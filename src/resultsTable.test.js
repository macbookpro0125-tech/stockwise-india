// The results table's figures (resultsTable.js): node src/resultsTable.test.js
import assert from "node:assert/strict";
import { resultsTable, growth, turn } from "./resultsTable.js";

const q = (end, salesCr, opCr, profitCr, eps, opm) => ({ end, salesCr, opCr, profitCr, eps, opm });
const t = resultsTable([
  q("2025-09-30", 17198, 7017, 4468, 4.49, 40.8),
  q("2026-09-30", 19855, 8350, 5645, 5.67, 42.06),
  q("2026-06-30", 18354, 8273, 5480, 5.51, 45.07),
  q("2026-03-31", 18000, 8000, 5000, 5.0, 44.4),
]);
assert.equal(t.latest, "2026-09-30", "the newest, whatever the order given");
assert.equal(t.prev, "2026-06-30");
assert.equal(t.yago, "2025-09-30");
const sales = t.rows.find(r => r.key === "salesCr");
assert.equal(sales.yoy.toFixed(2), "15.45", "Kotak's Sep 2026 sales growth, as Tijori shows it");
assert.equal(sales.qoq.toFixed(2), "8.18");
assert.equal(t.rows.find(r => r.key === "opm").yoy.toFixed(0), "126", "a margin moves in basis points");
assert.deepEqual(sales.trend.map(p => p.end), ["2025-09-30", "2026-03-31", "2026-06-30", "2026-09-30"], "the trend oldest first");
assert.deepEqual(t.rows.map(r => r.key), ["salesCr", "opCr", "profitCr", "eps", "opm"]);

// a bank has no operating profit: its row is left out
const bank = resultsTable([q("2026-09-30", 100, null, 20, 2, null)]);
assert.deepEqual(bank.rows.map(r => r.key), ["salesCr", "profitCr", "eps"]);
assert.equal(bank.prev, null);

// losses: no percentage, said in words
assert.equal(growth(50, -20), null);
assert.equal(turn(50, -20), "to profit");
assert.equal(turn(-10, 30), "to loss");
assert.equal(turn(-10, -30), "smaller loss");
assert.equal(turn(10, 5), null);
assert.equal(resultsTable([]), null);
console.log("resultsTable tests passed");
