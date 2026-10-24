import assert from "node:assert/strict";
import { profitSteps, cashSteps, cashLines, balanceParts, segmentMix, materialsOf } from "./statements.js";

const close = (a, b) => Math.abs(a - b) < 1e-6;
// A year: sales 1,000; materials 400 (with 20 of stock built up), staff 150,
// other 100, depreciation 50, interest 20 → operating profit 350
const h = {
  revenueCr: 1000, expensesCr: 720, depreciationCr: 50, financeCostsCr: 20, operatingProfitCr: 350,
  materialsCr: 380, purchasesCr: 40, inventoryChangeCr: -20, employeesCr: 150, otherExpensesCr: 100,
  otherIncomeCr: 30, exceptionalCr: -10, pbtCr: 300, taxCr: 75, profitCr: 225,
};
assert.equal(materialsOf(h), 400, "materials, goods bought and the stock change add up");
const pl = profitSteps(h);
assert.deepEqual(pl.map(s => s.label), ["Sales", "Materials & goods", "Employees", "Other expenses", "Operating profit", "Other income", "Depreciation", "Interest", "One-off & other items", "Profit before tax", "Tax", "Net profit"]);
// every run of steps lands on the next total
let at = 0;
for (const s of pl) { if (s.kind === "total") { if (at) assert.ok(close(at, s.value), `${s.label} adds up`); at = s.value; } else at += s.value; }
assert.equal(pl.find(s => s.label === "One-off & other items").value, -10, "the one-off is what's left before tax");
// without the expense lines: one operating-cost step
assert.deepEqual(profitSteps({ ...h, materialsCr: null, purchasesCr: null, inventoryChangeCr: null, employeesCr: null, otherExpensesCr: null }).slice(0, 3).map(s => s.label), ["Sales", "Operating costs", "Operating profit"]);
assert.equal(profitSteps({ revenueCr: 0, profitCr: 1 }), null, "nothing without sales");

const cf = cashSteps({ ocfCr: 300, investingCfCr: -180, financingCfCr: -90, netCashChangeCr: 35 });
assert.deepEqual(cf.map(s => [s.label, s.value]), [["From the business", 300], ["Investing", -180], ["Financing", -90], ["Other", 5], ["Change in cash", 35]]);
assert.equal(cashSteps({ ocfCr: 300 }), null, "operations alone is no picture");
assert.deepEqual(cashLines({ capexCr: 120, dividendsPaidCr: 40, borrowedCr: 0 }).map(l => l.value), [-120, -40], "payments go out; a zero line is left out");

const bs = balanceParts({ totalAssetsCr: 1000, ppeCr: 400, cwipCr: 50, inventoriesCr: 150, receivablesCr: 120, liquidCr: 80, equityCr: 600, ltDebtCr: 150, borrowingsCurrentCr: 50, payablesCr: 100 });
assert.equal(bs.owns.reduce((t, p) => t + p.value, 0), 1000, "what it owns adds up to the total");
assert.equal(bs.funded.reduce((t, p) => t + p.value, 0), 1000, "and so does how it's paid for");
assert.deepEqual(bs.owns.map(p => p.label), ["Factories & equipment", "Inventory", "Owed by customers", "Cash & liquid investments", "Other"]);
assert.equal(bs.funded.find(p => p.label === "Borrowings").value, 200);
assert.equal(balanceParts({ totalAssetsCr: 100, ppeCr: 90, inventoriesCr: 90, equityCr: 50, payablesCr: 20 }), null, "parts over the total: no picture");

const mix = segmentMix({ segmentsBy: "region", segments: [{ name: "India", revenueCr: 300 }, { name: "Outside India", revenueCr: 700, resultCr: 140 }] }, { segments: [{ name: "OUTSIDE INDIA", revenueCr: 560 }] });
assert.equal(mix.by, "region");
assert.deepEqual(mix.parts.map(p => [p.name, p.sharePct]), [["Outside India", 70], ["India", 30]]);
assert.ok(close(mix.parts[0].growthPct, 25) && mix.parts[0].marginPct === 20 && mix.parts[1].growthPct === null, "growth matched by name; margin where filed");
assert.equal(segmentMix({ segments: [{ name: "One", revenueCr: 5 }] }), null, "one segment is no mix");
console.log("All statement-picture checks passed.");

import { squarify, sourcesAndUses } from "./statements.js";
const tiles = squarify([{ value: 50 }, { value: 30 }, { value: 20 }], 200, 100);
assert.equal(tiles.length, 3);
assert.ok(tiles.every(t => close(t.w * t.h, t.value * 200)), "each tile's area is its value");
assert.ok(tiles.every(t => t.x >= -1e-9 && t.y >= -1e-9 && t.x + t.w <= 200 + 1e-6 && t.y + t.h <= 100 + 1e-6), "inside the box");
const yr = { ocfCr: 1000, investingCfCr: -500, financingCfCr: -400, netCashChangeCr: 110, capexCr: 300, assetSalesCr: 20, borrowedCr: 200, repaidCr: 100, dividendsPaidCr: 350, interestPaidCr: 50 };
const su = sourcesAndUses([yr, yr, { ...yr, ocfCr: null }], 1);
const s = side => su[side].reduce((t, l) => t + l.value, 0);
assert.ok(close(s("sources"), s("uses")), "where it came from equals where it went");
assert.deepEqual(su.uses.map(l => l.label), ["Dividends", "Factories & equipment", "Investments & acquisitions", "Added to cash", "Other financing", "Interest"], "biggest first");
assert.ok(su.sources.some(l => l.label === "New borrowing (net)" && l.value === 100) && su.sources.some(l => l.label === "Other" && close(l.value, 10)) || su.uses.some(l => l.label === "Other" && close(l.value, 10)));
assert.equal(sourcesAndUses([yr, yr, { ...yr, ocfCr: null }], 3), null, "three years need all three");
assert.equal(sourcesAndUses([yr, yr], 2).total, s("sources") * 2, "years add up");
console.log("Treemap and sources-and-uses checks passed.");
