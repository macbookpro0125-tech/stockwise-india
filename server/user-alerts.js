import { db } from "./db.js";

export function listAlerts(userId) {
  return db.prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC").all(userId);
}

export function createAlert(userId, { ticker, name, condition, threshold }) {
  ticker = String(ticker || "").trim().toUpperCase();
  if (!ticker) throw new Error("ticker required");
  if (condition !== "above" && condition !== "below") throw new Error("condition must be 'above' or 'below'");
  if (!isFinite(threshold)) throw new Error("threshold must be a number");

  try {
    const result = db.prepare(
      "INSERT INTO alerts (user_id, ticker, name, condition, threshold, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(userId, ticker, name || ticker, condition, threshold, new Date().toISOString());
    return db.prepare("SELECT * FROM alerts WHERE id = ?").get(result.lastInsertRowid);
  } catch (e) {
    // The UNIQUE(user_id, ticker, condition) constraint enforces this at the
    // DB level, not just in application code that a future route could
    // bypass — this is the exact CRAMC-at-two-thresholds bug from
    // stock-screener, made structurally impossible instead of caught by a
    // duplicate check someone has to remember to call.
    if (e.message.includes("UNIQUE constraint failed")) {
      const existing = db.prepare("SELECT * FROM alerts WHERE user_id = ? AND ticker = ? AND condition = ?")
        .get(userId, ticker, condition);
      throw Object.assign(new Error(`An alert for ${ticker} already exists (${condition} ${existing.threshold})`), { duplicate: true, existing });
    }
    throw e;
  }
}

// Edit an alert's price or direction, or pause/resume it (the original's
// edit dialog and on/off switch). The one-per-direction rule still holds.
export function updateAlert(userId, alertId, { condition, threshold, enabled }) {
  const existing = db.prepare("SELECT * FROM alerts WHERE id = ? AND user_id = ?").get(alertId, userId);
  if (!existing) throw new Error("No such alert");
  const next = {
    condition: condition ?? existing.condition,
    threshold: threshold != null ? Number(threshold) : existing.threshold,
    enabled: enabled != null ? (enabled ? 1 : 0) : existing.enabled,
  };
  if (next.condition !== "above" && next.condition !== "below") throw new Error("condition must be 'above' or 'below'");
  if (!(next.threshold > 0)) throw new Error("threshold must be a price above 0");
  try {
    db.prepare("UPDATE alerts SET condition = ?, threshold = ?, enabled = ? WHERE id = ? AND user_id = ?")
      .run(next.condition, next.threshold, next.enabled, alertId, userId);
  } catch (e) {
    if (e.message.includes("UNIQUE constraint failed")) {
      throw Object.assign(new Error(`You already have a "${next.condition}" alert for ${existing.ticker}`), { duplicate: true });
    }
    throw e;
  }
  return db.prepare("SELECT * FROM alerts WHERE id = ?").get(alertId);
}

export function deleteAlert(userId, alertId) {
  db.prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?").run(alertId, userId);
}
