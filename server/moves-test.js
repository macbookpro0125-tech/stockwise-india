// "Why is it moving?" — what can be seen around a move (moves.js):
// node server/moves-test.js
import assert from "node:assert/strict";
import { describeMove } from "./moves.js";

const asOf = "2026-10-21";
const base = { ret1d: null, ret1w: null, volume1d: null, avgVolume1m: null, events: [], latestQuarter: "2026-06-30", latestQuarterFiled: "2026-07-20", downFrom52wHigh: 30, upFrom52wLow: 40 };
const market = { name: "NIFTY 50", d1: 0.3, w1: 1.2 };
const it = { name: "Nifty IT", d1: 0.2, w1: 0.9 };
const texts = r => r.points.map(p => p.text);

// Its own move: the market and its sector barely moved; heavy trading, a
// filing and a headline that day — and an old filing, a routine one and
// last month's news left out
const own = describeMove({
  asOf, market, sector: it,
  row: { ...base, name: "Sterlite Technologies Limited", ret1d: -5, ret1w: -8, volume1d: 3_000_000, avgVolume1m: 1_000_000 },
  filings: [
    { title: "Press Release", summary: "The Company has received an order worth Rs 120 crore from a state utility.", date: "21-Oct-2026 14:20:11", url: "https://nsearchives.nseindia.com/x.pdf", review: { category: "Operations / outlook" } },
    { title: "Closure of Trading Window", summary: null, date: "20-Oct-2026 18:00:00", url: null, review: null },
    { title: "Press Release", summary: "Last month's plant visit", date: "01-Oct-2026 10:00:00", url: null, review: null },
  ],
  news: [
    { title: "Sterlite Tech shares fall as brokerage cuts target", publisher: "Mint", url: "https://example.test/a", date: "2026-10-21T08:00:00.000Z" },
    { title: "Sterlite Tech: an old story", publisher: "Mint", url: "https://example.test/b", date: "2026-10-01T08:00:00.000Z" },
    { title: "Laser Power & Infra Ltd (LASERPOWER) Share Price", publisher: "Business Today", url: "https://example.test/c", date: "2026-10-21T08:00:00.000Z" },
  ],
});
assert.equal(own.moves[0].text, "Down 5.0% on 21 Oct, while NIFTY 50 rose 0.3% and Nifty IT rose 0.2% — mostly a move of its own.");
assert.equal(own.moves[1].text, "Down 8.0% over the week to 21 Oct, while NIFTY 50 rose 1.2% and Nifty IT rose 0.9% — mostly a move of its own.");
assert.ok(texts(own).some(t => t === "Traded 3.0 times its usual daily volume (its one-month average) — far more buying and selling than usual."), "heavy trading");
assert.ok(own.points.some(p => p.kind === "filing" && p.text.includes("an order worth Rs 120 crore") && p.url && p.date === "2026-10-21"), "the day's filing, in NSE's own words, linked");
assert.ok(!texts(own).some(t => /Trading Window|plant visit/.test(t)), "a routine notice and last month's filing aren't shown");
assert.ok(own.points.some(p => p.kind === "news" && p.text.includes("Sterlite Tech shares fall as brokerage cuts target") && p.source === "Mint"), "the day's headline, with its publisher");
assert.ok(!texts(own).some(t => t.includes("an old story")), "last month's news isn't");
assert.ok(!texts(own).some(t => t.includes("LASERPOWER")), "nor a headline that doesn't name the company (the news search's near misses)");
assert.equal(own.quiet, false);

// The whole sector moved
const sectorWide = describeMove({ asOf, market, sector: { ...it, d1: 2.0 }, row: { ...base, ret1d: 2.1 }, filings: [], news: [] });
assert.equal(sectorWide.moves[0].text, "Up 2.1% on 21 Oct, in line with its sector — Nifty IT rose 2.0%.");

// The whole market moved (no sector index for it)
const marketWide = describeMove({ asOf, market: { ...market, d1: -1.4 }, sector: null, row: { ...base, ret1d: -1.5 }, filings: [], news: [] });
assert.equal(marketWide.moves[0].text, "Down 1.5% on 21 Oct, in line with the market — NIFTY 50 fell 1.4%.");

// A quiet day; a week too small to mention
const flat = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: 0.2, ret1w: 1.1 }, filings: [], news: [] });
assert.equal(flat.moves[0].text, "Little changed on 21 Oct (+0.2%).");
assert.equal(flat.moves.length, 1, "a week's move under 3% isn't worth a line");

