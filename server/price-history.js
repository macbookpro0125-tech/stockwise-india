// Each company's daily prices, from NSE's own bhavcopies (24 Oct 2026: Yahoo
// Finance dropped — its terms don't allow an app to use its data). The
// evening build reads a year of bhavcopies anyway (market-data.js
// yearOfDays); each day's open, high, low, close and volume is kept here,
// one small file a company, and the files only grow: a bhavcopy older than
// the year adds to them once (scripts/backfill-history.mjs) and needn't stay
// on disk. Prices are kept as NSE published them and put on today's share
// basis when read, from the snapshot's splits, bonuses and rebases — so a
// split after a day was kept still reads right.
//
// The stock page's chart and its technicals read these (quote.js,
// technicals.js).

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_DIR } from "./paths.js";

// (as screen.js's; not imported, as market-data.js imports this file)
const isValidSymbol = s => typeof s === "string" && /^[A-Z0-9&-]{1,20}$/.test(s);

const fileOf = symbol => join(HISTORY_DIR, `${symbol.replace(/&/g, "%26")}.json`);

// A company's kept days, oldest first: [date, open, high, low, close, volume]
export function readHistory(symbol) {
  if (!isValidSymbol(symbol)) return [];
  try { return JSON.parse(readFileSync(fileOf(symbol), "utf-8")).bars ?? []; } catch { return []; }
}

// Days from bhavcopies, gathered then written once per company: add(date,
// days) for each bhavcopy read (parseBhavcopy's days: symbol → { open, high,
// low, close, volume }), then save()
export function historyWriter() {
  const fresh = new Map(); // symbol -> Map(date -> bar)
  return {
    add(date, days) {
      if (!date) return;
      for (const [sym, v] of days) {
        if (!(v.close > 0)) continue;
        let m = fresh.get(sym);
        if (!m) fresh.set(sym, (m = new Map()));
        const r2 = n => (Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null);
        const close = r2(v.close);
        m.set(date, [date, r2(v.open) ?? close, r2(v.high) ?? close, r2(v.low) ?? close, close, Number.isFinite(v.volume) ? v.volume : null]);
      }
    },
    // each company's file with these days merged in (a day already kept is replaced)
    save() {
      mkdirSync(HISTORY_DIR, { recursive: true });
      let written = 0;
      for (const [sym, m] of fresh) {
        if (!isValidSymbol(sym)) continue;
        const byDate = new Map(readHistory(sym).map(b => [b[0], b]));
        for (const [d, b] of m) byDate.set(d, b);
        const bars = [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
        const path = fileOf(sym);
        writeFileSync(`${path}.tmp`, JSON.stringify({ symbol: sym, bars }));
        renameSync(`${path}.tmp`, path);
        written++;
      }
      return written;
    },
    get size() { return fresh.size; },
  };
}

// On today's share basis: each day's prices divided, and its volume
// multiplied, by every split, bonus or rebase after it
export function adjustBars(bars, splits = []) {
  const events = (splits ?? []).filter(s => s?.exDate && s.ratio > 0).sort((a, b) => b.exDate.localeCompare(a.exDate));
  const r2 = n => Math.round(n * 100) / 100;
  return bars.map(([date, open, high, low, close, volume]) => {
    let f = 1;
    for (const s of events) { if (s.exDate > date) f *= s.ratio; else break; }
    return { date, open: r2(open / f), high: r2(high / f), low: r2(low / f), close: r2(close / f), volume: volume != null ? Math.round(volume * f) : null };
  });
}

// A company's daily bars, oldest first, on today's share basis (snapshot: the
// market snapshot, for its splits)
export function historyBars(symbol, snapshot) {
  return unitJumps(adjustBars(readHistory(symbol), snapshot?.splits?.[symbol] ?? []));
}

// A fund's unit change that NSE's corporate actions don't list (22 Nov 2026:
// GOLDBEES 1:100 and NIFTYBEES 1:10 on 19 Dec 2019 — the history reaching back
// to 2018 showed GOLDBEES at ₹3,359 the day before ₹33.55). A one-day move of
// about 10×, 100× or 1000× is a change of unit, never a price: the days before
// it are put on today's unit, as a split is.
const UNIT_RATIOS = [10, 100, 1000];
export function unitJumps(bars) {
  let f = 1;
  const out = new Array(bars.length);
  for (let i = bars.length - 1; i >= 0; i--) {
    const b = bars[i], next = bars[i + 1];
    if (next && b.close > 0 && next.close > 0) {
      const r = b.close / next.close;
      const ratio = r >= 5 ? UNIT_RATIOS.find(x => Math.abs(r / x - 1) < 0.25) : null;
      if (ratio) f *= ratio;
    }
    const r2 = n => (n == null ? n : Math.round((n / f) * 100) / 100);
    out[i] = f === 1 ? b : { ...b, open: r2(b.open), high: r2(b.high), low: r2(b.low), close: r2(b.close), volume: b.volume != null ? Math.round(b.volume * f) : null };
  }
  return out;
}

export const historyKept = symbol => existsSync(fileOf(symbol));
