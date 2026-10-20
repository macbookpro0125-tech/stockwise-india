// The scroll wheel's arithmetic (wheelMath.js): node src/wheelMath.test.js
import assert from "node:assert/strict";
import { indexAt, rowLook, stepIndex, notchStep } from "./wheelMath.js";

{
  // rows 34px tall, 20 of them
  assert.equal(indexAt(0, 34, 20), 0);
  assert.equal(indexAt(16, 34, 20), 0, "less than half a row: still the first");
  assert.equal(indexAt(18, 34, 20), 1, "past half a row: the next");
  assert.equal(indexAt(34 * 7, 34, 20), 7);
  assert.equal(indexAt(-50, 34, 20), 0, "a bounce above the top");
  assert.equal(indexAt(34 * 40, 34, 20), 19, "and past the end");
  assert.equal(indexAt(100, 34, 0), 0, "no rows");
  console.log("ok: the row in the middle, from how far it has scrolled");
}
{
  const mid = rowLook(0), one = rowLook(1), up = rowLook(-1), far = rowLook(6);
  assert.deepEqual(mid, { opacity: 1, rotate: 0, scale: 1 }, "the middle row is plain");
  assert.ok(one.opacity < 1 && one.scale < 1 && one.rotate < 0, "rows below tip away and fade");
  assert.equal(up.rotate, -one.rotate, "rows above tip the other way, the same amount");
  assert.ok(far.opacity >= 0.12 && Math.abs(far.rotate) <= 72, "far rows stay faint, never flip over");
  assert.ok(rowLook(2).opacity < one.opacity, "the further, the fainter");
  console.log("ok: rows tip and fade with their distance from the middle, like a drum");
}
{
  assert.equal(stepIndex(3, "ArrowDown", 10), 4);
  assert.equal(stepIndex(3, "ArrowUp", 10), 2);
  assert.equal(stepIndex(0, "ArrowUp", 10), 0, "no wrap at the top");
  assert.equal(stepIndex(9, "ArrowDown", 10), 9, "nor at the end");
  assert.equal(stepIndex(5, "Home", 10), 0);
  assert.equal(stepIndex(5, "End", 10), 9);
  assert.equal(stepIndex(5, "PageDown", 10), 9, "a page is four rows, to the end at most");
  assert.equal(stepIndex(5, "PageUp", 10), 1);
  assert.equal(stepIndex(5, "a", 10), null, "other keys aren't the wheel's");
  console.log("ok: arrow keys, Home, End, Page Up and Page Down move the wheel");
}
{
  // A mouse wheel's click moves one row; a trackpad's small, smooth deltas
  // are left to scroll (and snap) by themselves
  assert.equal(notchStep(100, 0), 1, "a click down (100px in Chrome)");
  assert.equal(notchStep(-120, 0), -1, "a click up (Windows' 120)");
  assert.equal(notchStep(3, 1), 1, "Firefox counts lines");
  assert.equal(notchStep(-4.5, 0), 0, "a trackpad");
  assert.equal(notchStep(12, 0), 0);
  assert.equal(notchStep(0, 0), 0);
  console.log("ok: one row for each click of a mouse wheel; trackpads scroll freely");
}
