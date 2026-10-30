// Price strength (price-strength.js): node server/price-strength-test.js
import assert from "node:assert/strict";
import { weightedReturn, priceStrengthRanks, priceStrengthOf } from "./price-strength.js";

assert.equal(weightedReturn({ m3: 10, m6: 20, m9: 30, y1: 40 }), 4 + 4 + 6 + 8, "40% the last 3 months, 20% each of the others");
assert.equal(weightedReturn({ m3: 10, m6: 20, y1: 40 }), null, "a missing period: no figure");

const r = priceStrengthRanks({
  A: { m3: -10, m6: -10, m9: -10, y1: -10 },
  B: { m3: 0, m6: 0, m9: 0, y1: 0 },
  C: { m3: 0, m6: 0, m9: 0, y1: 0 },
  D: { m3: 50, m6: 10, m9: 10, y1: 10 },
  NEW: { m3: 5, m6: 5 },
});
assert.equal(r.get("A"), 1, "the weakest is 1");
assert.equal(r.get("D"), 99, "the strongest is 99");
assert.equal(r.get("B"), r.get("C"), "equal returns rate the same");
assert.ok(r.get("B") > 1 && r.get("B") < 99);
assert.equal(r.has("NEW"), false, "under a year of prices: no rating");

const snap = { returns: { X: { m3: 1, m6: 1, m9: 1, y1: 1 }, Y: { m3: 2, m6: 2, m9: 2, y1: 2 } } };
assert.equal(priceStrengthOf(snap, "Y"), 99);
assert.equal(priceStrengthOf(snap, "Z"), null);
console.log("ok: price strength ranks the weighted return 1–99, ties alike, a year of prices needed");
