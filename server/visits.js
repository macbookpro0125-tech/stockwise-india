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
//   detail      per day, by page, by where people came from (the address a
//               link came from, as a site's name), by device, by hour and by
//               country (from the address, looked up on this server) —
//               visitors (each once) and page loads; never more than the name
//
// Counted: a page itself (the app, a company page, the methodology…), not
// its data, pictures or scripts; never a robot, a link preview or a
// prefetch. From 30 Oct 2026 only once the page has started in a browser
// (the app's own signal, countBrowserVisit): most robots never run a page's
// scripts, and they had been most of the "visitors" — US computers with no
// link, opening only the front page. Signed-in people: each account once a day, when the app asks who
// is signed in (/api/auth/me).
import { createHmac, randomBytes } from "node:crypto";
import { extname } from "node:path";
import { db } from "./db.js";
import { clientIp } from "./rate-limit.js";
import geoip from "geoip-country";

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
  -- a day's visitors and page loads by page, source, device and hour
  CREATE TABLE IF NOT EXISTS visit_parts (
    day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
    visitors INTEGER NOT NULL DEFAULT 0, page_loads INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, kind, key)
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
function firstTime(period, what, secretPeriod = period) {
  const code = createHmac("sha256", secretFor(secretPeriod)).update(what).digest("base64url").slice(0, 22);
  return db.prepare("INSERT OR IGNORE INTO visit_seen (period, code) VALUES (?, ?)").run(period, code).changes === 1;
}

// A day's or week's secret and codes are dropped once it's over; the totals stay
let lastSweep = null;
function sweep(now) {
  const day = istDay(now), week = istWeek(now);
  if (lastSweep === day) return;
  lastSweep = day;
  const keep = [`d:${day}`, `w:${week}`, `u:${day}`];
  db.prepare(`DELETE FROM visit_seen WHERE period NOT IN (${keep.map(() => "?").join(",")}) AND period NOT LIKE ?`).run(...keep, `d:${day}|%`);
  // the detail is kept two months
  db.prepare("DELETE FROM visit_parts WHERE day < ?").run(istDay(now - 60 * 86_400_000));
  db.prepare(`DELETE FROM visit_secrets WHERE period NOT IN (${keep.map(() => "?").join(",")})`).run(...keep);
}

const bump = (day, column) => db.prepare(`INSERT INTO visit_days (day, ${column}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${column} = ${column} + 1`).run(day);

// The page, by its kind of address — anything else (a mistyped address) is
// "Other", so the list can't fill with junk
const FIXED = new Set(["/", "/about", "/help", "/methodology", "/privacy", "/disclaimer", "/stock-screener-india", "/screens", "/sectors", "/results-calendar", "/explore", "/news", "/learn", "/reset-password"]);
export function pageKey(pathname) {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (FIXED.has(p)) return p;
  const m = /^\/(stock|sector|screens|learn)\/([A-Za-z0-9&_.%-]{1,60})$/.exec(p);
  if (m) return `/${m[1]}/${m[1] === "stock" ? decodeURIComponent(m[2]).toUpperCase() : m[2].toLowerCase()}`;
  return "Other";
}

// Where a visit came from, by the site a link was on (the Referer); nothing
// more of the address than the site's name
const SOURCES = [
  [/(^|\.)google\./, "Google"], [/(^|\.)(bing|duckduckgo|yahoo|ecosia|yandex)\./, "Other search"],
  [/whatsapp|^wa\.me$/, "WhatsApp"], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X (Twitter)"],
  [/reddit/, "Reddit"], [/facebook|fb\.|instagram/, "Facebook or Instagram"], [/linkedin|lnkd\.in/, "LinkedIn"],
  [/youtube|youtu\.be/, "YouTube"], [/(^|\.)t\.me$|telegram/, "Telegram"],
];
export function sourceOf(req) {
  const ref = req.headers.referer ?? req.headers.referrer ?? "";
  if (!ref) return "Typed, bookmark or app";
  if (/^android-app:\/\/com\.google/.test(ref)) return "Google";
  let host;
  try { host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase(); } catch { return "Other site"; }
  const own = (req.headers.host ?? "").replace(/:\d+$/, "").replace(/^www\./, "").toLowerCase();
  if (host === own || host === "jocularinsights.in" || host.endsWith(".onrender.com")) return "Within the site";
  return SOURCES.find(([re]) => re.test(host))?.[1] ?? (host.length <= 40 ? host : "Other site");
}

