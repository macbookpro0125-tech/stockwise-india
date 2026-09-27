// Plain node:http, no framework — consistent with the rest of this project
// staying dependency-light (node:sqlite, node:crypto, plain fetch so far).
// Session lives in an httpOnly cookie, not a token handed back in JSON for
// the client to store — a token in localStorage is readable by any script
// on the page, which is exactly what a single XSS bug turns into full
// account takeover. httpOnly means client-side JS can't read it at all.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, normalize, extname, sep } from "node:path";
import { signup, login, logout, verifySession } from "./auth.js";
import { listAlerts, createAlert, deleteAlert } from "./user-alerts.js";
import { screen, getStock, saveStock, rowsFor, isValidSymbol, countFetched } from "./screen.js";
import { listWatchlist, addToWatchlist, removeFromWatchlist } from "./user-watchlist.js";
import { fetchCmp } from "./quote.js";
import { fetchStockSummary, SCHEMA } from "./fetch-nse.js";
import { fetchEquityList } from "./equity-list.js";
import { computeMetrics } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";
import { startDataJobs, jobStatus } from "./data-jobs.js";
import { PRESETS } from "./presets.js";
import { DIST_DIR } from "./paths.js";

let equityListPromise = null;
async function equityInfo(symbol) {
  equityListPromise ??= fetchEquityList().catch(e => { equityListPromise = null; throw e; });
  const list = await equityListPromise;
  return list.find(s => s.symbol === symbol) ?? null;
}

// The built frontend, for a host where this one process serves everything.
// In development Vite serves the frontend and proxies /api here instead.
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
  ".woff2": "font/woff2", ".txt": "text/plain",
};

function serveStatic(pathname, res) {
  if (!existsSync(DIST_DIR)) return false;
  let file = normalize(join(DIST_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST_DIR + sep) && file !== DIST_DIR) return false; // no ../ out of dist
  // Anything that isn't a file is the app itself (it has no other pages)
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST_DIR, "index.html");
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
    // Vite puts a content hash in asset file names, so those never change;
    // index.html must be re-checked so a deploy is picked up.
    "Cache-Control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache",
  });
  res.end(readFileSync(file));
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
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
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

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
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
    try {
      if (url.pathname === "/api/auth/signup" && req.method === "POST") {
        const { email, password } = await readJsonBody(req);
        const { token, userId } = signup(email, password);
        setSessionCookie(req, res, token);
        sendJson(res, 200, { userId });
        return;
      }

      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const { email, password } = await readJsonBody(req);
        const { token, userId } = login(email, password);
        setSessionCookie(req, res, token);
        sendJson(res, 200, { userId });
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
        sendJson(res, userId ? 200 : 401, userId ? { userId } : { error: "Not signed in" });
        return;
      }

      if (url.pathname === "/api/presets" && req.method === "GET") {
        sendJson(res, 200, PRESETS);
        return;
      }

      if (url.pathname.startsWith("/api/stock/") && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodeURIComponent(url.pathname.split("/").pop()).toUpperCase();
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
            sendJson(res, 502, { error: `Couldn't read ${info?.name ?? symbol}'s financials from NSE: ${e.message}` });
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
        const metrics = computeMetrics(fundamentals, loadMarketSnapshot(), quote ? { cmp: quote.cmp, cmpDate: quote.asOf } : {});

        sendJson(res, 200, {
          symbol: fundamentals.symbol,
          name: fundamentals.name,
          template: fundamentals.template,
          pnl: fundamentals.pnl,
          annual: fundamentals.annual,
          balanceSheet: fundamentals.balanceSheet,
          holding: fundamentals.holding,
          quote, quoteError, metrics,
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

      if (url.pathname === "/api/watchlist" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        addToWatchlist(userId, (await readJsonBody(req)).ticker);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname.startsWith("/api/watchlist/") && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        removeFromWatchlist(userId, decodeURIComponent(url.pathname.split("/").pop()));
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        // Each alert against the latest daily close. Nothing checks alerts in
        // the background or sends notifications yet — the Alerts tab says so.
        const snap = loadMarketSnapshot();
        sendJson(res, 200, listAlerts(userId).map(a => {
          const cmp = snap?.prices?.[a.ticker] ?? null;
          const triggered = cmp == null ? null : a.condition === "below" ? cmp <= a.threshold : cmp >= a.threshold;
          return { ...a, cmp, priceDate: snap?.pricesDate ?? null, triggered };
        }));
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const body = await readJsonBody(req);
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

      if (url.pathname === "/api/health" && req.method === "GET") {
        const snap = loadMarketSnapshot();
        sendJson(res, 200, { ok: true, companies: countFetched(), pricesDate: snap?.pricesDate ?? null, jobs: jobStatus() });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if (req.method === "GET" && serveStatic(url.pathname, res)) return;
      sendJson(res, 404, { error: "Not found" });
    } catch (e) {
      sendJson(res, e.duplicate ? 409 : 400, { error: e.message });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createApp().listen(port, () => console.log(`stockwise-india on http://localhost:${port}`));
  // DATA_JOBS=off for a server that should only serve what's on disk
  if (process.env.DATA_JOBS !== "off") startDataJobs();
}
