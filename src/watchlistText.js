// What the Watchlist says (WatchlistView.jsx draws it; 26 Oct 2026: "it is
// not much useful"): one line for the whole list, up to three things that
// need a look, and for each company the change since it was added and the
// one note most worth reading. Plain functions of the rows the page already
// has (the screen's rows, server/screen.js), so every case can be tested
// (watchlistText.test.js). Observations, never a buy or sell call.
import { cardName } from "./stockName.js";

const num = v => v != null && Number.isFinite(Number(v));
const pct = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`;
const DAY = 86_400_000;
const dayOf = iso => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
const daysFrom = (iso, today) => Math.round((dayOf(iso) - dayOf(today)) / DAY);
const weekday = iso => dayOf(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
const short = iso => dayOf(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// The change since a company was added, at the price shown
export function sinceAdded(item, price) {
  return num(price) && item?.addedPrice > 0 ? ((price - item.addedPrice) / item.addedPrice) * 100 : null;
}

// "8 companies · today −0.6% on average · since added +1.2%" — an average
// of each company's move, not of a portfolio (there are no quantities)
export function summaryLine(items, rowOf, priceOf) {
  const n = items.length;
  if (!n) return null;
  const today = items.map(i => rowOf(i.ticker)?.ret1d).filter(num);
  const since = items.map(i => sinceAdded(i, priceOf(i.ticker))).filter(num);
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    count: `${n} ${n === 1 ? "company" : "companies"}`,
    today: today.length ? avg(today) : null,
    since: since.length ? avg(since) : null,
  };
}

// A big move at the last close (5% or more), and what the filings said that
// day if anything — its results' profit, when they came out with the move
const BIG = 5;
// (news: the watchlist's news items, newest first — any filed that day)
function moveReason(news, symbol, date) {
  const that = (news ?? []).filter(i => (i.symbol === symbol || (i.companies ?? []).some(c => c.symbol === symbol)) && String(i.time ?? "").slice(0, 10) === date);
  const results = that.find(i => i.numbers?.profitYoY != null) ?? that.find(i => i.kind === "results");
  if (results?.numbers?.profitYoY != null) return `after its results (profit ${pct(results.numbers.profitYoY, 0)})`;
  if (results) return "after its results";
  return null;
}

// Up to three things to look at, most pressing first: a big move at the last
// close, results in the coming week (two at most, so one kind can't fill the
// box), a price far under its fair value
export function needsALook(items, rowOf, priceOf, { today, pricesDate, news } = {}) {
  const out = [];
  for (const i of items) {
    const r = rowOf(i.ticker);
    if (!r) continue;
    const name = cardName(r.name ?? i.ticker);
    if (r.nextResults && today) {
      const d = daysFrom(r.nextResults, today);
      if (d >= 0 && d <= 7) out.push({ kind: "results", rank: 1 + d / 10, symbol: i.ticker, name, text: `reports results ${d === 0 ? "today" : d === 1 ? "tomorrow" : `on ${weekday(r.nextResults)}`}` });
    }
    if (num(r.ret1d) && Math.abs(r.ret1d) >= BIG) {
      const why = pricesDate ? moveReason(news, i.ticker, pricesDate) : null;
      out.push({ kind: r.ret1d > 0 ? "up" : "down", rank: 1 - Math.min(1, Math.abs(r.ret1d) / 100), symbol: i.ticker, name, text: `${r.ret1d > 0 ? "rose" : "fell"} ${Math.abs(r.ret1d).toFixed(0)}%${pricesDate ? ` on ${short(pricesDate)}` : ""}${why ? `, ${why}` : ""}` });
    }
    const price = priceOf(i.ticker);
    if (num(r.fv25) && r.fv25 > 0 && num(price) && price > 0) {
      const under = (1 - price / r.fv25) * 100;
      if (under >= 25) out.push({ kind: "value", rank: 2 - under / 100, symbol: i.ticker, name, text: `is ${under.toFixed(0)}% under its fair value` });
    }
  }
  const seen = {};
  return out.sort((a, b) => a.rank - b.rank).filter(x => (seen[x.kind] = (seen[x.kind] ?? 0) + 1) <= 2).slice(0, 3);
}

// The one note under a company's name, the most useful first: results soon,
// where it sits against the user's own levels, its fair value, results just
// out, the user's own note, a dividend date, else its quality score
export function rowNote(item, r, price, { today, level, nextEvent } = {}) {
  if (!r) return null;
  if (r.nextResults && today) {
    const d = daysFrom(r.nextResults, today);
    if (d >= 0 && d <= 14) return { tag: `Results ${short(r.nextResults)}` };
  }
  if (level) return { text: level.label, tone: level.color };
  if (num(r.fv25) && r.fv25 > 0 && num(price) && price > 0) {
    const gap = (1 - price / r.fv25) * 100;
    if (gap >= 10) return { text: `${gap.toFixed(0)}% under fair value` };
    if (gap <= -10) return { text: "above its fair value" };
  }
  if (r.latestQuarterFiled && today) {
    const d = -daysFrom(r.latestQuarterFiled, today);
    if (d >= 0 && d <= 10) return { text: `results out ${short(r.latestQuarterFiled)}` };
  }
  if (item?.note) return { text: `your note: ${item.note}`, note: true };
  if (nextEvent) return { text: nextEvent.text };
  if (num(r.research?.quality)) return { text: `quality ${Math.round(r.research.quality)}/100` };
  return null;
}

export { pct as signedPct };
