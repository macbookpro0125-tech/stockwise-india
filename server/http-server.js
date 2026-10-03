// Plain node:http, no framework — consistent with the rest of this project
// staying dependency-light (node:sqlite, node:crypto, plain fetch so far).
// Session lives in an httpOnly cookie, not a token handed back in JSON for
// the client to store — a token in localStorage is readable by any script
// on the page, which is exactly what a single XSS bug turns into full
// account takeover. httpOnly means client-side JS can't read it at all.
import "./env.js"; // first, so the rest see .env's settings
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { existsSync, statSync, createReadStream } from "node:fs";
import { join, normalize, extname, sep } from "node:path";
import { signup, login, logout, verifySession, accountInfo, deleteAccount, createPasswordReset, resetPassword, signInWithFirebase } from "./auth.js";
import { firebaseConfig, verifyFirebaseIdToken } from "./firebase-auth.js";
import { emailConfigured, appUrl, sendEmail, resetEmail } from "./email.js";
import { listAlerts, createAlert, updateAlert, deleteAlert } from "./user-alerts.js";
import { screen, screenerMeta, getStock, saveStock, rowsFor, isValidSymbol, countFetched, allMetrics } from "./screen.js";
import { criteriaToFilters, METRICS, CATEGORY_METRICS } from "./metric-catalog.js";
import { listWatchlist, addToWatchlist, setWatchlistNote, removeFromWatchlist } from "./user-watchlist.js";
import { listHoldings, addHolding, updateHolding, removeHolding } from "./user-portfolio.js";
import { getThesis, saveThesis } from "./user-thesis.js";
import { listNotes, saveNote, deleteNote, listStrategies, saveStrategies } from "./user-notes.js";
import { currentPrices } from "./prices.js";
import { getPerformance, takeSnapshots } from "./performance.js";
import { pricePosition } from "./levels.js";
import { fetchCmp, fetchDailyBars, PRICE_RANGES } from "./quote.js";
import { fetchStockSummary, SCHEMA } from "./fetch-nse.js";
import { fetchEquityList } from "./equity-list.js";
import { computeMetrics } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";
import { startDataJobs, jobStatus } from "./data-jobs.js";
import { botInfo, linkCode, telegramChat, unlinkTelegram, sendTelegram, startTelegramPolling } from "./telegram.js";
import { startAlertChecks } from "./alert-notifier.js";
import { limits, clientIp, waitText } from "./rate-limit.js";
import { startBackups } from "./backup.js";
import { fetchTechnicals } from "./technicals.js";
import { shareholdingHistory, companyFilings, companyNews, sectorPeers } from "./company-extras.js";
import { summarizeFiling } from "./filing-summary.js";
import { PRESETS } from "./presets.js";
import { DIST_DIR } from "./paths.js";
import { HttpError, badRequest, payloadTooLarge } from "./http-errors.js";
import { UpstreamError } from "./upstream.js";

let equityListPromise = null;
function equityList() {
  equityListPromise ??= fetchEquityList().catch(e => { equityListPromise = null; throw e; });
  return equityListPromise;
}
async function equityInfo(symbol) {
  return (await equityList()).find(s => s.symbol === symbol) ?? null;
}

// A symbol typed by hand must be a listed company — a portfolio once took
// "NOT-A-REAL-SYMBOL" and showed it priceless forever. If NSE's list can't
// be fetched just now (undefined), let it through rather than refuse all.
async function unlistedError(symbol) {
  const info = await equityInfo(symbol).catch(() => undefined);
  return info === null ? `${symbol} isn't on NSE's list of listed companies. Check the symbol — e.g. TCS, INFY, HDFCBANK.` : null;
}

