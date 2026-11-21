// "Since you were last here" (21 Nov 2026, the owner: on the phone and the
// computer's Home): what changed for your watchlist's companies since your
// last visit on an earlier close: the biggest moves, results filed, corporate
// actions. Kept in this browser only: each visit's closing prices, and the
// one before, so a reload the same day keeps the same comparison.
export const SINCE_KEY = "jocular-since-last";
export const BIG_MOVE = 2; // %, the smallest move worth a line

// saved: what this browser kept ({ current: { at, prices }, prev }), or null.
// asOf: today's close date. Returns { baseline, next }: the visit to compare
// with (null on a first visit), and what to keep now.
export function pickBaseline(saved, asOf, rows) {
  const now = { at: asOf, prices: Object.fromEntries(rows.filter(r => r.cmp > 0).map(r => [r.symbol, r.cmp])) };
  if (!saved?.current?.at || !asOf) return { baseline: null, next: { current: now, prev: null } };
  if (saved.current.at === asOf) return { baseline: saved.prev ?? null, next: { current: now, prev: saved.prev ?? null } };
  if (saved.current.at > asOf) return { baseline: null, next: { current: now, prev: null } };
  return { baseline: saved.current, next: { current: now, prev: saved.current } };
}

// rows: the watchlist (symbol, name, cmp, latestQuarterFiled, events).
// Returns { since, moves: [{ symbol, name, pct }], results: [{ symbol, name, filed }], actions: [{ symbol, name, title, date }], count }
export function sinceLast(baseline, rows) {
  if (!baseline?.at) return null;
  const since = baseline.at;
  const moves = rows
    .filter(r => r.cmp > 0 && baseline.prices?.[r.symbol] > 0)
    .map(r => ({ symbol: r.symbol, name: r.name, pct: (r.cmp / baseline.prices[r.symbol] - 1) * 100 }))
    .filter(m => Math.abs(m.pct) >= BIG_MOVE)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 3);
  const results = rows.filter(r => r.latestQuarterFiled && r.latestQuarterFiled > since)
    .map(r => ({ symbol: r.symbol, name: r.name, filed: r.latestQuarterFiled }))
    .sort((a, b) => b.filed.localeCompare(a.filed));
  const actions = rows.flatMap(r => (r.events ?? []).filter(e => e.date > since && e.kind === "action").map(e => ({ symbol: r.symbol, name: r.name, title: e.title, date: e.date })))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return { since, moves, results, actions, count: rows.length };
}
