// A company's dividend record (dividends.js): node server/dividends-test.js
import assert from "node:assert/strict";
import { fyOf, dividendRecord } from "./dividends.js";

assert.equal(fyOf("2026-03-31"), 2026);
assert.equal(fyOf("2026-04-01"), 2027);
console.log("ok: an Indian financial year runs April to March, named by the year it ends");

{
  // ₹10 paid before a 1:1 bonus (shares ×2) is ₹5 a share on today's count
  const r = dividendRecord({
    history: [{ exDate: "2023-07-10", amount: 10 }, { exDate: "2024-07-10", amount: 6 }],
    splits: [{ exDate: "2024-01-15", ratio: 2 }],
    today: "2026-10-20",
  });
  const fy24 = r.byYear.find(y => y.fy === 2024), fy25 = r.byYear.find(y => y.fy === 2025);
  assert.equal(fy24.regular, 5, "split-adjusted to today's shares");
  assert.equal(fy25.regular, 6);
  console.log("ok: dividends before a split or bonus are on today's share count");
}
{
  // Six years back from 20 Oct 2026 reaches 22 Oct 2020: FY21 is only part
  // covered and left out; FY22–FY26 are whole; FY27 is this year, so far
  const history = [
    { exDate: "2021-06-01", amount: 4 },                        // FY22
    { exDate: "2022-06-01", amount: 5 },                        // FY23
    { exDate: "2023-06-01", amount: 3 }, { exDate: "2023-11-01", amount: 2 }, // FY24: 5 in two parts
    { exDate: "2024-06-01", amount: 3 },                        // FY25: a cut
    { exDate: "2025-06-01", amount: 4 }, { exDate: "2025-06-01", amount: 2, special: true }, // FY26: 4 + a special 2
    { exDate: "2026-07-01", amount: 4.5 },                      // FY27 so far
  ];
  const r = dividendRecord({ history, splits: [], today: "2026-10-20" });
  assert.deepEqual(r.byYear.map(y => y.fy), [2022, 2023, 2024, 2025, 2026, 2027]);
  assert.deepEqual(r.byYear.map(y => y.regular), [4, 5, 5, 3, 4, 4.5]);
  assert.equal(r.byYear.at(-2).special, 2);
  assert.equal(r.byYear.at(-1).partial, true);
  assert.equal(r.byYear[0].partial, false);
  assert.deepEqual(r.track, { years: 5, paid: 5, raised: 2, held: 1, cut: 1, cuts: [2025] });
  console.log("ok: whole years only, specials apart; raised, held and cut counted on regular dividends");
}
{
  // A year without a dividend is a year it didn't pay, and the next is a cut
  const r = dividendRecord({ history: [{ exDate: "2022-06-01", amount: 2 }, { exDate: "2024-06-01", amount: 2 }], splits: [], today: "2026-10-20" });
  assert.deepEqual(r.byYear.map(y => [y.fy, y.regular]), [[2022, 0], [2023, 2], [2024, 0], [2025, 2], [2026, 0], [2027, 0]]);
  assert.equal(r.track.paid, 2);
  assert.deepEqual(r.track.cuts, [2024, 2026]);
  console.log("ok: years without a dividend show as none paid");
}
{
  assert.equal(dividendRecord({ history: [], splits: [], today: "2026-10-20" }).track.paid, 0);
  assert.equal(dividendRecord({ history: null, splits: null, today: "2026-10-20" }), null, "no history read: unknown, not 'never paid'");
  console.log("ok: no dividends is zero paid; no history at all is unknown");
}
{
  const { dividendParts } = await import("./market-data.js");
  assert.deepEqual(dividendParts("Dividend - Rs 5 Per Share/Special Dividend - Re 0.50 Per Share"), { regular: 5, special: 0.5 });
  assert.deepEqual(dividendParts("Final Dividend - Rs 8 Per Share / Special Dividend - Rs 3 Per Share"), { regular: 8, special: 3 });
  assert.deepEqual(dividendParts("Special Dividend - Rs 3 Per Share"), { regular: 0, special: 3 });
  assert.deepEqual(dividendParts("Interim Dividend - Rs 12 Per Share"), { regular: 12, special: 0 });
  assert.deepEqual(dividendParts("Interim Dividend - Rs 10 Per Share And Special Dividend - Rs 66 Per Share"), { regular: 10, special: 66 });
  assert.deepEqual(dividendParts("Interim Dividend - Rs 10 Per Share Special Dividend - Rs 66 Per Share"), { regular: 10, special: 66 }, "NSE's wording for TCS, Jan 2025");
  assert.deepEqual(dividendParts("Interim Dividend Rs 11 Per Share/ Special Dividend Rs 46 Per Share"), { regular: 11, special: 46 });
  assert.deepEqual(dividendParts("Bonus 1:1"), { regular: 0, special: 0 });
  console.log("ok: a corporate action's dividend is split into its ordinary and special parts");
}
