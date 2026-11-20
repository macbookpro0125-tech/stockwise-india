// The trading journal's sums (TradeJournal.jsx): each trade's result, and how
// the closed ones went together. Plain arithmetic on what was entered.

// one trade: { pnl, pct, r, days, open } — an open trade against `price` when given
export function tradeResult(t, price = null) {
  const open = t.exitPrice == null;
  const at = open ? price : t.exitPrice;
  if (!(at > 0)) return { pnl: null, pct: null, r: null, days: null, open };
  const dir = t.side === "short" ? -1 : 1;
  const per = (at - t.entryPrice) * dir;
  const risk = t.stop != null ? Math.abs(t.entryPrice - t.stop) : null;
  const end = open ? null : t.exitDate;
  return {
    pnl: per * t.qty,
    pct: (per / t.entryPrice) * 100,
    r: risk > 0 ? per / risk : null,
    days: end ? Math.round((Date.parse(end) - Date.parse(t.entryDate)) / 86_400_000) : null,
    open,
  };
}

const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// the closed trades together, and by pattern
export function journalStats(trades) {
  const closed = trades.filter(t => t.exitPrice != null).map(t => ({ t, ...tradeResult(t) }));
  const wins = closed.filter(c => c.pnl > 0), losses = closed.filter(c => c.pnl < 0);
  const grossWin = wins.reduce((s, c) => s + c.pnl, 0), grossLoss = -losses.reduce((s, c) => s + c.pnl, 0);
  const rs = closed.map(c => c.r).filter(r => r != null);
  const bySetup = new Map();
  for (const c of closed) {
    const k = c.t.setup || "";
    const g = bySetup.get(k) ?? { setup: k, trades: 0, wins: 0, pnl: 0 };
    g.trades++; if (c.pnl > 0) g.wins++; g.pnl += c.pnl;
    bySetup.set(k, g);
  }
  return {
    closed: closed.length,
    open: trades.length - closed.length,
    wins: wins.length, losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : null,
    pnl: closed.reduce((s, c) => s + c.pnl, 0),
    avgWinPct: avg(wins.map(c => c.pct)), avgLossPct: avg(losses.map(c => c.pct)),
    // gains over losses, in rupees; none when nothing was lost
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    avgR: rs.length ? avg(rs) : null, withR: rs.length,
    avgDays: avg(closed.map(c => c.days).filter(d => d != null)),
    best: closed.length ? closed.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null,
    worst: closed.length ? closed.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null,
    bySetup: [...bySetup.values()].sort((a, b) => b.trades - a.trades),
  };
}
