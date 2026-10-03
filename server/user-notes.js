// "My Notes" (a verdict and a line per stock) and the strategies a user saves
// on Discover — kept with the account, so they're there on every device
// signed in to it. Both were browser-only before.
import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest } from "./http-errors.js";

const VERDICTS = new Set(["ACCUMULATE", "WATCHLIST", "SKIP"]);

export function listNotes(userId) {
  const rows = db.prepare("SELECT ticker, verdict, text, saved_at FROM stock_notes WHERE user_id = ?").all(userId);
  return Object.fromEntries(rows.map(r => [r.ticker, { verdict: r.verdict, text: r.text, savedAt: r.saved_at }]));
}

export function saveNote(userId, ticker, { verdict, text, savedAt } = {}) {
  ticker = String(ticker ?? "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw badRequest("Enter a valid NSE symbol");
  if (!VERDICTS.has(verdict)) throw badRequest("Pick Accumulate, Watchlist or Skip");
  const note = { verdict, text: String(text ?? "").trim().slice(0, 2000), savedAt: String(savedAt || new Date().toLocaleDateString("en-IN")).slice(0, 20) };
  db.prepare(`
    INSERT INTO stock_notes (user_id, ticker, verdict, text, saved_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ticker) DO UPDATE SET verdict = excluded.verdict, text = excluded.text, saved_at = excluded.saved_at
  `).run(userId, ticker, note.verdict, note.text, note.savedAt);
  return note;
}

export function deleteNote(userId, ticker) {
  db.prepare("DELETE FROM stock_notes WHERE user_id = ? AND ticker = ?").run(userId, String(ticker ?? "").trim().toUpperCase());
}

// A saved strategy is a name and a list of filters ({ id, min, max } or
// { id, values }); anything else is dropped, and sizes are bounded
const str = (v, n) => String(v ?? "").slice(0, n);
const num = v => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
function cleanStrategy(p) {
  if (!p || typeof p !== "object" || !String(p.name ?? "").trim()) return null;
  const filters = (Array.isArray(p.filters) ? p.filters : []).slice(0, 80).map(f => (f && typeof f.id === "string"
    ? (Array.isArray(f.values) ? { id: str(f.id, 40), values: f.values.slice(0, 60).map(v => str(v, 80)) } : { id: str(f.id, 40), min: num(f.min), max: num(f.max) })
    : null)).filter(Boolean);
  return {
    id: str(p.id || `custom_${Date.now()}`, 40), name: str(p.name, 60).trim(), icon: str(p.icon || "📌", 8), custom: true,
    description: str(p.description, 120), filters,
    // older saved strategies kept the original's criteria object
    ...(p.criteria && typeof p.criteria === "object" && !filters.length && JSON.stringify(p.criteria).length <= 4000 ? { criteria: JSON.parse(JSON.stringify(p.criteria)) } : {}),
  };
}

export function listStrategies(userId) {
  const row = db.prepare("SELECT list FROM saved_strategies WHERE user_id = ?").get(userId);
  try { return row ? JSON.parse(row.list) : []; } catch { return []; }
}

export function saveStrategies(userId, list) {
  if (!Array.isArray(list)) throw badRequest("Expected a list of strategies");
  const clean = list.slice(0, 50).map(cleanStrategy).filter(Boolean);
  db.prepare(`
    INSERT INTO saved_strategies (user_id, list, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET list = excluded.list, updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(clean), new Date().toISOString());
  return clean;
}
