// Current prices for a set of symbols (portfolio, watchlist, alerts): prefer
// whichever dated close is newer, from Yahoo or NSE's daily snapshot. A
// cached Yahoo close is still compared by its original date. Each result says
// its source and date.
import { fetchCmp } from "./quote.js";
import { loadMarketSnapshot } from "./market-data.js";

const CONCURRENCY = 6;

export function selectCurrentPrice(symbol, quote, snapshot) {
  const close = snapshot?.prices?.[symbol];
  const quoteValid = Number.isFinite(quote?.cmp) && quote.cmp > 0;
  const quoteIsNewer = quoteValid && (close == null || !snapshot?.pricesDate || (quote.asOf && quote.asOf >= snapshot.pricesDate));
  if (quoteIsNewer) return { price: quote.cmp, asOf: quote.asOf ?? null, source: quote.stale ? "cached" : "live", stale: !!quote.stale };
  if (close != null && Number.isFinite(close) && close > 0) return { price: close, asOf: snapshot.pricesDate ?? null, source: "close" };
  if (quoteValid) return { price: quote.cmp, asOf: quote.asOf ?? null, source: quote.stale ? "cached" : "live", stale: !!quote.stale };
  return null;
}

export async function currentPrices(symbols, { useYahoo = true, snapshot = loadMarketSnapshot(), getQuote = fetchCmp } = {}) {
  const out = {};
  const unique = [...new Set(symbols)];
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const sym = unique[next++];
      let quote = null;
      if (useYahoo) {
        try {
          quote = await getQuote(sym);
        } catch { /* fall back to the close */ }
      }
      out[sym] = selectCurrentPrice(sym, quote, snapshot);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return out;
}
