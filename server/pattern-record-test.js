// node --no-warnings server/pattern-record-test.js — how each pattern has done (pattern-record.js)
import assert from "node:assert/strict";
import { patternRecord } from "./pattern-record.js";

// daily bars from 2022, weekdays only
function series(n, f, vol = () => 1e6) {
  const out = []; const d = new Date("2022-01-03T00:00:00Z");
  for (let i = 0; i < n; i++) {
    while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
    const c = f(i);
    out.push({ date: d.toISOString().slice(0, 10), open: c, high: c * 1.01, low: c * 0.99, close: c, volume: vol(i) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const N = 900;
const bars = { UP: series(N, i => 100 * Math.pow(1.0015, i)), FLAT: series(N, i => 100 + (i % 5)), NIFTYBEES: series(N, i => 100 * Math.pow(1.0005, i)) };
const r = patternRecord(["UP", "FLAT"], s => bars[s], { years: 2 });
assert.ok(r.weeks > 60, `weeks: ${r.weeks}`);
const near = r.patterns.nearHigh;
assert.ok(near.count > 0 && near.companies === 1, "the climbing company sits at its highs");
// it rose 0.15% a day: about 3% a month (bought the next day), ahead of the Nifty
assert.ok(Math.abs(near.h["1M"].median - 3.0) < 0.3, `1M ${near.h["1M"].median}`);
assert.equal(near.h["1M"].rose, 100);
assert.equal(near.h["1M"].beatNifty, 100);
assert.ok(near.h["3M"].median > near.h["1M"].median);
// the trend template needs strength 70+: the climber leads two companies
assert.ok(r.patterns.trendTemplate.count > 0);
// too little history: none
assert.equal(patternRecord(["UP"], s => (s === "NIFTYBEES" ? [] : bars[s])), null, "no benchmark, no record");
console.log("ok: each week's patterns, and what followed against the Nifty");
