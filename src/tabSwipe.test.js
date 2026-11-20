// Swiping between a company's tabs (tabSwipe.js)
import assert from "node:assert/strict";
import { swipeStep } from "./tabSwipe.js";

const w = 390;
assert.equal(swipeStep({ dx: -120, dy: 10, ms: 250, startX: 300, width: w }), 1, "right to left: the next tab");
assert.equal(swipeStep({ dx: 120, dy: 10, ms: 250, startX: 80, width: w }), -1, "left to right: the tab before");
assert.equal(swipeStep({ dx: -45, dy: 0, ms: 200, startX: 300, width: w }), 0, "too short");
assert.equal(swipeStep({ dx: -120, dy: 100, ms: 250, startX: 300, width: w }), 0, "mostly a scroll down");
assert.equal(swipeStep({ dx: 130, dy: -70, ms: 300, startX: 60, width: w }), -1, "a thumb's curved swipe to the right still counts");
assert.equal(swipeStep({ dx: -120, dy: 0, ms: 1200, startX: 300, width: w }), 0, "too slow: a drag, not a swipe");
assert.equal(swipeStep({ dx: 150, dy: 0, ms: 200, startX: 10, width: w }), 0, "from the edge: the phone's own Back");
console.log("ok: a swipe moves a tab; scrolls, slow drags and edge swipes don't");
