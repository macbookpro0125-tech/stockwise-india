// Is a loaded logo visible on the white tile? (logoInk.js): node src/logoInk.test.js
import assert from "node:assert/strict";
import { inkShare, logoVisible } from "./logoInk.js";

// RGBA pixels: n of one colour
const px = (n, [r, g, b, a]) => Array.from({ length: n }, () => [r, g, b, a]).flat();
const WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0], NAVY = [20, 30, 80, 255], YELLOW = [250, 200, 0, 255], WHITE_CLEAR = [255, 255, 255, 120];

assert.equal(inkShare(px(100, NAVY)), 1, "a solid dark logo is all ink");
assert.equal(inkShare([...px(50, NAVY), ...px(50, CLEAR)]), 0.5, "a clear background isn't ink");
assert.equal(inkShare(px(100, WHITE)), 0, "white on white is no ink");
assert.equal(inkShare(px(100, WHITE_CLEAR)), 0, "white on a clear background, the case that vanished (22 Oct 2026)");
assert.equal(inkShare(px(100, YELLOW)), 1, "a pale yellow mark still shows on white");
assert.equal(inkShare([]), 0, "nothing drawn, no ink");
console.log("ok: ink on the white tile");

assert.equal(logoVisible({ ink: 0.2, w: 128, h: 128 }), true, "a square logo with ink is shown");
assert.equal(logoVisible({ ink: 0.004, w: 128, h: 128 }), false, "an all-but-empty one isn't");
assert.equal(logoVisible({ ink: 0.3, w: 400, h: 96 }), false, "a wide banner isn't (it shrinks to a strip)");
assert.equal(logoVisible({ ink: 0.3, w: 60, h: 200 }), false, "nor a tall one");
console.log("ok: which loaded logos are shown");
