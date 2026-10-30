// Market-wide inputs that come in one download for everyone instead of one
// request per company: closing prices (NSE's daily bhavcopy), corporate
// actions (dividends, bonuses, splits) and sectors (NSE index constituents).
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { UA, NSE_BASE, fetchJson, parseQeDate, nseSession } from "./fetch-nse.js";
import { rebaseTracker, suspendedAfter } from "./share-changes.js";
import { PRICE_DIR, SNAPSHOT_PATH, HISTORY_DIR } from "./paths.js";
import { historyWriter } from "./price-history.js";
import { fetchText as requestText, fetchJson as requestJson } from "./upstream.js";
import { fetchEquityList } from "./equity-list.js";
import { momentumStats } from "./momentum.js";
import { SECTOR_INDEX } from "./sector-indices.js";
import { fileURLToPath } from "node:url";
const SERIES_PREFERENCE = ["EQ", "BE", "BZ", "SM", "ST"];
const SECTOR_LISTS = ["ind_niftytotalmarket_list", "ind_niftymicrocap250_list"];
// NSE's own lists of government companies — the "Government-owned" badge
// beside the shareholding filing's government stake (metrics.js), for those
// held through another government company (HPCL, through ONGC) or with LIC
const PSU_LISTS = ["ind_niftypselist", "ind_niftycpselist", "ind_niftypsubanklist"];

mkdirSync(PRICE_DIR, { recursive: true });

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function ddmmyyyy(d, sep = "") {
  const [y, m, day] = isoDay(d).split("-");
  return [day, m, y].join(sep);
}

async function fetchText(url) {
  return requestText(url, { headers: { "User-Agent": UA }, service: "NSE market archive", maxBytes: 25 * 1024 * 1024, timeoutMs: 20_000, notFoundAsNull: true });
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
export function parseBhavcopy(csv) {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",").map(c => c.trim());
  const iSym = cols.indexOf("SYMBOL"), iSeries = cols.indexOf("SERIES"), iClose = cols.indexOf("CLOSE_PRICE"), iDate = cols.indexOf("DATE1");
  const iHigh = cols.indexOf("HIGH_PRICE"), iLow = cols.indexOf("LOW_PRICE"), iOpen = cols.indexOf("OPEN_PRICE");
  const iQty = cols.indexOf("TTL_TRD_QNTY"), iDeliv = cols.indexOf("DELIV_PER"), iPrev = cols.indexOf("PREV_CLOSE");
  const best = new Map(); // symbol -> { close, high, low, volume, delivery, rank }
  let tradingDate = null;
  for (const line of lines) {
    const f = line.split(",").map(c => c.trim());
    tradingDate ??= parseQeDate(f[iDate]);
    const rank = SERIES_PREFERENCE.indexOf(f[iSeries]);
    const close = Number(f[iClose]);
    if (rank === -1 || !(close > 0)) continue;
    const prev = best.get(f[iSym]);
    if (!prev || rank < prev.rank) {
      const delivery = iDeliv === -1 ? NaN : Number(f[iDeliv]); // "-" when there's no delivery data
      // prevClose and series: NSE's rebase after a share change (share-changes.js)
      best.set(f[iSym], { close, open: iOpen === -1 ? null : Number(f[iOpen]), high: Number(f[iHigh]), low: Number(f[iLow]), volume: iQty === -1 ? null : Number(f[iQty]), delivery: Number.isFinite(delivery) ? delivery : null, rank, prevClose: iPrev === -1 ? null : Number(f[iPrev]), series: f[iSeries] });
    }
  }
  return {
    date: tradingDate ? isoDay(tradingDate) : null,
    prices: Object.fromEntries([...best].map(([s, v]) => [s, v.close])),
    ranges: Object.fromEntries([...best].map(([s, v]) => [s, [v.low > 0 ? v.low : v.close, v.high > 0 ? v.high : v.close]])),
    days: best,
  };
}

