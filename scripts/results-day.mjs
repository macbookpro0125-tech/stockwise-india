// Results season, each day (13 Nov 2026): which results pages to push to
// Google and Bing, and which company's quarter to make a Short of — from
// the live /results page (each filing day's companies, largest first).
// What's already been sent is kept in handoff/indexing-state.json.
//   node scripts/results-day.mjs              the next batches, as JSON
//   node scripts/results-day.mjs --mark google URL…   record requests made
//   node scripts/results-day.mjs --mark bing URL…
//   node scripts/results-day.mjs --mark short SYMBOL
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = join(ROOT, "handoff/indexing-state.json");
const SITE = "https://jocularinsights.in";
const GOOGLE_PER_DAY = 10, BING_PER_DAY = 100;

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf-8")) : { google: [], bing: [], shorts: [] };
const save = () => writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);

const args = process.argv.slice(2);
if (args[0] === "--mark") {
  const [, kind, ...items] = args;
  const key = kind === "short" ? "shorts" : kind;
  if (!state[key]) throw new Error(`unknown kind ${kind}`);
  const day = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  for (const it of items) if (!state[key].some(x => x.item === it)) state[key].push({ item: it, on: day });
  save();
  console.log(`recorded ${items.length} ${kind}`);
  process.exit(0);
}

const html = await (await fetch(`${SITE}/results`, { headers: { "User-Agent": "JocularResultsDay/1.0" } })).text();
const unesc = s => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").trim();
const num = s => { const t = unesc(s).replace(/[,%+]/g, "").replace("−", "-"); return t === "—" || t === "" ? null : Number(t); };
// each "Filed <date> — N companies" section and its table rows, in page order (largest first within a day)
const days = [];
for (const sec of html.split(/<h2>Filed /).slice(1)) {
  const date = sec.slice(0, sec.indexOf(" —"));
  const rows = [...sec.matchAll(/<tr><th><a href="(\/stock\/([^/"]+)\/results\/([^"]+))">([^<]+)<\/a>[\s\S]*?<\/th><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)];
  days.push({ date, companies: rows.map(r => ({ url: SITE + r[1], symbol: decodeURIComponent(r[2]), quarter: r[3], name: unesc(r[4]), sales: num(r[5]), salesYoY: num(r[6]), profit: num(r[7]), profitYoY: num(r[8]) })) });
}
const done = key => new Set(state[key].map(x => x.item));
const all = days.flatMap(d => d.companies.map(c => ({ ...c, filed: d.date })));
const googleDone = done("google"), bingDone = done("bing"), shortDone = done("shorts");
// Google: the largest not yet requested, newest day first (page order)
const google = all.filter(c => !googleDone.has(c.url)).slice(0, GOOGLE_PER_DAY).map(c => c.url);
const bing = all.filter(c => !bingDone.has(c.url)).slice(0, BING_PER_DAY).map(c => c.url);
// a Short: among the newest day's ten largest, one with a profit both years
// and a clear move (a story in two figures), not already made
const newest = days[0]?.companies ?? [];
const short = newest.slice(0, 10).filter(c => !shortDone.has(c.symbol) && c.profit > 0 && c.profitYoY != null && c.salesYoY != null)
  .sort((a, b) => Math.abs(b.profitYoY) + Math.abs(b.salesYoY) - (Math.abs(a.profitYoY) + Math.abs(a.salesYoY)))[0] ?? null;
console.log(JSON.stringify({ newestDay: days[0]?.date ?? null, companiesListed: all.length, google, bing, short }, null, 2));
