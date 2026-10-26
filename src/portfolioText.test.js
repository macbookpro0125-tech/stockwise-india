// What the Portfolio says (portfolioText.js): its totals, what needs a look,
// and each holding's note
import assert from "node:assert/strict";
import { priced, portfolioTotals, needsALook, holdingNote, dividendPerShare, rupees } from "./portfolioText.js";

const rows = {
  TCS: { ret1d: 0.9, fv25: 3785, divYield: 4.4, research: { quality: 88 } },
  KSOLVES: { ret1d: -10.2, divYield: 2 },
  COALINDIA: { ret1d: 1.2, divYield: 6.7, events: [{ date: "2026-11-04", kind: "action", title: "Interim Dividend - Rs 5.50 Per Share" }] },
  SUZLON: { ret1d: -2.1, nextResults: "2026-10-29" },
};
const rowOf = t => rows[t];
const hold = [
  priced({ id: 1, ticker: "TCS", name: "Tata Consultancy Services Limited", buyPrice: 3200, qty: 20 }, 2530, rows.TCS),
  priced({ id: 2, ticker: "KSOLVES", name: "Ksolves India Limited", buyPrice: 250, qty: 100 }, 219, rows.KSOLVES),
  priced({ id: 3, ticker: "COALINDIA", name: "Coal India Limited", buyPrice: 380, qty: 60 }, 397, rows.COALINDIA),
  priced({ id: 4, ticker: "SUZLON", name: "Suzlon Energy Limited", buyPrice: 52, qty: 400 }, 37.4, rows.SUZLON),
];
assert.equal(hold[0].value, 50600);
assert.equal(hold[0].gain, -13400);
assert.equal(Math.round(hold[1].day), -2488, "a −10.2% day on ₹21,900 is −₹2,488");
const tot = portfolioTotals(hold, rowOf);
assert.equal(tot.value, 50600 + 21900 + 23820 + 14960);
assert.equal(tot.invested, 64000 + 25000 + 22800 + 20800);
assert.ok(tot.day < 0 && tot.dayPct < 0);
assert.equal(Math.round(tot.income), Math.round(50600 * 0.044 + 21900 * 0.02 + 23820 * 0.067));
// an unpriced holding: no total value, said so
const gap = portfolioTotals([...hold, priced({ id: 9, ticker: "GONE", buyPrice: 10, qty: 5 }, null, null)], rowOf);
assert.equal(gap.value, null); assert.deepEqual(gap.unpriced, ["GONE"]);
console.log("ok: totals — value, the day, dividends, and a missing price");

assert.equal(dividendPerShare("Interim Dividend - Rs 5.50 Per Share"), 5.5);
assert.equal(dividendPerShare("Final Dividend - Re 1 Per Share"), 1);
assert.equal(dividendPerShare("Dividend - Rs 12/- Per Share"), 12);
assert.equal(dividendPerShare("Annual General Meeting"), null);
assert.equal(rupees(-2488.4), "−₹2,488");
console.log("ok: a dividend's amount from NSE's title");

const look = needsALook(hold, rowOf, { today: "2026-10-26", pricesDate: "2026-10-23", total: tot.value });
assert.deepEqual(look.map(x => `${x.name} ${x.text}`), [
  "Ksolves India fell 10% on 23 Oct: −₹2,488 on your shares",
  "Suzlon Energy reports results on Thu 29 Oct",
  "Coal India goes ex-dividend on 4 Nov: about ₹330 for your 60 shares",
]);
// one holding past a third of the whole is said
const heavy = needsALook([hold[0], hold[2], hold[3]], rowOf, { today: "2026-12-30", total: 50600 + 23820 + 14960 });
assert.deepEqual(heavy.map(x => x.kind), ["weight"]);
assert.match(heavy[0].text, /57% of your portfolio/);
console.log("ok: needs a look — the day in rupees, results, a dividend, the weight");

assert.deepEqual(holdingNote(hold[3], rows.SUZLON, { today: "2026-10-26" }), { tag: "Results 29 Oct" });
assert.deepEqual(holdingNote(hold[2], rows.COALINDIA, { today: "2026-10-26" }), { tag: "Ex-dividend 4 Nov" });
assert.deepEqual(holdingNote(hold[0], rows.TCS, { today: "2026-10-26" }), { text: "33% under fair value" });
assert.deepEqual(holdingNote(hold[0], rows.TCS, { today: "2026-10-26", position: { label: "At/below your L1", tone: "green" } }), { text: "At/below your L1", tone: "green" });
console.log("All portfolio wording checks passed.");
