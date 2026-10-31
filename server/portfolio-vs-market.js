// Your portfolio against the market (31 Oct 2026): what your holdings have
// been worth each day, beside what the same money would be worth had it gone
// into the Nifty 500 on the same days. Each lot's cost goes into the index on
// its buy date, so buying more moves both lines alike and only the choice of
// companies makes them part.
//
// A lot with no buy date, or one bought before the index's kept days begin,
// joins both lines on the first day shown, at that day's prices — the chart
// says how many were placed so. Prices are NSE's closes, on today's share
// basis (price-history.js), so a split doesn't show as a fall. Dividends,
// fees and taxes are left out of both.

const DAY = 86_400_000;
const isoDay = t => new Date(t).toISOString().slice(0, 10);

// holdings: [{ ticker, qty, buyPrice, buyDate }]
// indexDays: [[date, close]] oldest first (index-history.js)
// barsOf(ticker): [{ date, close }] oldest first
// Returns null when there's nothing to draw.
export function portfolioVsMarket(holdings, indexDays, barsOf, { maxPoints = 260 } = {}) {
  if (!holdings?.length || !indexDays?.length) return null;
  const last = indexDays[indexDays.length - 1][0];
  // from the earliest buy date (or a year back when none has one), not before
  // the index's kept days, at most five years
  const dated = holdings.map(h => h.buyDate).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "")).sort();
  const floor = isoDay(Date.parse(`${last}T00:00:00Z`) - 5 * 365 * DAY);
  let from = dated[0] ?? isoDay(Date.parse(`${last}T00:00:00Z`) - 365 * DAY);
  if (from < floor) from = floor;
  const days = indexDays.filter(([d, c]) => d >= from && c > 0);
  if (days.length < 2) return null;
  const start = days[0][0];

  // each company's close by date, carried forward over a day it didn't trade
  const closes = new Map();
  for (const t of new Set(holdings.map(h => h.ticker))) {
    const byDate = new Map((barsOf(t) ?? []).filter(b => b.close > 0).map(b => [b.date, b.close]));
    let carry = null;
    const series = new Map();
    // the last close before the window, so a lot is priced from day one
    for (const b of barsOf(t) ?? []) if (b.date < start && b.close > 0) carry = b.close;
    for (const [d] of days) { if (byDate.has(d)) carry = byDate.get(d); series.set(d, carry); }
    closes.set(t, series);
  }

  // when each lot joins, and how many index "units" its money buys then
  let placed = 0, unpriced = 0;
  const lots = holdings.map(h => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(h.buyDate ?? "");
    let join = ok && h.buyDate > start ? days.find(([d]) => d >= h.buyDate)?.[0] : start;
    if (!join) return null; // bought after the last kept day
    if (!ok || h.buyDate < start) placed++;
    const px = closes.get(h.ticker).get(join);
    if (!(px > 0)) { unpriced++; return null; }
    // the money in: what was paid when the date is in the window, else that day's value
    const cost = ok && h.buyDate >= start ? h.qty * h.buyPrice : h.qty * px;
    const idx = days.find(([d]) => d === join)[1];
    return { ticker: h.ticker, qty: h.qty, join, cost, units: cost / idx };
  }).filter(Boolean);
  if (!lots.length) return null;

  const points = days.map(([d, idx]) => {
    let you = 0, market = 0, invested = 0;
    for (const l of lots) {
      if (d < l.join) continue;
      const px = closes.get(l.ticker).get(d);
      you += l.qty * (px ?? 0);
      market += l.units * idx;
      invested += l.cost;
    }
    return { date: d, you: Math.round(you), market: Math.round(market), invested: Math.round(invested) };
  }).filter(p => p.invested > 0);

  // thinned evenly for drawing, the first and last days kept
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const thin = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const end = points[points.length - 1];
  return {
    benchmark: "Nifty 500", from: points[0].date, to: end.date, points: thin,
    you: end.you, market: end.market, invested: end.invested,
    // ahead (+) or behind (−) the market, as a share of what the market line is worth
    edgePct: end.market > 0 ? Math.round(((end.you - end.market) / end.market) * 1000) / 10 : null,
    lots: lots.length, placedAtStart: placed, unpriced,
  };
}
