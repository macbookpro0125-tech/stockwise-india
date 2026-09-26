// The actual screening layer on top of the NSE spine — reads whatever's been
// fetched into data/market/ so far (works fine mid-fetch, no need to wait for
// the full market) and applies threshold filters, same shape as
// stock-screener's presets. Only ROE / Debt-to-Equity / Promoter% exist yet —
// OPM, ROCE, Pledged%, P/E aren't computed by fetch-nse.js yet, so filters
// here are honestly scoped to what's actually available, not the full preset.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MARKET_DIR = join(__dirname, "..", "data", "market");
const STALE_AFTER_DAYS = 550; // ~18 months — a healthy company files annually

function parseNseDate(d) {
  return d ? new Date(d.replace(/-(\w{3})-/, " $1 ")) : null; // "31-Mar-2024" -> Date
}

export function loadMarket() {
  const all = readdirSync(MARKET_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(readFileSync(join(MARKET_DIR, f), "utf-8")))
    .filter(d => !d.error && d.roe != null && d.debtToEquity != null && d.holding?.promoterPct != null);

  // Staleness relative to the newest filing actually seen in this dataset,
  // not an absolute clock — correct in any environment, including one whose
  // wall clock has drifted from what the real internet's data reflects.
  const newest = Math.max(...all.map(d => parseNseDate(d.balanceSheet.yearEnded)?.getTime() ?? 0));
  return all.filter(d => {
    const age = newest - (parseNseDate(d.balanceSheet.yearEnded)?.getTime() ?? 0);
    return age <= STALE_AFTER_DAYS * 86400000;
  });
}

export function screen(stocks, criteria) {
  return stocks.filter(s => {
    if (criteria.minRoe != null && s.roe * 100 < criteria.minRoe) return false;
    if (criteria.maxDebtToEquity != null && s.debtToEquity > criteria.maxDebtToEquity) return false;
    if (criteria.minPromoterPct != null && s.holding.promoterPct < criteria.minPromoterPct) return false;
    return true;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = loadMarket();
  console.log(`${all.length} companies with usable ROE + Debt-to-Equity + Promoter% data`);

  const criteria = { minRoe: 18, maxDebtToEquity: 0.3, minPromoterPct: 40 };
  const matches = screen(all, criteria).sort((a, b) => b.roe - a.roe);
  console.log(`\n${matches.length} match: ROE>${criteria.minRoe}%, D/E<${criteria.maxDebtToEquity}, Promoter>${criteria.minPromoterPct}%\n`);
  for (const m of matches.slice(0, 25)) {
    console.log(
      `${m.symbol.padEnd(15)} ROE=${(m.roe * 100).toFixed(1).padStart(6)}%  D/E=${m.debtToEquity.toFixed(2).padStart(5)}  Promoter=${String(m.holding.promoterPct).padStart(5)}%  ${m.name}`
    );
  }
}
