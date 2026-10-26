// What the Portfolio says (PortfolioView.jsx draws it; 26 Oct 2026, redone
// in the Watchlist's way): the whole portfolio in a card — its value, the
// day's change and the change against what was paid, and the dividends it
// yields — then up to three things that need a look, and for each holding the
// one note most worth reading. Plain functions of the holdings and their rows
// (server/http-server.js /api/portfolio), tested (portfolioText.test.js).
// Price-based, before fees and taxes; observations, never a buy or sell call.
import { cardName } from "./stockName.js";

const num = v => v != null && Number.isFinite(Number(v));
const DAY = 86_400_000;
const dayOf = iso => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
const daysFrom = (iso, today) => Math.round((dayOf(iso) - dayOf(today)) / DAY);
const weekday = iso => dayOf(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
const short = iso => dayOf(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export const rupees = v => `${v < 0 ? "−" : ""}₹${Math.round(Math.abs(v)).toLocaleString("en-IN")}`;

// A holding with its value now: { ...h, cmp, invested, value, gain, gainPct, day }
// (day: the rupees it moved at the last close, from the day's % move)
export function priced(h, price, row) {
  const invested = h.buyPrice * h.qty;
  const value = num(price) && price > 0 ? price * h.qty : null;
  const gain = value != null ? value - invested : null;
  const r1 = row?.ret1d;
  const day = value != null && num(r1) ? value - value / (1 + r1 / 100) : null;
  return { ...h, cmp: num(price) ? price : null, invested, value, gain, gainPct: gain != null && invested > 0 ? (gain / invested) * 100 : null, day };
}

// The card's figures: the totals only when every holding has a price (an
// unpriced one isn't counted as unchanged); the day's change from those
// that moved; dividends at today's yields
export function portfolioTotals(rows, rowOf) {
  const invested = rows.reduce((s, h) => s + h.invested, 0);
  const all = rows.every(h => h.value != null);
  const value = all ? rows.reduce((s, h) => s + h.value, 0) : null;
  const gain = value != null ? value - invested : null;
  const moved = rows.filter(h => h.day != null);
  const day = moved.length ? moved.reduce((s, h) => s + h.day, 0) : null;
  const dayBase = moved.reduce((s, h) => s + (h.value - h.day), 0);
  const income = value != null ? rows.reduce((s, h) => s + (num(rowOf(h.ticker)?.divYield) ? (h.value * rowOf(h.ticker).divYield) / 100 : 0), 0) : null;
  return {
    invested, value, gain,
    gainPct: gain != null && invested > 0 ? (gain / invested) * 100 : null,
    day, dayPct: day != null && dayBase > 0 ? (day / dayBase) * 100 : null,
    income: income > 0 ? income : null,
    unpriced: [...new Set(rows.filter(h => h.value == null).map(h => h.ticker))],
  };
}

// A dividend's amount a share, from NSE's action title ("Interim Dividend -
// Rs 12 Per Share"); none when the title doesn't say
export function dividendPerShare(title) {
  const m = String(title ?? "").match(/\bR[se]\.?\s*([\d,]*\.?\d+)\s*(?:\/-)?\s*Per\s*Share/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}
const nextDividend = (row, today, within) => (row?.events ?? [])
  .filter(e => e?.kind === "action" && /dividend/i.test(e.title ?? "") && e.date >= today && daysFrom(e.date, today) <= within)
  .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

// Up to three things to look at, most pressing first: a big move at the last
// close (in rupees, for these shares), results this week, a dividend whose
// ex-date is near, one holding grown to too much of the whole
const BIG = 5;
export function needsALook(rows, rowOf, { today, pricesDate, total } = {}) {
  const out = [];
  const byTicker = new Map();
  for (const h of rows) {
    const t = byTicker.get(h.ticker) ?? { ...h, qty: 0, value: 0, day: 0 };
    t.qty += h.qty; t.value += h.value ?? 0; t.day += h.day ?? 0;
    byTicker.set(h.ticker, t);
  }
  for (const [ticker, h] of byTicker) {
    const r = rowOf(ticker);
    if (!r) continue;
    const name = cardName(h.name ?? r.name ?? ticker);
    if (num(r.ret1d) && Math.abs(r.ret1d) >= BIG && h.day) {
      out.push({ kind: r.ret1d > 0 ? "up" : "down", rank: 1 - Math.min(1, Math.abs(r.ret1d) / 100), symbol: ticker, name, text: `${r.ret1d > 0 ? "rose" : "fell"} ${Math.abs(r.ret1d).toFixed(0)}%${pricesDate ? ` on ${short(pricesDate)}` : ""}: ${h.day > 0 ? "+" : ""}${rupees(h.day)} on your shares` });
    }
    if (r.nextResults && today) {
      const d = daysFrom(r.nextResults, today);
      if (d >= 0 && d <= 7) out.push({ kind: "results", rank: 1 + d / 10, symbol: ticker, name, text: `reports results ${d === 0 ? "today" : d === 1 ? "tomorrow" : `on ${weekday(r.nextResults)}`}` });
    }
    const div = today ? nextDividend(r, today, 14) : null;
    if (div) {
      const ps = dividendPerShare(div.title);
      out.push({ kind: "dividend", rank: 1.5 + daysFrom(div.date, today) / 100, symbol: ticker, name, text: `goes ex-dividend on ${short(div.date)}${ps ? `: about ${rupees(ps * h.qty)} for your ${h.qty.toLocaleString("en-IN")} shares` : ""}` });
    }
    if (num(total) && total > 0 && byTicker.size >= 3 && h.value / total >= 0.35) {
      out.push({ kind: "weight", rank: 2, symbol: ticker, name, text: `is ${Math.round((h.value / total) * 100)}% of your portfolio` });
    }
  }
  const seen = {};
  return out.sort((a, b) => a.rank - b.rank).filter(x => (seen[x.kind] = (seen[x.kind] ?? 0) + 1) <= 2).slice(0, 3);
}

// The one note under a holding: results soon, a dividend soon, where it sits
// against the user's own levels, its fair value, results just out, else its
// quality score
export function holdingNote(h, r, { today, position } = {}) {
  if (!r) return null;
  if (r.nextResults && today) {
    const d = daysFrom(r.nextResults, today);
    if (d >= 0 && d <= 14) return { tag: `Results ${short(r.nextResults)}` };
  }
  const div = today ? nextDividend(r, today, 21) : null;
  if (div) return { tag: `Ex-dividend ${short(div.date)}` };
  if (position) return { text: position.label, tone: position.tone };
  if (num(r.fv25) && r.fv25 > 0 && num(h.cmp) && h.cmp > 0) {
    const gap = (1 - h.cmp / r.fv25) * 100;
    if (gap >= 10) return { text: `${gap.toFixed(0)}% under fair value` };
    if (gap <= -10) return { text: "above its fair value" };
  }
  if (r.latestQuarterFiled && today) {
    const d = -daysFrom(r.latestQuarterFiled, today);
    if (d >= 0 && d <= 10) return { text: `results out ${short(r.latestQuarterFiled)}` };
  }
  if (num(r.research?.quality)) return { text: `quality ${Math.round(r.research.quality)}/100` };
  return null;
}
