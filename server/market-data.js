// Market-wide inputs that come in one download for everyone instead of one
// request per company: closing prices (NSE's daily bhavcopy), corporate
// actions (dividends, bonuses, splits) and sectors (NSE index constituents).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { UA, NSE_BASE, fetchJson, parseQeDate } from "./fetch-nse.js";
import { PRICE_DIR, SNAPSHOT_PATH } from "./paths.js";
import { fetchText as requestText } from "./upstream.js";
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
function parseBhavcopy(csv) {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",").map(c => c.trim());
  const iSym = cols.indexOf("SYMBOL"), iSeries = cols.indexOf("SERIES"), iClose = cols.indexOf("CLOSE_PRICE"), iDate = cols.indexOf("DATE1");
  const iHigh = cols.indexOf("HIGH_PRICE"), iLow = cols.indexOf("LOW_PRICE");
  const iQty = cols.indexOf("TTL_TRD_QNTY"), iDeliv = cols.indexOf("DELIV_PER");
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
      best.set(f[iSym], { close, high: Number(f[iHigh]), low: Number(f[iLow]), volume: iQty === -1 ? null : Number(f[iQty]), delivery: Number.isFinite(delivery) ? delivery : null, rank });
    }
  }
  return {
    date: tradingDate ? isoDay(tradingDate) : null,
    prices: Object.fromEntries([...best].map(([s, v]) => [s, v.close])),
    ranges: Object.fromEntries([...best].map(([s, v]) => [s, [v.low > 0 ? v.low : v.close, v.high > 0 ? v.high : v.close]])),
    days: best,
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
  const factorAfter = (sym, iso) => (splits[sym] ?? []).filter(s => s.exDate > iso).reduce((f, s) => f * s.ratio, 1);
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
    const niftyClose = (await indexFile(day.date))?.get("Nifty 50")?.close;
    if (niftyClose > 0) nifty.set(day.date, niftyClose);
    for (const [sym, v] of day.days) {
      const f = factorAfter(sym, day.date);
      const [low, high] = day.ranges[sym];
      const r = (ranges[sym] ||= { low: Infinity, high: 0 });
      r.low = Math.min(r.low, low / f);
      r.high = Math.max(r.high, high / f);
      let list = series.get(sym);
      if (!list) series.set(sym, (list = []));
      list.push({ date: day.date, close: v.close / f, volume: v.volume != null ? v.volume * f : null, delivery: v.delivery });
    }
  }
  for (const r of Object.values(ranges)) {
    r.low = Math.round(r.low * 100) / 100;
    r.high = Math.round(r.high * 100) / 100;
  }
  const tech = {};
  for (const [sym, list] of series) {
    const t = technicals(list.reverse(), nifty);
    if (t) tech[sym] = t;
  }
  return { from: fromIso, tradingDays: seen.size, ranges, tech };
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
// against the last close on or before the same date a week, a month, six
// months and a year back (calendar months — Tickertape doesn't say which
// base it uses; theirs differ from these by under a point). All the days
// come from cached bhavcopies.
const RETURN_PERIODS = [["d1", { days: 1 }], ["w1", { days: 7 }], ["m1", { months: 1 }], ["m6", { months: 6 }], ["y1", { months: 12 }]];

