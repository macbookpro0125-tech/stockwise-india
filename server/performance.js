// Strategy performance, ported from stock-screener's server/performance.js:
// every few days, record each strategy's top picks and their prices; later,
// compare those prices with today's to see which strategies actually made
// money. The strategies are the same for everyone, so the record is one file
// for the whole app, not per account. Today's prices come from the daily
// snapshot's closes, adjusted for any split or bonus since the pick.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_DIR } from "./paths.js";
import { PRESETS } from "./presets.js";
import { allMetrics, screen } from "./screen.js";
import { indexCloseOn, loadMarketSnapshot } from "./market-data.js";
import { RESEARCH_VERSION } from "./research.js";

const SNAP_PATH = join(DATA_DIR, "performance-snapshots.json");
const RESEARCH_COHORT_PATH = join(DATA_DIR, "research-score-cohorts.json");
const PICKS_PER_PRESET = 10;
const SCORE_BUCKETS = ["Lowest", "Lower", "Middle", "Higher", "Highest"];
export const SNAPSHOT_INTERVAL_DAYS = 3;

function istToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function loadSnapshots() {
  try {
    if (existsSync(SNAP_PATH)) return JSON.parse(readFileSync(SNAP_PATH, "utf8"));
  } catch { /* corrupt file — start fresh */ }
  return [];
}

function saveSnapshots(snaps) {
  mkdirSync(dirname(SNAP_PATH), { recursive: true });
  writeFileSync(SNAP_PATH, JSON.stringify(snaps, null, 2));
}

export function loadResearchCohorts() {
  try {
    if (existsSync(RESEARCH_COHORT_PATH)) return JSON.parse(readFileSync(RESEARCH_COHORT_PATH, "utf8"));
  } catch { /* corrupt file — start a new prospective study */ }
  return [];
}

function saveResearchCohorts(cohorts) {
  mkdirSync(dirname(RESEARCH_COHORT_PATH), { recursive: true });
  writeFileSync(RESEARCH_COHORT_PATH, JSON.stringify(cohorts, null, 2));
}

// Score bands are fixed when a monthly cohort is recorded. Later returns are
// measured against the same frozen ranking and score version.
export async function takeResearchCohort() {
  const market = loadMarketSnapshot();
  if (!market?.pricesDate || !market?.prices) return { skipped: "no market snapshot" };
  const month = market.pricesDate.slice(0, 7);
  const cohorts = loadResearchCohorts();
  const existing = cohorts.find(c => c.month === month);
  if (existing) return { month, created: false, companies: existing.records.length };

  const metrics = allMetrics();
  const records = metrics.rows
    .filter(m => m.cmp > 0 && m.research?.overall != null)
    .map(m => ({
      ticker: m.symbol,
      name: m.name,
      sector: m.sector ?? null,
      close: m.cmp,
      quality: m.research.quality,
      qualityOnly: m.research.qualityOnly,
      valuation: m.research.valuation?.score ?? null,
      overall: m.research.overall?.score ?? null,
      technical: m.research.technical?.score ?? null,
      risk: m.research.risk?.score ?? null,
      groups: Object.fromEntries(m.research.groups.map(group => [group.id, group.score])),
      confidence: m.research.confidence,
      financialsAsOf: m.history?.[0]?.filed ?? null,
    }));
  if (!records.length) return { month, skipped: "no scored companies" };
  const benchmarkClose = await indexCloseOn(market.pricesDate, "Nifty 500");
  const cohort = {
    month,
    date: market.pricesDate,
    recordedAt: new Date().toISOString(),
    priceDate: market.pricesDate,
    scoreVersion: RESEARCH_VERSION,
    benchmark: "Nifty 500",
    benchmarkClose,
    records,
  };
  cohorts.push(cohort);
  saveResearchCohorts(cohorts);
  return { month, created: true, companies: records.length, scoreVersion: RESEARCH_VERSION };
}

// Pure calculation kept exported so split adjustment, score ranking,
// missing-price coverage and benchmark comparisons can be tested without
// touching the saved production cohort file.
export function summarizeResearchCohort(cohort, market, benchmarkNow = null) {
  const splits = market?.splits ?? {};
  const factorSince = (symbol, date) => (splits[symbol] ?? [])
    .filter(s => s.exDate > date).reduce((f, s) => f * s.ratio, 1);
  const ranked = [...(cohort.records ?? [])]
    .filter(r => Number.isFinite(r.overall) && r.overall != null)
    .sort((a, b) => a.overall - b.overall || a.ticker.localeCompare(b.ticker));
  const grouped = SCORE_BUCKETS.map((label, i) => ({ label, records: [] }));
  ranked.forEach((record, i) => grouped[Math.min(SCORE_BUCKETS.length - 1, Math.floor(i * SCORE_BUCKETS.length / ranked.length))].records.push(record));
  const benchmarkReturnPct = cohort.benchmarkClose > 0 && benchmarkNow > 0
    ? Math.round((benchmarkNow / cohort.benchmarkClose - 1) * 1000) / 10 : null;
  const buckets = grouped.map(group => {
    const observations = group.records.flatMap(record => {
      const current = market?.prices?.[record.ticker];
      if (!(current > 0) || !(record.close > 0)) return [];
      const adjustedCurrent = current * factorSince(record.ticker, cohort.priceDate);
      return [{ score: record.overall, returnPct: (adjustedCurrent / record.close - 1) * 100 }];
    });
    const mean = observations.length ? observations.reduce((sum, row) => sum + row.returnPct, 0) / observations.length : null;
    const scores = group.records.map(r => r.overall);
    return {
      label: group.label,
      companies: group.records.length,
      priced: observations.length,
      scoreMin: scores.length ? Math.round(Math.min(...scores) * 10) / 10 : null,
      scoreMax: scores.length ? Math.round(Math.max(...scores) * 10) / 10 : null,
      meanPriceReturnPct: mean == null ? null : Math.round(mean * 10) / 10,
      excessVsBenchmarkPct: mean == null || benchmarkReturnPct == null ? null : Math.round((mean - benchmarkReturnPct) * 10) / 10,
    };
  });
  return {
    date: cohort.date,
    scoreVersion: cohort.scoreVersion,
    benchmark: cohort.benchmark,
    benchmarkReturnPct,
    companies: ranked.length,
    priceDate: market?.pricesDate ?? null,
    buckets,
  };
}

