// The companies this browser opened lately, newest first (12 Nov 2026): an
// empty watchlist offers them to follow — often what a visitor looked at
// before signing up. Symbols only, kept in this browser.
const KEY = "jocular-recent-stocks";
const ok = s => typeof s === "string" && /^[A-Z0-9&_.-]{1,20}$/.test(s);

export function recentStocks() {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(l) ? l.filter(ok) : [];
  } catch { return []; }
}

export function rememberStock(symbol) {
  if (!ok(symbol)) return;
  try { localStorage.setItem(KEY, JSON.stringify([symbol, ...recentStocks().filter(s => s !== symbol)].slice(0, 12))); } catch {}
}