// The search box's suggestions (the original's StockSearchBar): NSE's own
// list by symbol or company name — exact symbol first, then symbols starting
// with the text, then names with a word starting with it, then anything
// containing it.
async function searchEquities(q) {
  const text = String(q || "").trim().toUpperCase();
  if (!text) return [];
  const rank = s => {
    const name = s.name.toUpperCase();
    if (s.symbol === text) return 0;
    if (s.symbol.startsWith(text)) return 1;
    if (name.startsWith(text)) return 2;
    if (name.split(/[\s.&-]+/).some(w => w.startsWith(text))) return 3;
    if (s.symbol.includes(text) || name.includes(text)) return 4;
    return null;
  };
  return (await equityList())
    .map(s => ({ s, r: rank(s) }))
    .filter(x => x.r != null)
    .sort((a, b) => a.r - b.r || a.s.symbol.length - b.s.symbol.length)
    .slice(0, 8)
    .map(({ s }) => ({ ticker: s.symbol, name: s.name }));
}

// The built frontend, for a host where this one process serves everything.
// In development Vite serves the frontend and proxies /api here instead.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
  ".woff2": "font/woff2", ".txt": "text/plain", ".webm": "video/webm",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

// Streams the file, and answers Range requests with just the bytes asked
// for: the "How it works" video needs them — Safari won't play a video
// without, and skipping ahead relies on them in every browser.
function serveStatic(req, pathname, res) {
  if (!existsSync(DIST_DIR)) return false;
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return false; }
  let file = normalize(join(DIST_DIR, decoded));
  if (!file.startsWith(DIST_DIR + sep) && file !== DIST_DIR) return false; // no ../ out of dist
  // Anything that isn't a file is the app itself (it has no other pages)
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST_DIR, "index.html");
  const size = statSync(file).size;
  const headers = {
    "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    // Vite puts a content hash in asset file names, so those never change;
    // index.html must be re-checked so a deploy is picked up.
    "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
    "Accept-Ranges": "bytes",
  };
  const send = (status, extra, range) => {
    res.writeHead(status, { ...headers, ...extra });
    createReadStream(file, range).on("error", () => res.destroy()).pipe(res);
  };
  // bytes=500-999, bytes=500- (to the end), bytes=-500 (the last 500). A
  // multi-part range gets the whole file, which the spec allows.
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      res.end();
      return true;
    }
    send(206, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 }, { start, end });
    return true;
  }
  send(200, { "Content-Length": size });
  return true;
}

const COOKIE_NAME = "stockwise_session";
const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // matches auth.js's SESSION_TTL_MS

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    try { out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim()); }
    catch { out[part.slice(0, eq).trim()] = ""; }
  }
  return out;
}

function decodePathSegment(value) {
  try { return decodeURIComponent(value); }
  catch { throw badRequest("URL contains invalid encoding"); }
}

// Secure (sent over HTTPS only) whenever the request came in over HTTPS —
// hosts like Render terminate TLS in front of the app and say so in
// X-Forwarded-Proto. Plain HTTP on localhost in development goes without.
const secureFlag = req => (req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "");

function setSessionCookie(req, res, token) {
  // SameSite=Strict blocks the cookie from being sent on any cross-site
  // request at all — the simplest real CSRF defense, at the cost of
  // needing a same-site redirect (not a bare link) after e.g. an OAuth
  // callback, which this doesn't have yet. Revisit if that's ever added.
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_S}; Path=/${secureFlag(req)}`);
}

function clearSessionCookie(req, res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/${secureFlag(req)}`);
}

