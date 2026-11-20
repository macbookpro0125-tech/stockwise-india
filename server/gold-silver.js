// Gold, silver and every other ETF on NSE, and the Sovereign Gold Bonds (20
// Nov 2026, the owner: "gold, silver and others — build all"). All from NSE,
// the source the rest of the site already uses:
//   - NSE's list of ETFs (eq_etfseclist.csv): what each tracks, its fund
//     house, when it listed
//   - NSE's ETF prices (/api/etf): price, day's move, NAV, 30-day and 1-year
//     change, value traded
//   - NSE's Sovereign Gold Bond prices (/api/sovereign-gold-bonds): each
//     series' price and RBI issue price (one bond = one gram of gold)
//   - longer returns from our own daily history of the ETFs (price-history.js)
// Nothing is estimated that isn't labelled so; the page shows NSE's time.
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { fetchText } from "./upstream.js";
import { cached } from "./company-extras.js";
import { historyBars } from "./price-history.js";
import { loadMarketSnapshot } from "./market-data.js";
import { readCache, writeCache } from "./cache-dir.js";

const LIST_URL = "https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv";
const LAST = "gold-silver-last.json";
const DAY = 86_400_000;
const num = v => { const n = Number(String(v ?? "").replace(/,/g, "")); return v != null && v !== "" && v !== "-" && Number.isFinite(n) ? n : null; };

// The fund house, from the start of NSE's security name ("NIPINDETFGOLDBEES",
// "MIRAEAMC-MAGOLDETF"); none when it isn't one of these
const AMCS = [
  [/^(NIPIND|NIPPON|RELCAP)/i, "Nippon India"], [/^UTI/i, "UTI"], [/^KOTAK/i, "Kotak"], [/^Quantum/i, "Quantum"], [/^Quant_/i, "Quant"],
  [/^SBI/i, "SBI"], [/^(Invesco|RELIGAR)/i, "Invesco"], [/^HDFC/i, "HDFC"], [/^ICICI/i, "ICICI Prudential"], [/^AXIS/i, "Axis"],
  [/^Motilal/i, "Motilal Oswal"], [/^(ABSL|BIRLA)/i, "Aditya Birla Sun Life"], [/^LIC/i, "LIC"], [/^DSP/i, "DSP"], [/^EDEL/i, "Edelweiss"],
  [/^MIRAE/i, "Mirae Asset"], [/^BARODABNP/i, "Baroda BNP Paribas"], [/^TATA/i, "Tata"], [/^ZERODHA/i, "Zerodha"], [/^BFAM/i, "Bajaj Finserv"],
  [/^SHRIRAM/i, "Shriram"], [/^GROWW/i, "Groww"], [/^UNION/i, "Union"], [/^360ONE/i, "360 ONE"], [/^Choice/i, "Choice"],
  [/^BANDHAN/i, "Bandhan"], [/^HSBC/i, "HSBC"], [/^WEALTH/i, "The Wealth Company"], [/^(CPSE|IDBI)/i, null],
];
export const amcOf = securityName => AMCS.find(([re]) => re.test(String(securityName).trim()))?.[1] ?? null;

// NSE's ETF type and underlying → our group
export function groupOf(type, key) {
  const t = String(type).trim().toUpperCase(), k = String(key).trim();
  if (t === "COMMODITY") return /silver/i.test(k) ? "silver" : "gold";
  if (t === "GLOBAL INDICES") return "global";
  if (t === "DEBT") return /liquid|overnight/i.test(k) ? "liquid" : "bonds";
  return "shares";
}
export const GROUPS = [
  { id: "gold", label: "Gold ETFs" }, { id: "silver", label: "Silver ETFs" }, { id: "sgb", label: "Sovereign Gold Bonds" },
  { id: "global", label: "International" }, { id: "bonds", label: "Government bonds" }, { id: "liquid", label: "Liquid" }, { id: "shares", label: "Share indices" },
];

// eq_etfseclist.csv → Map(symbol → { group, tracks, amc, listed, isin })
export function parseEtfList(csv) {
  const out = new Map();
  for (const line of String(csv).trim().split(/\r?\n/).slice(1)) {
    const c = line.split(",").map(s => s.trim());
    if (c.length < 9 || !c[0]) continue;
    out.set(c[0], { group: groupOf(c[7], c[8]), tracks: c[8] && !/^(GOLD|SILVER|GLOBAL INDICES)$/i.test(c[8]) ? c[8] : c[1], amc: amcOf(c[2]), listed: c[3], isin: c[5] });
  }
  return out;
}

