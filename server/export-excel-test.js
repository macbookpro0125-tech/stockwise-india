// Discover's Excel download (src/exportExcel.js): the categorized sheet's
// buckets and risk tiers, the four sheets in order, frozen headers, and the
// app's wording ("Price position", never "buy").
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { bucketOf, riskTier, writeDiscoverWorkbook } from "../src/exportExcel.js";

const XLSX = createRequire(import.meta.url)("xlsx-js-style");

const row = (symbol, o = {}) => ({
  symbol, name: `${symbol} Limited`, sector: "Capital Goods", cmp: 100, pe: 20, roce: 25, roe: 20, debtToEquity: 0.1,
  salesGrowth3y: 12, marketCapCr: 5000, promoterPct: 55, safeBuyPrice: 110, p2: 99, p3: 88, stopLoss: 70, target: 180, fv25: 122, fairValue: 150,
  piotroski: 7, research: { quality: 80, overall: 75, valuation: 60, risk: 20, flags: [] }, ...o,
});

// The first rule a company meets decides
assert.equal(bucketOf(row("A")), "core");
assert.equal(bucketOf(row("B", { research: { quality: null } })), "unrated");
assert.equal(bucketOf(row("C", { research: { quality: 80, risk: 55 } })), "speculative", "Elevated risk");
assert.equal(bucketOf(row("D", { salesGrowth3y: 140 })), "speculative", "growth over 100% is a small base or a one-off");
assert.equal(bucketOf(row("E", { research: { quality: 45, risk: 20 } })), "weak", "low quality isn't a growth or value pick");
assert.equal(bucketOf(row("F", { salesGrowth3y: 25 })), "growth");
assert.equal(bucketOf(row("G", { pe: 11 })), "value");
assert.equal(bucketOf(row("H", { cmp: 90, research: { quality: 80, valuation: 85, risk: 20 } })), "value", "valuation 80+ and 15%+ under P1");
assert.equal(bucketOf(row("I", { research: { quality: 60, risk: 20 } })), "steady");
// The company page's own risk bands
assert.deepEqual([10, 25, 49.9, 50, 74.9, 75].map(riskTier), ["Low", "Moderate", "Moderate", "Elevated", "Elevated", "High"]);

const stocks = [row("CORE1"), row("GROW1", { salesGrowth3y: 30 }), row("CORE2", { cmp: 80 }), row("NEW1", { research: { quality: null } })];
const bytes = writeDiscoverWorkbook(XLSX, stocks, { pricesDate: "2026-10-08", screen: "Quality score ≥ 70", sortLabel: "Research score, highest first" });
const wb = XLSX.read(new Uint8Array(bytes), { type: "array" });
assert.deepEqual(wb.SheetNames, ["Categorized", "How to read", "Dashboard", "Stocks"]);
const cat = XLSX.utils.sheet_to_json(wb.Sheets.Categorized, { header: 1, defval: null });
assert.match(cat[0][0], /4 COMPANIES, CATEGORIZED/);
assert.match(cat[1][0], /Quality score ≥ 70/, "the note names the screen");
assert.equal(cat[3][15], "Price position");
assert.ok(!cat.flat().some(v => typeof v === "string" && /\bbuy status\b|\baccumulate\b/i.test(v)), "no buy wording");
const buckets = cat.filter(r => r[0] && typeof r[0] === "string" && /\(\d+ stocks?\)/.test(r[0])).map(r => r[0].trim());
assert.deepEqual(buckets, ["CORE COMPOUNDER   (2 stocks)", "HIGH-GROWTH   (1 stock)", "NOT RATED — TOO FEW FILINGS   (1 stock)"]);
// Ranks follow the order sorted on screen, kept within each bucket
const ranks = cat.filter(r => typeof r[0] === "number").map(r => [r[0], r[2]]);
assert.deepEqual(ranks, [[1, "CORE1"], [3, "CORE2"], [2, "GROW1"], [4, "NEW1"]]);
const core2 = cat.find(r => r[2] === "CORE2");
assert.equal(core2[15], "At or below reference level 3", "the app's own price position");
assert.equal(core2[14], -27.27, "% vs P1");

// Frozen headers: the library writes no panes, so they're added to the file
const zip = XLSX.CFB.read(new Uint8Array(bytes), { type: "array" });
const sheetXml = n => new TextDecoder().decode(zip.FileIndex[zip.FullPaths.findIndex(p => p.endsWith(`xl/worksheets/sheet${n}.xml`))].content);
assert.match(sheetXml(1), /<pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"\/>/);
assert.match(sheetXml(4), /<pane ySplit="1" topLeftCell="A2"/);
console.log("All Excel export checks passed.");