// The price history (price-history.js) from the bhavcopies already on disk,
// with no downloads: on the first start after it was added, before the
// evening build has kept anything, so the charts aren't empty until then
export async function seedHistoryFromCache({ log = console.log } = {}) {
  if (existsSync(HISTORY_DIR) && readdirSync(HISTORY_DIR).some(f => f.endsWith(".json"))) return 0;
  const files = existsSync(PRICE_DIR) ? readdirSync(PRICE_DIR).filter(f => /^bhav-\d{4}-\d{2}-\d{2}\.csv$/.test(f)) : [];
  if (!files.length) return 0;
  const history = historyWriter();
  for (const f of files) {
    const day = parseBhavcopy(readFileSync(join(PRICE_DIR, f), "utf-8"));
    if (day.date) history.add(day.date, day.days);
    await new Promise(r => setImmediate(r)); // a file at a time, so requests aren't held up
  }
  const n = history.save();
  log(JSON.stringify({ event: "price_history_seeded", files: files.length, companies: n }));
  return n;
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

// The same, split into the ordinary and the special part: "Dividend - Rs 5
// Per Share/Special Dividend - Re 0.50 Per Share" is 5 ordinary, 0.5 special;
// the parts are joined by "/", "&", "And" or nothing at all ("…Rs 10 Per
// Share Special Dividend - Rs 66…", TCS, Jan 2025). The company page's
// dividend record keeps specials apart.
export function dividendParts(subject) {
  const parts = { regular: 0, special: 0 };
  if (!/dividend/i.test(subject)) return parts;
  for (const piece of String(subject).split(/\/|&|\band\b|(?=special\s+dividend)/i)) parts[/special/i.test(piece) ? "special" : "regular"] += dividendAmount(piece.includes("ividend") ? piece : `Dividend ${piece}`);
  return parts;
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

// One pass over every trading day's bhavcopy in the year to `toIso`, on
// today's share basis (a day before a split or bonus is divided by every
// ratio since — or a 1:1 bonus would leave a pre-bonus high twice today's
// price — and its volume multiplied by it). It gives the 52-week low and
// high, and each stock's daily closes, volumes and delivery % for the
// technical figures (technicals()), with NIFTY 50's closes for beta.
// Weekends are skipped — NSE's rare weekend sessions (Muhurat, budget day)
// don't move a year's figures. The first build downloads ~250 bhavcopies and
// ~250 index files (a few minutes); after that only new days are fetched.
async function yearOfDays(toIso, splits) {
  // The feed's splits and bonuses, and the share changes NSE's own previous
  // closes show that the feed missed (share-changes.js), found as the walk
  // goes back: a rebase is seen on the older session, before it's adjusted
  const rebases = rebaseTracker(splits);
  // each day's prices kept for the chart and technicals (price-history.js)
  const history = historyWriter();
  const factorAfter = (sym, iso) => [...(splits[sym] ?? []), ...(rebases.found[sym] ?? [])].filter(s => s.exDate > iso).reduce((f, s) => f * s.ratio, 1);
  const to = new Date(`${toIso}T00:00:00Z`);
  const fromIso = isoDay(new Date(to.getTime() - 365 * 86400000));
  const ranges = {};
  const series = new Map(); // symbol -> [{ date, close, volume, delivery }], newest first
  const nifty = new Map(); // date -> NIFTY 50 close
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
    history.add(day.date, day.days);
    const niftyClose = (await indexFile(day.date))?.get("Nifty 50")?.close;
    if (niftyClose > 0) nifty.set(day.date, niftyClose);
    rebases.see(day.date, day.days);
    for (const [sym, v] of day.days) {
      const f = factorAfter(sym, day.date);
      const [low, high] = day.ranges[sym];
      const r = (ranges[sym] ||= { low: Infinity, high: 0 });
      r.low = Math.min(r.low, low / f);
      r.high = Math.max(r.high, high / f);
      let list = series.get(sym);
      if (!list) series.set(sym, (list = []));
      list.push({ date: day.date, close: v.close / f, high: high / f, volume: v.volume != null ? v.volume * f : null, delivery: v.delivery });
    }
  }
  for (const r of Object.values(ranges)) {
    r.low = Math.round(r.low * 100) / 100;
    r.high = Math.round(r.high * 100) / 100;
  }
  const tech = {}, momentum = {};
  for (const [sym, list] of series) {
    const days = list.reverse();
    const t = technicals(days, nifty);
    if (t) tech[sym] = t;
    momentum[sym] = momentumStats(days);
  }
  try { history.save(); } catch (e) { console.error(JSON.stringify({ event: "price_history_save_failed", message: e.message })); }
  return { from: fromIso, tradingDays: seen.size, ranges, tech, momentum, rebases: rebases.found };
}

// A stock's technical and volume figures from a year of daily closes
// (oldest first): average volumes and their change, average delivery %,
// RSI (Wilder, 14 days), price vs its 20-day EMA and 50- and 200-day SMAs,
// yearly volatility, the year's worst fall from a high, and beta against
// NIFTY 50. Each is left out when there aren't enough days for it.
function technicals(days, nifty) {
  const n = days.length;
  if (n < 2) return null;
  const r2 = v => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const closes = days.map(d => d.close);
  const last = closes[n - 1];
  const vols = days.map(d => d.volume).filter(v => v != null);
  const lastN = (a, k) => (a.length >= k ? a.slice(-k) : null);
  const out = {};

  out.volume1d = vols.length ? vols.at(-1) : null;
  out.avgVolume1m = lastN(vols, 21) && Math.round(mean(lastN(vols, 21)));
  out.avgVolume3m = lastN(vols, 63) && Math.round(mean(lastN(vols, 63)));
  if (vols.length >= 2 && vols.at(-2) > 0) out.volumeChange1d = r2((vols.at(-1) / vols.at(-2) - 1) * 100);
  if (vols.length >= 10) {
    const thisWeek = mean(vols.slice(-5)), lastWeek = mean(vols.slice(-10, -5));
    if (lastWeek > 0) out.volumeChange1w = r2((thisWeek / lastWeek - 1) * 100);
  }
  const deliv = days.slice(-21).map(d => d.delivery).filter(v => v != null);
  if (deliv.length >= 10) out.delivery1m = r2(mean(deliv));

  if (n >= 15) {
    let gain = 0, loss = 0;
    for (let i = 1; i <= 14; i++) { const ch = closes[i] - closes[i - 1]; if (ch > 0) gain += ch; else loss -= ch; }
    gain /= 14; loss /= 14;
    for (let i = 15; i < n; i++) {
      const ch = closes[i] - closes[i - 1];
      gain = (gain * 13 + Math.max(ch, 0)) / 14;
      loss = (loss * 13 + Math.max(-ch, 0)) / 14;
    }
    out.rsi14 = r2(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }
  if (n >= 20) {
    const k = 2 / 21;
    let ema = mean(closes.slice(0, 20));
    for (let i = 20; i < n; i++) ema = closes[i] * k + ema * (1 - k);
    out.vsEma20 = r2((last / ema - 1) * 100);
  }
  if (n >= 50) out.vsSma50 = r2((last / mean(closes.slice(-50)) - 1) * 100);
  if (n >= 200) out.vsSma200 = r2((last / mean(closes.slice(-200)) - 1) * 100);

  const rets = [];
  for (let i = 1; i < n; i++) if (closes[i - 1] > 0 && closes[i] > 0) rets.push(Math.log(closes[i] / closes[i - 1]));
  if (rets.length >= 60) {
    const m = mean(rets);
    out.volatility1y = r2(Math.sqrt(rets.reduce((s, r) => s + (r - m) ** 2, 0) / (rets.length - 1)) * Math.sqrt(252) * 100);
  }
  if (n >= 60) {
    let peak = closes[0], worst = 0;
    for (const c of closes) { peak = Math.max(peak, c); worst = Math.max(worst, (peak - c) / peak); }
    out.maxLoss1y = r2(worst * 100);
  }
  // Beta: daily moves against NIFTY 50's on the same pairs of days
  const pairs = [];
  for (let i = 1; i < n; i++) {
    const n0 = nifty.get(days[i - 1].date), n1 = nifty.get(days[i].date);
    if (n0 > 0 && n1 > 0 && closes[i - 1] > 0) pairs.push([closes[i] / closes[i - 1] - 1, n1 / n0 - 1]);
  }
  if (pairs.length >= 60) {
    const ms = mean(pairs.map(p => p[0])), mn = mean(pairs.map(p => p[1]));
    const cov = pairs.reduce((s, [a, b]) => s + (a - ms) * (b - mn), 0);
    const varN = pairs.reduce((s, [, b]) => s + (b - mn) ** 2, 0);
    if (varN > 0) out.beta1y = r2(cov / varN);
  }
  for (const k of Object.keys(out)) if (out[k] == null) delete out[k];
  return out;
}

// Price change over the screener's return periods, on today's share basis
// like the 52-week range: a close from before a split or bonus is divided by
// the ratios since. 1D is against the previous trading day; the others
// against the last close on or before the same date a week, a month, three
// and six months, and one, three and five years back (calendar months —
// Other apps don't say which base they use; theirs differ from these by
// under a point). All the days come from cached bhavcopies.
const RETURN_PERIODS = [["d1", { days: 1 }], ["w1", { days: 7 }], ["m1", { months: 1 }], ["m3", { months: 3 }], ["m6", { months: 6 }], ["y1", { months: 12 }], ["y3", { months: 36 }], ["y5", { months: 60 }]];

// The market and each sector's index, over the same periods (sector-indices.js)
// The Explore page's indices (explore.js): the broad market, then sectors
export const BOARD = {
  market: ["Nifty 50", "Nifty Bank", "Nifty Next 50", "Nifty 500", "NIFTY Midcap 100", "NIFTY Smallcap 100", "Nifty Smallcap 250", "Nifty Microcap 250", "India VIX"],
  sectors: ["Nifty IT", "Nifty Auto", "Nifty FMCG", "Nifty Pharma", "Nifty Metal", "Nifty Realty", "Nifty Energy", "Nifty Financial Services", "Nifty PSU Bank", "Nifty Private Bank", "Nifty Oil & Gas", "Nifty Healthcare Index", "Nifty Consumer Durables", "Nifty Media", "Nifty Infrastructure", "Nifty India Defence", "Nifty Capital Markets", "Nifty Power", "Nifty Cement", "Nifty Chemicals"],
};
const BENCHMARKS = [...new Set(["Nifty 50", ...Object.values(SECTOR_INDEX), ...BOARD.market, ...BOARD.sectors])].filter(n => n !== "India VIX");

async function periodReturns(latest, splits) {
  const factorBetween = (sym, fromIso) => (splits[sym] ?? [])
    .filter(s => s.exDate > fromIso && s.exDate <= latest.date)
    .reduce((f, s) => f * s.ratio, 1);
  const out = {}, byIndex = {};
  // Every quarter-end of the last five years: who traded then. A company
  // missing from two running had no 3- or 5-year return (share-changes.js
  // suspendedAfter: a suspension, often a relisting on a new base)
  const checkpoints = [];
  const end = new Date(`${latest.date}T00:00:00Z`);
  for (let back = 60; back >= 0; back -= 3) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (end.getUTCMonth() % 3) - back, 0));
    if (isoDay(d) >= latest.date) continue;
    const day = await pricesOnOrBefore(d).catch(() => null); // a quarter-end that can't be read isn't held against anyone
    if (day) checkpoints.push({ date: day.date, present: new Set(Object.keys(day.prices)) });
  }
  const symbols = Object.keys(latest.prices);
  const brokenSince = fromIso => suspendedAfter(checkpoints, fromIso, symbols);
  for (const [key, { days = 0, months = 0 }] of RETURN_PERIODS) {
    const base = new Date(`${latest.date}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() - days);
    const dayOfMonth = base.getUTCDate();
    base.setUTCMonth(base.getUTCMonth() - months);
    if (base.getUTCDate() !== dayOfMonth) base.setUTCDate(0); // 31 Mar − 1 month = 28/29 Feb, not 3 Mar
    const past = await pricesOnOrBefore(base).catch(() => null);
    if (!past || past.date >= latest.date) continue;
    // NIFTY 50 over the same days, for "return vs NIFTY" (percentage points)
    const then0 = await indexFile(past.date), now0 = await indexFile(latest.date);
    const n0 = then0?.get("Nifty 50")?.close, n1 = now0?.get("Nifty 50")?.close;
    const niftyRet = n0 > 0 && n1 > 0 ? (n1 / n0 - 1) * 100 : null;
    // The benchmarks over the same two closes, for the stock page
    for (const name of BENCHMARKS) {
      const a = then0?.get(name)?.close, b = now0?.get(name)?.close;
      if (a > 0 && b > 0) (byIndex[name] ||= {})[key] = Math.round((b / a - 1) * 10000) / 100;
    }
    const broken = months >= 36 ? brokenSince(past.date) : null;
    for (const [sym, close] of Object.entries(latest.prices)) {
      const then = past.prices[sym];
      if (!(then > 0) || broken?.has(sym)) continue;
      const ret = (close / (then / factorBetween(sym, past.date)) - 1) * 100;
      const row = (out[sym] ||= {});
      row[key] = Math.round(ret * 100) / 100;
      if (key !== "d1" && niftyRet != null) row[`${key}VsNifty`] = Math.round((ret - niftyRet) * 100) / 100;
    }
  }
  // Price growth a year over five years (needs the corporate actions to go
  // back that far — the snapshot keeps six years of them)
  const base5 = new Date(`${latest.date}T00:00:00Z`);
  base5.setUTCFullYear(base5.getUTCFullYear() - 5);
  const past5 = await pricesOnOrBefore(base5).catch(() => null);
  if (past5) {
    const years = (new Date(`${latest.date}T00:00:00Z`) - new Date(`${past5.date}T00:00:00Z`)) / (365.25 * 86400000);
    const broken = brokenSince(past5.date);
    for (const [sym, close] of Object.entries(latest.prices)) {
      const then = past5.prices[sym];
      if (then > 0 && years > 4.5 && !broken.has(sym)) (out[sym] ||= {}).cagr5y = Math.round((Math.pow(close / (then / factorBetween(sym, past5.date)), 1 / years) - 1) * 10000) / 100;
    }
  }
  return { bySymbol: out, byIndex };
}

// The day's closes of the indices shown in the price strip, from NSE's daily
// index file (same archive as the bhavcopy; cached the same way)
const STRIP_INDICES = ["Nifty 50", "Nifty Bank", "Nifty Next 50", "NIFTY Midcap 100", "NIFTY Smallcap 100", "Nifty IT"];

// NSE's index closes for one day (all indices), cached like the bhavcopy;
// null for a day without a file (holidays)
const indexDays = new Map();
async function indexFile(isoDate) {
  if (indexDays.has(isoDate)) return indexDays.get(isoDate);
  const path = join(PRICE_DIR, `indices-${isoDate}.csv`);
  let csv = existsSync(path) ? readFileSync(path, "utf-8") : null;
  if (!csv) {
    csv = await fetchText(`https://nsearchives.nseindia.com/content/indices/ind_close_all_${ddmmyyyy(new Date(`${isoDate}T00:00:00Z`))}.csv`).catch(() => null);
    if (csv && isoDate < isoDay(new Date())) writeFileSync(path, csv);
    await new Promise(r => setTimeout(r, 300)); // gentle on NSE's archive
  }
  let byName = null;
  if (csv) {
    const [header, ...lines] = csv.trim().split("\n");
    const cols = header.split(",").map(c => c.trim());
    const at = name => cols.indexOf(name);
    byName = new Map();
    for (const f of lines.map(l => l.split(",").map(c => c.trim()))) {
      const close = Number(f[at("Closing Index Value")]);
      // NSE's own valuation of the index, where it gives one ("-" otherwise)
      const num = col => { const v = Number(f[at(col)]); return at(col) >= 0 && f[at(col)] !== "-" && isFinite(v) && v > 0 ? v : null; };
      if (close > 0) byName.set(f[at("Index Name")], { close, change: Number(f[at("Points Change")]), changePct: Number(f[at("Change(%)")]), pe: num("P/E"), pb: num("P/B"), divYield: num("Div Yield") });
    }
  }
  indexDays.set(isoDate, byName);
  return byName;
}