// The Android app's web view says "wv"
export function deviceOf(ua = "") {
  if (/; wv\)/.test(ua)) return "Android app";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Phone";
  return "Computer";
}

// The visitor's country: Cloudflare's own header when it sends one, else the
// address looked up in a country list kept on this server (geoip-country,
// MaxMind's GeoLite2) — no outside service is asked, and only the country is kept
export function countryOf(req) {
  const cf = String(req.headers["cf-ipcountry"] ?? "").toUpperCase();
  if (/^[A-Z]{2}$/.test(cf) && cf !== "XX" && cf !== "T1") return cf;
  try { return geoip.lookup(clientIp(req))?.country ?? "Unknown"; } catch { return "Unknown"; }
}

function countPart(day, kind, key, who) {
  const first = firstTime(`d:${day}|${kind}|${key}`, who, `d:${day}`);
  db.prepare(`INSERT INTO visit_parts (day, kind, key, visitors, page_loads) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(day, kind, key) DO UPDATE SET page_loads = page_loads + 1, visitors = visitors + excluded.visitors`).run(day, kind, key, first ? 1 : 0);
}

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
    const ua = req.headers["user-agent"] ?? "";
    countPart(day, "page", pageKey(pathname), who);
    countPart(day, "source", sourceOf(req), who);
    countPart(day, "device", deviceOf(ua), who);
    countPart(day, "hour", ist(now).toISOString().slice(11, 13), who);
    countPart(day, "country", countryOf(req), who);
    return true;
  } catch (e) {
    console.error(`[visits] ${e.message}`);
    return false;
  }
}

// The app's signal that it started in a browser (main.jsx → POST /api/visit):
// counted as the page load it reports — its address, and the link it came
// from as the page saw it (document.referrer). Only from this site's own
// pages (the browser says same-origin), so another site can't add visits.
export function countBrowserVisit(req, { path, referrer } = {}, now = Date.now()) {
  if (req.method !== "POST" || typeof path !== "string" || !path.startsWith("/") || path.length > 300) return false;
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin") return false;
  const headers = { ...req.headers, accept: "text/html" };
  delete headers.referer;
  if (typeof referrer === "string" && /^https?:\/\//.test(referrer) && referrer.length <= 500) headers.referer = referrer;
  return countPageLoad({ method: "GET", headers, socket: req.socket }, path.split(/[?#]/)[0], now);
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

// The owner's page: the last 30 days, the last 8 weeks, and the accounts
export function visitStats(now = Date.now()) {
  const days = db.prepare("SELECT day, visitors, page_loads AS pageLoads, active_users AS activeUsers FROM visit_days ORDER BY day DESC LIMIT 30").all();
  const weeks = db.prepare("SELECT week, visitors FROM visit_weeks ORDER BY week DESC LIMIT 8").all();
  // sign-ups by IST day, from the accounts themselves
  const since = new Date(Date.parse(`${days.at(-1)?.day ?? istDay(now)}T00:00:00+05:30`)).toISOString();
  const signups = Object.fromEntries(db.prepare(`
    SELECT substr(datetime(created_at, '+330 minutes'), 1, 10) AS day, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY day
  `).all(since).map(r => [r.day, r.n]));
  // the detail, today and over the last 7 days (each day's visitors added up)
  const today = istDay(now), from7 = istDay(now - 6 * 86_400_000), from30 = istDay(now - 29 * 86_400_000);
  const parts = (from, to) => {
    const out = {};
    for (const r of db.prepare(`SELECT kind, key, SUM(visitors) AS visitors, SUM(page_loads) AS pageLoads FROM visit_parts
      WHERE day >= ? AND day <= ? GROUP BY kind, key ORDER BY visitors DESC, pageLoads DESC`).all(from, to)) (out[r.kind] ??= []).push({ key: r.key, visitors: r.visitors, pageLoads: r.pageLoads });
    return out;
  };
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
    detail: { today: parts(today, today), last7: parts(from7, today), last30: parts(from30, today) },
    detailSince: db.prepare("SELECT MIN(day) AS d FROM visit_parts").get().d,
  };
}

// Who may see them: the emails in OWNER_EMAILS (Render's environment)
export function isOwner(email, env = process.env) {
  const owners = String(env.OWNER_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return !!email && owners.includes(String(email).toLowerCase());
}
