// The sector scorecard Short (15 Nov 2026, from the owner's list: "which sector
// made how much"). For the Nifty 500 companies that have filed the latest
// quarter, each sector's total net profit and sales against the same quarter a
// year earlier. The year-earlier figures come from each company's own growth
// figure; totals are weighted by size, as a sector's results really are.
// Sectors with 5+ reporters only. Facts from filings; no tips.
//   node scripts/shorts-voice/from-sectors.mjs   → ~/Projects/files/shorts-v2/sectors-<quarter>-<date>/spec.json, post.txt
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { words, sayPct, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const list = await (await fetch(`${SITE}/api/public/lists/nifty-500-stocks`, UA)).json();
const stocks = [];
const queue = [...list.companies];
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let c; (c = queue.shift());) {
    try { const j = await (await fetch(`${SITE}/api/public/stock/${encodeURIComponent(c.symbol)}`, UA)).json(); const s = j.stock ?? j; if (s?.quarter) stocks.push({ ...s, sector: s.sector ?? c.sector }); } catch { /* skipped */ }
  }
}));
// the latest quarter most companies have filed
const counts = new Map(); for (const s of stocks) counts.set(s.quarter.label, (counts.get(s.quarter.label) ?? 0) + 1);
const label = [...counts].sort((a, b) => b[1] - a[1])[0][0];
const filed = stocks.filter(s => s.quarter.label === label && s.sector);
const prev = (now, yoy) => (yoy == null || !(now > 0) ? null : now / (1 + yoy / 100));
const by = new Map();
for (const s of filed) {
  const q = s.quarter, pp = prev(q.profitCr, q.profitYoY), ps = prev(q.salesCr, q.salesYoY);
  if (pp == null || ps == null || !(pp > 0)) continue;   // a loss either year has no growth to add up
  const g = by.get(s.sector) ?? { profit: 0, profitPrev: 0, sales: 0, salesPrev: 0, n: 0, names: [] };
  g.profit += q.profitCr; g.profitPrev += pp; g.sales += q.salesCr; g.salesPrev += ps; g.n++; g.names.push(s.name);
  by.set(s.sector, g);
}
const sectors = [...by].filter(([, g]) => g.n >= 5).map(([name, g]) => ({ name, n: g.n, profit: (g.profit / g.profitPrev - 1) * 100, sales: (g.sales / g.salesPrev - 1) * 100, profitCr: g.profit })).sort((a, b) => b.profit - a.profit);
if (sectors.length < 6) throw new Error(`only ${sectors.length} sectors with 5+ reporters for ${label}`);
const shortSector = n => n.replace(/ and /g, " & ").replace("Oil Gas & Consumable Fuels", "Oil & Gas").replace("Automobile & Auto Components", "Auto").replace("Fast Moving Consumer Goods", "FMCG").replace("Information Technology", "IT").replace("Consumer Durables", "Durables");
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
const updown = x => (x >= 0 ? "up" : "down");
const qMonth = { Q1: "June", Q2: "September", Q3: "December", Q4: "March" }[label.split(" ")[0]] ?? label;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });
const top = sectors[0], low = sectors[sectors.length - 1];
const reporters = sectors.reduce((a, s) => a + s.n, 0);

L(`Which sectors had the best ${qMonth} quarter? We added up the filed results of ${words(reporters)} Nifty five hundred companies.`, `Which sectors had the best *${qMonth} quarter*?`,
  { type: "big", text: String(reporters), sub: `Nifty 500 companies' ${label} results, added up by sector` });
L(`Top of the table: ${sayName(shortSector(top.name))}, profit ${updown(top.profit)} ${sayPct(top.profit)}; then ${sayName(shortSector(sectors[1].name))}, and ${sayName(shortSector(sectors[2].name))}.`,
  `Profit growth: *${shortSector(top.name)} ${pc(top.profit)}* leads.`,
  { type: "rank", rows: [...sectors.slice(0, 3), ...sectors.slice(-3)].map(x => ({ n: sectors.indexOf(x) + 1, label: shortSector(x.name), sub: "", value: x.profit, text: pc(x.profit), tone: x.profit >= 0 ? "teal" : "red" })) });
