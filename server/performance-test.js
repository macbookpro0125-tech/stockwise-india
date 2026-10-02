import assert from "node:assert/strict";
import { summarizeResearchCohort } from "./performance.js";

const records = Array.from({ length: 10 }, (_, i) => ({
  ticker: `T${i + 1}`,
  overall: (i + 1) * 10,
  close: 100,
}));
const cohort = {
  date: "2026-10-01",
  priceDate: "2026-10-01",
  scoreVersion: "1.2",
  benchmark: "Nifty 500",
  benchmarkClose: 100,
  records,
};
const market = {
  pricesDate: "2026-11-02",
  prices: Object.fromEntries(records.map((r, i) => [r.ticker, i === 9 ? 100 : 100 + (i + 1) * 10])),
  splits: { T10: [{ exDate: "2026-10-15", ratio: 2 }] },
};
delete market.prices.T1; // A missing quote must stay in the cohort denominator.

const result = summarizeResearchCohort(cohort, market, 110);
assert.equal(result.buckets.length, 5, "five score buckets are reported");
assert.deepEqual(result.buckets.map(b => b.companies), [2, 2, 2, 2, 2], "score ranks are divided into equal-sized frozen buckets");
assert.equal(result.buckets[0].priced, 1, "unpriced names remain visible in the cohort count");
assert.equal(result.buckets[0].companies, 2, "missing-price names aren't removed from the cohort denominator");
assert.equal(result.buckets[0].meanPriceReturnPct, 20, "the lower bucket uses the mean return of its priced constituent");
assert.equal(result.buckets[0].excessVsBenchmarkPct, 10, "excess return is measured against the benchmark period return");
assert.equal(result.buckets[4].meanPriceReturnPct, 95, "a post-baseline split is adjusted before calculating return");
assert.equal(result.buckets[4].scoreMin, 90, "score ranges describe the frozen bucket membership");
assert.equal(result.benchmarkReturnPct, 10, "benchmark return uses the saved and current closes");

const missingBenchmark = summarizeResearchCohort({ ...cohort, benchmarkClose: null }, market, null);
assert.equal(missingBenchmark.benchmarkReturnPct, null, "missing benchmark history is reported as unavailable");
assert.equal(missingBenchmark.buckets[0].meanPriceReturnPct, 20, "company returns remain available without a benchmark");

console.log("All prospective performance checks passed.");
