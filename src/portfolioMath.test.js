import assert from "node:assert/strict";
import { portfolioSummary } from "./portfolioMath.js";

const complete = portfolioSummary([
  { ticker: "TCS", invested: 1000, cmp: 120, currentVal: 1200 },
  { ticker: "INFY", invested: 1000, cmp: 80, currentVal: 800 },
]);
assert.equal(complete.totalInvested, 2000);
assert.equal(complete.totalCurrent, 2000);
assert.equal(complete.totalPL, 0);
assert.equal(complete.totalPLPct, 0);
assert.equal(complete.allPricesLoaded, true);
console.log("ok: complete portfolios report total value and P&L");

const partial = portfolioSummary([
  { ticker: "TCS", invested: 1000, cmp: 120, currentVal: 1200 },
  { ticker: "UNKNOWN", invested: 500, cmp: null, currentVal: null },
  { ticker: "UNKNOWN", invested: 500, cmp: null, currentVal: null },
]);
assert.equal(partial.totalInvested, 2000);
assert.equal(partial.totalCurrent, null);
assert.equal(partial.totalPL, null);
assert.equal(partial.totalPLPct, null);
assert.deepEqual(partial.unpriced, ["UNKNOWN"]);
assert.equal(partial.allPricesLoaded, false);
console.log("ok: an unpriced holding withholds portfolio value and P&L");

const invalidPrice = portfolioSummary([{ ticker: "BAD", invested: 100, cmp: 0, currentVal: null }]);
assert.equal(invalidPrice.totalCurrent, null);
assert.deepEqual(invalidPrice.unpriced, ["BAD"]);
console.log("ok: a nonpositive price is treated as unavailable");
