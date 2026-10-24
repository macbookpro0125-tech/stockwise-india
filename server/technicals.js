// Ported verbatim from stock-screener's server/technicals.js — moving averages,
// RSI, pivot levels, crossovers and the summary gauge behind the Technical
// Analysis panel, from a year of daily candles — NSE's own, from its
// bhavcopies (price-history.js; Yahoo's until 24 Oct 2026).
import { HttpError } from "./http-errors.js";
import { historyBars } from "./price-history.js";
import { loadMarketSnapshot } from "./market-data.js";
const CACHE = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000; // the prices change once an evening

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  return null;
}

/** Simple Moving Average */
function calcSMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const slice = prices.slice(-period);
  return Math.round((slice.reduce((a, b) => a + b, 0) / period) * 100) / 100;
}

/** Exponential Moving Average */
function calcEMA(prices, period) {
  if (!prices || prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Math.round(ema * 100) / 100;
}

/** RSI-14 */
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

/** Classic Pivot Points from previous day H/L/C */
function calcPivotPoints(high, low, close) {
  const pp = (high + low + close) / 3;
  const r = (v) => Math.round(v * 100) / 100;
  return {
    pp: r(pp),
    s1: r(2 * pp - high),
    s2: r(pp - (high - low)),
    s3: r(low - 2 * (high - pp)),
    r1: r(2 * pp - low),
    r2: r(pp + (high - low)),
    r3: r(high + 2 * (pp - low)),
  };
}

// A year of the company's daily candles, from NSE's bhavcopies
// (price-history.js), on today's share basis
function nseHistory(ticker, snapshot) {
  const bars = historyBars(ticker, snapshot).slice(-260);
  if (!bars.length) throw new HttpError(`No NSE price history is kept for ${ticker} yet; it arrives with the evening data update.`, 404);
  if (bars.length < 20) throw new HttpError(`${ticker} was recently listed — only ${bars.length} day(s) of price data available. Technical analysis requires at least 20 trading days.`, 422);
  return { sym: ticker, candles: bars.map(b => ({ c: b.close, h: b.high, l: b.low, v: b.volume, t: b.date })) };
}

/** Determine setup state label */
function getSetupState(price, ema9, ema20, pctAboveEma20) {
  if (price < ema9 && price < ema20) return "correction";
  if (pctAboveEma20 > 20) return "extended";
  if (ema9 > ema20 && price > ema9) return "momentum";
  if (ema9 > ema20 && price < ema9 && price > ema20) return "pullback";
  if (Math.abs(ema9 - ema20) / ema20 < 0.015) return "base";
  return "developing";
}

/** Build summary gauge from all indicators */
function buildSummary(price, smas, emas, rsi, pivots) {
  let bearish = 0, neutral = 0, bullish = 0;
  const signals = [];

  // Price vs SMAs
  for (const [period, val] of Object.entries(smas)) {
    if (val == null) continue;
    const sig = price > val ? "bullish" : price < val ? "bearish" : "neutral";
    signals.push({ name: `SMA ${period}`, signal: sig });
    if (sig === "bullish") bullish++; else if (sig === "bearish") bearish++; else neutral++;
  }

  // Price vs EMAs
  for (const [period, val] of Object.entries(emas)) {
    if (val == null) continue;
    const sig = price > val ? "bullish" : price < val ? "bearish" : "neutral";
    signals.push({ name: `EMA ${period}`, signal: sig });
    if (sig === "bullish") bullish++; else if (sig === "bearish") bearish++; else neutral++;
  }

  // SMA crossovers
  if (smas[5] != null && smas[20] != null) {
    const sig = smas[5] > smas[20] ? "bullish" : "bearish";
    signals.push({ name: "SMA 5/20", signal: sig });
    if (sig === "bullish") bullish++; else bearish++;
  }
  if (smas[50] != null && smas[200] != null) {
    const sig = smas[50] > smas[200] ? "bullish" : "bearish";
    signals.push({ name: "SMA 50/200", signal: sig });
    if (sig === "bullish") bullish++; else bearish++;
  }

  // EMA crossovers
  if (emas[9] != null && emas[20] != null) {
    const sig = emas[9] > emas[20] ? "bullish" : "bearish";
    signals.push({ name: "EMA 9/20", signal: sig });
    if (sig === "bullish") bullish++; else bearish++;
  }

  // RSI
  if (rsi != null) {
    const sig = rsi > 70 ? "bearish" : rsi < 30 ? "bullish" : "neutral";
    signals.push({ name: "RSI 14", signal: sig });
    if (sig === "bullish") bullish++; else if (sig === "bearish") bearish++; else neutral++;
  }

  // Price vs Pivot
  if (pivots) {
    const sig = price > pivots.pp ? "bullish" : price < pivots.pp ? "bearish" : "neutral";
    signals.push({ name: "Pivot", signal: sig });
    if (sig === "bullish") bullish++; else if (sig === "bearish") bearish++; else neutral++;
  }

  const total = bearish + neutral + bullish;
  const overall = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";
  return { bearish, neutral, bullish, total, overall, signals };
}

export async function fetchTechnicals(ticker, snapshot = loadMarketSnapshot()) {
  // kept until the next evening's prices
  const cacheKey = ticker.toUpperCase();
  const cached = cacheGet(`${cacheKey}|${snapshot?.pricesDate ?? ""}`);
  if (cached) return { ...cached, cached: true };
  const history = nseHistory(cacheKey, snapshot);
  const { candles } = history;
  const closes = candles.map(c => c.c);

  const price = closes[closes.length - 1];

  // EMAs
  const ema9  = calcEMA(closes, 9);
  const ema20 = calcEMA(closes, 20);
  const rsi14 = calcRSI(closes, 14);

  // SMAs
  const sma5   = calcSMA(closes, 5);
  const sma10  = calcSMA(closes, 10);
  const sma20  = calcSMA(closes, 20);
  const sma50  = calcSMA(closes, 50);
  const sma100 = calcSMA(closes, 100);
  const sma200 = calcSMA(closes, 200);

  // Additional EMAs for summary
  const ema5   = calcEMA(closes, 5);
  const ema10  = calcEMA(closes, 10);
  const ema50  = calcEMA(closes, 50);
  const ema100 = calcEMA(closes, 100);
  const ema200 = calcEMA(closes, 200);

  // SMA crossover detection (compare today vs yesterday)
  const prevCloses = closes.slice(0, -1);
  const prevSma5   = calcSMA(prevCloses, 5);
  const prevSma20  = calcSMA(prevCloses, 20);
  const prevSma50  = calcSMA(prevCloses, 50);
  const prevSma200 = calcSMA(prevCloses, 200);
  const prevEma9   = calcEMA(prevCloses, 9);
  const prevEma20  = calcEMA(prevCloses, 20);

  // Short-term: SMA 5 & 20
  let shortTermCross = null;
  let shortTermSignal = "neutral";
  if (sma5 != null && sma20 != null) {
    shortTermSignal = sma5 > sma20 ? "bullish" : "bearish";
    if (prevSma5 != null && prevSma20 != null) {
      if (prevSma5 < prevSma20 && sma5 > sma20) shortTermCross = "bullish";
      if (prevSma5 > prevSma20 && sma5 < sma20) shortTermCross = "bearish";
    }
  }

  // Long-term: SMA 50 & 200
  let longTermCross = null;
  let longTermSignal = "neutral";
  if (sma50 != null && sma200 != null) {
    longTermSignal = sma50 > sma200 ? "bullish" : "bearish";
    if (prevSma50 != null && prevSma200 != null) {
      if (prevSma50 < prevSma200 && sma50 > sma200) longTermCross = "bullish";
      if (prevSma50 > prevSma200 && sma50 < sma200) longTermCross = "bearish";
    }
  }

  // EMA 9/20 crossover
  let emaCrossover = null;
  if (prevEma9 != null && prevEma20 != null && ema9 != null && ema20 != null) {
    if (prevEma9 < prevEma20 && ema9 > ema20) emaCrossover = "bullish";
    if (prevEma9 > prevEma20 && ema9 < ema20) emaCrossover = "bearish";
  }

  const emaSignal = ema9 != null && ema20 != null
    ? (ema9 > ema20 ? "bullish" : "bearish")
    : "neutral";

  // Pivot points from the last completed candle
  const lastCandle = candles[candles.length - 1];
  const pivots = calcPivotPoints(lastCandle.h, lastCandle.l, lastCandle.c);

  // Summary gauge
  const smas = { 5: sma5, 10: sma10, 20: sma20, 50: sma50, 100: sma100, 200: sma200 };
  const allEmas = { 5: ema5, 9: ema9, 10: ema10, 20: ema20, 50: ema50, 100: ema100, 200: ema200 };
  const summary = buildSummary(price, smas, allEmas, rsi14, pivots);

  const pctAboveEma20 = ema20 ? Math.round(((price - ema20) / ema20) * 1000) / 10 : null;
  const pctAboveEma9  = ema9  ? Math.round(((price - ema9)  / ema9)  * 1000) / 10 : null;

  const setupState = getSetupState(price, ema9, ema20, pctAboveEma20);

  // Returns
  const price20dAgo = closes.length >= 20 ? closes[closes.length - 20] : null;
  const price60dAgo = closes.length >= 60 ? closes[closes.length - 60] : null;
  const return20d = price20dAgo ? Math.round(((price - price20dAgo) / price20dAgo) * 1000) / 10 : null;
  const return60d = price60dAgo ? Math.round(((price - price60dAgo) / price60dAgo) * 1000) / 10 : null;

  // Sparkline: last 60 candles
  const sparkline = closes.slice(-60);

  // RSI label
  const rsiLabel = rsi14 > 70 ? "Overbought" : rsi14 < 30 ? "Oversold" : "Neutral";

  const data = {
    ticker: cacheKey,
    source: "NSE",
    price,
    // EMAs
    ema9, ema20,
    // SMAs
    sma5, sma20: sma20, sma50, sma200,
    // RSI
    rsi14, rsiLabel,
    // Signals
    emaSignal, crossover: emaCrossover,
    shortTermSignal, shortTermCross,
    longTermSignal, longTermCross,
    // Pivot points
    pivots,
    // Summary gauge
    summary,
    // Setup state
    aboveEma9: ema9 != null && price > ema9,
    aboveEma20: ema20 != null && price > ema20,
    pctAboveEma9, pctAboveEma20,
    setupState,
    // Returns
    return20d, return60d,
    sparkline,
  };

  CACHE.set(`${cacheKey}|${snapshot?.pricesDate ?? ""}`, { at: Date.now(), data });
  return data;
}
