// Reads the fetched filings in data/market/ and turns them into screenable
// rows via metrics.js. Parsing ~2,600 files and computing every company's
// metrics takes a moment, so the result is cached until the snapshot or the
// files change.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { computeMetrics, matchesCriteria, unsupportedCriteria, describeCriteria } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";
import { MARKET_DIR } from "./paths.js";
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
  cache = { version, rows: fresh, fetched: countFetched(), snapshot: snap ? { pricesDate: snap.pricesDate, builtAt: snap.builtAt } : null };
  return cache;
}

// The table only needs these; the stock page gets the full metrics.
function tableRow(m) {
  return {
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
  const { rows } = allMetrics();
  const bySymbol = new Map(rows.map(m => [m.symbol, m]));
  return symbols.map(s => {
    const m = bySymbol.get(s) ?? computeMetrics(getStock(s), loadMarketSnapshot());
    return m ? tableRow(m) : { symbol: s, name: s, missing: true };
  });
}

// Filters on data that only some companies have: say how many, since the rest
// are left out rather than guessed.
const PARTIAL = [
  ["piotroski_min", "piotroski", "Piotroski score"],
  ["fcf_positive", "fcfCr", "Free cash flow"],
  ["fii_holding_min", "fiiPct", "FII holding"],
  ["dii_holding_min", "diiPct", "DII holding"],
  ["near_52w_low_pct", "low52w", "52-week range"],
  ["pct_below_52w_high_min", "high52w", "52-week range"],
];

function coverageNotes(rows, criteria) {
  const notes = new Set();
  for (const [key, field, label] of PARTIAL) {
    if (!criteria[key]) continue;
    const known = rows.filter(m => m[field] != null).length;
    if (known < rows.length) notes.add(`${label} is known for ${known.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} companies — the rest are left out.`);
  }
  return [...notes];
}

export function screen(criteria) {
  const { rows, fetched, snapshot } = allMetrics();
  const matches = rows.filter(m => matchesCriteria(m, criteria));
  // Green-flag count first, then ROCE — the original's default ranking. By
  // count, not fraction, as the original does: a fraction would lift banks
  // (scored out of 8) above equally strong companies scored out of 10.
  matches.sort((a, b) => b.score.green - a.score.green || (b.roce ?? -Infinity) - (a.roce ?? -Infinity));
  return {
    total: rows.length,
    fetched,
    matched: matches.length,
    queryUsed: describeCriteria(criteria),
    unsupported: unsupportedCriteria(criteria),
    notes: coverageNotes(rows, criteria),
    snapshot,
    results: matches.map(tableRow),
  };
}
