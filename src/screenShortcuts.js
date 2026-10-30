// Quick ways through a screen's results (30 Oct 2026, ideas from Finviz's
// screener, in our words): signals narrow which companies show, column
// sets switch what the table shows about them. Both work on what the
// results already carry; nothing is fetched.

import { DEFAULT_COLUMNS } from "./screener/meta.js";

const IST = 330 * 60_000;
const istDay = now => new Date(now + IST).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Each signal: a short name and a test on a results row
export const SIGNALS = [
  { id: "results", label: "Results this week", test: (s, now) => !!s.nextResults && s.nextResults >= istDay(now) && s.nextResults <= addDays(istDay(now), 6) },
  { id: "nearHigh", label: "Near 52-week high", test: s => s.cmp > 0 && s.high52w > 0 && s.cmp >= s.high52w * 0.95 },
  { id: "nearLow", label: "Near 52-week low", test: s => s.cmp > 0 && s.low52w > 0 && s.cmp <= s.low52w * 1.05 },
];

export function applySignal(rows = [], id, now = Date.now()) {
  const signal = SIGNALS.find(s => s.id === id);
  return signal ? rows.filter(r => signal.test(r, now)) : rows;
}

export const signalCounts = (rows = [], now = Date.now()) => Object.fromEntries(SIGNALS.map(s => [s.id, rows.filter(r => s.test(r, now)).length]));

// Each set: the table's columns for one kind of question
export const COLUMN_SETS = [
  { id: "overview", label: "Overview", columns: DEFAULT_COLUMNS },
  { id: "value", label: "Value", columns: ["pe", "priceToBook", "evToEbitda", "divYield", "vsFairValue", "marketCapCr"] },
  { id: "quality", label: "Quality", columns: ["roce", "roe", "opm", "debtToEquity", "piotroski", "profitGrowth5y"] },
  { id: "owners", label: "Owners", columns: ["promoterPct", "pledgedPct", "fiiPct", "diiPct", "marketCapCr"] },
  { id: "returns", label: "Returns", columns: ["ret1w", "ret1m", "ret1y", "downFrom52wHigh", "upFrom52wLow"] },
];

// The set the table shows now, if it's exactly one of them
export const currentSet = columns => COLUMN_SETS.find(s => s.columns.join() === (columns ?? []).join())?.id ?? null;

// A line of figures about the list itself (the Stats idea): how many, the
// middle quality, P/E and ROCE, and how many trade below their fair value
const middle = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
export function listStats(rows = []) {
  const valued = rows.filter(r => r.fv25 > 0 && r.cmp > 0);
  return {
    count: rows.length,
    quality: middle(rows.map(r => r.research?.quality)),
    pe: middle(rows.map(r => r.peTtm ?? r.pe).filter(v => v > 0)),
    roce: middle(rows.map(r => r.roce)),
    belowFair: valued.filter(r => r.cmp < r.fv25).length,
    valued: valued.length,
  };
}
