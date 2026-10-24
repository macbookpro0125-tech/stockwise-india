// What brings people back (24 Oct 2026), about the companies they starred:
//
//   a results reminder   the evening before a starred company's board meeting
//                        for results (NSE's calendar), a phone notification —
//                        one for all of an account's companies that day, once
//   a weekly email       Sunday morning: each starred company's week (price
//                        move), its news, and who reports results in the coming
//                        week. Only for accounts that turned it on (Settings),
//                        with a one-click unsubscribe in every email; once a week
//
// Figures and filings only — what happened, not what to do.
import { randomBytes } from "node:crypto";
import { db } from "./db.js";
import { allMetrics } from "./screen.js";
import { watchlistNews } from "./market-news.js";
import { pushReady, pushToUser } from "./push.js";
import { emailConfigured, sendEmail, appUrl } from "./email.js";
import { niceName } from "../src/stockName.js";

// the reminders sent, so each goes once
db.exec(`
  CREATE TABLE IF NOT EXISTS results_reminders (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    meeting TEXT NOT NULL,
    PRIMARY KEY (user_id, symbol, meeting)
  );
`);
function addColumn(table, column, type) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
// the weekly email: on or off, the week it was last sent, and the token its
// unsubscribe link carries (so the link works without signing in)
addColumn("users", "weekly_email", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "weekly_email_sent", "TEXT");
addColumn("users", "email_token", "TEXT");

const DAY = 86_400_000;
const ist = now => new Date(now + 330 * 60_000);
const istDay = now => ist(now).toISOString().slice(0, 10);
const longDay = iso => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const rs = v => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const move = v => (v == null || !isFinite(v) ? null : `${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(v).toFixed(1)}%`);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const watchlistOf = userId => db.prepare("SELECT ticker FROM watchlist WHERE user_id = ?").all(userId).map(r => r.ticker);
const rowsBySymbol = () => new Map((allMetrics().rows ?? []).map(r => [r.symbol, r]));

// ---- The results reminder ---------------------------------------------------

// The message for an account's companies reporting tomorrow; null for none
export function reminderPush(companies, meeting) {
  if (!companies.length) return null;
  const names = companies.map(c => niceName(c.name || c.symbol));
  if (companies.length === 1) {
    return { title: `${names[0]} announces its results tomorrow`, body: `The board meets on ${longDay(meeting)} for its quarterly results, on NSE's calendar.`, data: { stock: companies[0].symbol } };
  }
  return {
    title: `${companies.length} of your companies announce results tomorrow`,
    body: `${names.slice(0, 4).join(", ")}${names.length > 4 ? ` and ${names.length - 4} more` : ""}: board meetings on ${longDay(meeting)}.`,
    data: { tab: "watchlist" },
  };
}

// push: (userId, message) => Promise<boolean>, injectable for the tests
export async function sendResultsReminders({ push = pushToUser, now = Date.now(), log = console.error } = {}) {
  const tomorrow = istDay(now + DAY);
  const rows = rowsBySymbol();
  const users = db.prepare("SELECT DISTINCT user_id AS id FROM push_tokens").all();
  let sent = 0;
  for (const { id } of users) {
    const due = watchlistOf(id).map(s => rows.get(s)).filter(r => r?.nextResults === tomorrow)
      .filter(r => !db.prepare("SELECT 1 FROM results_reminders WHERE user_id = ? AND symbol = ? AND meeting = ?").get(id, r.symbol, tomorrow));
    const message = reminderPush(due, tomorrow);
    if (!message) continue;
    if (await push(id, message, { log })) sent++;
    // marked either way: a phone that can't be reached isn't sent it every 15 minutes
    for (const r of due) db.prepare("INSERT OR IGNORE INTO results_reminders (user_id, symbol, meeting) VALUES (?, ?, ?)").run(id, r.symbol, tomorrow);
  }
  db.prepare("DELETE FROM results_reminders WHERE meeting < ?").run(istDay(now - 30 * DAY));
  return { users: users.length, sent };
}

// ---- The weekly email -------------------------------------------------------

export function emailToken(userId) {
  const row = db.prepare("SELECT email_token FROM users WHERE id = ?").get(userId);
  if (row?.email_token) return row.email_token;
  const token = randomBytes(24).toString("base64url");
  db.prepare("UPDATE users SET email_token = ? WHERE id = ?").run(token, userId);
  return token;
}
export const weeklyEmailOn = userId => !!db.prepare("SELECT weekly_email FROM users WHERE id = ?").get(userId)?.weekly_email;
export function setWeeklyEmail(userId, on) {
  db.prepare("UPDATE users SET weekly_email = ? WHERE id = ?").run(on ? 1 : 0, userId);
  if (on) emailToken(userId);
}
// The unsubscribe link: off, by its token; true if it matched an account
export function unsubscribe(token) {
  if (!token || typeof token !== "string" || token.length > 100) return false;
  return db.prepare("UPDATE users SET weekly_email = 0 WHERE email_token = ?").run(token).changes > 0;
}

