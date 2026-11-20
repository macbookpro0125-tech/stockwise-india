// When the server asks GitHub for the evening data job (refresh-trigger.js)
import assert from "node:assert/strict";
import { dueSlot } from "./refresh-trigger.js";

const at = ist => new Date(Date.parse(`${ist}:00+05:30`));
const none = new Set();
assert.equal(dueSlot(at("2026-11-20T16:30"), "2026-11-19", none), null, "before 4:45 pm: not yet");
assert.equal(dueSlot(at("2026-11-20T16:50"), "2026-11-19", none), "2026-11-20 first", "4:45 pm, today's close not in");
assert.equal(dueSlot(at("2026-11-20T16:50"), "2026-11-20", none), null, "today's close in: nothing");
assert.equal(dueSlot(at("2026-11-20T17:30"), "2026-11-19", new Set(["2026-11-20 first"])), null, "asked once already");
assert.equal(dueSlot(at("2026-11-20T20:20"), "2026-11-19", new Set(["2026-11-20 first"])), "2026-11-20 second", "8:15 pm: once more");
assert.equal(dueSlot(at("2026-11-20T23:30"), "2026-11-19", new Set(["2026-11-20 first", "2026-11-20 second"])), null, "twice a day at most");
assert.equal(dueSlot(at("2026-11-21T17:00"), "2026-11-20", none), null, "Saturday");
assert.equal(dueSlot(at("2026-11-23T10:00"), "2026-11-20", none), null, "Monday morning: before the close");
console.log("ok: the evening job asked for at 4:45 and 8:15 pm on weekdays, only while today's close isn't in");
