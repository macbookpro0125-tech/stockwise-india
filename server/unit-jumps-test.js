// A fund's change of unit that NSE's corporate actions don't list (price-history.js unitJumps)
import assert from "node:assert/strict";
import { unitJumps } from "./price-history.js";

const bar = (date, close, volume = 1000) => ({ date, open: close, high: close, low: close, close, volume });
// GOLDBEES, Dec 2019: ₹3,359.60 the day before ₹33.55 (1:100)
const gold = unitJumps([bar("2019-12-17", 3350.3), bar("2019-12-18", 3359.6), bar("2019-12-19", 33.55), bar("2019-12-20", 33.65)]);
assert.deepEqual(gold.map(b => b.close), [33.5, 33.6, 33.55, 33.65], "the days before on today's unit");
assert.equal(gold[0].volume, 100000, "volume the other way");
// NIFTYBEES 1:10
assert.deepEqual(unitJumps([bar("a", 1292.54), bar("b", 130.2)]).map(b => b.close), [129.25, 130.2]);
// a real fall, even a big one, is left alone: not near 10×, 100× or 1000×
assert.deepEqual(unitJumps([bar("a", 100), bar("b", 22)]).map(b => b.close), [100, 22], "a 78% fall is a price");
assert.deepEqual(unitJumps([bar("a", 100), bar("b", 60), bar("c", 300)]).map(b => b.close), [100, 60, 300], "rises aren't units");
// nothing to do: the same objects back
const plain = [bar("a", 10), bar("b", 11)];
assert.equal(unitJumps(plain)[0], plain[0]);
console.log("ok: a fund's unit change is put on today's unit; real moves are left alone");
