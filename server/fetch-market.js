// Full-market fetch: every NSE-listed equity, saved one file per symbol so
// an interruption loses nothing and a re-run just skips what's already done.
// Paced at the same 500ms/symbol already proven safe in sample-coverage.js —
// no reason to push faster before there's a real product depending on this.
import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchEquityList } from "./equity-list.js";
import { fetchStockSummary } from "./fetch-nse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data", "market");
const DELAY_MS = 500;

mkdirSync(OUT_DIR, { recursive: true });

function alreadyDone(symbol) {
  return existsSync(join(OUT_DIR, `${symbol}.json`));
}

// A single ETIMEDOUT mid-run (observed live while building this) used to
// either kill the whole 48-minute job outright (if it hit the one-shot
// equity-list fetch) or get permanently recorded as a "done" failure (if it
// hit a per-symbol fetch, since alreadyDone() only checks file existence,
// not success) — neither is a real, non-retryable failure. Retry transient
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

async function main() {
  const list = await withRetry(fetchEquityList);
  const todo = list.filter(s => !alreadyDone(s.symbol));
  const skipped = list.length - todo.length;
  console.error(`${list.length} symbols total, ${skipped} already done, ${todo.length} to fetch`);

  let ok = 0, fail = 0;
  const started = Date.now();
  for (const [i, stock] of todo.entries()) {
    try {
      const summary = await withRetry(() => fetchStockSummary(stock.symbol));
      writeFileSync(join(OUT_DIR, `${stock.symbol}.json`), JSON.stringify({ ...summary, name: stock.name, isin: stock.isin, fetchedAt: new Date().toISOString() }, null, 2));
      ok++;
    } catch (e) {
      writeFileSync(join(OUT_DIR, `${stock.symbol}.json`), JSON.stringify({ symbol: stock.symbol, name: stock.name, error: e.message, fetchedAt: new Date().toISOString() }, null, 2));
      fail++;
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) {
      const elapsedMin = (Date.now() - started) / 60000;
      const rate = (i + 1) / elapsedMin;
      const etaMin = (todo.length - i - 1) / rate;
      console.error(`[${i + 1}/${todo.length}] ok=${ok} fail=${fail} — ${elapsedMin.toFixed(1)}m elapsed, ~${etaMin.toFixed(0)}m remaining`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  console.error(`Done. ok=${ok} fail=${fail} total=${todo.length}`);
}

main();
