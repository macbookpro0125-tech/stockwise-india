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

export const HEAT_SETS = [...Object.keys(HEATMAP_LISTS), "sectors"];
const PERIOD = { "1d": ["ret1d", 1], "1w": ["ret1w", 5], "1m": ["ret1m", 21] };

export async function heatmap(set = "Nifty 50", period = "1d") {
  const [key, sessions] = PERIOD[period] ?? PERIOD["1d"];
  const { board: b, snap } = await board();
  const asOf = b?.days[b.days.length - 1] ?? snap?.pricesDate ?? null;
  if (set === "sectors") {
    if (!b) return { asOf, set, period, items: [], pending: true };
    const items = b.indices.filter(i => i.group === "sector").map(i => {
      const closes = i.closes.filter(c => c != null);
      return { index: i.name, change: period === "1d" ? i.changePct : over(closes, sessions), weight: 1 };
    }).filter(i => i.change != null);
    return { asOf, set, period, items };
  }
  const list = (await members())?.[set];
  if (!list) return { asOf, set, period, items: [], pending: true };
  const bySymbol = new Map(allMetrics().rows.map(r => [r.symbol, r]));
  const items = list.map(sym => bySymbol.get(sym)).filter(r => r?.marketCapCr > 0 && r[key] != null)
    .map(r => ({ symbol: r.symbol, name: r.name, sector: r.sector ?? null, weight: r.marketCapCr, change: r[key], close: r.cmp ?? null }))
    .sort((a, b2) => b2.weight - a.weight);
  return { asOf, set, period, items, members: list.length };
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
    byDay.get(d).push({ symbol: r.symbol, name: r.name, marketCapCr: r.marketCapCr ?? null, sector: r.sector ?? null, lastProfitYoY: r.qProfitGrowthYoY ?? null });
  }
  return {
    today,
    days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({ date, count: list.length, companies: list.sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)) })),
  };
}
