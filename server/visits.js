// How many people use the site (24 Oct 2026, "can I know how many visitors
// came this week"), counted without cookies or any outside service, and
// without keeping anything that identifies anyone:
//
//   a visitor   the address and browser of a page load, turned into a code
//               with a secret random value; one secret per day and one per
//               week, each thrown away when its day or week is over, so the
//               codes can't be turned back or matched across days
//   kept        totals per day (visitors, page loads, signed-in people active)
//               and per week (visitors); the codes only until their day or
//               week ends, to count each person once
//
// Counted: a page itself (the app, a company page, the methodology…), not
// its data, pictures or scripts; never a robot, a link preview or a
// prefetch. Signed-in people: each account once a day, when the app asks who
// is signed in (/api/auth/me).
import { createHmac, randomBytes } from "node:crypto";
import { extname } from "node:path";
import { db } from "./db.js";
import { clientIp } from "./rate-limit.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS visit_days (
    day TEXT PRIMARY KEY,
    visitors INTEGER NOT NULL DEFAULT 0,
    page_loads INTEGER NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS visit_weeks (
    week TEXT PRIMARY KEY,
    visitors INTEGER NOT NULL DEFAULT 0
  );
  -- the period's secret and the codes seen in it; both gone when it ends
  CREATE TABLE IF NOT EXISTS visit_secrets (period TEXT PRIMARY KEY, secret TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS visit_seen (period TEXT NOT NULL, code TEXT NOT NULL, PRIMARY KEY (period, code));
`);

// Indian dates: IST is UTC+5:30 all year
const ist = (now = Date.now()) => new Date(now + 330 * 60_000);
export const istDay = (now = Date.now()) => ist(now).toISOString().slice(0, 10);
// the week by its Monday
export function istWeek(now = Date.now()) {
  const d = ist(now);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|whatsapp|telegram|slack|discord|preview|monitor|uptime|pingdom|lighthouse|headless|phantom|python|curl|wget|httpclient|node-fetch|axios|go-http|java\/|okhttp|render/i;

// Whether this request is a person loading a page
export function isPageLoad(req, pathname) {
  if (req.method !== "GET") return false;
  if (pathname.startsWith("/api/") || pathname.startsWith("/assets/")) return false;
  const ext = extname(pathname);
  if (ext && ext !== ".html") return false;
  if (!/text\/html/.test(req.headers.accept ?? "")) return false;
  const purpose = `${req.headers["sec-purpose"] ?? ""} ${req.headers.purpose ?? ""} ${req.headers["x-moz"] ?? ""}`;
  if (/prefetch|prerender|preview/i.test(purpose)) return false;
  const ua = req.headers["user-agent"] ?? "";
  return !!ua && !BOT.test(ua);
}

function secretFor(period) {
  const row = db.prepare("SELECT secret FROM visit_secrets WHERE period = ?").get(period);
  if (row) return row.secret;
  const secret = randomBytes(32).toString("hex");
  db.prepare("INSERT OR IGNORE INTO visit_secrets (period, secret) VALUES (?, ?)").run(period, secret);
  return db.prepare("SELECT secret FROM visit_secrets WHERE period = ?").get(period).secret;
}

// First time this code is seen in the period? Records it if so.
function firstTime(period, what) {
  const code = createHmac("sha256", secretFor(period)).update(what).digest("base64url").slice(0, 22);
  return db.prepare("INSERT OR IGNORE INTO visit_seen (period, code) VALUES (?, ?)").run(period, code).changes === 1;
}

// A day's or week's secret and codes are dropped once it's over; the totals stay
let lastSweep = null;
function sweep(now) {
  const day = istDay(now), week = istWeek(now);
  if (lastSweep === day) return;
  lastSweep = day;
  const keep = [`d:${day}`, `w:${week}`, `u:${day}`];
  db.prepare(`DELETE FROM visit_seen WHERE period NOT IN (${keep.map(() => "?").join(",")})`).run(...keep);
  db.prepare(`DELETE FROM visit_secrets WHERE period NOT IN (${keep.map(() => "?").join(",")})`).run(...keep);
}

const bump = (day, column) => db.prepare(`INSERT INTO visit_days (day, ${column}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${column} = ${column} + 1`).run(day);

// A page load; never throws — counting must not stop a page
export function countPageLoad(req, pathname, now = Date.now()) {
  try {
    if (!isPageLoad(req, pathname)) return false;
    sweep(now);
    const day = istDay(now), week = istWeek(now);
    const who = `${clientIp(req)}|${req.headers["user-agent"] ?? ""}`;
    bump(day, "page_loads");
    if (firstTime(`d:${day}`, who)) bump(day, "visitors");
    if (firstTime(`w:${week}`, who)) db.prepare("INSERT INTO visit_weeks (week, visitors) VALUES (?, 1) ON CONFLICT(week) DO UPDATE SET visitors = visitors + 1").run(week);
    return true;
  } catch (e) {
    console.error(`[visits] ${e.message}`);
    return false;
  }
}

// A signed-in account opening the app: once a day each
export function countActive(userId, now = Date.now()) {
  try {
    sweep(now);
    const day = istDay(now);
    if (firstTime(`u:${day}`, `user:${userId}`)) bump(day, "active_users");
  } catch (e) {
    console.error(`[visits] ${e.message}`);
  }
}

// The owner's page: the last 14 days, the last 8 weeks, and the accounts
export function visitStats(now = Date.now()) {
  const days = db.prepare("SELECT day, visitors, page_loads AS pageLoads, active_users AS activeUsers FROM visit_days ORDER BY day DESC LIMIT 14").all();
  const weeks = db.prepare("SELECT week, visitors FROM visit_weeks ORDER BY week DESC LIMIT 8").all();
  // sign-ups by IST day, from the accounts themselves
  const since = new Date(Date.parse(`${days.at(-1)?.day ?? istDay(now)}T00:00:00+05:30`)).toISOString();
  const signups = Object.fromEntries(db.prepare(`
    SELECT substr(datetime(created_at, '+330 minutes'), 1, 10) AS day, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY day
  `).all(since).map(r => [r.day, r.n]));
  const week = istWeek(now);
  const weekStart = new Date(Date.parse(`${week}T00:00:00+05:30`)).toISOString();
  return {
    today: istDay(now),
    week,
    days: days.map(d => ({ ...d, signups: signups[d.day] ?? 0 })),
    weeks,
    accounts: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    signupsThisWeek: db.prepare("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?").get(weekStart).n,
    since: db.prepare("SELECT MIN(day) AS d FROM visit_days").get().d,
  };
}

// Who may see them: the emails in OWNER_EMAILS (Render's environment)
export function isOwner(email, env = process.env) {
  const owners = String(env.OWNER_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!email && owners.includes(String(email).toLowerCase());
}
