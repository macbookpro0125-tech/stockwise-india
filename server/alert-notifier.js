// Sends each alert to its owner's Telegram and phones (push.js) when the
// price crosses it — once.
// notified_at holds that: set when sent, cleared when the price is back on
// the other side, so a later crossing sends again but a price that stays
// across doesn't send every 15 minutes. Editing an alert clears it too
// (user-alerts.js).
//
// Checked every 15 minutes while NSE trades (9:15–15:30 IST, Monday to
// Friday) against the latest completed Yahoo daily close, falling back to
// the last NSE close where Yahoo fails — the message says which.
import { db } from "./db.js";
import { currentPrices } from "./prices.js";
import { sendTelegram, escapeHtml, telegramToken } from "./telegram.js";
import { pushReady, pushToUser } from "./push.js";

const rs = n => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function alertMessage(a, p) {
  const where = a.condition === "below" ? "at or below" : "at or above";
  const basis = p.source === "live" ? `Yahoo daily close${p.asOf ? ` on ${p.asOf}` : ""}`
    : p.source === "cached" ? `Cached Yahoo daily close${p.asOf ? ` on ${p.asOf}` : ""}`
      : `NSE daily close${p.asOf ? ` on ${p.asOf}` : ""}`;
  return `<b>${escapeHtml(a.name || a.ticker)}</b> (${escapeHtml(a.ticker)}) is ${rs(p.price)} — ${where} your alert price of ${rs(a.threshold)}.\n<i>${basis}</i>`;
}

// The same, as a phone notification; tapping it opens the company
export function alertPush(a, p) {
  const where = a.condition === "below" ? "At or below" : "At or above";
  const basis = p.source === "live" || p.source === "cached" ? "Yahoo daily close" : "NSE daily close";
  return {
    title: `${a.name || a.ticker} is ${rs(p.price)}`,
    body: `${where} your alert price of ${rs(a.threshold)}. ${basis}${p.asOf ? ` on ${p.asOf}` : ""}.`,
    data: { stock: a.ticker },
  };
}

// prices: { TICKER: { price, asOf, source } }, else fetched; send: (chatId,
// html) => Promise; push: (userId, message) => Promise<boolean>. All
// injectable for the tests.
export async function notifyAlerts({ prices, send = sendTelegram, push = pushReady() ? pushToUser : null, log = console.error } = {}) {
  const rows = db.prepare(`
    SELECT a.*, u.telegram_chat_id AS chat_id,
      EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = a.user_id) AS has_phone
    FROM alerts a JOIN users u ON u.id = a.user_id
    WHERE a.enabled = 1 AND (u.telegram_chat_id IS NOT NULL OR ${push ? "EXISTS (SELECT 1 FROM push_tokens t WHERE t.user_id = a.user_id)" : "0"})
  `).all();
  if (!rows.length) return { checked: 0, sent: 0 };
  prices ??= await currentPrices(rows.map(r => r.ticker));
  let sent = 0;
  for (const a of rows) {
    const p = prices[a.ticker];
    if (!(p?.price > 0)) continue;
    const across = a.condition === "below" ? p.price <= a.threshold : p.price >= a.threshold;
    if (across && !a.notified_at) {
      let delivered = false;
      if (a.chat_id) {
        try {
          await send(a.chat_id, alertMessage(a, p));
          delivered = true;
        } catch (e) {
          log(`[alerts] ${a.ticker} for account ${a.user_id}: ${e.message}`);
          // 403: the user blocked the bot or deleted the chat — stop trying
          if (e.code === 403) db.prepare("UPDATE users SET telegram_chat_id = NULL, telegram_name = NULL WHERE id = ?").run(a.user_id);
        }
      }
      if (push && a.has_phone && await push(a.user_id, alertPush(a, p), { log })) delivered = true;
      if (delivered) {
        db.prepare("UPDATE alerts SET notified_at = ? WHERE id = ?").run(new Date().toISOString(), a.id);
        sent++;
      }
    } else if (!across && a.notified_at) {
      db.prepare("UPDATE alerts SET notified_at = NULL WHERE id = ?").run(a.id);
    }
  }
  return { checked: rows.length, sent };
}

// Indian time without a timezone library: IST is UTC+5:30 all year
function istNow() {
  const d = new Date(Date.now() + 330 * 60_000);
  return { weekday: d.getUTCDay() >= 1 && d.getUTCDay() <= 5, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
// Through to 15:45, so the closing minutes are checked too
export const marketHours = t => t.weekday && t.minutes >= 9 * 60 + 15 && t.minutes <= 15 * 60 + 45;

export function startAlertChecks({ everyMs = 15 * 60_000, log = console.error } = {}) {
  const tick = async () => {
    if ((!telegramToken() && !pushReady()) || !marketHours(istNow())) return;
    try {
      const { checked, sent } = await notifyAlerts({ log });
      if (sent) log(`[alerts] sent ${sent} of ${checked} checked`);
    } catch (e) {
      log(`[alerts] ${e.message}`);
    }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, everyMs);
}
