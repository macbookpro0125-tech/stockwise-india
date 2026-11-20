// "My order" on the Watchlist (watchOrder.js)
import assert from "node:assert/strict";
import { mineOrder, moved, dropIndex } from "./watchOrder.js";

const items = [
  { ticker: "A", position: 2, addedAt: "2026-01-01" },
  { ticker: "B", position: 1, addedAt: "2026-01-02" },
  { ticker: "NEW", position: null, addedAt: "2026-11-20" },
  { ticker: "OLDNEW", position: null, addedAt: "2026-11-01" },
];
assert.deepEqual(mineOrder(items).map(i => i.ticker), ["NEW", "OLDNEW", "B", "A"], "new ones first, then the dragged order");
assert.deepEqual(mineOrder(items, ["A", "NEW", "B"]).map(i => i.ticker).filter(t => t !== "OLDNEW"), ["A", "NEW", "B"], "a list keeps its own order");
console.log("ok: the order shown");

assert.deepEqual(moved(["A", "B", "C", "D"], 3, 0), ["D", "A", "B", "C"], "to the top");
assert.deepEqual(moved(["A", "B", "C", "D"], 0, 2), ["B", "C", "A", "D"]);
assert.deepEqual(moved(["A", "B"], 0, 9), ["B", "A"], "past the end: last");
console.log("ok: moving one");

const rows = [0, 1, 2, 3].map(i => ({ top: i * 80, height: 80 }));
assert.equal(dropIndex(rows, 0, 0), 0);
assert.equal(dropIndex(rows, 0, 100), 1, "dragged down past the next one's middle");
assert.equal(dropIndex(rows, 0, 250), 3);
assert.equal(dropIndex(rows, 3, -250), 0, "dragged to the top");
assert.equal(dropIndex(rows, 2, -30), 2, "not far enough to move");
console.log("ok: where a dragged row lands");
