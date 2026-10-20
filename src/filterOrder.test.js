// Reordering the screener's filters (screener/filterOrder.js): node src/filterOrder.test.js
import assert from "node:assert/strict";
import { moveFilter, canMove } from "./screener/filterOrder.js";

// Market cap size and sector sit at the top of the panel whatever their place
// in the list; the rest are shown in list order, and that order is also the
// order of their columns in the results
const filters = [
  { id: "capSize", values: ["Large cap"] },
  { id: "pe", min: null, max: 20 },
  { id: "sector", values: ["Banks"] },
  { id: "roe", min: 15, max: null },
  { id: "gnpaPct", min: null, max: 2 },
];
const ids = fs => fs.map(f => f.id);
{
  assert.deepEqual(ids(moveFilter(filters, "gnpaPct", -1)), ["capSize", "pe", "sector", "gnpaPct", "roe"]);
  assert.deepEqual(ids(moveFilter(filters, "roe", -1)), ["capSize", "roe", "sector", "pe", "gnpaPct"], "past the pinned sector, to the shown row above");
  assert.deepEqual(ids(moveFilter(filters, "pe", 1)), ["capSize", "roe", "sector", "pe", "gnpaPct"]);
  console.log("ok: a filter moves up or down past the shown one beside it");
}
{
  assert.equal(moveFilter(filters, "pe", -1), filters, "the first can't go up");
  assert.equal(moveFilter(filters, "gnpaPct", 1), filters, "the last can't go down");
  assert.equal(moveFilter(filters, "sector", 1), filters, "market cap size and sector stay pinned");
  assert.equal(moveFilter(filters, "nope", 1), filters);
  assert.deepEqual(ids(filters), ["capSize", "pe", "sector", "roe", "gnpaPct"], "the list given isn't changed");
  assert.deepEqual(moveFilter(filters, "roe", 1)[4], { id: "roe", min: 15, max: null }, "a filter keeps its limits");
  console.log("ok: nothing moves past the ends, the pinned ones stay, the list given is untouched");
}
{
  assert.deepEqual(canMove(filters, "pe"), { up: false, down: true });
  assert.deepEqual(canMove(filters, "roe"), { up: true, down: true });
  assert.deepEqual(canMove(filters, "gnpaPct"), { up: true, down: false });
  assert.deepEqual(canMove([{ id: "pe" }], "pe"), { up: false, down: false });
  console.log("ok: which way each filter can go");
}
