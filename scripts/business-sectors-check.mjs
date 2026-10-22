// How often a sector read from a company's business lines (server/
// business-sectors.js) matches NSE's own, over every company on disk that
// has both — to re-check the rules as the evening refresh reads more
// filings. Offline: reads data/market only.
//
//   node --no-warnings scripts/business-sectors-check.mjs [--wrong]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKET_DIR } from "../server/paths.js";
import { loadMarketSnapshot } from "../server/market-data.js";
import { sectorFromBusiness } from "../server/business-sectors.js";

const snap = loadMarketSnapshot();
let named = 0, right = 0, unread = 0, unclassified = 0, placed = 0;
const wrong = [];
for (const file of readdirSync(MARKET_DIR).filter(f => f.endsWith(".json"))) {
  const stock = JSON.parse(readFileSync(join(MARKET_DIR, file), "utf8"));
  if (stock.error) continue;
  if (!Array.isArray(stock.business)) { unread++; continue; }
  const nse = snap?.sectors?.[stock.symbol] ?? snap?.industrySectors?.[stock.symbol] ?? null;
  const ours = sectorFromBusiness(stock.business);
  if (!nse) { unclassified++; if (ours) placed++; continue; }
  if (!ours) continue;
  named++;
  if (ours === nse) right++;
  else wrong.push(`${stock.symbol}: "${stock.business.join("; ").slice(0, 70)}" → ${ours}, NSE: ${nse}`);
}
console.log(`Business lines read for every company but ${unread}.`);
console.log(`Where NSE has a sector: the business lines named one for ${named}, the same as NSE's for ${right}${named ? ` (${Math.round(100 * right / named)}%)` : ""}.`);
console.log(`Where NSE has none: ${placed} of ${unclassified} placed by their business lines.`);
if (process.argv.includes("--wrong")) console.log(wrong.join("\n"));
