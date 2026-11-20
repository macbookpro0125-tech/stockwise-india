// The journal's sums (journalMath.js)
import assert from "node:assert/strict";
import { tradeResult, journalStats } from "./journalMath.js";

const win = { side: "long", qty: 10, entryDate: "2026-01-01", entryPrice: 100, stop: 95, exitDate: "2026-01-11", exitPrice: 115, setup: "vcp" };
const r = tradeResult(win);
assert.deepEqual([r.pnl, r.pct, r.r, r.days, r.open], [150, 15, 3, 10, false]);
const loss = { side: "long", qty: 20, entryDate: "2026-02-01", entryPrice: 50, stop: 47, exitDate: "2026-02-03", exitPrice: 47, setup: "vcp" };
assert.equal(tradeResult(loss).r, -1);
const short = { side: "short", qty: 5, entryDate: "2026-03-01", entryPrice: 200, stop: null, exitDate: "2026-03-02", exitPrice: 180, setup: "" };
assert.equal(tradeResult(short).pnl, 100);
assert.equal(tradeResult(short).r, null, "no stop, no R");
const open = { side: "long", qty: 1, entryDate: "2026-04-01", entryPrice: 10, stop: null, exitDate: null, exitPrice: null };
assert.equal(tradeResult(open, 12).pct, 20);
assert.equal(tradeResult(open).pnl, null, "an open trade with no price yet");
console.log("ok: a trade's result, long or short, R from its stop");

const s = journalStats([win, loss, short, open]);
assert.equal(s.closed, 3); assert.equal(s.open, 1);
assert.equal(Math.round(s.winRate), 67);
assert.equal(s.pnl, 150 - 60 + 100);
assert.equal(s.profitFactor, 250 / 60);
assert.equal(s.avgR, 1);
assert.equal(s.best.t, win); assert.equal(s.worst.t, loss);
assert.deepEqual(s.bySetup.map(g => [g.setup, g.trades, g.wins]), [["vcp", 2, 1], ["", 1, 1]]);
assert.equal(journalStats([]).winRate, null);
console.log("ok: the closed trades together, and by pattern");
