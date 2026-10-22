// What the site watch counts as a problem (site-watch.mjs): node scripts/site-watch.test.mjs
import assert from "node:assert/strict";
import { problems, STALE_HOURS } from "./site-watch.mjs";

const up = { ok: true, status: 200 };
const healthy = { ok: true, status: 200, body: { ok: true, snapshotAgeHours: 13, dataPull: { lastError: null }, jobs: { lastError: null } } };
const look = over => ({ home: up, script: up, health: healthy, ...over });
const health = body => ({ ...healthy, body: { ...healthy.body, ...body } });

assert.deepEqual(problems(look()), [], "up, its app loading, data from last evening: nothing to say");
assert.match(problems(look({ home: { ok: false, status: 502 } }))[0], /home page answered 502/, "the site down (Render's 502)");
assert.match(problems(look({ home: { ok: false, status: "timed out after 20 s" } }))[0], /home page didn't answer \(timed out/, "the site not answering at all");
assert.match(problems(look({ script: null }))[0], /app script/, "a page that doesn't name its app script");
assert.match(problems(look({ script: { ok: false, status: 404 } }))[0], /app script answered 404/, "a deploy whose app script is missing: a blank page");
assert.match(problems(look({ health: { ok: false, status: 500 } }))[0], /health check answered 500/, "the server erroring");
assert.deepEqual(problems(look({ health: health({ snapshotAgeHours: 90 }) })), [], "a long weekend's data (Friday evening to Monday evening) is no alarm");
assert.match(problems(look({ health: health({ snapshotAgeHours: STALE_HOURS + 1 }) }))[0], /market data is \d+ hours old/, "data more than four days old: the evening refresh has stopped");
assert.match(problems(look({ health: health({ snapshotAgeHours: null }) }))[0], /no market data/, "no market data at all");
assert.match(problems(look({ health: health({ dataPull: { lastError: "release not found" } }) }))[0], /evening data failed: release not found/, "the evening data can't be fetched");
console.log("ok: the site watch raises the alarm for an outage, a broken deploy or stale data, and not for a weekend");
