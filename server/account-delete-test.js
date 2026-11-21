// "Delete account" promises to remove everything saved with the account
// (Privacy policy). deleteAccount removes the users row; every table that
// keeps something per account must go with it by ON DELETE CASCADE, and
// foreign keys must be on, or a deleted account's journal, lists or phone
// token would stay behind.
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "test-delete.db");
process.env.STOCKWISE_DB = DB_PATH; // never the real app.db
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const { db } = await import("./db.js");
const { signup, deleteAccount } = await import("./auth.js");
// the modules that make their own per-account tables
await import("./journal.js");
await import("./digest.js");
await import("./results-push.js");
await import("./results-tracks.js");

assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1, "foreign keys are on");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name);
const perAccount = tables.filter(t => db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === "user_id"));
assert.ok(perAccount.length >= 20, `found the per-account tables (${perAccount.length})`);
for (const t of perAccount) {
  const fk = db.prepare(`PRAGMA foreign_key_list(${t})`).all().find(k => k.from === "user_id");
  assert.ok(fk && fk.table === "users" && fk.on_delete === "CASCADE", `${t} goes when its account is deleted`);
}

const a = signup("delete-me@example.com", "correcthorsebattery");
const b = signup("keep-me@example.com", "correcthorsebattery2");
for (const id of [a.userId, b.userId]) {
  db.prepare("INSERT INTO watchlist (user_id, ticker, added_at) VALUES (?, 'TCS', ?)").run(id, new Date().toISOString());
  const list = db.prepare("INSERT INTO watchlist_lists (user_id, name, created_at) VALUES (?, 'IT', ?)").run(id, new Date().toISOString());
  db.prepare("INSERT INTO watchlist_list_items (list_id, ticker, added_at) VALUES (?, 'TCS', ?)").run(list.lastInsertRowid, new Date().toISOString());
}
deleteAccount(a.userId, "correcthorsebattery");
for (const t of perAccount) {
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(a.userId).n, 0, `nothing left in ${t}`);
}
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM watchlist_list_items").get().n, 1, "the deleted account's list items went; the other account's stayed");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM watchlist WHERE user_id = ?").get(b.userId).n, 1, "the other account keeps its watchlist");
unlinkSync(DB_PATH);
console.log("ok: deleting an account removes everything saved with it, and only that");
