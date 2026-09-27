// Proves the actual HTTP layer, not just the functions underneath it —
// real requests, real Set-Cookie parsing, real status codes. auth-smoke-test
// already proved the DB/auth logic in isolation; this is what could still
// break between that logic and a browser actually talking to it.
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data", "test.db");
process.env.STOCKWISE_DB = DB_PATH; // never the real app.db — see db.js
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const { createApp } = await import("./http-server.js");
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const server = createApp().listen(PORT);

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

function extractCookie(res) {
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(";")[0]; // "stockwise_session=abc123"
}

async function main() {
  const signupRes = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "correcthorsebattery" }),
  });
  assert(signupRes.status === 200, "signup over HTTP returns 200");
  const aliceCookie = extractCookie(signupRes);
  assert(aliceCookie.startsWith("stockwise_session="), "signup sets a session cookie");

  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } });
  assert(meRes.status === 200, "/api/auth/me with a valid cookie returns 200");

  const noCookieRes = await fetch(`${BASE}/api/alerts`);
  assert(noCookieRes.status === 401, "GET /api/alerts with no cookie is rejected");

  const health = await fetch(`${BASE}/api/health`);
  const healthBody = await health.json();
  assert(health.status === 200 && healthBody.ok === true && "jobs" in healthBody, "GET /api/health answers (the host's health check)");
  assert((await fetch(`${BASE}/api/no-such-route`)).status === 404, "an unknown /api/ route is a 404, not the app page");

  const presets = await (await fetch(`${BASE}/api/presets`)).json();
  assert(Array.isArray(presets) && presets.length === 13 && presets.every(p => p.criteria), "GET /api/presets returns the 13 strategies with their criteria");

  const screenNoCookie = await fetch(`${BASE}/api/screen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(screenNoCookie.status === 401, "POST /api/screen with no cookie is rejected");

  const emptyRes = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } });
  const empty = await emptyRes.json();
  assert(Array.isArray(empty) && empty.length === 0, "a fresh user's alert list is empty");

  const createRes = await fetch(`${BASE}/api/alerts`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "TCS", condition: "below", threshold: 3500 }),
  });
  assert(createRes.status === 200, "creating an alert over HTTP returns 200");

  const dupRes = await fetch(`${BASE}/api/alerts`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "TCS", condition: "below", threshold: 3000 }),
  });
  assert(dupRes.status === 409, "a duplicate ticker+condition alert returns 409, not a silent second alert");

  const bobSignup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bob@example.com", password: "correcthorsebattery2" }),
  });
  const bobCookie = extractCookie(bobSignup);
  const bobAlerts = await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: bobCookie } })).json();
  assert(bobAlerts.length === 0, "bob's session sees none of alice's alerts — cookies are per-user, not global");

  const star = () => fetch(`${BASE}/api/watchlist`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "tcs" }),
  });
  assert((await star()).status === 200 && (await star()).status === 200, "starring a stock twice is fine, not an error");
  const aliceWatch = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json();
  assert(aliceWatch.items.length === 1 && aliceWatch.items[0].ticker === "TCS" && aliceWatch.results.length === 1, "alice's watchlist holds TCS once, upper-cased, with a table row");
  const badStar = await fetch(`${BASE}/api/watchlist`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "../../server/x" }),
  });
  const badStock = await fetch(`${BASE}/api/stock/..%2F..%2Fpackage`, { headers: { Cookie: aliceCookie } });
  assert(badStar.status === 400 && badStock.status === 400, "a symbol like ../x is refused before it can reach a file path");
  const bobWatch = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: bobCookie } })).json();
  assert(bobWatch.items.length === 0, "bob doesn't see alice's watchlist");
  await fetch(`${BASE}/api/watchlist/TCS`, { method: "DELETE", headers: { Cookie: aliceCookie } });
  const afterUnstar = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json();
  assert(afterUnstar.items.length === 0, "unstarring removes it");

  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: aliceCookie } });
  const afterLogout = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } });
  assert(afterLogout.status === 401, "the old cookie stops working after logout — the session was actually deleted server-side, not just cleared client-side");

  console.log("\nAll HTTP-layer checks passed.");
  server.close();
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