const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
// "SGBAUG28V" → { month: 7, year: 2028, tranche: "V" }: a series' symbol names
// the month and year it matures (eight years after issue)
export function sgbMaturity(symbol) {
  const m = /^SGB([A-Z]{3})(\d{2})([IVX]*)/.exec(String(symbol));
  if (!m || MON[m[1]] == null) return null;
  return { month: MON[m[1]], year: 2000 + Number(m[2]), tranche: m[3] || null };
}

// The return over `days` (yearly when longer than a year) from daily bars,
// oldest first; null when the history doesn't reach back that far
export function returnOver(bars, days) {
  if (!bars?.length) return null;
  const last = bars.at(-1);
  const want = Date.parse(last[0]) - days * DAY;
  if (Date.parse(bars[0][0]) > want + 7 * DAY) return null;
  let then = bars[0];
  for (const b of bars) { if (Date.parse(b[0]) <= want) then = b; else break; }
  const p0 = then[4] ?? then[1], p1 = last[4] ?? last[1];
  if (!(p0 > 0 && p1 > 0)) return null;
  const years = days / 365.25;
  return years > 1.01 ? (Math.pow(p1 / p0, 1 / years) - 1) * 100 : (p1 / p0 - 1) * 100;
}

const barsFor = (symbol, snap) => { try { return historyBars(symbol, snap)?.map(b => (Array.isArray(b) ? b : [b.date, b.open, b.high, b.low, b.close, b.volume])) ?? null; } catch { return null; } };

// The bars with today's price on the end, when NSE's prices are newer than
// the last close kept (so returns run to now, as the price shown does)
export function withToday(bars, date, price) {
  if (!bars?.length || !(price > 0) || !date || date <= bars.at(-1)[0]) return bars;
  return [...bars, [date, price, price, price, price, 0]];
}
// NSE's time "20-Nov-2026 13:54:24" → "2026-11-20"
const MONTHS = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
export const nseDay = t => { const m = /^(\d{1,2})-(\w{3})-(\d{4})/.exec(t ?? ""); return m && MONTHS[m[2].toUpperCase()] ? `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}` : null; };

// Returns are worked out here from NSE's daily closes, never taken from NSE's
// ETF list: its 1-year change for GOLDBEES on 20 Nov 2026 (+4.0%) needed a
// price a year earlier under the ETF's own 52-week low (20 Nov 2026, checked
// against Google Finance and our closes: +0.8%)
export function etfRow(r, info, { bars = null, navDate = null } = {}) {
  const price = num(r.ltP), prev = num(r.prevClose), nav = num(r.nav);
  return {
    symbol: r.symbol, amc: info?.amc ?? null, tracks: info?.tracks ?? r.assets ?? null, listed: info?.listed ?? null,
    price, changePct: num(r.per), prevClose: prev, nav, navDate,
    // the close against the NAV of the same day: both are yesterday's
    premiumPct: prev > 0 && nav > 0 ? (prev / nav - 1) * 100 : null,
    ret1m: returnOver(bars, 30), ret1y: returnOver(bars, 365),
    ret3y: returnOver(bars, 3 * 365), ret5y: returnOver(bars, 5 * 365),
    valueCr: num(r.trdVal) != null ? num(r.trdVal) / 1e7 : null,
    high52: num(r.wkhi), low52: num(r.wklo),
  };
}