// Compressed when the browser accepts it and the body is big enough to
// matter: a screen of the whole market is ~1.3 MB of JSON and about a tenth
// of that gzipped — the difference between a filter feeling live or not.
function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  if (json.length > 2048 && /\bgzip\b/.test(res.req?.headers["accept-encoding"] ?? "")) {
    res.writeHead(status, { "Content-Type": "application/json", "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    res.end(gzipSync(json, { level: 5 }));
    return;
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(json);
}

// The largest body any form here sends is a screen's filters, a few KB — a
// cap keeps one huge request from filling the server's memory
const MAX_BODY_BYTES = 256 * 1024;
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw payloadTooLarge("Request body is too large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  let value;
  try { value = JSON.parse(raw); }
  catch { throw badRequest("Request body must be valid JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest("Request body must be a JSON object");
  return value;
}

function reportUpstreamFailure(res, requestId, error, fallback) {
  // A known, lasting answer (a new listing's short price history, an
  // attachment too large to read) is shown as is — retrying won't change it
  if (error instanceof HttpError) { sendJson(res, error.status, { error: error.message, requestId }); return; }
  const status = error instanceof UpstreamError ? error.status : 502;
  if (error instanceof UpstreamError) console.error(JSON.stringify({ event: "upstream_request_failed", requestId, service: error.service, code: error.code, status: error.status }));
  else console.error(JSON.stringify({ event: "api_dependency_failed", requestId, errorName: error?.name, message: error?.message }));
  sendJson(res, status === 504 ? 504 : status === 503 ? 503 : 502, { error: fallback, requestId });
}

function tooMany(res, ms, message) {
  res.setHeader("Retry-After", String(Math.ceil(ms / 1000)));
  sendJson(res, 429, { error: `${message} Try again in ${waitText(ms)}.` });
}

function requireAuth(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = verifySession(cookies[COOKIE_NAME]);
  if (!userId) {
    sendJson(res, 401, { error: "Not signed in" });
    return null;
  }
  return userId;
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const requestId = randomUUID();
    if (url.pathname.startsWith("/api/")) res.setHeader("X-Request-Id", requestId);
    try {
      if (url.pathname === "/api/auth/signup" && req.method === "POST") {
        const { email, password } = await readJsonBody(req);
        const ip = `ip:${clientIp(req)}`;
        const wait = limits.signupIp.blockedFor(ip);
        if (wait) return tooMany(res, wait, "Too many sign-up attempts from this connection.");
        // Every attempt counts, failed ones too: "already exists" would
        // otherwise let anyone test thousands of emails for an account
        limits.signupIp.hit(ip);
        const { token, userId } = signup(email, password);
        setSessionCookie(req, res, token);
        sendJson(res, 200, { userId });
        return;
      }

      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const { email, password } = await readJsonBody(req);
        // Checked before the password is hashed: a blocked guess costs nothing
        const account = `email:${String(email ?? "").trim().toLowerCase()}`, ip = `ip:${clientIp(req)}`;
        const wait = Math.max(limits.wrongPassword.blockedFor(account), limits.wrongPasswordIp.blockedFor(ip));
        if (wait) return tooMany(res, wait, "Too many wrong passwords.");
        let session;
        try {
          session = login(email, password);
        } catch (e) {
          limits.wrongPassword.hit(account);
          limits.wrongPasswordIp.hit(ip);
          throw e;
        }
        limits.wrongPassword.reset(account);
        setSessionCookie(req, res, session.token);
        sendJson(res, 200, { userId: session.userId });
        return;
      }

      // What the sign-in card can offer: password reset needs email set up;
      // Google / Apple / phone need Firebase (its web config is public)
      if (url.pathname === "/api/auth/options" && req.method === "GET") {
        sendJson(res, 200, { passwordReset: emailConfigured(), firebase: firebaseConfig() });
        return;
      }

      // A Google, Apple or phone sign-in Firebase confirmed in the browser:
      // check its token, then find or make the account and sign in
      if (url.pathname === "/api/auth/firebase" && req.method === "POST") {
        const ip = `ip:${clientIp(req)}`;
        const wait = limits.wrongPasswordIp.blockedFor(ip);
        if (wait) return tooMany(res, wait, "Too many sign-in attempts.");
        const body = await readJsonBody(req);
        let claims;
        try {
          claims = await verifyFirebaseIdToken(body.idToken);
        } catch (e) {
          if (e instanceof UpstreamError) {
            reportUpstreamFailure(res, requestId, e, "Google sign-in is temporarily unavailable. Please try again shortly.");
            return;
          }
          limits.wrongPasswordIp.hit(ip);
          if (e.reason) console.error(`[auth] firebase token refused: ${e.reason}`);
          sendJson(res, 401, { error: e.reason ? e.message : "That sign-in couldn't be confirmed. Please try again." });
          return;
        }
        const { token, userId } = signInWithFirebase(claims);
        setSessionCookie(req, res, token);
        sendJson(res, 200, { userId });
        return;
      }

      // "Forgot password": the same answer whether or not the email has an
      // account, and the email goes out without being waited for, so neither
      // the reply nor its timing says which
      if (url.pathname === "/api/auth/forgot" && req.method === "POST") {
        const email = String((await readJsonBody(req)).email ?? "").trim().toLowerCase();
        if (!email.includes("@")) { sendJson(res, 400, { error: "Enter the email you signed up with." }); return; }
        if (!emailConfigured()) { sendJson(res, 503, { error: "Password reset by email isn't available yet." }); return; }
        const account = `email:${email}`, ip = `ip:${clientIp(req)}`;
        const wait = Math.max(limits.resetEmail.blockedFor(account), limits.resetIp.blockedFor(ip));
        if (wait) return tooMany(res, wait, "Too many reset requests.");
        limits.resetEmail.hit(account);
        limits.resetIp.hit(ip);
        const token = createPasswordReset(email);
        if (token) {
          sendEmail({ to: email, ...resetEmail(`${appUrl()}/reset-password?token=${token}`) })
            .catch(e => console.error(`[email] reset: ${e.message}`));
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/auth/reset" && req.method === "POST") {
        const ip = `ip:${clientIp(req)}`;
        const wait = limits.wrongPasswordIp.blockedFor(ip);
        if (wait) return tooMany(res, wait, "Too many attempts.");
        const { token, password } = await readJsonBody(req);
        let session;
        try {
          session = resetPassword(token, password);
        } catch (e) {
          if (/expired|used/.test(e.message)) limits.wrongPasswordIp.hit(ip);
          throw e;
        }
        setSessionCookie(req, res, session.token);
        sendJson(res, 200, { userId: session.userId });
        return;
      }

      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        const cookies = parseCookies(req.headers.cookie);
        if (cookies[COOKIE_NAME]) logout(cookies[COOKIE_NAME]);
        clearSessionCookie(req, res);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/auth/me" && req.method === "GET") {
        const cookies = parseCookies(req.headers.cookie);
        const userId = verifySession(cookies[COOKIE_NAME]);
        sendJson(res, userId ? 200 : 401, userId ? { userId, ...accountInfo(userId) } : { error: "Not signed in" });
        return;
      }

      if (url.pathname === "/api/auth/delete-account" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        // The password check here is guessable too
        const account = `user:${userId}`;
        const wait = limits.wrongPassword.blockedFor(account);
        if (wait) return tooMany(res, wait, "Too many wrong passwords.");
        try {
          const { password, confirm } = await readJsonBody(req);
          deleteAccount(userId, password, confirm);
        } catch (e) {
          if (/password/i.test(e.message)) limits.wrongPassword.hit(account);
          throw e;
        }
        clearSessionCookie(req, res);
        sendJson(res, 200, { ok: true });
        return;
      }

      // Each strategy also as the screener's filters, so the filter panel can
      // show and edit it
      if (url.pathname === "/api/presets" && req.method === "GET") {
        sendJson(res, 200, PRESETS.map(p => ({ ...p, filters: criteriaToFilters(p.criteria) })));
        return;
      }

      // The price strip: the main indices and the largest companies, at the
      // last close (end of day — the strip says so)
      if (url.pathname === "/api/market-strip" && req.method === "GET") {
        const snap = loadMarketSnapshot();
        const stocks = allMetrics().rows
          .filter(m => m.marketCapCr != null && m.cmp != null)
          .sort((a, b) => b.marketCapCr - a.marketCapCr)
          .slice(0, 15)
          .map(m => ({ symbol: m.symbol, cmp: m.cmp, changePct: m.ret1d }));
        sendJson(res, 200, { asOf: snap?.pricesDate ?? null, indices: snap?.indices ?? [], stocks });
        return;
      }

      // What the filter picker and column picker offer: every metric, its
      // category, unit and spread across the market
      if (url.pathname === "/api/metrics" && req.method === "GET") {
        sendJson(res, 200, screenerMeta());
        return;
      }

      // The header's stat chips and the front page's figures — counts only,
      // so no sign-in needed
      if (url.pathname === "/api/stats" && req.method === "GET") {
        const snap = loadMarketSnapshot();
        sendJson(res, 200, { strategies: PRESETS.length, filters: METRICS.length + CATEGORY_METRICS.length, companies: allMetrics().rows.length, pricesDate: snap?.pricesDate ?? null });
        return;
      }

      // The stock page's panels, each loaded on its own so a slow one (news,
      // an old quarter's shareholding) never holds up the rest of the page
      const filingSummaryRoute = url.pathname.match(/^\/api\/stock\/([^/]+)\/filings\/(\d+)\/summary$/);
      if (filingSummaryRoute && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodePathSegment(filingSummaryRoute[1]).toUpperCase();
        const index = Number(filingSummaryRoute[2]);
        if (!isValidSymbol(symbol) || index > 39) { sendJson(res, 400, { error: "Unknown filing." }); return; }
        try {
          const filings = await companyFilings(symbol);
          const filing = filings.announcements[index];
          if (!filing?.url) { sendJson(res, 404, { error: "This notice has no linked attachment to read." }); return; }
          sendJson(res, 200, await summarizeFiling(filing));
        } catch (e) {
          reportUpstreamFailure(res, requestId, e, "Couldn't read this NSE attachment. Try again later.");
        }
        return;
      }
      const panelRoute = url.pathname.match(/^\/api\/stock\/([^/]+)\/(prices|technicals|shareholding|filings|news|peers)$/);
      if (panelRoute && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodePathSegment(panelRoute[1]).toUpperCase();
        if (!isValidSymbol(symbol)) {
          sendJson(res, 400, { error: "Unknown symbol" });
          return;
        }
        try {
          switch (panelRoute[2]) {
            case "prices": {
              const range = url.searchParams.get("range") ?? "1y";
              if (!PRICE_RANGES.includes(range)) { sendJson(res, 400, { error: "Unknown range" }); return; }
              sendJson(res, 200, await fetchDailyBars(symbol, range));
              return;
            }
            case "technicals": sendJson(res, 200, await fetchTechnicals(symbol)); return;
            case "shareholding": sendJson(res, 200, { quarters: await shareholdingHistory(symbol) }); return;
            case "filings": sendJson(res, 200, await companyFilings(symbol)); return;
            case "news": sendJson(res, 200, await companyNews(getStock(symbol)?.name ?? symbol)); return;
            case "peers": sendJson(res, 200, sectorPeers(symbol)); return;
          }
        } catch (e) {
          reportUpstreamFailure(res, requestId, e, "This company data is temporarily unavailable. Try again shortly.");
        }
        return;
      }

      if (url.pathname.startsWith("/api/stock/") && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodePathSegment(url.pathname.split("/").pop()).toUpperCase();
        if (!isValidSymbol(symbol)) {
          sendJson(res, 400, { error: `"${symbol}" isn't an NSE symbol — they're letters, digits, & and - (e.g. TCS, M&M, BAJAJ-AUTO).` });
          return;
        }
        let fundamentals = getStock(symbol);
        if (!fundamentals || fundamentals.schema !== SCHEMA) {
          // Not fetched yet (or fetched in an older shape) — fetch it live so
          // search works for any NSE symbol right away, then cache it.
          // undefined = NSE's list couldn't be downloaded (transient — seen
          // live), null = the list loaded and the symbol isn't on it. Only
          // the second is grounds for "not listed"; the list is otherwise
          // just where the company name comes from.
          const info = await equityInfo(symbol).catch(() => undefined);
          if (info === null) {
            sendJson(res, 404, { error: `${symbol} isn't in NSE's list of listed equities. Check the symbol (e.g. TCS, HDFCBANK, NESTLEIND).` });
            return;
          }
          try {
            fundamentals = { ...(await fetchStockSummary(symbol)), name: info?.name ?? symbol, isin: info?.isin ?? null, fetchedAt: new Date().toISOString() };
            saveStock(symbol, fundamentals);
          } catch (e) {
            if (e.noFilings) {
              sendJson(res, 404, { error: `${info?.name ?? symbol} hasn't filed annual results in NSE's current format, so there's nothing to value or score.` });
              return;
            }
            reportUpstreamFailure(res, requestId, e, `Couldn't read ${info?.name ?? symbol}'s financials from NSE right now. Try again shortly.`);
            return;
          }
        }

        // Live price (fresher than the daily snapshot) — the metrics are the
        // same function the Discover table uses, just with this price.
        let quote = null, quoteError = null;
        try {
          quote = await fetchCmp(symbol);
        } catch (e) {
          quoteError = e.message;
        }
        const snap = loadMarketSnapshot();
        // The research score's peer comparison needs the market's sector
        // medians, which the screen sets — cached, so this is cheap
        allMetrics();
        const metrics = computeMetrics(fundamentals, snap, quote ? { cmp: quote.cmp, cmpDate: quote.asOf } : {});

        sendJson(res, 200, {
          symbol: fundamentals.symbol,
          name: fundamentals.name,
          template: fundamentals.template,
          pnl: fundamentals.pnl,
          annual: fundamentals.annual,
          balanceSheet: fundamentals.balanceSheet,
          holding: fundamentals.holding,
          quote, quoteError, metrics,
          // NSE's own last close, for the price box's "Use NSE close"
          close: snap?.prices?.[symbol] != null ? { price: snap.prices[symbol], date: snap.pricesDate } : null,
        });
        return;
      }

      if (url.pathname === "/api/screen" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        // jobs: on a fresh host the first load runs for ~2 h — the screen
        // says so instead of passing off a partial market as the whole one
        sendJson(res, 200, { ...screen(await readJsonBody(req)), jobs: jobStatus() });
        return;
      }

      if (url.pathname === "/api/watchlist" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const items = listWatchlist(userId);
        const snap = loadMarketSnapshot();
        sendJson(res, 200, { items, results: rowsFor(items.map(i => i.ticker)), snapshot: snap ? { pricesDate: snap.pricesDate, builtAt: snap.builtAt } : null });
        return;
      }

      const thesisRoute = url.pathname.match(/^\/api\/thesis\/([^/]+)$/);
      if (thesisRoute && ["GET", "PUT"].includes(req.method)) {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodePathSegment(thesisRoute[1]).toUpperCase();
        if (req.method === "GET") sendJson(res, 200, getThesis(userId, symbol));
        else sendJson(res, 200, saveThesis(userId, symbol, await readJsonBody(req)));
        return;
      }

      // My Notes and saved strategies, kept with the account
      if (url.pathname === "/api/notes" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, { notes: listNotes(userId) });
        return;
      }
      const noteRoute = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
      if (noteRoute && ["PUT", "DELETE"].includes(req.method)) {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const ticker = decodePathSegment(noteRoute[1]);
        if (req.method === "PUT") sendJson(res, 200, saveNote(userId, ticker, await readJsonBody(req)));
        else { deleteNote(userId, ticker); sendJson(res, 200, { ok: true }); }
        return;
      }
      if (url.pathname === "/api/strategies" && ["GET", "PUT"].includes(req.method)) {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        if (req.method === "GET") sendJson(res, 200, { strategies: listStrategies(userId) });
        else sendJson(res, 200, { strategies: saveStrategies(userId, (await readJsonBody(req)).strategies) });
        return;
      }

      if (url.pathname === "/api/watchlist" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const { ticker, price } = await readJsonBody(req);
        const symbol = String(ticker || "").trim().toUpperCase();
        if (isValidSymbol(symbol)) {
          const unlisted = await unlistedError(symbol);
          if (unlisted) { sendJson(res, 400, { error: unlisted }); return; }
        }
        // The price when starred, for the card's "since added": the one the
        // page showed if it sent it, else the day's close
        addToWatchlist(userId, symbol, Number(price) > 0 ? price : loadMarketSnapshot()?.prices?.[symbol]);
        sendJson(res, 200, { ok: true });
        return;
      }

      const watchItem = url.pathname.match(/^\/api\/watchlist\/([^/]+)$/);
      if (watchItem && req.method === "PUT") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        setWatchlistNote(userId, decodePathSegment(watchItem[1]), (await readJsonBody(req)).note);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (watchItem && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        removeFromWatchlist(userId, decodePathSegment(watchItem[1]));
        sendJson(res, 200, { ok: true });
        return;
      }

      // Current prices for up to 50 symbols — live where Yahoo answers, else
      // the day's close, each labelled with which it is
      if (url.pathname === "/api/prices" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbols = (url.searchParams.get("symbols") || "").split(",").map(s => s.trim().toUpperCase()).filter(isValidSymbol).slice(0, 50);
        sendJson(res, 200, await currentPrices(symbols));
        return;
      }

      if (url.pathname === "/api/search" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, await searchEquities(url.searchParams.get("q")));
        return;
      }

      if (url.pathname === "/api/portfolio" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const holdings = listHoldings(userId);
        const tickers = [...new Set(holdings.map(h => h.ticker))];
        const prices = await currentPrices(tickers);
        // Where each holding's price sits against its levels, at the current price
        const status = {};
        for (const r of rowsFor(tickers)) {
          const price = prices[r.symbol]?.price;
          const levels = r.safeBuyPrice ? { fv25: r.fv25, p1: r.safeBuyPrice, p2: r.p2, p3: r.p3, stopLoss: r.stopLoss, target: r.target } : null;
          const position = price && levels ? pricePosition(price, levels) : null;
          status[r.symbol] = { position, levels, research: r.research ?? null };
        }
        sendJson(res, 200, { holdings, prices, status });
        return;
      }

      if (url.pathname === "/api/portfolio" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const body = await readJsonBody(req);
        const symbol = String(body.ticker || "").trim().toUpperCase();
        if (isValidSymbol(symbol)) {
          const unlisted = await unlistedError(symbol);
          if (unlisted) { sendJson(res, 400, { error: unlisted }); return; }
        }
        // Fill the company name from NSE's list when it's left blank
        const info = body.name ? null : await equityInfo(symbol).catch(() => null);
        sendJson(res, 200, addHolding(userId, { ...body, name: body.name || info?.name }));
        return;
      }

      const holdingItem = url.pathname.match(/^\/api\/portfolio\/(\d+)$/);
      if (holdingItem && req.method === "PUT") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, updateHolding(userId, Number(holdingItem[1]), await readJsonBody(req)));
        return;
      }

      if (holdingItem && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        removeHolding(userId, Number(holdingItem[1]));
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/performance" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, await getPerformance());
        return;
      }

      if (url.pathname === "/api/performance/snapshot" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, await takeSnapshots());
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        // Each alert against the latest price: the day's close, or with
        // ?live=1 (the Alerts tab's Check Now) a live quote where available.
        // Sending them is alert-notifier.js's, to accounts that connected
        // Telegram; notified_at says when one was last sent.
        const alerts = listAlerts(userId);
        const prices = url.searchParams.get("live") === "1"
          ? await currentPrices(alerts.map(a => a.ticker))
          : Object.fromEntries(alerts.map(a => {
            const snap = loadMarketSnapshot();
            const close = snap?.prices?.[a.ticker];
            return [a.ticker, close != null ? { price: close, asOf: snap.pricesDate, source: "close" } : null];
          }));
        sendJson(res, 200, alerts.map(a => {
          const p = prices[a.ticker];
          const cmp = p?.price ?? null;
          const triggered = cmp == null ? null : a.condition === "below" ? cmp <= a.threshold : cmp >= a.threshold;
          return { ...a, enabled: !!a.enabled, cmp, priceDate: p?.asOf ?? null, priceSource: p?.source ?? null, triggered };
        }));
        return;
      }

      // Telegram: whether this server has a bot, and whether this account is
      // connected to it (telegram.js)
      if (url.pathname === "/api/telegram" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const bot = await botInfo().catch(() => null);
        const chat = telegramChat(userId);
        sendJson(res, 200, { configured: !!bot, bot: bot?.username ?? null, connected: !!chat, name: chat?.name ?? null });
        return;
      }

      if (url.pathname === "/api/telegram/link" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const bot = await botInfo().catch(() => null);
        if (!bot) { sendJson(res, 503, { error: "Telegram alerts aren't set up on this server yet." }); return; }
        sendJson(res, 200, { url: `https://t.me/${bot.username}?start=${linkCode(userId)}` });
        return;
      }

      if (url.pathname === "/api/telegram/test" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const chat = telegramChat(userId);
        if (!chat) { sendJson(res, 400, { error: "Connect Telegram first." }); return; }
        try {
          await sendTelegram(chat.chatId, "Test message from <b>Stockwise India</b>. Your price alerts will arrive in this chat.");
        } catch (e) {
          // Telegram's own reason ("bot was blocked by the user") tells the
          // user what to do; a generic server error wouldn't
          sendJson(res, 502, { error: `Telegram didn't take the test message — ${e.message.replace(/^Telegram \w+: /, "")}` });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/telegram" && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        unlinkTelegram(userId);
        sendJson(res, 200, { ok: true });
        return;
      }

      const alertItem = url.pathname.match(/^\/api\/alerts\/(\d+)$/);
      if (alertItem && req.method === "PUT") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, updateAlert(userId, Number(alertItem[1]), await readJsonBody(req)));
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const body = await readJsonBody(req);
        const symbol = String(body.ticker || "").trim().toUpperCase();
        if (isValidSymbol(symbol)) {
          const unlisted = await unlistedError(symbol);
          if (unlisted) { sendJson(res, 400, { error: unlisted }); return; }
        }
        const alert = createAlert(userId, body);
        sendJson(res, 200, alert);
        return;
      }

      if (url.pathname.startsWith("/api/alerts/") && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const id = Number(url.pathname.split("/").pop());
        deleteAlert(userId, id);
        sendJson(res, 200, { ok: true });
        return;
      }

      // HEAD too: uptime monitors (UptimeRobot) check with HEAD, and Node
      // leaves the body off a HEAD reply by itself
      if (url.pathname === "/api/health" && (req.method === "GET" || req.method === "HEAD")) {
        const snap = loadMarketSnapshot();
        const jobs = jobStatus();
        const snapshotAgeHours = snap?.builtAt ? Math.max(0, (Date.now() - Date.parse(snap.builtAt)) / 3_600_000) : null;
        const warnings = [];
        if (!snap) warnings.push("No market snapshot is available.");
        else if (snapshotAgeHours > 72) warnings.push("The market snapshot is older than 72 hours.");
        if (jobs.lastError) warnings.push("A background data refresh has failed.");
        if (jobs.loadingMarket) warnings.push("The initial market data load is still running.");
        sendJson(res, 200, {
          ok: true,
          degraded: warnings.length > 0,
          warnings,
          companies: countFetched(),
          pricesDate: snap?.pricesDate ?? null,
          snapshotBuiltAt: snap?.builtAt ?? null,
          snapshotAgeHours: snapshotAgeHours == null ? null : Math.round(snapshotAgeHours * 10) / 10,
          jobs,
        });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && serveStatic(req, url.pathname, res)) return;
      sendJson(res, 404, { error: "Not found" });
    } catch (e) {
      const status = e instanceof HttpError || Number.isInteger(e?.status) ? e.status : e?.duplicate ? 409 : e instanceof SyntaxError ? 400 : 500;
      if (status >= 500) {
        console.error(JSON.stringify({ event: "api_request_failed", requestId, method: req.method, path: url.pathname, errorName: e?.name, message: e?.message }));
        sendJson(res, status, { error: "The server couldn't complete this request. Please try again shortly.", requestId });
      } else {
        sendJson(res, status, { error: e.message || "Invalid request" });
      }
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createApp().listen(port, () => console.log(`stockwise-india on http://localhost:${port}`));
  // DATA_JOBS=off for a server that should only serve what's on disk — and
  // that mustn't answer the Telegram bot either (one poller per bot)
  if (process.env.DATA_JOBS !== "off") {
    startDataJobs();
    startTelegramPolling();
    startAlertChecks();
    startBackups();
  }
}
