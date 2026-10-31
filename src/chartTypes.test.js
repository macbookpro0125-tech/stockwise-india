// Heikin Ashi, Renko and Fibonacci levels (chartTypes.js): node src/chartTypes.test.js
import assert from "node:assert/strict";
import { heikinAshi, renko, renkoBox, fibLevels } from "./chartTypes.js";

const bar = (date, open, high, low, close) => ({ date, open, high, low, close });
const close = (a, b) => Math.abs(a - b) < 1e-9;

{
  const ha = heikinAshi([bar("d1", 10, 14, 8, 12), bar("d2", 12, 16, 11, 15)]);
  assert.ok(close(ha[0].close, 11) && close(ha[0].open, 11), "the first: open is the bar's middle");
  assert.ok(close(ha[1].open, 11) && close(ha[1].close, 13.5), "then: open the last candle's middle, close the bar's average");
  assert.equal(ha[1].high, 16);
  assert.equal(ha[1].low, 11);
}
{
  assert.equal(renkoBox([bar("d", 0, 0, 0, 2450)]), 25, "1% of ₹2,450, in ₹5 steps");
  assert.equal(renkoBox([bar("d", 0, 0, 0, 80)]), 1, "1% of ₹80, at least a ₹0.5 step, rounded");
  const closes = [100, 103, 106, 104, 101, 98, 97];
  const bricks = renko(closes.map((c, i) => bar(`d${i}`, c, c, c, c)), 2);
  assert.deepEqual(bricks.map(b => b.up), [true, true, true, false, false, false], "three up, then a turn needs two boxes down");
  assert.equal(bricks[0].open, 100);
  assert.equal(bricks.at(-1).close, 98);
  assert.equal(renko([bar("d", 1, 1, 1, 1)], 1).length, 0);
}
{
  const days = Array.from({ length: 300 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 10, 1) + i * 86400000).toISOString().slice(0, 10);
    return bar(d, 100, i === 290 ? 200 : 150, i === 100 ? 50 : 120, 140);
  });
  const f = fibLevels(days);
  assert.equal(f.high, 200);
  assert.equal(f.low, 50);
  assert.ok(close(f.levels.find(l => l.ratio === 0.5).price, 125), "50% between 200 and 50");
  assert.ok(close(f.levels.find(l => l.ratio === 0.618).price, 200 - 150 * 0.618));
  assert.equal(fibLevels([bar("d", 1, 1, 1, 1)]), null, "under 20 days: none");
}
console.log("chartTypes tests passed");
