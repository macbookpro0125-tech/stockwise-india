// Sector rotation and market health (explore.js, 17 Nov 2026)
import assert from "node:assert/strict";
import { rotationQuadrant, rotationOf, healthOf } from "./explore.js";

assert.equal(rotationQuadrant(2, 1), "leading");
assert.equal(rotationQuadrant(2, -1), "fading");
assert.equal(rotationQuadrant(-2, 1), "improving");
assert.equal(rotationQuadrant(-2, -1), "lagging");
assert.equal(rotationQuadrant(null, 1), null);

// 100 days: the NIFTY flat, one sector rising steadily, one falling
const days = Array.from({ length: 100 }, (_, i) => `d${String(i).padStart(3, "0")}`);
const board = { days, indices: [
  { name: "Nifty 50", group: "market", closes: days.map(() => 100) },
  { name: "Nifty Up", group: "sector", closes: days.map((_, i) => 100 + i) },
  { name: "Nifty Down", group: "sector", closes: days.map((_, i) => 200 - i) },
] };
const r = rotationOf(board);
assert.equal(r.sectors.find(s => s.name === "Nifty Up").quadrant, "leading");
assert.equal(r.sectors.find(s => s.name === "Nifty Down").quadrant, "lagging");
assert.equal(r.sectors[0].trail.length, 5);
assert.equal(rotationOf({ days, indices: [] }), null);

// health: the trend line's two shares, and two from the same companies
const rows = [
  { symbol: "A", ret1m: 5, downFrom52wHigh: 2, upFrom52wLow: 40 },
  { symbol: "B", ret1m: -3, downFrom52wHigh: 30, upFrom52wLow: 1 },
  { symbol: "C", ret1m: 1, downFrom52wHigh: 20, upFrom52wLow: 20 },
  { symbol: "D", ret1m: 9, downFrom52wHigh: 1, upFrom52wLow: 80 }, // not traded enough: left out
];
const desk = { liquid: 3, above50: 60, above200: 40, bySymbol: { A: { liquid: true }, B: { liquid: true }, C: { liquid: true }, D: {} } };
const h = healthOf(rows, desk);
assert.deepEqual(h.parts.map(p => Math.round(p.pct)), [40, 60, 67, 50]);
assert.equal(h.score, 54);
assert.equal(h.word, "Mixed");
assert.equal(healthOf(rows, null), null);
console.log("rotation and health tests passed");
