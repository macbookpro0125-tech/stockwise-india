// Plain node:http, no framework — consistent with the rest of this project
// staying dependency-light (node:sqlite, node:crypto, plain fetch so far).
// Session lives in an httpOnly cookie, not a token handed back in JSON for
// the client to store — a token in localStorage is readable by any script
// on the page, which is exactly what a single XSS bug turns into full
// account takeover. httpOnly means client-side JS can't read it at all.
import { createServer } from "node:http";
import { signup, login, logout, verifySession } from "./auth.js";
import { listAlerts, createAlert, deleteAlert } from "./user-alerts.js";
import { loadMarket, screen } from "./screen.js";

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
        sendJson(res, 200, { total: all.length, matched: matches.length, criteria, results: matches.slice(0, 100) });
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
