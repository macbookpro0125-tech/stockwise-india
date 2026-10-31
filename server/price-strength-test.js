// Price strength (price-strength.js): node server/price-strength-test.js
import assert from "node:assert/strict";
import { weightedReturn, priceStrengthRanks, priceStrengthOf, nineMonthReturn } from "./price-strength.js";

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

// 9 months from daily bars: the last close on or before the same date back
const bars = [{ date: "2026-01-29", close: 80 }, { date: "2026-01-30", close: 100 }, { date: "2026-02-02", close: 90 }, { date: "2026-10-29", close: 140 }, { date: "2026-10-30", close: 150 }];
assert.equal(nineMonthReturn(bars, "2026-10-30"), 50, "30 Oct against 30 Jan");
assert.equal(nineMonthReturn(bars.slice(3), "2026-10-30"), null, "no close that far back");
console.log("ok: a 9-month return from daily bars");

// a snapshot without 9-month returns: worked out from the kept prices
const old = { pricesDate: "2026-10-30", returns: { A: { m3: 5, m6: 5, y1: 5 }, B: { m3: 1, m6: 1, y1: 1 } } };
const kept = { A: [{ date: "2026-01-30", close: 100 }, { date: "2026-10-30", close: 200 }], B: [{ date: "2026-01-30", close: 100 }, { date: "2026-10-30", close: 90 }] };
assert.equal(priceStrengthOf(old, "A", s => kept[s]), 99);
assert.equal(priceStrengthOf(old, "B", s => kept[s]), 1);
console.log("ok: an older snapshot's strength comes from the kept daily prices");