// One snapshot per strategy per IST day — re-running the same day replaces
// that day's. Picks are the strategy's top 10 in its own ranking (quality
// score, then ROCE), priced at the day's close. Snapshots before 3 Oct 2026
// record the old 10-point score (score/scoreMax) instead.
export async function takeSnapshots() {
  const date = istToday();
  const snaps = loadSnapshots();
  const results = [];
  for (const preset of PRESETS) {
    const res = screen(preset.criteria);
    const picks = res.results
      .filter(s => s.cmp > 0)
      .slice(0, PICKS_PER_PRESET)
      .map(s => ({ ticker: s.symbol, name: s.name, cmp: s.cmp, quality: s.research?.quality ?? null, overall: s.research?.overall ?? null }));
    if (!picks.length) {
      results.push({ presetId: preset.id, skipped: "no picks" });
      continue;
    }
    const snap = { presetId: preset.id, presetName: preset.name, date, pricesDate: res.snapshot?.pricesDate ?? null, picks };
    const idx = snaps.findIndex(s => s.presetId === preset.id && s.date === date);
    if (idx >= 0) snaps[idx] = snap; else snaps.push(snap);
    results.push({ presetId: preset.id, picks: picks.length });
  }
  saveSnapshots(snaps);
  const researchCohort = await takeResearchCohort();
  return { date, results, totalSnapshots: snaps.length, researchCohort };
}

export function daysSinceNewestSnapshot() {
  const snaps = loadSnapshots();
  if (!snaps.length) return Infinity;
  const newest = snaps.map(s => s.date).sort().at(-1);
  return (Date.now() - new Date(`${newest}T00:00:00+05:30`).getTime()) / 86400000;
}

export async function getPerformance() {
  const snaps = loadSnapshots();
  const market = loadMarketSnapshot();
  const benchmarkNow = await indexCloseOn(market?.pricesDate, "Nifty 500");
  const splits = market?.splits ?? {};
  // A 1:1 bonus after the pick halves the quoted price without anyone losing
  // money — scale today's price back to the pick's share basis
  const factorSince = (sym, iso) => (splits[sym] ?? []).filter(s => s.exDate > iso).reduce((f, s) => f * s.ratio, 1);

  const tickers = new Set();
  const byPreset = new Map();
  for (const snap of snaps) {
    const picks = snap.picks.map(p => {
      tickers.add(p.ticker);
      const raw = market?.prices?.[p.ticker] ?? null;
      const cur = raw != null ? Math.round(raw * factorSince(p.ticker, snap.pricesDate ?? snap.date) * 100) / 100 : null;
      const returnPct = cur != null && p.cmp > 0 ? Math.round(((cur - p.cmp) / p.cmp) * 1000) / 10 : null;
      return { ...p, currentPrice: cur, returnPct };
    });
    const rets = picks.map(p => p.returnPct).filter(r => r != null);
    const avgReturnPct = rets.length ? Math.round((rets.reduce((a, b) => a + b, 0) / rets.length) * 10) / 10 : null;
    const entry = byPreset.get(snap.presetId) ?? { presetId: snap.presetId, presetName: snap.presetName, snapshots: [] };
    entry.presetName = snap.presetName;
    entry.snapshots.push({ date: snap.date, picks, avgReturnPct, priced: rets.length });
    byPreset.set(snap.presetId, entry);
  }

  const presets = [...byPreset.values()].map(p => {
    p.snapshots.sort((a, b) => a.date.localeCompare(b.date));
    // The headline is the oldest cohort's return — the longest-held picks
    const oldest = p.snapshots[0];
    return { ...p, sinceDate: oldest.date, overallAvgReturnPct: oldest.avgReturnPct };
  });
  // Best-performing strategy first
  presets.sort((a, b) => (b.overallAvgReturnPct ?? -Infinity) - (a.overallAvgReturnPct ?? -Infinity));
  const priced = [...tickers].filter(t => market?.prices?.[t] != null).length;
  const cohorts = loadResearchCohorts().map(cohort => summarizeResearchCohort(cohort, market, benchmarkNow));
  return {
    presets,
    snapshotCount: snaps.length,
    pricedTickers: priced,
    totalTickers: tickers.size,
    pricesDate: market?.pricesDate ?? null,
    researchStudy: {
      benchmark: "Nifty 500",
      returnType: "split-adjusted price return; dividends excluded",
      asOf: market?.pricesDate ?? null,
      cohortCount: cohorts.length,
      cohorts,
    },
  };
}
