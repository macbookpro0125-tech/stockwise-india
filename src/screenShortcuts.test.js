// A screen's signals and column sets (screenShortcuts.js)
import assert from "node:assert/strict";
import { applySignal, signalCounts, COLUMN_SETS, currentSet, listStats } from "./screenShortcuts.js";
import { DEFAULT_COLUMNS } from "./screener/meta.js";

const NOW = Date.parse("2026-10-30T07:30:00Z"); // Friday 30 Oct, 1 pm IST
const rows = [
  { symbol: "A", nextResults: "2026-10-30", cmp: 98, high52w: 100, low52w: 50 },
  { symbol: "B", nextResults: "2026-11-05", cmp: 52, high52w: 100, low52w: 50 },
  { symbol: "C", nextResults: "2026-11-06", cmp: 70, high52w: 100, low52w: 50 },
  { symbol: "D", nextResults: "2026-10-29", cmp: null, high52w: 100, low52w: 50 },
];
assert.deepEqual(applySignal(rows, "results", NOW).map(r => r.symbol), ["A", "B"], "results from today to six days on");
assert.deepEqual(applySignal(rows, "nearHigh", NOW).map(r => r.symbol), ["A"], "within 5% of the 52-week high");
assert.deepEqual(applySignal(rows, "nearLow", NOW).map(r => r.symbol), ["B"], "within 5% of the 52-week low; no price, no signal");
assert.equal(applySignal(rows, null, NOW), rows, "no signal: every row");
assert.deepEqual(signalCounts(rows, NOW), { results: 2, nearHigh: 1, nearLow: 1 });
assert.equal(COLUMN_SETS[0].columns, DEFAULT_COLUMNS, "Overview is the table's usual columns");
assert.equal(currentSet(["roce", "roe", "opm", "debtToEquity", "piotroski", "profitGrowth5y"]), "quality");
assert.equal(currentSet(["pe", "roce"]), null, "a hand-picked mix is no set");
const st = listStats([{ research: { quality: 80 }, peTtm: 20, roce: 30, cmp: 90, fv25: 100 }, { research: { quality: 60 }, pe: -5, roce: 10, cmp: 120, fv25: 100 }, { research: null, peTtm: 30, roce: null }]);
assert.deepEqual(st, { count: 3, quality: 70, pe: 25, roce: 20, belowFair: 1, valued: 2 }, "middle values skip gaps and losses; below fair value counts the valued only");
console.log("screenShortcuts tests passed");
