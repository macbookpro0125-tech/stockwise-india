// A stock's own historical P/E, so the buy ladder has a valuation anchor that
// isn't today's price. At today's P/E, fair value = EPS x (CMP / EPS) = CMP by
// construction, and the ladder degenerates into fixed discounts off the price.
//
// P/E per fiscal year = split-adjusted price at the year-end month's close /
// that year's audited EPS, restated to today's share count. Median of the last
// five years, so one boom or bust year can't drag the anchor.
import { NSE_BASE, UA, fetchJson, fetchXbrl, parseQeDate, parseContexts, firstFacts, TAGS, integratedFilings } from "./fetch-nse.js";

const YEARS = 5;
const MIN_VALID_YEARS = 3;

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function istMonthKey(unixSec) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(unixSec * 1000)).slice(0, 7);
}

// Year-end filings from both NSE systems: Integrated Filing (Q4 FY25 onward)
// and the legacy results endpoint (frozen at Dec 2024, but it holds all the
// earlier history). Filtered to the company's current fiscal year-end so a
// historical change of year-end (Nestle moved from December to March) doesn't
// mix calendar-year and fiscal-year EPS.
async function yearEndFilings(symbol, fyEndMonthDay) {
  const [integrated, legacy] = await Promise.all([
    integratedFilings(symbol).catch(() => []),
    fetchJson(`${NSE_BASE}/api/corporates-financial-results?index=equities&period=Annual&symbol=${encodeURIComponent(symbol)}`).catch(() => []),
  ]);

  const rows = [
    ...integrated.map(r => ({
      periodEnd: parseQeDate(r.qe_Date),
      label: String(r.qe_Date).toUpperCase(),
      scope: r.consolidated,
      xbrl: r.xbrl,
      filed: parseQeDate(r.creation_Date || r.broadcast_Date),
      legacy: false,
    })),
    ...(Array.isArray(legacy) ? legacy : []).filter(r => r.xbrl && /\.xml$/i.test(r.xbrl)).map(r => ({
      periodEnd: parseQeDate(r.toDate),
      label: String(r.toDate).toUpperCase(),
      scope: r.consolidated === "Consolidated" ? "Consolidated" : "Standalone",
      xbrl: r.xbrl,
      filed: parseQeDate(r.filingDate || r.broadCastDate),
      legacy: true,
    })),
  ].filter(r => r.periodEnd && r.label.startsWith(fyEndMonthDay));

  // Newest year first; Consolidated before Standalone; latest revision first
  rows.sort((a, b) =>
    b.periodEnd - a.periodEnd ||
    (a.scope === "Consolidated" ? -1 : 1) - (b.scope === "Consolidated" ? -1 : 1) ||
    (b.filed ?? 0) - (a.filed ?? 0)
  );
  const seen = new Set();
  return rows.filter(r => !seen.has(isoDay(r.periodEnd)) && seen.add(isoDay(r.periodEnd)));
}

function valueById(xml, tags, contextId) {
  for (const tag of tags) {
    const m = xml.match(new RegExp(`<[a-z-]+:${tag}\\b[^>]*?contextRef="${contextId}"[^>]*>([^<]*)<`));
    if (m) return Number(m[1]);
  }
  return null;
}

function fullYearEps(xml, row) {
  const ctx = parseContexts(xml);
  const end = isoDay(row.periodEnd);

  if (!row.legacy) {
    // Integrated filings date their contexts correctly
    const eps = firstFacts(xml, ctx, TAGS.eps);
    return eps.filter(f => f.end === end && f.days >= 350).sort((a, b) => b.days - a.days)[0]?.value ?? null;
  }

  // The legacy filing utility always puts the year-to-date column in context
  // "FourD", but its dates can't be trusted: FY24 files write the quarter's
  // start date on it (1-Jan to 31-Mar — Wipro and TCS), and FY22-era files
  // don't define the context at all, just reference it. So read by id, keep
  // the end-date check only where the context exists, and require the
  // year column's revenue to be well above the quarter's before believing
  // it's really a full year.
  if (ctx.FourD?.end && ctx.FourD.end !== end) return null;
  const eps = valueById(xml, TAGS.eps, "FourD");
  if (eps == null) return null;
  const revYear = valueById(xml, TAGS.revenue, "FourD");
  const revQuarter = valueById(xml, TAGS.revenue, "OneD");
  if (revYear != null && revQuarter != null && !(revYear > 1.5 * revQuarter)) return null;
  return eps;
}

// Yahoo's historical closes are already adjusted for splits and bonus issues
// (checked: no ~50% drop at Wipro's 1:1 bonus in Dec 2024), and it records
// bonuses as splits. So EPS from a filing made before a split has to be divided
// by that split's ratio, or every pre-bonus year shows half its real P/E.
async function priceHistory(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?range=10y&interval=1mo&events=split`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Yahoo price history HTTP ${res.status}`);
  const result = (await res.json())?.chart?.result?.[0];
  if (!result) throw new Error(`No price history for ${symbol}`);

  const closes = result.indicators?.quote?.[0]?.close || [];
  const byMonth = new Map();
  (result.timestamp || []).forEach((t, i) => {
    if (closes[i] != null) byMonth.set(istMonthKey(t), closes[i]);
  });
  const splits = Object.values(result.events?.splits || {}).map(s => ({
    date: new Date(s.date * 1000),
    ratio: s.numerator / s.denominator,
  }));
  return { byMonth, splits };
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export async function fetchPeHistory(symbol, fyEndLabel) {
  const fyEndMonthDay = String(fyEndLabel).toUpperCase().split("-").slice(0, 2).join("-"); // "31-MAR"
  const [filings, prices] = await Promise.all([yearEndFilings(symbol, fyEndMonthDay), priceHistory(symbol)]);

  const years = await Promise.all(filings.slice(0, YEARS).map(async row => {
    const fyEnd = isoDay(row.periodEnd);
    const out = { fyEnd, scope: row.scope };
    try {
      const reported = fullYearEps(await fetchXbrl(row.xbrl), row);
      if (reported == null) return { ...out, excluded: "full-year EPS not found in filing" };

      // Filings made after a split already restate EPS to the new share count
      const filed = row.filed ?? new Date(row.periodEnd.getTime() + 60 * 86400000);
      const factor = prices.splits.filter(s => s.date > filed).reduce((f, s) => f * s.ratio, 1);
      const eps = reported / factor;
      const price = prices.byMonth.get(fyEnd.slice(0, 7)) ?? null;

      Object.assign(out, { reportedEps: reported, splitFactor: factor, eps, price });
      if (price == null) return { ...out, excluded: "no price for that month" };
      if (!(eps > 0)) return { ...out, excluded: "loss year — P/E not meaningful" };
      return { ...out, pe: price / eps };
    } catch (e) {
      return { ...out, excluded: `couldn't read filing (${e.message})` };
    }
  }));

  const valid = years.filter(y => y.pe != null);
  return {
    forYearEnded: String(fyEndLabel).toUpperCase(),
    years,
    validYears: valid.length,
    medianPe: valid.length >= MIN_VALID_YEARS ? median(valid.map(y => y.pe)) : null,
    computedAt: new Date().toISOString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const symbol = process.argv[2] || "WIPRO";
  const fyEnd = process.argv[3] || "31-MAR-2026";
  console.log(JSON.stringify(await fetchPeHistory(symbol, fyEnd), null, 2));
}
