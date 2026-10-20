// The phone tab bar folding into one button as you read down
// (tabBarScroll.js): node src/tabBarScroll.test.js
import assert from "node:assert/strict";
import { scrollStep, OPEN_NEAR_TOP } from "./tabBarScroll.js";

const run = (ys, start = { collapsed: false, anchor: 0 }) => ys.reduce((s, y) => scrollStep(s, y), start);
{
  // reading down the page, a few pixels per scroll event
  const down = run([0, 4, 9, 30, 80, 140, 200, 260]);
  assert.equal(down.collapsed, true, "reading down past the first screenful folds the bar into one button");
  assert.equal(run([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 40, 60, 90, 130, 170]).collapsed, true, "small steps add up");
  assert.equal(run([0, 20, 40, 60]).collapsed, false, "not while still near the top");
  console.log("ok: reading down folds it, but not near the top");
}
{
  const folded = run([0, 100, 200, 300, 400]);
  assert.equal(run([395, 390, 386], folded).collapsed, true, "a few pixels of wobble change nothing");
  assert.equal(run([390, 370, 350], folded).collapsed, false, "scrolling back up opens it");
  assert.equal(run([400, OPEN_NEAR_TOP - 1], { collapsed: true, anchor: 400 }).collapsed, false, "at the top it's always open");
  console.log("ok: scrolling back up, or reaching the top, opens it; wobble doesn't");
}
{
  // iOS bounces past the top (negative scroll) and past the end
  assert.equal(scrollStep({ collapsed: true, anchor: 300 }, -40).collapsed, false);
  const open = scrollStep({ collapsed: false, anchor: 300 }, 300);
  assert.deepEqual(open, { collapsed: false, anchor: 300 }, "no movement, no change");
  console.log("ok: the bounce past the top opens it");
}
