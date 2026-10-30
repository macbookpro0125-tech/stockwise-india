// The Nifty 500's daily closes, kept beside the companies' price history
// (price-history.js) for the stock chart's line against the market. The
// evening build already reads NSE's index file for each day of the year
// (market-data.js yearOfDays); each day's close is added here, and the file
// only grows. The leading underscore keeps it apart from company files.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_DIR } from "./paths.js";

export const BENCHMARK = "Nifty 500";
const FILE = () => join(HISTORY_DIR, "_index-nifty500.json");

// [[date, close]], oldest first
export function readIndexHistory(file = FILE()) {
  try { return JSON.parse(readFileSync(file, "utf-8")).days ?? []; } catch { return []; }
}

// Adds days (Map date -> close) to the kept ones; a day already kept is replaced
export function saveIndexDays(days, file = FILE()) {
  if (!days.size) return 0;
  const all = new Map(readIndexHistory(file));
  for (const [date, close] of days) if (close > 0) all.set(date, close);
  const sorted = [...all].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify({ name: BENCHMARK, days: sorted }));
  renameSync(`${file}.tmp`, file);
  return sorted.length;
}

// The index's closes on the bars' days, from where it's kept without a long
// gap (the line starts there: a few odd days kept years back don't count), or
// null when fewer than 60 days are covered or too many are missing after the
// start to draw a fair line (more than 1 in 20)
export function benchmarkFor(bars, days = readIndexHistory()) {
  if (!bars.length || !days.length) return null;
  const byDate = new Map(days);
  let start = -1, run = 0;
  bars.forEach((b, i) => {
    if (byDate.has(b.date)) { if (start < 0) start = i; run = 0; }
    else if (++run > 10) start = -1;
  });
  if (start < 0) return null;
  const covered = bars.slice(start);
  if (covered.length < 60) return null;
  const closes = covered.map(b => [b.date, byDate.get(b.date) ?? null]);
  if (closes.filter(([, c]) => c == null).length > covered.length / 20) return null;
  return { name: BENCHMARK, from: closes[0][0], closes };
}
