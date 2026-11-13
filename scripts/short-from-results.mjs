// A Short from a company's live results page (13 Nov 2026): the figures are
// read from the page's own "full results" table — exactly what a visitor to
// the link in the description sees — never typed in. Writes a spec for
// scripts/shorts.mjs and builds the video (silent: music is added on YouTube
// from its library), plus the title and description to paste.
//   node scripts/short-from-results.mjs HAL [q2-fy27]
// → replica/launch/shorts/auto-<symbol>.mp4 and .txt
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/shorts");
const SITE = "https://jocularinsights.in";
const [symbol, slug = "q2-fy27"] = process.argv.slice(2);
if (!symbol) { console.error("usage: node scripts/short-from-results.mjs SYMBOL [q2-fy27]"); process.exit(1); }

const url = `${SITE}/stock/${encodeURIComponent(symbol)}/results/${slug}`;
const res = await fetch(url, { headers: { "User-Agent": "JocularShorts/1.0" } });
if (!res.ok) throw new Error(`${url}: ${res.status}`);
const html = await res.text();
const text = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const h1 = text(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
const name = h1.replace(/\s+Q\d FY\d\d results$/, "");
const label = h1.match(/(Q\d FY\d\d)/)?.[1] ?? slug.toUpperCase().replace("-", " ");
const table = html.slice(html.indexOf("rq-table"));
const rows = new Map([...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1]))).filter(r => r.length >= 4).map(r => [r[0], r]));
const head = rows.get("Item");
const n = s => (s == null || s === "—" ? null : Number(s.replace(/[,%₹ ]/g, "").replace("−", "-").replace("pts", "")));
const get = item => { const r = rows.get(item); return r ? { now: n(r[1]), then: n(r[2]), nowTxt: r[1], thenTxt: r[2], change: r[3] } : null; };
const sales = get("Sales"), margin = get("Operating margin %"), profit = get("Net profit");
if (!head || !sales || !profit || head[2] == null) throw new Error(`${url}: no year-earlier quarter in the table`);
if (!(profit.now > 0) || !(profit.then > 0)) throw new Error(`${symbol}: a loss in one of the two quarters — not a two-figure story; pick another`);
const yearAgo = head[2];
const pct = s => s.replace("+", "up ").replace("−", "down ");
const cr = t => `₹${t} cr`;
const max = (...v) => Math.max(...v.filter(x => x != null)) * 1.04;
const rowsSpec = [
  ["Sales", cr(sales.nowTxt), `${pct(sales.change)} from ${cr(sales.thenTxt)}`, sales.now / max(sales.now, sales.then), sales.then / max(sales.now, sales.then)],
  margin && margin.now != null && margin.then != null && margin.now > 0 && margin.then > 0
    ? ["Operating margin", margin.nowTxt, `from ${margin.thenTxt}`, margin.now / max(margin.now, margin.then) , margin.then / max(margin.now, margin.then)]
    : null,
  ["Net profit", cr(profit.nowTxt), `${pct(profit.change)} from ${cr(profit.thenTxt)}`, profit.now / max(profit.now, profit.then), profit.then / max(profit.now, profit.then)],
].filter(Boolean);
const word = c => (c.startsWith("−") ? "down" : "up");
const short = text(html.match(/class="rq-short"><b>In short:<\/b> ([^<]*)/)?.[1] ?? "");
const spec = {
  kicker: `${name} · ${label}`,
  title: `Profit ${word(profit.change)} ${profit.change.replace(/^[+−]/, "")}.<br>Sales ${word(sales.change)} ${sales.change.replace(/^[+−]/, "")}.`,
  rows: rowsSpec,
  line: short || `Against ${yearAgo}, as filed with NSE.`,
  foot: `${label} against ${yearAgo}, as filed with NSE. Not investment advice.`,
};
mkdirSync(OUT, { recursive: true });
const key = `auto-${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const specFile = join(OUT, `${key}.json`);
writeFileSync(specFile, JSON.stringify({ [key]: spec }, null, 2));
execFileSync("node", [join(ROOT, "scripts/shorts.mjs"), "--spec", specFile, key], { stdio: "inherit" });
const title = `${name} ${label} results: profit ${word(profit.change)} ${profit.change.replace(/^[+−]/, "")}, sales ${word(sales.change)} ${sales.change.replace(/^[+−]/, "")} #Shorts`.slice(0, 100);
const desc = `${name}${/s$/i.test(name) ? "'" : "'s"} ${label}: sales ${cr(sales.nowTxt)} (${cr(sales.thenTxt)} in ${yearAgo})${margin?.nowTxt ? `, operating margin ${margin.nowTxt} (${margin.thenTxt})` : ""}, net profit ${cr(profit.nowTxt)} (${cr(profit.thenTxt)}).\n\nThe full quarter, line by line: ${url}\n\nFigures as filed with NSE. Not investment advice.\n\n#${name.replace(/[^A-Za-z0-9]/g, "")} #${label.replace(" ", "")}Results #StockMarketIndia`;
writeFileSync(join(OUT, `${key}.txt`), `TITLE:\n${title}\n\nDESCRIPTION:\n${desc}\n`);
console.log(JSON.stringify({ video: join(OUT, `${key}.mp4`), title, desc }, null, 2));