// Down on its ex-dividend day: the payout leaves the company
const exDiv = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: -2.4, events: [{ date: "2026-10-20", kind: "action", title: "Dividend - Rs 5 Per Share" }] }, filings: [], news: [] });
assert.ok(texts(exDiv).some(t => t.startsWith("Went ex-dividend on 20 Oct (₹5 a share)")), "an ex-dividend day explains a drop of about the dividend");

// Results just out
const results = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: 6, latestQuarter: "2026-09-30", latestQuarterFiled: "2026-10-19", qSalesGrowthYoY: 18.2, qProfitGrowthYoY: -12.4 }, filings: [], news: [] });
assert.ok(texts(results).includes("Reported its results for the quarter to 30 Sept on 19 Oct: sales up 18%, profit down 12% from a year earlier."), "results filed in the last week, with their growth");

// Results due, and at a 52-week high
const ahead = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: 3.5, downFrom52wHigh: 0.4, events: [{ date: "2026-10-24", kind: "board", title: "Board meeting: financial results" }] }, filings: [], news: [] });
assert.ok(texts(ahead).includes("At its 52-week high."), "a new high");
assert.ok(texts(ahead).some(t => t.startsWith("Results are due: a board meeting on 24 Oct")), "results coming up");

// Nothing on record goes with it: said so, not made up
const quiet = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: -4 }, filings: [], news: [] });
assert.equal(quiet.quiet, true);
assert.ok(texts(quiet).some(t => t.startsWith("Nothing in NSE's records or the news")), "a move with nothing to show is said to be one");

// A small move with its sector flat isn't "in line" with it
const small = describeMove({ asOf, market, sector: { ...it, d1: 0.04 }, row: { ...base, ret1d: 0.6 }, filings: [], news: [] });
assert.equal(small.moves[0].text, "Up 0.6% on 21 Oct — a small move; NIFTY 50 rose 0.3% and Nifty IT was flat.");

// NSE's summaries in the company's words, without the "has informed the
// Exchange about" opening; housekeeping and the results filing itself
// (the results line says it) left out
const words = describeMove({ asOf, market, sector: it, row: { ...base, ret1d: -3, latestQuarter: "2026-09-30", latestQuarterFiled: "2026-10-19", qSalesGrowthYoY: 2 }, news: [], filings: [
  { title: "Press Release", summary: "XYZ Limited has informed the Exchange about receipt of an order worth Rs 50 crore", date: "21-Oct-2026 10:00:00", url: "https://nsearchives.nseindia.com/a.pdf", review: { priority: "Read for context", category: "Operations / outlook" } },
  { title: "Updates", summary: "XYZ Limited has informed the Exchange about Link of Recording", date: "20-Oct-2026 10:00:00", url: null, review: null },
  { title: "Investor Presentation", summary: "XYZ Limited has informed the Exchange about Investor Presentation", date: "19-Oct-2026 10:00:00", url: null, review: null },
  { title: "Updates", summary: "XYZ Limited has informed the Exchange about shifting of registered office of the Company.", date: "19-Oct-2026 10:00:00", url: null, review: null },
  { title: "Financial Results", summary: "XYZ Limited has submitted to the Exchange, the financial results for the period ended September 30, 2026.", date: "19-Oct-2026 10:00:00", url: null, review: { priority: "Routine disclosure", category: "Results / governance" } },
  { title: "ESOP/ESOS/ESPS", summary: "Allotment of 9138522 Shares.", date: "21-Oct-2026 10:00:00", url: null, review: null },
  { title: "ESOP/ESOS/ESPS", summary: "Grant of 82158 Options.", date: "21-Oct-2026 10:00:00", url: null, review: null },
  { title: "Postal Ballot", summary: "Notice of Postal Ballot", date: "20-Oct-2026 10:00:00", url: null, review: { priority: "Routine disclosure", category: "Results / governance" } },
  { title: "Updates", summary: "Disclosure under Regulation 30 and other applicable regulations of the SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015", date: "20-Oct-2026 10:00:00", url: null, review: null },
] });
const told = words.points.filter(p => p.kind === "filing");
assert.deepEqual(told.map(p => p.text), ["Told NSE on 21 Oct: “Receipt of an order worth Rs 50 crore”"], "the company's own words, without the boilerplate or the housekeeping");
assert.equal(told[0].label, "Operations / outlook", "a filing worth reading closely says what kind it is");

// No prices yet
const none = describeMove({ asOf, market, sector: it, row: base, filings: [], news: [] });
assert.equal(none.moves.length, 0);

console.log("ok: a move is described from the record — its size against the market and sector, trading, results, dividends, filings and news — and never given a reason of our own");
