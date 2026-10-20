// The strategy list and "about" panel on Discover (strategyAbout.js):
// node src/strategyAbout.test.js
import assert from "node:assert/strict";
import { groupStrategies, describeRules } from "./strategyAbout.js";

const presets = [
  { id: "high_quality_compounders", name: "High Quality Compounders" },
  { id: "dividend_aristocrats", name: "Dividend Aristocrats" },
  { id: "sound_banks", name: "Sound Banks" },
  { id: "momentum_growth", name: "Momentum Growth" },
  { id: "s-1", name: "My banks", custom: true },
  { id: "mystery", name: "Something new" },
];
{
  const groups = groupStrategies(presets);
  assert.deepEqual(groups.map(g => g.label), ["Quality & growth", "Income & safety", "Momentum", "Other", "Yours"], "by kind, in the grid's order, empty kinds left out; yours last");
  assert.deepEqual(groups[0].items.map(p => p.id), ["high_quality_compounders", "sound_banks"]);
  assert.deepEqual(groups.at(-1).items.map(p => p.name), ["My banks"]);
  console.log("ok: every strategy listed under its kind, yours last");
}
{
  const meta = { byId: new Map([
    ["roeAvg", { label: "ROE, 5-year average", short: "ROE 5Y", unit: "%", about: "ROE averaged over up to five years." }],
    ["debtToEquity", { label: "Debt to equity", short: "D/E", unit: "x", about: "Borrowings plus lease liabilities ÷ equity." }],
    ["marketCapCr", { label: "Market cap", short: "Mkt cap", unit: "₹ Cr" }],
    ["sector", { label: "Sector" }],
  ]) };
  const rules = describeRules([
    { id: "roeAvg", min: 18, max: null },
    { id: "debtToEquity", min: null, max: 0.3 },
    { id: "marketCapCr", min: 500, max: 20000 },
    { id: "sector", values: ["Banks"] },
    { id: "roeAvg", min: null, max: null },
    { id: "unknown", min: 1 },
  ], meta);
  assert.deepEqual(rules.map(r => r.text), ["ROE, 5-year average at least 18%", "Debt to equity at most 0.3×", "Market cap between ₹500 Cr and ₹20,000 Cr", "Sector: Banks"]);
  assert.equal(rules[0].about, "ROE averaged over up to five years.", "each rule says what its measure means");
  assert.equal(rules[2].about, null, "or nothing, where the catalogue has no note");
  console.log("ok: each rule in plain words, with what the measure means; empty and unknown rules left out");
}