// The members of the indices the Explore page's heat map shows, from
// niftyindices.com's lists (as the sectors are); an index whose list can't be
// read is left out, not guessed
export const HEATMAP_LISTS = { "Nifty 50": "ind_nifty50list", "Nifty Bank": "ind_niftybanklist", "Nifty Next 50": "ind_niftynext50list", "NIFTY Midcap 100": "ind_niftymidcap100list", "NIFTY Smallcap 100": "ind_niftysmallcap100list" };
// niftyindices.com doesn't answer the GitHub data job (25 Oct 2026: the live
// snapshot had no members at all), so NSE's own index page stands in for it,
// and the last snapshot's members for both
export async function indexMembers() {
  const out = {};
  const before = loadMarketSnapshot()?.indexMembers ?? {};
  for (const [name, list] of Object.entries(HEATMAP_LISTS)) {
    let symbols = [];
    const csv = await fetchText(`https://www.niftyindices.com/IndexConstituent/${list}.csv`).catch(() => null);
    if (csv) {
      const [header, ...lines] = csv.trim().split("\n");
      const iSym = header.split(",").map(c => c.trim()).indexOf("Symbol");
      symbols = lines.map(l => l.split(",")[iSym]?.trim()).filter(Boolean);
    }
    if (symbols.length < 10) {
      const json = await fetchJson(`${NSE_BASE}/api/equity-stockIndices?index=${encodeURIComponent(name.toUpperCase())}`).catch(() => null);
      // the index's own row comes first, its members after (priority 0)
      symbols = (json?.data ?? []).filter(r => r?.symbol && r.symbol.toUpperCase() !== name.toUpperCase() && r.priority !== 1).map(r => r.symbol);
    }
    if (symbols.length >= 10) out[name] = symbols;
    else if (before[name]?.length >= 10) out[name] = before[name];
  }
  return out;
}

