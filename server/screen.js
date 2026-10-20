// Reads the fetched filings in data/market/ and turns them into screenable
// rows via metrics.js. Parsing ~2,600 files and computing every company's
// metrics takes a moment, so the result is cached until the snapshot or the
// files change.
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync, renameSync } from "node:fs";
import { join } from "node:path";
import { badRequest } from "./http-errors.js";
import { computeMetrics } from "./metrics.js";
import { calculateLevels } from "./levels.js";
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
  if (!isValidSymbol(symbol)) throw badRequest(`Not an NSE symbol: ${symbol}`);
  mkdirSync(MARKET_DIR, { recursive: true });
  const path = join(MARKET_DIR, `${symbol}.json`);
  writeFileSync(`${path}.tmp`, JSON.stringify(data, null, 2));
  renameSync(`${path}.tmp`, path);
  if (cache) cache.version = "changed"; // rebuilt in slices; the last one serves meanwhile
}

export function countFetched() {
  return existsSync(MARKET_DIR) ? readdirSync(MARKET_DIR).filter(f => f.endsWith(".json")).length : 0;
}

let cache = null, building = null;
let peerMultiples = { sectors: new Map(), industries: new Map() };
// Companies in the screener, once it has been worked out since the server
// started (null before — the health check mustn't wait ~6 s to build it)
export const screenRowCount = () => cache?.rows.length ?? null;

function marketVersion() {
  const snap = loadMarketSnapshot();
  return `${snap?.builtAt ?? "none"}|${existsSync(MARKET_DIR) ? statSync(MARKET_DIR).mtimeMs : 0}`;
}

// Every company with a usable filing, with its metrics. Companies whose
// latest audited year is ~18 months older than the newest in the data have
// stopped filing and are left out.
//
// Built in slices (16 Oct 2026): the whole market is ~4.6 s of work on a
// full laptop core, ~9 s on a $7 Render instance and longer on a free one,
// and a server busy that long misses Render's 5-second health check and is
// restarted. So the work is a generator that yields between companies:
// buildInSlices runs it ~25 ms at a time and lets requests in between, while
// the last market keeps answering until the new one is swapped in whole.
function* buildSteps(version) {
  const snap = loadMarketSnapshot();
  const rows = [];
  const files = existsSync(MARKET_DIR) ? readdirSync(MARKET_DIR).filter(f => f.endsWith(".json")) : [];
  for (const f of files) {
    const stock = JSON.parse(readFileSync(join(MARKET_DIR, f), "utf-8"));
    const m = computeMetrics(stock, snap, {}, { research: false });
    if (m) rows.push(m);
    yield;
  }
  const newest = Math.max(...rows.map(r => new Date(r.fyEnd).getTime()));
  const fresh = rows.filter(r => newest - new Date(r.fyEnd).getTime() <= STALE_AFTER_DAYS * 86400000);
  // The research score compares each P/E with its sector's median, so it
  // waits for the whole market: medians first, then every company's score.
  // The stock page reuses the same medians (research.js keeps them) — set
  // only when this market is swapped in, so a page served mid-build still
  // matches the market it sits beside.
  const peers = { sectors: sectorPeMedians(fresh), industries: industryPeMedians(fresh) };
  capHistoricalMultiples(fresh, peers);
  yield;
  for (const m of fresh) { m.research = computeResearch(m, { peers }); yield; }
  // A company without a fair value shows EV/Sales beside its sector's, as
  // context only
  const evSales = sectorEvSalesMedians(fresh);
  for (const m of fresh) m.evToSalesSector = evSales.get(m.peerSector) ?? null;
  yield;
  const sizes = capSizes(fresh);
  const volatility = volatilitySpread(fresh);
  const dividends = dividendSpread(fresh);
  yield;
  return {
    peers,
    market: {
      version, rows: fresh, fetched: countFetched(), evSales, volatility, dividends,
      snapshot: snap ? { pricesDate: snap.pricesDate, builtAt: snap.builtAt } : null,
      sizes, ranges: metricRanges(fresh),
    },
  };
}

