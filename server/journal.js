import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest, notFound } from "./http-errors.js";
import { loadMarketSnapshot } from "./market-data.js";

// A trading journal (20 Nov 2026, the owner, from a rival's list: "a trading
// journal"): each trade someone records — what, when, at what price, the stop
// they set, the pattern it was taken on, why, and once closed, the exit and
// what they learned. Per account; the sums are worked out on the page
// (src/journalMath.js). Their own record, never advice.

db.exec(`
  CREATE TABLE IF NOT EXISTS journal_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT,
    side TEXT NOT NULL DEFAULT 'long',
    qty REAL NOT NULL,
    entry_date TEXT NOT NULL,
    entry_price REAL NOT NULL,
    stop REAL,
    exit_date TEXT,
    exit_price REAL,
    setup TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    lesson TEXT NOT NULL DEFAULT '',
    basis_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS journal_trades_user ON journal_trades(user_id, entry_date);
`);
if (!db.prepare("PRAGMA table_info(journal_trades)").all().some(c => c.name === "basis_date")) db.exec("ALTER TABLE journal_trades ADD COLUMN basis_date TEXT");

export const MAX_TRADES = 2000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Splits and bonuses after the figures were entered (as user-portfolio.js):
// the prices and quantity are shown on the share basis of the exit day, or
// today's for an open trade, so a 1:1 bonus isn't read as a 50% loss. The
// figures are stored on the basis of basis_date (the entry date at first;
// the day they were last saved after that).
const splitFactor = (ticker, from, to) => (loadMarketSnapshot()?.splits?.[ticker] ?? [])
  .filter(x => x.exDate > from && (!to || x.exDate <= to)).reduce((f, x) => f * x.ratio, 1);

const row = t => {
  const f = splitFactor(t.ticker, t.basis_date ?? t.entry_date, t.exit_date);
  const adj = v => (v == null ? null : v / f);
  return {
    id: t.id, ticker: t.ticker, name: t.name ?? t.ticker, side: t.side, qty: t.qty * f,
    entryDate: t.entry_date, entryPrice: adj(t.entry_price), stop: adj(t.stop),
    exitDate: t.exit_date ?? null, exitPrice: t.exit_price ?? null,
    setup: t.setup, reason: t.reason, lesson: t.lesson,
    ...(f !== 1 && { splitAdjusted: f }),
  };
};
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

const text = (v, max) => String(v ?? "").trim().slice(0, max);
const pos = v => (v === "" || v == null ? null : Number(v));

export function cleanTrade(input) {
  const ticker = text(input.ticker, 20).toUpperCase();
  if (!isValidSymbol(ticker)) throw badRequest("Enter an NSE symbol, e.g. TCS");
  const side = input.side === "short" ? "short" : "long";
  const qty = Number(input.qty), entryPrice = Number(input.entryPrice);
  if (!(qty > 0)) throw badRequest("Quantity must be more than 0");
  if (!(entryPrice > 0)) throw badRequest("Entry price must be more than 0");
  if (!DATE.test(input.entryDate ?? "")) throw badRequest("Entry date must be a date");
  const stop = pos(input.stop);
  if (stop != null && !(stop > 0)) throw badRequest("Stop must be more than 0, or left empty");
  if (stop != null && (side === "long" ? stop >= entryPrice : stop <= entryPrice)) throw badRequest(side === "long" ? "A stop sits under the entry price" : "A short's stop sits over the entry price");
  const exitPrice = pos(input.exitPrice);
  const exitDate = input.exitDate || null;
  if ((exitPrice == null) !== (exitDate == null)) throw badRequest("A closed trade needs both its exit date and exit price");
  if (exitPrice != null && !(exitPrice > 0)) throw badRequest("Exit price must be more than 0");
  if (exitDate != null && (!DATE.test(exitDate) || exitDate < input.entryDate)) throw badRequest("The exit date can't be before the entry date");
  return {
    ticker, name: text(input.name, 200) || ticker, side, qty, entryDate: input.entryDate, entryPrice, stop,
    exitDate, exitPrice, setup: text(input.setup, 60), reason: text(input.reason, 1000), lesson: text(input.lesson, 1000),
  };
}

export function listTrades(userId) {
  return db.prepare("SELECT * FROM journal_trades WHERE user_id = ? ORDER BY entry_date DESC, id DESC").all(userId).map(row);
}

export function addTrade(userId, input) {
  const t = cleanTrade(input);
  const n = db.prepare("SELECT COUNT(*) AS n FROM journal_trades WHERE user_id = ?").get(userId).n;
  if (n >= MAX_TRADES) throw badRequest(`The journal holds up to ${MAX_TRADES} trades`);
  const now = new Date().toISOString();
  const r = db.prepare(`INSERT INTO journal_trades (user_id, ticker, name, side, qty, entry_date, entry_price, stop, exit_date, exit_price, setup, reason, lesson, basis_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, t.ticker, t.name, t.side, t.qty, t.entryDate, t.entryPrice, t.stop, t.exitDate, t.exitPrice, t.setup, t.reason, t.lesson, t.entryDate, now, now);
  return row(db.prepare("SELECT * FROM journal_trades WHERE id = ?").get(r.lastInsertRowid));
}

// fields left out keep what was saved; the symbol stays. What comes back is
// on the basis shown (row), so it's saved on that basis: the exit day's, or today's
export function updateTrade(userId, id, input) {
  const old = db.prepare("SELECT * FROM journal_trades WHERE id = ? AND user_id = ?").get(id, userId);
  if (!old) throw notFound("No such trade");
  const t = cleanTrade({ ...row(old), ...Object.fromEntries(Object.entries(input ?? {}).filter(([, v]) => v !== undefined)), ticker: old.ticker });
  // the figures came back on the basis they were shown on: a closed trade's
  // exit day, an open one's today
  const basis = old.exit_date ?? todayIst();
  db.prepare(`UPDATE journal_trades SET name = ?, side = ?, qty = ?, entry_date = ?, entry_price = ?, stop = ?, exit_date = ?, exit_price = ?, setup = ?, reason = ?, lesson = ?, basis_date = ?, updated_at = ?
    WHERE id = ? AND user_id = ?`)
    .run(t.name, t.side, t.qty, t.entryDate, t.entryPrice, t.stop, t.exitDate, t.exitPrice, t.setup, t.reason, t.lesson, basis, new Date().toISOString(), id, userId);
  return row(db.prepare("SELECT * FROM journal_trades WHERE id = ?").get(id));
}

export function removeTrade(userId, id) {
  db.prepare("DELETE FROM journal_trades WHERE id = ? AND user_id = ?").run(id, userId);
}
