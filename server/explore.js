// The Explore page (asked for 23 Oct 2026: "the Nifty 50, bank, small, large
// and all the others on this page, and the news in it"): every index on the
// board (market-data.js BOARD) at its last close, from NSE's daily index
// file — end of day, not live — and one index in full: its year, its
// returns, NSE's valuation of it, and for a sector, its companies' biggest
// moves and news. The news is market-news.js's.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadMarketSnapshot, indexBoard, indexMembers, HEATMAP_LISTS } from "./market-data.js";
import { allMetrics } from "./screen.js";
import { historyBars } from "./price-history.js";
import { PRICE_DIR } from "./paths.js";
import { SECTOR_INDEX } from "./sector-indices.js";

const SPARK_DAYS = 22; // about a month of sessions

// The evening build puts the board in the snapshot. A snapshot from before
// it was added has none: a copy that keeps NSE's daily files (this Mac)
// works it out from them; the free host, which has none, waits for the next
// evening's data.
let fallback = null;
async function board() {
  const snap = loadMarketSnapshot();
  if (snap?.indexBoard) return { board: snap.indexBoard, snap };
  if (!snap?.pricesDate || !snap.range52wFrom || !existsSync(join(PRICE_DIR, `indices-${snap.pricesDate}.csv`))) return { board: null, snap };
  if (fallback?.date !== snap.pricesDate) fallback = { date: snap.pricesDate, board: indexBoard(snap.range52wFrom, snap.pricesDate).catch(() => null) };
  return { board: await fallback.board, snap };
}

// The change over the last n sessions, from the closes
const over = (closes, n) => {
  const last = closes[closes.length - 1], then = closes[closes.length - 1 - n];
  return last > 0 && then > 0 ? Math.round((last / then - 1) * 10000) / 100 : null;
};

function card(i) {
  const closes = i.closes.filter(c => c != null);
  return { name: i.name, group: i.group, close: i.close, change: i.change, changePct: i.changePct, spark: closes.slice(-SPARK_DAYS), month: over(closes, Math.min(SPARK_DAYS - 1, closes.length - 1)) };
}

export async function exploreBoard() {
  const { board: b, snap } = await board();
  if (!b) return { asOf: snap?.pricesDate ?? null, market: [], sectors: [], pending: true };
  return {
    asOf: b.days[b.days.length - 1] ?? snap?.pricesDate ?? null,
    market: b.indices.filter(i => i.group === "market").map(card),
    sectors: b.indices.filter(i => i.group === "sector").map(card),
  };
}

// One index in full; null when it isn't on the board
export async function exploreIndex(name) {
  const { board: b, snap } = await board();
  // the price strip's "NIFTY Bank" is the board's "Nifty Bank"
  const i = b?.indices.find(x => x.name === name) ?? b?.indices.find(x => x.name.toLowerCase() === String(name).toLowerCase());
  if (!i) return null;
  name = i.name;
  const pairs = b.days.map((d, k) => [d, i.closes[k]]).filter(([, c]) => c != null);
  const closes = pairs.map(([, c]) => c);
  // 3 and 5 years from the period returns (quarter-end files); the rest from the year
  const long = snap?.indexReturns?.[name] ?? {};
  const returns = { w1: over(closes, 5), m1: over(closes, 21), m3: over(closes, 63), m6: over(closes, 126), y1: closes.length > 240 ? over(closes, closes.length - 1) : null, y3: long.y3 ?? null, y5: long.y5 ?? null };
  // A sector's companies (those the app measures against this index): the day's biggest moves
  const sector = Object.entries(SECTOR_INDEX).find(([, idx]) => idx === name)?.[0] ?? null;
  const members = sector ? allMetrics().rows.filter(r => r.sectorIndex === name && r.ret1d != null && r.marketCapCr >= 1000) : [];
  const mover = r => ({ symbol: r.symbol, name: r.name, close: r.cmp ?? null, change1d: r.ret1d, marketCapCr: r.marketCapCr ?? null });
  const byMove = [...members].sort((a, b2) => b2.ret1d - a.ret1d);
  return {
    story: indexStory(name, i.close, pairs.map(([d]) => d), snap, sector),
    asOf: pairs[pairs.length - 1]?.[0] ?? null,
    name, group: i.group, close: i.close, change: i.change, changePct: i.changePct,
    pe: i.pe, pb: i.pb, divYield: i.divYield,
    days: pairs.map(([d]) => d), closes,
    returns,
    sector,
    companies: members.length,
    gainers: byMove.filter(r => r.ret1d > 0).slice(0, 5).map(mover),
    losers: byMove.filter(r => r.ret1d < 0).reverse().slice(0, 5).map(mover),
    symbols: members.map(r => r.symbol),
  };
}

