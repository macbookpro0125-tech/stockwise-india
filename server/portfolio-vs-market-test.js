import assert from "node:assert/strict";
import { portfolioVsMarket } from "./portfolio-vs-market.js";

// five trading days; the index rises 10% over them
const index = [["2026-10-01", 100], ["2026-10-02", 102], ["2026-10-05", 104], ["2026-10-06", 108], ["2026-10-07", 110]];
const bars = {
  UP: [["2026-09-30", 50], ["2026-10-01", 50], ["2026-10-02", 55], ["2026-10-05", 60], ["2026-10-06", 70], ["2026-10-07", 75]],
  FLAT: [["2026-10-01", 20], ["2026-10-02", 20], ["2026-10-05", 20], ["2026-10-07", 20]], // no trade on the 6th
}; 
const barsOf = t => (bars[t] ?? []).map(([date, close]) => ({ date, close }));

// one lot bought on the first day at that day's price: 10 × 50 = 500 in each
let r = portfolioVsMarket([{ ticker: "UP", qty: 10, buyPrice: 50, buyDate: "2026-10-01" }], index, barsOf);
assert.equal(r.invested, 500);
assert.equal(r.you, 750, "10 shares at 75");
assert.equal(r.market, 550, "500 into an index that rose 10%");
assert.equal(r.edgePct, 36.4, "(750 − 550) ÷ 550");
assert.equal(r.points[0].you, 500); assert.equal(r.points[0].market, 500);

// a second lot later: both lines take its money on its day, so buying moves them alike
r = portfolioVsMarket([
  { ticker: "UP", qty: 10, buyPrice: 50, buyDate: "2026-10-01" },
  { ticker: "FLAT", qty: 50, buyPrice: 20, buyDate: "2026-10-05" },
], index, barsOf);
const day5 = r.points.find(p => p.date === "2026-10-05");
assert.equal(day5.invested, 1500);
assert.equal(day5.market, Math.round(500 / 100 * 104 + 1000), "the new 1,000 goes in at the 5th's index level");
// the 6th: FLAT didn't trade, its last close carries
assert.equal(r.points.find(p => p.date === "2026-10-06").you, 10 * 70 + 50 * 20);
assert.equal(r.lots, 2);

// no buy date: placed at the first day shown, at that day's price, and said so
r = portfolioVsMarket([{ ticker: "UP", qty: 2, buyPrice: 10, buyDate: null }], index, barsOf);
assert.equal(r.placedAtStart, 1);
assert.equal(r.invested, 100, "2 × 50 on the first day, not the 10 paid");

// bought before the index's kept days: placed at its first day too
r = portfolioVsMarket([{ ticker: "UP", qty: 1, buyPrice: 40, buyDate: "2020-01-01" }], index, barsOf);
assert.equal(r.from, "2026-10-01"); assert.equal(r.placedAtStart, 1);

// a company with no prices is left out, not counted as zero
r = portfolioVsMarket([{ ticker: "UP", qty: 1, buyPrice: 50, buyDate: "2026-10-01" }, { ticker: "NONE", qty: 5, buyPrice: 9, buyDate: "2026-10-01" }], index, barsOf);
assert.equal(r.unpriced, 1); assert.equal(r.lots, 1);

assert.equal(portfolioVsMarket([], index, barsOf), null);
assert.equal(portfolioVsMarket([{ ticker: "UP", qty: 1, buyPrice: 1, buyDate: "2026-10-01" }], [], barsOf), null);
console.log("portfolio-vs-market ok");
