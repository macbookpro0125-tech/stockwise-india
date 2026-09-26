// A random sample across the REAL market (not hand-picked large-caps) to get
// a statistically honest coverage estimate before committing to a full
// ~2,585-symbol fetch. Paced deliberately — this session already learned the
// hard way (Screener.in/Render) that bursting requests at an Indian financial
// data source gets an IP blocked; no reason to risk the same here before we
// even know if the data justifies the full build.
import { fetchEquityList } from "./equity-list.js";
import { fetchStockSummary } from "./fetch-nse.js";

const SAMPLE_SIZE = Number(process.argv[2] || 40);
const DELAY_MS = 500;

function pickSample(list, n) {
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  const list = await fetchEquityList();
  const sample = pickSample(list, SAMPLE_SIZE);

  const results = [];
  const started = Date.now();
  for (const [i, stock] of sample.entries()) {
    const t0 = Date.now();
    try {
      const summary = await fetchStockSummary(stock.symbol);
      results.push({
        symbol: stock.symbol, ok: true, ms: Date.now() - t0,
        hasRevenue: summary.pnl.revenueQuarter != null,
        hasBalanceSheet: summary.balanceSheet.netWorth != null,
        hasPromoter: summary.holding.promoterPct != null,
      });
    } catch (e) {
      results.push({ symbol: stock.symbol, ok: false, ms: Date.now() - t0, error: e.message });
    }
    process.stderr.write(`[${i + 1}/${sample.length}] ${stock.symbol} ${results.at(-1).ok ? "OK" : "FAIL: " + results.at(-1).error}\n`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  const totalMs = Date.now() - started;
  const ok = results.filter(r => r.ok);
  const fullData = ok.filter(r => r.hasRevenue && r.hasBalanceSheet && r.hasPromoter);

  console.log("\n=== Coverage summary ===");
  console.log(`Sample size: ${results.length}`);
  console.log(`Fetched successfully: ${ok.length} (${(100 * ok.length / results.length).toFixed(0)}%)`);
  console.log(`Full data (P&L + balance sheet + promoter%): ${fullData.length} (${(100 * fullData.length / results.length).toFixed(0)}%)`);
  console.log(`Avg time per symbol: ${(totalMs / results.length / 1000).toFixed(2)}s`);
  console.log(`Projected time for full market (${list.length} symbols) at this pace: ${(totalMs / results.length * list.length / 60000).toFixed(0)} minutes`);
  const failures = results.filter(r => !r.ok);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(` - ${f.symbol}: ${f.error}`);
  }
}

main();
