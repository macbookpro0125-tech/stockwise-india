// The gold and Nifty ETFs split their units in Dec 2019 (GOLDBEES 1:100,
// NIFTYBEES 1:10). The chart joins NSE's archive (on today's unit) and our
// own history; no day may jump 5× (22 Nov 2026: GOLDBEES showed ₹2,824 for
// ₹28 from Oct 2018 to Dec 2019, our history winning over the archive).
import assert from "node:assert/strict";
import { goldSilverChart } from "./gold-silver.js";

const { series } = await goldSilverChart();
assert.ok(series.length >= 2, "the chart's series");
for (const s of series) {
  for (let i = 1; i < s.closes.length; i++) {
    const r = s.closes[i] / s.closes[i - 1];
    assert.ok(r < 5 && r > 0.2, `${s.symbol} ${s.days[i - 1]} → ${s.days[i]}: ${s.closes[i - 1]} → ${s.closes[i]}`);
  }
  assert.deepEqual([...s.days].sort(), s.days, `${s.symbol}: days in order, once each`);
  assert.equal(new Set(s.days).size, s.days.length, `${s.symbol}: no day twice`);
}
console.log(`ok: gold, silver and Nifty on one unit throughout (${series.map(s => `${s.symbol} ${s.days[0]}–${s.days.at(-1)}`).join(", ")})`);
process.exit(0);
