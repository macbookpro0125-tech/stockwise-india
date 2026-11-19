// node --no-warnings --expose-gc server/market-rebuild-test.js
// The evening's data swapped in with one market in memory, never two (screen.js
// rebuildFresh): the server ran out of memory holding both, 18–19 Nov 2026.
import assert from "node:assert/strict";
import { statSync, utimesSync } from "node:fs";
import { allMetrics, marketReady, rebuildFresh } from "./screen.js";
import { MARKET_DIR } from "./paths.js";

const heapMB = () => { global.gc?.(); return process.memoryUsage().heapUsed / 1048576; };

let first = await marketReady();
assert.ok(first.rows.length > 1000, "a market to start from");
const firstCount = first.rows.length;
const oneCopy = heapMB();

// a new day's data: the market folder's time moves (only its time; restored after)
const { atime, mtime } = statSync(MARKET_DIR);
utimesSync(MARKET_DIR, atime, new Date(mtime.getTime() + 60_000));
try {
  const pending = rebuildFresh();
  const oldVersion = first.version;
  first = null; // this test mustn't be what keeps the old market alive
  // something asks for the market mid-build: it gets that same build finished,
  // not a second one started beside it
  const now = allMetrics();
  assert.notEqual(now.version, oldVersion, "the new market, not the old one");
  assert.equal(now.rows.length, firstCount);
  assert.equal(await pending, now, "the slices' build and the asked-for one are the same");
  assert.ok(heapMB() < oneCopy * 1.35, `about one market in memory (${heapMB().toFixed(0)} MB vs ${oneCopy.toFixed(0)} MB)`);
  console.log(`ok: one market at a time through a data swap (${oneCopy.toFixed(0)} MB → ${heapMB().toFixed(0)} MB)`);
  // and when nothing changed, nothing is rebuilt
  assert.equal(await rebuildFresh(), now);
  console.log("ok: no rebuild when the data is the same");
} finally {
  utimesSync(MARKET_DIR, atime, mtime);
}
process.exit(0);
