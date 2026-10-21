// Fill the on-disk logo cache from the latest public NSE BRSR filings.
// Company URLs come from the companies' own filings; logos are fetched and
// validated by the same bounded, public-address-only reader as the API.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, MARKET_DIR } from "../server/paths.js";
import { NSE_BASE, fetchJson, fetchXbrl } from "../server/fetch-nse.js";
import { brsrProfile } from "../server/company-extras.js";
import { readLogo } from "../server/logos.js";

const LOGO_DIR = join(DATA_DIR, "logos");
const INDEX_URL = `${NSE_BASE}/api/corporate-bussiness-sustainabilitiy?index=equities`;
const ARCHIVE = /^https:\/\/nsearchives\.nseindia\.com\//;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function mapLimit(items, limit, fn) {
  let next = 0;
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }));
}

function metadata(symbol) {
  try { return JSON.parse(readFileSync(join(LOGO_DIR, `${symbol}.json`), "utf8")); }
  catch { return null; }
}

function latestBySymbol(rows) {
  const latest = new Map();
  for (const row of rows) {
    if (!row?.symbol || !ARCHIVE.test(row.xbrlFile ?? "")) continue;
    const prior = latest.get(row.symbol);
    const date = `${Number(row.fyTo) || 0}:${Date.parse(row.submissionDate) || 0}`;
    const priorDate = prior ? `${Number(prior.fyTo) || 0}:${Date.parse(prior.submissionDate) || 0}` : "";
    if (!prior || date > priorDate) latest.set(row.symbol, row);
  }
  return latest;
}

mkdirSync(LOGO_DIR, { recursive: true });
const symbols = readdirSync(MARKET_DIR).filter(name => name.endsWith(".json")).map(name => name.slice(0, -5));
const candidates = symbols.filter(symbol => {
  const meta = metadata(symbol);
  return !meta?.type || !existsSync(join(LOGO_DIR, `${symbol}.img`));
});
const retrying = candidates.filter(symbol => metadata(symbol)?.miss).length;
console.log(`Stocks: ${symbols.length}; logos already cached: ${symbols.length - candidates.length}; missing to check: ${candidates.length}; retrying earlier misses: ${retrying}.`);

const response = await fetchJson(INDEX_URL);
const rows = Array.isArray(response) ? response : response?.data ?? [];
const filings = latestBySymbol(rows);
const websites = new Map();
let filingDone = 0, filingFailed = 0;
const needFiling = candidates.filter(symbol => !metadata(symbol)?.website && filings.has(symbol));
console.log(`Latest NSE filings available for ${filings.size} symbols; reading ${needFiling.length} filing profiles (2 at a time).`);

await mapLimit(needFiling, 2, async (symbol, index) => {
  try {
    const xml = await fetchXbrl(filings.get(symbol).xbrlFile);
    const website = brsrProfile(xml).website;
    if (website) websites.set(symbol, website);
  } catch (error) {
    filingFailed++;
    if (filingFailed <= 8) console.warn(`[filing] ${symbol}: ${error.message}`);
  } finally {
    filingDone++;
    if (filingDone % 50 === 0 || filingDone === needFiling.length) {
      console.log(`Filing profiles: ${filingDone}/${needFiling.length}; websites found ${websites.size}; failures ${filingFailed}.`);
    }
  }
});

// Previously stored official website URLs let known misses retry even if
// their latest filing is absent from the current index.
for (const symbol of candidates) {
  const website = metadata(symbol)?.website || websites.get(symbol);
  if (website) websites.set(symbol, website);
}

const targets = [...websites.entries()];
let done = 0, saved = 0, missed = 0;
console.log(`Checking ${targets.length} official company websites for compatible icons (at most three sites at once).`);
await mapLimit(targets, 3, async ([symbol, website]) => {
  const old = metadata(symbol);
  if (old?.miss) {
    try { unlinkSync(join(LOGO_DIR, `${symbol}.json`)); } catch {}
  }
  let logo = null;
  try { logo = await readLogo(website); } catch {}
  if (logo) {
    writeFileSync(join(LOGO_DIR, `${symbol}.img`), logo.body);
    writeFileSync(join(LOGO_DIR, `${symbol}.json`), JSON.stringify({ at: new Date().toISOString(), type: logo.type, source: logo.source, website }));
    saved++;
  } else {
    try { unlinkSync(join(LOGO_DIR, `${symbol}.img`)); } catch {}
    writeFileSync(join(LOGO_DIR, `${symbol}.json`), JSON.stringify({ at: new Date().toISOString(), miss: true, website }));
    missed++;
  }
  done++;
  if (done % 25 === 0 || done === targets.length) {
    console.log(`Company sites: ${done}/${targets.length}; downloaded ${saved}; no compatible icon ${missed}.`);
  }
  // These are separate company domains; a small pause plus a three-site cap
  // avoids a burst against any one upstream.
  await pause(250);
});

const noWebsite = candidates.filter(symbol => !websites.has(symbol)).length;
console.log(`Finished. Downloaded ${saved} logos; ${missed} company sites had no compatible icon; ${noWebsite} stocks had no website in the available BRSR filings.`);
