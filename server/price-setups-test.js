// Run: node server/price-setups-test.js
import assert from "node:assert/strict";
import { setupsOf, deskMarket, MIN_BARS } from "./price-setups.js";

// n sessions from a start date, each close from f(i); highs and lows 1% either side
function series(n, f, vol = () => 1e5) {
  const out = [];
  const d = new Date("2025-01-01T00:00:00Z");
  for (let i = 0; i < n; i++) {
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    const c = f(i);
    out.push({ date: d.toISOString().slice(0, 10), high: c * 1.01, low: c * 0.99, close: c, volume: vol(i) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

assert.equal(setupsOf(series(MIN_BARS - 1, () => 100)), null, "too little history reads nothing");

const up = setupsOf(series(300, i => 100 + i));
assert.equal(up.stage, "advancing");
assert.ok(up.setups.includes("nearHigh"), "a steady climb sits at its high");
assert.ok(up.above50 && up.above200);
console.log("ok: a steady climb is advancing, near its high");

const down = setupsOf(series(300, i => 400 - i));
assert.equal(down.stage, "declining");
assert.deepEqual(down.setups, []);
console.log("ok: a steady fall is declining, with no patterns");

// a climb that has rolled over: 50-day still over the 200-day, price under it
const rolled = setupsOf(series(300, i => (i < 260 ? 100 + i : 360 - (i - 260) * 3)));
assert.equal(rolled.stage, "topping");
console.log("ok: a climb that rolled over is topping");

// flat after a fall: the 50-day under the 200-day, but no longer falling
const based = setupsOf(series(300, i => (i < 150 ? 300 - i : 150 + (i % 2))));
assert.equal(based.stage, "basing");
console.log("ok: flat after a fall is basing");

// a breakout: flat, then today's close over every recent high on heavy volume
const flatThenPop = series(300, i => (i < 299 ? 100 + i * 0.2 + (i % 3) : 175), i => (i === 299 ? 5e5 : 1e5));
assert.ok(setupsOf(flatThenPop).setups.includes("breakout"));
const noVolume = series(300, i => (i < 299 ? 100 + i * 0.2 + (i % 3) : 175));
assert.ok(!setupsOf(noVolume).setups.includes("breakout"), "no breakout without the volume");
console.log("ok: a breakout needs the high and the volume");

// the market's mood counts only companies that trade ₹1 crore a day
const bars = { A: series(300, i => 100 + i, () => 1e6), B: series(300, i => 400 - i, () => 1e6), C: series(300, i => 100 + i, () => 10) };
const m = await deskMarket(["A", "B", "C", "D"], { snapshot: { pricesDate: "t" }, barsOf: s => bars[s] ?? [] });
assert.equal(m.liquid, 2);
assert.equal(m.stages.advancing, 1);
assert.equal(m.stages.declining, 1);
assert.equal(m.above200, 50);
assert.deepEqual(Object.keys(m.bySymbol).sort(), ["A", "B", "C"], "every company with history gets its stage");
console.log("ok: the mood counts the companies that trade; every one gets its stage");
