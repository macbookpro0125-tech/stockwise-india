// The results tracker (21 Nov 2026, the owner: "from the results day, add
// stocks to the Desk and track them like a chart"): a company picked on its
// results, followed from that day's close for 60 days — its move, against
// the Nifty 500 over the same days, with the quarter's figures beside it.
// Kept with the account (so the same on every device), apart from the
// watchlist. Prices come from our own daily history, never from the request.
import { db } from "./db.js";
import { allMetrics, isValidSymbol } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { historyBars } from "./price-history.js";
import { readIndexHistory, BENCHMARK } from "./index-history.js";
import { quarterName } from "./results-push.js";
import { badRequest, notFound } from "./http-errors.js";

db.exec(`CREATE TABLE IF NOT EXISTS results_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  quarter_end TEXT NOT NULL,
  results_date TEXT NOT NULL,
  note TEXT,
  added_at TEXT NOT NULL,
  UNIQUE (user_id, symbol, quarter_end)
)`);

export const TRACK_DAYS = 60;
export const MAX_TRACKS = 50;
const DAY = 86_400_000;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

// From the day's close the results came out (or the next trading day's, for
// results filed on a holiday) to the last close, or to day 60.
// closes: [[date, close]] oldest first. Returns null with no close on or after the results day.
export function followFrom(closes, resultsDate, today = null) {
  const end = addDays(resultsDate, TRACK_DAYS);
  const start = closes.findIndex(([d]) => d >= resultsDate);
  if (start < 0) return null;
  const base = closes[start];
  const kept = closes.slice(start).filter(([d]) => d <= end);
  const last = kept.at(-1);
  return {
    base: { date: base[0], close: base[1] },
    last: { date: last[0], close: last[1] },
    pct: (last[1] / base[1] - 1) * 100,
    series: kept.map(([d, c]) => [d, Math.round((c / base[1]) * 10000) / 100]),
    finished: (today ?? last[0]) > end,
    endsOn: end,
  };
}

const quarterOf = (row, end) => (row?.quarters ?? []).find(q => q.fyEnd === end) ?? null;

export function addTrack(userId, { symbol, note = "" } = {}) {
  const sym = String(symbol ?? "").trim().toUpperCase();
  if (!isValidSymbol(sym)) throw badRequest("Pick a company from the results to track");
  const row = (allMetrics().rows ?? []).find(r => r.symbol === sym);
  const q = row?.quarters?.[0];
  if (!q?.fyEnd || !q.filed) throw badRequest("This company has no results on file to track from yet");
  const count = db.prepare("SELECT COUNT(*) AS n FROM results_tracks WHERE user_id = ?").get(userId).n;
  if (count >= MAX_TRACKS) throw badRequest(`You're tracking ${MAX_TRACKS} companies, the most there's room for. Remove one first.`);
  db.prepare("INSERT OR IGNORE INTO results_tracks (user_id, symbol, quarter_end, results_date, note, added_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, sym, q.fyEnd, String(q.filed).slice(0, 10), String(note ?? "").slice(0, 200), new Date().toISOString());
  return listTracks(userId);
}

export function removeTrack(userId, id) {
  const r = db.prepare("DELETE FROM results_tracks WHERE id = ? AND user_id = ?").run(id, userId);
  if (!r.changes) throw notFound("Not on your tracker");
  return listTracks(userId);
}

export function setTrackNote(userId, id, note) {
  const r = db.prepare("UPDATE results_tracks SET note = ? WHERE id = ? AND user_id = ?").run(String(note ?? "").slice(0, 200), id, userId);
  if (!r.changes) throw notFound("Not on your tracker");
  return listTracks(userId);
}

// Every tracked company with its move since results, the Nifty 500's over the
// same days, and the line for the chart (each from 100 on its results day)
export function listTracks(userId, { snapshot = loadMarketSnapshot(), barsOf = sym => historyBars(sym, snapshot), index = readIndexHistory() } = {}) {
  const rows = db.prepare("SELECT id, symbol, quarter_end, results_date, note, added_at FROM results_tracks WHERE user_id = ? ORDER BY results_date DESC, id DESC").all(userId);
  const today = snapshot?.pricesDate ?? null;
  const metrics = new Map((allMetrics().rows ?? []).map(r => [r.symbol, r]));
  const tracks = rows.map(t => {
    const m = metrics.get(t.symbol);
    const q = quarterOf(m, t.quarter_end);
    let closes = [];
    try { closes = (barsOf(t.symbol) ?? []).filter(b => b.date >= t.results_date).map(b => [b.date, b.close]).filter(([, c]) => c > 0); } catch { /* no history */ }
    const f = followFrom(closes, t.results_date, today);
    const nifty = f ? followFrom(index.filter(([d]) => d >= f.base.date && d <= f.last.date), f.base.date) : null;
    return {
      id: t.id, symbol: t.symbol, name: m?.name ?? t.symbol, sector: m?.sector ?? null,
      quarter: quarterName(t.quarter_end), quarterEnd: t.quarter_end, resultsDate: t.results_date, note: t.note ?? "",
      profitCr: q?.profitCr ?? null, profitYoY: q?.profitYoY ?? null, salesCr: q?.revenueCr ?? null, salesYoY: q?.salesYoY ?? null,
      base: f?.base ?? null, last: f?.last ?? null, pct: f?.pct ?? null,
      niftyPct: nifty?.pct ?? null, vsNifty: f && nifty ? f.pct - nifty.pct : null,
      days: f ? Math.round((Date.parse(f.last.date) - Date.parse(f.base.date)) / DAY) : 0,
      finished: f?.finished ?? false, endsOn: f?.endsOn ?? addDays(t.results_date, TRACK_DAYS),
      series: f?.series ?? [],
    };
  });
  const from = tracks.map(t => t.base?.date).filter(Boolean).sort()[0] ?? null;
  return { tracks, benchmark: BENCHMARK, today, trackDays: TRACK_DAYS, index: from ? index.filter(([d]) => d >= from) : [] };
}
