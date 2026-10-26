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

// The card's day: the move at the last close, best and worst, results this week
const { todayFor, favouriteJoinsMessage, pushFavouriteJoins } = await import("./screen-favourites.js");
const rowsT = {
  A: { symbol: "A", name: "Alpha", ret1d: 2, events: [{ kind: "board", date: "2026-10-29", title: "Board meeting: financial results" }] },
  B: { symbol: "B", name: "Beta", ret1d: -1, events: [{ kind: "board", date: "2026-11-20", title: "Board meeting: financial results" }] },
  C: { symbol: "C", name: "Gamma", ret1d: 0.5, events: [{ kind: "action", date: "2026-10-28", title: "Dividend" }, { kind: "board", date: "2026-10-27", title: "Board meeting: fund raising" }] },
};
const t = todayFor(["A", "B", "C", "GONE"], s => rowsT[s], new Date("2026-10-26T06:00:00Z"));
assert.equal(t.avg1d, 0.5, "the average move of its companies");
assert.equal(t.best.name, "Alpha"); assert.equal(t.worst.name, "Beta");
assert.deepEqual(t.results, [{ symbol: "A", name: "Alpha", date: "2026-10-29" }], "only results, only within the week ahead");
console.log("ok: a card's day — the move, best and worst, results this week");

// The notification: one company, or several across screeners
const one = favouriteJoinsMessage([{ id: "x", name: "Sound Banks", joined: [{ symbol: "INDIANB", name: "Indian Bank" }] }]);
assert.equal(one.title, "Sound Banks"); assert.match(one.body, /Indian Bank joined it/); assert.deepEqual(one.data, { stock: "INDIANB" });
const several = favouriteJoinsMessage([{ id: "x", name: "Sound Banks", joined: [{ symbol: "A", name: "A1" }] }, { id: "y", name: "Doubled in a Year", joined: [{ symbol: "B", name: "B1" }, { symbol: "C", name: "C1" }] }]);
assert.equal(several.title, "3 new in your favourite screeners"); assert.match(several.body, /2 companies joined Doubled in a Year/);
assert.equal(favouriteJoinsMessage([]), null);
console.log("ok: the notification's words");

db.prepare("INSERT INTO push_tokens (token, user_id, platform, created_at) VALUES ('tok', ?, 'android', 'now')").run(user);
let now = ["TCS", "INFY"];
const sentTo = [];
const run = () => pushFavouriteJoins({ screenFor: () => id => (id === "sound_banks" ? { symbols: now, name: "Sound Banks" } : null), nameOf: s => s, push: async (uid, m) => { sentTo.push(m); return true; }, log: () => {} });
await run();
assert.equal(sentTo.length, 0, "the first look only starts the record");
now = ["TCS", "INFY", "INDIANB"];
await run();
assert.equal(sentTo.length, 1); assert.match(sentTo[0].body, /INDIANB joined/);
await run();
assert.equal(sentTo.length, 1, "told once, not again at the next check");
now = ["TCS"];
await run();
assert.equal(sentTo.length, 1, "a company leaving isn't a notification");
console.log("ok: a phone is told once when a company joins a starred screener");

console.log("All screen favourite checks passed.");
