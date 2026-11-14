// "Penny stocks whose profit grew" Short (14 Nov 2026, the owner: "more about
// that penny stocks which got good profits"): from the live Penny stocks list
// (shares under ₹10, worth ₹50 crore or more), each company's latest filed
// quarter from its public data, the ones with a profit in both quarters and the
// most growth. Profit growth on a tiny base is said in rupees, and the risk of
// such cheap shares is said plainly. Not a list to buy from.
//   node scripts/shorts-voice/from-penny.mjs      → ~/Projects/files/shorts-v2/penny-<date>/spec.json, post.txt
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { words, sayPct, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const list = await (await fetch(`${SITE}/api/public/lists/penny-stocks`, UA)).json();
const rows = [];
for (const c of list.companies) {
  try {
    const j = await (await fetch(`${SITE}/api/public/stock/${encodeURIComponent(c.symbol)}`, UA)).json();
    const s = j.stock ?? j, q = s.quarter;
    if (!q || !(q.profitCr > 0) || q.profitYoY == null || !(q.profitYoY > 0)) continue;
    const before = q.profitCr / (1 + q.profitYoY / 100);
    if (!(before > 0)) continue;
    rows.push({ symbol: c.symbol, name: c.name, price: s.close, label: q.label, profit: q.profitCr, before, yoy: q.profitYoY, salesYoY: q.salesYoY, quality: s.quality });
  } catch { /* a company without a public page: left out */ }
}
// the biggest growth that is also real money: ₹5 crore+ of profit this quarter and ₹1 crore+ a year
// earlier (from a few lakh, "growth" means little)
const picks = rows.filter(r => r.profit >= 5 && r.before >= 1).sort((a, b) => b.yoy - a.yoy).slice(0, 5);
if (picks.length < 3) throw new Error(`only ${picks.length} penny stocks with ₹5 crore+ profit and growth`);
const label = picks[0].label;
const cr = x => (x >= 100 ? Math.round(x).toLocaleString("en-IN") : x.toFixed(1));
const growth = r => (r.yoy >= 200 ? `₹${cr(r.before)} → ₹${cr(r.profit)} cr` : `+${Math.round(r.yoy)}%`);
const sayGrowth = r => (r.yoy >= 200 ? `from ${words(r.before)} crore to ${words(r.profit)} crore` : `up ${sayPct(r.yoy)}`);
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });
L(`Shares under ten rupees, whose profit grew this quarter.`, `*Penny stocks* whose profit grew in ${label}.`,
  { type: "big", text: `${rows.length} of ${list.companies.length}`, sub: `penny stocks grew their profit in ${label}` });
L(`The biggest: ${picks.slice(0, 3).map(r => `${sayName(r.name)}, ${sayGrowth(r)}`).join("; ")}.`, `Top: ${picks.slice(0, 3).map(r => `${r.name} *${growth(r)}*`).join(", ")}.`,
  { type: "rank", rows: picks.map(r => ({ label: r.name, sub: `₹${r.price?.toFixed(2)} a share · profit ₹${cr(r.profit)} cr`, value: Math.min(r.yoy, 500), text: growth(r), tone: "teal" })) });
const weak = picks.filter(r => r.quality != null && r.quality < 50).length;
L(`But careful. ${weak ? `${weak === picks.length ? "All of them" : `${words(weak).replace(/^./, c => c.toUpperCase())} of them`} score under fifty on quality, and ` : "S"}${weak ? "s" : ""}hares this cheap can swing hard, on little trading.`, `*Careful:* ${weak ? `~${weak} of ${picks.length}~ score under 50 on quality, and ` : ""}cheap shares can *swing hard*.`,
  { type: "pills", items: [{ text: "✓ Debt" }, { text: "✓ Cash flow" }, { text: "✓ Past quarters" }] });
L("One good quarter isn't a track record. Check the full results.", "One good quarter isn't a track record. *Check the full results.*", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const date = list.pricesDate;
const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const key = `penny-${date}`;
const spec = { key, source: `${label} results as filed with NSE · shares under ₹10 worth ₹50 crore+ at the ${day(date)} close · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const bullets = picks.map((r, i) => `${i + 1}. ${r.name} (₹${r.price?.toFixed(2)}): profit ₹${cr(r.before)} → ₹${cr(r.profit)} crore (${r.yoy >= 0 ? "+" : ""}${r.yoy.toFixed(1)}%)${r.quality != null ? `, quality ${Math.round(r.quality)}/100` : ""}`).join("\n");
const ask = "Which company's results should we explain next? Tell us in the comments.";
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\nPenny Stocks Under ₹10 With Profit Growth (${label}): ${picks[0].name} ${growth(picks[0])}`.slice(0, 115) + `\n\nYOUTUBE DESCRIPTION\n${rows.length} of ${list.companies.length} penny stocks (under ₹10, worth ₹50 crore+) grew their profit in ${label}. The biggest, with ₹5 crore+ of profit:\n${bullets}\n\nShares this cheap can swing hard on little trading, and one quarter isn't a track record: check debt, cash flow and earlier quarters. This is not a list of stocks to buy.\n\n${ask}\n\nThe full list: https://jocularinsights.in/lists/penny-stocks\n\nFigures as filed with NSE; prices at the ${day(date)} close. Educational content, not investment advice.\n\n#PennyStocks #IndianStockMarket #StockMarketIndia #Q2Results #Shorts\n\n` +
  `INSTAGRAM CAPTION\nPenny stocks (under ₹10) whose profit grew in ${label}:\n${bullets}\n\nCheap shares can swing hard, and one quarter isn't a track record. Not a list of stocks to buy.\n\n${ask}\n\nFull list, free: jocularinsights.in\n\nFigures as filed with NSE. Educational content, not investment advice.\n\n#PennyStocks #IndianStockMarket #StockMarketIndia #Investing\n`);
console.log(JSON.stringify({ grew: rows.length, of: list.companies.length, picks: picks.map(r => `${r.name} ${growth(r)}`), spec: join(DIR, "spec.json") }, null, 1));
