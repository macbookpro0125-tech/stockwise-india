// Fill logo gaps from the public NSE-listed-company logo index. Each downloaded
// PNG is matched to the app's NSE ISIN, and generated monogram fallbacks are
// discarded. Existing company-site images are kept as the preferred source.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, MARKET_DIR } from "../server/paths.js";
import { imageType, listedCompanyLogo, readLogo } from "../server/logos.js";

const LOGO_DIR = join(DATA_DIR, "logos");
const API = "https://api.dharun.dev/v1/companies";
const LIST_LIMIT = 100;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalName = value => String(value ?? "").toLowerCase().replace(/&/g, "and").replace(/\b(ltd|limited|co|company|the)\b/g, " ").replace(/[^a-z0-9]/g, "");
const MAX_LOGO_BYTES = 200 * 1024;

function mapLimit(items, limit, fn) {
  let next = 0;
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }));
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

async function listPage(offset) {
  const url = `${API}?exchange=nse&limit=${LIST_LIMIT}&offset=${offset}`;
  const response = await fetch(url, {
    headers: { "user-agent": "JocularInsights-logo/1.0", accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`NSE logo index: HTTP ${response.status} at offset ${offset}`);
  const body = await response.json();
  if (!Array.isArray(body?.data) || !Number.isFinite(body?.meta?.total)) throw new Error(`NSE logo index returned an invalid page at offset ${offset}`);
  return body;
}

async function readKnownPng(source, host) {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.hostname !== host) throw new Error("logo URL is not from the expected host");
  const response = await fetch(url, {
    headers: { "user-agent": "JocularInsights-logo/1.0", accept: "image/png" },
    signal: AbortSignal.timeout(12_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`logo image: HTTP ${response.status}`);
  if (new URL(response.url).origin !== `https://${host}` || !/^image\/png\b/i.test(response.headers.get("content-type") ?? "")) {
    throw new Error("logo source did not return a PNG from its expected host");
  }
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_LOGO_BYTES) throw new Error("TradingView logo is too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("TradingView returned an empty logo");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_LOGO_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error("TradingView logo is too large");
    }
    chunks.push(Buffer.from(value));
  }
  const body = Buffer.concat(chunks, size);
  if (body.length < 64 || imageType(body) !== "image/png") throw new Error("logo source returned an invalid PNG");
  return body;
}

mkdirSync(LOGO_DIR, { recursive: true });
const officialListPath = join(DATA_DIR, "equity-list-2026-09-26.csv");
const officialBySymbol = new Map();
try {
  const [, ...lines] = readFileSync(officialListPath, "utf8").trim().split(/\r?\n/);
  for (const line of lines) {
    const [symbol, name, , , , , isin] = line.split(",");
    if (symbol && name && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin ?? "")) officialBySymbol.set(symbol, { name, isin });
  }
} catch {}
const stocks = readdirSync(MARKET_DIR).filter(file => file.endsWith(".json")).map(file => {
  const symbol = file.slice(0, -5);
  const stock = readJson(join(MARKET_DIR, file));
  const name = stock?.name ?? symbol;
  const listed = officialBySymbol.get(symbol);
  const fromOfficialList = listed && normalName(listed.name) === normalName(name) ? listed.isin : "";
  return { symbol, isin: String(stock?.isin || fromOfficialList).toUpperCase(), name };
});
const needsLogo = stocks.filter(stock => {
  const imagePath = join(LOGO_DIR, `${stock.symbol}.img`);
  return !existsSync(imagePath) || !imageType(readFileSync(imagePath));
});
console.log(`Stocks: ${stocks.length}; existing image files kept: ${stocks.length - needsLogo.length}; gaps to fill: ${needsLogo.length}.`);
if (!needsLogo.length) process.exit(0);

const first = await listPage(0);
const total = first.meta.total;
const offsets = Array.from({ length: Math.ceil(total / LIST_LIMIT) }, (_, i) => i * LIST_LIMIT).slice(1);
const pages = [first, ...await Promise.all(offsets.map(offset => listPage(offset)))];
const index = new Map();
const indexByTicker = new Map();
for (const page of pages) {
  for (const company of page.data) {
    if (company?.exchange === "NSE" && company?.isin) {
      index.set(String(company.isin).toUpperCase(), company);
      if (company.ticker) indexByTicker.set(String(company.ticker).toUpperCase(), company);
    }
  }
}
console.log(`Loaded ${index.size} NSE company records from the listed-company logo index.`);

