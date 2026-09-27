// Reads the fetched filings in data/market/ and turns them into screenable
// rows via metrics.js. Parsing ~2,600 files and computing every company's
// metrics takes a moment, so the result is cached until the snapshot or the
// files change.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeMetrics, matchesCriteria, unsupportedCriteria, describeCriteria } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKET_DIR = join(__dirname, "..", "data", "market");
const STALE_AFTER_DAYS = 550; // ~18 months — a healthy company files annually

export function getStock(symbol) {
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
    symbol: m.symbol, name: m.name, sector: m.sector, lender: m.lender,
    cmp: m.cmp, pe: m.pe, roce: m.roce, roe: m.roe, roeAvg: m.roeAvg, roeAvgYears: m.roeAvgYears,
    opm: m.opm, promoterPct: m.promoterPct, fiiPct: m.fiiPct, diiPct: m.diiPct, pledgedPct: m.pledgedPct,
    marketCapCr: m.marketCapCr, divYield: m.divYield,
    debtToEquity: m.debtToEquity, salesGrowth3y: m.salesGrowth3y, profitGrowth5y: m.profitGrowth5y,
    ncavCr: m.ncavCr, fairValue: m.fairValue, safeBuyPrice: m.safeBuyPrice,
    p2: m.levels?.p2 ?? null, p3: m.levels?.p3 ?? null,
    valuationPeBasis: m.valuationPeBasis, score: { green: m.score.green, applicable: m.score.applicable },
  };
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
    snapshot,
    results: matches.map(tableRow),
  };
}
