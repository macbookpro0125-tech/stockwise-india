// "My order" on the Watchlist (20 Nov 2026, the owner: "move them to the top
// or anywhere by holding them"): the order someone dragged their companies
// into, kept on the account (server/user-watchlist.js setWatchOrder).

// The whole watchlist: new ones (no position yet) first, newest first, then
// the dragged order. A list: its tickers as the server orders them.
export function mineOrder(items, listTickers = null) {
  if (listTickers) {
    const at = new Map(listTickers.map((t, i) => [t, i]));
    return [...items].sort((a, b) => (at.get(a.ticker) ?? -1) - (at.get(b.ticker) ?? -1));
  }
  return [...items].sort((a, b) => {
    const pa = a.position ?? null, pb = b.position ?? null;
    if (pa == null || pb == null) return pa == null && pb == null ? String(b.addedAt).localeCompare(String(a.addedAt)) : pa == null ? -1 : 1;
    return pa - pb;
  });
}

// The tickers with one moved from `from` to `to`
export function moved(tickers, from, to) {
  const out = [...tickers];
  const [t] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, t);
  return out;
}

// Where a dragged row lands: rows' tops and heights (page px), the dragged
// one's index and how far it has moved
export function dropIndex(rows, from, dy) {
  if (!rows.length) return 0;
  const centre = rows[from].top + rows[from].height / 2 + dy;
  let to = 0;
  for (let i = 0; i < rows.length; i++) if (centre > rows[i].top + rows[i].height / 2) to = i;
  // moving down past its own place counts the gap it leaves
  if (dy < 0) { to = rows.length - 1; for (let i = rows.length - 1; i >= 0; i--) if (centre < rows[i].top + rows[i].height / 2) to = i; }
  return Math.max(0, Math.min(rows.length - 1, to));
}
