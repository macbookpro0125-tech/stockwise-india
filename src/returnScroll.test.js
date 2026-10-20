// Where Discover's strategies page opens on the way back from a stock list
// (returnScroll.js): node src/returnScroll.test.js
import assert from "node:assert/strict";
import { returnScroll } from "./returnScroll.js";

// the strategies grid starts 1,400px down, under a 92px pinned header
assert.equal(returnScroll(2600, 1400, 92), 2600, "back to the card you opened, further down the grid");
assert.equal(returnScroll(0, 1400, 92), 1400 - 92 - 12, "from the top of the page: straight to the strategies, not the intro");
assert.equal(returnScroll(null, 1400, 92), 1400 - 92 - 12, "a list opened from a link: the strategies too");
assert.equal(returnScroll(500, null, 0), 500, "no grid on the page: where you were");
assert.equal(returnScroll(null, null, 0), 0);
console.log("ok: back from a list, the strategies are on screen — where you left them, or their top");
