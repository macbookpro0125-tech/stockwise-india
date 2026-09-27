// Market-wide inputs that come in one download for everyone instead of one
// request per company: closing prices (NSE's daily bhavcopy), corporate
// actions (dividends, bonuses, splits) and sectors (NSE index constituents).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { UA, NSE_BASE, fetchJson, parseQeDate } from "./fetch-nse.js";
import { PRICE_DIR, SNAPSHOT_PATH } from "./paths.js";
const SERIES_PREFERENCE = ["EQ", "BE", "BZ", "SM", "ST"];
const SECTOR_LISTS = ["ind_niftytotalmarket_list", "ind_niftymicrocap250_list"];

mkdirSync(PRICE_DIR, { recursive: true });

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function ddmmyyyy(d, sep = "") {
  const [y, m, day] = isoDay(d).split("-");
  return [day, m, y].join(sep);
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// A finished trading day's bhavcopy never changes, so it's cached on disk.
// Returns null for non-trading days (NSE serves 404 for those).
async function bhavcopyCsv(date) {
  const path = join(PRICE_DIR, `bhav-${isoDay(date)}.csv`);
  if (existsSync(path)) return readFileSync(path, "utf-8");
  const csv = await fetchText(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${ddmmyyyy(date)}.csv`);
  if (csv && isoDay(date) < isoDay(new Date())) writeFileSync(path, csv);
  return csv;
}

// The trading date comes from the file's own DATE1 column, not the URL: NSE
// served 28-Mar-2025's prices when asked for 30-Mar-2025 (a Sunday).
function parseBhavcopy(csv) {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",").map(c => c.trim());
  const iSym = cols.indexOf("SYMBOL"), iSeries = cols.indexOf("SERIES"), iClose = cols.indexOf("CLOSE_PRICE"), iDate = cols.indexOf("DATE1");
  const iHigh = cols.indexOf("HIGH_PRICE"), iLow = cols.indexOf("LOW_PRICE");
  const best = new Map(); // symbol -> { close, high, low, rank }
  let tradingDate = null;
  for (const line of lines) {
    const f = line.split(",").map(c => c.trim());
    tradingDate ??= parseQeDate(f[iDate]);
    const rank = SERIES_PREFERENCE.indexOf(f[iSeries]);
    const close = Number(f[iClose]);
    if (rank === -1 || !(close > 0)) continue;
    const prev = best.get(f[iSym]);
    if (!prev || rank < prev.rank) best.set(f[iSym], { close, high: Number(f[iHigh]), low: Number(f[iLow]), rank });
  }
  return {
    date: tradingDate ? isoDay(tradingDate) : null,
    prices: Object.fromEntries([...best].map(([s, v]) => [s, v.close])),
    ranges: Object.fromEntries([...best].map(([s, v]) => [s, [v.low > 0 ? v.low : v.close, v.high > 0 ? v.high : v.close]])),
  };
}

// Closing prices on `date`, or the last trading day before it
export async function pricesOnOrBefore(date, maxDaysBack = 10) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  for (let i = 0; i <= maxDaysBack; i++) {
    const csv = await bhavcopyCsv(d);
    if (csv) {
      const parsed = parseBhavcopy(csv);
      return { date: parsed.date ?? isoDay(d), prices: parsed.prices };
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  throw new Error(`No NSE bhavcopy within ${maxDaysBack} days before ${isoDay(date)}`);
}

// ---- Corporate actions ----------------------------------------------------

async function corporateActions(from, to) {
  const rows = await fetchJson(
    `${NSE_BASE}/api/corporates-corporateActions?index=equities&from_date=${ddmmyyyy(from, "-")}&to_date=${ddmmyyyy(to, "-")}`
  );
  return Array.isArray(rows) ? rows : [];
}

// "Dividend - Rs 5 Per Share", "Final Dividend - Rs 8 Per Share / Special
// Dividend - Rs 3 Per Share" (both count), "Interim Dividend - Re 0.50 Per Share"
export function dividendAmount(subject) {
  if (!/dividend/i.test(subject)) return 0;
  return [...subject.matchAll(/(?:Rs|Re)\.?\s*(\d+(?:\.\d+)?)/gi)].reduce((sum, m) => sum + Number(m[1]), 0);
}

// Share-count multiplier: "Bonus 1:1" doubles the shares (x2), "Bonus 1:2" is
// one new share per two held (x1.5); "Face Value Split ... From Rs 10/- ...
// To Rs 2/-" is x5.
export function splitRatio(subject) {
  const bonus = subject.match(/Bonus\s+(\d+)\s*:\s*(\d+)/i);
  if (bonus) return (Number(bonus[1]) + Number(bonus[2])) / Number(bonus[2]);
  const split = subject.match(/From\s+(?:Rs|Re)\.?\s*([\d.]+).*?To\s+(?:Rs|Re)\.?\s*([\d.]+)/i);
  if (/split|sub-division/i.test(subject) && split) return Number(split[1]) / Number(split[2]);
  return null;
}

// 52-week low and high from every trading day's bhavcopy in the year to
// `toIso`, on today's share basis: a day before a split or bonus is divided by
// every ratio since, or a 1:1 bonus would leave a pre-bonus high twice today's
// price. Weekends are skipped — NSE's rare weekend sessions (Muhurat, budget
// day) don't move a year's range. The first build downloads ~250 files
// (a few minutes); after that only new days are fetched.
async function yearRanges(toIso, splits) {
  const factorAfter = (sym, iso) => (splits[sym] ?? []).filter(s => s.exDate > iso).reduce((f, s) => f * s.ratio, 1);
  const to = new Date(`${toIso}T00:00:00Z`);
  const fromIso = isoDay(new Date(to.getTime() - 365 * 86400000));
  const ranges = {};
  const seen = new Set();
  let failed = 0;
  for (let d = new Date(to); isoDay(d) > fromIso; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const cached = existsSync(join(PRICE_DIR, `bhav-${isoDay(d)}.csv`));
    let csv;
    try {
      csv = await bhavcopyCsv(d);
    } catch (e) {
      // A day or two missing barely moves a year's range; many missing means
      // NSE is refusing us, and a range from part of the year would mislead.
      if (++failed > 10) throw new Error(`52-week range: too many bhavcopy downloads failed (last: ${e.message})`);
      continue;
    }
    if (!cached) await new Promise(r => setTimeout(r, 300)); // gentle on NSE's archive
    if (!csv) continue;
    const day = parseBhavcopy(csv);
    // A holiday can be answered with the previous day's file — count each day once
    if (!day.date || seen.has(day.date) || day.date <= fromIso) continue;
    seen.add(day.date);
    for (const [sym, [low, high]] of Object.entries(day.ranges)) {
      const f = factorAfter(sym, day.date);
      const r = (ranges[sym] ||= { low: Infinity, high: 0 });
      r.low = Math.min(r.low, low / f);
      r.high = Math.max(r.high, high / f);
    }
  }
  for (const r of Object.values(ranges)) {
    r.low = Math.round(r.low * 100) / 100;
    r.high = Math.round(r.high * 100) / 100;
  }
  return { from: fromIso, tradingDays: seen.size, ranges };
}

async function sectorsBySymbol() {
  const out = {};
  for (const list of SECTOR_LISTS) {
    const csv = await fetchText(`https://www.niftyindices.com/IndexConstituent/${list}.csv`).catch(() => null);
    if (!csv) continue;
    const [header, ...lines] = csv.trim().split("\n");
    const cols = header.split(",").map(c => c.trim());
    const iSym = cols.indexOf("Symbol"), iInd = cols.indexOf("Industry");
    for (const line of lines) {
      const f = line.split(",").map(c => c.trim());
      if (f[iSym] && f[iInd]) out[f[iSym]] = f[iInd];
    }
  }
  return out;
}

// Everything the screener needs that isn't per-company: latest closes,
// trailing-12-month dividends, splits/bonuses since the oldest fiscal year it
// uses, sectors, and closes at each fiscal year-end (for historical P/E).
export async function buildMarketSnapshot(fyEndDates, { yearsOfActions = 6 } = {}) {
  const now = new Date();
  const latest = await pricesOnOrBefore(now);

  // Corporate actions come a year at a time — the feed is large
  const actions = [];
  for (let y = 0; y < yearsOfActions; y++) {
    const to = new Date(now.getTime() - y * 365 * 86400000);
    const from = new Date(to.getTime() - 365 * 86400000 + 86400000);
    actions.push(...await corporateActions(from, to));
  }

  // The yearly windows can overlap at the edges, so count each NSE record
  // once — by the record itself, not by its effect: Bharat Rasayan's 1:1 bonus
  // and Rs 10 -> 5 split share an ex-date and a 2x ratio, and de-duplicating
  // on (date, ratio) merged them into one 2x event when the shares went 4x.
  const seen = new Set();
  const unique = actions.filter(a => {
    const key = `${a.symbol}|${a.exDate}|${a.subject}`;
    return !seen.has(key) && seen.add(key);
  });

  // Dividends keep their ex-dates: one paid before a later bonus or split is
  // per old share, and must be scaled down or the yield reads 2x too high.
  const yearAgo = isoDay(new Date(now.getTime() - 365 * 86400000));
  const dividends = {};
  const splits = {};
  for (const a of unique) {
    const ex = parseQeDate(a.exDate);
    if (!ex || !a.symbol) continue;
    const exIso = isoDay(ex);
    const dividend = dividendAmount(a.subject || "");
    if (dividend > 0 && exIso > yearAgo) (dividends[a.symbol] ||= []).push({ exDate: exIso, amount: dividend });
    const ratio = splitRatio(a.subject || "");
    if (ratio && ratio !== 1) (splits[a.symbol] ||= []).push({ exDate: exIso, ratio });
  }

  const fyEndPrices = {};
  for (const iso of [...new Set(fyEndDates)].sort()) {
    try {
      fyEndPrices[iso] = await pricesOnOrBefore(new Date(`${iso}T00:00:00Z`));
    } catch (e) {
      fyEndPrices[iso] = { error: e.message };
    }
  }

  const year = await yearRanges(latest.date, splits);

  const snapshot = {
    builtAt: now.toISOString(),
    pricesDate: latest.date,
    prices: latest.prices,
    dividends,
    splits,
    sectors: await sectorsBySymbol(),
    fyEndPrices,
    range52w: year.ranges,
    range52wFrom: year.from,
    range52wTradingDays: year.tradingDays,
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
  return snapshot;
}

let cached = null;
export function loadMarketSnapshot() {
  if (cached) return cached;
  if (!existsSync(SNAPSHOT_PATH)) return null;
  cached = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
  return cached;
}

export function clearSnapshotCache() {
  cached = null;
}
