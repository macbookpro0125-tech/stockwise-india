// The phone's Screeners page (PhoneScreens.jsx): the screeners a user stars,
// kept with the account so every phone and computer shows the same ones, and
// what changed in a screener since they last opened it — the companies that
// joined it and the ones that left. Opening a screener notes its companies
// (markSeen); the page compares that note with today's list (changesSince).
import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest } from "./http-errors.js";

const MAX_FAVOURITES = 30;
// How many names a change carries; the count is always the whole of it
const MAX_NAMED = 12;
const cleanId = id => (typeof id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null);

export function listFavourites(userId) {
  const row = db.prepare("SELECT list FROM favourite_screens WHERE user_id = ?").get(userId);
  try { return row ? JSON.parse(row.list) : []; } catch { return []; }
}

export function saveFavourites(userId, list) {
  if (!Array.isArray(list)) throw badRequest("Expected a list of screener ids");
  const clean = [...new Set(list.map(cleanId).filter(Boolean))].slice(0, MAX_FAVOURITES);
  db.prepare(`
    INSERT INTO favourite_screens (user_id, list, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET list = excluded.list, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(clean), new Date().toISOString());
  return clean;
}

// The screener's companies now, as the user saw them
export function markSeen(userId, screenId, symbols, at = new Date()) {
  const id = cleanId(screenId);
  if (!id) throw badRequest("Unknown screener");
  const clean = [...new Set(symbols)].filter(s => isValidSymbol(s)).sort();
  db.prepare(`
    INSERT INTO screen_seen (user_id, screen_id, symbols, seen_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, screen_id) DO UPDATE SET symbols = excluded.symbols, seen_at = excluded.seen_at
  `).run(userId, id, JSON.stringify(clean), at.toISOString());
}

// The screeners this user has a note for
export function seenIds(userId) {
  return db.prepare("SELECT screen_id FROM screen_seen WHERE user_id = ?").all(userId).map(r => r.screen_id);
}

// { joined, left, seenAt } for each screener with a note; today's companies
// come from symbolsOf(id) (null when the screener no longer exists), names
// from nameOf(symbol)
export function changesSince(userId, symbolsOf, nameOf = () => null) {
  const rows = db.prepare("SELECT screen_id, symbols, seen_at FROM screen_seen WHERE user_id = ?").all(userId);
  const out = Object.create(null);
  for (const r of rows) {
    const now = symbolsOf(r.screen_id);
    if (!now) continue;
    let then = [];
    try { then = JSON.parse(r.symbols) ?? []; } catch {}
    out[r.screen_id] = diff(then, now, r.seen_at, nameOf);
  }
  return out;
}

export function diff(then, now, seenAt, nameOf = () => null) {
  const before = new Set(then), after = new Set(now);
  const named = list => list.slice(0, MAX_NAMED).map(symbol => ({ symbol, name: nameOf(symbol) }));
  const joined = [...after].filter(s => !before.has(s)).sort();
  const left = [...before].filter(s => !after.has(s)).sort();
  return { joinedCount: joined.length, leftCount: left.length, joined: named(joined), left: named(left), seenAt };
}
