// node --no-warnings server/economy-test.js — India's economy (economy.js)
import assert from "node:assert/strict";
import { parseRbiRates, curveOf, parseFlows, parseWorldBank } from "./economy.js";

// RBI's home page box, as it reads on 20 Nov 2026
const page = `<html><body><div>1. Current Rates</div><table><tr><td>Policy Repo Rate</td><td>: 5.50%</td></tr>
<tr><td>Standing Deposit Facility Rate</td><td>: 5.25%</td></tr><tr><td>Marginal Standing Facility Rate</td><td>: 5.75%</td></tr>
<tr><td>Bank Rate</td><td>: 5.75%</td></tr><tr><td>CRR</td><td>: 3.00%</td></tr><tr><td>SLR</td><td>: 18.00%</td></tr>
<tr><td>Money Market Call Rates</td><td>: 4.30% - 5.75% *</td></tr><tr><td>* as on November 19, 2026</td></tr>
<tr><td>Government Securities Market</td></tr><tr><td>6.20% GS 2029</td><td>: 6.9010% #</td></tr><tr><td>7.63% GS 2056</td><td>: 7.7409% #</td></tr>
<tr><td>6.94% GS 2036</td><td>: 7.2629% #</td></tr><tr><td>91 day T-bills</td><td>: 5.8602%*</td></tr><tr><td>364 day T-bills</td><td>: 6.6300%*</td></tr>
<tr><td># as on November 19, 2026</td></tr></table></body></html>`;
const r = parseRbiRates(page);
assert.equal(r.repo, 5.5); assert.equal(r.crr, 3); assert.equal(r.slr, 18); assert.equal(r.sdf, 5.25);
assert.deepEqual([r.callLow, r.callHigh], [4.3, 5.75]);
assert.deepEqual(r.bonds.map(b => [b.year, b.yield]), [[2029, 6.901], [2036, 7.2629], [2056, 7.7409]], "sorted by maturity");
assert.deepEqual(r.bills.map(b => b.days), [91, 364]);
assert.equal(r.asOn, "November 19, 2026");
assert.equal(parseRbiRates("<html>Under maintenance</html>"), null, "no box, no rates");
console.log("ok: RBI's current rates, read from its page");

const c = curveOf(r);
assert.equal(c.points[0].label, "91 days");
assert.equal(c.inverted, false);
const inv = curveOf({ bills: [{ days: 91, yield: 7.5 }], bonds: [{ year: new Date().getUTCFullYear() + 10, yield: 6.8 }] });
assert.equal(inv.inverted, true, "a longer loan paying less is an inversion");
console.log("ok: the yield curve, and an inversion");

const f = parseFlows([{ buyValue: "17651.5", category: "DII", date: "19-Nov-2026", netValue: "-1356.57", sellValue: "19008.07" }, { buyValue: "20706.95", category: "FII/FPI", date: "19-Nov-2026", netValue: "7411.41", sellValue: "13295.54" }]);
assert.deepEqual([f.date, f.fii, f.dii], ["19-Nov-2026", 7411.41, -1356.57]);
assert.equal(parseFlows([]), null);
console.log("ok: FII and DII flows");

const wb = parseWorldBank([{ page: 1 }, [{ date: "2025", value: 7.5 }, { date: "2024", value: null }, { date: "2023", value: 7.2 }]]);
assert.deepEqual(wb, [{ year: 2023, value: 7.2 }, { year: 2025, value: 7.5 }], "oldest first, empty years dropped");
assert.equal(parseWorldBank({ message: "error" }), null);
console.log("ok: the World Bank's years");
