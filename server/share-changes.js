// Share changes read off NSE's own daily price files (22 Oct 2026). When NSE
// adjusts a stock for a split, a bonus, a consolidation or a demerger, the
// next session's "previous close" is the old close rebased: CCAVENUE closed
// at 13.83 on 12 Oct 2026, didn't trade for four sessions, and reopened on 19
// Oct against a previous close of 138.30 — ten shares into one. NSE's
// corporate actions feed doesn't carry every such event (CCAVENUE's isn't
// there), and without it the consolidation read as a 673% gain in a month at
// the top of Top Gainers. The year walk (market-data.js yearOfDays) adds
// these to the feed's splits, so returns, the 52-week range and the charts
// are on today's share basis whichever way NSE announced the change.

// A previous close more than 5% off the last close; an ordinary session's is
// the last close exactly
const REBASE_MIN = 0.05;
const DAY = 86400000;

// A change in the number of shares is a clean ratio — 2 (a 1:1 bonus), 3/2
// (1:2), 5 (₹10 into ₹2), 1/10 (ten into one). A demerger's rebase isn't
// (the parent keeps 74.3% of its value, say): it isn't a change in the
// number of shares, and is left as it was, for per-share history's sake
const CLEAN = (() => {
  const out = new Set();
  for (let p = 1; p <= 20; p++) for (let q = 1; q <= 10; q++) out.add(p / q);
  return [...out];
})();

// The share-count multiplier a rebase implies (2 for a 1:1 bonus, 0.1 for
// ten shares into one), or null for an ordinary session or a demerger
export function rebaseRatio(lastClose, prevClose) {
  if (!(lastClose > 0) || !(prevClose > 0)) return null;
  const ratio = lastClose / prevClose;
  if (Math.abs(ratio - 1) <= REBASE_MIN) return null;
  // within 0.5%: closes are on NSE's 5-paisa ticks
  const clean = CLEAN.find(c => Math.abs(ratio / c - 1) <= 0.005);
  return clean ? Math.round(clean * 10000) / 10000 : null;
}

// More than this many on one session isn't share changes but a session the
// walk didn't read — a weekend one (Budget day, Sunday 1 Feb 2026) or a file
// that didn't download — which puts every previous close a session apart
const MAX_PER_SESSION = 5;

// The feed already has a change within ten days: the rebase is that one
export const nearFeedChange = (feed, iso, windowDays = 10) =>
  (feed ?? []).some(s => Math.abs(Date.parse(s.exDate) - Date.parse(iso)) <= windowDays * DAY);

// Fed the year's sessions newest first (see(date, rows), rows a Map of
// symbol → { close, prevClose, series }), it finds each rebase, dated the
// session it showed in — when the session before it was in the same series
// (a stock moving from BE to EQ carries the other series' own previous
// close) and the feed hasn't got it. The year walk asks found before
// adjusting each older session, so a rebase applies to every day before it.
export function rebaseTracker(feedSplits = {}) {
  const found = {};
  const newer = new Map(); // symbol → the newer session's { prevClose, series, date }
  // Sessions after which one wasn't read: no rebase across them counts — a
  // stock that doesn't trade every day meets one later in the walk, or a
  // session after it
  const missedBefore = new Set();
  return {
    found,
    see(date, rows) {
      const seen = [];
      for (const [sym, v] of rows) {
        const after = newer.get(sym);
        const ratio = after && after.series === v.series ? rebaseRatio(v.close, after.prevClose) : null;
        if (ratio && !nearFeedChange(feedSplits[sym], after.date)) seen.push([sym, { exDate: after.date, ratio, detected: true }]);
        newer.set(sym, { prevClose: v.prevClose, series: v.series, date });
      }
      const perSession = {};
      for (const [, c] of seen) perSession[c.exDate] = (perSession[c.exDate] ?? 0) + 1;
      for (const [d, n] of Object.entries(perSession)) if (n > MAX_PER_SESSION) missedBefore.add(d);
      const spansMissed = c => [...missedBefore].some(d => d > date && d <= c.exDate);
      for (const [sym, c] of seen) if (!spansMissed(c)) (found[sym] ||= []).push(c);
    },
  };
}

// The same over a list of days ([{ date, rows }], newest first)
export function detectRebases(days, feedSplits = {}) {
  const tracker = rebaseTracker(feedSplits);
  for (const day of days) tracker.see(day.date, day.rows);
  return tracker.found;
}

// Over the years: a company missing from two quarter-ends running after
// fromIso (checkpoints [{ date, present: Set }], oldest first) stopped trading
// for months — MBECL, suspended mid-2024 to Sep 2026 in insolvency and
// relisted on a fresh ₹10 base, showed "+8,892% over three years". Its old
// shares and today's aren't the same thing, so it has no return over those
// years (market-data.js periodReturns). One missing quarter-end is only a
// thinly traded day.
export function suspendedAfter(checkpoints, fromIso, symbols) {
  const out = new Set();
  const after = checkpoints.filter(c => c.date > fromIso);
  for (const sym of symbols) {
    let run = 0;
    for (const c of after) {
      run = c.present.has(sym) ? 0 : run + 1;
      if (run >= 2) { out.add(sym); break; }
    }
  }
  return out;
}
