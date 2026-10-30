// More chart indicators (chartIndicators.js): node src/chartIndicators.test.js
// Each expected value is worked out by hand from the indicator's definition.
import assert from "node:assert/strict";
import { pivotPoints, atr, supertrend, psar, stochastic, adx, obv, cci, williamsR, mfi, donchian } from "./chartIndicators.js";

const close = (a, b, eps = 1e-6) => a != null && Math.abs(a - b) < eps;
const bar = (date, open, high, low, closeP, volume = 100) => ({ date, open, high, low, close: closeP, volume });

{
  // September: high 110, low 90, last close 100. October's pivots come from it.
  const bars = [
    bar("2026-09-02", 95, 105, 92, 100), bar("2026-09-15", 100, 110, 95, 104), bar("2026-09-30", 104, 106, 90, 100),
    bar("2026-10-01", 100, 103, 98, 101), bar("2026-10-02", 101, 104, 99, 102),
  ];
  const c = pivotPoints(bars, "M", "classic");
  assert.equal(c.P[0], null, "no pivots before a full previous month");
  assert.ok(close(c.P[3], 100) && close(c.R1[3], 110) && close(c.S1[3], 90) && close(c.R2[3], 120) && close(c.S2[3], 80) && close(c.R3[3], 130) && close(c.S3[3], 70));
  assert.ok(close(c.P[4], 100), "the same pivots all month");
  assert.deepEqual(c.starts, [true, false, false, true, false]);
  const f = pivotPoints(bars, "M", "fibonacci");
  assert.ok(close(f.R1[3], 107.64) && close(f.R2[3], 112.36) && close(f.R3[3], 120) && close(f.S1[3], 92.36) && close(f.S2[3], 87.64) && close(f.S3[3], 80));
  const k = pivotPoints(bars, "M", "camarilla");
  assert.ok(close(k.R1[3], 100 + 20 * 1.1 / 12) && close(k.R2[3], 100 + 20 * 1.1 / 6) && close(k.R3[3], 105.5) && close(k.S3[3], 94.5));
  console.log("ok: classic, Fibonacci and Camarilla pivots from the previous month's high, low and close");
}
{
  // True ranges 2, 2, 2, then 4 (a gap above the last close)
  const bars = [bar("d1", 10, 11, 9, 10), bar("d2", 10, 11, 9, 10), bar("d3", 10, 11, 9, 10), bar("d4", 12, 14, 12, 13)];
  const a = atr(bars, 3);
  assert.equal(a[1], null);
  assert.ok(close(a[2], 2) && close(a[3], (2 * 2 + 4) / 3));
  console.log("ok: ATR is Wilder's average of the true range");
}
{
  // Closing on the window's high, low and middle
  const bars = [bar("d1", 1, 10, 0, 5), bar("d2", 1, 10, 0, 10), bar("d3", 1, 10, 0, 0), bar("d4", 1, 10, 0, 5)];
  const s = stochastic(bars, 2, 1, 1);
  assert.equal(s.k[0], null);
  assert.ok(close(s.k[1], 100) && close(s.k[2], 0) && close(s.k[3], 50) && close(s.d[3], 50));
  const w = williamsR(bars, 2);
  assert.ok(close(w[1], 0) && close(w[2], -100) && close(w[3], -50));
  console.log("ok: Stochastic and Williams %R place the close in the window's range");
}
{
  // Each day one rupee higher, range 1, closing at the high: all movement is up
  const bars = Array.from({ length: 12 }, (_, i) => bar(`d${i}`, 10 + i, 11 + i, 10 + i, 11 + i));
  const d = adx(bars, 3);
  assert.ok(close(d.plusDI.at(-1), 100) && close(d.minusDI.at(-1), 0) && close(d.adx.at(-1), 100));
  console.log("ok: ADX is 100 when every move is up, with +DI 100 and −DI 0");
}
{
  const bars = [bar("d1", 10, 10, 10, 10, 100), bar("d2", 11, 11, 11, 11, 200), bar("d3", 10, 11, 10, 10.5, 50), bar("d4", 10, 11, 10, 10.5, 70), bar("d5", 12, 12, 12, 12, 30)];
  assert.deepEqual(obv(bars), [0, 200, 150, 150, 180]);
  console.log("ok: OBV adds volume on up closes and takes it away on down closes");
}
{
  // Typical prices 1, 2, 3: average 2, mean deviation 2/3, so (3 − 2) / (0.015 × 2/3) = 100
  const bars = [bar("d1", 1, 1, 1, 1), bar("d2", 2, 2, 2, 2), bar("d3", 3, 3, 3, 3)];
  assert.ok(close(cci(bars, 3)[2], 100));
  // Typical price rising every day: all money flow is positive
  assert.ok(close(mfi(bars, 2)[2], 100));
  const falling = [bar("d1", 3, 3, 3, 3), bar("d2", 2, 2, 2, 2), bar("d3", 1, 1, 1, 1)];
  assert.ok(close(mfi(falling, 2)[2], 0));
  console.log("ok: CCI and MFI from the typical price");
}
{
  const bars = [bar("d1", 5, 6, 4, 5), bar("d2", 5, 9, 5, 8), bar("d3", 8, 8, 2, 3)];
  const dc = donchian(bars, 2);
  assert.equal(dc.upper[0], null);
  assert.ok(close(dc.upper[1], 9) && close(dc.lower[1], 4) && close(dc.mid[1], 6.5) && close(dc.upper[2], 9) && close(dc.lower[2], 2));
  console.log("ok: Donchian channel is the window's highest high and lowest low");
}
{
  const up = Array.from({ length: 40 }, (_, i) => bar(`u${i}`, 100 + i, 101 + i, 99 + i, 100.8 + i));
  const down = Array.from({ length: 40 }, (_, i) => bar(`d${i}`, 200 - i, 201 - i, 199 - i, 199.2 - i));
  const su = supertrend(up, 10, 3), sd = supertrend(down, 10, 3);
  assert.equal(su.value[8], null);
  assert.ok(su.up.at(-1) === true && su.value.at(-1) < up.at(-1).low, "a rising market: up, the line under the lows");
  assert.ok(sd.up.at(-1) === false && sd.value.at(-1) > down.at(-1).high, "a falling market: down, the line over the highs");
  const pu = psar(up), pd = psar(down);
  assert.ok(pu.at(-1) < up.at(-1).low && pd.at(-1) > down.at(-1).high);
  console.log("ok: Supertrend and Parabolic SAR sit under a rising market and over a falling one");
}

