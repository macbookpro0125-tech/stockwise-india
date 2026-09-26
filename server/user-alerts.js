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

export function deleteAlert(userId, alertId) {
  db.prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?").run(alertId, userId);
}
