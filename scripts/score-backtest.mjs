// Did a high overall score come before a better return? (12 Nov 2026)
//
// For each test date, the market is scored as it stood that day: only the
// annual and quarterly results filed with NSE by then, the promoter holding
// last filed by then, prices and technicals from the daily bars up to then,
// and the same score (research.js) the app shows today. Then each company's
// price 6 and 12 months later, against the Nifty 50 over the same days
// (NIFTYBEES, the fund that tracks it: the kept Nifty 500 closes have gaps
// before 2025).
//
//   node scripts/score-backtest.mjs            prints the summary
//   node scripts/score-backtest.mjs --json F   also writes every cohort to F
//
// What it can't do, stated in the output too:
// - Only companies listed today are in the data: ones delisted since (often
//   failures) are missing, which flatters every group a little.
// - Price return only; dividends are left out.
// - Sector names are today's.
// - Pledged shares are only known for the latest filing, so they count as
//   not known before it.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATA_DIR ??= join(ROOT, "data");
const { MARKET_DIR, HISTORY_DIR } = await import("../server/paths.js");
const { computeMetrics } = await import("../server/metrics.js");
const { computeResearch } = await import("../server/research.js");
const { freshRows, marketPeers, rankByOverall } = await import("../server/screen.js");
const { loadMarketSnapshot, technicals } = await import("../server/market-data.js");

const MIN_CAP_CR = 500; // as the "Highest Overall Scores" strategy
const TOP_N = 25;
const DAY = 86400000;
const iso = d => new Date(d).toISOString().slice(0, 10);
const addMonths = (day, n) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };

const now = loadMarketSnapshot();
// The benchmark, from the Nifty 50 fund's bars (kept beside the companies')
const indexBars = JSON.parse(readFileSync(join(HISTORY_DIR, "NIFTYBEES.json"), "utf-8")).bars;
const lastDay = indexBars.at(-1)[0];
const niftyMap = new Map(indexBars.map(b => [b[0], b[4]]));

// Mid-February, May, August and November: a few weeks after each results
// season. Quarterly results are kept from late 2023 (most companies' first is
// Sep 2023), so the test starts in Feb 2024; until mid-2025 the score works
// with fewer quarters than it has today, and says so as a data gap.
const DATES = [];
for (let d = "2024-02-15"; addMonths(d, 6) <= lastDay; d = addMonths(d, 3)) DATES.push(d);

// The last close on or before a day (within a week, else not traded)
const closeOn = (bars, day) => {
  let lo = 0, hi = bars.length - 1, found = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (bars[mid][0] <= day) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  if (found < 0 || Date.parse(day) - Date.parse(bars[found][0]) > 7 * DAY) return null;
  return { i: found, date: bars[found][0], close: bars[found][4] };
};

const stocks = new Map();
for (const f of readdirSync(MARKET_DIR).filter(f => f.endsWith(".json"))) {
  const stock = JSON.parse(readFileSync(join(MARKET_DIR, f), "utf-8"));
  let bars = [];
  try { bars = JSON.parse(readFileSync(join(HISTORY_DIR, f), "utf-8")).bars ?? []; } catch {}
  if (stock?.symbol && bars.length) stocks.set(stock.symbol, { stock, bars });
}

// Splits and bonuses between two days: an older price divided by this is on
// the later day's share basis
const splitsOf = sym => now.splits?.[sym] ?? [];
const factorBetween = (sym, from, to) => splitsOf(sym).filter(s => s.exDate > from && s.exDate <= to).reduce((f, s) => f * s.ratio, 1);
const filedOf = row => row.filed ?? iso(Date.parse(`${row.fyEnd ?? row.qEnd}T00:00:00Z`) + 60 * DAY);

// A company as it was on `day`: filings published by then, holding filed by
// then (about three weeks after the quarter ends)
function stockAsOf(stock, day) {
  const years = (stock.years ?? []).filter(y => y.fyEnd && filedOf(y) <= day);
  if (!years.length) return null;
  const quarters = (stock.quarters ?? []).filter(q => q.qEnd && filedOf(q) <= day);
  const h = stock.holding ?? {};
  const known = (h.promoterHistory ?? []).filter(p => iso(Date.parse(`${p.asOfIso}T00:00:00Z`) + 21 * DAY) <= day);
  const holding = h.asOfIso && iso(Date.parse(`${h.asOfIso}T00:00:00Z`) + 21 * DAY) <= day
    ? h
    : known.length ? { asOfIso: known[0].asOfIso, promoterPct: known[0].pct, promoterHistory: known } : {};
  return { ...stock, years, quarters, holding };
}

