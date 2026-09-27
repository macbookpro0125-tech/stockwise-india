// Current prices for a set of symbols (portfolio, watchlist, alerts): the
// live Yahoo quote where it answers, else NSE's last close from the daily
// snapshot. Each price says which it is — a close shown as "live" would
// mislead on a volatile day.
import { fetchCmp } from "./quote.js";
import { loadMarketSnapshot } from "./market-data.js";

const CONCURRENCY = 6;

export async function currentPrices(symbols, { live = true } = {}) {
  const snap = loadMarketSnapshot();
  const out = {};
  const unique = [...new Set(symbols)];
  let next = 0;
  async function worker() {
    while (next < unique.length) {
      const sym = unique[next++];
      if (live) {
        try {
          const q = await fetchCmp(sym);
          out[sym] = { price: q.cmp, asOf: q.asOf, source: "live" };
          continue;
        } catch { /* fall back to the close */ }
      }
      const close = snap?.prices?.[sym];
      out[sym] = close != null ? { price: close, asOf: snap.pricesDate, source: "close" } : null;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, worker));
  return out;
}
