import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { splitFactorSince } from "./user-portfolio.js";
import { badRequest, HttpError } from "./http-errors.js";

// Per-user watchlist — the original kept it in the browser's localStorage;
// here it follows the account, like alerts. Each entry remembers the price
// when it was starred (the original's cards show the move since) and a note.

// The price when starred, on today's share basis: a split or bonus since
// would otherwise read as a fall
export function listWatchlist(userId) {
  return db.prepare(
    "SELECT ticker, added_at AS addedAt, added_price AS addedPrice, note FROM watchlist WHERE user_id = ? ORDER BY added_at DESC"
  ).all(userId).map(w => (w.addedPrice > 0 ? { ...w, addedPrice: w.addedPrice / splitFactorSince(w.ticker, w.addedAt) } : w));
}

export function addToWatchlist(userId, ticker, price = null) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw badRequest("Not an NSE symbol");
  // Already there is fine — starring twice shouldn't error
  db.prepare("INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at, added_price) VALUES (?, ?, ?, ?)")
    .run(userId, ticker, new Date().toISOString(), Number(price) > 0 ? Number(price) : null);
}

export function setWatchlistNote(userId, ticker, note) {
  db.prepare("UPDATE watchlist SET note = ? WHERE user_id = ? AND ticker = ?")
    .run(String(note || "").trim().slice(0, 500) || null, userId, String(ticker || "").trim().toUpperCase());
}

// Unstarred: out of every list too
export function removeFromWatchlist(userId, ticker) {
  ticker = String(ticker || "").trim().toUpperCase();
  db.prepare("DELETE FROM watchlist WHERE user_id = ? AND ticker = ?").run(userId, ticker);
  db.prepare("DELETE FROM watchlist_list_items WHERE ticker = ? AND list_id IN (SELECT id FROM watchlist_lists WHERE user_id = ?)").run(ticker, userId);
}

// ---- Named lists (the Watchlist page's tabs) --------------------------------
// A list is a named subset of the starred stocks; adding a stock to a list
// stars it. Names are the user's own, 1–40 characters, one of each per account.

export const MAX_LISTS = 20;
const MAX_NAME = 40;
const cleanName = name => String(name ?? "").replace(/\s+/g, " ").trim();

export function listWatchLists(userId) {
  const lists = db.prepare("SELECT id, name, created_at AS createdAt FROM watchlist_lists WHERE user_id = ? ORDER BY id").all(userId);
  const items = db.prepare("SELECT i.list_id AS listId, i.ticker FROM watchlist_list_items i JOIN watchlist_lists l ON l.id = i.list_id WHERE l.user_id = ? ORDER BY i.added_at DESC").all(userId);
  return lists.map(l => ({ ...l, tickers: items.filter(i => i.listId === l.id).map(i => i.ticker) }));
}

function ownList(userId, id) {
  const list = db.prepare("SELECT id, name FROM watchlist_lists WHERE id = ? AND user_id = ?").get(Number(id), userId);
  if (!list) throw new HttpError("No such list", 404);
  return list;
}

function checkName(userId, name, exceptId = null) {
  const n = cleanName(name);
  if (!n) throw badRequest("Give the list a name");
  if (n.length > MAX_NAME) throw badRequest(`A list's name can be up to ${MAX_NAME} characters`);
  if (/^all$/i.test(n)) throw badRequest("\"All\" is every starred stock already; pick another name");
  const same = db.prepare("SELECT id, name FROM watchlist_lists WHERE user_id = ? AND lower(name) = lower(?)").get(userId, n);
  if (same && same.id !== exceptId) throw badRequest(`You already have a list called "${same.name}"`);
  return n;
}

// tickers: stocks to put in it straight away (a suggested list's), each starred
export function createWatchList(userId, name, tickers = [], priceOf = () => null) {
  const n = checkName(userId, name);
  const count = db.prepare("SELECT COUNT(*) AS n FROM watchlist_lists WHERE user_id = ?").get(userId).n;
  if (count >= MAX_LISTS) throw badRequest(`Up to ${MAX_LISTS} lists`);
  const now = new Date().toISOString();
  const { lastInsertRowid } = db.prepare("INSERT INTO watchlist_lists (user_id, name, created_at) VALUES (?, ?, ?)").run(userId, n, now);
  const id = Number(lastInsertRowid);
  for (const t of (Array.isArray(tickers) ? tickers : []).slice(0, 200)) addToWatchList(userId, id, t, priceOf(t));
  return listWatchLists(userId).find(l => l.id === id);
}

export function renameWatchList(userId, id, name) {
  const list = ownList(userId, id);
  const n = checkName(userId, name, list.id);
  db.prepare("UPDATE watchlist_lists SET name = ? WHERE id = ?").run(n, list.id);
}

// The list goes; its stocks stay starred
export function deleteWatchList(userId, id) {
  const list = ownList(userId, id);
  db.prepare("DELETE FROM watchlist_list_items WHERE list_id = ?").run(list.id);
  db.prepare("DELETE FROM watchlist_lists WHERE id = ?").run(list.id);
}

export function addToWatchList(userId, id, ticker, price = null) {
  const list = ownList(userId, id);
  ticker = String(ticker || "").trim().toUpperCase();
  addToWatchlist(userId, ticker, price);
  db.prepare("INSERT OR IGNORE INTO watchlist_list_items (list_id, ticker, added_at) VALUES (?, ?, ?)").run(list.id, ticker, new Date().toISOString());
}

// Out of this list; still starred
export function removeFromWatchList(userId, id, ticker) {
  const list = ownList(userId, id);
  db.prepare("DELETE FROM watchlist_list_items WHERE list_id = ? AND ticker = ?").run(list.id, String(ticker || "").trim().toUpperCase());
}
