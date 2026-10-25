// The price history further back than the year the evening build reads
// (price-history.js), from NSE's archived bhavcopies, a batch at a time: the
// evening refresh adds `maxDays` more each run until `years` are kept
// (scripts/refresh-data.mjs), and scripts/backfill-history.mjs runs it all at
// once. Gentle on NSE's archive: one file at a time with a pause; each file's
// days go into the history and the file isn't kept. The days done are noted
// in the history folder, so it carries on where it stopped.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HISTORY_DIR } from "./paths.js";
import { parseBhavcopy } from "./market-data.js";
import { historyWriter } from "./price-history.js";
import { fetchText } from "./upstream.js";

const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0; educational)";
const iso = d => d.toISOString().slice(0, 10);
const ddmmyyyy = d => `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The weekdays not yet read, newest first: from a year ago (the evening build
// has that year) back `years` years
export function daysToRead(years, done, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 366));
  const stop = new Date(start); stop.setUTCFullYear(stop.getUTCFullYear() - (years - 1));
  const out = [];
  for (const d = new Date(start); d > stop; d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !done.has(iso(d))) out.push(new Date(d));
  }
  return out;
}

export async function backfillHistory({ years = 5, maxDays = Infinity, pauseMs = 800, saveEvery = 40, log = console.log, fetchCsv = null, now = new Date() } = {}) {
  if (years < 2) return { read: 0, holidays: 0, left: 0 };
  mkdirSync(HISTORY_DIR, { recursive: true });
  const DONE = join(HISTORY_DIR, ".backfilled.json");
  const done = new Set(existsSync(DONE) ? JSON.parse(readFileSync(DONE, "utf8")) : []);
  const all = daysToRead(years, done, now);
  const days = all.slice(0, maxDays);
  if (!days.length) return { read: 0, holidays: 0, left: 0 };
  log(`price history: reading ${days.length} of ${all.length} weekdays still to go`);
  const get = fetchCsv ?? (d => fetchText(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${ddmmyyyy(d)}.csv`, { headers: { "User-Agent": UA }, service: "NSE market archive", maxBytes: 25 * 1024 * 1024, timeoutMs: 20_000, notFoundAsNull: true }));
  let writer = historyWriter(), read = 0, holidays = 0, failed = 0, stopped = null;
  const flush = () => { writer.save(); writer = historyWriter(); writeFileSync(DONE, JSON.stringify([...done].sort())); };
  for (const [i, d] of days.entries()) {
    let csv;
    try {
      csv = await get(d);
    } catch (e) {
      // NSE refusing: stop, keep what's done, carry on next time
      if (++failed >= 5) { stopped = e.message; break; }
      await sleep(pauseMs * 4);
      continue;
    }
    failed = 0;
    if (!csv) holidays++;
    else {
      // a holiday can be answered with the day before's file: kept under its own date
      const day = parseBhavcopy(csv);
      if (day.date) writer.add(day.date, day.days);
      read++;
    }
    done.add(iso(d));
    if ((i + 1) % saveEvery === 0) flush();
    if (pauseMs) await sleep(pauseMs);
  }
  flush();
  const left = all.length - days.filter(d => done.has(iso(d))).length;
  log(`price history: ${read} trading days added, ${holidays} holidays, ${left} weekdays left${stopped ? ` (stopped: ${stopped})` : ""}`);
  return { read, holidays, left, stopped };
}
