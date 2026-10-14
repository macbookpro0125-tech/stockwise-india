import assert from "node:assert/strict";
import { currentPrices, selectCurrentPrice } from "./prices.js";

const snapshot = { pricesDate: "2026-10-08", prices: { TCS: 3800 } };
const olderYahoo = { cmp: 3790, asOf: "2026-10-07" };
const newerYahoo = { cmp: 3810, asOf: "2026-10-09" };

assert.deepEqual(selectCurrentPrice("TCS", olderYahoo, snapshot), {
  price: 3800, asOf: "2026-10-08", source: "close",
});
console.log("ok: a newer NSE close wins over an older Yahoo close");

assert.deepEqual(selectCurrentPrice("TCS", newerYahoo, snapshot), {
  price: 3810, asOf: "2026-10-09", source: "live", stale: false,
});
console.log("ok: a newer Yahoo close wins over an older NSE close");

assert.equal(selectCurrentPrice("TCS", { ...olderYahoo, asOf: snapshot.pricesDate }, snapshot).source, "live");
console.log("ok: Yahoo remains preferred when both sources are dated the same day");

assert.equal(selectCurrentPrice("TCS", { ...olderYahoo, stale: true }, snapshot).source, "close");
console.log("ok: a stale cached Yahoo close cannot override a newer NSE close");

assert.deepEqual(selectCurrentPrice("TCS", { ...newerYahoo, stale: true }, null), {
  price: 3810, asOf: "2026-10-09", source: "cached", stale: true,
});
console.log("ok: a cached Yahoo close remains available when no NSE close exists");

assert.equal(selectCurrentPrice("TCS", null, { prices: {} }), null);
console.log("ok: no price is returned when both sources are unavailable");

const apiResult = await currentPrices(["TCS"], {
  snapshot,
  getQuote: async () => olderYahoo,
});
assert.deepEqual(apiResult.TCS, { price: 3800, asOf: "2026-10-08", source: "close" });
console.log("ok: currentPrices uses the newer NSE close when Yahoo returns an older one");

const failedRefresh = await currentPrices(["TCS"], {
  snapshot,
  getQuote: async () => { throw new Error("simulated Yahoo outage"); },
});
assert.deepEqual(failedRefresh.TCS, { price: 3800, asOf: "2026-10-08", source: "close" });
console.log("ok: currentPrices falls back to the NSE close after a Yahoo error");

// When a day's price counts as its close (quote.js sessionClosed): the stock
// page's header and chart share this, so they show the same latest day
const { sessionClosed, dailyRows } = await import("./quote.js");
const ist = (d, hhmm) => Date.UTC(2026, 9, d, Number(hhmm.slice(0, 2)) - 5, Number(hhmm.slice(3)) - 30) / 1000;
assert.equal(sessionClosed("2026-10-14", ist(14, "15:00")), false);
assert.equal(sessionClosed("2026-10-14", ist(14, "16:05")), true);
assert.equal(sessionClosed("2026-10-13", ist(14, "09:20")), true);
assert.equal(sessionClosed("2026-10-15", ist(14, "16:05")), false);
console.log("ok: today's price is a close only from 16:00 IST; earlier days always are");

const yahoo = (metaDay) => ({
  timestamp: [ist(13, "09:15"), ist(14, "09:15")],
  indicators: { quote: [{ open: [100, 101], high: [104, 103], low: [99, 97], close: [102, null], volume: [10, 20] }] },
  meta: { regularMarketPrice: 98.5, regularMarketTime: ist(metaDay, "15:29") },
});
assert.deepEqual(dailyRows(yahoo(14)).at(-1), { date: "2026-10-14", open: 101, high: 103, low: 97, close: 98.5, volume: 20 });
assert.equal(dailyRows(yahoo(13)).at(-1).date, "2026-10-13");
console.log("ok: Yahoo's empty latest close is filled from its quote only for the same day");
