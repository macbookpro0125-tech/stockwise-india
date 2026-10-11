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