{
  // The year's high, and how far the last close is below it
  const { yearHigh, volumeRatio, relativeLine } = await import("./chartIndicators.js");
  const bars = [bar("2025-10-01", 1, 500, 1, 100), bar("2025-11-03", 1, 200, 1, 150), bar("2026-06-01", 1, 180, 1, 160), bar("2026-10-30", 1, 170, 1, 150)];
  const h = yearHigh(bars);
  assert.equal(h.price, 200, "a high more than a year back is left out");
  assert.equal(h.date, "2025-11-03");
  assert.ok(close(h.belowPct, 25));
  assert.equal(yearHigh([]), null);

  // Volume against the average of the bars before it
  const v = volumeRatio([bar("d1", 1, 1, 1, 1, 100), bar("d2", 1, 1, 1, 1, 300), bar("d3", 1, 1, 1, 1, 400), bar("d4", 1, 1, 1, 1, 100)], 2);
  assert.deepEqual(v.slice(0, 2), [null, null], "none until two before");
  assert.ok(close(v[2], 2) && close(v[3], 100 / 350));

  // The price against an index, rebased to 100; a week's bar uses the index on its last day
  const daily = [bar("2026-10-05", 1, 1, 1, 100), bar("2026-10-06", 1, 1, 1, 110), bar("2026-10-07", 1, 1, 1, 121)];
  const idx = [["2026-10-05", 1000], ["2026-10-06", 1100], ["2026-10-07", 1100]];
  const r = relativeLine(daily, idx);
  assert.ok(close(r[0], 100) && close(r[1], 100) && close(r[2], 110), "kept pace, then 10% ahead");
  const weekly = [bar("2026-09-28", 1, 1, 1, 100), bar("2026-10-05", 1, 1, 1, 121)];
  const w = relativeLine(weekly, [["2026-10-02", 1000], ["2026-10-09", 1100]]);
  assert.ok(close(w[0], 100) && close(w[1], 110));
  assert.equal(relativeLine(daily, [["2026-10-06", 1100]])[0], null, "no index day in a bar: no point");
  console.log("ok: the year's high, volume against its average, and the line against an index");
}
