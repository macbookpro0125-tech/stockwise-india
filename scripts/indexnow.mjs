// Tell Bing (and the other IndexNow engines: Yandex, Seznam, Naver) which
// pages are new or changed, so they're crawled within hours (14 Nov 2026:
// Bing had indexed only the front page; 100 URLs a day typed into its
// "Submit URLs" box sat "discovered but not crawled" for two weeks).
// The key is public by design: Bing checks it at https://jocularinsights.in/<key>.txt.
//   node scripts/indexnow.mjs URL…                 those pages
//   node scripts/indexnow.mjs --sitemap pages lists screens sectors   every URL in those sitemaps
//   node scripts/indexnow.mjs --results-day       the day's not-yet-sent results pages (results-day.mjs "bing"), recorded as sent
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://jocularinsights.in";
const KEY = "d16121b5b5c94aa501344bed4b61d10b";
const args = process.argv.slice(2);
let urls = [];
if (args[0] === "--sitemap") {
  for (const part of args.slice(1)) {
    const xml = await (await fetch(`${SITE}/sitemap-${part}.xml`)).text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  }
} else if (args[0] === "--results-day") {
  urls = JSON.parse(execFileSync("node", [join(ROOT, "scripts/results-day.mjs")]).toString()).bing ?? [];
} else urls = args;
urls = [...new Set(urls)].filter(u => u.startsWith(`${SITE}/`));
if (!urls.length) { console.log("nothing to send"); process.exit(0); }
// the key file must be live first, or the engines refuse the list
const check = await fetch(`${SITE}/${KEY}.txt`);
if (!check.ok || (await check.text()).trim() !== KEY) throw new Error(`${SITE}/${KEY}.txt isn't live yet — push first`);
let sent = 0;
for (let i = 0; i < urls.length; i += 10000) {
  const batch = urls.slice(i, i + 10000);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: "jocularinsights.in", key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: batch }),
  });
  // 200 and 202 both mean received
  if (res.status !== 200 && res.status !== 202) throw new Error(`IndexNow said ${res.status}: ${await res.text()}`);
  sent += batch.length;
}
console.log(`sent ${sent} URLs to IndexNow`);
if (args[0] === "--results-day") execFileSync("node", [join(ROOT, "scripts/results-day.mjs"), "--mark", "bing", ...urls], { stdio: "inherit" });
