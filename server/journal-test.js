// node --no-warnings server/journal-test.js — the trading journal (journal.js)
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.STOCKWISE_DB = join(mkdtempSync(join(tmpdir(), "journal-")), "test.db");
const { db } = await import("./db.js");
const { cleanTrade, addTrade, updateTrade, listTrades, removeTrade } = await import("./journal.js");

const cols = db.prepare("PRAGMA table_info(users)").all().filter(c => (c.notnull && c.dflt_value == null && !c.pk) || c.name === "email").map(c => c.name);
const uid = db.prepare(`INSERT INTO users (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map(c => (c === "email" ? "j@example.test" : c.endsWith("_at") ? new Date().toISOString() : "x"))).lastInsertRowid;
const t = addTrade(uid, { ticker: "TCS", qty: 10, entryDate: "2026-09-01", entryPrice: 3100, stop: 3000, setup: "vcp", reason: "why" });
assert.equal(t.name, "TCS");
assert.throws(() => cleanTrade({ ticker: "TCS", qty: 1, entryDate: "2026-09-01", entryPrice: 100, stop: 120 }), /under the entry/);
assert.throws(() => cleanTrade({ ticker: "TCS", qty: 1, entryDate: "2026-09-01", entryPrice: 100, exitPrice: 110 }), /both its exit date/);
assert.throws(() => cleanTrade({ ticker: "TCS", qty: 1, entryDate: "2026-09-01", entryPrice: 100, exitPrice: 110, exitDate: "2026-08-01" }), /before the entry/);
const closed = updateTrade(uid, t.id, { exitDate: "2026-10-05", exitPrice: 3400, lesson: "held" });
assert.equal(closed.exitPrice, 3400); assert.equal(closed.entryPrice, 3100); assert.equal(closed.reason, "why");
assert.equal(listTrades(uid).length, 1);
assert.throws(() => updateTrade(uid + 1, t.id, {}), /No such trade/, "someone else's trade");
removeTrade(uid, t.id);
assert.equal(listTrades(uid).length, 0);
console.log("ok: a trade added, checked, closed and removed, per account");