function install({ peers, market }) {
  peerMultiples = peers;
  setResearchPeers(peers);
  cache = market;
  return cache;
}

function buildNow(version) {
  const steps = buildSteps(version);
  let step;
  while (!(step = steps.next()).done);
  return install(step.value);
}

const SLICE_MS = 25;
async function buildInSlices(version) {
  const steps = buildSteps(version);
  for (;;) {
    const until = performance.now() + SLICE_MS;
    let step;
    while (!(step = steps.next()).done && performance.now() < until);
    if (step.done) return install(step.value);
    await new Promise(resolve => setImmediate(resolve));
  }
}

// One rebuild at a time; a change that lands mid-build is picked up by the
// next call, which sees the version move again
function rebuild(version) {
  building ??= buildInSlices(version).finally(() => { building = null; });
  return building;
}

// The market as it stands. Out of date: the last one, with a rebuild started
// behind it. Nothing built yet (a script, a test): built here and now.
export function allMetrics() {
  const version = marketVersion();
  if (cache?.version === version) return cache;
  if (cache) {
    rebuild(version).catch(e => console.error(`[market] rebuild failed: ${e.message}`));
    return cache;
  }
  return buildNow(version);
}

// For the server: resolves once there's a market to answer from, building
// the first one in slices — so no request, and no health check, ever waits
// on a build run straight through
export function marketReady() {
  const version = marketVersion();
  if (cache) {
    if (cache.version !== version) rebuild(version).catch(e => console.error(`[market] rebuild failed: ${e.message}`));
    return Promise.resolve(cache);
  }
  return rebuild(version);
}

// Each sector's median P/E on the last four consecutive quarters at the last
// close; stocks without a complete positive TTM EPS are left out.
function sectorPeMedians(rows) {
  const bySector = new Map();
  for (const m of rows) {
    const epsTtm = m.ttmEps;
    if (!m.peerSector || !(m.close > 0) || !(epsTtm > 0)) continue;
    if (!bySector.has(m.peerSector)) bySector.set(m.peerSector, []);
    bySector.get(m.peerSector).push(m.close / epsTtm);
  }
  const out = new Map();
  for (const [sector, pes] of bySector) {
    pes.sort((a, b) => a - b);
    const k = pes.length >> 1;
    out.set(sector, { median: pes.length % 2 ? pes[k] : (pes[k - 1] + pes[k]) / 2, n: pes.length });
  }
  return out;
}

// How much prices swing across the market — the calmest tenth, the middle,
// the wildest tenth of a year's volatility — and each sector's middle, for
// the stock page's "how jumpy is the price" line. By the sector the page
// shows (m.sector). Sectors with fewer than five companies get no median.
function volatilitySpread(rows) {
  const at = (v, p) => { const i = (v.length - 1) * p, lo = Math.floor(i); return Math.round((v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo)) * 10) / 10; };
  const all = [], bySector = new Map();
  for (const m of rows) {
    if (!(m.volatility1y > 0)) continue;
    all.push(m.volatility1y);
    if (m.sector) (bySector.get(m.sector) ?? bySector.set(m.sector, []).get(m.sector)).push(m.volatility1y);
  }
  const asc = (a, b) => a - b;
  all.sort(asc);
  const sectors = new Map();
  for (const [sector, v] of bySector) if (v.length >= 5) sectors.set(sector, { median: at(v.sort(asc), 0.5), n: v.length });
  return { market: all.length >= 20 ? { p10: at(all, 0.1), median: at(all, 0.5), p90: at(all, 0.9), n: all.length } : null, sectors };
}