// The indices a screen can filter on (30 Oct 2026, the Finviz ideas), read
// as the heat map's are; an index whose list can't be read keeps the last
// snapshot's members, or is left out — never guessed
export const SCREEN_INDEX_LISTS = {
  "Nifty 50": ["ind_nifty50list", "NIFTY 50"], "Nifty Next 50": ["ind_niftynext50list", "NIFTY NEXT 50"],
  "Nifty Midcap 150": ["ind_niftymidcap150list", "NIFTY MIDCAP 150"], "Nifty Smallcap 250": ["ind_niftysmallcap250list", "NIFTY SMALLCAP 250"],
  "Nifty 500": ["ind_nifty500list", "NIFTY 500"], "Nifty Bank": ["ind_niftybanklist", "NIFTY BANK"],
};
// Themes: NSE's own thematic indices, so a company's theme is NSE's
// membership, never our guess (niftyindices.com; NSE's page has no copy)
export const THEME_LISTS = {
  "Defence": ["ind_niftyindiadefence_list", "NIFTY INDIA DEFENCE"], "Railways PSU": ["ind_niftyindiarailwayspsu_list", "NIFTY INDIA RAILWAYS PSU"],
  "EV and new-age auto": ["ind_niftyev_newageautomotive_list", "NIFTY EV & NEW AGE AUTOMOTIVE"], "PSU banks": ["ind_niftypsubanklist", "NIFTY PSU BANK"],
  "Energy": ["ind_niftyenergylist", "NIFTY ENERGY"], "Digital": ["ind_niftyindiadigital_list", "NIFTY INDIA DIGITAL"],
  "Capital markets": ["ind_niftycapitalmarkets_list", "NIFTY CAPITAL MARKETS"], "Housing": ["ind_niftyhousing_list", "NIFTY HOUSING"],
  "Manufacturing": ["ind_niftyindiamanufacturing_list", "NIFTY INDIA MANUFACTURING"], "Tourism": ["ind_niftyindiatourism_list", "NIFTY INDIA TOURISM"],
  "Healthcare": ["ind_niftyhealthcarelist", "NIFTY HEALTHCARE INDEX"],
};
export async function screenIndexMembers(lists = SCREEN_INDEX_LISTS, key = "screenIndices") {
  const out = {};
  const before = loadMarketSnapshot()?.[key] ?? {};
  for (const [name, [list, nseName]] of Object.entries(lists)) {
    let symbols = [];
    const csv = await fetchText(`https://www.niftyindices.com/IndexConstituent/${list}.csv`).catch(() => null);
    if (csv) {
      const [header, ...lines] = csv.trim().split("\n");
      const iSym = header.split(",").map(c => c.trim()).indexOf("Symbol");
      if (iSym >= 0) symbols = lines.map(l => l.split(",")[iSym]?.trim()).filter(Boolean);
    }
    if (symbols.length < 10) {
      const json = await fetchJson(`${NSE_BASE}/api/equity-stockIndices?index=${encodeURIComponent(nseName)}`).catch(() => null);
      symbols = (json?.data ?? []).filter(r => r?.symbol && r.symbol.toUpperCase() !== nseName && r.priority !== 1).map(r => r.symbol);
    }
    if (symbols.length >= 5) out[name] = symbols;
    else if (before[name]?.length >= 5) out[name] = before[name];
    else if (SEED[key]?.[name]?.length >= 5) out[name] = SEED[key][name];
  }
  return out;
}