// The snapshot's price-based parts as they were on `day`
function snapshotAsOf(day) {
  const prices = {}, tech = {}, returns = {}, range52w = {}, dividends = {};
  const yearAgo = addMonths(day, -12);
  const niftyNow = closeOn(indexBars, day)?.close;
  const niftyRet = months => { const then = closeOn(indexBars, addMonths(day, -months))?.close; return niftyNow && then ? (niftyNow / then - 1) * 100 : null; };
  const niftyBy = { m3: niftyRet(3), m6: niftyRet(6), y1: niftyRet(12) };
  for (const [sym, { bars }] of stocks) {
    const at = closeOn(bars, day);
    if (!at) continue;
    prices[sym] = at.close;
    const year = bars.slice(0, at.i + 1).filter(b => b[0] > yearAgo)
      .map(b => ({ date: b[0], close: b[4] / factorBetween(sym, b[0], day), volume: b[5] }));
    tech[sym] = technicals(year, niftyMap) ?? {};
    const closes = year.map(d => d.close);
    if (closes.length) range52w[sym] = { low: Math.min(...closes), high: Math.max(...closes) };
    const ret = {};
    for (const [key, months] of [["m3", 3], ["m6", 6], ["y1", 12]]) {
      const thenDay = addMonths(day, -months), then = closeOn(bars, thenDay);
      if (!then || then.date < bars[0][0]) continue;
      const r = (at.close / (then.close / factorBetween(sym, then.date, day)) - 1) * 100;
      ret[key] = r;
      if (niftyBy[key] != null) ret[`${key}VsNifty`] = Math.round((r - niftyBy[key]) * 100) / 100;
    }
    returns[sym] = ret;
    dividends[sym] = (now.dividendHistory?.[sym] ?? []).filter(d => d.exDate > yearAgo && d.exDate <= day);
  }
  const splits = Object.fromEntries(Object.entries(now.splits ?? {}).map(([s, list]) => [s, list.filter(x => x.exDate <= day)]));
  const fyEndPrices = Object.fromEntries(Object.entries(now.fyEndPrices ?? {}).filter(([d]) => d <= day));
  return {
    ...now, pricesDate: day, prices, tech, returns, range52w, dividends, dividendHistory: dividends, splits, fyEndPrices,
    momentum: {}, events: {}, resultsDates: {}, auditorResignations: {},
  };
}

// Price change from `day` to `months` later, on one share basis
function forward(sym, day, months) {
  const { bars } = stocks.get(sym);
  const end = addMonths(day, months);
  if (end > lastDay) return null;
  const a = closeOn(bars, day), b = closeOn(bars, end);
  // not traded at the end (suspended, delisted then relisted): left out
  if (!a || !b) return null;
  return (b.close * factorBetween(sym, a.date, b.date) / a.close - 1) * 100;
}
const indexForward = (day, months) => {
  const end = addMonths(day, months);
  if (end > lastDay) return null;
  const a = closeOn(indexBars, day), b = closeOn(indexBars, end);
  return a && b ? (b.close / a.close - 1) * 100 : null;
};

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
function groupStats(rows, key, bench) {
  const rets = rows.map(r => r[key]).filter(v => v != null);
  return {
    n: rets.length,
    avg: r1(mean(rets)),
    median: r1(median(rets)),
    beatPct: bench == null || !rets.length ? null : Math.round((rets.filter(v => v > bench).length / rets.length) * 100),
  };
}

