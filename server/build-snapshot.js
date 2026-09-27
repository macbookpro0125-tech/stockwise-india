// Rebuilds data/market-snapshot.json: latest prices, a year of dividends,
// splits/bonuses, sectors, and closes at every fiscal year-end that appears in
// the fetched filings (for historical P/E). Prices change daily, filings
// quarterly — run this daily, fetch-market.js after results seasons.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMarketSnapshot } from "./market-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKET_DIR = join(__dirname, "..", "data", "market");

export function fiscalYearEnds() {
  const ends = new Set();
  for (const f of readdirSync(MARKET_DIR).filter(f => f.endsWith(".json"))) {
    const stock = JSON.parse(readFileSync(join(MARKET_DIR, f), "utf-8"));
    for (const y of stock.years ?? []) if (y.fyEnd && !y.error) ends.add(y.fyEnd);
  }
  return [...ends].sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const started = Date.now();
  const ends = fiscalYearEnds();
  console.error(`${ends.length} distinct fiscal year-ends in the data (${ends[0]} … ${ends.at(-1)})`);
  const snap = await buildMarketSnapshot(ends);
  const missing = Object.entries(snap.fyEndPrices).filter(([, v]) => v.error).map(([d]) => d);
  console.error(`Snapshot built in ${((Date.now() - started) / 1000).toFixed(0)}s — prices as of ${snap.pricesDate}, ${Object.keys(snap.prices).length} symbols priced` +
    (missing.length ? `; no prices for ${missing.length} year-end(s): ${missing.join(", ")}` : ""));
}
