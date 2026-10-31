// The table's short headings and column order (columnHeads.js): node src/columnHeads.test.js
import assert from "node:assert/strict";
import { headOf, inOrder, moveTo } from "./columnHeads.js";

assert.equal(headOf({ id: "priceStrength", short: "Price strength" }), "PS");
assert.equal(headOf({ id: "roce", short: "ROCE" }), "ROCE", "one not listed keeps its short name");
assert.deepEqual(inOrder(["a", "b", "c"], ["c", "a"]), ["c", "a", "b"], "the dragged order first, new ones after");
assert.deepEqual(inOrder(["a", "b"], []), ["a", "b"]);
assert.deepEqual(moveTo(["a", "b", "c"], "c", "a"), ["c", "a", "b"], "onto the first: before it");
assert.deepEqual(moveTo(["a", "b", "c"], "a", "c"), ["b", "c", "a"], "onto the last: after it");
assert.deepEqual(moveTo(["a", "b"], "x", "a"), ["a", "b"]);
console.log("columnHeads tests passed");
{
  const { periodsOf, moveStep } = await import("./columnHeads.js");
  assert.deepEqual(periodsOf("salesGrowth3y").map(([id]) => id), ["salesGrowth1y", "salesGrowth3y", "salesGrowth5y"]);
  assert.equal(periodsOf("pe"), null, "no periods: none offered");
  assert.equal(periodsOf("roe", id => id === "roe"), null, "only one known: none offered");
  assert.deepEqual(moveStep(["a", "b", "c"], "b", "left"), ["b", "a", "c"]);
  assert.deepEqual(moveStep(["a", "b", "c"], "b", "end"), ["a", "c", "b"]);
  assert.deepEqual(moveStep(["a", "b", "c"], "c", "start"), ["c", "a", "b"]);
  assert.deepEqual(moveStep(["a", "b", "c"], "a", "left"), ["a", "b", "c"], "already first");
  console.log("columnHeads periods and moves passed");
}
