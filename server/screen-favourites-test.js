// What joined and left a screener since it was last opened (screen-favourites.js)
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.STOCKWISE_DB = join(mkdtempSync(join(tmpdir(), "stockwise-favs-")), "test.db");
const { db } = await import("./db.js");
const { diff, markSeen, changesSince, saveFavourites, listFavourites } = await import("./screen-favourites.js");

const d = diff(["TCS", "INFY", "WIPRO"], ["TCS", "INFY", "INDIANB"], "2026-10-20T10:00:00.000Z", s => ({ INDIANB: "Indian Bank", WIPRO: "Wipro" })[s] ?? null);
assert.deepEqual(d.joined, [{ symbol: "INDIANB", name: "Indian Bank" }], "a company now in the screener joined it");
assert.deepEqual(d.left, [{ symbol: "WIPRO", name: "Wipro" }], "one no longer in it left");
assert.equal(d.seenAt, "2026-10-20T10:00:00.000Z");
console.log("ok: joined and left, with names");

const many = diff([], Array.from({ length: 30 }, (_, i) => `S${i}`), null);
assert.equal(many.joinedCount, 30, "the count is the whole change");
assert.equal(many.joined.length, 12, "the names stop at a dozen");
console.log("ok: a big change is counted in full, named in part");

const user = Number(db.prepare("INSERT INTO users (email, password_hash, password_salt, created_at) VALUES ('a@example.test', 'x', 'y', 'now')").run().lastInsertRowid);
markSeen(user, "defensive_bluechips", ["TCS", "WIPRO", "../bad"], new Date("2026-10-20T10:00:00Z"));
const ch = changesSince(user, id => (id === "defensive_bluechips" ? ["TCS", "INDIANB"] : null));
assert.equal(ch.defensive_bluechips.joinedCount, 1);
assert.equal(ch.defensive_bluechips.leftCount, 1, "a bad symbol in the note is dropped, not counted as leaving");
markSeen(user, "gone_screen", ["TCS"]);
assert.ok(!("gone_screen" in changesSince(user, id => (id === "defensive_bluechips" ? ["TCS"] : null))), "a screener that no longer exists is left out");
console.log("ok: changes since the screener was last opened");

assert.deepEqual(saveFavourites(user, ["sound_banks", "sound_banks", "bad id!", "custom_9"]), ["sound_banks", "custom_9"]);
assert.deepEqual(listFavourites(user), ["sound_banks", "custom_9"]);
assert.throws(() => saveFavourites(user, "sound_banks"));
console.log("ok: favourites are a clean list of ids");

console.log("All screen favourite checks passed.");
