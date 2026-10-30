// The quality-against-P/E chart's corners (QualityValueMap.jsx)
import assert from "node:assert/strict";
import { mapPoints } from "./qualityValueMap.js";

const row = (symbol, pe, quality, cap = 100) => ({ symbol, name: symbol, peTtm: pe, research: quality == null ? null : { quality }, marketCapCr: cap });
const { points, left, peMid, qMid } = mapPoints([row("A", 10, 90), row("B", 40, 90), row("C", 12, 60), row("D", 50, 55), row("E", 20, 75), row("LOSS", null, 80), row("NOSCORE", 15, null)]);
assert.equal(points.length, 5);
assert.equal(left, 2, "a loss-maker and an unscored company are counted, not drawn");
assert.equal(peMid, 20);
assert.equal(qMid, 75);
const zone = s => points.find(p => p.symbol === s).zone;
assert.deepEqual(["A", "B", "C", "D", "E"].map(zone), ["hl", "hh", "ll", "lh", "hl"], "corners against this list's middle values; the middle itself counts as higher quality, lower P/E");
assert.equal(mapPoints([row("A", 10, 90), row("B", 20, 80)]).points.length, 0, "fewer than three: no chart");
console.log("qualityValueMap tests passed");
