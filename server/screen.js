// Reads the fetched filings in data/market/ and turns them into screenable
// rows via metrics.js. Parsing ~2,600 files and computing every company's
// metrics takes a moment, so the result is cached until the snapshot or the
// files change.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { computeMetrics } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";
import { MARKET_DIR } from "./paths.js";
import {
  CATEGORIES, METRICS, CATEGORY_METRICS, metricById, valueOf, capSizes, metricRanges,
  criteriaToFilters, cleanFilters, matchesFilters, describeFilters, coverageNotes,
} from "./metric-catalog.js";
const STALE_AFTER_DAYS = 550; // ~18 months — a healthy company files annually

// NSE symbols are letters, digits, "&" and "-" (M&M, BAJAJ-AUTO). Anything
// else never reaches a file path — "../x" would otherwise read or write
// outside data/market.
export const isValidSymbol = s => typeof s === "string" && /^[A-Z0-9&-]{1,20}$/.test(s);

export function getStock(symbol) {
  if (!isValidSymbol(symbol)) return null;
  const path = join(MARKET_DIR, `${symbol}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, "utf-8"));
  return data.error ? null : data;
}

// Written to a temp file and renamed into place: a reader never sees half a
// file, and the rename bumps the directory's mtime, which is how a running
// server notices that a background fetch changed an existing company (an
// in-place overwrite would leave the directory mtime, and the cache, as is).
export function saveStock(symbol, data) {
  if (!isValidSymbol(symbol)) throw new Error(`Not an NSE symbol: ${symbol}`);
  mkdirSync(MARKET_DIR, { recursive: true });
  const path = join(MARKET_DIR, `${symbol}.json`);
  writeFileSync(`${path}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${path}.tmp`, path);
  cache = null;
}

export function countFetched() {
  return existsSync(MARKET_DIR) ? readdirSync(MARKET_DIR).filter(f => f.endsWith(".json")).length : 0;
}

let cache = null;

function marketVersion() {
  const snap = loadMarketSnapshot();
  return `${snap?.builtAt ?? "none"}|${existsSync(MARKET_DIR) ? statSync(MARKET_DIR).mtimeMs : 0}`;
}

// Every company with a usable filing, with its metrics. Companies whose
// latest audited year is ~18 months older than the newest in the data have
// stopped filing and are left out.
export function allMetrics() {
  const version = marketVersion();
  if (cache?.version === version) return cache;
  const snap = loadMarketSnapshot();
  const rows = [];
  const files = existsSync(MARKET_DIR) ? readdirSync(MARKET_DIR).filter(f => f.endsWith(".json")) : [];
  for (const f of files) {
    const stock = JSON.parse(readFileSync(join(MARKET_DIR, f), "utf-8"));
    const m = computeMetrics(stock, snap);
    if (m) rows.push(m);
  }
  const newest = Math.max(...rows.map(r => new Date(r.fyEnd).getTime()));
  const fresh = rows.filter(r => newest - new Date(r.fyEnd).getTime() <= STALE_AFTER_DAYS * 86400000);
  cache = {
    version, rows: fresh, fetched: countFetched(),
    snapshot: snap ? { pricesDate: snap.pricesDate, builtAt: snap.builtAt } : null,
    sizes: capSizes(fresh),
    ranges: metricRanges(fresh),
  };
  return cache;
}

// What the screener's filter picker and column picker offer, with each
// metric's spread across the market for its slider
export function screenerMeta() {
  const { rows, ranges } = allMetrics();
  const sectors = [...new Set(rows.map(m => m.sector).filter(Boolean))].sort();
  return {
    categories: CATEGORIES,
    metrics: METRICS.map(({ get, ...x }) => ({ ...x, range: ranges[x.id] ?? null })),
    categoryMetrics: CATEGORY_METRICS.map(x => ({
      ...x,
      options: x.id === "sector" ? sectors : x.options,
      known: x.id === "sector" ? rows.filter(m => m.sector).length : rows.length,
    })),
    companies: rows.length,
  };
}

// The table only needs these; the stock page gets the full metrics.
// The table's fixed fields, plus `values` for the metric columns the screener
// asked for (its filters and whatever columns the user added)
function tableRow(m, columns = [], sizes = null) {
  return {
    ...(columns.length && { values: Object.fromEntries(columns.map(id => [id, valueOf(metricById(id), m)])) }),
    capSize: sizes?.get(m.symbol) ?? null,
    symbol: m.symbol, name: m.name, sector: m.sector, lender: m.lender, fyEnd: m.fyEnd,
    cmp: m.cmp, eps: m.eps, pe: m.pe, roce: m.roce, roe: m.roe, roeAvg: m.roeAvg, roeAvgYears: m.roeAvgYears,
    opm: m.opm, promoterPct: m.promoterPct, fiiPct: m.fiiPct, diiPct: m.diiPct, pledgedPct: m.pledgedPct,
    marketCapCr: m.marketCapCr, divYield: m.divYield,
    debtToEquity: m.debtToEquity, salesGrowth3y: m.salesGrowth3y, profitGrowth5y: m.profitGrowth5y,
    ncavCr: m.ncavCr, fairValue: m.fairValue, safeBuyPrice: m.safeBuyPrice,
    p2: m.levels?.p2 ?? null, p3: m.levels?.p3 ?? null,
    stopLoss: m.levels?.stopLoss ?? null, target: m.levels?.target ?? null,
    low52w: m.low52w, high52w: m.high52w,
    valuationPeBasis: m.valuationPeBasis, epsJump: m.epsJump, score: { green: m.score.green, applicable: m.score.applicable },
  };
}

// Table rows for specific companies (the watchlist), in the order given —
// including ones the screen leaves out for stale filings. A symbol with no
// usable filings at all still gets a row, so it can be removed.
export function rowsFor(symbols) {
  const { rows, sizes } = allMetrics();
  const bySymbol = new Map(rows.map(m => [m.symbol, m]));
  return symbols.map(s => {
    const m = bySymbol.get(s) ?? computeMetrics(getStock(s), loadMarketSnapshot());
    return m ? tableRow(m, [], sizes) : { symbol: s, name: s, missing: true };
  });
}

// A screen: { filters: [{ id, min, max } | { id, values }], columns: [ids] }.
// The strategies and older callers send the original's criteria instead,
// which become the same filters.
export function screen(request = {}) {
  const { rows, fetched, snapshot, sizes } = allMetrics();
  const filters = Array.isArray(request.filters) ? cleanFilters(request.filters) : criteriaToFilters(request);
  const columns = (Array.isArray(request.columns) ? request.columns : [])
    .filter(id => metricById(id) && !metricById(id).options && id !== "sector").slice(0, 40);
  const matches = rows.filter(m => matchesFilters(m, filters, sizes));
  // Green-flag count first, then ROCE — the original's default ranking. By
  // count, not fraction, as the original does: a fraction would lift banks
  // (scored out of 8) above equally strong companies scored out of 10.
  matches.sort((a, b) => b.score.green - a.score.green || (b.roce ?? -Infinity) - (a.roce ?? -Infinity));
  return {
    total: rows.length,
    fetched,
    matched: matches.length,
    filters,
    queryUsed: describeFilters(filters),
    unsupported: [],
    notes: coverageNotes(rows, filters),
    snapshot,
    results: matches.map(m => tableRow(m, columns, sizes)),
  };
}
