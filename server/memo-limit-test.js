// The shared answer cache keeps a limited number of per-company answers
// (company-extras.js cached), and every site-wide one
import assert from "node:assert/strict";
import { cached, memoSize, MEMO_COMPANY_MAX } from "./company-extras.js";

await cached("gold-silver", 60_000, async () => ({ g: 1 }));
for (let i = 0; i < MEMO_COMPANY_MAX + 200; i++) await cached(`profile:SYM${i}`, 60_000, async () => ({ i }));
assert.equal(memoSize(), MEMO_COMPANY_MAX + 1, "per-company answers capped; the site-wide one kept");
let calls = 0;
await cached("gold-silver", 60_000, async () => { calls++; return {}; });
assert.equal(calls, 0, "the site-wide answer wasn't let go");
await cached(`profile:SYM${MEMO_COMPANY_MAX + 199}`, 60_000, async () => { calls++; return {}; });
assert.equal(calls, 0, "the most recent company is still kept");
await cached("profile:SYM0", 60_000, async () => { calls++; return {}; });
assert.equal(calls, 1, "the oldest company was let go and is read again");
console.log("ok: per-company answers kept for the most recent companies only");
