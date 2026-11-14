// The weekly roundup Short (14 Nov 2026, for Saturdays): the week in one video.
// The Nifty 50 as a heat map of the week's moves, the week's biggest gainers
// and fallers among companies worth ₹1,000 crore or more, each sector's week,
// and the biggest company due to report next week. All of it comes from the live
// list pages (/lists/nifty-50-stocks, /lists/top-gainers-this-week,
// /lists/nifty-500-stocks) and /results-calendar. Price facts only: no tips.
//   node scripts/shorts-voice/from-weekly.mjs            → ~/Projects/files/shorts-v2/weekly-<date>/spec.json, post.txt
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { words, sayPct, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const get = async slug => {
  const r = await fetch(`${SITE}/api/public/lists/${slug}`, UA);
  if (!r.ok) throw new Error(`${slug}: ${r.status}`);
  return r.json();
};
const [nifty, week, n500] = await Promise.all([get("nifty-50-stocks"), get("top-gainers-this-week"), get("nifty-500-stocks")]);
const cal = await (await fetch(`${SITE}/api/public/results-calendar`, UA)).json().catch(() => null);
const date = nifty.pricesDate;
const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayShort = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const n50 = nifty.companies.filter(c => c.change1w != null && c.marketCapCr > 0);
const ups = n50.filter(c => c.change1w > 0).length, downs = n50.filter(c => c.change1w < 0).length;
// gainers from the weekly list (₹1,000 crore+); it stops at 300 rows, so the week's
// fallers come from the Nifty 500 (all of it worth far more than ₹1,000 crore)
const gain = week.companies.filter(c => c.change1w != null).slice(0, 5);
const lose = n500.companies.filter(c => c.change1w != null && c.change1w < 0).sort((a, b) => a.change1w - b.change1w).slice(0, 5);
if (n50.length < 40 || gain.length < 3 || lose.length < 3) throw new Error("not enough of the week's prices on the live lists");
// each sector's week: the Nifty 500 companies in it, weighted by market value, sectors with 5 or more
const bySector = new Map();
for (const c of n500.companies) if (c.sector && c.change1w != null && c.marketCapCr > 0) { const g = bySector.get(c.sector) ?? { w: 0, s: 0, n: 0 }; g.w += c.marketCapCr; g.s += c.change1w * c.marketCapCr; g.n++; bySector.set(c.sector, g); }
const sectors = [...bySector].filter(([, g]) => g.n >= 5).map(([name, g]) => ({ name, change: g.s / g.w })).sort((a, b) => b.change - a.change);
const shortSector = n => n.replace(/ and /g, " & ").replace("Oil Gas & Consumable Fuels", "Oil & Gas").replace("Automobile & Auto Components", "Auto").replace("Fast Moving Consumer Goods", "FMCG").replace("Information Technology", "IT").replace("Consumer Durables", "Durables");
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
// the Nifty 50 as a whole for the week, weighted by market value (as the index roughly is)
const w = n50.reduce((a, c) => a + c.marketCapCr, 0), wk = n50.reduce((a, c) => a + c.change1w * c.marketCapCr, 0) / w;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });

L(`The week in the Indian stock market, in sixty seconds. Of the Nifty 50, ${words(ups)} rose this week and ${words(downs)} fell.`, `*The week* to ${dayShort(date)}: Nifty 50, *${ups} up*, ~${downs} down~.`,
  { type: "heatmap", cells: n50.map(c => ({ label: c.symbol, value: c.change1w, size: c.marketCapCr })), scale: 6 });
L(`The week's biggest gainers: ${gain.slice(0, 3).map(c => `${sayName(c.name)}, up ${sayPct(c.change1w)}`).join("; ")}.`, `Week's *gainers*: ${gain.slice(0, 3).map(c => `${c.name} *${pc(c.change1w)}*`).join(", ")}.`,
  { type: "rank", rows: gain.map(c => ({ label: c.name, sub: c.sector ?? "", value: c.change1w, text: pc(c.change1w), tone: "teal" })) });
L(`The biggest fallers: ${lose.slice(0, 3).map(c => `${sayName(c.name)}, down ${sayPct(c.change1w)}`).join("; ")}.`, `Week's *fallers*: ${lose.slice(0, 3).map(c => `${c.name} ~${pc(c.change1w)}~`).join(", ")}.`,
  { type: "rank", rows: lose.map(c => ({ label: c.name, sub: c.sector ?? "", value: c.change1w, text: pc(c.change1w), tone: "red" })) });
