// Run: node server/desk-layout-test.js
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.STOCKWISE_DB = join(mkdtempSync(join(tmpdir(), "stockwise-desk-")), "test.db");
const { db } = await import("./db.js");
const { cleanLayout, getDeskLayout, saveDeskLayout, clearDeskLayout, MAX_CARDS } = await import("./desk-layout.js");

const uid = Number(db.prepare("INSERT INTO users (email, password_hash, password_salt, created_at) VALUES ('d@example.test', 'x', 'y', '2026-10-31') RETURNING id").get().id);

assert.equal(getDeskLayout(uid), null, "nothing saved yet");
const saved = saveDeskLayout(uid, { cards: [{ id: "a", kind: "list", w: 1 }, { id: "b", kind: "chart", w: 2 }, { id: "c", kind: "notes", w: 3, text: "watch the banks" }] });
assert.deepEqual(getDeskLayout(uid), saved);
assert.equal(saved.cards[2].text, "watch the banks");
console.log("ok: a layout is kept and read back");

assert.throws(() => cleanLayout({ cards: [{ kind: "script" }] }), /Unknown card/);
assert.throws(() => cleanLayout({}), /list of cards/);
assert.throws(() => cleanLayout({ cards: Array.from({ length: MAX_CARDS + 1 }, () => ({ kind: "list" })) }), /At most/);
const c = cleanLayout({ cards: [{ id: "x", kind: "chart", w: 99, extra: "<b>" }, { id: "x", kind: "price" }, { kind: "notes", text: "n".repeat(5000) }] });
assert.equal(c.cards[0].w, 4, "an odd width is a third");
const g = cleanLayout({ cards: [{ id: "g", kind: "chart", x: 10, y: 3, w: 6, h: 18 }, { id: "q", kind: "list", x: 2, y: 999, w: 3, h: 10 }] });
assert.deepEqual([g.cards[0].x, g.cards[0].y, g.cards[0].w, g.cards[0].h], [6, 3, 6, 18], "a card is kept inside the grid");
assert.equal(g.cards[1].x, undefined, "a place off the grid isn't kept");
assert.equal(c.cards[0].extra, undefined, "nothing unasked is kept");
assert.notEqual(c.cards[1].id, "x", "ids stay distinct");
assert.equal(c.cards[2].text.length, 2000, "notes are capped");
console.log("ok: only known cards, widths and capped notes are kept");

clearDeskLayout(uid);
assert.equal(getDeskLayout(uid), null);
console.log("ok: a layout can be cleared");
