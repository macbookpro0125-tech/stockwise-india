// Head-to-head Short (14 Nov 2026; HDFC Bank vs ICICI Bank drew the most views
// of our first videos): two companies' latest quarters side by side, from their
// live results pages and public data — sales and profit growth, margin, quality
// score, and the share price over a year. Facts only; no "which to buy".
//   node scripts/shorts-voice/from-pair.mjs EICHERMOT TVSMOTOR
//   node scripts/shorts-voice/from-pair.mjs --auto   the two largest in one sector that both reported in the last 2 weeks
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { words, sayPct, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const ROOT = join(import.meta.dirname, "../..");
const data = async sym => { const j = await (await fetch(`${SITE}/api/public/stock/${encodeURIComponent(sym)}`, UA)).json(); return j.stock ?? j; };

let [a, b] = process.argv.slice(2);
if (a === "--auto") {
  // the recent filers (results-day lists them, largest first per day), grouped by sector
  const rd = JSON.parse(execFileSync("node", [join(ROOT, "scripts/results-day.mjs")]).toString());
  const recent = rd.google.concat(rd.bing).map(u => u.match(/\/stock\/([^/]+)\/results/)?.[1]).filter(Boolean);
  const seen = new Set(), bySector = new Map();
  for (const sym of [...new Set(recent)].slice(0, 60)) {
    if (seen.has(sym)) continue; seen.add(sym);
    try { const s = await data(decodeURIComponent(sym)); if (!s.sector || !(s.quarter?.profitCr > 0) || s.quarter.profitYoY == null) continue; (bySector.get(s.sector) ?? bySector.set(s.sector, []).get(s.sector)).push(s); } catch { /* skip */ }
  }
  const pairs = [...bySector.values()].filter(l => l.length >= 2).map(l => l.sort((x, y) => y.marketCapCr - x.marketCapCr).slice(0, 2)).sort((x, y) => y[1].marketCapCr - x[1].marketCapCr);
  if (!pairs.length) throw new Error("no sector with two recent filers");
  [a, b] = pairs[0].map(s => s.symbol);
}
if (!a || !b) { console.error("usage: node scripts/shorts-voice/from-pair.mjs SYM1 SYM2 | --auto"); process.exit(1); }
const [A, B] = await Promise.all([data(a), data(b)]);
for (const s of [A, B]) if (!s.quarter || s.quarter.profitYoY == null || s.quarter.salesYoY == null) throw new Error(`${s.symbol}: no comparable quarter`);
const nm = s => s.name.replace(/ Limited$/, "");
const short = s => (nm(s).length > 14 ? nm(s).split(" ")[0] : nm(s));
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
const label = A.quarter.label;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });
const pTile = (s, k, sub) => ({ label: short(s), value: Math.abs(s.quarter[k]), prefix: s.quarter[k] >= 0 ? "+" : "−", suffix: "%", dec: 1, sub, tone: s.quarter[k] >= 0 ? "teal" : "red" });
const faster = A.quarter.profitYoY >= B.quarter.profitYoY ? A : B, slower = faster === A ? B : A;

L(`${sayName(nm(A))}, versus ${sayName(nm(B))}. Same business: who had the better ${label.split(" ")[0]} quarter?`, `*${nm(A)}* vs *${nm(B)}*: who had the better quarter?`,
  { type: "tiles", tiles: [pTile(A, "profitYoY", `net profit, ${label}`), pTile(B, "profitYoY", `net profit, ${label}`)] });
const crs = x => `₹${Math.round(x).toLocaleString("en-IN")} crore`;
for (const s of [A, B]) L(`${sayName(nm(s))}: net profit ${words(s.quarter.profitCr)} crore, ${s.quarter.profitYoY >= 0 ? "up" : "down"} ${sayPct(s.quarter.profitYoY)}.`, `${nm(s)}: profit ${crs(s.quarter.profitCr)}, ${s.quarter.profitYoY >= 0 ? "*" : "~"}${pc(s.quarter.profitYoY)}${s.quarter.profitYoY >= 0 ? "*" : "~"}.`,
  { type: "card", symbol: s.symbol, card: "results", circle: "profit" });
L(`Sales: ${sayName(short(A))} ${A.quarter.salesYoY >= 0 ? "up" : "down"} ${sayPct(A.quarter.salesYoY)}, ${sayName(short(B))} ${B.quarter.salesYoY >= 0 ? "up" : "down"} ${sayPct(B.quarter.salesYoY)}.`, `Sales: ${short(A)} *${pc(A.quarter.salesYoY)}*, ${short(B)} *${pc(B.quarter.salesYoY)}*.`,
  { type: "bars", bars: [{ label: `${short(A)} sales`, value: Math.abs(A.quarter.salesYoY), prefix: A.quarter.salesYoY >= 0 ? "+" : "−", suffix: "%", dec: 1, tone: "grey" }, { label: `${short(B)} sales`, value: Math.abs(B.quarter.salesYoY), prefix: B.quarter.salesYoY >= 0 ? "+" : "−", suffix: "%", dec: 1 }] });
