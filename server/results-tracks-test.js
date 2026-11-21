// The results tracker's arithmetic (results-tracks.js followFrom)
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "test-tracks.db");
process.env.STOCKWISE_DB = DB_PATH;
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
const { followFrom, TRACK_DAYS } = await import("./results-tracks.js");

const closes = [["2026-10-29", 90], ["2026-10-30", 100], ["2026-10-31", 104], ["2026-11-03", 110], ["2027-01-05", 150]];
// from the results day's close
let f = followFrom(closes, "2026-10-30", "2026-11-03");
assert.deepEqual(f.base, { date: "2026-10-30", close: 100 });
assert.equal(Math.round(f.pct), 10, "100 → 110 is +10%");
assert.deepEqual(f.series.map(([, v]) => v), [100, 104, 110], "each day from 100");
assert.equal(f.finished, false);
// results on a holiday: the next trading day's close is the start
f = followFrom(closes, "2026-11-01", "2026-11-03");
assert.equal(f.base.date, "2026-11-03");
// day 60 ends it: a close after that isn't counted
f = followFrom(closes, "2026-10-30", "2027-01-05");
assert.equal(TRACK_DAYS, 60);
assert.equal(f.last.date, "2026-11-03", "the 5 Jan close is past day 60");
assert.equal(f.finished, true);
// nothing on or after the results day: nothing to follow
assert.equal(followFrom(closes, "2027-02-01"), null);
unlinkSync(DB_PATH);
console.log("ok: tracked from the results day's close, for 60 days, each day from 100");
process.exit(0);
