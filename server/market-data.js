// Market-wide inputs that come in one download for everyone instead of one
// request per company: closing prices (NSE's daily bhavcopy), corporate
// actions (dividends, bonuses, splits) and sectors (NSE index constituents).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UA, NSE_BASE, fetchJson, parseQeDate } from "./fetch-nse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PRICE_DIR = join(DATA_DIR, "prices");
const SNAPSHOT_PATH = join(DATA_DIR, "market-snapshot.json");
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
  const best = new Map(); // symbol -> { close, rank }
  let tradingDate = null;
  for (const line of lines) {
    const f = line.split(",").map(c => c.trim());
    tradingDate ??= parseQeDate(f[iDate]);
    const rank = SERIES_PREFERENCE.indexOf(f[iSeries]);
    const close = Number(f[iClose]);
    if (rank === -1 || !(close > 0)) continue;
    const prev = best.get(f[iSym]);
    if (!prev || rank < prev.rank) best.set(f[iSym], { close, rank });
  }
  return { date: tradingDate ? isoDay(tradingDate) : null, prices: Object.fromEntries([...best].map(([s, v]) => [s, v.close])) };
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

  // Dividends keep their ex-dates: one paid before a later bonus or split is
  // per old share, and must be scaled down or the yield reads 2x too high.
  const yearAgo = isoDay(new Date(now.getTime() - 365 * 86400000));
  const dividends = {};
  const splits = {};
  for (const a of actions) {
    const ex = parseQeDate(a.exDate);
    if (!ex || !a.symbol) continue;
    const exIso = isoDay(ex);
    const dividend = dividendAmount(a.subject || "");
    if (dividend > 0 && exIso > yearAgo) (dividends[a.symbol] ||= []).push({ exDate: exIso, amount: dividend });
    const ratio = splitRatio(a.subject || "");
    if (ratio && ratio !== 1) (splits[a.symbol] ||= []).push({ exDate: exIso, ratio });
  }
  // The yearly windows can overlap at the edges — count each event once
  for (const map of [dividends, splits]) {
    for (const s of Object.keys(map)) {
      const seen = new Set();
      map[s] = map[s].filter(e => {
        const key = JSON.stringify(e);
        return !seen.has(key) && seen.add(key);
      });
    }
  }

  const fyEndPrices = {};
  for (const iso of [...new Set(fyEndDates)].sort()) {
    try {
      fyEndPrices[iso] = await pricesOnOrBefore(new Date(`${iso}T00:00:00Z`));
    } catch (e) {
      fyEndPrices[iso] = { error: e.message };
    }
  }

  const snapshot = {
    builtAt: now.toISOString(),
    pricesDate: latest.date,
    prices: latest.prices,
    dividends,
    splits,
    sectors: await sectorsBySymbol(),
    fyEndPrices,
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
