// Anonymous visitor counting (visits.js)
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "visits-test.db");
process.env.STOCKWISE_DB = DB_PATH; // never the real app.db
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
delete process.env.TRUST_PROXY;

const { countPageLoad, countActive, visitStats, isOwner, isPageLoad, istWeek } = await import("./visits.js");
const { db } = await import("./db.js");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

const CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
const req = (ip, { ua = CHROME, accept = "text/html,application/xhtml+xml", method = "GET", headers = {} } = {}) =>
  ({ method, headers: { "user-agent": ua, accept, ...headers }, socket: { remoteAddress: ip } });

// Thursday 23 Oct 2026, 10:00 IST
const T = Date.parse("2026-10-23T04:30:00Z");
const H = 3600_000;

assert(isPageLoad(req("1.1.1.1"), "/") && isPageLoad(req("1.1.1.1"), "/stock/TCS"), "a page is a page load");
assert(!isPageLoad(req("1.1.1.1"), "/api/news") && !isPageLoad(req("1.1.1.1"), "/assets/index-abc.js") && !isPageLoad(req("1.1.1.1"), "/logo.png"), "its data, scripts and pictures aren't");
assert(!isPageLoad(req("1.1.1.1", { ua: "Googlebot/2.1 (+http://www.google.com/bot.html)" }), "/") && !isPageLoad(req("1.1.1.1", { ua: "WhatsApp/2.23" }), "/") && !isPageLoad(req("1.1.1.1", { ua: "curl/8.4" }), "/"), "robots, link previews and scripts aren't people");
assert(!isPageLoad(req("1.1.1.1", { headers: { "sec-purpose": "prefetch" } }), "/"), "a prefetch isn't a visit");
assert(!isPageLoad(req("1.1.1.1", { accept: "*/*" }), "/") && !isPageLoad(req("1.1.1.1", { method: "POST" }), "/"), "nor a request that doesn't want a page");

// two people on Thursday, one of them three times
countPageLoad(req("1.1.1.1"), "/", T);
countPageLoad(req("1.1.1.1"), "/stock/TCS", T + H);
countPageLoad(req("1.1.1.1"), "/", T + 2 * H);
countPageLoad(req("2.2.2.2"), "/", T + 3 * H);
countPageLoad(req("2.2.2.2", { ua: "Googlebot" }), "/", T + 3 * H);
countPageLoad(req("3.3.3.3"), "/api/stats", T + 3 * H);
let s = visitStats(T + 4 * H);
assert(s.days[0].day === "2026-10-23" && s.days[0].visitors === 2 && s.days[0].pageLoads === 4, "Thursday: 2 visitors, 4 page loads");

// Friday: the first one again, and someone new
const F = T + 24 * H;
countPageLoad(req("1.1.1.1"), "/", F);
countPageLoad(req("4.4.4.4"), "/", F);
s = visitStats(F);
assert(s.days[0].day === "2026-10-24" && s.days[0].visitors === 2, "Friday: 2 visitors");
assert(s.weeks[0].week === istWeek(F) && s.weeks[0].visitors === 3, "the week: 3 people, the returning one once");

// nothing kept that could find anyone: Thursday's codes and secret are gone, no address anywhere
const periods = db.prepare("SELECT DISTINCT period FROM visit_seen").all().map(r => r.period);
assert(!periods.includes("d:2026-10-23") && !db.prepare("SELECT 1 FROM visit_secrets WHERE period = 'd:2026-10-23'").get(), "a finished day's codes and secret are deleted");
const everything = JSON.stringify([db.prepare("SELECT * FROM visit_seen").all(), db.prepare("SELECT * FROM visit_days").all(), db.prepare("SELECT * FROM visit_weeks").all()]);
assert(!/1\.1\.1\.1|4\.4\.4\.4|Chrome/.test(everything), "no address or browser is stored");

// the next week starts again, and last week's codes go
const nextMonday = Date.parse("2026-10-26T04:30:00Z");
countPageLoad(req("1.1.1.1"), "/", nextMonday);
s = visitStats(nextMonday);
assert(s.weeks[0].week === "2026-10-26" && s.weeks[0].visitors === 1 && s.weeks[1].visitors === 3, "a new week counts afresh; last week's total stays");
assert(!db.prepare("SELECT 1 FROM visit_seen WHERE period = ?").get(`w:${istWeek(F)}`), "last week's codes are deleted");

// signed-in people, once a day each
countActive(7, nextMonday); countActive(7, nextMonday + H); countActive(8, nextMonday);
assert(visitStats(nextMonday).days[0].activeUsers === 2, "two accounts active, each once");

// who may see it
assert(isOwner("Owner@Example.com", { OWNER_EMAILS: " owner@example.com , other@x.in" }), "an owner email, any case or spacing");
assert(!isOwner("someone@example.com", { OWNER_EMAILS: "owner@example.com" }) && !isOwner("owner@example.com", {}) && !isOwner(null, { OWNER_EMAILS: "owner@example.com" }), "nobody else, and nobody when unset");

// counting never stops a page
assert(countPageLoad({ method: "GET", headers: null, socket: {} }, "/", T) === false, "a broken request is skipped, not thrown");

db.close();
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
console.log("visits tests passed");
