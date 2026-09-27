// Fetching companies from NSE, one file per symbol so an interruption loses
// nothing and a re-run just skips what's already done. Paced at the same
// 500ms/symbol already proven safe. Used from the command line, and by the
// server's background jobs (data-jobs.js) on a live host.
//
//   node server/fetch-market.js              every company not yet on the current schema
//   node server/fetch-market.js --holdings   shareholding only, for files that lack it —
//     shareholding filings come quarterly and carry the share count, so refreshing
//     them shouldn't mean re-reading five years of results (~45 min instead of ~100)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchEquityList } from "./equity-list.js";
import { fetchStockSummary, SCHEMA } from "./fetch-nse.js";
import { fetchShareholding } from "./fetch-shareholding.js";
import { saveStock } from "./screen.js";
import { MARKET_DIR } from "./paths.js";

const DELAY_MS = 500;
const BLOCK_PAUSE_MS = 5 * 60 * 1000;
const BLOCKS_BEFORE_PAUSE = 5;

export function readStored(symbol) {
  const path = join(MARKET_DIR, `${symbol}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// Done = a file written by the current schema, success or genuine failure. A
// file from an older schema is re-fetched rather than skipped as done.
export const needsSummary = symbol => readStored(symbol)?.schema !== SCHEMA;

// Financials fetched, shareholding never read from its filing (older files
// only carry the promoter %)
export function needsHoldingsBackfill(symbol) {
  const stored = readStored(symbol);
  return stored?.schema === SCHEMA && !stored.error && !stored.holding?.source;
}

// A single ETIMEDOUT mid-run (observed live) used to either kill the whole job
// outright or get permanently recorded as a "done" failure. Retry transient
// network errors a couple of times with backoff before giving up for real.
export async function withRetry(fn, attempts = 3) {
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

async function fetchOne(stock, kind) {
  if (kind === "summary") {
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

// kind "summary": results + shareholding; "holdings": shareholding only.
// stocks: [{ symbol, name, isin }] from NSE's equity list.
export async function fetchCompanies(stocks, kind, { onProgress = () => {}, log = console.error } = {}) {
  let ok = 0, fail = 0, blockedInARow = 0, refused = 0;
  const started = Date.now();
  for (const [i, stock] of stocks.entries()) {
    try {
      await fetchOne(stock, kind);
      ok++;
      blockedInARow = 0;
    } catch (e) {
      if (isBlocked(e)) {
        // Refused, not failed: write nothing, so a re-run retries it. A run of
        // refusals means NSE is throttling us — back off instead of burning
        // through the list marking every company as broken.
        refused++;
        if (++blockedInARow >= BLOCKS_BEFORE_PAUSE) {
          log(`NSE refused ${blockedInARow} in a row (${e.message}) — pausing ${BLOCK_PAUSE_MS / 60000} min`);
          await new Promise(r => setTimeout(r, BLOCK_PAUSE_MS));
          blockedInARow = 0;
        }
      } else {
        // A failed shareholding refresh must never replace the financials on disk
        if (kind === "holdings") log(`${stock.symbol}: ${e.message}`);
        else saveStock(stock.symbol, { symbol: stock.symbol, name: stock.name, schema: SCHEMA, error: e.message, fetchedAt: new Date().toISOString() });
        fail++;
        blockedInARow = 0;
      }
    }
    onProgress({ done: i + 1, total: stocks.length, ok, fail, refused });
    if ((i + 1) % 25 === 0 || i === stocks.length - 1) {
      const elapsedMin = (Date.now() - started) / 60000;
      const etaMin = (stocks.length - i - 1) / ((i + 1) / elapsedMin);
      log(`[${i + 1}/${stocks.length}] ok=${ok} fail=${fail} refused=${refused} — ${elapsedMin.toFixed(1)}m elapsed, ~${etaMin.toFixed(0)}m remaining`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  return { ok, fail, refused };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const holdingsOnly = process.argv.includes("--holdings");
  const list = await withRetry(fetchEquityList);
  const todo = list.filter(s => (holdingsOnly ? needsHoldingsBackfill(s.symbol) : needsSummary(s.symbol)));
  console.error(`${list.length} symbols total, ${list.length - todo.length} already done, ${todo.length} to ${holdingsOnly ? "update shareholding for" : "fetch"}`);
  const { ok, fail, refused } = await fetchCompanies(todo, holdingsOnly ? "holdings" : "summary");
  console.error(`Done. ok=${ok} fail=${fail} refused (re-run to retry)=${refused} total=${todo.length}`);
}
