// node:sqlite is still flagged experimental (API could change between Node
// versions) — fine for this stage since it needs zero extra dependencies
// (no node-gyp/native-build step to worry about at deploy time), but revisit
// before this actually ships; better-sqlite3 is the mature fallback if
// node:sqlite's API shifts under us.
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// STOCKWISE_DB points the smoke tests at a file of their own — they start
// from an empty database each run and must never wipe the real accounts.
const DB_PATH = process.env.STOCKWISE_DB ?? join(__dirname, "..", "data", "app.db");
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
`);
