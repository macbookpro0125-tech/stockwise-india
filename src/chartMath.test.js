import assert from "node:assert/strict";
import { aggregateBars, sma, ema, bollinger, rsi, macd, indexFrom } from "./chartMath.js";

const close = (a, b) => Math.abs(a - b) < 1e-6;

assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
console.log("ok: SMA averages a full window and leaves the warm-up empty");

const e = ema([1, 2, 3, 4, 5], 3);
assert.deepEqual(e.slice(0, 2), [null, null]);
assert.ok(close(e[2], 2) && close(e[3], 3) && close(e[4], 4));
console.log("ok: EMA starts from the simple average, then weights by 2/(n+1)");

const bb = bollinger([2, 4, 4, 4, 5, 5, 7, 9], 8, 2);
assert.ok(close(bb.mid[7], 5) && close(bb.upper[7], 9) && close(bb.lower[7], 1));
console.log("ok: Bollinger bands sit 2 population SDs either side of the mean");

assert.equal(rsi([1, 2, 3, 4, 5, 6], 3).at(-1), 100);
const flatDown = rsi([6, 5, 4, 3, 2, 1], 3);
assert.equal(flatDown.at(-1), 0);
assert.equal(flatDown[2], null);
// StockCharts' worked RSI example: these 15 closes give average gain 0.2386 and
// loss 0.0996, so 70.46 (their table shows 70.53 from rounding to 0.24 / 0.10)
const wilder = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
assert.equal(Math.round(rsi(wilder, 14)[14] * 100) / 100, 70.46);
console.log("ok: RSI is 100 on only gains, 0 on only losses, and matches a known series");

const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 10 + i * 0.5);
const m = macd(series);
assert.equal(m.line[24], null);
assert.notEqual(m.line[25], null);
assert.equal(m.signal[32], null);
assert.notEqual(m.signal[33], null);
assert.ok(close(m.hist[40], m.line[40] - m.signal[40]));
console.log("ok: MACD warms up 26 bars, its signal 9 more, histogram = line − signal");

const days = [
  { date: "2026-10-05", open: 10, high: 12, low: 9, close: 11, volume: 100 }, // Mon
  { date: "2026-10-07", open: 11, high: 15, low: 10, close: 14, volume: 50 },
  { date: "2026-10-09", open: 14, high: 14, low: 8, close: 9, volume: null },
  { date: "2026-10-12", open: 9, high: 10, low: 9, close: 10, volume: 20 },   // next Mon
];
assert.deepEqual(aggregateBars(days, "W"), [
  { date: "2026-10-05", open: 10, high: 15, low: 8, close: 9, volume: 150 },
  { date: "2026-10-12", open: 9, high: 10, low: 9, close: 10, volume: 20 },
]);
assert.equal(aggregateBars(days, "M").length, 1);
assert.equal(aggregateBars(days, "D"), days);
console.log("ok: weekly and monthly bars keep first open, last close, extremes and summed volume");

const inProgress = [...days.slice(0, 3), { ...days[3], partial: true }];
assert.equal(aggregateBars(inProgress, "W")[1].partial, true);
assert.equal(aggregateBars(inProgress, "W")[0].partial, undefined);
assert.equal(aggregateBars([{ ...days[0] }, { ...days[1], partial: true }], "W")[0].partial, true);
console.log("ok: a week still trading is marked in progress, a finished one isn't");

assert.equal(indexFrom(days, "2026-10-08"), 2);
assert.equal(indexFrom(days, "2030-01-01"), 3);
console.log("ok: a range starts at the first bar on or after its date");

console.log("All chart maths checks passed.");
