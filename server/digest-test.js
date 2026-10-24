// The results reminder and the weekly email (digest.js)
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "digest-test.db");
process.env.STOCKWISE_DB = DB_PATH; // never the real app.db
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
process.env.APP_URL = "https://jocularinsights.in";

const { reminderPush, sendResultsReminders, weeklyEmail, sendWeeklyEmails, setWeeklyEmail, weeklyEmailOn, unsubscribe, emailToken } = await import("./digest.js");
const { db } = await import("./db.js");
const { allMetrics } = await import("./screen.js");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

// the wording
const one = reminderPush([{ symbol: "TCS", name: "TATA CONSULTANCY SERVICES LIMITED" }], "2026-10-26");
assert(one.title === "Tata Consultancy Services announces its results tomorrow" && /Mon, 26 Oct/.test(one.body) && one.data.stock === "TCS", "one company: its name, the day, and it opens the company");
const many = reminderPush([{ symbol: "A", name: "Alpha Ltd" }, { symbol: "B", name: "Beta Ltd" }, { symbol: "C", name: "Gamma Ltd" }], "2026-10-27");
assert(many.title === "3 of your companies announce results tomorrow" && many.body.startsWith("Alpha, Beta, Gamma:") && many.data.tab === "watchlist", "several: one message, opening the Watchlist");
assert(reminderPush([], "2026-10-27") === null, "none, no message");

// an account with a phone and a starred company that reports on a known day
const rows = allMetrics().rows ?? [];
const reporting = rows.find(r => r.name && r.nextResults && r.cmp);
const other = rows.find(r => r.name && r.cmp && r.symbol !== reporting?.symbol && r.nextResults !== reporting?.nextResults);
if (!reporting || !other) { console.log("skip: no company with a results date in the local data"); process.exit(0); }
const now = Date.parse(`${reporting.nextResults}T13:00:00Z`) - 86_400_000; // 6:30 pm IST the day before
const userId = db.prepare("INSERT INTO users (email, password_hash, password_salt, created_at) VALUES ('d@example.com', 'x', 'y', ?)").run(new Date().toISOString()).lastInsertRowid;
db.prepare("INSERT INTO watchlist (user_id, ticker, added_at) VALUES (?, ?, ?), (?, ?, ?)").run(userId, reporting.symbol, "2026-10-01", userId, other.symbol, "2026-10-01");
db.prepare("INSERT INTO push_tokens (token, user_id, platform, created_at) VALUES ('tok-1234567890abcdefghij', ?, 'android', ?)").run(userId, new Date().toISOString());

const pushed = [];
const push = async (id, message) => { pushed.push({ id, message }); return true; };
await sendResultsReminders({ push, now });
assert(pushed.length === 1 && pushed[0].id === userId && pushed[0].message.data.stock === reporting.symbol, "the evening before: a reminder for the starred company that reports, not the other");
await sendResultsReminders({ push, now: now + 15 * 60_000 });
assert(pushed.length === 1, "once, not every 15 minutes");

// the weekly email: only once turned on, once a week, with a way out
const sent = [];
const send = async m => { sent.push(m); };
await sendWeeklyEmails({ send, now });
assert(sent.length === 0 && !weeklyEmailOn(userId), "off unless turned on");
setWeeklyEmail(userId, true);
await sendWeeklyEmails({ send, now });
assert(sent.length === 1 && sent[0].to === "d@example.com", "turned on: sent");
const m = sent[0];
const { niceName } = await import("../src/stockName.js");
assert(/^Your watchlist this week · [12] compan(y reports|ies report) results$/.test(m.subject) && m.text.includes(niceName(reporting.name)) && m.text.includes(niceName(other.name)), "the subject says who reports; both companies are in it");
const { writeFileSync } = await import("node:fs");
if (process.env.DIGEST_PREVIEW) writeFileSync(process.env.DIGEST_PREVIEW, m.html);
assert(m.html.includes(`/stock/${encodeURIComponent(reporting.symbol)}`) && m.html.includes(`/stock/${encodeURIComponent(other.symbol)}`), "each starred company, linked");
assert(/Results coming up/.test(m.text), "the results coming up this week");
const token = emailToken(userId);
assert(m.headers["List-Unsubscribe"] === `<https://jocularinsights.in/unsubscribe?t=${token}>` && m.html.includes(`/unsubscribe?t=${token}`), "a one-click unsubscribe, in the header and the email");
assert(/not advice/.test(m.text), "says it isn't advice");
await sendWeeklyEmails({ send, now: now + 60 * 60_000 });
assert(sent.length === 1, "once a week");

assert(unsubscribe(token) === true && !weeklyEmailOn(userId), "the link turns it off");
assert(unsubscribe("not-a-token") === false && unsubscribe("") === false, "a wrong link changes nothing");

// nothing starred, nothing sent
db.prepare("DELETE FROM watchlist WHERE user_id = ?").run(userId);
assert(await weeklyEmail(userId, { now }) === null, "no starred companies, no email");

db.close();
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
console.log("digest tests passed");
