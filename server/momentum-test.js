// The Momentum screen (momentum.js) on made-up price histories: a steady
// rise on a volume spike passes with a high score, a fall doesn't, a short
// history is set aside, a thin stock near its high is kept out, and a day
// with no passers comes back empty rather than loosened.
import assert from "node:assert/strict";
import { momentumStats, evaluateMomentum, screenMomentum, cleanMomentumConfig, momentumAllowed, momentumAudience, MOMENTUM_DEFAULTS, rsi14 } from "./momentum.js";

// Up 1.2, down 0.6, up 1.2 …: a steady climb with real down days (a straight
// line would put RSI at 100, past the blow-off limit)
function rising(n, { start = 150, volume = 1_000_000, lastVolume = 2_500_000 } = {}) {
  const days = [];
  let close = start;
  for (let i = 0; i < n; i++) {
    close += i % 2 ? -0.6 : 1.2;
    days.push({ close, high: close * 1.004, volume: i === n - 1 ? lastVolume : volume });
  }
  return days;
}
const falling = n => rising(n, { start: 400 }).map((d, i, all) => ({ ...all[all.length - 1 - i], volume: d.volume }));

// 1. A steady rise with a volume spike today passes, scoring high
const up = momentumStats(rising(250));
assert.ok(!up.insufficient);
assert.ok(up.close > up.sma20 && up.sma20 > up.sma50 && up.sma50 > up.sma200, "stacked averages");
assert.ok(up.pctFromHigh <= 1, `near its high (${up.pctFromHigh}%)`);
assert.ok(up.rsi14 > 55 && up.rsi14 < 80, `RSI in range (${up.rsi14})`);
const upEval = evaluateMomentum(up);
assert.equal(upEval.pass, true, `passes (failed: ${upEval.failed.join("; ")})`);
assert.ok(upEval.score > 90, `high score (${upEval.score})`);
assert.equal(upEval.volRatio, 2.33, "today's volume against the 20-session average (which includes today)");

// 2. A steady fall fails the uptrend
const down = evaluateMomentum(momentumStats(falling(250)));
assert.equal(down.pass, false);
assert.ok(down.failed.some(f => /stacked uptrend/.test(f)));

// 3. Under 210 sessions: set aside as too little history
const young = momentumStats(rising(150));
assert.deepEqual(young, { sessions: 150, insufficient: true });
assert.equal(evaluateMomentum(young).insufficient, true);

// 5. Near its high but thinly traded: kept out by the rupee-value gate
const thin = momentumStats(rising(250, { volume: 20_000, lastVolume: 50_000 }));
const thinEval = evaluateMomentum(thin);
assert.equal(thinEval.pass, false);
assert.ok(thinEval.failed.some(f => /Trades under ₹10 Cr a day/.test(f)), thinEval.failed.join("; "));
assert.ok(!thinEval.failed.some(f => /uptrend|52-week high/.test(f)), "everything else about it passes");

// And a penny stock on the same pattern is kept out on price
assert.ok(evaluateMomentum(momentumStats(rising(250, { start: 20, volume: 10_000_000, lastVolume: 25_000_000 }))).failed.some(f => /Price under ₹100/.test(f)));

// RSI is Wilder's — the one the Discover column and company page show
assert.equal(Math.round(rsi14([...Array(30)].map((_, i) => 100 + i))), 100);

// The screen over a universe, with a results date inside 30 days flagged
const snapshot = {
  pricesDate: "2026-10-08",
  momentum: { UPCO: up, DOWNCO: momentumStats(falling(250)), NEWCO: young, THINCO: thin },
  resultsDates: { UPCO: "2026-10-23" },
};
const rows = ["UPCO", "DOWNCO", "NEWCO", "THINCO", "NODATA"].map(symbol => ({ symbol, name: `${symbol} Ltd`, ret1m: 4.2 }));
const res = screenMomentum({ rows, snapshot, config: {} });
assert.deepEqual(res.counts, { screened: 5, insufficient: 1, noData: 1, passed: 1 });
assert.equal(res.passers[0].symbol, "UPCO");
assert.equal(res.passers[0].nextResults, "2026-10-23");
assert.equal(res.passers[0].resultsSoon, true, "results within 30 days: event risk");
assert.equal(res.resultsKnown, true);
assert.equal(screenMomentum({ rows, snapshot: { ...snapshot, resultsDates: null }, config: {} }).resultsKnown, false, "an unread calendar is unknown, not 'none due'");
assert.deepEqual(screenMomentum({ rows, snapshot, config: {}, symbols: ["thinco", "upco"] }).counts.screened, 2, "a list of symbols narrows the universe");

// 4. No passers: an empty list, nothing loosened, no crash
const none = screenMomentum({ rows: rows.filter(r => r.symbol !== "UPCO"), snapshot, config: {} });
assert.deepEqual(none.passers, []);
assert.equal(none.counts.passed, 0);
assert.deepEqual(none.config, MOMENTUM_DEFAULTS, "the defaults stand when nothing passes");
assert.deepEqual(screenMomentum({ rows: [], snapshot: null, config: {} }).passers, [], "no data at all is still an answer");
assert.equal(screenMomentum({ rows, snapshot: { pricesDate: "2026-10-08" }, config: {} }).available, false, "data without momentum figures is 'not available', not 'nothing passes'");
assert.equal(res.available, true);

// Settings: kept in range, RSI bounds put in order, junk ignored
assert.deepEqual(cleanMomentumConfig({ minPrice: "250", rsiMin: 85, rsiMax: 60, nearHighPct: -5, volSurge: "abc" }),
  { ...MOMENTUM_DEFAULTS, minPrice: 250, rsiMin: 60, rsiMax: 85, nearHighPct: 0 });

// Who sees the tab: off on the public host unless opened up
assert.equal(momentumAllowed({ email: "a@x.com" }, {}), true, "on in a copy on this Mac");
assert.equal(momentumAllowed({ email: "a@x.com" }, { RENDER: "true" }), false, "off on Render by default");
assert.equal(momentumAllowed({ email: "A@x.com" }, { RENDER: "true", MOMENTUM_USERS: "b@y.com, a@x.com" }), true, "named accounts, any case");
assert.equal(momentumAllowed({ email: "c@z.com" }, { RENDER: "true", MOMENTUM_USERS: "a@x.com" }), false);
assert.equal(momentumAllowed({ phone: "+911234567890" }, { MOMENTUM_USERS: "a@x.com" }), false, "a phone-only account isn't on an email list");
assert.equal(momentumAllowed(null, { RENDER: "true", MOMENTUM: "on" }), true);
assert.equal(momentumAllowed({ email: "a@x.com" }, { MOMENTUM: "off" }), false);
assert.equal(momentumAllowed(null, { RENDER: "true", MOMENTUM: " On " }), true, "typed by hand, any case");
assert.deepEqual([{}, { RENDER: "true" }, { RENDER: "true", MOMENTUM: "on" }, { RENDER: "true", MOMENTUM_USERS: "a@x.com" }, { MOMENTUM: "OFF" }].map(momentumAudience),
  ["everyone", "off", "everyone", "named accounts", "off"]);
console.log("All momentum checks passed.");
