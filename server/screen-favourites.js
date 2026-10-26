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

// ---- What a starred screener's card says every day ------------------------
// (26 Oct 2026: "is that useful then?" — the careful screeners rarely change,
// so the card also says how its companies did at the last close and which of
// them report results in the coming week)

const RESULTS = /result/i;
const isoDay = d => d.toISOString().slice(0, 10);

// rowOf(symbol) → the company's row (name, ret1d, events); now → today
export function todayFor(symbols, rowOf, now = new Date()) {
  const rows = symbols.map(rowOf).filter(Boolean);
  const moved = rows.filter(r => Number.isFinite(r.ret1d));
  const price = r => (Number.isFinite(r.cmp) ? r.cmp : null);
  const pick = r => r && { symbol: r.symbol, name: r.name ?? r.symbol, ret1d: r.ret1d, cmp: price(r) };
  const sorted = [...moved].sort((a, b) => b.ret1d - a.ret1d);
  // IST, where NSE's dates are
  const today = isoDay(new Date(now.getTime() + 330 * 60_000));
  const weekOut = isoDay(new Date(now.getTime() + 330 * 60_000 + 7 * 86_400_000));
  const results = rows
    .map(r => ({ r, e: (r.events ?? []).find(e => e.kind === "board" && RESULTS.test(e.title ?? "") && e.date >= today && e.date <= weekOut) }))
    .filter(x => x.e)
    .sort((a, b) => a.e.date.localeCompare(b.e.date))
    .map(({ r, e }) => ({ symbol: r.symbol, name: r.name ?? r.symbol, date: e.date, cmp: price(r), ret1d: Number.isFinite(r.ret1d) ? r.ret1d : null }));
  return {
    avg1d: moved.length ? Math.round((moved.reduce((s, r) => s + r.ret1d, 0) / moved.length) * 100) / 100 : null,
    best: moved.length > 1 ? pick(sorted[0]) : null,
    worst: moved.length > 1 ? pick(sorted.at(-1)) : null,
    resultsCount: results.length,
    results: results.slice(0, 12), // the card cycles through them
  };
}

// ---- A phone notification when a company joins a starred screener ----------
// For each account with a phone: each starred screener's companies against
// the ones it was last told about (the first look only starts the record).
// screenFor(userId) → id → { symbols, name } | null; nameOf(symbol) → name.
export function favouriteJoinsMessage(joins) {
  if (!joins.length) return null;
  const named = j => j.joined.map(s => s.name).filter(Boolean);
  if (joins.length === 1) {
    const [j] = joins;
    const n = named(j);
    return {
      title: j.name,
      body: j.joined.length === 1 ? `${n[0]} joined it at the last close` : `${n.slice(0, 3).join(", ")}${j.joined.length > 3 ? ` and ${j.joined.length - 3} more` : ""} joined it at the last close`,
      data: j.joined.length === 1 ? { stock: j.joined[0].symbol } : { tab: "discover" },
    };
  }
  const total = joins.reduce((n, j) => n + j.joined.length, 0);
  return {
    title: `${total} new in your favourite screeners`,
    body: joins.slice(0, 3).map(j => `${j.joined.length === 1 ? named(j)[0] : `${j.joined.length} companies`} joined ${j.name}`).join("; ") + (joins.length > 3 ? `; and ${joins.length - 3} more` : ""),
    data: { tab: "discover" },
  };
}

export async function pushFavouriteJoins({ screenFor, nameOf = () => null, push, log = console.error, now = new Date() }) {
  const users = db.prepare("SELECT DISTINCT f.user_id AS id FROM favourite_screens f JOIN push_tokens t ON t.user_id = f.user_id").all();
  const get = db.prepare("SELECT symbols FROM favourite_notified WHERE user_id = ? AND screen_id = ?");
  const put = db.prepare(`
    INSERT INTO favourite_notified (user_id, screen_id, symbols, at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, screen_id) DO UPDATE SET symbols = excluded.symbols, at = excluded.at
  `);
  let sent = 0;
  for (const u of users) {
    const info = screenFor(u.id);
    const joins = [];
    for (const id of listFavourites(u.id)) {
      const s = info(id);
      if (!s) continue;
      const nowSymbols = [...new Set(s.symbols)].filter(x => isValidSymbol(x)).sort();
      const row = get.get(u.id, id);
      put.run(u.id, id, JSON.stringify(nowSymbols), now.toISOString());
      if (!row) continue; // the first look only starts the record
      let before = [];
      try { before = JSON.parse(row.symbols) ?? []; } catch {}
      const had = new Set(before);
      const joined = nowSymbols.filter(x => !had.has(x)).map(symbol => ({ symbol, name: nameOf(symbol) ?? symbol }));
      if (joined.length) joins.push({ id, name: s.name, joined });
    }
    const message = favouriteJoinsMessage(joins);
    if (message && await push(u.id, message, { log })) sent++;
  }
  return { users: users.length, sent };
}
