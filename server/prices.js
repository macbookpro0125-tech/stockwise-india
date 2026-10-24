// Current prices for a set of symbols (portfolio, watchlist, alerts): NSE's
// close from the evening snapshot, with its date. (Yahoo's daily close was
// compared with it until 24 Oct 2026; Yahoo's terms don't allow an app to use
// its data.)
import { loadMarketSnapshot } from "./market-data.js";

export function selectCurrentPrice(symbol, snapshot) {
  const close = snapshot?.prices?.[symbol];
  if (close != null && Number.isFinite(close) && close > 0) return { price: close, asOf: snapshot.pricesDate ?? null, source: "close" };
  return null;
}

export async function currentPrices(symbols, { snapshot = loadMarketSnapshot() } = {}) {
  const out = {};
  for (const sym of new Set(symbols)) out[sym] = selectCurrentPrice(sym, snapshot);
  return out;
}