const LARGE_N = 100;
// [name, valuation's share of the blend, price-swing trim at the full overlay]
const MIXES = [
  ["today (value 30%, trim 35%)", 0.3, 0.35],
  ["value 15%, trim 35%", 0.15, 0.35],
  ["value 15%, trim 50%", 0.15, 0.5],
  ["value 30%, trim 50%", 0.3, 0.5],
  ["value 10%, trim 60%", 0.1, 0.6],
];
const rankOf = vals => { const idx = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const r = new Array(vals.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
function spearman(rows, x, y) {
  const both = rows.filter(r => r[x] != null && r[y] != null);
  if (both.length < 30) return null;
  const a = rankOf(both.map(r => r[x])), b = rankOf(both.map(r => r[y]));
  const ma = mean(a), mb = mean(b);
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < a.length; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return Math.round((cov / Math.sqrt(va * vb)) * 100) / 100;
}

const cohorts = [];
for (const day of DATES) {
  const snap = snapshotAsOf(day);
  const rows = [];
  for (const [sym, { stock }] of stocks) {
    const past = stockAsOf(stock, day);
    if (!past || snap.prices[sym] == null) continue;
    const m = computeMetrics(past, snap, {}, { research: false });
    if (m) rows.push(m);
  }
  const fresh = freshRows(rows);
  const peers = marketPeers(fresh);
  for (const m of fresh) m.research = computeResearch(m, { peers, now: Date.parse(`${day}T12:00:00Z`) });
  rankByOverall(fresh);
  const scored = fresh
    .filter(m => m.research?.overall?.score != null && m.marketCapCr >= MIN_CAP_CR)
    .map(m => ({
      symbol: m.symbol, score: m.research.overall.score, lender: !!m.lender, sector: m.sector ?? null,
      capCr: Math.round(m.marketCapCr), r6: forward(m.symbol, day, 6), r12: forward(m.symbol, day, 12),
      // the score's parts, to see which of them came before better returns
      quality: m.research.qualityOnly ?? null, value: m.research.valuation?.score ?? null, steadiness: m.research.risk?.overlay != null ? -m.research.risk.overlay : null,
      overlay: m.research.risk?.overlay ?? 0, status: m.research.overall.status,
    }))
    .sort((a, b) => b.score - a.score);
  const bench = { r6: indexForward(day, 6), r12: indexForward(day, 12) };
  const fifth = Math.ceil(scored.length / 5);
  const quintiles = [0, 1, 2, 3, 4].map(q => scored.slice(q * fifth, (q + 1) * fifth));
  const stat = rows => ({ r6: groupStats(rows, "r6", bench.r6), r12: groupStats(rows, "r12", bench.r12), scores: rows.length ? `${rows.at(-1).score}–${rows[0].score}` : null });
  const notLenders = scored.filter(r => !r.lender);
  const lenders = scored.filter(r => r.lender);
  // Other mixes of the same parts, to compare against today's (research.js:
  // value's share of the blend, and how hard price swings trim it); the same
  // caps (59 provisional, 39 on a red flag)
  const variantRows = Object.fromEntries(MIXES.map(([name, valueShare, trim]) => {
    const rows = scored.filter(r => r.quality != null && r.value != null).map(r => {
      let v = Math.exp((1 - valueShare) * Math.log(Math.max(r.quality, 1)) + valueShare * Math.log(Math.max(r.value, 1))) * (1 - trim * (r.overlay / 100));
      if (r.status === "provisional") v = Math.min(v, 59);
      if (r.status === "review-required") v = Math.min(v, 39);
      return { ...r, score: v };
    }).sort((a, b) => b.score - a.score);
    const fifthN = Math.ceil(rows.length / 5);
    const bigN = [...rows].sort((a, b) => b.capCr - a.capCr).slice(0, LARGE_N).sort((a, b) => b.score - a.score);
    return [name, {
      corr: { r6: spearman(rows, "score", "r6"), r12: spearman(rows, "score", "r12") },
      topFifth: stat(rows.slice(0, fifthN)), bottomFifth: stat(rows.slice(-fifthN)),
      top25: stat(rows.slice(0, TOP_N)), bigTop: stat(bigN.slice(0, LARGE_N / 2)), bigBottom: stat(bigN.slice(LARGE_N / 2)),
    }];
  }));
  // The 100 largest companies that day, split in half by score: like with
  // like against the Nifty 50, with no hindsight about who is in the index
  const big = [...scored].sort((a, b) => b.capCr - a.capCr).slice(0, LARGE_N).sort((a, b) => b.score - a.score);
  const half = Math.ceil(big.length / 2);
  // Each part's rank correlation with the later return (Spearman), all
  // companies: above 0, higher on that part came before higher returns
  const parts = Object.fromEntries(["score", "quality", "value", "steadiness"].map(k => [k, { r6: spearman(scored, k, "r6"), r12: spearman(scored, k, "r12") }]));
  cohorts.push({
    variants: variantRows,
    large: { top: stat(big.slice(0, half)), bottom: stat(big.slice(half)), all: stat(big) },
    parts,
    day, companies: scored.length, bench: { r6: r1(bench.r6), r12: r1(bench.r12) },
    all: stat(scored),
    quintiles: quintiles.map(stat),
    top: stat(scored.slice(0, TOP_N)),
    topNotLenders: stat(notLenders.slice(0, TOP_N)),
    topLenders: stat(lenders.slice(0, Math.min(TOP_N, Math.ceil(lenders.length / 5)))),
    lendersAll: stat(lenders),
    topNames: scored.slice(0, TOP_N).map(r => `${r.symbol} ${r.score}${r.lender ? " (lender)" : ""}`),
    lenderShareOfTop: Math.round((scored.slice(0, TOP_N).filter(r => r.lender).length / Math.min(TOP_N, scored.length)) * 100),
  });
  process.stderr.write(`${day}: ${scored.length} companies scored\n`);
}

const f = v => (v == null ? "  –  " : `${v > 0 ? "+" : ""}${v.toFixed(1)}`.padStart(6));
const f2 = v => (v == null ? "  –  " : `${v > 0 ? "+" : ""}${v.toFixed(2)}`.padStart(6));
for (const horizon of ["r12", "r6"]) {
  const label = horizon === "r12" ? "12 months" : "6 months";
  const used = cohorts.filter(c => c.bench[horizon] != null);
  console.log(`\n=== ${label} later: average price change, % (Nifty 50 beside it) ===`);
  console.log(`date         n   Nifty  | top fifth  2nd    3rd    4th   bottom | top ${TOP_N}  top ${TOP_N} not lenders`);
  for (const c of used) {
    console.log(`${c.day} ${String(c.companies).padStart(5)} ${f(c.bench[horizon])}  | ${c.quintiles.map(q => f(q[horizon].avg)).join(" ")} | ${f(c.top[horizon].avg)}   ${f(c.topNotLenders[horizon].avg)}`);
  }
  const avgOf = pick => r1(mean(used.map(pick).filter(v => v != null)));
  console.log(`average           ${f(avgOf(c => c.bench[horizon]))}  | ${[0, 1, 2, 3, 4].map(q => f(avgOf(c => c.quintiles[q][horizon].avg))).join(" ")} | ${f(avgOf(c => c.top[horizon].avg))}   ${f(avgOf(c => c.topNotLenders[horizon].avg))}`);
  console.log(`median company    ${" ".repeat(6)}  | ${[0, 1, 2, 3, 4].map(q => f(avgOf(c => c.quintiles[q][horizon].median))).join(" ")} | ${f(avgOf(c => c.top[horizon].median))}   ${f(avgOf(c => c.topNotLenders[horizon].median))}`);
  console.log(`% beat Nifty 50   ${" ".repeat(6)}  | ${[0, 1, 2, 3, 4].map(q => f(avgOf(c => c.quintiles[q][horizon].beatPct))).join(" ")} | ${f(avgOf(c => c.top[horizon].beatPct))}   ${f(avgOf(c => c.topNotLenders[horizon].beatPct))}`);
  const topWins = used.filter(c => c.quintiles[0][horizon].avg > c.quintiles[4][horizon].avg).length;
  console.log(`top fifth ahead of bottom fifth in ${topWins} of ${used.length} dates`);
  console.log(`lenders: all ${f(avgOf(c => c.lendersAll[horizon].avg))}, their top fifth ${f(avgOf(c => c.topLenders[horizon].avg))}; share of the top ${TOP_N} that are lenders ${avgOf(c => c.lenderShareOfTop)}%`);
}
for (const horizon of ["r12", "r6"]) {
  const label = horizon === "r12" ? "12 months" : "6 months";
  const used = cohorts.filter(c => c.bench[horizon] != null);
  const avgOf = pick => r1(mean(used.map(pick).filter(v => v != null)));
  console.log(`\n=== The ${LARGE_N} largest companies, ${label} later: higher-scoring half against lower ===`);
  console.log(`date        Nifty 50 | top half (median, % beat) | bottom half (median, % beat) | all ${LARGE_N}`);
  for (const c of used) console.log(`${c.day}  ${f(c.bench[horizon])}  | ${f(c.large.top[horizon].avg)} (${f(c.large.top[horizon].median)}, ${c.large.top[horizon].beatPct}%) | ${f(c.large.bottom[horizon].avg)} (${f(c.large.bottom[horizon].median)}, ${c.large.bottom[horizon].beatPct}%) | ${f(c.large.all[horizon].avg)}`);
  console.log(`average     ${f(avgOf(c => c.bench[horizon]))}  | ${f(avgOf(c => c.large.top[horizon].avg))} (${f(avgOf(c => c.large.top[horizon].median))}, ${avgOf(c => c.large.top[horizon].beatPct)}%) | ${f(avgOf(c => c.large.bottom[horizon].avg))} (${f(avgOf(c => c.large.bottom[horizon].median))}, ${avgOf(c => c.large.bottom[horizon].beatPct)}%) | ${f(avgOf(c => c.large.all[horizon].avg))}`);
  console.log(`top half ahead of bottom half in ${used.filter(c => c.large.top[horizon].avg > c.large.bottom[horizon].avg).length} of ${used.length}; ahead of the Nifty 50 in ${used.filter(c => c.large.top[horizon].avg > c.bench[horizon]).length} of ${used.length}`);
  console.log(`\n=== Which part came before better returns (${label}, rank correlation, all companies; 0 = none) ===`);
  console.log(`date        score  quality  value  steadiness`);
  for (const c of used) console.log(`${c.day}  ${["score", "quality", "value", "steadiness"].map(k => f2(c.parts[k][horizon])).join("  ")}`);
  console.log(`average     ${["score", "quality", "value", "steadiness"].map(k => f2(mean(used.map(c => c.parts[k][horizon]).filter(v => v != null)))).join("  ")}`);
  console.log(`above 0 on  ${["score", "quality", "value", "steadiness"].map(k => `${used.filter(c => c.parts[k][horizon] > 0).length}/${used.length}`.padStart(6)).join("  ")}`);
}
for (const horizon of ["r12", "r6"]) {
  const label = horizon === "r12" ? "12 months" : "6 months";
  const used = cohorts.filter(c => c.bench[horizon] != null);
  const avgOf = pick => mean(used.map(pick).filter(v => v != null));
  console.log(`\n=== Mixes compared, ${label} later (average over ${used.length} dates) ===`);
  console.log(`mix                          corr  (>0)  | top fifth − bottom (wins) | top 25 | top 25 − Nifty (wins) | 100 largest: top half − bottom (wins)`);
  for (const [name] of MIXES) {
    const v = c => c.variants[name];
    const gap = c => v(c).topFifth[horizon].avg - v(c).bottomFifth[horizon].avg;
    const big = c => v(c).bigTop[horizon].avg - v(c).bigBottom[horizon].avg;
    const vsN = c => v(c).top25[horizon].avg - c.bench[horizon];
    const wins = fn => used.filter(c => fn(c) > 0).length;
    console.log(`${name.padEnd(28)} ${f2(avgOf(c => v(c).corr[horizon]))} (${wins(c => v(c).corr[horizon])}/${used.length}) | ${f(avgOf(gap))} (${wins(gap)}/${used.length})            | ${f(avgOf(c => v(c).top25[horizon].avg))} | ${f(avgOf(vsN))} (${wins(vsN)}/${used.length})          | ${f(avgOf(big))} (${wins(big)}/${used.length})`);
  }
}
console.log(`\nCompanies worth ₹${MIN_CAP_CR} Cr+ on each date, equal weight. Price return only (no dividends). Only companies listed today are in the data, which flatters every group.`);

const out = process.argv.indexOf("--json");
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify({ madeAt: new Date().toISOString(), minCapCr: MIN_CAP_CR, topN: TOP_N, cohorts }, null, 2));