// The lists as read on 30 Oct 2026, for when neither niftyindices.com nor NSE
// answers and no snapshot has them yet (the GitHub data job is refused by
// niftyindices.com). NSE reviews index members twice a year; refresh this
// file when a live read works (scripts: see index-lists-seed.json's savedOn)
const SEED = (() => { try { return JSON.parse(readFileSync(new URL("./index-lists-seed.json", import.meta.url), "utf8")); } catch { return {}; } })();

// The companies traded in futures and options, from NSE's list of F&O
// contract sizes; the last snapshot's list when NSE doesn't answer
export async function fnoSymbols() {
  const csv = await fetchText("https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv").catch(() => null);
  const symbols = csv ? csv.trim().split("\n").slice(1).map(l => l.split(",")[1]?.trim()).filter(s => s && /^[A-Z0-9&-]+$/.test(s) && !/^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|BANKEX)/.test(s)) : [];
  return symbols.length >= 50 ? symbols : loadMarketSnapshot()?.fno ?? SEED.fno ?? null;
}

// Each of them with its year of daily closes from NSE's daily index file (the
// year walk has already read every day's) and NSE's valuation on the last day
export async function indexBoard(fromIso, toIso) {
  const names = [...BOARD.market, ...BOARD.sectors];
  const days = [], closes = Object.fromEntries(names.map(n => [n, []]));
  for (let d = new Date(`${fromIso}T00:00:00Z`); isoDay(d) <= toIso; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const file = await indexFile(isoDay(d));
    if (!file?.get("Nifty 50")) continue;
    days.push(isoDay(d));
    for (const n of names) closes[n].push(file.get(n)?.close ?? null);
  }
  const last = days.length ? await indexFile(days[days.length - 1]) : null;
  return {
    days,
    indices: names.map(name => {
      const x = last?.get(name);
      return { name, group: BOARD.market.includes(name) ? "market" : "sector", close: x?.close ?? null, change: x?.change ?? null, changePct: x?.changePct ?? null, pe: x?.pe ?? null, pb: x?.pb ?? null, divYield: x?.divYield ?? null, closes: closes[name] };
    }).filter(i => i.close != null),
  };
}

async function indexCloses(isoDate) {
  const byName = await indexFile(isoDate);
  if (!byName) return [];
  return STRIP_INDICES.flatMap(name => {
    const x = byName.get(name);
    return x ? [{ name: name.replace(/^nifty/i, "NIFTY"), ...x }] : [];
  });
}

// Shared benchmark lookup for the prospective research-score study. The
// archive cache is also used, so an already saved close never needs a network
// request.
export async function indexCloseOn(isoDate, name) {
  if (!isoDate || !name) return null;
  return (await indexFile(isoDate))?.get(name)?.close ?? null;
}

// The index lists name a sector for ~750 companies — most of the top 500, a
// third overall. NSE's announcements carry an older "industry" (smIndustry)
// for ~935 companies, many of them small ones the lists skip. Where a company
// has no index sector, its industry stands in through the sector most of that
// industry's companies carry in the lists — learned from the companies that
// have both, at a 75% majority or better, so the two naming schemes needn't
// be mapped by hand ("Computers - Software" → Information Technology).
// "Construction" splits 11–6 between Realty and Construction and stays
// unmapped, as do "Trading" and "Steel". Kept apart from the index sectors
// (industrySectors) so metrics.js can tell them apart.
// When niftyindices.com doesn't answer — it refuses the GitHub data job (25
// Oct 2026: the live snapshot had no sectors, so Reliance read "Chemicals"
// from its O2C segment and TCS "Financial Services" from its BFSI clients) —
// the last snapshot's sectors stand, and failing those the list saved in
// sector-seed.json (21 Oct 2026). A company's sector hardly ever changes.
const SECTOR_SEED = fileURLToPath(new URL("./sector-seed.json", import.meta.url));
export function fallbackSectors(previous = loadMarketSnapshot()?.sectors) {
  if (previous && Object.keys(previous).length >= 100) return previous;
  try { return JSON.parse(readFileSync(SECTOR_SEED, "utf-8")).sectors ?? {}; } catch { return {}; }
}
async function sectorsBySymbol() {
  let fromIndex = {};
  for (const list of SECTOR_LISTS) {
    const csv = await fetchText(`https://www.niftyindices.com/IndexConstituent/${list}.csv`).catch(() => null);
    if (!csv) continue;
    const [header, ...lines] = csv.trim().split("\n");
    const cols = header.split(",").map(c => c.trim());
    const iSym = cols.indexOf("Symbol"), iInd = cols.indexOf("Industry");
    for (const line of lines) {
      const f = line.split(",").map(c => c.trim());
      if (f[iSym] && f[iInd]) fromIndex[f[iSym]] = f[iInd];
    }
  }
  if (Object.keys(fromIndex).length < 100) {
    fromIndex = fallbackSectors();
    console.error(`[sectors] niftyindices.com's lists didn't load; using ${Object.keys(fromIndex).length} saved sectors`);
  }
  // A company's industry hardly ever changes: the last snapshot's labels
  // stand for companies that announced nothing in the 90 days (JB Chemicals,
  // 11 Oct 2026) — and for all of them when NSE doesn't answer — rather than
  // the mapped sectors thinning out a few at a time
  const industries = { ...loadMarketSnapshot()?.industries, ...await industriesBySymbol().catch(() => ({})) };
  const sectorOf = votedSectors(industries, fromIndex);
  const industrySectors = {};
  for (const [sym, industry] of Object.entries(industries)) if (!fromIndex[sym] && sectorOf[industry]) industrySectors[sym] = sectorOf[industry];
  return { sectors: fromIndex, industrySectors, industries };
}

