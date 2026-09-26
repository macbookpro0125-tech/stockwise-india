// Plain node:http, no framework — consistent with the rest of this project
// staying dependency-light (node:sqlite, node:crypto, plain fetch so far).
// Session lives in an httpOnly cookie, not a token handed back in JSON for
// the client to store — a token in localStorage is readable by any script
// on the page, which is exactly what a single XSS bug turns into full
// account takeover. httpOnly means client-side JS can't read it at all.
import { createServer } from "node:http";
import { signup, login, logout, verifySession } from "./auth.js";
import { listAlerts, createAlert, deleteAlert } from "./user-alerts.js";
import { loadMarket, screen, getStock, saveStock, countFetched } from "./screen.js";
import { fetchCmp } from "./quote.js";
import { calculateLevels, getAction } from "./levels.js";
import { fetchStockSummary } from "./fetch-nse.js";
import { fetchEquityList } from "./equity-list.js";
import { fetchPeHistory } from "./pe-history.js";

let equityListPromise = null;
async function equityInfo(symbol) {
  equityListPromise ??= fetchEquityList().catch(e => { equityListPromise = null; throw e; });
  const list = await equityListPromise;
  return list.find(s => s.symbol === symbol) ?? null;
}

const DEFAULT_GROWTH_PCT = 12;
const DEFAULT_MOS_PCT = 10;

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

function setSessionCookie(res, token) {
  // SameSite=Strict blocks the cookie from being sent on any cross-site
  // request at all — the simplest real CSRF defense, at the cost of
  // needing a same-site redirect (not a bare link) after e.g. an OAuth
  // callback, which this doesn't have yet. Revisit if that's ever added.
  // secure is skipped here (plain HTTP in dev) — must be set once this is
  // served over HTTPS, or the cookie travels in cleartext.
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_S}; Path=/`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/`);
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
        setSessionCookie(res, token);
        sendJson(res, 200, { userId });
        return;
      }

      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const { email, password } = await readJsonBody(req);
        const { token, userId } = login(email, password);
        setSessionCookie(res, token);
        sendJson(res, 200, { userId });
        return;
      }

      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        const cookies = parseCookies(req.headers.cookie);
        if (cookies[COOKIE_NAME]) logout(cookies[COOKIE_NAME]);
        clearSessionCookie(res);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (url.pathname === "/api/auth/me" && req.method === "GET") {
        const cookies = parseCookies(req.headers.cookie);
        const userId = verifySession(cookies[COOKIE_NAME]);
        sendJson(res, userId ? 200 : 401, userId ? { userId } : { error: "Not signed in" });
        return;
      }

      // Separate from /api/stock/:symbol so the detail page renders in ~1s
      // and this (5 filings + 10y of prices, first view only) fills in after.
      const peMatch = url.pathname.match(/^\/api\/stock\/([^/]+)\/pe-history$/);
      if (peMatch && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodeURIComponent(peMatch[1]).toUpperCase();
        const stock = getStock(symbol);
        if (!stock?.annual?.yearEnded) {
          sendJson(res, 404, { error: `${symbol}'s current financials aren't loaded yet` });
          return;
        }
        const yearEnded = String(stock.annual.yearEnded).toUpperCase();
        if (stock.peHistory?.forYearEnded === yearEnded) {
          sendJson(res, 200, stock.peHistory);
          return;
        }
        try {
          const peHistory = await fetchPeHistory(symbol, yearEnded);
          saveStock(symbol, { ...stock, peHistory });
          sendJson(res, 200, peHistory);
        } catch (e) {
          sendJson(res, 502, { error: `Couldn't work out ${symbol}'s P/E history: ${e.message}` });
        }
        return;
      }

      if (url.pathname.startsWith("/api/stock/") && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const symbol = decodeURIComponent(url.pathname.split("/").pop()).toUpperCase();
        let fundamentals = getStock(symbol);
        if (!fundamentals) {
          // Not cached by the background market fetch yet — fetch it live so
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
            fundamentals = { ...(await fetchStockSummary(symbol)), name: info?.name ?? symbol, isin: info?.isin ?? null };
            saveStock(symbol, fundamentals);
          } catch (e) {
            sendJson(res, 502, { error: `Couldn't read ${info?.name ?? symbol}'s financials from NSE: ${e.message}` });
            return;
          }
        }

        let quote = null, quoteError = null;
        try {
          quote = await fetchCmp(symbol);
        } catch (e) {
          quoteError = e.message;
        }

        // Last audited full-year EPS, the same basis as the original app's
        // "EPS FY25" — a reported figure, not a quarter scaled up.
        const eps = fundamentals.annual?.eps ?? null;
        const pe = quote && eps > 0 ? quote.cmp / eps : null;
        const levels = pe ? calculateLevels(eps, pe, DEFAULT_GROWTH_PCT, DEFAULT_MOS_PCT) : null;
        const action = quote && levels ? getAction(quote.cmp, levels) : null;

        sendJson(res, 200, {
          ...fundamentals,
          eps,
          epsBasis: `audited full year ended ${fundamentals.annual?.yearEnded}`,
          quote, quoteError, pe, levels, action,
          growthPctUsed: DEFAULT_GROWTH_PCT, mosPctUsed: DEFAULT_MOS_PCT,
        });
        return;
      }

      if (url.pathname === "/api/screen" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        const q = url.searchParams;
        const criteria = {
          minRoe: q.has("minRoe") ? Number(q.get("minRoe")) : 15,
          maxDebtToEquity: q.has("maxDebtToEquity") ? Number(q.get("maxDebtToEquity")) : 0.5,
          minPromoterPct: q.has("minPromoterPct") ? Number(q.get("minPromoterPct")) : 0,
        };
        const all = loadMarket();
        const matches = screen(all, criteria).sort((a, b) => b.roe - a.roe);
        equityListPromise ??= fetchEquityList().catch(e => { equityListPromise = null; throw e; });
        const listed = (await equityListPromise.catch(() => null))?.length ?? null;
        sendJson(res, 200, { total: all.length, fetched: countFetched(), listed, matched: matches.length, criteria, results: matches.slice(0, 100) });
        return;
      }

      if (url.pathname === "/api/alerts" && req.method === "GET") {
        const userId = requireAuth(req, res);
        if (userId == null) return;
        sendJson(res, 200, listAlerts(userId));
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

      sendJson(res, 404, { error: "Not found" });
    } catch (e) {
      sendJson(res, e.duplicate ? 409 : 400, { error: e.message });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8787;
  createApp().listen(port, () => console.log(`stockwise-india API on http://localhost:${port}`));
}
