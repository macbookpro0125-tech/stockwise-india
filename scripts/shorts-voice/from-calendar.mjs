// "Results next week" Short (14 Nov 2026, the owner: "next week results"): from
// the live results calendar, the biggest companies whose boards meet to approve
// results in the next seven days, with each one's last quarter (profit change,
// as filed) and quality score from its public data. For Sundays.
//   node scripts/shorts-voice/from-calendar.mjs   → ~/Projects/files/shorts-v2/calendar-<date>/spec.json, post.txt
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { words, sayName } from "./say.mjs";

const SITE = process.env.JI_SITE ?? "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const cal = await (await fetch(`${SITE}/api/public/results-calendar`, UA)).json();
const today = cal.today ?? new Date().toISOString().slice(0, 10);
const until = new Date(Date.parse(today + "T00:00:00Z") + 7 * 86400000).toISOString().slice(0, 10);
const all = cal.days.filter(d => d.date > today && d.date <= until).flatMap(d => d.companies.map(c => ({ ...c, date: d.date })));
if (all.length < 3) throw new Error(`only ${all.length} companies report in the next seven days — skip this week`);
const top = [...all].sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).slice(0, 6);
for (const c of top) {
  try { const j = await (await fetch(`${SITE}/api/public/stock/${encodeURIComponent(c.symbol)}`, UA)).json(); const s = j.stock ?? j; c.lastYoY = s.quarter?.profitCr > 0 ? s.quarter.profitYoY : null; c.lastLabel = s.quarter?.label ?? null; c.quality = s.quality ?? null; } catch { /* left without */ }
}
const wd = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const wdSay = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });
L(`Results next week: ${words(all.length)} companies have told the exchange when their boards meet.`, `*Results next week:* ${all.length} companies.`,
  { type: "big", text: String(all.length), sub: `companies report results in the next 7 days, to ${wd(until)}` });
L(`The biggest: ${top.slice(0, 3).map(c => `${sayName(c.name)} on ${wdSay(c.date)}`).join("; ")}.`, `The biggest: ${top.slice(0, 3).map(c => `*${c.name}* (${wd(c.date)})`).join(", ")}.`,
  { type: "rank", rows: top.map(c => ({ label: c.name, sub: `${wd(c.date)}${c.sector ? ` · ${c.sector}` : ""}`, value: c.marketCapCr ?? 1, text: wd(c.date).split(" ")[0], tone: "teal" })) });
// (the latest filed quarter is left out: for some companies it is the quarter they're about to
// report, so calling it "last quarter" could mislead — 14 Nov 2026)
const withLast = [];
if (withLast.length) L(`Last quarter, ${withLast.map(c => `${sayName(c.name)}'s profit was ${c.lastYoY >= 0 ? "up" : "down"} ${words(Math.abs(c.lastYoY))} percent`).join(", and ")}.`, `Last quarter: ${withLast.map(c => `${c.name} ${c.lastYoY >= 0 ? "*" : "~"}${pc(c.lastYoY)}${c.lastYoY >= 0 ? "*" : "~"}`).join(", ")}.`,
  { type: "tiles", tiles: withLast.map(c => ({ label: c.name.length > 16 ? c.name.split(" ")[0] : c.name, value: Math.abs(c.lastYoY), prefix: c.lastYoY >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: `profit, ${c.lastLabel ?? "last quarter"}`, tone: c.lastYoY >= 0 ? "teal" : "red" })) });
L("Save this, and we'll explain each one as it comes out.", "*Save this.* We'll explain each one as it comes out.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const key = `calendar-${today}`;
const spec = { key, source: `Board-meeting dates as told to NSE, at ${day(today)} · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));
const bullets = top.map(c => `• ${wd(c.date)}: ${c.name}${c.sector ? ` (${c.sector})` : ""}`).join("\n");
const ask = "Which company's results should we explain next? Tell us in the comments.";
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\nResults Next Week (${day(today)}–${day(until)}): ${top.slice(0, 2).map(c => c.name).join(", ")} & More`.slice(0, 115) + `\n\nYOUTUBE DESCRIPTION\n${all.length} companies have told NSE their boards meet to approve results in the next seven days. The biggest:\n${bullets}\n\n${ask}\n\nThe full calendar: https://jocularinsights.in/results-calendar\n\nDates as told to NSE. Educational content, not investment advice.\n\n#ResultsCalendar #QuarterlyResults #IndianStockMarket #NSE #Shorts\n\n` +
  `INSTAGRAM CAPTION\nResults next week: ${all.length} companies.\n${bullets}\n\nSave this; we'll explain each one as it comes out.\n\n${ask}\n\nFull calendar, free: jocularinsights.in\n\nDates as told to NSE. Educational content, not investment advice.\n\n#ResultsCalendar #IndianStockMarket #StockMarketIndia #Investing\n`);
console.log(JSON.stringify({ companies: all.length, top: top.map(c => `${c.name} ${c.date}`), spec: join(DIR, "spec.json") }, null, 1));