// Dividend yields across the companies that paid one in the last 12 months:
// the lowest quarter's top, the middle, the top quarter's floor — and each
// sector's middle (five payers or more), for the company page's dividends
function dividendSpread(rows) {
  const at = (v, p) => { const i = (v.length - 1) * p, lo = Math.floor(i); return Math.round((v[lo] + (v[Math.ceil(i)] - v[lo]) * (i - lo)) * 100) / 100; };
  const asc = (a, b) => a - b;
  const payers = [], bySector = new Map();
  let priced = 0;
  for (const m of rows) {
    if (m.divYield == null) continue;
    priced++;
    if (!(m.divYield > 0)) continue;
    payers.push(m.divYield);
    if (m.sector) (bySector.get(m.sector) ?? bySector.set(m.sector, []).get(m.sector)).push(m.divYield);
  }
  payers.sort(asc);
  const sectors = new Map();
  for (const [sector, v] of bySector) if (v.length >= 5) sectors.set(sector, { median: at(v.sort(asc), 0.5), n: v.length });
  return { market: payers.length >= 20 ? { p25: at(payers, 0.25), median: at(payers, 0.5), p75: at(payers, 0.75), payers: payers.length, of: priced } : null, sectors };
}

// Each sector's median EV/Sales (enterprise value at the last close over the
// latest year's revenue); sectors with fewer than five companies are left out
function sectorEvSalesMedians(rows) {
  const bySector = new Map();
  for (const m of rows) {
    if (!m.peerSector || !(m.evToSales > 0)) continue;
    if (!bySector.has(m.peerSector)) bySector.set(m.peerSector, []);
    bySector.get(m.peerSector).push(m.evToSales);
  }
  const out = new Map();
  for (const [sector, v] of bySector) {
    if (v.length < 5) continue;
    v.sort((a, b) => a - b);
    const k = v.length >> 1;
    out.set(sector, { sector, median: Math.round((v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2) * 100) / 100, n: v.length });
  }
  return out;
}

// NSE's corporate-announcement industry is a finer peer cohort than the
// broad sector and is available for some companies with no sector mapping.
function industryPeMedians(rows) {
  const byIndustry = new Map();
  for (const m of rows) {
    const epsTtm = m.ttmEps;
    if (!m.industry || !(m.close > 0) || !(epsTtm > 0)) continue;
    if (!byIndustry.has(m.industry)) byIndustry.set(m.industry, []);
    byIndustry.get(m.industry).push(m.close / epsTtm);
  }
  const out = new Map();
  for (const [industry, pes] of byIndustry) {
    pes.sort((a, b) => a - b);
    const k = pes.length >> 1;
    out.set(industry, { median: pes.length % 2 ? pes[k] : (pes[k - 1] + pes[k]) / 2, n: pes.length });
  }
  return out;
}

