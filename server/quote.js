// A company's daily prices for the stock page's chart, from NSE's own
// bhavcopies (price-history.js). Until 24 Oct 2026 these and the latest close
// came from Yahoo Finance, whose terms don't allow an app to use its data; the
// latest close is now NSE's, from the evening snapshot, as everywhere else.
//
// The bars are on today's share basis (splits, bonuses and rebases applied),
// so a 1:1 bonus doesn't show as a 50% crash. As far back as the bhavcopies
// kept go: a year from the evening build, more once the backfill has run
// (scripts/backfill-history.mjs).
import { historyBars } from "./price-history.js";
import { loadMarketSnapshot } from "./market-data.js";
import { benchmarkFor } from "./index-history.js";

export const PRICE_RANGES = ["1mo", "6mo", "1y", "5y", "max"];
const MONTHS = { "1mo": 1, "6mo": 6, "1y": 12, "5y": 60 };

// The bars within `range` of the latest kept day, oldest first
export function barsInRange(bars, range) {
  const months = MONTHS[range];
  if (!months || !bars.length) return bars;
  const last = new Date(`${bars[bars.length - 1].date}T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() - months);
  const from = last.toISOString().slice(0, 10);
  return bars.filter(b => b.date > from);
}

export function fetchDailyBars(symbol, range = "1y", snapshot = loadMarketSnapshot()) {
  const all = historyBars(symbol, snapshot);
  // keptFrom: the first day kept, so the page can say how far back it goes
  const bars = barsInRange(all, range);
  // the Nifty 500 on the same days, for the line against the market (null when not kept)
  return { symbol, range, source: "NSE", keptFrom: all[0]?.date ?? null, bars, benchmark: benchmarkFor(bars) };
}
