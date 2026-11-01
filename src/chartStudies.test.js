// The chart's longer list of indicators: node src/chartStudies.test.js
import assert from "node:assert/strict";
import { STUDIES, smaN, emaN, zigzag, darvas, candlePatterns, lineBreak, kagi } from "./chartStudies.js";

assert.deepEqual(smaN([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
assert.deepEqual(emaN([2, 4, 6], 2), [null, 3, 5]);

// Three hundred days that rise, fall and wobble
const bars = Array.from({ length: 300 }, (_, i) => {
  const c = 100 + 30 * Math.sin(i / 17) + 8 * Math.sin(i / 3) + i * 0.05;
  const d = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10);
  return { date: d, open: c - Math.sin(i), high: c + 2 + Math.abs(Math.cos(i)), low: c - 2 - Math.abs(Math.sin(i)), close: c, volume: 1000 + (i % 7) * 100 };
});
for (const s of STUDIES) {
  const lines = s.calc(bars);
  if (s.markers) { assert.ok(s.markers(bars).length > 0, `${s.id} marks something`); continue; }
  assert.ok(lines.length > 0, `${s.id} draws`);
  for (const l of lines) {
    assert.equal(l.values.length, bars.length, `${s.id} ${l.label}: one value per bar`);
    assert.ok(l.values.some(v => v != null && Number.isFinite(v)), `${s.id} ${l.label} has values`);
  }
  // none fail on too few bars or no volume
  s.calc(bars.slice(0, 3).map(b => ({ ...b, volume: null })));
}
assert.equal(new Set(STUDIES.map(s => s.id)).size, STUDIES.length, "ids are unique");

const by = id => STUDIES.find(s => s.id === id).calc(bars);
// Worked by hand on a plain series
const up = Array.from({ length: 40 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 100 }));
const of = id => STUDIES.find(s => s.id === id).calc(up);
assert.equal(of("roc")[0].values[12], 12, "ROC: 112 against 100 is 12%");
assert.equal(of("momentum")[0].values[10], 10, "Momentum: 110 less 100");
assert.equal(of("median")[0].values[5], 105, "Median: the middle of high and low");
assert.equal(of("tr")[0].values[5], 2, "True range");
assert.equal(of("cmo")[0].values[20], 100, "CMO: only up days is 100");
assert.ok(Math.abs(of("lrr2")[0].values[20] - 1) < 1e-9, "R² of a straight line is 1");
assert.ok(Math.abs(of("lrslope")[0].values[20] - 1) < 1e-9, "Slope of a line rising 1 a day");
assert.ok(Math.abs(of("tsf")[0].values[20] - 121) < 1e-9, "Forecast: the line's next point");
assert.ok(by("aroon")[0].values[100] >= 0 && by("aroon")[0].values[100] <= 100, "Aroon stays 0 to 100");
assert.equal(of("aroon")[0].values[30], 100, "Aroon up: a new high today is 100");

// Patterns
const b = (open, high, low, close) => ({ date: "2026-01-01", open, high, low, close, volume: 1 });
const names = rows => candlePatterns(rows).map(p => p.text);
assert.deepEqual(names([b(100, 101, 99, 100.5), b(100, 105, 95, 100.1)]), ["Doji"]);
assert.deepEqual(names([b(105, 106, 99, 100), b(99, 108, 98.5, 107)]), ["Bullish engulfing"]);
assert.deepEqual(names([b(100, 106, 99, 105), b(106, 107, 98, 99)]), ["Bearish engulfing"]);
assert.deepEqual(names([b(100, 101, 99, 100.5), b(100, 102, 90, 101.5)]), ["Hammer"]);

// ZigZag turns at the swings; Darvas keeps its box till the price leaves
const swing = [100, 110, 120, 110, 100, 90, 100, 112].map((c, i) => ({ date: `2026-01-0${i + 1}`, open: c, high: c, low: c, close: c, volume: 1 }));
const z = zigzag(swing, 5);
assert.equal(z[2], 120); assert.equal(z[5], 90);
assert.equal(z.length, swing.length);
const d = darvas([10, 12, 15, 14, 13, 13, 14, 14, 20].map((c, i) => ({ date: "x", open: c, high: c, low: c, close: c, volume: 1 })));
assert.equal(d.top[5], 15, "a high not passed for three bars tops the box");
assert.equal(d.top[8], null, "gone once the price leaves it");

// Line break: new bars only past the last three; Kagi: turns at 4%
const lb = lineBreak([100, 101, 102, 103, 102.5, 99, 104].map((c, i) => ({ date: `d${i}`, open: c, high: c, low: c, close: c })));
assert.deepEqual(lb.map(r => r.close), [100, 101, 102, 103, 99, 104]);
const kg = kagi([100, 105, 110, 108, 104, 100, 106].map((c, i) => ({ date: `d${i}`, close: c })));
assert.deepEqual(kg.map(k => k.value), [100, 105, 110, 104, 100, 106]);
console.log(`chartStudies tests passed (${STUDIES.length} indicators)`);
