// Testing a rule on past prices (backtest.js)
import assert from "node:assert/strict";
import { backtest, signals, rsi, maxDrawdown } from "./backtest.js";

const day = i => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10);
const bars = closes => closes.map((c, i) => ({ date: day(i), open: c, high: c * 1.01, low: c * 0.99, close: c }));

// a steady climb: the average rule buys once and holds to the end
const up = bars(Array.from({ length: 300 }, (_, i) => 100 + i));
const r = backtest(up, { rule: "ma", n: 20, cost: 0 });
assert.equal(r.trades.length, 0, "never sold");
assert.ok(r.openTrade, "still holding");
assert.ok(r.total > 100 && Math.abs(r.total - r.holdTotal) < 5, "close to holding");
console.log("ok: a steady climb is bought and held");

// trades happen the day after the signal, at its open
const zig = bars([...Array.from({ length: 30 }, () => 100), ...Array.from({ length: 10 }, (_, i) => 110 + i), ...Array.from({ length: 10 }, (_, i) => 90 - i)]);
const s = signals(zig, "ma", 20);
const buyDay = s.indexOf("buy");
const z = backtest(zig, { rule: "ma", n: 20, cost: 0 });
assert.equal(z.trades.length, 1);
assert.equal(z.trades[0].entryDate, day(buyDay + 1), "bought at the next day's open");
assert.ok(z.trades[0].pct < 0, "bought high, sold low");
console.log("ok: the trade follows the signal by a day");

// a stop sells during the day at the stop price
// (a day that dips far under the stop but closes high, so only the stop sells)
const drop = bars([...Array.from({ length: 40 }, (_, i) => 100 + i), 140]);
drop[40].low = 110;
const st = backtest(drop, { rule: "ma", n: 20, stop: 5, cost: 0 });
const stopped = st.trades.find(t => t.why === "stop");
assert.ok(stopped, "the stop was hit");
assert.ok(stopped.exitPrice <= stopped.entryPrice * 0.95 + 0.01, "sold at (or under) the stop");
console.log("ok: a stop-loss");

// costs come off each buy and sell
const c0 = backtest(zig, { rule: "ma", n: 20, cost: 0 }), c1 = backtest(zig, { rule: "ma", n: 20, cost: 0.01 });
assert.ok(c1.total < c0.total);
console.log("ok: costs lower the result");

// RSI: a fall pushes it low, a rise high
const rs = rsi([...Array.from({ length: 20 }, (_, i) => 100 - i), ...Array.from({ length: 20 }, (_, i) => 80 + i * 2)]);
assert.ok(rs[19] < 10 && rs[39] > 70);
assert.equal(maxDrawdown([{ value: 100 }, { value: 120 }, { value: 90 }, { value: 130 }]), -25);
assert.equal(backtest(bars([1, 2, 3])), null, "too short");
console.log("ok: RSI, the worst fall, and too little history");
