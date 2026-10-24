// Current prices and the chart's price history, from NSE (prices.js,
// price-history.js, quote.js): node --no-warnings server/prices-test.js
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "prices-test-"));
const { currentPrices, selectCurrentPrice } = await import("./prices.js");
const { historyWriter, readHistory, adjustBars, historyBars } = await import("./price-history.js");
const { barsInRange, fetchDailyBars } = await import("./quote.js");

const snapshot = { pricesDate: "2026-10-08", prices: { TCS: 3800 } };
assert.deepEqual(selectCurrentPrice("TCS", snapshot), { price: 3800, asOf: "2026-10-08", source: "close" });
assert.equal(selectCurrentPrice("INFY", snapshot), null);
assert.equal(selectCurrentPrice("TCS", null), null);
assert.deepEqual(await currentPrices(["TCS", "TCS", "INFY"], { snapshot }), { TCS: { price: 3800, asOf: "2026-10-08", source: "close" }, INFY: null });
console.log("ok: current prices are NSE's close with its date, nothing when there's none");

// Kept as NSE published them; days added later merge in, a day read again is replaced
const day = (open, high, low, close, volume) => ({ open, high, low, close, volume });
let w = historyWriter();
w.add("2026-10-07", new Map([["TCS", day(3780, 3820, 3770, 3790, 1000)], ["M&M", day(300, 310, 295, 305, 50)]]));
w.add("2026-10-08", new Map([["TCS", day(3790, 3810, 3780, 3800.004, 1200)], ["BAD SYM", day(1, 1, 1, 1, 1)], ["ZERO", day(0, 0, 0, 0, 0)]]));
assert.equal(w.save(), 2, "real symbols with a price only");
w = historyWriter();
w.add("2026-10-09", new Map([["TCS", day(3800, 3850, 3795, 3840, 900)]]));
w.add("2026-10-08", new Map([["TCS", day(3790, 3810, 3780, 3801, 1200)]]));
w.save();
assert.deepEqual(readHistory("TCS").map(b => [b[0], b[4]]), [["2026-10-07", 3790], ["2026-10-08", 3801], ["2026-10-09", 3840]], "merged, oldest first, a day read again replaced");
assert.equal(readHistory("M&M")[0][4], 305, "a symbol with & kept too");
assert.deepEqual(readHistory("../x"), []);
console.log("ok: each company's days kept as published, merged in as they come");

// On today's share basis: a 1:2 split on 9 Oct halves the days before it
const adj = adjustBars([["2026-10-08", 200, 210, 190, 200, 100], ["2026-10-09", 101, 103, 99, 100, 200]], [{ exDate: "2026-10-09", ratio: 2 }]);
assert.deepEqual(adj[0], { date: "2026-10-08", open: 100, high: 105, low: 95, close: 100, volume: 200 });
assert.deepEqual(adj[1], { date: "2026-10-09", open: 101, high: 103, low: 99, close: 100, volume: 200 }, "a day on or after the ex-date as it was");
assert.equal(historyBars("TCS", { splits: { TCS: [{ exDate: "2026-10-09", ratio: 2 }] } })[0].close, 1895);
console.log("ok: a split or bonus after a day is applied to it when read, so a split doesn't show as a crash");

// The chart's ranges, counted back from the latest kept day
const bars = ["2025-09-01", "2025-11-01", "2026-04-15", "2026-09-30", "2026-10-09"].map(date => ({ date }));
assert.deepEqual(barsInRange(bars, "1mo").map(b => b.date), ["2026-09-30", "2026-10-09"]);
assert.deepEqual(barsInRange(bars, "6mo").map(b => b.date), ["2026-04-15", "2026-09-30", "2026-10-09"]);
assert.equal(barsInRange(bars, "1y").length, 4);
assert.equal(barsInRange(bars, "max").length, 5);
const chart = fetchDailyBars("TCS", "1y", { splits: {} });
assert.equal(chart.source, "NSE");
assert.equal(chart.keptFrom, "2026-10-07");
assert.equal(chart.bars.length, 3);
assert.deepEqual(fetchDailyBars("NOPE", "1y", {}).bars, [], "none kept: no bars, not an error");
console.log("ok: the chart's bars come from the kept history, by range");
