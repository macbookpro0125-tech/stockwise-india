// Share changes read off NSE's daily price files (share-changes.js):
// node server/share-changes-test.js
import assert from "node:assert/strict";
import { rebaseRatio, nearFeedChange, detectRebases, suspendedAfter } from "./share-changes.js";

// CCAVENUE closed at 13.83 on 12 Oct 2026, didn't trade for four sessions,
// and reopened on 19 Oct against a previous close of 138.30: ten shares into one
assert.equal(rebaseRatio(13.83, 138.3), 0.1, "a ten-for-one consolidation: each share now counts as a tenth of one");
assert.equal(rebaseRatio(100, 50), 2, "a 1:1 bonus: twice the shares");
assert.equal(rebaseRatio(150, 100), 1.5, "a 1:2 bonus");
assert.equal(rebaseRatio(100, 100), null, "an ordinary day: the previous close is the last close");
assert.equal(rebaseRatio(100, 98), null, "a few per cent off isn't a rebase");
assert.equal(rebaseRatio(100, 0), null, "no previous close given");
assert.equal(rebaseRatio(100, 74.3), null, "a demerger's rebase (no clean ratio) isn't a change in the number of shares: left as before");
assert.equal(rebaseRatio(101.3, 50.6), 2, "prices on NSE's 5-paisa ticks still read as the clean ratio");

assert.equal(nearFeedChange([{ exDate: "2026-10-17", ratio: 2 }], "2026-10-19"), true, "the feed already has a change two days off: not counted twice");
assert.equal(nearFeedChange([{ exDate: "2026-06-01", ratio: 2 }], "2026-10-19"), false, "four months away is another event");
assert.equal(nearFeedChange(undefined, "2026-10-19"), false, "no feed changes for the company");

// The year's days, newest first, as the year walk reads them
const day = (date, rows) => ({ date, rows: new Map(Object.entries(rows)) });
const days = [
  day("2026-10-20", { CCAVENUE: { close: 130.05, prevClose: 130.05, series: "EQ" }, BONUSCO: { close: 51, prevClose: 50, series: "EQ" } }),
  day("2026-10-19", { CCAVENUE: { close: 130.05, prevClose: 138.3, series: "EQ" }, BONUSCO: { close: 50, prevClose: 50.5, series: "EQ" }, SWITCHCO: { close: 40, prevClose: 30, series: "EQ" } }),
  day("2026-10-12", { CCAVENUE: { close: 13.83, prevClose: 14.9, series: "EQ" }, BONUSCO: { close: 101, prevClose: 100, series: "EQ" }, SWITCHCO: { close: 41, prevClose: 40, series: "BE" } }),
];
const found = detectRebases(days, { BONUSCO: [{ exDate: "2026-10-19", ratio: 2 }] });
assert.deepEqual(found.CCAVENUE, [{ exDate: "2026-10-19", ratio: 0.1, detected: true }], "CCAVENUE's consolidation is found, dated the day it reopened");
assert.equal(found.BONUSCO, undefined, "a bonus the feed already has isn't added again");
assert.equal(found.SWITCHCO, undefined, "a move from the BE series to EQ isn't a rebase: the previous close is the other series' own");

// A session the walk didn't read (Budget day, Sunday 1 Feb 2026 — the walk
// skips weekends) puts every stock's previous close a session apart: on
// Monday dozens looked "rebased" by a clean-looking 10/9 or 9/8
const busy = [
  day("2026-02-02", Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`ETF${i}`, { close: 100, prevClose: 90, series: "EQ" }]))),
  day("2026-01-30", Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`ETF${i}`, { close: 100, prevClose: 99, series: "EQ" }]))),
];
assert.deepEqual(detectRebases(busy), {}, "dozens rebased on the same session are a missed session, not share changes");
// …and a stock that doesn't trade every day meets the missed session later
// in the walk, or on the session after: still not a share change
const busy2 = [
  day("2026-02-03", { THINCO: { close: 50, prevClose: 45, series: "EQ" } }),
  busy[0],
  day("2026-01-30", { ...Object.fromEntries(busy[1].rows), THINCO: { close: 40, prevClose: 40, series: "EQ" } }),
  day("2026-01-27", { SMECO: { close: 80, prevClose: 80, series: "SM" } }),
];
busy2[1].rows.set("SMECO", { close: 100, prevClose: 70, series: "SM" });
assert.deepEqual(detectRebases(busy2), {}, "nor a rebase whose stretch takes in the missed session");

// MBECL traded until mid-2024, was suspended two years in insolvency and
// relisted in Sep 2026 on a fresh base: "+8,892% over three years" was the
// relisting. Missing from two quarter-ends running, a company has no return
// over the years that include them
const q = (date, ...syms) => ({ date, present: new Set(syms) });
const quarters = [q("2023-12-29", "MBECL", "THINCO", "STEADY"), q("2024-03-28", "MBECL", "STEADY"), q("2024-06-28", "MBECL", "THINCO", "STEADY"),
  q("2024-09-30", "THINCO", "STEADY"), q("2024-12-31", "STEADY"), q("2025-03-28", "THINCO", "STEADY"), q("2026-09-30", "MBECL", "THINCO", "STEADY")];
const gone = suspendedAfter(quarters, "2023-10-20", ["MBECL", "THINCO", "STEADY"]);
assert.deepEqual([...gone], ["MBECL"], "missing from two quarter-ends running: suspended; missing from one (a thin day): not");
assert.deepEqual([...suspendedAfter(quarters, "2025-01-15", ["MBECL"])], [], "a gap before the period began doesn't count");

console.log("ok: rebased prices are read as share changes, once, and only within a series");
