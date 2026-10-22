// When the Android app asks for a rating on Play (rateApp.js): node src/rateApp.test.js
import assert from "node:assert/strict";
import { noteDay, readyToAsk } from "./rateApp.js";

const DAY = 864e5;
const start = Date.parse("2026-10-01T10:00:00+05:30");
const used = (...dayOffsets) => dayOffsets.reduce((s, d) => noteDay(s, start + d * DAY), {});

assert.equal(readyToAsk({}, start), false, "never before the app has been used");
assert.equal(readyToAsk({ ...used(0, 0, 0), visits: 40 }, start + 2 * 3600e3), false, "not on the first day, however busy");

const s = used(0, 3, 8);
assert.deepEqual(s.days.length, 3, "three different days are three");
assert.deepEqual(used(0, 0, 0).days.length, 1, "the same day three times is one");
assert.equal(readyToAsk({ ...s, visits: 5 }, start + 8 * DAY), true, "3 days over a week, 5 company pages: ask");
assert.equal(readyToAsk({ ...s, visits: 4 }, start + 8 * DAY), false, "fewer than 5 company pages: not yet");
assert.equal(readyToAsk({ ...used(0, 1, 2), visits: 9 }, start + 2 * DAY), false, "3 days but within the first week: not yet");
assert.equal(readyToAsk({ ...used(0, 8), visits: 9 }, start + 8 * DAY), false, "a week but only 2 days of use: not yet");

const asked = { ...s, visits: 5, asked: new Date(start + 8 * DAY).toISOString() };
assert.equal(readyToAsk(asked, start + 30 * DAY), false, "asked: not again within 4 months");
assert.equal(readyToAsk(asked, start + 130 * DAY), true, "and again after 4 months");

assert.equal(used(...Array.from({ length: 30 }, (_, i) => i)).days.length, 10, "only the last 10 days are kept");
console.log("ok: the rating card comes after real use, at most every 4 months");
