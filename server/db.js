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

  -- Password-reset links (auth.js): only a hash of each token is kept, so a
  -- copy of the database can't be used to reset anyone's password
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at TEXT
  );
`);

// Sign-in with Google, Apple or a phone number (firebase-auth.js): such an
// account may have no email (phone) or no password (all three), which SQLite
// can only allow by rebuilding the table. Done once, the database copied
// first. Foreign keys are off while it runs — node:sqlite turns them on, and
// dropping the old table with them on would cascade-delete every account's
// alerts, watchlist and portfolio — and every table's row count must come out
// unchanged, or the whole rebuild is undone.
const CHILD_TABLES = ["sessions", "alerts", "watchlist", "holdings", "telegram_links", "password_resets"];
function rebuildUsersForSocialSignIn() {
  const columns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (columns.includes("firebase_uid")) return;
  const counts = () => Object.fromEntries(["users", ...CHILD_TABLES].map(t => [t, db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n]));
  const before = counts();
  if (before.users > 0) db.exec(`VACUUM INTO '${`${DB_PATH}.before-social-signin-${Date.now()}`.replace(/'/g, "''")}'`);
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec("BEGIN");
    try {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE,
          password_hash TEXT,
          password_salt TEXT,
          created_at TEXT NOT NULL,
          telegram_chat_id INTEGER,
          telegram_name TEXT,
          -- Firebase's id for a Google / Apple / phone sign-in
          firebase_uid TEXT UNIQUE,
          phone TEXT UNIQUE,
          display_name TEXT,
          CHECK (email IS NOT NULL OR phone IS NOT NULL)
        );
      `);
      const kept = columns.filter(c => ["id", "email", "password_hash", "password_salt", "created_at", "telegram_chat_id", "telegram_name"].includes(c)).join(", ");
      db.exec(`INSERT INTO users_new (${kept}) SELECT ${kept} FROM users`);
      db.exec("DROP TABLE users");
      db.exec("ALTER TABLE users_new RENAME TO users");
      const after = counts();
      if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error(`row counts changed: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      const broken = db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length) throw new Error(`${broken.length} rows lost their account`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw new Error(`Accounts table upgrade undone: ${e.message}`);
    }
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}
rebuildUsersForSocialSignIn();
