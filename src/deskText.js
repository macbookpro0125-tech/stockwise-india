// What a company's page on a computer says beside its chart (StockDesk.jsx
// draws it; 26 Oct 2026, the page laid out like a dashboard): what's coming
// up — its next results, its dividend — what its own figures say to be
// careful of, and the figures the chapters below don't show. Plain functions
// of the page's metrics (server/metrics.js via /api/stock), tested
// (deskText.test.js). Observations from the filings, never a buy or sell call.
import { dividendPerShare } from "./portfolioText.js";

const num = v => v != null && Number.isFinite(Number(v));
const DAY = 86_400_000;
const dayOf = iso => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
const daysFrom = (iso, today) => Math.round((dayOf(iso) - dayOf(today)) / DAY);
const short = iso => dayOf(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const weekday = iso => dayOf(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
const pct = (v, d = 1) => `${Math.abs(v).toFixed(d)}%`;
const rs = v => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fy = iso => `FY${String(iso).slice(2, 4)}`;

// The months a quarter ending on this date covers ("July–September")
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function quarterName(qEnd) {
  const m = dayOf(qEnd).getUTCMonth();
  return `${MONTHS[(m + 10) % 12]}–${MONTHS[m]}`;
}
// The quarter after this one, and the same quarter a year before that
const addMonths = (iso, n) => {
  const d = dayOf(iso);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0));
  return end.toISOString().slice(0, 10);
};

// Its next results: the date if it has told NSE, else which quarter is due
// and when last year's same quarter came out
export function resultsWatch(m, today) {
  if (m?.nextResults && today && daysFrom(m.nextResults, today) >= 0) {
    const d = daysFrom(m.nextResults, today);
    const q = m.latestQuarter ? quarterName(addMonths(m.latestQuarter, 3)) : null;
    return { kind: "results", title: `Results ${d === 0 ? "today" : d === 1 ? "tomorrow" : `on ${weekday(m.nextResults)}`}`, text: q ? `For ${q}` : "Board meeting told to NSE" };
  }
  if (!m?.latestQuarter) return null;
  const next = addMonths(m.latestQuarter, 3);
  const lastYear = (m.quarters ?? []).find(q => q.fyEnd === addMonths(next, -12) && q.filed);
  return {
    kind: "results", title: `Results for ${quarterName(next)}`,
    text: `Date not announced yet${lastYear ? ` · last year’s came on ${short(lastYear.filed)}` : ""}`,
  };
}

// Its dividend: the next one if declared, else the last; and special
// dividends when it has a habit of them
export function dividendWatch(m, today) {
  const rec = m?.dividendRecord;
  const specials = (rec?.byYear ?? []).filter(y => !y.partial);
  const withSpecial = specials.filter(y => y.special > 0);
  const lastSpecial = withSpecial.at(-1);
  const habit = withSpecial.length >= 2 ? `Special dividends in ${withSpecial.length} of the last ${specials.length} years (${rs(lastSpecial.special)} in ${fy(`${lastSpecial.fy}`)})` : null;
  if (rec?.next?.date && today && daysFrom(rec.next.date, today) >= 0) {
    const amt = rec.next.amount ?? dividendPerShare(rec.next.title);
    return { kind: "dividend", title: `Dividend${amt ? ` ${rs(amt)} a share` : ""}, ex-date ${short(rec.next.date)}`, text: habit ?? (rec.yield ? `Yields ${pct(rec.yield)} on the last 12 months` : null) };
  }
  const last = (m?.events ?? []).filter(e => e?.kind === "action" && /dividend/i.test(e.title ?? "") && (!today || e.date <= today))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return rec?.ttm > 0 ? { kind: "dividend", title: `Paid ${rs(rec.ttm)} a share in dividends this past year`, text: habit } : null;
  const amt = dividendPerShare(last.title);
  return { kind: "dividend", title: `Last dividend${amt ? ` ${rs(amt)} a share` : ""}, ex-date ${short(last.date)}`, text: habit ?? (rec?.yield ? `Yields ${pct(rec.yield)} on the last 12 months` : null) };
}