// An industry's sector, where most of its companies the index lists name
// agree on one (75% or more of at least `min`)
export function votedSectors(industries, fromIndex, min = 3) {
  const votes = {};
  for (const [sym, industry] of Object.entries(industries)) {
    const sector = fromIndex[sym];
    if (sector && industry) (votes[industry] ??= {})[sector] = (votes[industry][sector] ?? 0) + 1;
  }
  const sectorOf = {};
  for (const [industry, v] of Object.entries(votes)) {
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    const [best, n] = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
    if (total >= min && n / total >= 0.75) sectorOf[industry] = best;
  }
  return sectorOf;
}

// BSE's classification for the companies NSE's lists miss (30 Oct 2026):
// NSE's quote API refuses the GitHub data job (403 even with its cookies),
// and BSE's list of companies carries no industry (null for all 5,122). BSE
// does answer it, though, and BSE and NSE classify by the same scheme (macro
// sector, sector, industry, basic industry). So BSE's list gives each NSE
// company's BSE code (by ISIN, else the same symbol), and BSE's header for
// that code its sector — asked once per company and kept, like NSE's.
const BSE_LIST = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active";
const BSE_HEADER = code => `https://api.bseindia.com/BseIndiaAPI/api/ComHeadernew/w?quotetype=EQ&scripcode=${encodeURIComponent(code)}&seriesid=`;
const BSE_HEADERS = { "User-Agent": UA, Accept: "application/json, text/plain, */*", Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" };
// BSE's field names aren't documented and its casing varies, so each is
// found by name
const bseField = (row, ...patterns) => {
  if (!row || typeof row !== "object") return null;
  for (const re of patterns) {
    const key = Object.keys(row).find(k => re.test(k));
    const v = key == null ? null : row[key];
    if (typeof v === "string" && v.trim() && v.trim() !== "-") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
};
export function bseCodes(rows, equityList) {
  const byIsin = new Map(), bySymbol = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const code = bseField(r, /^scrip_?cd$/i, /^scrip_?code$/i);
    if (!code) continue;
    const isin = bseField(r, /^isin(_?number|_?no|_?code)?$/i, /isin/i);
    const symbol = bseField(r, /^scrip_?id$/i);
    if (isin) byIsin.set(isin.toUpperCase(), code);
    if (symbol) bySymbol.set(symbol.toUpperCase(), code);
  }
  const out = {};
  for (const e of equityList) {
    const code = byIsin.get(String(e.isin ?? "").trim().toUpperCase()) ?? bySymbol.get(e.symbol);
    if (code) out[e.symbol] = code;
  }
  return out;
}
// BSE's header for a company: its sector, where it's one NSE's lists use,
// with the basic industry beside it. BSE's "Sector" field is the macro sector
// (30 Oct 2026: 656 of 1,737 matched, all in the eight sectors that share
// their macro's name — "Commodities" or "Industrials" never match), so the
// finer fields are tried first, then any field naming a known sector.
const BSE_SECTOR_VERSION = 3;
// "Oil, Gas & Consumable Fuels" at BSE is "Oil Gas & Consumable Fuels" at NSE
const sectorKey = v => String(v).toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
export function bseClassification(json, known) {
  if (!json || typeof json !== "object") return null;
  const names = new Map([...known].map(k => [sectorKey(k), k]));
  const asKnown = v => (typeof v === "string" ? names.get(sectorKey(v)) ?? null : null);
  const fine = [/^industry_?new$/i, /^industry_?name$/i, /^industry$/i, /^igroup(_?name)?$/i, /^sector_?new$/i, /^sector(_?name)?$/i];
  let sector = null;
  for (const re of fine) {
    sector = asKnown(bseField(json, re));
    if (sector) break;
  }
  sector ??= Object.values(json).map(asKnown).find(Boolean) ?? null;
  if (!sector) return null;
  const basic = bseField(json, /^isub_?group(_?name)?$/i, /^basic_?industry$/i);
  return { sector, ...(basic && sectorKey(basic) !== sectorKey(sector) ? { basic } : {}) };
}
async function bseSectors(symbols, skip, { pauseMs = 250, max = Number(process.env.BSE_SECTOR_BATCH ?? 2500), getJson = url => requestJson(url, { headers: BSE_HEADERS, service: "BSE", maxBytes: 25 * 1024 * 1024, timeoutMs: 30_000 }), equityList = null } = {}) {
  // a company BSE gave nothing usable for is asked again when the reading
  // changes (BSE_SECTOR_VERSION)
  const before = loadMarketSnapshot();
  // (and one from the first reading, which kept the sector as its industry)
  const current = before?.bseSectorsVersion === BSE_SECTOR_VERSION;
  const out = Object.fromEntries(Object.entries(before?.bseSectors ?? {}).filter(([, v]) => current || (v && v.basic && v.basic !== v.sector)));
  const todo = symbols.filter(s => !skip[s] && !(s in out));
  if (!todo.length) return out;
  const codes = bseCodes(await getJson(BSE_LIST), equityList ?? await fetchEquityList());
  const known = new Set([...Object.values(fallbackSectors({})), ...Object.values(skip)]);
  let failed = 0, read = 0, found = 0, lastError = null, sample = null;
  for (const sym of todo.filter(s => codes[s]).slice(0, max)) {
    try {
      const json = await getJson(BSE_HEADER(codes[sym]));
      out[sym] = bseClassification(json, known); // null: asked, BSE gave none we use
      if (out[sym]) found++; else sample ??= { [sym]: json };
      failed = 0; read++;
    } catch (error) {
      lastError = error;
      if (++failed >= 5) break;
    }
    if (pauseMs) await new Promise(r => setTimeout(r, pauseMs));
  }
  console.error(`[sectors] BSE: ${Object.keys(codes).length} NSE companies have a BSE code; read ${read}, ${found} with a sector${failed >= 5 ? ` (BSE stopped answering: ${String(lastError?.message ?? lastError).slice(0, 120)})` : ""}${sample ? `; one with none: ${JSON.stringify(sample).slice(0, 600)}` : ""}`);
  return out;
}
export { bseSectors as _bseSectorsForTest, BSE_SECTOR_VERSION };

// NSE's own classification of each company (25 Oct 2026): the index lists
// cover ~750 companies and NSE's announcement "industry" ~935, which left ~290
// with no sector and ~900 guessed from their business lines (how TCS once read
// "Financial Services"). NSE publishes a macro sector, sector, industry and
// basic industry for every listed company on its quote page, so each company
// the index lists miss is read from there once and kept; the last snapshot's
// answers carry forward, so a run reads only companies new to it. Gentle: one
// request at a time with a pause, stopping after five failures in a row.
// Only sector names NSE's index lists also use are taken (KNOWN), so a
// renamed label can't create a stray sector.
export function nseClassification(json, known) {
  const info = json?.industryInfo;
  const sector = typeof info?.sector === "string" ? info.sector.trim() : null;
  if (!sector || !known.has(sector)) return null;
  return { sector, ...(info.basicIndustry ? { basic: String(info.basicIndustry).trim() } : {}), ...(info.macro ? { macro: String(info.macro).trim() } : {}) };
}
// Through a cookie session (fetch-nse.js nseSession): when NSE refuses, the
// session is renewed and the company asked once more; five refusals in a row
// end the run, with NSE's own error in the log.
async function nseSectors(symbols, skip, { pauseMs = 300, max = Number(process.env.NSE_SECTOR_BATCH ?? 2500), session = nseSession() } = {}) {
  const out = { ...(loadMarketSnapshot()?.nseSectors ?? {}) };
  const known = new Set([...Object.values(fallbackSectors({})), ...Object.values(skip)]);
  const todo = symbols.filter(s => !skip[s] && !(s in out)).slice(0, max);
  let failed = 0, read = 0, lastError = null;
  for (const sym of todo) {
    let json = null;
    try { json = await session.quote(sym); }
    catch (error) {
      lastError = error;
      await session.renew(sym).catch(() => {});
      try { json = await session.quote(sym); } catch (again) { lastError = again; }
    }
    if (json) {
      out[sym] = nseClassification(json, known); // null: asked, NSE gave none
      failed = 0; read++;
    } else if (++failed >= 5) break;
    if (pauseMs) await new Promise(r => setTimeout(r, pauseMs));
  }
  if (todo.length) console.error(`[sectors] NSE classification read for ${read} of ${todo.length} companies${failed >= 5 ? ` (NSE stopped answering: ${String(lastError?.message ?? lastError).slice(0, 120)}; ${session.cookies} cookies; the rest next run)` : ""}`);
  return out;
}
export { nseSectors as _nseSectorsForTest };

// The PSU index members, or the last snapshot's when none answer
async function psuIndexSymbols() {
  const out = new Set();
  for (const list of PSU_LISTS) {
    const csv = await fetchText(`https://www.niftyindices.com/IndexConstituent/${list}.csv`).catch(() => null);
    if (!csv) continue;
    const [header, ...lines] = csv.trim().split("\n");
    const iSym = header.split(",").map(c => c.trim()).indexOf("Symbol");
    for (const line of lines) { const sym = line.split(",")[iSym]?.trim(); if (sym) out.add(sym); }
  }
  return out.size ? [...out].sort() : loadMarketSnapshot()?.psuIndex ?? null;
}

// Each company's next board meeting to approve results, from NSE's event
// calendar (one request; companies announce a week or two ahead, so most
// have none listed): { SYMBOL: "2026-10-23" }, the earliest on or after today
async function eventCalendar() {
  const rows = await fetchJson(`${NSE_BASE}/api/event-calendar?index=equities`);
  return Array.isArray(rows) ? rows : [];
}
function resultsDates(rows) {
  const today = isoDay(new Date());
  const out = {};
  for (const r of rows) {
    if (!r.symbol || !/financial results/i.test(r.purpose ?? "")) continue;
    const when = parseQeDate(r.date);
    if (!when) continue;
    const iso = isoDay(when);
    if (iso >= today && (!out[r.symbol] || iso < out[r.symbol])) out[r.symbol] = iso;
  }
  return out;
}

// Each company's events for its page: board meetings NSE's calendar lists
// ahead (results, dividends, fund-raising, bonuses), and corporate actions
// with ex-dates from four months back to four months ahead (dividends,
// bonuses, splits, rights, demergers, AGMs) — NSE's own wording, with the
// record date. { SYMBOL: [{ date, kind: "board"|"action", title, detail }] },
// oldest first. (A per-company events list was asked for on Screener.in's
// user forum, Oct 2026.)
const EVENT_WINDOW_DAYS = 120;
export function eventsBySymbol(calendar, actions, now = new Date()) {
  const today = isoDay(now);
  const from = isoDay(new Date(now.getTime() - EVENT_WINDOW_DAYS * 86400000));
  const to = isoDay(new Date(now.getTime() + EVENT_WINDOW_DAYS * 86400000));
  const out = {};
  const add = (sym, e) => (out[sym] ||= []).push(e);
  for (const r of calendar ?? []) {
    const when = parseQeDate(r.date);
    if (!r.symbol || !when || isoDay(when) < today) continue;
    const purpose = String(r.purpose ?? "").split("/").map(p => p.trim().toLowerCase()).filter(Boolean);
    add(r.symbol, { date: isoDay(when), kind: "board", title: `Board meeting${purpose.length ? `: ${purpose.join(", ")}` : ""}`, detail: r.bm_desc || null });
  }
  const seen = new Set();
  for (const a of actions ?? []) {
    const ex = parseQeDate(a.exDate);
    if (!a.symbol || !ex || !a.subject) continue;
    const iso = isoDay(ex);
    if (iso < from || iso > to || seen.has(`${a.symbol}|${iso}|${a.subject}`)) continue;
    seen.add(`${a.symbol}|${iso}|${a.subject}`);
    const rec = parseQeDate(a.recDate);
    add(a.symbol, { date: iso, kind: "action", title: a.subject, detail: rec ? `Ex-date ${iso}; record date ${isoDay(rec)}` : `Ex-date ${iso}` });
  }
  for (const list of Object.values(out)) list.sort((x, y) => x.date.localeCompare(y.date));
  return out;
}

// Auditor resignations in the last three years, by NSE symbol. Preserve the
// source link and only call an event subsidiary-scoped when the attachment
// text says so; a notice filed under a parent symbol can concern a subsidiary.
async function auditorResignations() {
  const to = new Date(), from = new Date(to.getTime() - 3 * 365 * 86400000);
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(from, "-")}&to_date=${ddmmyyyy(to, "-")}&subject=${encodeURIComponent("Resignation of Statutory Auditor")}`);
  const grouped = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const when = parseQeDate(String(r.an_dt ?? r.sort_date ?? "").slice(0, 11));
    if (!r.symbol || !when || r.desc !== "Resignation of Statutory Auditor") continue;
    let url = null;
    try {
      const candidate = new URL(r.attchmntFile);
      if (candidate.protocol === "https:" && /(^|\.)nseindia\.com$/i.test(candidate.hostname)) url = candidate.href;
    } catch { /* no readable exchange attachment link */ }
    const summary = typeof r.attchmntText === "string" && r.attchmntText !== r.desc ? r.attchmntText.trim() : null;
    const noticeText = `${r.desc ?? ""} ${summary ?? ""}`;
    const scope = /(?:statutory auditor|auditor|auditors).{0,100}subsidiar|subsidiar.{0,100}(?:statutory auditor|auditor|auditors)/i.test(noticeText)
      ? "subsidiary"
      : null;
    const event = { date: when.toISOString().slice(0, 10), scope, summary, url };
    const entries = grouped[r.symbol] ??= new Map();
    entries.set(url ?? event.date, event);
  }
  const out = Object.fromEntries(Object.entries(grouped).map(([symbol, events]) => [
    symbol,
    [...events.values()].sort((a, b) => b.date.localeCompare(a.date)),
  ]));
  return out;
}

// Each company's industry from the last 90 days of NSE announcements, asked
// a month at a time: the whole 90 days in one answer (~50,000 rows) is over
// upstream.js's 25 MB cap, which on 7 Oct 2026 emptied the list. A month that
// fails is skipped — the first one alone names ~930 of the ~950 NSE labels.
async function industriesBySymbol() {
  const out = {};
  let answered = 0;
  for (let month = 0; month < 3; month++) {
    const to = new Date(Date.now() - month * 30 * 86400000), from = new Date(to.getTime() - 29 * 86400000);
    let rows;
    try {
      rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(from, "-")}&to_date=${ddmmyyyy(to, "-")}`);
      answered++;
    } catch {
      continue;
    }
    // Newest month first, so a company's latest label wins
    for (const r of Array.isArray(rows) ? rows : []) if (r.symbol && r.smIndustry && r.smIndustry !== "-") out[r.symbol] ??= r.smIndustry;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!answered) throw new Error("NSE's announcements didn't answer");
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
  const dividendHistory = {}; // six years, for the company page's record (dividends.js)
  const splits = {};
  for (const a of unique) {
    const ex = parseQeDate(a.exDate);
    if (!ex || !a.symbol) continue;
    const exIso = isoDay(ex);
    const dividend = dividendAmount(a.subject || "");
    if (dividend > 0 && exIso > yearAgo) (dividends[a.symbol] ||= []).push({ exDate: exIso, amount: dividend });
    if (dividend > 0) {
      const { regular, special } = dividendParts(a.subject);
      if (regular > 0) (dividendHistory[a.symbol] ||= []).push({ exDate: exIso, amount: regular });
      if (special > 0) (dividendHistory[a.symbol] ||= []).push({ exDate: exIso, amount: special, special: true });
    }
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

  // Board meetings ahead, and corporate actions already announced ahead —
  // NSE lists those a week or two before the ex-date
  const calendar = await eventCalendar().catch(() => null);
  const ahead = await corporateActions(now, new Date(now.getTime() + EVENT_WINDOW_DAYS * 86400000)).catch(() => null);

  const year = await yearOfDays(latest.date, splits);
  // with the share changes only NSE's prices showed (CCAVENUE's ten-into-one,
  // Oct 2026): every return and per-share figure on today's share basis
  for (const [sym, list] of Object.entries(year.rebases)) splits[sym] = [...(splits[sym] ?? []), ...list];
  const { sectors, industrySectors, industries } = await sectorsBySymbol();
  const nseSectorMap = await nseSectors(Object.keys(latest.prices), sectors).catch(() => loadMarketSnapshot()?.nseSectors ?? {});
  const named = { ...sectors, ...Object.fromEntries(Object.entries(nseSectorMap).filter(([, v]) => v?.sector).map(([k, v]) => [k, v.sector])) };
  const bseSectorMap = await bseSectors(Object.keys(latest.prices), named).catch(error => { console.error(`[sectors] BSE didn't answer (${String(error?.message ?? error).slice(0, 160)}); keeping the last answers`); return loadMarketSnapshot()?.bseSectors ?? {}; });

  const snapshot = {
    builtAt: now.toISOString(),
    pricesDate: latest.date,
    prices: latest.prices,
    dividends,
    dividendHistory,
    splits,
    sectors,
    industrySectors,
    industries,
    // BSE's classification for the companies NSE's don't cover
    bseSectors: bseSectorMap,
    bseSectorsVersion: BSE_SECTOR_VERSION,
    // NSE's own classification for the companies the index lists miss
    nseSectors: nseSectorMap,
    // null when NSE didn't answer — unknown, not "no resignations"
    auditorResignations: await auditorResignations().catch(() => null),
    // The Momentum screen's figures (momentum.js) and next results dates;
    // null dates = the calendar couldn't be read, not "none due"
    momentum: year.momentum,
    resultsDates: calendar ? resultsDates(calendar) : null,
    // null = neither list could be read, not "no events"
    events: calendar || ahead ? eventsBySymbol(calendar, [...unique, ...(ahead ?? [])], now) : null,
    psuIndex: await psuIndexSymbols(),
    fyEndPrices,
    range52w: year.ranges,
    range52wFrom: year.from,
    range52wTradingDays: year.tradingDays,
    ...await periodReturns(latest, splits).then(r => ({ returns: r.bySymbol, indexReturns: r.byIndex })),
    tech: year.tech,
    indices: await indexCloses(latest.date),
    indexBoard: await indexBoard(year.from, latest.date).catch(() => null),
    indexMembers: await indexMembers().catch(() => null),
    screenIndices: await screenIndexMembers().catch(() => null),
    themes: await screenIndexMembers(THEME_LISTS, "themes").catch(() => null),
    fno: await fnoSymbols().catch(() => null),
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