// A company's own historical median P/E can be absurd when its earnings were
// tiny for years (Nykaa's ran to 1,472×, MMTC's past 4,000×), and fair value
// built on it means nothing. So the multiple behind fair value and the price
// levels is capped at twice the median P/E of its NSE sector — or of its NSE
// industry when the sector has fewer than five usable peers. Twice, not once:
// a company valued above its peers isn't wrong for it, and a cap at the plain
// median pulled every above-median company down to it (Reliance's fair value
// halved, TCS's down a fifth; 17–19 Oct 2026). The P/E history stays on the
// page as it is; only the multiple used for valuation changes.
export const PEER_CAP_TIMES = 2;
export function capHistoricalMultiples(rows, peers = peerMultiples) {
  for (const m of rows) {
    const model = m.valuation?.model;
    if (model !== "earnings" && model !== "cyclical") continue;
    const sector = m.peerSector ? peers.sectors.get(m.peerSector) : null;
    const industry = m.industry ? peers.industries.get(m.industry) : null;
    const cohort = sector?.n >= 5 ? { ...sector, label: m.peerSector }
      : industry?.n >= 5 ? { ...industry, label: `NSE industry ${m.industry}` }
        : null;
    const originalMultiple = model === "cyclical" ? m.valuation.multiple : m.medianPe;
    if (!(originalMultiple > 0)) continue;
    const cap = cohort ? cohort.median * PEER_CAP_TIMES : null;
    const multiple = cap != null ? Math.min(originalMultiple, cap) : originalMultiple;
    const clipped = multiple < originalMultiple;
    const basis = clipped
      ? `its own usual multiple (${originalMultiple.toFixed(1)}×) capped at twice the ${cohort.label} peers' median P/E (${cohort.median.toFixed(1)}×)`
      : cohort
        ? `its own usual multiple (${originalMultiple.toFixed(1)}×), within twice the ${cohort.label} peers' median P/E (${cohort.median.toFixed(1)}×)`
        : `its own usual multiple (${originalMultiple.toFixed(1)}×); no peer group with five usable P/Es`;
    m.valuationMultipleBasis = basis;
    // Within the cap: the levels metrics.js worked out stand, unchanged
    if (!clipped) {
      m.valuationMultiple = originalMultiple;
      m.valuationPeBasis = cohort ? "historical median, within twice the peers'" : "historical median; no peer group";
      continue;
    }
    const eps = model === "cyclical" ? m.valuation.exact?.eps : m.valuationEps;
    const growth = model === "cyclical" ? m.valuation.growth : m.growthForValuation;
    const levels = eps > 0 ? calculateLevels(eps, multiple, growth, 10) : null;
    if (!levels) continue;
    m.valuationMultiple = Math.round(multiple * 100) / 100;
    m.valuationPe = m.valuationMultiple;
    m.valuationPeBasis = "historical median, capped at twice the peers'";
    m.levels = levels;
    m.fairValue = levels.fv27;
    m.safeBuyPrice = levels.p1;
    m.vsFairValue = m.cmp > 0 && levels.fv25 > 0 ? (m.cmp / levels.fv25 - 1) * 100 : null;
    m.vsPhase1 = m.cmp > 0 && levels.p1 > 0 ? (m.cmp / levels.p1 - 1) * 100 : null;
    if (model === "cyclical") {
      m.valuation = {
        ...m.valuation,
        multiple: m.valuationMultiple,
        exact: { ...m.valuation.exact, multiple },
        fairValue: levels.fv25,
      };
    }
    if (m.research) m.research = computeResearch(m);
  }
}

