// IndexNow: which changed pages are sent, once each (indexnow.js)
import { unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "indexnow-test.db");
process.env.STOCKWISE_DB = DB_PATH; // never the real app.db
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);

const { changedPaths, submitChanged, startIndexNow, INDEXNOW_KEY } = await import("./indexnow.js");
const { db } = await import("./db.js");

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}

const NOW = Date.parse("2026-10-30T07:30:00Z"); // Friday 1 pm IST
const SITE = "https://jocularinsights.in";
const entries = [["/", "2026-10-29"], ["/stock/TCS", "2026-10-28"], ["/stock/OLD", "2026-07-15"], ["/stock/NODATE", null]];

assert(changedPaths(entries, NOW).map(([p]) => p).join() === "/,/stock/TCS", "only pages dated in the last few days");

const calls = [];
const ok = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { status: 202 }; };
let r = await submitChanged(entries, { site: SITE, now: NOW, fetchImpl: ok });
assert(r.sent === 2 && calls[0].url === "https://api.indexnow.org/indexnow", "one request to IndexNow");
assert(calls[0].body.host === "jocularinsights.in" && calls[0].body.key === INDEXNOW_KEY && calls[0].body.keyLocation === `${SITE}/${INDEXNOW_KEY}.txt`, "with the site, its key and where the key is");
assert(calls[0].body.urlList.join() === `${SITE}/,${SITE}/stock/TCS`, "the full addresses");

r = await submitChanged(entries, { site: SITE, now: NOW, fetchImpl: ok });
assert(r.sent === 0 && calls.length === 1, "a page isn't sent twice for the same date");

r = await submitChanged([["/", "2026-10-30"], ["/stock/TCS", "2026-10-28"]], { site: SITE, now: NOW, fetchImpl: ok });
assert(r.sent === 1 && calls[1].body.urlList.join() === `${SITE}/`, "a new date sends it again");

let threw = false;
try { await submitChanged([["/stock/INFY", "2026-10-30"]], { site: SITE, now: NOW, fetchImpl: async () => ({ status: 429 }) }); } catch { threw = true; }
assert(threw && changedPaths([["/stock/INFY", "2026-10-30"]], NOW).length === 1, "a refused request is tried again next time");

assert(startIndexNow({ entries: () => [], site: SITE, env: {} }) === false, "off on a laptop");
assert(startIndexNow({ entries: () => [], site: SITE, env: { RENDER: "true", INDEXNOW: "off" } }) === false, "and when turned off");

db.close();
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) if (existsSync(f)) unlinkSync(f);
console.log("indexnow tests passed");