const existingLogo = new Set(stocks.filter(stock => existsSync(join(LOGO_DIR, `${stock.symbol}.img`)) && imageType(readFileSync(join(LOGO_DIR, `${stock.symbol}.img`)))).map(stock => stock.symbol));
const targets = needsLogo.filter(stock => !existingLogo.has(stock.symbol));
let nextRequestAt = 0, done = 0, downloaded = 0, noLogo = 0, notIndexed = 0, failed = 0;
async function waitForSourceSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestAt);
  nextRequestAt = slot + 140; // under 600 source requests per minute
  const delay = slot - now;
  if (delay) await pause(delay);
}
await mapLimit(targets, 8, async stock => {
  let company = stock.isin ? index.get(stock.isin) : null;
  let expectedIsin = stock.isin;
  if (!company && !stock.isin) {
    const tickerMatch = indexByTicker.get(stock.symbol);
    if (tickerMatch && normalName(tickerMatch.company) === normalName(stock.name)) {
      company = tickerMatch;
      expectedIsin = String(tickerMatch.isin).toUpperCase();
    }
  }
  const oldMeta = readJson(join(LOGO_DIR, `${stock.symbol}.json`));
  if (!company || typeof company.hasLogo !== "boolean") {
    notIndexed++;
  } else if (!company.hasLogo) {
    noLogo++;
    writeFileSync(join(LOGO_DIR, `${stock.symbol}.json`), JSON.stringify({
      at: new Date().toISOString(), miss: true, providerChecked: true,
      sourceProvider: "Indian listed company logos API", isin: expectedIsin,
      website: oldMeta?.website ?? null,
    }));
  } else {
    try {
      await waitForSourceSlot();
      const result = await listedCompanyLogo(company, expectedIsin);
      if (result.logo) {
        writeFileSync(join(LOGO_DIR, `${stock.symbol}.img`), result.logo.body);
        writeFileSync(join(LOGO_DIR, `${stock.symbol}.json`), JSON.stringify({
          at: new Date().toISOString(), type: result.logo.type, source: result.logo.source,
          sourceProvider: "Indian listed company logos API", isin: expectedIsin,
          providerTicker: company.ticker, providerName: company.company,
          website: oldMeta?.website ?? null,
        }));
        downloaded++;
      } else if (result.checked) {
        noLogo++;
        writeFileSync(join(LOGO_DIR, `${stock.symbol}.json`), JSON.stringify({
          at: new Date().toISOString(), miss: true, providerChecked: true,
          sourceProvider: "Indian listed company logos API", isin: expectedIsin,
          providerTicker: company.ticker, website: oldMeta?.website ?? null,
        }));
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      if (failed <= 8) console.warn(`[logo] ${stock.symbol} (${stock.isin}): ${error.message}`);
    }
  }
  done++;
  if (done % 100 === 0 || done === targets.length) {
    console.log(`Backfill: ${done}/${targets.length}; downloaded ${downloaded}; no provider logo ${noLogo}; not indexed ${notIndexed}; errors ${failed}.`);
  }
});

// NSE rights-entitlement tickers represent rights in the parent issuer, not a
// separate brand. Where NSE has no standalone logo record, use the already
// verified parent-company mark for these current entitlement symbols.
const rightsParents = new Map([
  ["CENTEXT-RE", "CENTEXT"],
  ["NATCO-RE", "NATCOPHARM"],
  ["OLAELEC-RE", "OLAELEC"],
]);
let inherited = 0;
for (const [symbol, parent] of rightsParents) {
  const target = join(LOGO_DIR, `${symbol}.img`);
  const parentImage = join(LOGO_DIR, `${parent}.img`);
  if (existsSync(target) || !existsSync(parentImage)) continue;
  const image = readFileSync(parentImage);
  const type = imageType(image);
  if (!type) continue;
  const parentMeta = readJson(join(LOGO_DIR, `${parent}.json`));
  copyFileSync(parentImage, target);
  writeFileSync(join(LOGO_DIR, `${symbol}.json`), JSON.stringify({
    at: new Date().toISOString(), type, source: parentMeta?.source ?? null,
    sourceProvider: "Parent company logo for NSE rights entitlement", derivedFrom: parent,
  }));
  inherited++;
}

// A few freshly listed or unindexed companies have no ISIN match yet. Use
// images from their verified official websites, or a stock-logo asset linked
// from TradingView's exact BSE:IIRM company page when the issuer site exposes
// only broken icon links.
const officialLogoSites = new Map([
  ["HDFIRE", "https://www.hdfire.com/"],
]);
let officialLogos = 0;
for (const [symbol, website] of officialLogoSites) {
  const target = join(LOGO_DIR, `${symbol}.img`);
  if (existsSync(target)) continue;
  const logo = await readLogo(website).catch(() => null);
  if (!logo) continue;
  writeFileSync(target, logo.body);
  writeFileSync(join(LOGO_DIR, `${symbol}.json`), JSON.stringify({
    at: new Date().toISOString(), type: logo.type, source: logo.source,
    sourceProvider: "Official company website", website,
  }));
  officialLogos++;
}

const knownPngLogos = [
  {
    symbol: "RAJVIR", source: "https://www.rajvirindustrieslimited.com/img/logo/logo.png",
    host: "www.rajvirindustrieslimited.com", sourceProvider: "Official company website",
    website: "https://www.rajvirindustrieslimited.com/",
  },
  {
    symbol: "IIRM", source: "https://s3-symbol-logo.tradingview.com/iirm-india-limited--600.png",
    host: "s3-symbol-logo.tradingview.com", sourceProvider: "TradingView company logo",
    sourcePage: "https://www.tradingview.com/symbols/BSE-IIRM/",
  },
];
for (const item of knownPngLogos) {
  const target = join(LOGO_DIR, `${item.symbol}.img`);
  if (existsSync(target)) continue;
  try {
    const body = await readKnownPng(item.source, item.host);
    writeFileSync(target, body);
    writeFileSync(join(LOGO_DIR, `${item.symbol}.json`), JSON.stringify({
      at: new Date().toISOString(), type: "image/png", source: item.source,
      sourcePage: item.sourcePage ?? null, sourceProvider: item.sourceProvider,
      website: item.website ?? null,
    }));
    officialLogos++;
  } catch (error) {
    console.warn(`[logo] ${item.symbol} image: ${error.message}`);
  }
}

const finalCount = stocks.filter(stock => existsSync(join(LOGO_DIR, `${stock.symbol}.img`)) && imageType(readFileSync(join(LOGO_DIR, `${stock.symbol}.img`)))).length;
console.log(`Finished: ${finalCount}/${stocks.length} stocks now have validated image files; added ${downloaded} PNGs from the listed-company source, ${inherited} parent marks for rights entitlements and ${officialLogos} official/company-source logos.`);
