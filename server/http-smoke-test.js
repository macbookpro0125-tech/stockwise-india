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

  const json = (method, path, cookie, body) => fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined,
  });

  // Watchlist: the price when starred, and a note
  await json("POST", "/api/watchlist", aliceCookie, { ticker: "TCS", price: 3000 });
  await json("PUT", "/api/watchlist/TCS", aliceCookie, { note: "wait for results" });
  const noted = (await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json()).items[0];
  assert(noted.addedPrice === 3000 && noted.note === "wait for results", "the watchlist keeps the price when starred and a note");
  await json("DELETE", "/api/watchlist/TCS", aliceCookie);

  // Portfolio
  assert((await json("POST", "/api/portfolio", aliceCookie, { ticker: "TCS", buyPrice: 3000, qty: 0 })).status === 400, "a holding with 0 shares is refused");
  assert((await json("POST", "/api/portfolio", aliceCookie, { ticker: "../x", buyPrice: 3000, qty: 1 })).status === 400, "a holding with a bad symbol is refused");
  const added = await (await json("POST", "/api/portfolio", aliceCookie, { ticker: "tcs", buyPrice: 3000, qty: 10, buyDate: "2026-01-15" })).json();
  assert(added.ticker === "TCS" && added.qty === 10, "adding a holding returns it, symbol upper-cased");
  const port = await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json();
  assert(port.holdings.length === 1 && port.prices.TCS?.price > 0 && "TCS" in port.status, "the portfolio comes back with a price and buy-ladder status for each holding");
  assert((await json("PUT", `/api/portfolio/${added.id}`, bobCookie, { buyPrice: 1, qty: 1 })).status === 400, "bob can't edit alice's holding");
  const edited = await (await json("PUT", `/api/portfolio/${added.id}`, aliceCookie, { buyPrice: 3100, qty: 12 })).json();
  assert(edited.buyPrice === 3100 && edited.qty === 12, "editing a holding saves the new price and quantity");
  assert(edited.buyDate === "2026-01-15" && edited.name === added.name, "an edit keeps the fields it didn't change");
  const bobPort = await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: bobCookie } })).json();
  assert(bobPort.holdings.length === 0, "bob doesn't see alice's portfolio");
  await json("DELETE", `/api/portfolio/${added.id}`, bobCookie);
  assert((await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json()).holdings.length === 1, "bob can't delete alice's holding");
  await json("DELETE", `/api/portfolio/${added.id}`, aliceCookie);
  assert((await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json()).holdings.length === 0, "deleting a holding removes it");

  // Alerts: edit, pause, and ownership
  const [tcsAlert] = await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } })).json();
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, bobCookie, { threshold: 1 })).status === 400, "bob can't edit alice's alert");
  const paused = await (await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: 3200, enabled: false })).json();
  assert(paused.threshold === 3200 && paused.enabled === 0, "editing an alert changes its price and can pause it");
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: -5 })).status === 400, "an alert price below 0 is refused");

  // Search, header counts, performance
  const found = await (await fetch(`${BASE}/api/search?q=tcs`, { headers: { Cookie: aliceCookie } })).json();
  assert(found[0]?.ticker === "TCS", "searching 'tcs' puts TCS first");
  const stats = await (await fetch(`${BASE}/api/stats`, { headers: { Cookie: aliceCookie } })).json();
  assert(stats.strategies === 13 && stats.companies > 0, "the header's counts come back");
  const perf = await fetch(`${BASE}/api/performance`, { headers: { Cookie: aliceCookie } });
  assert(perf.status === 200 && Array.isArray((await perf.json()).presets), "the Performance tab's data comes back");

  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: aliceCookie } });
  const afterLogout = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } });
  assert(afterLogout.status === 401, "the old cookie stops working after logout — the session was actually deleted server-side, not just cleared client-side");

  console.log("\nAll HTTP-layer checks passed.");
  server.close();
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
