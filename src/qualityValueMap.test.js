// The screen's chart: its corners, any two scores, and a box drawn on it (QualityValueMap.jsx)
import assert from "node:assert/strict";
import { mapPoints, inBox, bestZone, zoneLabel, zoneTone, axisById } from "./qualityValueMap.js";

const row = (symbol, pe, quality, cap = 100, extra = {}) => ({ symbol, name: symbol, peTtm: pe, research: quality == null ? null : { quality, ...extra }, marketCapCr: cap });
const { points, left, xMid, yMid } = mapPoints([row("A", 10, 90), row("B", 40, 90), row("C", 12, 60), row("D", 50, 55), row("E", 20, 75), row("LOSS", null, 80), row("NOSCORE", 15, null)]);
assert.equal(points.length, 5);
assert.equal(left, 2, "a loss-maker and an unscored company are counted, not drawn");
assert.equal(xMid, 20);
assert.equal(yMid, 75);
const zone = s => points.find(p => p.symbol === s).zone;
assert.deepEqual(["A", "B", "C", "D", "E"].map(zone), ["hl", "hh", "ll", "lh", "hl"], "corners against this list's middle values; the middle itself counts as higher quality, lower P/E");
assert.equal(mapPoints([row("A", 10, 90), row("B", 20, 80)]).points.length, 0, "fewer than three: no chart");

// any two: growth up, risk across
const g = mapPoints([row("A", 10, 80, 1, { groups: { growth: 70 }, risk: 20 }), row("B", 10, 80, 1, { groups: { growth: 40 }, risk: 60 }), row("C", 10, 80, 1, { groups: { growth: 55 }, risk: 30 }), row("D", 10, 80, 1, { risk: 10 })], "growth", "risk");
assert.equal(g.points.length, 3, "a company without a growth score is left out");
assert.equal(g.left, 1);
const growth = axisById("growth"), risk = axisById("risk"), quality = axisById("quality"), pe = axisById("pe");
assert.equal(bestZone(growth, risk), "hl", "higher growth, lower risk is the good corner");
assert.equal(bestZone(quality, axisById("overall")), "hh", "two scores: both higher");
assert.equal(zoneLabel("hl", quality, pe), "Higher quality, lower P/E");
assert.equal(zoneTone("hl", quality, pe), 2);
assert.equal(zoneTone("lh", quality, pe), -2);

// a box: between quality 70 and 95, P/E 5 to 25 (drawn from either corner)
assert.deepEqual(inBox(points, { x0: 25, x1: 5, y0: 95, y1: 70 }).map(p => p.symbol), ["A", "E"]);
assert.deepEqual(inBox(points, null), []);
console.log("qualityValueMap tests passed");
