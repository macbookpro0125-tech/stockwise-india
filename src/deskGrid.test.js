// Run: node src/deskGrid.test.js
import assert from "node:assert/strict";
import { compact, placeNew, fromOld, clampCard, COLS } from "./deskGrid.js";

const noOverlap = cards => cards.every((a, i) => cards.every((b, j) => i === j || !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)));

// cards float up to close a gap
const floated = compact([{ id: "a", kind: "notes", x: 0, y: 5, w: 4, h: 3 }, { id: "b", kind: "notes", x: 4, y: 9, w: 4, h: 3 }]);
assert.deepEqual(floated.map(c => c.y), [0, 0]);
console.log("ok: cards float up to close gaps");

// a card dropped on another keeps its place; the other makes room under it
const dropped = compact([{ id: "a", kind: "notes", x: 0, y: 0, w: 6, h: 4 }, { id: "b", kind: "notes", x: 2, y: 1, w: 6, h: 4 }], "b");
assert.equal(dropped[1].y, 1, "the dragged card stays where it was dropped");
assert.equal(dropped[0].y, 5, "the one it lands on moves below it");
assert.ok(noOverlap(compact([{ id: "a", kind: "notes", x: 0, y: 0, w: 6, h: 4 }, { id: "b", kind: "notes", x: 2, y: 0, w: 6, h: 4 }], "b")));
const pushed = compact([{ id: "a", kind: "notes", x: 0, y: 0, w: 6, h: 4 }, { id: "b", kind: "notes", x: 2, y: 0, w: 6, h: 4 }], "b");
assert.deepEqual([pushed[1].y, pushed[0].y], [0, 4], "dropped on top: the other moves below it");
console.log("ok: the dragged card keeps its place; the others make room");

// a new card goes in the first gap that fits
const gap = placeNew([{ id: "a", kind: "notes", x: 0, y: 0, w: 8, h: 4 }], { id: "n", kind: "notes", w: 4, h: 4 });
assert.deepEqual([gap.x, gap.y], [8, 0]);
console.log("ok: a new card takes the first gap");

// sizes stay inside the grid and above each kind's smallest
const c = clampCard({ id: "c", kind: "chart", x: 11, y: -3, w: 1, h: 2 });
assert.ok(c.w >= 4 && c.h >= 12 && c.x + c.w <= COLS && c.y === 0);
console.log("ok: sizes stay in the grid and above the smallest");

// the earlier layouts (w 1–3 in reading order) are laid out in the grid
const old = fromOld([{ id: "m", kind: "mood", w: 3 }, { id: "l", kind: "list", w: 1 }, { id: "ch", kind: "chart", w: 2 }]);
assert.deepEqual(old.map(c => [c.x, c.y, c.w]), [[0, 0, 12], [0, 4, 4], [4, 4, 8]]);
assert.ok(noOverlap(old));
console.log("ok: earlier layouts move into the grid");
