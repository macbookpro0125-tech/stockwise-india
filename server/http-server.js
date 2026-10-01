// Plain node:http, no framework — consistent with the rest of this project
// staying dependency-light (node:sqlite, node:crypto, plain fetch so far).
// Session lives in an httpOnly cookie, not a token handed back in JSON for
// the client to store — a token in localStorage is readable by any script
// on the page, which is exactly what a single XSS bug turns into full
// account takeover. httpOnly means client-side JS can't read it at all.
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { existsSync, statSync, createReadStream } from "node:fs";
import { join, normalize, extname, sep } from "node:path";
import { signup, login, logout, verifySession, accountEmail, deleteAccount } from "./auth.js";
import { listAlerts, createAlert, updateAlert, deleteAlert } from "./user-alerts.js";
import { screen, screenerMeta, getStock, saveStock, rowsFor, isValidSymbol, countFetched, allMetrics } from "./screen.js";
import { criteriaToFilters, METRICS, CATEGORY_METRICS } from "./metric-catalog.js";
import { listWatchlist, addToWatchlist, setWatchlistNote, removeFromWatchlist } from "./user-watchlist.js";
import { listHoldings, addHolding, updateHolding, removeHolding } from "./user-portfolio.js";
import { currentPrices } from "./prices.js";
import { getPerformance, takeSnapshots } from "./performance.js";
import { getAction } from "./levels.js";
import { fetchCmp, fetchDailyBars, PRICE_RANGES } from "./quote.js";
import { fetchStockSummary, SCHEMA } from "./fetch-nse.js";
import { fetchEquityList } from "./equity-list.js";
import { computeMetrics } from "./metrics.js";
import { loadMarketSnapshot } from "./market-data.js";
import { startDataJobs, jobStatus } from "./data-jobs.js";
import { fetchTechnicals } from "./technicals.js";
import { shareholdingHistory, companyFilings, companyNews, sectorPeers } from "./company-extras.js";
import { PRESETS } from "./presets.js";
import { DIST_DIR } from "./paths.js";

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
  let file = normalize(join(DIST_DIR, decodeURIComponent(pathname)));
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
        sendJson(res, userId ? 200 : 401, userId ? { userId, email: accountEmail(userId) } : { error: "Not signed in" });
        return;
      }

      if (url.pathname === "/api/auth/delete-account" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        deleteAccount(userId, (await readJsonBody(req)).password);
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
      const panelRoute = url.pathname.match(/^\/api\/stock\/([^/]+)\/(prices|technicals|shareholding|filings|news|peers)$/);
      if (panelRoute && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodeURIComponent(panelRoute[1]).toUpperCase();
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
          sendJson(res, 502, { error: e.message });
        }
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
        const snap = loadMarketSnapshot();
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
        setWatchlistNote(userId, decodeURIComponent(watchItem[1]), (await readJsonBody(req)).note);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (watchItem && req.method === "DELETE") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        removeFromWatchlist(userId, decodeURIComponent(watchItem[1]));
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
        // Where each holding sits on its buy ladder, at the current price
        const status = {};
        for (const r of rowsFor(tickers)) {
          const price = prices[r.symbol]?.price;
          const levels = r.safeBuyPrice ? { p1: r.safeBuyPrice, p2: r.p2, p3: r.p3, stopLoss: r.stopLoss, target: r.target } : null;
          const action = price && levels ? getAction(price, levels) : null;
          status[r.symbol] = { action: action?.action ?? null, color: action?.color ?? null, levels, score: r.score ?? null };
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
        sendJson(res, 200, getPerformance());
        return;
      }

      if (url.pathname === "/api/performance/snapshot" && req.method === "POST") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, takeSnapshots());
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        // Each alert against the latest price: the day's close, or with
        // ?live=1 (the Alerts tab's Check Now) a live quote where available.
        // Nothing checks alerts in the background or sends notifications yet
        // — the Alerts tab says so.
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

      if (url.pathname === "/api/health" && req.method === "GET") {
        const snap = loadMarketSnapshot();
        sendJson(res, 200, { ok: true, companies: countFetched(), pricesDate: snap?.pricesDate ?? null, jobs: jobStatus() });
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if (req.method === "GET" && serveStatic(req, url.pathname, res)) return;
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
