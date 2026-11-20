// How each chart pattern has done in the past (20 Nov 2026, backtesting part
// 2): every week over the last three years, which companies showed each
// pattern on that week's last close (price-setups.js setupsOf, on the prices
// up to that day only), and how their price went over the next one and three
// months — bought at the next day's open — against the Nifty 50 (NIFTYBEES)
// over the same days. Companies trading ₹1 crore a day or more then, as the
// scans list. Worked out by the evening data job (scripts/refresh-data.mjs)
// into data/pattern-record.json, which travels in the data pack.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupsOf, SETUPS, MIN_BARS } from "./price-setups.js";
import { weightedReturn } from "./price-strength.js";
import { DATA_DIR } from "./paths.js";

export const RECORD_PATH = join(DATA_DIR, "pattern-record.json");
export const HORIZONS = [["1M", 21], ["3M", 63]];
const WINDOW = 300; // the bars a pattern needs: a 200-day average a month old, a year's high

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// Each company's 3-, 6-, 9- and 12-month returns to day `date`, ranked 1–99
// across the companies (price-strength.js's weighting) — the strength the
// trend template needs, as it stood then
function strengthOn(series, date) {
  const scored = [];
  for (const [sym, s] of series) {
    const i = s.index.get(date);
    if (i == null || i < 252) continue;
    const c = s.bars[i].close, ago = d => s.bars[i - d]?.close;
    const r = weightedReturn({ m3: (c / ago(63) - 1) * 100, m6: (c / ago(126) - 1) * 100, m9: (c / ago(189) - 1) * 100, y1: (c / ago(252) - 1) * 100 });
    if (r != null && Number.isFinite(r)) scored.push([sym, r]);
  }
  scored.sort((a, b) => a[1] - b[1]);
  const n = scored.length, out = new Map();
  scored.forEach(([sym], k) => out.set(sym, n === 1 ? 50 : Math.min(99, Math.max(1, Math.floor((k / (n - 1)) * 98) + 1))));
  return out;
}

// barsOf(symbol) → daily bars, oldest first ({ date, open, close, volume }).
// Returns { asOf, from, weeks, patterns: { id: { count, companies, h: { 1M: {...}, 3M: {...} } } } }
export function patternRecord(symbols, barsOf, { years = 3, benchmark = "NIFTYBEES", log = () => {} } = {}) {
  const series = new Map();
  for (const sym of symbols) {
    let bars;
    try { bars = barsOf(sym); } catch { bars = null; }
    if (!bars || bars.length < MIN_BARS + 63) continue;
    series.set(sym, { bars, index: new Map(bars.map((b, i) => [b.date, i])) });
  }
  const bench = (() => { const b = barsOf(benchmark); return b?.length ? { bars: b, index: new Map(b.map((x, i) => [x.date, i])) } : null; })();
  if (!bench) return null;
  // the last trading day of each week, over the years asked, early enough to have three months after it
  const days = bench.bars.map(b => b.date);
  const last = days.at(-1);
  const start = new Date(`${last}T00:00:00Z`); start.setUTCFullYear(start.getUTCFullYear() - years);
  const weeks = [];
  for (let i = 0; i < days.length - 1 - 63; i++) {
    if (days[i] < start.toISOString().slice(0, 10)) continue;
    const d = new Date(`${days[i]}T00:00:00Z`), next = new Date(`${days[i + 1]}T00:00:00Z`);
    const wk = x => Math.floor((x.getTime() / 864e5 + 3) / 7); // Monday-based week number
    if (wk(d) !== wk(next)) weeks.push(days[i]);
  }
  const found = Object.fromEntries(SETUPS.map(p => [p.id, { companies: new Set(), h: Object.fromEntries(HORIZONS.map(([k]) => [k, { ret: [], excess: [] }])) }]));
  const benchRet = (date, h) => {
    const i = bench.index.get(date);
    if (i == null || i + h >= bench.bars.length) return null;
    const buy = bench.bars[i + 1].open > 0 ? bench.bars[i + 1].open : bench.bars[i + 1].close;
    return (bench.bars[i + h].close / buy - 1) * 100;
  };
  let w = 0;
  for (const date of weeks) {
    if (++w % 20 === 0) log(`pattern record: week ${w} of ${weeks.length}`);
    const strength = strengthOn(series, date);
    for (const [sym, s] of series) {
      const i = s.index.get(date);
      if (i == null || i < MIN_BARS || i + 63 >= s.bars.length) continue;
      const part = s.bars.slice(Math.max(0, i + 1 - WINDOW), i + 1);
      const read = setupsOf(part, { strength: strength.get(sym) ?? null });
      if (!read || read.valueCr < 1 || !read.setups.length) continue;
      const nb = s.bars[i + 1], buy = nb.open > 0 ? nb.open : nb.close;
      for (const id of read.setups) {
        const f = found[id];
        if (!f) continue;
        f.companies.add(sym);
        for (const [k, h] of HORIZONS) {
          const r = (s.bars[i + h].close / buy - 1) * 100, b = benchRet(date, h);
          if (!Number.isFinite(r)) continue;
          f.h[k].ret.push(r);
          if (b != null) f.h[k].excess.push(r - b);
        }
      }
    }
  }
  const patterns = {};
  for (const p of SETUPS) {
    const f = found[p.id];
    const h = Object.fromEntries(HORIZONS.map(([k]) => {
      const { ret, excess } = f.h[k];
      return [k, ret.length ? {
        avg: mean(ret), median: median(ret), rose: (ret.filter(r => r > 0).length / ret.length) * 100,
        beatNifty: excess.length ? (excess.filter(x => x > 0).length / excess.length) * 100 : null, vsNifty: mean(excess),
      } : null];
    }));
    patterns[p.id] = { count: f.h["1M"].ret.length, companies: f.companies.size, h };
  }
  return { asOf: last, from: weeks[0] ?? null, to: weeks.at(-1) ?? null, weeks: weeks.length, benchmark, patterns, builtAt: new Date().toISOString() };
}

export function savePatternRecord(record) { writeFileSync(RECORD_PATH, JSON.stringify(record)); }
export function loadPatternRecord() { try { return existsSync(RECORD_PATH) ? JSON.parse(readFileSync(RECORD_PATH, "utf-8")) : null; } catch { return null; } }
