import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";

// Per-user watchlist — the original kept it in the browser's localStorage;
// here it follows the account, like alerts. Each entry remembers the price
// when it was starred (the original's cards show the move since) and a note.

export function listWatchlist(userId) {
  return db.prepare(
    "SELECT ticker, added_at AS addedAt, added_price AS addedPrice, note FROM watchlist WHERE user_id = ? ORDER BY added_at DESC"
  ).all(userId);
}

export function addToWatchlist(userId, ticker, price = null) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw new Error("Not an NSE symbol");
  // Already there is fine — starring twice shouldn't error
  db.prepare("INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at, added_price) VALUES (?, ?, ?, ?)")
    .run(userId, ticker, new Date().toISOString(), Number(price) > 0 ? Number(price) : null);
}

export function setWatchlistNote(userId, ticker, note) {
  db.prepare("UPDATE watchlist SET note = ? WHERE user_id = ? AND ticker = ?")
    .run(String(note || "").trim().slice(0, 500) || null, userId, String(ticker || "").trim().toUpperCase());
}

export function removeFromWatchlist(userId, ticker) {
  db.prepare("DELETE FROM watchlist WHERE user_id = ? AND ticker = ?").run(userId, String(ticker || "").trim().toUpperCase());
}