// What its own figures say to be careful of, most telling first, two at most
export function cautions(m) {
  if (!m) return [];
  const out = [];
  const years = [...(m.history ?? [])].filter(y => y.revenueCr > 0 && num(y.profitCr)).sort((a, b) => a.fyEnd.localeCompare(b.fyEnd));
  if (num(m.pledgedPct) && m.pledgedPct >= 5) out.push({ rank: 0, title: "Promoters have pledged shares", text: `${pct(m.pledgedPct)} of their holding is pledged` });
  if (num(m.payoutPct) && m.payoutPct > 100) out.push({ rank: 1, title: "Pays out more than it earns", text: `Dividends were ${pct(m.payoutPct, 0)} of profit last year` });
  if (num(m.debtChange1y) && m.debtChange1y >= 30 && num(m.totalDebtCr) && m.totalDebtCr > 0 && num(m.debtToEquity) && m.debtToEquity >= 0.3) {
    out.push({ rank: 2, title: "Debt is rising", text: `Up ${pct(m.debtChange1y, 0)} in a year; debt is ${m.debtToEquity.toFixed(2)}× equity` });
  }
  const ph = m.promoterHistory ?? [];
  const yearAgo = ph.find(p => daysFrom(ph[0]?.asOfIso, p.asOfIso) >= 330);
  if (ph[0] && yearAgo && yearAgo.pct - ph[0].pct >= 3) out.push({ rank: 3, title: "Promoters are selling", text: `Their stake fell from ${pct(yearAgo.pct)} to ${pct(ph[0].pct)} in a year` });
  if (num(m.salesGrowth3y) && m.salesGrowth3y < 8) {
    const was = num(m.salesGrowth5y) && m.salesGrowth5y >= m.salesGrowth3y + 2 ? `, against ${pct(m.salesGrowth5y, 0)} over 5` : "";
    out.push({ rank: 4, title: m.salesGrowth3y < 0 ? "Sales are shrinking" : "Growth is slow", text: `Sales ${m.salesGrowth3y < 0 ? "−" : ""}${pct(m.salesGrowth3y)} a year over 3 years${was}` });
  }
  if (years.length >= 5) {
    const a = years[0], b = years.at(-1);
    const ma = (a.profitCr / a.revenueCr) * 100, mb = (b.profitCr / b.revenueCr) * 100;
    if (ma > 0 && ma - mb >= 2) out.push({ rank: 5, title: "Profit margin has slipped", text: `${pct(ma)} in ${fy(a.fyEnd)}, ${pct(mb)} in ${fy(b.fyEnd)}` });
  }
  if (num(m.ret1yVsNifty) && m.ret1yVsNifty <= -15) out.push({ rank: 6, title: "The price lags the market", text: `${pct(m.ret1yVsNifty, 0)} behind the Nifty 50 over a year` });
  return out.sort((a, b) => a.rank - b.rank).slice(0, 2).map(({ rank, ...c }) => c);
}

// The figures the chapters don't show: its size, the last four quarters,
// price to book, and where the price sits in its year
export function keyFigures(m) {
  if (!m) return [];
  const cr = v => `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
  return [
    num(m.marketCapCr) && ["Market cap", cr(m.marketCapCr)],
    num(m.ttmRevenueCr) && ["Sales · 4 qtrs", cr(m.ttmRevenueCr)],
    num(m.ttmProfitCr) && ["Profit · 4 qtrs", cr(m.ttmProfitCr)],
    num(m.ttmEps) && ["EPS · 4 qtrs", rs(m.ttmEps)],
    num(m.priceToBook) && ["Price / book", `${m.priceToBook.toFixed(2)}×`],
  ].filter(Boolean);
}

// When the last quarter and the last three years disagree, say which way and
// what settles it (asked for 26 Oct 2026: the page showed both without
// saying what to make of them); nothing when they agree
export function growthNote(m) {
  const q = m?.qSalesGrowthYoY, y3 = m?.salesGrowth3y;
  if (!num(q) || !num(y3) || !m.latestQuarter) return null;
  const when = quarterName(m.latestQuarter);
  const profit = num(m.qProfitGrowthYoY) ? ` and profit ${m.qProfitGrowthYoY >= 0 ? "+" : "−"}${pct(m.qProfitGrowthYoY)}` : "";
  const sales = `${q >= 0 ? "+" : "−"}${pct(q)}`;
  if (q - y3 >= 4) return { lead: "Growth picked up lately.", text: `In ${when} sales were ${sales}${profit} on a year ago, against ${pct(y3)} a year over 3 years. Whether it lasts will show in the next results.` };
  if (y3 - q >= 4) return { lead: "Growth slowed lately.", text: `In ${when} sales were ${sales}${profit} on a year ago, against ${pct(y3)} a year over 3 years. The next results will show whether it's a blip.` };
  return null;
}