L(`${sayName(shortSector(top.name))}: sales ${updown(top.sales)} ${sayPct(top.sales)}, profit ${updown(top.profit)} ${sayPct(top.profit)}, across ${words(top.n)} companies.`,
  `${shortSector(top.name)}: sales *${pc(top.sales)}*, profit *${pc(top.profit)}*`,
  { type: "tiles", tiles: [{ label: "Sales", value: Math.abs(top.sales), prefix: top.sales >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: `${shortSector(top.name)}, ${label}`, tone: top.sales >= 0 ? "teal" : "red" }, { label: "Net profit", value: Math.abs(top.profit), prefix: top.profit >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: `${top.n} companies`, tone: top.profit >= 0 ? "teal" : "red" }] });
L(`At the bottom: ${sayName(shortSector(low.name))}, profit ${updown(low.profit)} ${sayPct(low.profit)}, on sales ${updown(low.sales)} ${sayPct(low.sales)}.`,
  `Weakest: ~${shortSector(low.name)} ${pc(low.profit)}~ profit`,
  { type: "tiles", tiles: [{ label: "Sales", value: Math.abs(low.sales), prefix: low.sales >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: `${shortSector(low.name)}, ${label}`, tone: low.sales >= 0 ? "teal" : "red" }, { label: "Net profit", value: Math.abs(low.profit), prefix: low.profit >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: `${low.n} companies`, tone: low.profit >= 0 ? "teal" : "red" }] });
L("A sector's total can hide big differences between its companies. Check each one's own results.", "A sector total hides big differences. *Check each company.*",
  { type: "pills", items: [{ text: "✓ The sector" }, { text: "✓ The company" }, { text: "✓ Its own quarter" }] });
L("Save this, for the next results season.", "*Save this* for the next results season.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const date = list.pricesDate;
const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const key = `sectors-${label.toLowerCase().replace(" ", "-")}-${date}`;
const spec = { key, source: `${reporters} Nifty 500 companies' ${label} results as filed with NSE, to ${day(date)}; sector totals vs a year earlier · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const table = sectors.map((x, i) => `${i + 1}. ${shortSector(x.name)}: profit ${pc(x.profit)}, sales ${pc(x.sales)} (${x.n} companies)`).join("\n");
const ask = "Which sector should we look at company by company? Tell us in the comments.";
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\n${`${label} Results by Sector: ${shortSector(top.name)} Profit ${pc(top.profit)} | Sector Scorecard`.slice(0, 100)}\n\nYOUTUBE DESCRIPTION\n${label} (${qMonth} quarter) results by sector, for the ${reporters} Nifty 500 companies that have filed so far (sector totals against the same quarter a year earlier; sectors with 5+ companies; companies with a loss in either year left out):\n\n${table}\n\nA sector's total can hide big differences between its companies; check each company's own results.\n\n${ask}\n\nThe Jocular app on Android: https://play.google.com/store/apps/details?id=com.jocularinsights.app\n\nEvery company's results: https://jocularinsights.in/results\n\nFigures as filed with NSE, to ${day(date)}. Educational content, not investment advice.\n\n#Q2Results #SectorAnalysis #IndianStockMarket #Nifty500 #Shorts\n\n` +
  `INSTAGRAM CAPTION\n${label} results by sector (Nifty 500 companies filed so far, vs a year earlier):\n\n${table}\n\nA sector total hides big differences; check each company.\n\n${ask}\n\nFull results, free: jocularinsights.in\n\nFigures as filed with NSE. Educational content, not investment advice.\n\n#Q2Results #IndianStockMarket #StockMarketIndia #Investing\n`);
console.log(JSON.stringify({ label, reporters, sectors: sectors.map(x => `${shortSector(x.name)} ${pc(x.profit)} (${x.n})`), spec: join(DIR, "spec.json") }, null, 1));
