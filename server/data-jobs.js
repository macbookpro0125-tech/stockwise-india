// Keeps a running server's data fresh without anyone running scripts:
//  - at start: fetch every company not on the current schema — on a fresh
//    host's empty disk that's the whole market (~2 h), otherwise usually none
//  - every 12 h: the market snapshot (prices, dividends, splits, 52-week range)
//  - daily: companies that filed results since the last check (NSE's
//    market-wide filings feed), and shareholding for companies whose latest
//    shareholding filing is a quarter behind
// One job at a time, so NSE only ever sees one paced request stream from us.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, MARKET_DIR } from "./paths.js";
import { NSE_BASE, fetchJson, parseQeDate } from "./fetch-nse.js";
import { fetchEquityList } from "./equity-list.js";
import { fetchCompanies, needsSummary, readStored, withRetry } from "./fetch-market.js";
import { buildMarketSnapshot, loadMarketSnapshot, clearSnapshotCache } from "./market-data.js";
import { fiscalYearEnds } from "./build-snapshot.js";

const STATE_PATH = join(DATA_DIR, "jobs-state.json");
const HOUR = 3600 * 1000, DAY = 24 * HOUR;
const SNAPSHOT_EVERY = 12 * HOUR;
const FILINGS_EVERY = DAY;
const HOLDING_RETRY_AFTER = 7 * DAY;
const SHP_DEADLINE_DAYS = 21; // shareholding is due 21 days after each quarter

const status = { running: null, progress: null, lastError: null };
// loadingMarket: a fresh host's first load is queued or running
export const jobStatus = () => ({ ...status, loadingMarket: pending.has("first load") });

let queue = Promise.resolve();
const pending = new Set();

function enqueue(name, fn) {
  if (pending.has(name)) return;
  pending.add(name);
  queue = queue.then(async () => {
    status.running = name;
    status.progress = null;
    try {
      await fn();
    } catch (e) {
      status.lastError = `${name}: ${e.message}`;
      console.error(`[jobs] ${name} failed: ${e.message}`);
    } finally {
      status.running = null;
      status.progress = null;
      pending.delete(name);
    }
  });
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeState(patch) {
  writeFileSync(STATE_PATH, JSON.stringify({ ...readState(), ...patch }, null, 2));
}

const companyFiles = () => (existsSync(MARKET_DIR) ? readdirSync(MARKET_DIR).filter(f => f.endsWith(".json")) : []);
const onProgress = p => { status.progress = p; };

async function fetchWhatNeedsIt() {
  const list = await withRetry(fetchEquityList);
  const todo = list.filter(s => needsSummary(s.symbol));
  if (!todo.length) return;
  console.error(`[jobs] fetching ${todo.length} companies`);
  await fetchCompanies(todo, "summary", { onProgress });
  enqueue("prices", refreshSnapshot); // fiscal year-ends to price may have changed
}

async function refreshSnapshot() {
  await buildMarketSnapshot(fiscalYearEnds());
  clearSnapshotCache();
}

// "26-Sep-2026 14:34:31" -> the day, which is all the comparison needs
const filedDay = s => parseQeDate(s)?.getTime() ?? null;

async function refreshNewFilings() {
  const state = readState();
  const checkStarted = Date.now();
  // Never checked on this disk: start from the oldest fetch on it, so nothing
  // filed since then is missed. A day's overlap covers the feed's loose order.
  const since = (state.lastFilingsCheck ? Date.parse(state.lastFilingsCheck) : oldestFetch()) - DAY;
  const symbols = new Set();
  for (let page = 1; page <= 20; page++) {
    const json = await withRetry(() => fetchJson(`${NSE_BASE}/api/integrated-filing-results?index=equities&type=Integrated%20Filing-%20Financials&page=${page}&size=500`));
    const rows = json.data ?? [];
    const fresh = rows.filter(r => r.symbol && (filedDay(r.creation_Date) ?? 0) >= since);
    fresh.forEach(r => symbols.add(r.symbol));
    if (!fresh.length || rows.length < 500) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (symbols.size) {
    const list = await withRetry(fetchEquityList);
    const bySymbol = new Map(list.map(s => [s.symbol, s]));
    const stocks = [...symbols].map(s => bySymbol.get(s)).filter(Boolean);
    console.error(`[jobs] ${stocks.length} companies filed results since ${new Date(since).toISOString().slice(0, 10)}`);
    await fetchCompanies(stocks, "summary", { onProgress });
  }
  writeState({ lastFilingsCheck: new Date(checkStarted).toISOString() });
}

function oldestFetch() {
  let oldest = Date.now();
  for (const f of companyFiles()) {
    const t = Date.parse(readStored(f.slice(0, -5))?.fetchedAt ?? "");
    if (t < oldest) oldest = t;
  }
  return oldest;
}

// The latest quarter end (31 Mar / 30 Jun / 30 Sep / 31 Dec) whose
// shareholding filing deadline has passed
export function lastDueQuarterEnd(now = new Date()) {
  const due = new Date(now.getTime() - SHP_DEADLINE_DAYS * DAY);
  for (let back = 0; back < 4; back++) {
    const monthEnd = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - back + 1, 0));
    if (monthEnd.getUTCMonth() % 3 === 2 && monthEnd <= due) return monthEnd.toISOString().slice(0, 10);
  }
}

async function refreshStaleHoldings() {
  const due = lastDueQuarterEnd();
  const retryBefore = Date.now() - HOLDING_RETRY_AFTER;
  const stale = [];
  for (const f of companyFiles()) {
    const s = readStored(f.slice(0, -5));
    if (!s || s.error || !s.holding) continue;
    const behind = !s.holding.asOfIso || s.holding.asOfIso < due;
    // A full fetch reads shareholding too, under the file's own fetchedAt
    const lastRead = Date.parse(s.holding.fetchedAt ?? s.fetchedAt ?? "");
    if (behind && !(lastRead > retryBefore)) stale.push({ symbol: s.symbol, name: s.name, isin: s.isin });
  }
  if (!stale.length) return;
  console.error(`[jobs] refreshing shareholding for ${stale.length} companies (filings due for the quarter ended ${due})`);
  await fetchCompanies(stale, "holdings", { onProgress });
}

function tick() {
  const snap = loadMarketSnapshot();
  if (!snap || Date.now() - Date.parse(snap.builtAt) > SNAPSHOT_EVERY) enqueue("prices", refreshSnapshot);
  const state = readState();
  if (!state.lastFilingsCheck || Date.now() - Date.parse(state.lastFilingsCheck) > FILINGS_EVERY) {
    enqueue("new results", refreshNewFilings);
    enqueue("shareholding", refreshStaleHoldings);
  }
}

export function startDataJobs() {
  // Prices first: a few minutes, and every screen needs them. Then any
  // companies to fetch — on an empty disk (a fresh host) the whole market,
  // which the screen announces while it runs.
  tick();
  enqueue(companyFiles().length < 100 ? "first load" : "catch-up", fetchWhatNeedsIt);
  setInterval(tick, HOUR).unref();
}
