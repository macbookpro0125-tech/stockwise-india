// What the Watchlist says (watchlistText.js): the line for the whole list,
// what needs a look, and each row's one note
import assert from "node:assert/strict";
import { summaryLine, needsALook, rowNote, sinceAdded } from "./watchlistText.js";

const rows = {
  SUZLON: { name: "Suzlon Energy Limited", ret1d: -2.1, nextResults: "2026-10-29", fv25: 19.76 },
  KSOLVES: { name: "Ksolves India Limited", ret1d: -10.2, latestQuarterFiled: "2026-10-23" },
  TCS: { name: "Tata Consultancy Services Limited", ret1d: 0.9, fv25: 3785, research: { quality: 88 } },
  HDFCBANK: { name: "HDFC Bank Limited", ret1d: -0.4, fv25: 557 },
};
const prices = { SUZLON: 37.4, KSOLVES: 219, TCS: 2530, HDFCBANK: 693 };
const items = [{ ticker: "SUZLON", addedPrice: 40 }, { ticker: "KSOLVES", addedPrice: 219.5 }, { ticker: "TCS", addedPrice: 2400 }, { ticker: "HDFCBANK", addedPrice: 700 }];
const rowOf = t => rows[t], priceOf = t => prices[t];

assert.equal(sinceAdded(items[0], 37.4).toFixed(1), "-6.5");
assert.equal(sinceAdded({ addedPrice: 0 }, 10), null, "no price when added, no change");
const sum = summaryLine(items, rowOf, priceOf);
assert.equal(sum.count, "4 companies");
assert.equal(sum.today.toFixed(2), "-2.95");
assert.ok(Math.abs(sum.since - (-6.5 - 0.23 + 5.42 - 1) / 4) < 0.05, "the average of each company's change");
console.log("ok: the line for the whole list");

// the results filed that day, though a press release came later
const news = [{ symbol: "KSOLVES", time: "2026-10-23T07:17:00Z", kind: "updates" }, { symbol: "KSOLVES", time: "2026-10-23T07:06:00Z", kind: "results", numbers: { profitYoY: -13.8 } }];
const look = needsALook(items, rowOf, priceOf, { today: "2026-10-26", pricesDate: "2026-10-23", news });
assert.deepEqual(look.map(x => `${x.name} ${x.text}`), [
  "Ksolves India fell 10% on 23 Oct, after its results (profit −14%)",
  "Suzlon Energy reports results on Thu 29 Oct",
  "Tata Consultancy Services is 33% under its fair value",
]);
assert.equal(needsALook(items, rowOf, priceOf, { today: "2026-11-20", pricesDate: "2026-10-23" }).some(x => x.kind === "results"), false, "results only within a week");
// three results soon still leave room for the rest
const many = { A: { name: "A", nextResults: "2026-10-27" }, B: { name: "B", nextResults: "2026-10-28" }, C: { name: "C", nextResults: "2026-10-29" }, D: { name: "D", fv25: 100 } };
const kinds = needsALook(["A", "B", "C", "D"].map(ticker => ({ ticker })), t => many[t], t => (t === "D" ? 60 : 10), { today: "2026-10-26" }).map(x => x.kind);
assert.deepEqual(kinds, ["results", "results", "value"], "two results at most");
console.log("ok: needs a look — results soon, a big move and why, far under fair value");

assert.deepEqual(rowNote(items[0], rows.SUZLON, 37.4, { today: "2026-10-26" }), { tag: "Results 29 Oct" });
assert.deepEqual(rowNote(items[2], rows.TCS, 2530, { today: "2026-10-26" }), { text: "33% under fair value" });
assert.deepEqual(rowNote(items[3], rows.HDFCBANK, 693, { today: "2026-10-26" }), { text: "above its fair value" });
assert.deepEqual(rowNote(items[1], rows.KSOLVES, 219, { today: "2026-10-26" }), { text: "results out 23 Oct" });
assert.deepEqual(rowNote({ note: "wait for Q2" }, { name: "X" }, 10, { today: "2026-10-26" }), { text: "your note: wait for Q2", note: true });
assert.deepEqual(rowNote({}, { name: "X", research: { quality: 71.6 } }, 10, { today: "2026-10-26" }), { text: "quality 72/100" });
assert.deepEqual(rowNote({}, rows.TCS, 2530, { today: "2026-10-26", level: { label: "At/below your L1", color: "var(--green)" } }), { text: "At/below your L1", tone: "var(--green)" }, "the user's own levels before the fair value");
console.log("All watchlist wording checks passed.");
