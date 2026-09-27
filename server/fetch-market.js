// Full-market fetch: every NSE-listed equity, saved one file per symbol so
// an interruption loses nothing and a re-run just skips what's already done.
// Paced at the same 500ms/symbol already proven safe — no reason to push
// faster before there's a real product depending on this.
//
// --holdings refreshes only the shareholding part of files already fetched.
// Shareholding filings come quarterly and carry the share count, so adding or
// refreshing them shouldn't mean re-reading five years of results for every
// company (~45 min instead of ~100).
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEquityList } from "./equity-list.js";
import { fetchStockSummary, SCHEMA } from "./fetch-nse.js";
import { fetchShareholding } from "./fetch-shareholding.js";
import { saveStock } from "./screen.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "market");
const DELAY_MS = 500;
const BLOCK_PAUSE_MS = 5 * 60 * 1000;
const BLOCKS_BEFORE_PAUSE = 5;
const HOLDINGS_ONLY = process.argv.includes("--holdings");

function readStored(symbol) {
  const path = join(OUT_DIR, `${symbol}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// Done = a file written by the current schema, success or genuine failure. A
// file from an older schema is re-fetched rather than skipped as done. In
// --holdings mode: a company with financials whose shareholding hasn't been
// read from the filing yet (older files only carry the promoter %).
function needsWork(symbol) {
  const stored = readStored(symbol);
  if (HOLDINGS_ONLY) return stored?.schema === SCHEMA && !stored.error && !stored.holding?.source;
  return stored?.schema !== SCHEMA;
}

async function work(stock) {
  if (!HOLDINGS_ONLY) {
    const summary = await withRetry(() => fetchStockSummary(stock.symbol));
    saveStock(stock.symbol, { ...summary, name: stock.name, isin: stock.isin, fetchedAt: new Date().toISOString() });
    return;
  }
  const stored = readStored(stock.symbol);
  let holding;
  try {
    holding = await withRetry(() => fetchShareholding(stock.symbol));
  } catch (e) {
    if (isBlocked(e)) throw e;
    // Keep the promoter % already there; mark it so a re-run doesn't retry forever
    holding = { ...stored.holding, source: "failed", error: e.message };
  }
  saveStock(stock.symbol, { ...stored, holding: { ...holding, fetchedAt: new Date().toISOString() } });
}

// A single ETIMEDOUT mid-run (observed live) used to either kill the whole job
// outright or get permanently recorded as a "done" failure. Retry transient
// network errors a couple of times with backoff before giving up for real.
async function withRetry(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const transient = e instanceof TypeError || e.cause?.code === "ETIMEDOUT";
      if (!transient || i === attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

const isBlocked = e => /HTTP (403|429)\b/.test(e.message);

async function main() {
  const list = await withRetry(fetchEquityList);
  const todo = list.filter(s => needsWork(s.symbol));
  console.error(`${list.length} symbols total, ${list.length - todo.length} already done, ${todo.length} to ${HOLDINGS_ONLY ? "update shareholding for" : "fetch"}`);

  let ok = 0, fail = 0, blockedInARow = 0, skippedBlocked = 0;
  const started = Date.now();
  for (const [i, stock] of todo.entries()) {
    try {
      await work(stock);
      ok++;
      blockedInARow = 0;
    } catch (e) {
      if (isBlocked(e)) {
        // Refused, not failed: write nothing, so a re-run retries it. A run of
        // refusals means NSE is throttling us — back off instead of burning
        // through the list marking every company as broken.
        skippedBlocked++;
        if (++blockedInARow >= BLOCKS_BEFORE_PAUSE) {
          console.error(`NSE refused ${blockedInARow} in a row (${e.message}) — pausing ${BLOCK_PAUSE_MS / 60000} min`);
          await new Promise(r => setTimeout(r, BLOCK_PAUSE_MS));
          blockedInARow = 0;
        }
      } else {
        // A failed shareholding refresh must never replace the financials on disk
        if (HOLDINGS_ONLY) console.error(`${stock.symbol}: ${e.message}`);
        else saveStock(stock.symbol, { symbol: stock.symbol, name: stock.name, schema: SCHEMA, error: e.message, fetchedAt: new Date().toISOString() });
        fail++;
        blockedInARow = 0;
      }
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) {
      const elapsedMin = (Date.now() - started) / 60000;
      const rate = (i + 1) / elapsedMin;
      const etaMin = (todo.length - i - 1) / rate;
      console.error(`[${i + 1}/${todo.length}] ok=${ok} fail=${fail} refused=${skippedBlocked} — ${elapsedMin.toFixed(1)}m elapsed, ~${etaMin.toFixed(0)}m remaining`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.error(`Done. ok=${ok} fail=${fail} refused (re-run to retry)=${skippedBlocked} total=${todo.length}`);
}

main();