if (sectors.length >= 6) {
  const top = sectors[0], bottom = sectors[sectors.length - 1], shown = [...sectors.slice(0, 3), ...sectors.slice(-3)];
  L(`By sector: ${sayName(shortSector(top.name))} led the week, ${top.change >= 0 ? "up" : "down"} ${sayPct(top.change)}; ${sayName(shortSector(bottom.name))} was weakest, ${bottom.change >= 0 ? "up" : "down"} ${sayPct(bottom.change)}.`,
    `Sectors: *${shortSector(top.name)} ${pc(top.change)}* led, ~${shortSector(bottom.name)} ${pc(bottom.change)}~ weakest.`,
    { type: "rank", rows: shown.map(x => ({ n: sectors.indexOf(x) + 1, label: shortSector(x.name), sub: "", value: x.change, text: pc(x.change), tone: x.change >= 0 ? "teal" : "red" })) });
}
// next week: the biggest company due to report (from the results calendar), if any
const until = new Date(Date.parse((cal?.today ?? date) + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
const next = (cal?.days ?? []).filter(d => d.date > (cal.today ?? date) && d.date <= until).flatMap(d => d.companies.map(c => ({ ...c, date: d.date }))).sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
const wdSay = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
if (next.length) L(`Next week, ${words(next.length)} ${next.length === 1 ? "company reports" : "companies report"} results; the biggest, ${sayName(next[0].name)}, on ${wdSay(next[0].date)}.`, `Next week: *${next.length}* ${next.length === 1 ? "result" : "results"} due, the biggest *${next[0].name}* (${new Date(next[0].date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}).`,
  { type: "big", text: String(next.length), sub: `${next.length === 1 ? "company reports" : "companies report"} next week · biggest: ${next[0].name}` });
L("Follow for the week's market, every Saturday.", "*Follow* for the week's market, every Saturday.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const key = `weekly-${date}`;
const spec = { key, source: `NSE closing prices, the five trading days to ${day(date)}; companies worth ₹1,000 crore or more · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const list = cs => cs.map((c, i) => `${i + 1}. ${c.name} ${pc(c.change1w)}`).join("\n");
const ask = "Which company should we look at next week? Tell us in the comments.";
const secLine = sectors.length >= 6 ? `\n\nSectors this week (Nifty 500, weighted by size): ${sectors.map(x => `${shortSector(x.name)} ${pc(x.change)}`).join(", ")}` : "";
const nextLine = next.length ? `\n\nNext week: ${next.length} ${next.length === 1 ? "company reports" : "companies report"} results, the biggest ${next[0].name} (${day(next[0].date)}).` : "";
const body = `The week to ${day(date)}: ${ups} of the Nifty 50 rose, ${downs} fell (the 50 together ${pc(wk)}, weighted by size).${secLine}\n\nThe week's top gainers (₹1,000 crore+):\n${list(gain)}\n\nThe week's biggest fallers (Nifty 500):\n${list(lose)}${nextLine}`;
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\n${`Stock Market This Week (to ${dayShort(date)}): ${gain[0].name} ${pc(gain[0].change1w)} | Weekly Roundup`.slice(0, 100)}\n\nYOUTUBE DESCRIPTION\n${body}\n\n${ask}\n\nThe Jocular app on Android: https://play.google.com/store/apps/details?id=com.jocularinsights.app\n\nThe week's full list: https://jocularinsights.in/lists/top-gainers-this-week\n\nNSE closing prices. Educational content, not investment advice.\n\n#StockMarketThisWeek #Nifty50 #IndianStockMarket #WeeklyRoundup #Shorts\n\n` +
  `INSTAGRAM CAPTION\nThe week in the Indian stock market, to ${day(date)}: ${ups} of the Nifty 50 up, ${downs} down.\n\nTop gainers:\n${list(gain)}\n\nBiggest fallers (Nifty 500):\n${list(lose)}${nextLine}\n\n${ask}\n\nFull lists, free: jocularinsights.in\n\nNSE closing prices. Educational content, not investment advice.\n\n#StockMarketThisWeek #IndianStockMarket #Nifty50 #Investing\n`);
console.log(JSON.stringify({ date, ups, downs, nifty50Week: +wk.toFixed(2), gainers: gain.map(c => c.name), fallers: lose.map(c => c.name), next: next.slice(0, 1).map(c => c.name), spec: join(DIR, "spec.json") }, null, 1));
