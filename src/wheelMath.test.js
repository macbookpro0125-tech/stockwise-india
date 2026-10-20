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
  // A drum like the iPhone's: rows sit on a cylinder, so away from the middle
  // they squeeze in height and bunch toward it — upright, never slanted
  const H = 40;
  const mid = rowLook(0, H), one = rowLook(1, H), up = rowLook(-1, H), two = rowLook(2, H);
  assert.deepEqual(mid, { opacity: 1, y: 0, scaleY: 1 }, "the middle row is plain");
  assert.ok(one.scaleY < 1 && one.scaleY > 0.6, "the next row is a little flatter");
  assert.ok(one.y < 0, "and drawn a little nearer the middle than its place");
  assert.deepEqual(up, { ...one, y: -one.y }, "rows above mirror rows below");
  assert.ok(two.scaleY < one.scaleY && two.opacity < one.opacity && two.y < one.y, "further rows flatter, fainter, more bunched");
  assert.equal(rowLook(3, H).opacity, 0, "past the edge of the drum, gone");
  assert.ok(!("rotate" in mid), "no tilt — text stays upright");
  console.log("ok: rows squeeze and bunch on a drum, like the iPhone's picker, upright");
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
