// Financial health figures (healthMath.js): node src/healthMath.test.js
import assert from "node:assert/strict";
import { healthFigures } from "./healthMath.js";

const near = (a, b) => a != null && Math.abs(a - b) < 0.01;
// newest first, as the company endpoint sends m.history
const year = (fyEnd, o) => ({ fyEnd, equityCr: null, debtCr: null, leasesCr: null, liquidCr: null, totalAssetsCr: null, currentAssetsCr: null, currentLiabilitiesCr: null, ocfCr: null, fcfCr: null, financeCostsCr: null, pbtCr: null, debtToEquity: null, ...o });

{
  // TCS's FY26 as filed: no borrowings, ₹11,283 Cr of leases, lots of cash
  const h = [
    year("2026-03-31", { equityCr: 108478, debtCr: 0, leasesCr: 11283, liquidCr: 46678, totalAssetsCr: 182372, currentAssetsCr: 135705, currentLiabilitiesCr: 60914, ocfCr: 52094, fcfCr: 48016, financeCostsCr: 1227, pbtCr: 65487, debtToEquity: 0.104 }),
    year("2025-03-31", { debtCr: 0, equityCr: 95771, debtToEquity: 0 }),
    year("2019-03-31", {}),
  ];
  const f = healthFigures(h);
  assert.equal(f.fyEnd, "2026-03-31");
  assert.ok(near(f.shortTerm.cover, 135705 / 60914));
  assert.equal(f.longTerm.liabilities, 182372 - 108478 - 60914);
  assert.ok(near(f.longTerm.cover, 135705 / 12980));
  assert.deepEqual(f.debt, { borrowings: 0, leases: 11283, total: 11283, cash: 46678, net: 11283 - 46678 });
  assert.ok(near(f.ocfToDebt, (52094 / 11283) * 100));
  assert.ok(near(f.interestCover, (65487 + 1227) / 1227));
  assert.equal(f.runway, null, "free cash flow positive: no runway to count");
  // Older years' filings carry no lease figures, so the yearly chart is
  // borrowings to equity throughout; the latest with leases is given apart
  assert.deepEqual(f.deHistory, [{ fy: "2025-03-31", de: 0 }, { fy: "2026-03-31", de: 0 }], "borrowings to equity, oldest first, years without figures left out");
  assert.equal(f.deWithLeases, 0.104);
  console.log("ok: short- and long-term cover, debt and cash, debt cover and the D/E history");
}
{
  // Swiggy's FY26: burning cash
  const f = healthFigures([year("2026-03-31", { equityCr: 18314, debtCr: 100, leasesCr: 2451, liquidCr: 7312, totalAssetsCr: 25237, currentAssetsCr: 16327, currentLiabilitiesCr: 4877, ocfCr: -2898, fcfCr: -3817, financeCostsCr: 200, pbtCr: -4150, debtToEquity: 0.139 })]);
  assert.ok(near(f.runway.years, 7312 / 3817));
  assert.equal(f.runway.burn, 3817);
  assert.equal(f.interestCover, null, "a loss before interest covers nothing");
  assert.equal(f.ocfToDebt, null, "negative operating cash flow repays nothing");
  console.log("ok: a loss-maker's cash runway at last year's burn");
  // L&T-like: borrowings each year, leases only in the latest filing
  const lt = healthFigures([
    year("2026-03-31", { equityCr: 128530, debtCr: 121683, leasesCr: 3814, totalAssetsCr: 452550, currentAssetsCr: 292841, currentLiabilitiesCr: 233531, debtToEquity: 0.976 }),
    year("2024-03-31", { equityCr: 102550, debtCr: 114040, leasesCr: null, debtToEquity: 1.112 }),
  ]);
  assert.ok(near(lt.deHistory[0].de, 114040 / 102550) && near(lt.deHistory[1].de, 121683 / 128530));
  assert.equal(lt.deWithLeases, 0.976);
  console.log("ok: the yearly chart compares like with like when leases are only in the latest filing");
}
{
  assert.equal(healthFigures([]), null);
  assert.equal(healthFigures([year("2026-03-31", { profitCr: 5 })]), null, "no balance sheet filed: nothing to show");
  const noDebt = healthFigures([year("2026-03-31", { equityCr: 100, debtCr: 0, leasesCr: 0, liquidCr: 20, totalAssetsCr: 150, currentAssetsCr: 80, currentLiabilitiesCr: 40, ocfCr: 30, fcfCr: 20, financeCostsCr: 0, pbtCr: 25 })]);
  assert.equal(noDebt.ocfToDebt, null, "no debt to cover");
  assert.equal(noDebt.interestCover, null, "no interest to cover");
  assert.equal(noDebt.debt.total, 0);
  console.log("ok: no balance sheet is nothing; no debt has nothing to cover");
}