// What the screener's filter picker and column picker offer, with each
// metric's spread across the market for its slider
export function screenerMeta() {
  const { rows, ranges } = allMetrics();
  const counts = {};
  for (const m of rows) if (m.sector) counts[m.sector] = (counts[m.sector] ?? 0) + 1;
  const sectors = Object.keys(counts).sort();
  return {
    categories: CATEGORIES,
    metrics: METRICS.map(({ get, ...x }) => ({ ...x, range: ranges[x.id] ?? null })),
    categoryMetrics: CATEGORY_METRICS.map(x => ({
      ...x,
      options: x.id === "sector" ? sectors : x.options,
      ...(x.id === "sector" ? { counts } : {}),
      known: x.id === "sector" ? rows.filter(m => m.sector).length : rows.length,
    })),
    companies: rows.length,
    // The dates behind each metric's basis ("most companies' latest year is
    // to March 2026"): the most common, as companies' years and filings differ
    periods: {
      pricesDate: loadMarketSnapshot()?.pricesDate ?? null,
      fyEnd: mostCommon(rows.map(m => m.fyEnd)),
      quarterEnd: mostCommon(rows.map(m => m.latestQuarter)),
      holdingAsOf: mostCommon(rows.map(m => m.holdingAsOf)),
    },
  };
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// The research score's headline numbers — the table, watchlist, compare and
// peers show these; only the stock page gets every item and reason
export function researchBrief(r) {
  if (!r) return null;
  return {
    quality: r.quality, qualityOnly: r.qualityOnly, provisional: r.provisional, capped: !!r.capped, capReason: r.capped?.reason ?? null,
    overall: r.overall.score, stance: r.overall.stance, status: r.overall.status, overallText: r.overall.text,
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
    symbol: m.symbol, name: m.name, sector: m.sector, sectorSource: m.sectorSource, lender: m.lender, fyEnd: m.fyEnd,
    cmp: m.cmp, eps: m.eps, ttmEps: m.ttmEps, pe: m.pe, peTtm: m.peTtm, peFy: m.peFy, roce: m.roce, roe: m.roe, roeAvg: m.roeAvg, roeAvgYears: m.roeAvgYears,
    opm: m.opm, promoterPct: m.promoterPct, fiiPct: m.fiiPct, diiPct: m.diiPct, pledgedPct: m.pledgedPct,
    marketCapCr: m.marketCapCr, divYield: m.divYield,
    debtToEquity: m.debtToEquity, salesGrowth3y: m.salesGrowth3y, profitGrowth5y: m.profitGrowth5y,
    ncavCr: m.ncavCr, fairValue: m.fairValue, safeBuyPrice: m.safeBuyPrice,
    fv25: m.levels?.fv25 ?? null, p2: m.levels?.p2 ?? null, p3: m.levels?.p3 ?? null,
    stopLoss: m.levels?.stopLoss ?? null, target: m.levels?.target ?? null,
    low52w: m.low52w, high52w: m.high52w, ret1d: m.ret1d ?? null, piotroski: m.piotroski ?? null,
    valuationPeBasis: m.valuationPeBasis, valuationMultipleBasis: m.valuationMultipleBasis,
    epsCorrection: m.epsCorrection, epsMismatch: m.epsMismatch,
    auditorResignations: m.auditorResignations,
    epsJump: m.epsJump, research: researchBrief(m.research),
    // Which model priced it, or why nothing did (metrics.js valuation)
    valuation: m.valuation ? { model: m.valuation.model, as: m.valuation.as, reason: m.valuation.reason ?? null, positionLabel: m.valuation.positionLabel ?? null, partialCycle: !!m.valuation.partialCycle } : null,
    governmentOwned: !!m.governmentOwned,
    // For the watchlist's "results in" mark
    latestQuarter: m.latestQuarter ?? null, latestQuarterFiled: m.latestQuarterFiled ?? null, nextResults: m.nextResults ?? null,
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
    // with its upcoming board meetings and ex-dates, for the Watchlist's
    // "coming up" line (src/watchEvents.js)
    return m ? { ...tableRow(m, [], sizes), events: m.events ?? null } : { symbol: s, name: s, missing: true };
  });
}

// A screen: { filters: [{ id, min, max } | { id, values }], columns: [ids],
// countOnly?, top? }.
// The strategies and older callers send the original's criteria instead,
// which become the same filters.
export function screen(request = {}) {
  const { rows, fetched, snapshot, sizes } = allMetrics();
  const filters = Array.isArray(request.filters) ? cleanFilters(request.filters) : criteriaToFilters(request);
  const columns = (Array.isArray(request.columns) ? request.columns : [])
    .filter(id => metricById(id) && !metricById(id).options && id !== "sector").slice(0, 40);
  const matches = rows.filter(m => matchesFilters(m, filters, sizes));
  // countOnly: how many match, for the strategy cards on Discover's first page;
  // with top: N, also the N best by quality score (symbol, name, score)
  if (request.countOnly) {
    const top = Math.max(0, Math.min(10, Number(request.top) || 0));
    const best = top ? [...matches].sort((a, b) => (b.research?.quality ?? -1) - (a.research?.quality ?? -1)).slice(0, top)
      .map(m => ({ symbol: m.symbol, name: m.name, quality: m.research?.quality == null ? null : Math.round(m.research.quality) })) : undefined;
    return { total: rows.length, matched: matches.length, snapshot, ...(best && { top: best }) };
  }
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

// The strategy tracker compares symbols only; avoid building full table rows
// for every match when a user opens Discover.
export function matchingSymbols(request = {}) {
  const { rows, sizes } = allMetrics();
  const filters = Array.isArray(request.filters) ? cleanFilters(request.filters) : criteriaToFilters(request);
  return rows.filter(m => matchesFilters(m, filters, sizes)).map(m => m.symbol);
}
