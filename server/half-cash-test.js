// The latest half-year's operating cash flow (metrics.js halfCashOf)
import assert from "node:assert/strict";
import { halfCashOf } from "./metrics.js";

// DRC Systems, Sept 2026: cash out while profitable, a year earlier cash in
const q = (fyEnd, ocfHalfCr = null, profitHalfCr = null) => ({ fyEnd, ocfHalfCr, profitHalfCr });
let h = halfCashOf([q("2026-09-30", -3.03, 9.62), q("2026-06-30"), q("2026-03-31"), q("2025-12-31"), q("2025-09-30", 9.69, 8.51)]);
assert.equal(h.negative, true);
assert.equal(h.prevOcfCr, 9.69, "the same half a year earlier");
assert.match(h.text, /−₹3\.03 Cr/);
// cash in: not negative, no sentence
h = halfCashOf([q("2026-09-30", 25801, 27354)]);
assert.equal(h.negative, false); assert.equal(h.text, undefined);
// a loss-making half with cash out isn't this caution (the loss says it)
assert.equal(halfCashOf([q("2026-09-30", -5, -2)]).negative, false);
// a half-year older than 200 days before the latest quarter: too old to speak for now
assert.equal(halfCashOf([q("2026-12-31"), q("2026-03-31", -1, 4)]), null);
assert.equal(halfCashOf([q("2026-12-31")]), null, "no half-year on file");
console.log("ok: the latest half-year's cash flow, and when it's a caution");