async function periodReturns(latest, splits) {
  const factorBetween = (sym, fromIso) => (splits[sym] ?? [])
    .filter(s => s.exDate > fromIso && s.exDate <= latest.date)
    .reduce((f, s) => f * s.ratio, 1);
  const out = {};
  for (const [key, { days = 0, months = 0 }] of RETURN_PERIODS) {
    const base = new Date(`${latest.date}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() - days);
    const dayOfMonth = base.getUTCDate();
    base.setUTCMonth(base.getUTCMonth() - months);
    if (base.getUTCDate() !== dayOfMonth) base.setUTCDate(0); // 31 Mar − 1 month = 28/29 Feb, not 3 Mar
    const past = await pricesOnOrBefore(base).catch(() => null);
    if (!past || past.date >= latest.date) continue;
    // NIFTY 50 over the same days, for "return vs NIFTY" (percentage points)
    const n0 = (await indexFile(past.date))?.get("Nifty 50")?.close, n1 = (await indexFile(latest.date))?.get("Nifty 50")?.close;
    const niftyRet = n0 > 0 && n1 > 0 ? (n1 / n0 - 1) * 100 : null;
    for (const [sym, close] of Object.entries(latest.prices)) {
      const then = past.prices[sym];
      if (!(then > 0)) continue;
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
    for (const [sym, close] of Object.entries(latest.prices)) {
      const then = past5.prices[sym];
      if (then > 0 && years > 4.5) (out[sym] ||= {}).cagr5y = Math.round((Math.pow(close / (then / factorBetween(sym, past5.date)), 1 / years) - 1) * 10000) / 100;
    }
  }
  return out;
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
      if (close > 0) byName.set(f[at("Index Name")], { close, change: Number(f[at("Points Change")]), changePct: Number(f[at("Change(%)")]) });
    }
  }
  indexDays.set(isoDate, byName);
  return byName;
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
async function sectorsBySymbol() {
  const fromIndex = {};
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
  const industries = await industriesBySymbol().catch(() => ({}));
  const votes = {};
  for (const [sym, industry] of Object.entries(industries)) {
    const sector = fromIndex[sym];
    if (sector) (votes[industry] ??= {})[sector] = (votes[industry][sector] ?? 0) + 1;
  }
  const sectorOf = {};
  for (const [industry, v] of Object.entries(votes)) {
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    const [best, n] = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
    if (total >= 3 && n / total >= 0.75) sectorOf[industry] = best;
  }
  const industrySectors = {};
  for (const [sym, industry] of Object.entries(industries)) if (!fromIndex[sym] && sectorOf[industry]) industrySectors[sym] = sectorOf[industry];
  return { sectors: fromIndex, industrySectors, industries };
}

// Statutory auditors who resigned in the last three years, by company — NSE
// files these under their own subject, apart from routine "Change in
// Auditors" rotations, and filters on it, so it's one small request (~220
// over three years). { SYMBOL: ["2026-05-12", …] }, newest first.
async function auditorResignations() {
  const to = new Date(), from = new Date(to.getTime() - 3 * 365 * 86400000);
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(from, "-")}&to_date=${ddmmyyyy(to, "-")}&subject=${encodeURIComponent("Resignation of Statutory Auditor")}`);
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const when = parseQeDate(String(r.an_dt ?? r.sort_date ?? "").slice(0, 11));
    if (!r.symbol || !when || r.desc !== "Resignation of Statutory Auditor") continue;
    (out[r.symbol] ??= []).push(when.toISOString().slice(0, 10));
  }
  for (const dates of Object.values(out)) dates.sort().reverse();
  return out;
}

// Each company's industry from the last 90 days of NSE announcements — one
// request for the whole market
async function industriesBySymbol() {
  const to = new Date(), from = new Date(to.getTime() - 90 * 86400000);
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(from, "-")}&to_date=${ddmmyyyy(to, "-")}`);
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) if (r.symbol && r.smIndustry && r.smIndustry !== "-") out[r.symbol] = r.smIndustry;
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

  const year = await yearOfDays(latest.date, splits);
  const { sectors, industrySectors, industries } = await sectorsBySymbol();

  const snapshot = {
    builtAt: now.toISOString(),
    pricesDate: latest.date,
    prices: latest.prices,
    dividends,
    splits,
    sectors,
    industrySectors,
    industries,
    // null when NSE didn't answer — unknown, not "no resignations"
    auditorResignations: await auditorResignations().catch(() => null),
    fyEndPrices,
    range52w: year.ranges,
    range52wFrom: year.from,
    range52wTradingDays: year.tradingDays,
    returns: await periodReturns(latest, splits),
    tech: year.tech,
    indices: await indexCloses(latest.date),
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
