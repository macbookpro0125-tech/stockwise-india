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
// .env may hold a real bot key: the tests must never reach Telegram
delete process.env.TELEGRAM_BOT_TOKEN;
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
  const duplicateSignup = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "alice@example.com", password: "correcthorsebattery" }),
  });
  assert(duplicateSignup.status === 409, "duplicate account creation returns 409");
  const malformedJson = await fetch(`${BASE}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
  assert(malformedJson.status === 400 && /valid JSON/i.test((await malformedJson.json()).error) && malformedJson.headers.get("x-request-id"), "malformed JSON returns a clear 400 response with a request ID");
  const aliceCookie = extractCookie(signupRes);
  assert(aliceCookie.startsWith("stockwise_session="), "signup sets a session cookie");

  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } });
  assert(meRes.status === 200, "/api/auth/me with a valid cookie returns 200");

  const noCookieRes = await fetch(`${BASE}/api/alerts`);
  assert(noCookieRes.status === 401, "GET /api/alerts with no cookie is rejected");

  const health = await fetch(`${BASE}/api/health`);
  const healthBody = await health.json();
  assert(health.status === 200 && healthBody.ok === true && "jobs" in healthBody && "degraded" in healthBody && "snapshotAgeHours" in healthBody, "GET /api/health answers the host's check and reports data freshness");
  assert((await fetch(`${BASE}/api/no-such-route`)).status === 404, "an unknown /api/ route is a 404, not the app page");
  // The market rebuilds in slices (screen.js): bump the company folder's date
  // (nothing edited) and the health check must still answer at once, while a
  // data request is answered from the last market
  await fetch(`${BASE}/api/stats`); // a market exists
  const { utimesSync } = await import("node:fs");
  utimesSync(join(__dirname, "..", "data", "market"), new Date(), new Date());
  let slowest = 0;
  const statsDuring = fetch(`${BASE}/api/stats`);
  for (let i = 0; i < 20; i++) { const t = performance.now(); await fetch(`${BASE}/api/health`); slowest = Math.max(slowest, performance.now() - t); await new Promise(r => setTimeout(r, 50)); }
  assert(slowest < 1000 && (await statsDuring).status === 200, `the server keeps answering while the market rebuilds (slowest health check ${Math.round(slowest)} ms)`);
  const headHealth = await fetch(`${BASE}/api/health`, { method: "HEAD" });
  assert(headHealth.status === 200 && (await headHealth.text()) === "", "HEAD /api/health is 200 with no body (uptime monitors check with HEAD)");

  const presets = await (await fetch(`${BASE}/api/presets`)).json();
  assert(Array.isArray(presets) && presets.length === 20 && presets.every(p => p.criteria || p.filters) && presets.every(p => Array.isArray(p.filters)), "GET /api/presets returns the 20 strategies, each with its filters");
  const upEvery = presets.find(p => p.id === "up_every_timeframe");
  assert(upEvery && ["ret1m", "ret6m", "ret1y", "priceCagr5y"].every(id => upEvery.filters.some(f => f.id === id && f.min === 0)), "Up on Every Timeframe asks for a rise over 1M, 6M, 1Y and 5Y");
  assert(presets.every(p => Array.isArray(p.filters) && p.filters.length > 0 && p.filters.every(f => f.id)), "each strategy also comes as the screener's filters");
  // 22 Oct 2026: "the highest gained stock — 1 year, 6 months, 1 week or 1 day"
  const gainers = presets.find(p => p.id === "top_gainers");
  assert(gainers && gainers.sort === "ret1y" && ["ret1d", "ret1w", "ret6m", "ret1y", "ret3y", "ret5y"].every(id => gainers.periods?.includes(id)), "Top Gainers ranks by return, over a day, a week, six months, a year, three or five years");
  assert(gainers && gainers.filters.some(f => f.id === "ret1y" && f.min === 0) && gainers.filters.some(f => f.id === "marketCapCr" && f.min >= 500), "only risers, and none of the thinly traded smallest companies");

  const metrics = await (await fetch(`${BASE}/api/metrics`)).json();
  // Sound Banks screens on the banks' own figures, so a bank-filter request
  // from the reviews (gross and net NPA, capital) has a way in from Discover
  const banks = presets.find(p => p.id === "sound_banks");
  const bankIds = new Set(metrics.metrics.filter(x => x.category === "Banks").map(x => x.id));
  assert(banks && ["gnpaPct", "nnpaPct", "cet1Pct"].every(id => banks.filters.some(f => f.id === id)) && banks.filters.every(f => bankIds.has(f.id)), "Sound Banks uses only the Banks filters: gross and net NPA, capital and more");
  assert(["tier1Pct", "creditDepositPct"].every(id => bankIds.has(id)), "Tier 1 capital and the credit-deposit ratio are bank filters too");
  assert(metrics.metrics.length >= 90 && metrics.metrics.every(x => x.id && x.label && x.category), "GET /api/metrics lists 90+ metrics with labels and categories");
  const strip = await (await fetch(`${BASE}/api/market-strip`)).json();
  assert(strip.asOf && strip.stocks.length > 0 && strip.stocks.every(s => s.symbol && s.cmp > 0), "the price strip has the latest close date and the largest companies' prices");
  const roceDef = metrics.metrics.find(x => x.id === "roce");
  assert(roceDef.range?.q?.length === 101 && roceDef.range.q[0] <= roceDef.range.q[100], "each metric comes with its spread across the market, percentile by percentile");

  const screenNoCookie = await fetch(`${BASE}/api/screen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(screenNoCookie.status === 401, "POST /api/screen with no cookie is rejected");
  assert((await fetch(`${BASE}/api/screen?q=%7B%7D`)).status === 401, "GET /api/screen with no cookie is rejected");
  // A reply the browser keeps and re-checks: same data, same fingerprint, a 304
  const metaRes = await fetch(`${BASE}/api/metrics`);
  const metaTag = metaRes.headers.get("etag");
  assert(metaTag?.startsWith('W/"') && /no-cache/.test(metaRes.headers.get("cache-control") ?? ""), "the filter catalogue comes with a fingerprint the browser re-checks");
  assert((await fetch(`${BASE}/api/metrics`, { headers: { "If-None-Match": metaTag } })).status === 304, "an unchanged filter catalogue is a 304, no body");

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

  const json = (method, path, cookie, body) => fetch(`${BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: body ? JSON.stringify(body) : undefined,
  });

  const thesisUnauth = await fetch(`${BASE}/api/thesis/TCS`);
  assert(thesisUnauth.status === 401, "investment theses require a signed-in account");
  const filingSummaryUnauth = await fetch(`${BASE}/api/stock/VBL/filings/0/summary`);
  assert(filingSummaryUnauth.status === 401, "full filing attachments are available only in a signed-in session");
  const emptyThesis = await (await fetch(`${BASE}/api/thesis/TCS`, { headers: { Cookie: aliceCookie } })).json();
  assert(emptyThesis.ticker === "TCS" && emptyThesis.case === "" && emptyThesis.updatedAt == null, "a new account gets an empty, symbol-specific thesis");
  const savedThesis = await (await json("PUT", "/api/thesis/TCS", aliceCookie, { case: "Recurring demand", marketGap: "Margin durability", breakers: "Two years of falling cash conversion" })).json();
  assert(savedThesis.case === "Recurring demand" && savedThesis.breakers.includes("cash conversion") && savedThesis.updatedAt, "saving a thesis persists its three fields to the account");
  const bobThesis = await (await fetch(`${BASE}/api/thesis/TCS`, { headers: { Cookie: bobCookie } })).json();
  assert(bobThesis.case === "" && bobThesis.breakers === "", "another account cannot read the saved thesis for the same ticker");
  const longThesis = await (await json("PUT", "/api/thesis/TCS", aliceCookie, { case: "x".repeat(4500) })).json();
  assert(longThesis.case.length === 4000, "thesis fields have a bounded storage length");

  // My Notes and saved strategies follow the account
  assert((await fetch(`${BASE}/api/notes`)).status === 401 && (await fetch(`${BASE}/api/strategies`)).status === 401, "notes and saved strategies need a signed-in account");
  await json("PUT", "/api/notes/TCS", aliceCookie, { verdict: "WATCHLIST", text: "Wait for results" });
  assert((await (await fetch(`${BASE}/api/notes`, { headers: { Cookie: aliceCookie } })).json()).notes.TCS?.text === "Wait for results", "a note saved on one device is there on the next");
  assert(Object.keys((await (await fetch(`${BASE}/api/notes`, { headers: { Cookie: bobCookie } })).json()).notes).length === 0, "another account can't see it");
  assert((await json("PUT", "/api/notes/TCS", aliceCookie, { verdict: "BUY" })).status === 400 && (await json("PUT", "/api/notes/..%2Fx", aliceCookie, { verdict: "SKIP" })).status === 400, "a note needs one of the three verdicts and a real symbol");
  const savedStrategies = await (await json("PUT", "/api/strategies", aliceCookie, { strategies: [{ id: "custom_1", name: "My pharma screen", filters: [{ id: "roe", min: 15, max: null }, { id: "sector", values: ["Healthcare"] }], junk: "x" }, { name: "" }] })).json();
  assert(savedStrategies.strategies.length === 1 && savedStrategies.strategies[0].filters.length === 2 && !("junk" in savedStrategies.strategies[0]), "saved strategies keep their name and filters, nothing else");
  assert((await (await fetch(`${BASE}/api/strategies`, { headers: { Cookie: aliceCookie } })).json()).strategies[0].name === "My pharma screen", "saved strategies come back on the next device");
  assert((await (await fetch(`${BASE}/api/strategies`, { headers: { Cookie: bobCookie } })).json()).strategies.length === 0, "another account has its own (empty) list");

  const star = () => fetch(`${BASE}/api/watchlist`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "tcs" }),
  });
  assert((await star()).status === 200 && (await star()).status === 200, "starring a stock twice is fine, not an error");
  const aliceWatch = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json();
  assert(aliceWatch.items.length === 1 && aliceWatch.items[0].ticker === "TCS" && aliceWatch.results.length === 1, "alice's watchlist holds TCS once, upper-cased, with a table row");
  assert("events" in aliceWatch.results[0], "a watchlist row carries its upcoming events (or null when the calendar couldn't be read)");
  const badStar = await fetch(`${BASE}/api/watchlist`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: aliceCookie },
    body: JSON.stringify({ ticker: "../../server/x" }),
  });
  const badStock = await fetch(`${BASE}/api/stock/..%2F..%2Fpackage`, { headers: { Cookie: aliceCookie } });
  assert(badStar.status === 400 && badStock.status === 400, "a symbol like ../x is refused before it can reach a file path");
  const malformedPath = await fetch(`${BASE}/api/stock/%E0%A4%A`, { headers: { Cookie: aliceCookie } });
  assert(malformedPath.status === 400, "malformed URL encoding returns a client error, not an internal server error");
  const bobWatch = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: bobCookie } })).json();
  assert(bobWatch.items.length === 0, "bob doesn't see alice's watchlist");
  await fetch(`${BASE}/api/watchlist/TCS`, { method: "DELETE", headers: { Cookie: aliceCookie } });
  const afterUnstar = await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json();
  assert(afterUnstar.items.length === 0, "unstarring removes it");

  // Watchlist: the price when starred, and a note
  await json("POST", "/api/watchlist", aliceCookie, { ticker: "TCS", price: 3000 });
  await json("PUT", "/api/watchlist/TCS", aliceCookie, { note: "wait for results" });
  const noted = (await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json()).items[0];
  assert(noted.addedPrice === 3000 && noted.note === "wait for results", "the watchlist keeps the price when starred and a note");
  await json("DELETE", "/api/watchlist/TCS", aliceCookie);

  // Portfolio
  assert((await json("POST", "/api/portfolio", aliceCookie, { ticker: "TCS", buyPrice: 3000, qty: 0 })).status === 400, "a holding with 0 shares is refused");
  assert((await json("POST", "/api/portfolio", aliceCookie, { ticker: "../x", buyPrice: 3000, qty: 1 })).status === 400, "a holding with a bad symbol is refused");
  assert((await json("POST", "/api/portfolio", aliceCookie, { ticker: "NOTAREALCO", buyPrice: 10, qty: 1 })).status === 400, "a holding for a company that isn't listed on NSE is refused");
  assert((await json("POST", "/api/watchlist", aliceCookie, { ticker: "NOTAREALCO" })).status === 400, "starring a company that isn't listed on NSE is refused");
  const added = await (await json("POST", "/api/portfolio", aliceCookie, { ticker: "tcs", buyPrice: 3000, qty: 10, buyDate: "2026-01-15" })).json();
  assert(added.ticker === "TCS" && added.qty === 10, "adding a holding returns it, symbol upper-cased");
  const port = await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json();
  assert(port.holdings.length === 1 && port.prices.TCS?.price > 0 && "TCS" in port.status, "the portfolio comes back with a price and buy-ladder status for each holding");
  assert((await json("PUT", `/api/portfolio/${added.id}`, bobCookie, { buyPrice: 1, qty: 1 })).status === 404, "bob can't edit alice's holding");
  const edited = await (await json("PUT", `/api/portfolio/${added.id}`, aliceCookie, { buyPrice: 3100, qty: 12 })).json();
  assert(edited.buyPrice === 3100 && edited.qty === 12, "editing a holding saves the new price and quantity");
  assert(edited.buyDate === "2026-01-15" && edited.name === added.name, "an edit keeps the fields it didn't change");
  const bobPort = await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: bobCookie } })).json();
  assert(bobPort.holdings.length === 0, "bob doesn't see alice's portfolio");
  await json("DELETE", `/api/portfolio/${added.id}`, bobCookie);
  assert((await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json()).holdings.length === 1, "bob can't delete alice's holding");
  await json("DELETE", `/api/portfolio/${added.id}`, aliceCookie);
  assert((await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json()).holdings.length === 0, "deleting a holding removes it");

  // Splits and bonuses after a lot was entered (Nestlé India's 1:1 bonus,
  // ex-date 8 Aug 2025, in the market snapshot): shown on today's basis, and
  // an edit saves them so — never adjusted twice
  const { db: pdb } = await import("./db.js");
  const lot = await (await json("POST", "/api/portfolio", aliceCookie, { ticker: "NESTLEIND", buyPrice: 2500, qty: 10 })).json();
  assert(lot.qty === 10 && lot.buyPrice === 2500 && !lot.splitAdjusted, "a lot entered today isn't adjusted");
  pdb.prepare("UPDATE holdings SET basis_date = ? WHERE id = ?").run("2025-01-01T00:00:00.000Z", lot.id);
  const before = (await (await fetch(`${BASE}/api/portfolio`, { headers: { Cookie: aliceCookie } })).json()).holdings.find(h => h.id === lot.id);
  assert(before.qty === 20 && before.buyPrice === 1250 && before.splitAdjusted?.ratio === 2, "a lot entered before a 1:1 bonus shows twice the shares at half the price");
  const renoted = await (await json("PUT", `/api/portfolio/${lot.id}`, aliceCookie, { notes: "after the bonus" })).json();
  assert(renoted.qty === 20 && renoted.buyPrice === 1250 && !renoted.splitAdjusted, "editing it saves the adjusted figures, and they aren't adjusted again");
  await json("DELETE", `/api/portfolio/${lot.id}`, aliceCookie);
  await json("POST", "/api/watchlist", aliceCookie, { ticker: "NESTLEIND", price: 2500 });
  pdb.prepare("UPDATE watchlist SET added_at = ? WHERE ticker = 'NESTLEIND'").run("2025-01-01T00:00:00.000Z");
  const starred = (await (await fetch(`${BASE}/api/watchlist`, { headers: { Cookie: aliceCookie } })).json()).items.find(i => i.ticker === "NESTLEIND");
  assert(starred.addedPrice === 1250, "the price when starred is put on today's basis after a bonus");
  await json("DELETE", "/api/watchlist/NESTLEIND", aliceCookie);

  // Alerts: edit, pause, and ownership
  const [tcsAlert] = await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } })).json();
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, bobCookie, { threshold: 1 })).status === 404, "bob can't edit alice's alert");
  const paused = await (await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: 3200, enabled: false })).json();
  assert(paused.threshold === 3200 && paused.enabled === 0, "editing an alert changes its price and can pause it");
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: -5 })).status === 400, "an alert price below 0 is refused");
  // Found by a probe of every route (16 Oct 2026)
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: "Infinity" })).status === 400, "an alert price of Infinity is refused");
  assert((await json("POST", "/api/alerts", aliceCookie, { ticker: "<script>", condition: "above", threshold: 5 })).status === 400, "an alert for something that isn't an NSE symbol is refused");
  const longName = await (await json("POST", "/api/alerts", aliceCookie, { ticker: "INFY", condition: "below", threshold: 100, name: "n".repeat(5000) })).json();
  assert(longName.name?.length === 200, "an alert's name is kept to 200 characters");
  await json("DELETE", `/api/alerts/${longName.id}`, aliceCookie); // leave Alice's alerts as they were
  for (const body of [{}, { email: 5, password: "abcdefgh1" }, { email: "x@example.com", password: 123456789 }]) {
    const r = await fetch(`${BASE}/api/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.9.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });
    assert(r.status === 400, `a sign-up with ${JSON.stringify(body)} is a 400, not a server error`);
  }
  const headers = (await fetch(`${BASE}/`, { headers: { "x-forwarded-proto": "https" } })).headers;
  assert(headers.get("x-frame-options") === "DENY" && headers.get("x-content-type-options") === "nosniff" && /frame-ancestors 'none'/.test(headers.get("content-security-policy") ?? "") && headers.get("referrer-policy") && headers.get("strict-transport-security"), "pages can't be framed, types aren't sniffed, and https is kept to");

  // Search, header counts, performance
  const found = await (await fetch(`${BASE}/api/search?q=tcs`, { headers: { Cookie: aliceCookie } })).json();
  assert(found[0]?.ticker === "TCS", "searching 'tcs' puts TCS first");
  const stats = await (await fetch(`${BASE}/api/stats`, { headers: { Cookie: aliceCookie } })).json();
  assert(stats.strategies === 20 && stats.companies > 0 && stats.filters >= 40, "the header's counts come back");

  // The screener: filters on any metric, the columns asked for, and the strategies' criteria still working
  // The whole market as the app asks for it: a GET the browser can keep
  const wholeQ = encodeURIComponent(JSON.stringify({ filters: [], columns: ["roce"] }));
  const whole1 = await fetch(`${BASE}/api/screen?q=${wholeQ}`, { headers: { Cookie: aliceCookie } });
  const wholeTag = whole1.headers.get("etag");
  const wholeBody = await whole1.json();
  assert(whole1.status === 200 && wholeBody.matched > 100 && wholeTag, "the whole market comes back as a GET, with a fingerprint");
  const whole2 = await fetch(`${BASE}/api/screen?q=${wholeQ}`, { headers: { Cookie: aliceCookie } });
  assert(whole2.headers.get("etag") === wholeTag, "the same market gives the same fingerprint (nothing in it changes by the second)");
  const whole304 = await fetch(`${BASE}/api/screen?q=${wholeQ}`, { headers: { Cookie: aliceCookie, "If-None-Match": wholeTag } });
  assert(whole304.status === 304 && (await whole304.text()) === "", "a return visit with the market unchanged gets a 304 and no body");
  assert((await fetch(`${BASE}/api/screen?q=%7Bnope`, { headers: { Cookie: aliceCookie } })).status === 400, "a GET screen with broken JSON is a 400");
  const screenRes = await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "roce", min: 25, max: null }, { id: "capSize", values: ["Large cap"] }], columns: ["roce", "ret1m"] });
  const screened = await screenRes.json();
  assert(screenRes.status === 200 && screened.matched > 0 && screened.results.every(r => r.values.roce >= 25 && r.capSize === "Large cap"), "a screen keeps only companies inside every filter");
  assert(screened.results.every(r => "ret1m" in r.values), "a screen returns the columns asked for");
  assert(/ROCE.*≥ 25%/.test(screened.queryUsed), "a screen describes its filters in words");
  // A strategy that ranks by a measure: its list and its card's best five, highest first
  const byGain = await (await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "ret1w", min: 0, max: null }, { id: "marketCapCr", min: 500, max: null }], columns: ["ret1w"], sort: "ret1w" })).json();
  const gains = byGain.results.map(r => r.values?.ret1w);
  assert(gains.length > 1 && gains.every((v, i) => i === 0 || v <= gains[i - 1]), `sort: "ret1w" lists the biggest one-week gain first (${gains.slice(0, 3).join(", ")}…)`);
  const gainTop = await (await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "ret1w", min: 0, max: null }], countOnly: true, top: 5, sort: "ret1w" })).json();
  assert(gainTop.top?.length && gainTop.top.every((t, i) => t.value != null && (i === 0 || t.value <= gainTop.top[i - 1].value)) && gainTop.top[0].value === Math.max(...gainTop.top.map(t => t.value)), "and a card's best five are the five biggest gains, each with its gain");
  const unsorted = await (await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "ret1w", min: 0, max: null }], countOnly: true, top: 3, sort: "../nope" })).json();
  assert(unsorted.top?.every(t => t.value === undefined), "an unknown measure to sort by is ignored: best by quality, as before");
  const technical = await (await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "rsi14", min: null, max: 30 }, { id: "delivery1m", min: 50, max: null }], columns: ["rsi14", "delivery1m", "beta1y"] })).json();
  assert(technical.matched > 0 && technical.results.every(r => r.values.rsi14 <= 30 && r.values.delivery1m >= 50), "technical filters from the daily prices (RSI, delivery %) work like any other");
  const junk = await (await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "nope", min: 1 }, { id: "roce" }], columns: ["../x"] })).json();
  assert(junk.filters.length === 0 && junk.matched === junk.total, "unknown metrics and empty filters are ignored, not errors");
  const hqc = presets.find(p => p.id === "high_quality_compounders");
  const byCriteria = await (await json("POST", "/api/screen", aliceCookie, hqc.criteria)).json();
  const byFilters = await (await json("POST", "/api/screen", aliceCookie, { filters: hqc.filters })).json();
  assert(byCriteria.matched === byFilters.matched, "a strategy gives the same companies by its criteria or by its filters");
  const zipped = await fetch(`${BASE}/api/metrics`, { headers: { "Accept-Encoding": "gzip" } });
  assert(zipped.headers.get("content-encoding") === "gzip", "big answers are sent compressed when the browser accepts it");
  const perf = await fetch(`${BASE}/api/performance`, { headers: { Cookie: aliceCookie } });
  const perfBody = await perf.json();
  assert(perf.status === 200 && Array.isArray(perfBody.presets), "the Performance tab's strategy data comes back");
  assert(perfBody.researchStudy?.benchmark === "Nifty 500" && Array.isArray(perfBody.researchStudy.cohorts), "the Performance tab also returns prospective score-study data");

  // The front page's figures need no sign-in; who's signed in comes with /me
  const publicStats = await fetch(`${BASE}/api/stats`);
  assert(publicStats.status === 200 && (await publicStats.json()).strategies === 20, "the front page's figures load without signing in");
  assert((await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } })).json()).email === "alice@example.com", "/me says which email is signed in");

  // The Momentum tab: on for a copy off Render, behind sign-in, an answer
  // even with tight settings
  assert((await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } })).json()).features?.momentum === true, "/me opens the Momentum tab off Render");
  assert((await fetch(`${BASE}/api/momentum`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status === 401, "POST /api/momentum with no cookie is rejected");
  const mom = await json("POST", "/api/momentum", aliceCookie, { config: { nearHighPct: 0, rsiMin: 99, rsiMax: 100 } });
  const momBody = await mom.json();
  assert(mom.status === 200 && Array.isArray(momBody.passers) && momBody.counts && momBody.config.rsiMin === 99, "POST /api/momentum answers with the settings it used");

  // Telegram alerts, with Telegram itself stubbed out: linking by the one-time
  // code, a message once per crossing, /stop, an expired code
  const { linkCode, handleTelegramUpdate } = await import("./telegram.js");
  const { notifyAlerts } = await import("./alert-notifier.js");
  const daveSignup = await json("POST", "/api/auth/signup", "", { email: "dave@example.com", password: "davespassword1" });
  const daveCookie = extractCookie(daveSignup);
  const daveId = (await daveSignup.json()).userId;
  const tgStatus = await (await fetch(`${BASE}/api/telegram`, { headers: { Cookie: daveCookie } })).json();
  assert(tgStatus.configured === false && tgStatus.connected === false, "without a bot key, Telegram reports not set up and not connected");
  assert((await json("POST", "/api/telegram/link", daveCookie)).status === 503, "no connect link is made without a bot key");
  const update = text => ({ message: { chat: { id: 4242, type: "private" }, from: { first_name: "Dave" }, text } });
  assert(/expired/.test(handleTelegramUpdate(update("/start not-a-real-code"))[1]), "an unknown or expired code doesn't link anything");
  const linked = handleTelegramUpdate(update(`/start ${linkCode(daveId)}`));
  const afterLink = await (await fetch(`${BASE}/api/telegram`, { headers: { Cookie: daveCookie } })).json();
  assert(linked[0] === 4242 && /Connected/.test(linked[1]) && afterLink.connected && afterLink.name === "Dave", "/start with the code links that chat to the account");
  const daveAlert = await (await json("POST", "/api/alerts", daveCookie, { ticker: "INFY", name: "Infosys", condition: "below", threshold: 900 })).json();
  const sent = [];
  const send = async (chatId, html) => { sent.push({ chatId, html }); };
  const at = price => ({ INFY: { price, asOf: "2026-09-30", source: "close" } });
  await notifyAlerts({ prices: at(950), send });
  assert(sent.length === 0, "no message while the price hasn't crossed");
  await notifyAlerts({ prices: at(880), send });
  assert(sent.length === 1 && sent[0].chatId === 4242 && /Infosys/.test(sent[0].html) && /₹880/.test(sent[0].html), "a message when the price crosses the alert");
  await notifyAlerts({ prices: at(870), send });
  assert(sent.length === 1, "no repeat while the price stays across");
  await notifyAlerts({ prices: at(950), send });
  await notifyAlerts({ prices: at(890), send });
  assert(sent.length === 2, "a new message after it crosses back and then crosses again");
  await json("PUT", `/api/alerts/${daveAlert.id}`, daveCookie, { threshold: 895 });
  await notifyAlerts({ prices: at(890), send });
  assert(sent.length === 3, "editing an alert lets it send again");
  assert(/Disconnected/.test(handleTelegramUpdate(update("/stop"))[1]) && !(await (await fetch(`${BASE}/api/telegram`, { headers: { Cookie: daveCookie } })).json()).connected, "/stop disconnects the chat");
  await notifyAlerts({ prices: at(800), send });
  assert(sent.length === 3, "nothing is sent once disconnected");

  // Phone notifications (push.js), with Firebase stubbed out: the app's
  // token, alerts to the phone, and news from the watchlist
  assert((await json("POST", "/api/push/token", "", { token: "x".repeat(40) })).status === 401, "a notification token needs an account");
  assert((await json("POST", "/api/push/token", daveCookie, { token: "not a token" })).status === 400, "something that isn't a token is refused");
  const phoneToken = `fcm-${"a".repeat(60)}`;
  assert((await json("POST", "/api/push/token", daveCookie, { token: phoneToken, platform: "android" })).status === 200, "the app's token is kept for the account");
  const { pushTokens, sendPush } = await import("./push.js");
  assert(pushTokens(daveId).length === 1 && pushTokens(daveId)[0] === phoneToken, "one phone, once");
  const pushed = [];
  const push = async (userId, message) => { pushed.push({ userId, message }); return true; };
  await notifyAlerts({ prices: at(950), send, push });
  await notifyAlerts({ prices: at(880), send, push });
  assert(pushed.length === 1 && pushed[0].userId === daveId && /Infosys is ₹880/.test(pushed[0].message.title) && /At or below your alert price of ₹895/.test(pushed[0].message.body) && pushed[0].message.data.stock === "INFY" && sent.length === 3,
    "an alert crossing goes to the phone, without Telegram, and opens the company");
  await notifyAlerts({ prices: at(870), send, push });
  assert(pushed.length === 1, "no repeat on the phone while the price stays across");
  const { newsPush } = await import("./news-push.js");
  const watched = new Set(["INFY"]);
  const one = newsPush([{ id: "nse-1", type: "filing", symbol: "INFY", company: "INFOSYS LIMITED", title: "Outcome of Board Meeting", time: "2026-10-23T10:00:00.000Z" }], watched);
  assert(one.title === "Infosys" && one.body === "Outcome of Board Meeting" && one.data.news === "nse-1", "one news item: the company, the item, and it opens the item");
  const many = newsPush([
    { id: "h-1", type: "headline", title: "Infosys wins a deal", companies: [{ symbol: "TCS", name: "Tata Consultancy Services Limited" }, { symbol: "INFY", name: "Infosys Limited" }], time: "2026-10-23T11:00:00.000Z" },
    { id: "nse-2", type: "filing", symbol: "INFY", company: "INFOSYS LIMITED", title: "Press release", time: "2026-10-23T10:00:00.000Z" },
  ], watched);
  assert(many.title === "2 updates from your watchlist" && many.body.startsWith("Infosys: Infosys wins a deal") && many.data.tab === "watchlist", "several: one message naming the watched company, opening the Watchlist");
  assert(newsPush([], watched) === null, "nothing new, no message");
  // the FCM request itself, against a stubbed Google
  const { generateKeyPairSync: pushKeys } = await import("node:crypto");
  const { privateKey: pushKey } = pushKeys("rsa", { modulusLength: 2048 });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: "demo-project", client_email: "push@demo-project.iam.gserviceaccount.com", private_key: pushKey.export({ type: "pkcs8", format: "pem" }) });
  const calls = [];
  const fakeGoogle = async (url, init) => {
    calls.push({ url, init });
    if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3600 }));
    if (JSON.parse(init.body).message.token === "gone-token") return new Response(JSON.stringify({ error: { message: "Requested entity was not found.", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
    return new Response("{}");
  };
  assert(await sendPush(phoneToken, { title: "T", body: "B", data: { stock: "INFY" } }, { fetchImpl: fakeGoogle }) === "sent", "a message to FCM is sent");
  const fcm = calls.find(c => c.url.includes("fcm.googleapis.com"));
  const msg = JSON.parse(fcm.init.body).message;
  assert(fcm.url === "https://fcm.googleapis.com/v1/projects/demo-project/messages:send" && fcm.init.headers.authorization === "Bearer ya29.test" && msg.token === phoneToken && msg.notification.title === "T" && msg.data.stock === "INFY" && msg.android.notification.channel_id === "updates",
    "to the project's FCM endpoint, signed in, to that phone, on the app's channel");
  const jwt = new URLSearchParams(calls[0].init.body).get("assertion").split(".");
  assert(jwt.length === 3 && JSON.parse(Buffer.from(jwt[1], "base64url")).scope === "https://www.googleapis.com/auth/firebase.messaging", "Google's sign-in is a signed JWT for FCM only");
  assert(await sendPush("gone-token", { title: "T", body: "B" }, { fetchImpl: fakeGoogle }) === "gone", "an uninstalled app's token is reported gone");
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  assert((await json("DELETE", "/api/push/token", daveCookie, { token: phoneToken })).status === 200 && pushTokens(daveId).length === 0, "turning them off, or signing out, takes the phone's token back");
  await notifyAlerts({ prices: at(950), send, push });
  await notifyAlerts({ prices: at(880), send, push });
  assert(pushed.length === 1, "no phone, nothing pushed");

  // The owner's visitor numbers (visits.js): anonymous counts, only for OWNER_EMAILS
  assert((await fetch(`${BASE}/api/owner/stats`)).status === 401, "visitor numbers need an account");
  process.env.OWNER_EMAILS = "dave@example.com";
  assert((await fetch(`${BASE}/api/owner/stats`, { headers: { Cookie: aliceCookie } })).status === 404, "anyone but the owner is told there's nothing there");
  const statsBefore = await (await fetch(`${BASE}/api/owner/stats`, { headers: { Cookie: daveCookie } })).json();
  const loadsBefore = statsBefore.days[0]?.pageLoads ?? 0;
  await fetch(`${BASE}/`, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 Chrome/130" } });
  await fetch(`${BASE}/`, { headers: { Accept: "text/html", "User-Agent": "Googlebot/2.1" } });
  await fetch(`${BASE}/api/stats`, { headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 Chrome/130" } });
  const statsAfter = await (await fetch(`${BASE}/api/owner/stats`, { headers: { Cookie: daveCookie } })).json();
  assert(statsAfter.days[0].pageLoads === loadsBefore + 1 && statsAfter.accounts >= 2, "a person's page load is counted, a robot's and a data request aren't");
  const ownerMe = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: daveCookie } })).json();
  assert(ownerMe.features.owner === true, "the owner's account knows it may see them");
  delete process.env.OWNER_EMAILS;

  // Password guessing and mass sign-ups are limited
  const { limits } = await import("./rate-limit.js");
  for (let i = 0; i < 5; i++) await json("POST", "/api/auth/login", "", { email: "alice@example.com", password: `wrong-guess-${i}` });
  const sixth = await json("POST", "/api/auth/login", "", { email: "alice@example.com", password: "correcthorsebattery" });
  assert(sixth.status === 429 && /Too many wrong passwords/.test((await sixth.json()).error) && Number(sixth.headers.get("retry-after")) > 0, "after 5 wrong passwords an account is locked for a while, even with the right one");
  const otherAccount = await json("POST", "/api/auth/login", "", { email: "dave@example.com", password: "davespassword1" });
  assert(otherAccount.status === 200, "one account's lock doesn't lock others");
  limits.wrongPassword.clear();
  assert((await json("POST", "/api/auth/login", "", { email: "alice@example.com", password: "correcthorsebattery" })).status === 200, "the right password works once the lock has passed");
  limits.signupIp.clear();
  for (let i = 0; i < 10; i++) await json("POST", "/api/auth/signup", "", { email: `bulk${i}@example.com`, password: "bulkpassword1" });
  assert((await json("POST", "/api/auth/signup", "", { email: "bulk10@example.com", password: "bulkpassword1" })).status === 429, "an 11th sign-up from one connection within the hour is refused");
  limits.signupIp.clear();
  const huge = await json("POST", "/api/screen", aliceCookie, { filters: [], padding: "x".repeat(300 * 1024) });
  assert(huge.status === 413 && /too large/i.test((await huge.json()).error), "a request bigger than 256 KB is refused with 413");

  // Password reset by email, with the email itself stubbed out
  const emailMod = await import("./email.js");
  assert(!(await (await fetch(`${BASE}/api/auth/options`)).json()).passwordReset, "without email set up, password reset isn't offered");
  assert((await json("POST", "/api/auth/forgot", "", { email: "alice@example.com" })).status === 503, "and asking for one says it isn't available yet");
  Object.assign(process.env, { RESEND_API_KEY: "test-key", EMAIL_FROM: "Stockwise <no-reply@stockwise.test>", APP_URL: "https://stockwise.test" });
  const outbox = [];
  emailMod.setEmailSender(async m => { outbox.push(m); });
  assert((await (await fetch(`${BASE}/api/auth/options`)).json()).passwordReset === true, "with email set up, password reset is offered");
  // Sign-up proves the email with a 6-digit code once email is set up: no
  // account exists until the code typed matches the one sent
  const settle = () => new Promise(r => setTimeout(r, 50));
  const codeOf = m => m?.text.match(/\b(\d{6})\b/)?.[1];
  const erinStart = await json("POST", "/api/auth/signup", "", { email: "erin@example.com", password: "erinsoldpassword" });
  await settle();
  assert(erinStart.status === 202 && (await erinStart.json()).verify === true && !(erinStart.headers.get("set-cookie") ?? "").includes("stockwise_session="), "with email set up, sign-up sends a code instead of opening the account");
  const erinMail = outbox.at(-1);
  assert(erinMail?.to === "erin@example.com" && codeOf(erinMail) && /code/i.test(erinMail.subject), "the code goes to the email typed");
  assert((await json("POST", "/api/auth/login", "", { email: "erin@example.com", password: "erinsoldpassword" })).status === 401, "there's no account until the code is typed");
  const notIt = codeOf(erinMail) === "000000" ? "111111" : "000000";
  assert((await json("POST", "/api/auth/signup/verify", "", { email: "erin@example.com", code: notIt })).status === 400, "a wrong code doesn't open it");
  const erinSignup = await json("POST", "/api/auth/signup/verify", "", { email: "Erin@Example.com", code: ` ${codeOf(erinMail)} ` });
  const erinOldCookie = extractCookie(erinSignup);
  assert(erinSignup.status === 200 && erinOldCookie.startsWith("stockwise_session="), "the right code opens the account and signs in");
  assert((await json("POST", "/api/auth/signup/verify", "", { email: "erin@example.com", code: codeOf(erinMail) })).status === 400, "a code works once");
  assert((await json("POST", "/api/auth/signup", "", { email: "erin@example.com", password: "someoneelse123" })).status === 409, "a proven email can't be signed up again");
  // A new code replaces the last; five wrong codes end the attempt; codes expire
  await json("POST", "/api/auth/signup", "", { email: "fay@example.com", password: "fayspassword1" });
  await settle();
  const fayFirst = codeOf(outbox.at(-1));
  assert((await json("POST", "/api/auth/signup/resend", "", { email: "fay@example.com" })).status === 200, "a new code can be asked for");
  await settle();
  const faySecond = codeOf(outbox.at(-1));
  assert(outbox.at(-1).to === "fay@example.com" && faySecond, "and is sent");
  if (fayFirst !== faySecond) assert((await json("POST", "/api/auth/signup/verify", "", { email: "fay@example.com", code: fayFirst })).status === 400, "the earlier code stops working");
  for (let i = 0; i < 4; i++) await json("POST", "/api/auth/signup/verify", "", { email: "fay@example.com", code: faySecond === "000000" ? "111111" : "000000" });
  assert((await json("POST", "/api/auth/signup/verify", "", { email: "fay@example.com", code: faySecond })).status === 400, "after five wrong codes even the right one doesn't work — start again");
  await json("POST", "/api/auth/signup", "", { email: "gus@example.com", password: "gusspassword1" });
  await settle();
  const gusCode = codeOf(outbox.at(-1));
  (await import("./db.js")).db.prepare("UPDATE pending_signups SET expires_at = ? WHERE email = ?").run("2000-01-01T00:00:00.000Z", "gus@example.com");
  assert(/expired/i.test((await (await json("POST", "/api/auth/signup/verify", "", { email: "gus@example.com", code: gusCode })).json()).error), "an old code has expired");
  const sentBefore = outbox.length;
  const known = await json("POST", "/api/auth/forgot", "", { email: "Erin@Example.com" });
  const unknown = await json("POST", "/api/auth/forgot", "", { email: "nobody@example.com" });
  await settle();
  assert(known.status === 200 && unknown.status === 200 && JSON.stringify(await known.json()) === JSON.stringify(await unknown.json()), "the reply is the same whether or not the email has an account");
  const resets = outbox.slice(sentBefore);
  const link = resets.length === 1 && resets[0].to === "erin@example.com" ? resets[0].text.match(/https:\/\/stockwise\.test\/reset-password\?token=([\w-]+)/) : null;
  assert(link, "only the real account gets an email, with a link on the app's own address");
  const resetRes = await json("POST", "/api/auth/reset", "", { token: link[1], password: "erinsnewpassword" });
  assert(resetRes.status === 200 && extractCookie(resetRes).startsWith("stockwise_session="), "the link sets a new password and signs in");
  assert((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: erinOldCookie } })).status === 401, "a reset signs the account out everywhere else");
  assert((await json("POST", "/api/auth/login", "", { email: "erin@example.com", password: "erinsoldpassword" })).status === 401 &&
    (await json("POST", "/api/auth/login", "", { email: "erin@example.com", password: "erinsnewpassword" })).status === 200, "the old password stops working and the new one works");
  assert((await json("POST", "/api/auth/reset", "", { token: link[1], password: "anotherpassword1" })).status === 400, "a reset link works only once");
  await json("POST", "/api/auth/forgot", "", { email: "erin@example.com" });
  await new Promise(r => setTimeout(r, 50));
  const second = outbox.at(-1).text.match(/token=([\w-]+)/)[1];
  (await import("./db.js")).db.prepare("UPDATE password_resets SET expires_at = ? WHERE used_at IS NULL").run("2000-01-01T00:00:00.000Z");
  assert((await json("POST", "/api/auth/reset", "", { token: second, password: "anotherpassword1" })).status === 400, "an expired reset link doesn't work");
  await json("POST", "/api/auth/forgot", "", { email: "erin@example.com" });
  assert((await json("POST", "/api/auth/forgot", "", { email: "erin@example.com" })).status === 429, "a 4th reset request for one account within the hour is refused");
  for (const k of ["RESEND_API_KEY", "EMAIL_FROM", "APP_URL"]) delete process.env[k];

  // Google / Apple / phone sign-in through Firebase, with Google's signing
  // keys replaced by a test key: genuine, expired, other-project and forged
  // tokens, linking to an existing email, phone accounts, password-less delete
  const { generateKeyPairSync, createSign } = await import("node:crypto");
  const fb = await import("./firebase-auth.js");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const forger = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  fb.setFirebaseKeysForTests({ "test-kid": publicKey.export({ type: "spki", format: "pem" }) });
  Object.assign(process.env, { FIREBASE_PROJECT_ID: "stockwise-test", FIREBASE_API_KEY: "test-web-key" });
  const nowS = Math.floor(Date.now() / 1000);
  const idToken = (claims, key = privateKey) => {
    const enc = o => Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = `${enc({ alg: "RS256", kid: "test-kid", typ: "JWT" })}.${enc({ iss: "https://securetoken.google.com/stockwise-test", aud: "stockwise-test", iat: nowS - 10, auth_time: nowS - 10, exp: nowS + 3600, ...claims })}`;
    return `${body}.${createSign("RSA-SHA256").update(body).sign(key).toString("base64url")}`;
  };
  const google = (sub, email, extra = {}) => idToken({ sub, email, email_verified: true, name: "Frank Test", firebase: { sign_in_provider: "google.com" }, ...extra });
  const fbSignIn = token => json("POST", "/api/auth/firebase", "", { idToken: token });
  const opts = await (await fetch(`${BASE}/api/auth/options`)).json();
  assert(opts.firebase?.projectId === "stockwise-test" && opts.firebase.providers.join() === "google,phone", "with Firebase set up, the sign-in card is told Google and phone are on (Apple off until enabled)");
  const frank = await fbSignIn(google("uid-frank", "Frank@Gmail.com"));
  const frankCookie = extractCookie(frank);
  const frankMe = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: frankCookie } })).json();
  assert(frank.status === 200 && frankMe.email === "frank@gmail.com" && frankMe.name === "Frank Test" && frankMe.hasPassword === false, "a first Google sign-in makes an account with the Google email and name, no password");
  assert((await (await fbSignIn(google("uid-frank", "frank@gmail.com"))).json()).userId === frankMe.userId, "signing in with Google again opens the same account");
  const aliceId = (await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } })).json()).userId;
  const aliceGoogle = await fbSignIn(google("uid-alice-google", "alice@example.com"));
  const aliceGoogleCookie = extractCookie(aliceGoogle);
  assert((await aliceGoogle.json()).userId === aliceId, "a verified Google email joins the email account already using it");
  // Anyone can type any email at sign-up, so a password account's email isn't
  // proven. Whoever proves it with Google takes the account over: the
  // unproven password stops working and its sessions end — else someone who
  // signed up with your Gmail first would keep a way into your account.
  assert((await json("POST", "/api/auth/login", "", { email: "alice@example.com", password: "correcthorsebattery" })).status === 401, "after a Google sign-in proves the email, the password typed at sign-up no longer opens the account");
  assert((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } })).status === 401, "and the password's sessions are signed out");
  const aliceMe = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceGoogleCookie } })).json();
  assert(aliceMe.userId === aliceId && aliceMe.hasPassword === false, "the Google sign-in keeps the account, its data, and no password");
  assert((await (await fbSignIn(google("uid-alice-google", "alice@example.com"))).json()).userId === aliceId, "the next Google sign-in opens it again");
  // Erin proved her email with the sign-up code (and the reset link), so a
  // Google sign-in with it joins her account and keeps her password
  assert((await fbSignIn(google("uid-erin-google", "erin@example.com"))).status === 200 &&
    (await json("POST", "/api/auth/login", "", { email: "erin@example.com", password: "erinsnewpassword" })).status === 200, "a Google sign-in with a proven email keeps its password");
  const unverified = await fbSignIn(google("uid-mallory", "alice@example.com", { email_verified: false }));
  assert(unverified.status === 401, "an unverified email never opens someone else's account");
  const phoneRes = await fbSignIn(idToken({ sub: "uid-phone", phone_number: "+919876543210", firebase: { sign_in_provider: "phone" } }));
  const phoneCookie = extractCookie(phoneRes);
  const phoneMe = await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: phoneCookie } })).json();
  assert(phoneRes.status === 200 && phoneMe.phone === "+919876543210" && phoneMe.email === null, "a phone sign-in makes an account with just the number");
  assert((await fbSignIn(idToken({ sub: "uid-old", email: "old@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" }, iat: nowS - 7200, auth_time: nowS - 7200, exp: nowS - 3600 }))).status === 401, "an expired sign-in token is refused");
  assert((await fbSignIn(idToken({ sub: "uid-x", email: "x@gmail.com", email_verified: true, firebase: { sign_in_provider: "google.com" }, aud: "someone-elses-project", iss: "https://securetoken.google.com/someone-elses-project" }))).status === 401, "a token for another Firebase project is refused");
  assert((await fbSignIn(idToken({ sub: "uid-forged", email: "alice@example.com", email_verified: true, firebase: { sign_in_provider: "google.com" } }, forger))).status === 401, "a token not signed by Google's key is refused");
  assert((await fbSignIn(idToken({ sub: "uid-anon", firebase: { sign_in_provider: "anonymous" } }))).status === 400, "only Google, Apple and phone sign-ins are accepted");
  assert((await json("POST", "/api/auth/login", "", { email: "frank@gmail.com", password: "anything-at-all" })).status === 401, "a Google account has no password to sign in with");
  assert((await json("POST", "/api/auth/delete-account", phoneCookie, { confirm: "delete it" })).status === 400 &&
    (await json("POST", "/api/auth/delete-account", phoneCookie, { confirm: "DELETE" })).status === 200, "a password-less account is deleted by typing DELETE");
  fb.setFirebaseKeysForTests(null);
  for (const k of ["FIREBASE_PROJECT_ID", "FIREBASE_API_KEY"]) delete process.env[k];

  // Daily backups: a readable copy with every account, the last 14 kept
  const { backupDatabase } = await import("./backup.js");
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdtempSync, readdirSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const backupDir = mkdtempSync(join(tmpdir(), "stockwise-backup-test-"));
  const { db: liveDb } = await import("./db.js");
  const copy = backupDatabase({ dir: backupDir, now: new Date("2026-10-01T10:00:00Z") });
  const copyDb = new DatabaseSync(copy, { readOnly: true });
  const usersInCopy = copyDb.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  copyDb.close();
  assert(usersInCopy > 0 && usersInCopy === liveDb.prepare("SELECT COUNT(*) AS n FROM users").get().n, "a backup is a readable copy holding every account");
  for (let d = 2; d <= 17; d++) backupDatabase({ dir: backupDir, now: new Date(Date.UTC(2026, 9, d, 10)) });
  const kept = readdirSync(backupDir).filter(f => f.endsWith(".db")).sort();
  assert(kept.length === 14 && kept[0] === "app-2026-10-04.db" && kept.at(-1) === "app-2026-10-17.db", "only the last 14 days of backups are kept");
  rmSync(backupDir, { recursive: true, force: true });

  // Deleting an account removes it and everything saved with it
  const carolSignup = await json("POST", "/api/auth/signup", "", { email: "carol@example.com", password: "carolspassword1" });
  const carolCookie = extractCookie(carolSignup);
  const carolId = (await carolSignup.json()).userId;
  await json("POST", "/api/alerts", carolCookie, { ticker: "INFY", condition: "below", threshold: 900 });
  await json("POST", "/api/watchlist", carolCookie, { ticker: "INFY", price: 1000 });
  await json("POST", "/api/portfolio", carolCookie, { ticker: "INFY", buyPrice: 1000, qty: 5 });
  linkCode(carolId); // a Telegram connect code waiting
  assert((await json("POST", "/api/auth/delete-account", carolCookie, { password: "not-her-password" })).status === 400, "deleting an account needs the right password");
  assert((await json("POST", "/api/auth/delete-account", "", { password: "carolspassword1" })).status === 401, "deleting an account needs a signed-in session");
  const deleted = await json("POST", "/api/auth/delete-account", carolCookie, { password: "carolspassword1" });
  assert(deleted.status === 200 && /stockwise_session=;/.test(deleted.headers.get("set-cookie") || ""), "deleting an account works and clears the cookie");
  assert((await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: carolCookie } })).status === 401, "the deleted account's session no longer works");
  assert((await json("POST", "/api/auth/login", "", { email: "carol@example.com", password: "carolspassword1" })).status === 401, "the deleted account can't sign in");
  const { db } = await import("./db.js");
  const leftovers = ["users", "sessions", "alerts", "watchlist", "holdings", "thesis_notes", "stock_notes", "saved_strategies", "telegram_links"]
    .map(t => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === "users" ? "id" : "user_id"} = ?`).get(carolId).n);
  assert(leftovers.every(n => n === 0), "nothing of the deleted account is left in any table");
  assert((await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceGoogleCookie } })).json()).length === 1, "deleting one account leaves other accounts' data alone");

  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: aliceGoogleCookie } });
  const afterLogout = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceGoogleCookie } });
  assert(afterLogout.status === 401, "the old cookie stops working after logout — the session was actually deleted server-side, not just cleared client-side");

  console.log("\nAll HTTP-layer checks passed.");
  server.close();
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
