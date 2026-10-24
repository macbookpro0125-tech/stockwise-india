import { db } from "./db.js";
import { isValidSymbol } from "./screen.js";
import { badRequest } from "./http-errors.js";
import { DEFAULT_LEVEL_SETTINGS, LEVEL_LIMITS, LEVEL_KEYS, cleanLevelSettings } from "./levels.js";

// Each user's own price levels (levels.js userLevels): their settings, off
// until they turn them on, and any stock whose five levels they typed by hand.

export function getUserLevels(userId) {
  const row = db.prepare("SELECT enabled, mos, step, stop, upper FROM user_level_settings WHERE user_id = ?").get(userId);
  const settings = row ? { enabled: !!row.enabled, ...cleanLevelSettings(row) } : { enabled: false, ...DEFAULT_LEVEL_SETTINGS };
  const stocks = Object.fromEntries(db.prepare("SELECT ticker, p1, p2, p3, stop_loss AS stopLoss, target FROM user_stock_levels WHERE user_id = ?").all(userId)
    .map(({ ticker, ...l }) => [ticker, l]));
  return { settings, stocks };
}

// Out of range is refused, not quietly moved: the user should see the number
// they saved
export function saveLevelSettings(userId, body = {}) {
  const enabled = body.enabled == null ? !!getUserLevels(userId).settings.enabled : !!body.enabled;
  const s = {};
  for (const [k, [lo, hi]] of Object.entries(LEVEL_LIMITS)) {
    const v = body[k] == null || body[k] === "" ? DEFAULT_LEVEL_SETTINGS[k] : Number(body[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) throw badRequest(`${{ mos: "Margin of safety", step: "Gap between levels", stop: "Stop under level 3", upper: "Upper level over the 2-year value" }[k]} must be ${lo}–${hi}%`);
    s[k] = Math.round(v * 100) / 100;
  }
  db.prepare(`INSERT INTO user_level_settings (user_id, enabled, mos, step, stop, upper, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET enabled = excluded.enabled, mos = excluded.mos, step = excluded.step, stop = excluded.stop, upper = excluded.upper, updated_at = excluded.updated_at`)
    .run(userId, enabled ? 1 : 0, s.mos, s.step, s.stop, s.upper, new Date().toISOString());
  return { enabled, ...s };
}

// In order from the top: upper over level 1, level 1 ≥ level 2 ≥ level 3,
// and the stop under level 3 — what "where the price sits" reads them as
export function setStockLevels(userId, ticker, body = {}) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!isValidSymbol(ticker)) throw badRequest("Not an NSE symbol");
  const l = Object.fromEntries(LEVEL_KEYS.map(k => [k, Number(body[k])]));
  if (!LEVEL_KEYS.every(k => Number.isFinite(l[k]) && l[k] > 0 && l[k] < 1e8)) throw badRequest("Every level needs a price above ₹0");
  if (!(l.target > l.p1 && l.p1 >= l.p2 && l.p2 >= l.p3 && l.p3 > l.stopLoss)) throw badRequest("Keep them in order: upper above level 1, level 1 ≥ level 2 ≥ level 3, and the stop under level 3");
  db.prepare(`INSERT INTO user_stock_levels (user_id, ticker, p1, p2, p3, stop_loss, target, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, ticker) DO UPDATE SET p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, stop_loss = excluded.stop_loss, target = excluded.target, updated_at = excluded.updated_at`)
    .run(userId, ticker, l.p1, l.p2, l.p3, l.stopLoss, l.target, new Date().toISOString());
  return l;
}

export function clearStockLevels(userId, ticker) {
  db.prepare("DELETE FROM user_stock_levels WHERE user_id = ? AND ticker = ?").run(userId, String(ticker || "").trim().toUpperCase());
}
