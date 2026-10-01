// Telegram alerts: a bot (made with @BotFather; its key in TELEGRAM_BOT_TOKEN,
// never in the code) that each account links to once, then sends that chat
// its alerts (alert-notifier.js).
//
// Linking: the app makes a one-time code and opens t.me/<bot>?start=<code>;
// the user taps Start, the bot receives "/start <code>" and ties that chat to
// the account. Updates come by long polling rather than a webhook, so it works
// on a laptop with no public address as well as on a host. Only one process
// may poll a bot at a time — Telegram answers a second with 409 — so test
// copies (DATA_JOBS=off) don't poll.
import { randomBytes } from "node:crypto";
import { db } from "./db.js";

const API = "https://api.telegram.org";
const LINK_TTL_MS = 15 * 60 * 1000;

export const telegramToken = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim() || null;

// Errors carry Telegram's description, never the request URL (it holds the key)
async function call(method, params = {}, { timeoutMs = 15000 } = {}) {
  const token = telegramToken();
  if (!token) throw new Error("Telegram isn't set up (no TELEGRAM_BOT_TOKEN)");
  let res;
  try {
    res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(`Telegram ${method}: couldn't reach Telegram (${e.name})`);
  }
  const body = await res.json().catch(() => null);
  if (!body?.ok) {
    throw Object.assign(new Error(`Telegram ${method}: ${body?.description ?? `HTTP ${res.status}`}`), { code: body?.error_code ?? res.status });
  }
  return body.result;
}

// The bot's own details (its username makes the t.me link); null when no key
// is set or Telegram rejects it
let me = null;
export async function botInfo() {
  if (!telegramToken()) return null;
  if (!me) me = await call("getMe");
  return me;
}

export const escapeHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sendTelegram(chatId, html) {
  return call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

// A fresh code for this account, replacing any it had; old codes expire
export function linkCode(userId) {
  const code = randomBytes(12).toString("base64url");
  db.prepare("DELETE FROM telegram_links WHERE user_id = ? OR expires_at < ?").run(userId, new Date().toISOString());
  db.prepare("INSERT INTO telegram_links (code, user_id, expires_at) VALUES (?, ?, ?)")
    .run(code, userId, new Date(Date.now() + LINK_TTL_MS).toISOString());
  return code;
}

export function telegramChat(userId) {
  const u = db.prepare("SELECT telegram_chat_id, telegram_name FROM users WHERE id = ?").get(userId);
  return u?.telegram_chat_id != null ? { chatId: u.telegram_chat_id, name: u.telegram_name } : null;
}

export function unlinkTelegram(userId) {
  db.prepare("UPDATE users SET telegram_chat_id = NULL, telegram_name = NULL WHERE id = ?").run(userId);
}

const unlinkChat = chatId =>
  db.prepare("UPDATE users SET telegram_chat_id = NULL, telegram_name = NULL WHERE telegram_chat_id = ?").run(chatId).changes;

// One message from Telegram -> [chatId, reply] or null. Exported for the tests.
export function handleTelegramUpdate(update) {
  const msg = update?.message;
  if (!msg?.chat || msg.chat.type !== "private") return null;
  const chatId = msg.chat.id;
  const text = String(msg.text ?? "").trim();
  const start = text.match(/^\/start(?:\s+([\w-]+))?$/);
  if (start?.[1]) {
    const row = db.prepare("SELECT user_id, expires_at FROM telegram_links WHERE code = ?").get(start[1]);
    if (!row || row.expires_at < new Date().toISOString()) {
      return [chatId, "That link has expired. In Stockwise India, open Alerts and press Connect Telegram for a new one."];
    }
    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || null;
    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM telegram_links WHERE code = ?").run(start[1]);
      // A chat belongs to one account, an account to one chat
      unlinkChat(chatId);
      db.prepare("UPDATE users SET telegram_chat_id = ?, telegram_name = ? WHERE id = ?").run(chatId, name, row.user_id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return [chatId, "Connected. Your Stockwise India price alerts will arrive in this chat.\n\nSend /stop to disconnect."];
  }
  if (/^\/stop\b/.test(text)) {
    return [chatId, unlinkChat(chatId) ? "Disconnected. No more alerts will be sent here." : "This chat isn't connected to a Stockwise India account."];
  }
  return [chatId, "This bot sends Stockwise India price alerts. To connect it, open the app, go to Alerts and press Connect Telegram."];
}

let polling = false;
export function startTelegramPolling({ log = console.error } = {}) {
  if (polling || !telegramToken()) return;
  polling = true;
  let offset = 0;
  (async () => {
    while (polling) {
      try {
        const updates = await call("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] }, { timeoutMs: 65000 });
        for (const u of updates) {
          offset = u.update_id + 1;
          const reply = handleTelegramUpdate(u);
          if (reply) await sendTelegram(reply[0], escapeHtml(reply[1])).catch(e => log(`[telegram] reply: ${e.message}`));
        }
      } catch (e) {
        log(`[telegram] ${e.message}`);
        // 401: the key is wrong; 409: another copy is polling this bot
        const wait = e.code === 401 ? 10 * 60_000 : e.code === 409 ? 60_000 : 5_000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  })();
}
