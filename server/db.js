// node:sqlite is still flagged experimental (API could change between Node
// versions) — fine for this stage since it needs zero extra dependencies
// (no node-gyp/native-build step to worry about at deploy time), but revisit
// before this actually ships; better-sqlite3 is the mature fallback if
// node:sqlite's API shifts under us.
import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
// STOCKWISE_DB (read in paths.js) points the smoke tests at a file of their
// own — they start from an empty database each run and must never wipe the
// real accounts.
import { DB_PATH } from "./paths.js";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  -- Same shape as stock-screener's alerts.json, plus user_id — that app
  -- learned the hard way (this session) that a ticker+condition combo
  -- needs to be unique per scope, so bake the constraint in from the start
  -- instead of adding it after a duplicate-notification bug ships.
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT,
    condition TEXT NOT NULL CHECK (condition IN ('above', 'below')),
    threshold REAL NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, ticker, condition)
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, ticker)
  );

  -- The original's portfolio (localStorage there), per account here. Several
  -- lots of the same stock are separate rows, as in the original.
  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT,
    buy_price REAL NOT NULL CHECK (buy_price > 0),
    qty REAL NOT NULL CHECK (qty > 0),
    buy_date TEXT,
    notes TEXT,
    added_at TEXT NOT NULL
  );
`);

// Columns added after tables already existed on someone's disk: ALTER only
// where missing, so an existing database upgrades in place.
function addColumn(table, column, type) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
// The original's watchlist cards show the price when a stock was starred and
// a note per stock
addColumn("watchlist", "added_price", "REAL");
addColumn("watchlist", "note", "TEXT");

// Telegram alerts (telegram.js, alert-notifier.js): the chat an account's
// alerts go to, and when an alert was last sent — once per crossing, not on
// every check while the price stays across
addColumn("users", "telegram_chat_id", "INTEGER");
addColumn("users", "telegram_name", "TEXT");
addColumn("alerts", "notified_at", "TEXT");
db.exec(`
  -- One-time codes behind the "Connect Telegram" link (t.me/<bot>?start=<code>)
  CREATE TABLE IF NOT EXISTS telegram_links (
    code TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
`);
