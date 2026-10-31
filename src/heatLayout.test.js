import assert from "node:assert/strict";
import { layoutHeat, groupMove, squarify, breadth } from "./heatLayout.js";

const item = (symbol, sector, industry, weight, change) => ({ symbol, sector, industry, weight, cap: weight, change });
const items = [
  item("A", "IT", "Software", 400, 2), item("B", "IT", "Software", 200, 1), item("C", "IT", "Hardware", 100, -1),
  item("D", "Banks", "Private", 300, -2), item("E", "Banks", "Public", 100, -1), item("F", null, null, 50, 0),
];

// every box inside the map, none overlapping
const { tiles, heads } = layoutHeat(items, 800, 500);
assert.equal(tiles.length, items.length, "a box for each company");
for (const t of tiles) assert.ok(t.x >= -0.01 && t.y >= -0.01 && t.x + t.w <= 800.01 && t.y + t.h <= 500.01, `${t.symbol} inside the map`);
for (const a of tiles) for (const b of tiles) if (a !== b) {
  const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
  assert.ok(!overlap, `${a.symbol} and ${b.symbol} don't overlap`);
}
// a company's box is inside its sector's block
const sectors = heads.filter(h => h.kind === "sector");
assert.deepEqual(sectors.map(s => s.name), ["IT", "Banks", "Other"], "sectors biggest first, a missing one as Other");
for (const t of tiles) {
  const s = sectors.find(h => h.name === (t.sector || "Other"));
  assert.ok(t.x >= s.x - 0.01 && t.x + t.w <= s.x + s.w + 0.01 && t.y >= s.y + s.head - 0.01 && t.y + t.h <= s.y + s.h + 0.01, `${t.symbol} in ${s.name}, under its heading`);
}
// the sector's move is weighted by market value
assert.equal(Math.round(groupMove(items.slice(0, 3)) * 1000) / 1000, Math.round(((400 * 2 + 200 * 1 + 100 * -1) / 700) * 1000) / 1000);
assert.equal(sectors[0].change.toFixed(3), (900 / 700).toFixed(3));

// one sector, zoomed: only its companies, its industries headed
const zoom = layoutHeat(items, 800, 500, { focus: "IT" });
assert.deepEqual(zoom.tiles.map(t => t.symbol).sort(), ["A", "B", "C"]);
assert.deepEqual(zoom.heads.map(h => h.name), ["Software", "Hardware"]);

// flat: the plain treemap
assert.deepEqual(layoutHeat(items, 800, 500, { group: false }).tiles.map(t => t.w), squarify(items, 800, 500).map(t => t.w));
assert.deepEqual(layoutHeat([], 800, 500), { tiles: [], heads: [] });
// how many rose and fell, in each sector too
assert.deepEqual(breadth(items), { up: 2, down: 3, flat: 1 });
assert.deepEqual([sectors[1].up, sectors[1].down], [0, 2], "both banks fell");
console.log("heatLayout ok");
