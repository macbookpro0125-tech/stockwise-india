// The daily movers Short (14 Nov 2026, the owner: "highest gainers also we need
// to show", and a heat map): the Nifty 50 as a heat map, then the day's biggest
// gainers and losers among companies worth ₹1,000 crore or more — all read from
// the live list pages (/lists/nifty-50-stocks, /lists/top-gainers-today,
// /lists/top-losers-today). Facts of the day's prices only: no tips, no reasons
// we can't show from filings.
//   node scripts/shorts-voice/from-movers.mjs            → ~/Projects/files/shorts-v2/movers-<date>/spec.json, post.txt
//   JI_SITE=http://127.0.0.1:8790 node …                  (a local copy, for testing)
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { words, sayPct, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const get = async slug => {
  const r = await fetch(`${SITE}/api/public/lists/${slug}`, { headers: { "User-Agent": "JocularShorts/1.0" } });
  if (!r.ok) throw new Error(`${slug}: ${r.status} — is the list live yet?`);
  return r.json();
};
const [nifty, up, down, n500] = await Promise.all([get("nifty-50-stocks"), get("top-gainers-today"), get("top-losers-today"), get("nifty-500-stocks")]);
const date = nifty.pricesDate;
const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekday = new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
const n50 = nifty.companies.filter(c => c.change1d != null && c.marketCapCr > 0);
const ups = n50.filter(c => c.change1d > 0).length, downs = n50.filter(c => c.change1d < 0).length;
const gain = up.companies.filter(c => c.change1d != null).slice(0, 5), lose = down.companies.filter(c => c.change1d != null).slice(0, 5);
if (n50.length < 40 || gain.length < 3 || lose.length < 3) throw new Error("not enough of the day's prices on the live lists");
// each sector's move (owner, 14 Nov 2026): the Nifty 500 companies in it, the
// bigger ones counting more (weighted by market value), sectors with 5 or more
const bySector = new Map();
for (const c of n500.companies) if (c.sector && c.change1d != null && c.marketCapCr > 0) { const g = bySector.get(c.sector) ?? { w: 0, s: 0, n: 0 }; g.w += c.marketCapCr; g.s += c.change1d * c.marketCapCr; g.n++; bySector.set(c.sector, g); }
const sectors = [...bySector].filter(([, g]) => g.n >= 5).map(([name, g]) => ({ name, change: g.s / g.w, n: g.n })).sort((a, b) => b.change - a.change);
const shortSector = n => n.replace(/ and /g, " & ").replace("Oil Gas & Consumable Fuels", "Oil & Gas").replace("Automobile & Auto Components", "Auto").replace("Fast Moving Consumer Goods", "FMCG").replace("Information Technology", "IT").replace("Consumer Durables", "Durables");
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });
const mood = ups > downs * 1.5 ? "teal" : downs > ups * 1.5 ? "red" : "gold";

L(`${weekday}'s market, in one picture. Of the Nifty 50, ${words(ups)} rose and ${words(downs)} fell.`, `*Nifty 50* on ${weekday}: *${ups} up*, ~${downs} down~.`,
  { type: "heatmap", cells: n50.map(c => ({ label: c.symbol, value: c.change1d, size: c.marketCapCr })), scale: 3 });
L(`The biggest gainers: ${gain.slice(0, 3).map(c => `${sayName(c.name)}, up ${sayPct(c.change1d)}`).join("; ")}.`, `Biggest *gainers*: ${gain.slice(0, 3).map(c => `${c.name} *${pc(c.change1d)}*`).join(", ")}.`,
  { type: "rank", rows: gain.map(c => ({ label: c.name, sub: c.sector ?? "", value: c.change1d, text: pc(c.change1d), tone: "teal" })) });
L(`The biggest fallers: ${lose.slice(0, 3).map(c => `${sayName(c.name)}, down ${sayPct(c.change1d)}`).join("; ")}.`, `Biggest *fallers*: ${lose.slice(0, 3).map(c => `${c.name} ~${pc(c.change1d)}~`).join(", ")}.`,
  { type: "rank", rows: lose.map(c => ({ label: c.name, sub: c.sector ?? "", value: c.change1d, text: pc(c.change1d), tone: "red" })) });
if (sectors.length >= 6) {
  const top = sectors.slice(0, 3), bottom = sectors.slice(-3).reverse();
  const shown = [...sectors.slice(0, 3), ...sectors.slice(-3)];
  L(`By sector: ${sayName(shortSector(top[0].name))} led, ${top[0].change >= 0 ? "up" : "down"} ${sayPct(top[0].change)}; ${sayName(shortSector(bottom[0].name))} was weakest, ${bottom[0].change >= 0 ? "up" : "down"} ${sayPct(bottom[0].change)}.`,
    `Sectors: *${shortSector(top[0].name)} ${pc(top[0].change)}* led, ~${shortSector(bottom[0].name)} ${pc(bottom[0].change)}~ weakest.`,
    { type: "rank", rows: shown.map(x => ({ n: sectors.indexOf(x) + 1, label: shortSector(x.name), sub: "", value: x.change, text: pc(x.change), tone: x.change >= 0 ? "teal" : "red" })) });
}
L("A big move in a day isn't a reason on its own. Check the company's results first.", "A big move isn't a reason on its own. *Check the results first.*",
  { type: "pills", items: [{ text: "✓ Sales" }, { text: "✓ Profit" }, { text: "✓ Debt" }] });
L("Follow for the market, every evening.", "*Follow* for the market, every evening.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const key = `movers-${date}`;
const spec = { key, source: `NSE closing prices on ${day(date)}; companies worth ₹1,000 crore or more · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const list = (cs, s) => cs.map((c, i) => `${i + 1}. ${c.name} ${pc(c.change1d)}${s ? "" : ""}`).join("\n");
const title = `Top Gainers Today NSE (${day(date)}): ${gain[0].name} ${pc(gain[0].change1d)} | Nifty 50 Heat Map`.slice(0, 100);
const ask = "Which company's results should we explain next? Tell us in the comments.";
const secLine = sectors.length >= 6 ? `\n\nSectors (Nifty 500, weighted by size): ${sectors.map(x => `${shortSector(x.name)} ${pc(x.change)}`).join(", ")}` : "";
const body = `The Nifty 50 on ${weekday}, ${day(date)}: ${ups} up, ${downs} down.${secLine}\n\nTop gainers (₹1,000 crore+):\n${list(gain)}\n\nTop losers:\n${list(lose)}\n\nA big move in a day isn't a reason on its own; check the company's results first.`;
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\n${title}\n\nYOUTUBE DESCRIPTION\n${body}\n\n${ask}\n\nToday's full lists: https://jocularinsights.in/lists/top-gainers-today and https://jocularinsights.in/lists/top-losers-today\n\nNSE closing prices on ${day(date)}. Educational content, not investment advice.\n\n#TopGainers #StockMarketToday #Nifty50 #IndianStockMarket #NSE #Shorts\n\n` +
  `INSTAGRAM CAPTION\nThe market on ${weekday}, ${day(date)}: ${ups} of the Nifty 50 up, ${downs} down.\n\nTop gainers:\n${list(gain)}\n\nTop losers:\n${list(lose)}\n\nA big move isn't a reason on its own; check the results first.\n\n${ask}\n\nFull lists, free: jocularinsights.in\n\nNSE closing prices. Educational content, not investment advice.\n\n#TopGainers #StockMarketToday #Nifty50 #IndianStockMarket #Investing\n`);
console.log(JSON.stringify({ date, ups, downs, gainers: gain.map(c => c.name), spec: join(DIR, "spec.json") }, null, 1));
