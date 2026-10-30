// IndexNow (30 Oct 2026): tell Bing, Yandex and the others which pages
// changed, as they change, instead of waiting for them to crawl the sitemap
// again. The pages that changed are the ones the sitemap already dates:
// a company's page the day its latest results were filed, and the front page
// and results calendar with each new close. Each address goes once per date.
import { db } from "./db.js";
import { INDEXNOW_KEY } from "./indexnow-key.js";

export { INDEXNOW_KEY };
const ENDPOINT = "https://api.indexnow.org/indexnow";
const RECENT_DAYS = 3; // a page dated older than this isn't news to anyone
const MAX_URLS = 10_000; // IndexNow's limit for one request

db.exec(`
  CREATE TABLE IF NOT EXISTS indexnow_sent (
    path TEXT PRIMARY KEY,
    lastmod TEXT NOT NULL
  );
`);

// The pages to tell about: dated in the last few days, and not yet sent with
// that date. entries: [path, lastmod] as the sitemap lists them
export function changedPaths(entries, now = Date.now()) {
  const since = new Date(now + 330 * 60_000 - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const sent = db.prepare("SELECT lastmod FROM indexnow_sent WHERE path = ?");
  return entries.filter(([path, lastmod]) => lastmod && lastmod >= since && sent.get(path)?.lastmod !== lastmod).slice(0, MAX_URLS);
}

// One request for all of them; remembered only when IndexNow took it
export async function submitChanged(entries, { site, now = Date.now(), fetchImpl = fetch } = {}) {
  const changed = changedPaths(entries, now);
  if (!changed.length) return { sent: 0 };
  const host = new URL(site).host;
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList: changed.map(([path]) => `${site}${path}`) }),
  });
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow answered ${res.status}`);
  const keep = db.prepare("INSERT INTO indexnow_sent (path, lastmod) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET lastmod = excluded.lastmod");
  for (const [path, lastmod] of changed) keep.run(path, lastmod);
  return { sent: changed.length };
}

// Every hour, on the live site only (Render sets RENDER): a laptop or a test
// copy mustn't speak for jocularinsights.in. INDEXNOW=off turns it off there too
export function startIndexNow({ entries, site, everyMs = 60 * 60_000, log = console.error, env = process.env } = {}) {
  if ((env.INDEXNOW ?? (env.RENDER ? "on" : "off")) === "off") return false;
  const tick = async () => {
    try {
      const { sent } = await submitChanged(entries(), { site });
      if (sent) log(`[indexnow] told search engines about ${sent} page${sent === 1 ? "" : "s"}`);
    } catch (e) {
      log(`[indexnow] ${e.message}`);
    }
  };
  setTimeout(tick, 10 * 60_000); // after the market is built
  setInterval(tick, everyMs);
  return true;
}
