// The Nifty 500's kept closes for the chart (index-history.js): node server/index-history-test.js
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveIndexDays, readIndexHistory, benchmarkFor } from "./index-history.js";

const file = join(mkdtempSync(join(tmpdir(), "idx-")), "_index.json");
saveIndexDays(new Map([["2026-01-02", 100], ["2026-01-01", 99]]), file);
saveIndexDays(new Map([["2026-01-02", 101], ["2026-01-03", 0]]), file);
assert.deepEqual(readIndexHistory(file), [["2026-01-01", 99], ["2026-01-02", 101]], "oldest first, a day replaced, no zero closes");

const day = i => new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
const bars = Array.from({ length: 100 }, (_, i) => ({ date: day(i) }));
const kept = Array.from({ length: 80 }, (_, i) => [day(i + 20), 1000 + i]);
const b = benchmarkFor(bars, kept);
assert.equal(b.from, day(20), "the line starts on the first day kept");
assert.equal(b.closes.length, 80);
assert.equal(benchmarkFor(bars, kept.slice(30)), null, "under 60 days: no line");
assert.equal(benchmarkFor(bars, [[day(1), 900], ...kept]).from, day(20), "an odd day kept long before doesn't start the line");
assert.equal(benchmarkFor(bars, kept.filter((_, i) => i % 10)), null, "1 day in 10 missing: no line");
console.log("ok: the Nifty 500's days kept, and a line only where they're there");
