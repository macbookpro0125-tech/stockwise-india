// Latest completed daily close from Yahoo Finance — the exact same proven source stock-screener
// already uses for Indian equities (server/quote.js there), simplified here
// since every symbol in this project comes from NSE's own EQUITY_L.csv (a
// clean alphabetic symbol always), not Screener.in's mix of NSE tickers and
// raw BSE scrip codes that needed a fallback chain to resolve.
const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0; educational)";
const CACHE = new Map();
const CACHE_MS = 15 * 60 * 1000;
import { fetchJson as requestJson } from "./upstream.js";

function istDayKey(unixSec) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(unixSec * 1000));
}

// When a day's price becomes its close. NSE's session ends at 15:30 IST and
// the official close comes from the closing session after it, so from 16:00
// IST that day's price is final; before then it is the trade in progress. The
// stock page's header and its chart both use this, so they agree: they showed
// the 13 Oct close and a 14 Oct candle side by side all evening.
const CLOSE_FINAL_IST = "16:00";
export function sessionClosed(dayKey, nowSec = Date.now() / 1000) {
  const today = istDayKey(nowSec);
  if (dayKey !== today) return dayKey < today;
  const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(nowSec * 1000));
  return hm >= CLOSE_FINAL_IST;
}

// One row per trading day from a Yahoo chart result, oldest first. Open, high
// and low are split-adjusted like the close; a day missing one falls back to
// the close (a flat candle). Yahoo often leaves the latest day's close empty
// (open, high, low and volume filled) and gives it only as
// meta.regularMarketPrice, so the last row takes that.
export function dailyRows(result) {
  const timestamps = result?.timestamp || [];
  const q = result?.indicators?.quote?.[0] || {};
  const closes = q.close || [];
  const meta = result?.meta || {};
  const lastDay = timestamps.length ? istDayKey(timestamps[timestamps.length - 1]) : null;
  const metaClose = meta.regularMarketPrice != null && meta.regularMarketTime && istDayKey(meta.regularMarketTime) === lastDay ? meta.regularMarketPrice : null;
  const r2 = n => Math.round(n * 100) / 100;
  const byDay = new Map();
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i] ?? (i === timestamps.length - 1 ? metaClose : null);
    if (close == null) continue;
    const open = q.open?.[i] ?? close, high = q.high?.[i] ?? close, low = q.low?.[i] ?? close;
    byDay.set(istDayKey(timestamps[i]), {
      open: r2(open), high: r2(Math.max(high, open, close)), low: r2(Math.min(low, open, close)), close: r2(close),
      volume: q.volume?.[i] ?? null,
    });
  }
  return [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, bar]) => ({ date, ...bar }));
}

// One Yahoo chart request: given up after 10 s, and tried once more after a
// dropped connection, a rate limit or a server error. A single blip used to
// put "Couldn't refresh the latest close" on the stock page — it happened in half
// of the video-recording runs, and customers would see it too.
async function yahooChart(url, what) {
  const body = await requestJson(url, { headers: { "User-Agent": UA, Accept: "application/json" }, service: `Yahoo ${what}`, timeoutMs: 10_000, maxBytes: 8 * 1024 * 1024 });
  return body?.chart?.result?.[0] ?? null;
}

export async function fetchCmp(symbol) {
  const cached = CACHE.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (cached?.retryAt > Date.now()) return { ...cached.data, stale: true, staleReason: "Yahoo refresh failed; showing the last successful quote." };

  let result;
  try {
    result = await yahooChart(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=5d`, "quote");
  } catch (error) {
    if (cached) {
      CACHE.set(symbol, { ...cached, retryAt: Date.now() + 60_000 });
      return { ...cached.data, stale: true, staleReason: "Yahoo refresh failed; showing the last successful quote." };
    }
    throw error;
  }
  if (!result) {
    if (cached) {
      CACHE.set(symbol, { ...cached, retryAt: Date.now() + 60_000 });
      return { ...cached.data, stale: true, staleReason: "Yahoo refresh failed; showing the last successful quote." };
    }
    throw new Error(`No quote data for ${symbol}`);
  }

  // The latest day whose session has closed (sessionClosed): today from
  // 16:00 IST, the day before until then
  const days = dailyRows(result).filter(d => sessionClosed(d.date));
  if (!days.length) {
    if (cached) {
      CACHE.set(symbol, { ...cached, retryAt: Date.now() + 60_000 });
      return { ...cached.data, stale: true, staleReason: "Yahoo returned no closes; showing the last successful quote." };
    }
    throw new Error(`No daily closes for ${symbol}`);
  }

  const { date, close } = days[days.length - 1];
  const data = { cmp: Math.round(close * 100) / 100, asOf: date };
  CACHE.set(symbol, { at: Date.now(), data });
  return data;
}

// Daily OHLCV bars for the stock page's price chart — the same Yahoo series the
// original's chart used. Yahoo's closes are already adjusted for splits and
// bonuses, so a 1:1 bonus doesn't show as a 50% crash.
export const PRICE_RANGES = ["1mo", "6mo", "1y", "5y", "max"];
const BARS_CACHE = new Map();

export async function fetchDailyBars(symbol, range = "1y") {
  const key = `${symbol}|${range}`;
  const cached = BARS_CACHE.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  if (cached?.retryAt > Date.now()) return { ...cached.data, stale: true, staleReason: "Yahoo refresh failed; showing the last successful price history." };

  let result;
  try {
    result = await yahooChart(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=${range}`, "price history");
  } catch (error) {
    if (cached) {
      BARS_CACHE.set(key, { ...cached, retryAt: Date.now() + 60_000 });
      return { ...cached.data, stale: true, staleReason: "Yahoo refresh failed; showing the last successful price history." };
    }
    throw error;
  }
  if (!result) throw new Error(`No price history for ${symbol}`);

  // Today's candle stays on the chart while the market is open, flagged as
  // in progress (sessionClosed) so it isn't read as a close
  const bars = dailyRows(result);
  const last = bars[bars.length - 1];
  if (last && !sessionClosed(last.date)) last.partial = true;
  const data = { symbol: `${symbol}.NS`, range, bars };
  BARS_CACHE.set(key, { at: Date.now(), data });
  return data;
}