// The heat map: an index's companies, each sized by its market value and
// coloured by its move over the period; or the sectors, by their indices'
// moves. Members come with the evening build; a copy that keeps NSE's daily
// files (this Mac) reads the lists itself once a day, the free host waits.
let membersFallback = null;
async function members() {
  const snap = loadMarketSnapshot();
  if (snap?.indexMembers) return snap.indexMembers;
  if (!snap?.pricesDate || !existsSync(join(PRICE_DIR, `indices-${snap.pricesDate}.csv`))) return null;
  if (membersFallback?.date !== snap.pricesDate) membersFallback = { date: snap.pricesDate, members: indexMembers().catch(() => null) };
  return membersFallback.members;
}

// "all": every company over ₹500 crore (smaller ones, thinly traded, would be
// slivers too thin to see or click)
export const HEAT_SETS = [...Object.keys(HEATMAP_LISTS), "all", "list", "group", "sectors"];
const ALL_FLOOR_CR = 500;
const PERIOD = { "1d": ["ret1d", 1], "1w": ["ret1w", 5], "1m": ["ret1m", 21], "3m": ["ret3m", 63], "6m": ["ret6m", 126], "1y": ["ret1y", 0] };

// "group": one industry's companies, or one sector's ({ industry } or { sector }),
// for a company page's map of its neighbours
export async function heatmap(set = "Nifty 50", period = "1d", symbols = null, group = null) {
  if (!PERIOD[period]) period = "1d";
  const [key, sessions] = PERIOD[period];
  const { board: b, snap } = await board();
  const asOf = b?.days[b.days.length - 1] ?? snap?.pricesDate ?? null;
  if (set === "sectors") {
    if (!b) return { asOf, set, period, items: [], pending: true };
    const items = b.indices.filter(i => i.group === "sector").map(i => {
      const closes = i.closes.filter(c => c != null);
      // a year: the board's whole year, when it holds one
      const change = period === "1d" ? i.changePct : sessions ? over(closes, sessions) : closes.length > 240 ? over(closes, closes.length - 1) : null;
      return { index: i.name, change, weight: 1 };
    }).filter(i => i.change != null);
    return { asOf, set, period, items };
  }
  const rows = allMetrics().rows;
  // ahead of or behind the Nifty 50 over the period, in points: a day's from the board's
  // Nifty 50, longer ones the evening build's
  const nifty = b?.indices.find(i => i.name === "Nifty 50" || i.name === "NIFTY 50");
  // the coming week, from today in India (as resultsWeek counts it)
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const weekOut = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const vsNifty = r => (period === "1d" ? (r.ret1d != null && nifty?.changePct != null ? Math.round((r.ret1d - nifty.changePct) * 100) / 100 : null) : r[`${key}VsNifty`] ?? null);
  let list = null;
  if (set === "all") list = rows.filter(r => r.marketCapCr >= ALL_FLOOR_CR).map(r => r.symbol);
  else if (set === "list") list = symbols ?? [];
  else if (set === "group") list = rows.filter(r => r.marketCapCr > 0 && (group?.industry ? r.industry === group.industry : group?.sector ? r.sector === group.sector : false)).map(r => r.symbol);
  else list = (await members())?.[set];
  if (!list) return { asOf, set, period, items: [], pending: true };
  const bySymbol = new Map(rows.map(r => [r.symbol, r]));
  const items = list.map(sym => bySymbol.get(sym)).filter(r => r?.marketCapCr > 0 && r[key] != null)
    .map(r => ({
      symbol: r.symbol, name: r.name, sector: r.sector ?? null, industry: r.industry ?? null, weight: r.marketCapCr, change: r[key], close: r.cmp ?? null,
      // what else the map can be coloured by (MarketMapView.jsx COLOUR_BY)
      vsNifty: vsNifty(r), down52: r.downFrom52wHigh ?? null, volX: r.volVsAvg50 ?? null, delivery: r.delivery1m ?? null,
      strength: r.priceStrength ?? null, quality: r.research?.quality ?? null, pe: r.peTtm ?? r.pe ?? null,
      // the map's quick filters, and its mark for results in the coming week
      fno: !!r.fno, psu: !!r.governmentOwned, themes: r.themes?.length ? r.themes : undefined,
      resultsOn: r.nextResults && r.nextResults >= today && r.nextResults <= weekOut ? r.nextResults : undefined,
    }))
    .sort((a, b2) => b2.weight - a.weight);
  return { asOf, set, period, items, members: list.length, ...(set === "all" ? { floorCr: ALL_FLOOR_CR } : {}) };
}

