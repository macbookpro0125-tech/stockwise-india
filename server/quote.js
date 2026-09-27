// Live price from Yahoo Finance — the exact same proven source stock-screener
// already uses for Indian equities (server/quote.js there), simplified here
// since every symbol in this project comes from NSE's own EQUITY_L.csv (a
// clean alphabetic symbol always), not Screener.in's mix of NSE tickers and
// raw BSE scrip codes that needed a fallback chain to resolve.
const UA = "Mozilla/5.0 (compatible; StockwiseIndia/1.0; educational)";
const CACHE = new Map();
const CACHE_MS = 15 * 60 * 1000;

function istDayKey(unixSec) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(unixSec * 1000));
}

// One Yahoo chart request: given up after 10 s, and tried once more after a
// dropped connection, a rate limit or a server error. A single blip used to
// put "Couldn't fetch a live price" on the stock page — it happened in half
// of the video-recording runs, and customers would see it too.
async function yahooChart(url, what) {
  for (let attempt = 1; ; attempt++) {
    let retryable;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) return (await res.json())?.chart?.result?.[0] ?? null;
      retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 2) throw Object.assign(new Error(`Yahoo ${what} HTTP ${res.status}`), { final: true });
    } catch (e) {
      if (e.final || attempt >= 2) throw e;
    }
    await new Promise(r => setTimeout(r, 700));
  }
}

export async function fetchCmp(symbol) {
  const cached = CACHE.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const result = await yahooChart(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=5d`, "quote");
  if (!result) throw new Error(`No quote data for ${symbol}`);

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const byDay = new Map();
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    byDay.set(istDayKey(timestamps[i]), closes[i]);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!days.length) throw new Error(`No daily closes for ${symbol}`);

  const today = istDayKey(Date.now() / 1000);
  const [date, close] = days[days.length - 1][0] === today && days.length >= 2 ? days[days.length - 2] : days[days.length - 1];
  const data = { cmp: Math.round(close * 100) / 100, asOf: date };
  CACHE.set(symbol, { at: Date.now(), data });
  return data;
}

// Daily closes for the stock page's price chart — the same Yahoo series the
// original's chart used. Yahoo's closes are already adjusted for splits and
// bonuses, so a 1:1 bonus doesn't show as a 50% crash.
export const PRICE_RANGES = ["1mo", "6mo", "1y", "5y", "max"];
const BARS_CACHE = new Map();

export async function fetchDailyBars(symbol, range = "1y") {
  const key = `${symbol}|${range}`;
  const cached = BARS_CACHE.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const result = await yahooChart(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=${range}`, "price history");
  if (!result) throw new Error(`No price history for ${symbol}`);

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const byDay = new Map();
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) byDay.set(istDayKey(timestamps[i]), Math.round(closes[i] * 100) / 100);
  }
  const data = { symbol: `${symbol}.NS`, range, bars: [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, close]) => ({ date, close })) };
  BARS_CACHE.set(key, { at: Date.now(), data });
  return data;
}
