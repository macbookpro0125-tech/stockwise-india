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

  const presets = await (await fetch(`${BASE}/api/presets`)).json();
  assert(Array.isArray(presets) && presets.length === 13 && presets.every(p => p.criteria), "GET /api/presets returns the 13 strategies with their criteria");
  assert(presets.every(p => Array.isArray(p.filters) && p.filters.length > 0 && p.filters.every(f => f.id)), "each strategy also comes as the screener's filters");

  const metrics = await (await fetch(`${BASE}/api/metrics`)).json();
  assert(metrics.metrics.length >= 90 && metrics.metrics.every(x => x.id && x.label && x.category), "GET /api/metrics lists 90+ metrics with labels and categories");
  const strip = await (await fetch(`${BASE}/api/market-strip`)).json();
  assert(strip.asOf && strip.stocks.length > 0 && strip.stocks.every(s => s.symbol && s.cmp > 0), "the price strip has the latest close date and the largest companies' prices");
  const roceDef = metrics.metrics.find(x => x.id === "roce");
  assert(roceDef.range?.q?.length === 101 && roceDef.range.q[0] <= roceDef.range.q[100], "each metric comes with its spread across the market, percentile by percentile");

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

  // Alerts: edit, pause, and ownership
  const [tcsAlert] = await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } })).json();
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, bobCookie, { threshold: 1 })).status === 404, "bob can't edit alice's alert");
  const paused = await (await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: 3200, enabled: false })).json();
  assert(paused.threshold === 3200 && paused.enabled === 0, "editing an alert changes its price and can pause it");
  assert((await json("PUT", `/api/alerts/${tcsAlert.id}`, aliceCookie, { threshold: -5 })).status === 400, "an alert price below 0 is refused");

  // Search, header counts, performance
  const found = await (await fetch(`${BASE}/api/search?q=tcs`, { headers: { Cookie: aliceCookie } })).json();
  assert(found[0]?.ticker === "TCS", "searching 'tcs' puts TCS first");
  const stats = await (await fetch(`${BASE}/api/stats`, { headers: { Cookie: aliceCookie } })).json();
  assert(stats.strategies === 13 && stats.companies > 0 && stats.filters >= 40, "the header's counts come back");

  // The screener: filters on any metric, the columns asked for, and the strategies' criteria still working
  const screenRes = await json("POST", "/api/screen", aliceCookie, { filters: [{ id: "roce", min: 25, max: null }, { id: "capSize", values: ["Large cap"] }], columns: ["roce", "ret1m"] });
  const screened = await screenRes.json();
  assert(screenRes.status === 200 && screened.matched > 0 && screened.results.every(r => r.values.roce >= 25 && r.capSize === "Large cap"), "a screen keeps only companies inside every filter");
  assert(screened.results.every(r => "ret1m" in r.values), "a screen returns the columns asked for");
  assert(/ROCE.*≥ 25%/.test(screened.queryUsed), "a screen describes its filters in words");
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
  assert(publicStats.status === 200 && (await publicStats.json()).strategies === 13, "the front page's figures load without signing in");
  assert((await (await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: aliceCookie } })).json()).email === "alice@example.com", "/me says which email is signed in");

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
  const erinSignup = await json("POST", "/api/auth/signup", "", { email: "erin@example.com", password: "erinsoldpassword" });
  const erinOldCookie = extractCookie(erinSignup);
  const known = await json("POST", "/api/auth/forgot", "", { email: "Erin@Example.com" });
  const unknown = await json("POST", "/api/auth/forgot", "", { email: "nobody@example.com" });
  await new Promise(r => setTimeout(r, 50));
  assert(known.status === 200 && unknown.status === 200 && JSON.stringify(await known.json()) === JSON.stringify(await unknown.json()), "the reply is the same whether or not the email has an account");
  const link = outbox.length === 1 && outbox[0].to === "erin@example.com" ? outbox[0].text.match(/https:\/\/stockwise\.test\/reset-password\?token=([\w-]+)/) : null;
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
  assert((await (await fbSignIn(google("uid-alice-google", "alice@example.com"))).json()).userId === aliceId, "a verified Google email joins the email account already using it");
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
  const leftovers = ["users", "sessions", "alerts", "watchlist", "holdings", "thesis_notes", "telegram_links"]
    .map(t => db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === "users" ? "id" : "user_id"} = ?`).get(carolId).n);
  assert(leftovers.every(n => n === 0), "nothing of the deleted account is left in any table");
  assert((await (await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } })).json()).length === 1, "deleting one account leaves other accounts' data alone");

  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: aliceCookie } });
  const afterLogout = await fetch(`${BASE}/api/alerts`, { headers: { Cookie: aliceCookie } });
  assert(afterLogout.status === 401, "the old cookie stops working after logout — the session was actually deleted server-side, not just cleared client-side");

  console.log("\nAll HTTP-layer checks passed.");
  server.close();
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
