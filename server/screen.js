// Reads the fetched filings in data/market/ and turns them into screenable
// rows via metrics.js. Parsing ~2,600 files and computing every company's
// metrics takes a moment, so the result is cached until the snapshot or the
// files change.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { computeMetrics } from "./metrics.js";
import { computeResearch, setResearchPeers } from "./research.js";
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
    const m = computeMetrics(stock, snap, {}, { research: false });
    if (m) rows.push(m);
  }
  const newest = Math.max(...rows.map(r => new Date(r.fyEnd).getTime()));
  const fresh = rows.filter(r => newest - new Date(r.fyEnd).getTime() <= STALE_AFTER_DAYS * 86400000);
  // The research score compares each P/E with its sector's median, so it
  // waits for the whole market: medians first, then every company's score.
  // The stock page reuses the same medians (research.js keeps them).
  setResearchPeers({ sectors: sectorPeMedians(fresh), industries: industryPeMedians(fresh) });
  for (const m of fresh) m.research = computeResearch(m);
  cache = {
    version, rows: fresh, fetched: countFetched(),
    snapshot: snap ? { pricesDate: snap.pricesDate, builtAt: snap.builtAt } : null,
    sizes: capSizes(fresh),
    ranges: metricRanges(fresh),
  };
  return cache;
}

// Each sector's median P/E at the last close, on the same earnings the fair
// value uses (the usual EPS after a one-off jump); loss-makers left out
function sectorPeMedians(rows) {
  const bySector = new Map();
  for (const m of rows) {
    if (!m.sector || !(m.close > 0) || !(m.valuationEps > 0)) continue;
    if (!bySector.has(m.sector)) bySector.set(m.sector, []);
    bySector.get(m.sector).push(m.close / m.valuationEps);
  }
  const out = new Map();
  for (const [sector, pes] of bySector) {
    pes.sort((a, b) => a - b);
    const k = pes.length >> 1;
    out.set(sector, { median: pes.length % 2 ? pes[k] : (pes[k - 1] + pes[k]) / 2, n: pes.length });
  }
  return out;
}

// NSE's corporate-announcement industry is a finer peer cohort than the
// broad sector and is available for some companies with no sector mapping.
function industryPeMedians(rows) {
  const byIndustry = new Map();
  for (const m of rows) {
    if (!m.industry || !(m.close > 0) || !(m.valuationEps > 0)) continue;
    if (!byIndustry.has(m.industry)) byIndustry.set(m.industry, []);
    byIndustry.get(m.industry).push(m.close / m.valuationEps);
  }
  const out = new Map();
  for (const [industry, pes] of byIndustry) {
    pes.sort((a, b) => a - b);
    const k = pes.length >> 1;
    out.set(industry, { median: pes.length % 2 ? pes[k] : (pes[k - 1] + pes[k]) / 2, n: pes.length });
  }
  return out;
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

// The research score's headline numbers — the table, watchlist, compare and
// peers show these; only the stock page gets every item and reason
export function researchBrief(r) {
  if (!r) return null;
  return {
    quality: r.quality, qualityOnly: r.qualityOnly, provisional: r.provisional, capped: !!r.capped,
    overall: r.overall.score, stance: r.overall.stance, status: r.overall.status,
    valuation: r.valuation.score, valuationLabel: r.valuation.label,
    technical: r.technical.score, technicalLabel: r.technical.label,
    risk: r.risk.score, riskLabel: r.risk.label,
    confidence: r.confidence, coverage: r.coverage,
    groups: Object.fromEntries(r.groups.map(g => [g.id, g.score])),
    flags: r.flags.map(f => f.id),
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
    fv25: m.levels?.fv25 ?? null, p2: m.levels?.p2 ?? null, p3: m.levels?.p3 ?? null,
    stopLoss: m.levels?.stopLoss ?? null, target: m.levels?.target ?? null,
    low52w: m.low52w, high52w: m.high52w,
    valuationPeBasis: m.valuationPeBasis, epsJump: m.epsJump, research: researchBrief(m.research),
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
  // Quality score first (unscored companies last), then ROCE
  matches.sort((a, b) => (b.research?.quality ?? -1) - (a.research?.quality ?? -1) || (b.roce ?? -Infinity) - (a.roce ?? -Infinity));
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
