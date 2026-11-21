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

// Sales falling in each of the last two quarters (metrics.js recentSalesOf)
import { recentSalesOf, otherIncomeTtmOf } from "./metrics.js";
let rs = recentSalesOf([{ fyEnd: "2026-09-30", salesYoY: -45 }, { fyEnd: "2026-06-30", salesYoY: -39 }], 24);
assert.equal(rs.falling, true, "Natco: −45% and −39%");
assert.match(rs.text, /down 45%.*39%.*up 24% a year over 3 years/);
assert.equal(recentSalesOf([{ fyEnd: "2026-09-30", salesYoY: -12 }, { fyEnd: "2026-06-30", salesYoY: 3 }]).falling, false, "one bad quarter isn't a trend");
assert.equal(recentSalesOf([{ fyEnd: "2026-09-30", salesYoY: null }]), null);

// Other income over the last four quarters (metrics.js otherIncomeTtmOf)
const four = (oi, pbt) => Array.from({ length: 4 }, () => ({ otherIncomeCr: oi, pbtCr: pbt }));
let oi = otherIncomeTtmOf(four(2, 1.5));
assert.equal(oi.heavy, true); assert.match(oi.text, /would have made a pre-tax loss/, "other income above the whole profit");
oi = otherIncomeTtmOf(four(2, 5));
assert.equal(Math.round(oi.pct), 40); assert.match(oi.text, /40%/);
assert.equal(otherIncomeTtmOf(four(0.5, 5)).heavy, false, "10% is normal");
assert.equal(otherIncomeTtmOf(four(1, 5).slice(0, 3)), null, "needs four quarters");
console.log("ok: sales falling now, and other income carrying the profit lately");