if (A.quality != null && B.quality != null) L(`Quality scores: ${words(A.quality)}, and ${words(B.quality)}.`, `Quality: ${short(A)} *${Math.round(A.quality)}*, ${short(B)} *${Math.round(B.quality)}*.`,
  { type: "tiles", tiles: [{ label: short(A), value: A.quality, sub: "quality score /100" }, { label: short(B), value: B.quality, sub: "quality score /100" }] });
if (A.change1y != null && B.change1y != null) L(`Over a year, the shares: ${sayName(short(A))} ${A.change1y >= 0 ? "up" : "down"} ${sayPct(A.change1y)}, ${sayName(short(B))} ${B.change1y >= 0 ? "up" : "down"} ${sayPct(B.change1y)}.`, `Shares in a year: ${short(A)} ${A.change1y >= 0 ? "*" : "~"}${pc(A.change1y)}${A.change1y >= 0 ? "*" : "~"}, ${short(B)} ${B.change1y >= 0 ? "*" : "~"}${pc(B.change1y)}${B.change1y >= 0 ? "*" : "~"}.`,
  { type: "chart", series: [{ symbol: A.symbol, label: short(A), tone: A.change1y >= 0 ? "teal" : "red" }, { symbol: B.symbol, label: short(B), tone: B.change1y >= 0 ? "teal" : "gold" }] });
L(`${sayName(short(faster))} grew profit faster this quarter. One quarter, though: check the trend.`, `*${short(faster)}* grew profit faster. One quarter: *check the trend.*`,
  { type: "pair", items: [{ icon: faster.quarter.profitYoY >= 0 ? "▲" : "▼", title: short(faster), sub: `profit ${pc(faster.quarter.profitYoY)}`, tone: "teal" }, { icon: slower.quarter.profitYoY >= 0 ? "▲" : "▼", title: short(slower), sub: `profit ${pc(slower.quarter.profitYoY)}`, tone: slower.quarter.profitYoY >= 0 ? "gold" : "red" }] });
L("Save this, for the next results season.", "*Save this* for the next results season.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const key = `pair-${A.symbol.toLowerCase()}-${B.symbol.toLowerCase()}-${label.toLowerCase().replace(" ", "-")}`;
const spec = { key, source: `${nm(A)} and ${nm(B)} · ${label} as filed with NSE · prices and scores at the ${day(A.closeDate)} close · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const row = s => `• ${nm(s)}: sales ₹${Math.round(s.quarter.salesCr).toLocaleString("en-IN")} crore (${pc(s.quarter.salesYoY)}), net profit ₹${Math.round(s.quarter.profitCr).toLocaleString("en-IN")} crore (${pc(s.quarter.profitYoY)})${s.quality != null ? `, quality ${Math.round(s.quality)}/100` : ""}${s.change1y != null ? `, shares ${pc(s.change1y)} in a year` : ""}`;
const ask = "Which two companies should we compare next? Tell us in the comments.";
const body = `${nm(A)} vs ${nm(B)}, ${label} (vs a year earlier):\n${row(A)}\n${row(B)}\n\n${short(faster)} grew profit faster this quarter. One quarter isn't a trend; check the earlier ones.`;
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\n${nm(A)} vs ${nm(B)} ${label.replace(/^(Q\d) /, "$1 Results ")}: Who Grew Profit Faster?`.slice(0, 115) + `\n\nYOUTUBE DESCRIPTION\n${body}\n\n${ask}\n\nBoth quarters, line by line: https://jocularinsights.in/stock/${A.symbol}/results/${label.toLowerCase().replace(" ", "-")} and https://jocularinsights.in/stock/${B.symbol}/results/${label.toLowerCase().replace(" ", "-")}\n\nFigures as filed with NSE; prices and scores at the ${day(A.closeDate)} close. Educational content, not investment advice.\n\n#${nm(A).replace(/[^A-Za-z0-9]/g, "")} #${nm(B).replace(/[^A-Za-z0-9]/g, "")} #IndianStockMarket #Q2Results #Shorts\n\n` +
  `INSTAGRAM CAPTION\n${body}\n\n${ask}\n\nFull results, free: jocularinsights.in\n\nFigures as filed with NSE. Educational content, not investment advice.\n\n#IndianStockMarket #StockMarketIndia #Q2Results #Investing\n`);
console.log(JSON.stringify({ pair: [nm(A), nm(B)], faster: nm(faster), spec: join(DIR, "spec.json") }, null, 1));