// The email for an account: its starred companies' week, their news, and the
// results coming up; null when there's nothing to say (no starred companies)
export async function weeklyEmail(userId, { now = Date.now() } = {}) {
  const symbols = watchlistOf(userId);
  if (!symbols.length) return null;
  const rows = rowsBySymbol();
  const companies = symbols.map(s => rows.get(s)).filter(Boolean)
    .map(r => ({ symbol: r.symbol, name: niceName(r.name || r.symbol), price: r.cmp ?? null, week: r.ret1w ?? null, next: r.nextResults ?? null }))
    .sort((a, b) => (b.week ?? -Infinity) - (a.week ?? -Infinity));
  if (!companies.length) return null;
  const today = istDay(now), weekOut = istDay(now + 7 * DAY);
  const results = companies.filter(c => c.next && c.next >= today && c.next <= weekOut).sort((a, b) => a.next.localeCompare(b.next));
  const news = (await watchlistNews(new Set(symbols), new Date(now - 7 * DAY).toISOString()).catch(() => [])).slice(0, 8);
  const site = appUrl() || "https://jocularinsights.in";
  const unsub = `${site}/unsubscribe?t=${encodeURIComponent(emailToken(userId))}`;
  const stockUrl = s => `${site}/stock/${encodeURIComponent(s)}`;
  const about = i => niceName(i.company ?? i.companies?.find(c => symbols.includes(c.symbol))?.name ?? i.publisher ?? "");

  const subject = results.length
    ? `Your watchlist this week · ${results.length} ${results.length === 1 ? "company reports" : "companies report"} results`
    : "Your watchlist this week";
  const text = [
    "Your starred companies this week, at the latest close:",
    "",
    ...companies.map(c => `${c.name}: ${c.price != null ? rs(c.price) : "—"}${move(c.week) ? `, ${move(c.week)} this week` : ""}`),
    ...(results.length ? ["", "Results coming up:", ...results.map(c => `${longDay(c.next)}: ${c.name}`)] : []),
    ...(news.length ? ["", "Their news:", ...news.map(i => `${about(i)}: ${i.summary || i.title}`)] : []),
    "",
    `Open your watchlist: ${site}`,
    "",
    "Figures and filings, not advice.",
    `Stop these emails: ${unsub}`,
  ].join("\n");
  const td = "padding:8px 0;border-bottom:1px solid #eaecf0";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#101828;max-width:560px">
<p style="font-size:18px;font-weight:600;margin:0 0 4px">Your watchlist this week</p>
<p style="color:#475467;margin:0 0 16px">Your starred companies at the latest close.</p>
<table style="width:100%;border-collapse:collapse">${companies.map(c => `<tr><td style="${td}"><a href="${esc(stockUrl(c.symbol))}" style="color:#0b7a68;text-decoration:none">${esc(c.name)}</a></td><td style="${td};text-align:right">${c.price != null ? esc(rs(c.price)) : "—"}</td><td style="${td};text-align:right;color:${(c.week ?? 0) >= 0 ? "#15803D" : "#B91C1C"}">${esc(move(c.week) ?? "")}</td></tr>`).join("")}</table>
${results.length ? `<p style="font-size:16px;font-weight:600;margin:22px 0 6px">Results coming up</p><ul style="margin:0;padding-left:18px">${results.map(c => `<li>${esc(longDay(c.next))}: <a href="${esc(stockUrl(c.symbol))}" style="color:#0b7a68">${esc(c.name)}</a></li>`).join("")}</ul>` : ""}
${news.length ? `<p style="font-size:16px;font-weight:600;margin:22px 0 6px">Their news</p><ul style="margin:0;padding-left:18px">${news.map(i => `<li><b>${esc(about(i))}</b>: ${esc(i.summary || i.title)}</li>`).join("")}</ul>` : ""}
<p style="margin:24px 0"><a href="${esc(site)}" style="display:inline-block;background:#14B892;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Open your watchlist</a></p>
<p style="color:#667085;font-size:12px">Figures and filings, not advice. You get this because you turned on the weekly email. <a href="${esc(unsub)}" style="color:#667085">Stop these emails</a>.</p>
</div>`;
  return { subject, text, html, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
}

// Sunday from 9 am IST, each account that turned it on, once that week.
// send: (message) => Promise, injectable for the tests
export async function sendWeeklyEmails({ send = sendEmail, now = Date.now(), log = console.error } = {}) {
  const week = istDay(now);
  const users = db.prepare("SELECT id, email FROM users WHERE weekly_email = 1 AND email IS NOT NULL AND (weekly_email_sent IS NULL OR weekly_email_sent < ?)").all(week);
  let sent = 0;
  for (const u of users) {
    try {
      const message = await weeklyEmail(u.id, { now });
      if (message) { await send({ to: u.email, ...message }); sent++; }
      db.prepare("UPDATE users SET weekly_email_sent = ? WHERE id = ?").run(week, u.id);
    } catch (e) {
      log(`[weekly-email] account ${u.id}: ${e.message}`);
    }
  }
  return { users: users.length, sent };
}

// Every 15 minutes: the reminders from 6 pm IST, the email Sunday from 9 am
export function startDigestJobs({ everyMs = 15 * 60_000, log = console.error } = {}) {
  const tick = async () => {
    const t = ist(Date.now()), h = t.getUTCHours();
    try {
      if (pushReady() && h >= 18 && h < 22) {
        const { sent } = await sendResultsReminders({ log });
        if (sent) log(`[results-reminder] sent to ${sent} account${sent === 1 ? "" : "s"}`);
      }
      if (emailConfigured() && t.getUTCDay() === 0 && h >= 9 && h < 12) {
        const { sent } = await sendWeeklyEmails({ log });
        if (sent) log(`[weekly-email] sent ${sent}`);
      }
    } catch (e) {
      log(`[digest] ${e.message}`);
    }
  };
  setTimeout(tick, 3 * 60_000);
  setInterval(tick, everyMs);
}