export function sgbRow(r, now = Date.now()) {
  const mat = sgbMaturity(r.symbol);
  const issue = num(r.issue_price), price = num(r.ltP);
  const end = mat ? Date.UTC(mat.year, mat.month + 1, 0) : null;
  return {
    symbol: r.symbol, tranche: mat?.tranche ?? null,
    matures: mat ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mat.month]} ${mat.year}` : null,
    yearsLeft: end ? Math.max(0, (end - now) / (365.25 * DAY)) : null,
    issuePrice: issue, price, changePct: num(r.per),
    sinceIssuePct: issue > 0 && price > 0 ? (price / issue - 1) * 100 : null,
    // 2.5% a year on the issue price, paid twice a year — every series still trading
    interestYear: issue > 0 ? issue * 0.025 : null,
    ret1y: num(r.perChange365d), valueCr: num(r.trdVal) != null ? num(r.trdVal) / 1e7 : null,
    high52: num(r.wkhi), low52: num(r.wklo),
  };
}

// Gold, silver and the Nifty 50 side by side, through the ETFs that track
// them (so after the funds' costs), from our own daily history
const COMPARE = [["Gold", "GOLDBEES"], ["Silver", "SILVERBEES"], ["Nifty 50", "NIFTYBEES"]];
export const PERIODS = [["1M", 30], ["1Y", 365], ["3Y", 3 * 365], ["5Y", 5 * 365], ["10Y", 10 * 365]];

async function fresh() {
  const [list, etf, sgbData] = await Promise.all([
    cached("etf-list", 24 * 3600_000, async () => parseEtfList(await fetchText(LIST_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; JocularInsights/1.0)" }, service: "NSE ETF list", maxBytes: 2e6, timeoutMs: 15_000 }))),
    fetchJson(`${NSE_BASE}/api/etf`),
    fetchJson(`${NSE_BASE}/api/sovereign-gold-bonds`),
  ]);
  if (!Array.isArray(etf?.data) || !etf.data.length) throw new Error("NSE's ETF prices couldn't be read");
  const snap = loadMarketSnapshot();
  const groups = Object.fromEntries(GROUPS.filter(g => g.id !== "sgb").map(g => [g.id, []]));
  for (const r of etf.data) {
    const info = list.get(r.symbol) ?? null;
    const group = info?.group ?? groupOf("", "");
    const bars = withToday(barsFor(r.symbol, snap), nseDay(etf.timestamp), num(r.ltP));
    groups[group].push(etfRow(r, info, { bars, navDate: etf.navDate ?? null }));
  }
  for (const g of Object.values(groups)) g.sort((a, b) => (b.valueCr ?? 0) - (a.valueCr ?? 0));
  const sgb = (Array.isArray(sgbData?.data) ? sgbData.data : []).map(r => sgbRow(r)).filter(r => r.price != null)
    .sort((a, b) => (a.yearsLeft ?? 99) - (b.yearsLeft ?? 99));
  const compare = COMPARE.map(([label, symbol]) => {
    const row = etf.data.find(x => x.symbol === symbol);
    const bars = withToday(barsFor(symbol, snap), nseDay(etf.timestamp), num(row?.ltP));
    return { label, symbol, returns: Object.fromEntries(PERIODS.map(([k, d]) => [k, returnOver(bars, d)])), from: bars?.[0]?.[0] ?? null };
  });
  return { asOf: etf.timestamp ?? null, sgbAsOf: sgbData?.timestamp ?? null, navDate: etf.navDate ?? null, groupInfo: GROUPS, groups, sgb, compare, source: "NSE" };
}

// The page's data, ten minutes at a time; NSE out of reach → the last one
// fetched (kept on disk across restarts), marked as such
export async function goldSilver() {
  return cached("gold-silver", 10 * 60_000, async () => {
    try {
      const d = await fresh();
      writeCache(LAST, d);
      return d;
    } catch (e) {
      const last = readCache(LAST);
      if (last) return { ...last, stale: true };
      throw e;
    }
  });
}

// The page's chart (20 Nov 2026, the owner: "can I show the gold chart?"):
// each day's close of the ETFs that track gold, silver and the Nifty 50, from
// our own daily history of NSE's closes, oldest first
export function goldSilverChart() {
  return cached("gold-silver-chart", 3600_000, async () => {
    const snap = loadMarketSnapshot();
    const series = COMPARE.map(([label, symbol]) => {
      const bars = barsFor(symbol, snap) ?? [];
      return { label, symbol, days: bars.map(b => b[0]), closes: bars.map(b => b[4]) };
    }).filter(s => s.days.length > 1);
    return { series, to: snap?.pricesDate ?? series[0]?.days.at(-1) ?? null, source: "NSE daily closes" };
  });
}

// Today's price for the chart's ETFs (20 Nov 2026: the chart ended at the
// last close, ₹106.30, while gold was trading at ₹102 that afternoon), from
// NSE's ETF prices the page already reads: { SYMBOL: { date, price, at } }
const MON3 = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
export function liveOf(d) {
  const m = /^(\d{1,2})-(\w{3})-(\d{4}) (\d{1,2}:\d{2})/.exec(d?.asOf ?? "");
  if (!m || !MON3[m[2].toUpperCase()]) return {};
  const date = `${m[3]}-${MON3[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}`;
  const all = Object.values(d.groups ?? {}).flat();
  return Object.fromEntries(COMPARE.map(([, symbol]) => [symbol, all.find(e => e.symbol === symbol)])
    .filter(([, e]) => e?.price > 0).map(([symbol, e]) => [symbol, { date, price: e.price, at: m[4] }]));
}
