// A strategy's snapshots as one list (24 Oct 2026: the same ten companies
// repeated in every snapshot, and "add the picked-up date"): each company
// once, from the first snapshot it was in — that day's price, today's, and
// the return since (the server's, adjusted for splits and bonuses after
// that day) — and, if it's no longer among the picks, the first snapshot it
// was missing from.
//
// snapshots: oldest first, { date, picks: [{ ticker, name, cmp, currentPrice, returnPct }] }
export function mergePicks(snapshots = []) {
  const byTicker = new Map();
  for (const snap of snapshots) {
    for (const p of snap.picks ?? []) {
      if (!byTicker.has(p.ticker)) byTicker.set(p.ticker, { ticker: p.ticker, name: p.name, firstDate: snap.date, entry: p.cmp, now: p.currentPrice ?? null, returnPct: p.returnPct ?? null, lastDate: snap.date });
      else byTicker.get(p.ticker).lastDate = snap.date;
    }
  }
  const latest = snapshots.at(-1)?.date ?? null;
  const rows = [...byTicker.values()].map(r => {
    // left: the first snapshot after the last one it was in
    const leftOn = r.lastDate === latest ? null : snapshots.find(s => s.date > r.lastDate)?.date ?? null;
    return { ...r, current: !leftOn, leftOn };
  });
  // still picked first, the longest-held first, then the best return; those that left after
  const byReturn = (a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity);
  rows.sort((a, b) => (a.current === b.current ? a.firstDate.localeCompare(b.firstDate) || byReturn(a, b) : a.current ? -1 : 1));
  return rows;
}