// A sector in brief, under the map when it's opened on its own (31 Oct 2026):
// its biggest rises and falls over the period, its middle P/E now and at each
// of the last five year-ends (from each company's own P/E then), results due
// in the next two weeks, its industries, and its NSE index if it has one.
const median = list => {
  const v = list.filter(x => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
export function sectorBrief(name, period = "1d") {
  const [key] = PERIOD[period] ?? PERIOD["1d"];
  const all = allMetrics().rows.filter(r => (r.sector || "Other") === name && r.marketCapCr > 0);
  if (!all.length) return null;
  const moved = all.filter(r => r[key] != null && r.marketCapCr >= 500);
  const row = r => ({ symbol: r.symbol, name: r.name, change: r[key], marketCapCr: r.marketCapCr, close: r.cmp ?? null });
  const byMove = [...moved].sort((a, b) => b[key] - a[key]);
  // the P/E at each year-end, among companies with a positive one then
  const years = new Map();
  for (const r of all) for (const h of r.peHistory ?? []) if (h.pe > 0 && h.fyEnd) {
    const y = h.fyEnd.slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(h.pe);
  }
  const peYears = [...years].filter(([, l]) => l.length >= Math.min(5, all.length)).sort(([a], [b2]) => a.localeCompare(b2)).slice(-5)
    .map(([year, l]) => ({ year, pe: Math.round(median(l) * 10) / 10, companies: l.length }));
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
  const inds = new Map();
  for (const r of moved) { const k = r.industry || "Other"; if (!inds.has(k)) inds.set(k, []); inds.get(k).push(r); }
  const wmove = list => { const cap = list.reduce((t, r) => t + r.marketCapCr, 0); return cap ? Math.round(list.reduce((t, r) => t + r[key] * r.marketCapCr, 0) / cap * 100) / 100 : null; };
  return {
    name, period, asOf: loadMarketSnapshot()?.pricesDate ?? null, count: all.length,
    marketCapCr: all.reduce((t, r) => t + r.marketCapCr, 0),
    medianPe: median(all.map(r => (r.peTtm ?? r.pe) > 0 ? r.peTtm ?? r.pe : null)), peYears,
    risers: byMove.filter(r => r[key] > 0).slice(0, 5).map(row),
    fallers: byMove.filter(r => r[key] < 0).reverse().slice(0, 5).map(row),
    industries: [...inds].map(([n, l]) => ({ name: n, count: l.length, change: wmove(l) })).sort((a, b2) => b2.count - a.count),
    results: all.filter(r => r.nextResults && r.nextResults >= today && r.nextResults <= end)
      .sort((a, b2) => a.nextResults.localeCompare(b2.nextResults) || b2.marketCapCr - a.marketCapCr).slice(0, 12)
      .map(r => ({ symbol: r.symbol, name: r.name, date: r.nextResults })),
    index: SECTOR_INDEX[name] ?? null,
  };
}

// Top movers: the biggest rises and falls over a day, a week or a month among
// companies over ₹1,000 crore (smaller ones, thinly traded, would fill both
// lists with 20% days)
const MOVER_FLOOR_CR = 1000;
export function topMovers(period = "1d", n = 10) {
  const [key] = PERIOD[period] ?? PERIOD["1d"];
  const rows = allMetrics().rows.filter(r => r.marketCapCr >= MOVER_FLOOR_CR && r[key] != null && r.cmp != null);
  const row = r => ({ symbol: r.symbol, name: r.name, close: r.cmp, change: r[key], marketCapCr: r.marketCapCr, sector: r.sector ?? null });
  const sorted = [...rows].sort((a, b) => b[key] - a[key]);
  return {
    asOf: loadMarketSnapshot()?.pricesDate ?? null, period, floorCr: MOVER_FLOOR_CR,
    gainers: sorted.filter(r => r[key] > 0).slice(0, n).map(row),
    losers: sorted.filter(r => r[key] < 0).reverse().slice(0, n).map(row),
  };
}

// The week's results: the companies whose results board meeting NSE's
// calendar lists for the next seven days, by day, the largest first
export function resultsWeek(days = 7) {
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const byDay = new Map();
  for (const r of allMetrics().rows) {
    const d = r.nextResults;
    if (!d || d < today || d > end) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    // its latest quarter on file: the one it is about to report on once
    // filed (newer than three months before the meeting), else the one before
    const q = r.quarters?.[0];
    byDay.get(d).push({ symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null, lastProfitYoY: r.qProfitGrowthYoY ?? null, cmp: r.cmp ?? null, ret1d: r.ret1d ?? null,
      quarter: q ? { end: q.fyEnd, filed: q.filed ?? null, salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null } : null });
  }
  // the days before, from the results already filed (6 Nov 2026, "I should be
  // able to see the previous also"): the last month of filings before today,
  // by the day each was filed, each with the quarter it reported
  const past = new Map();
  const filedOf = r => String(r.quarters?.[0]?.filed ?? "").slice(0, 10);
  const newest = allMetrics().rows.reduce((m, r) => { const f = filedOf(r); return f && f < today && f > m ? f : m; }, "");
  if (newest) {
    // a month of filings (7 Nov 2026, "one month back")
    const from = new Date(Date.parse(`${newest}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const r of allMetrics().rows) {
      const f = filedOf(r), q = r.quarters?.[0];
      if (!f || f < from || f > newest || !q || (q.revenueCr == null && q.profitCr == null)) continue;
      if (!past.has(f)) past.set(f, []);
      past.get(f).push({ symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null, cmp: r.cmp ?? null, ret1d: r.ret1d ?? null, reported: true,
        quarter: { end: q.fyEnd, filed: q.filed ?? null, salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null } });
    }
  }
  const asDays = m => [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, count: list.length, companies: list.sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)) }));
  return { today, days: asDays(byDay), past: asDays(past) };
}

// A list of companies' results, whatever the day (6 Nov 2026, "all the
// watchlist results, not only on a specific date — previous and future"):
// each one's next results date if it has told NSE, and its latest quarter on
// file with its figures; unknown symbols are left out
export function resultsFor(symbols = []) {
  const by = new Map(allMetrics().rows.map(r => [r.symbol, r]));
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  return {
    today,
    companies: [...new Set(symbols)].map(sym => by.get(sym)).filter(Boolean).map(r => {
      const q = r.quarters?.[0];
      return {
        symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null, ret1d: r.ret1d ?? null,
        next: r.nextResults && r.nextResults >= today ? r.nextResults : null,
        quarter: q ? { end: q.fyEnd, filed: q.filed ?? null, salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null } : null,
      };
    }),
  };
}

// The biggest moves on any of the last month's trading days (6 Nov 2026, "the same
// for this, and the previous ones"): from each company's kept daily prices,
// on today's share basis, so a split day isn't read as a fall. Read once per
// market build: the last 35 closes of every company worth ₹1,000 crore or
// more (about a thousand small files).
let moverCache = null;
const MOVER_SPAN = { "1d": 1, "1w": 5, "1m": 21 };
// a month of trading days to pick from (7 Nov 2026: "can we go one month back")
const MOVER_DAYS = 23;
function moverCloses() {
  const snap = loadMarketSnapshot();
  const key = snap?.builtAt ?? snap?.pricesDate ?? "none";
  if (moverCache?.key === key) return moverCache;
  const rows = allMetrics().rows.filter(r => r.marketCapCr >= MOVER_FLOOR_CR);
  const dates = new Set(), closes = new Map(), info = new Map();
  for (const r of rows) {
    // a month of days to show, and a month before the oldest for its Month view
    // a year and a bit: the strip's month, its Month view, and an index chart's breadth for a year
    const bars = historyBars(r.symbol, snap).slice(-270);
    if (bars.length < 2) continue;
    const m = new Map(bars.map(b => [b.date, b.close]));
    closes.set(r.symbol, m);
    info.set(r.symbol, { symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null });
    for (const b of bars) dates.add(b.date);
  }
  // trading days most companies traded on (a stray date from one file isn't a day)
  const count = new Map();
  for (const m of closes.values()) for (const d of m.keys()) count.set(d, (count.get(d) ?? 0) + 1);
  const days = [...dates].filter(d => count.get(d) >= closes.size * 0.5).sort();
  moverCache = { key, days, closes, info };
  return moverCache;
}

export function moversOn(date, period = "1d") {
  const { days, closes, info } = moverCloses();
  const span = MOVER_SPAN[period] ?? 1;
  const at = date && days.includes(date) ? days.indexOf(date) : days.length - 1;
  const from = days[at - span];
  if (at < 0 || !from) return { date: days[at] ?? null, period, days: days.slice(-MOVER_DAYS).reverse(), floorCr: MOVER_FLOOR_CR, rows: [] };
  const rows = [];
  // the latest day reads the same figures as Markets' card (topMovers), so
  // the two never disagree; the days before, from the kept closes
  const [key] = PERIOD[period] ?? PERIOD["1d"];
  if (at === days.length - 1) {
    for (const r of allMetrics().rows) if (r.marketCapCr >= MOVER_FLOOR_CR && r[key] != null && r.cmp != null) rows.push({ symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null, close: r.cmp, change: r[key] });
  } else {
    for (const [sym, m] of closes) {
      const a = m.get(from), b = m.get(days[at]);
      if (!(a > 0) || !(b > 0)) continue;
      rows.push({ ...info.get(sym), close: b, change: (b / a - 1) * 100 });
    }
  }
  return { date: days[at], from, period, days: days.slice(-MOVER_DAYS).reverse(), floorCr: MOVER_FLOOR_CR, rows };
}

// What's inside an index, for the Markets page (7 Nov 2026: "this looks an
// exact copy of TradingView"): its companies' moves today (how many rose and
// fell), who moved it most — each company's share of the index by market
// value times its move, in index points (approximate: NSE weights by the
// shares freely traded, which we don't hold) — how many rose and fell on each
// of the chart's days, and the results its five largest companies filed
// within the chart's dates. Only the companies we hold figures for.
function membersOf(name, snap, sector) {
  const lists = { ...(snap?.screenIndices ?? {}), ...(snap?.indexMembers ?? {}) };
  const key = Object.keys(lists).find(k => k.toLowerCase() === String(name).toLowerCase());
  if (key) return lists[key];
  if (sector) return allMetrics().rows.filter(r => r.sectorIndex === name).map(r => r.symbol);
  return null;
}
const FY_Q = end => { const [y, m] = String(end).split("-").map(Number); return y && m ? `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}` : null; };
function indexStory(name, level, chartDays, snap, sector) {
  const syms = membersOf(name, snap, sector);
  if (!syms?.length) return null;
  const by = new Map(allMetrics().rows.map(r => [r.symbol, r]));
  const rows = syms.map(x => by.get(x)).filter(r => r && r.marketCapCr > 0);
  const moved = rows.filter(r => r.ret1d != null);
  if (moved.length < 3) return null;
  const total = moved.reduce((a, r) => a + r.marketCapCr, 0);
  const pts = moved.map(r => ({ symbol: r.symbol, name: r.name, change: r.ret1d, points: level ? level * (r.marketCapCr / total) * (r.ret1d / 100) : null }))
    .sort((a, b) => b.points - a.points);
  // the last month's breadth, from the kept closes (members worth ₹1,000 crore or more)
  let breadth = [];
  try {
    const { days, closes } = moverCloses();
    const inIdx = syms.filter(x => closes.has(x));
    const want = new Set(chartDays);
    breadth = days.filter(d => want.has(d)).map(d => {
      const k = days.indexOf(d), prev = days[k - 1];
      let rose = 0, fell = 0;
      for (const x of inIdx) { const a = closes.get(x).get(prev), b = closes.get(x).get(d); if (!(a > 0 && b > 0)) continue; if (b > a * 1.0005) rose++; else if (b < a * 0.9995) fell++; }
      return { date: d, rose, fell };
    }).filter(x => x.rose + x.fell > 0);
  } catch { breadth = []; }
  // results its ten largest companies filed within the chart's dates
  const first = chartDays[0], last = chartDays[chartDays.length - 1];
  const results = [];
  for (const r of [...rows].sort((a, b) => b.marketCapCr - a.marketCapCr).slice(0, 5)) {
    for (const q of (r.quarters ?? []).slice(0, 5)) {
      const f = String(q.filed ?? "").slice(0, 10);
      if (!f || f < first || f > last) continue;
      const on = chartDays.find(d => d >= f) ?? last;
      results.push({ date: on, filed: f, symbol: r.symbol, name: r.name, quarter: FY_Q(q.fyEnd), profitYoY: q.profitYoY ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null });
    }
  }
  return {
    members: moved.length,
    rose: moved.filter(r => r.ret1d > 0.05).length,
    fell: moved.filter(r => r.ret1d < -0.05).length,
    up: pts.filter(x => x.points > 0).slice(0, 5),
    down: pts.filter(x => x.points < 0).reverse().slice(0, 5),
    breadth,
    results: results.sort((a, b) => a.date.localeCompare(b.date)),
  };
}
