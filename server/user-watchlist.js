import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";

// Per-user watchlist — the original kept it in the browser's localStorage;
// here it follows the account, like alerts.

export function listWatchlist(userId) {
  return db.prepare("SELECT ticker, added_at AS addedAt FROM watchlist WHERE user_id = ? ORDER BY added_at DESC").all(userId);
}

export function addToWatchlist(userId, ticker) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw new Error("Not an NSE symbol");
  // Already there is fine — starring twice shouldn't error
  db.prepare("INSERT OR IGNORE INTO watchlist (user_id, ticker, added_at) VALUES (?, ?, ?)").run(userId, ticker, new Date().toISOString());
}

export function removeFromWatchlist(userId, ticker) {
  db.prepare("DELETE FROM watchlist WHERE user_id = ? AND ticker = ?").run(userId, String(ticker || "").trim().toUpperCase());
}
