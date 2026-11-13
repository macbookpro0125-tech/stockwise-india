// The daily results Short in the voiced style (13 Nov 2026; "Indian" in the
// words and tags, NSE only as the source of the figures, 14 Nov): reads a company's live
// results page (the "full results" table, exactly what the link in the description
// shows) and its public data (quality score, 1-year return), picks the story the
// figures tell, and writes a spec for build.mjs plus the YouTube/Instagram text.
// Every figure comes from the live site; nothing is typed in.
//   node scripts/shorts-voice/from-results.mjs BEL [q2-fy27]
//   → ~/Projects/files/shorts-v2/<symbol>-<quarter>/spec.json and post.txt
// Then: node scripts/shorts-voice/build.mjs <that spec.json> --stills (check), and without --stills.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SITE = "https://jocularinsights.in";
const UA = { headers: { "User-Agent": "JocularShorts/1.0" } };
const [symbol, slugArg] = process.argv.slice(2);
if (!symbol) { console.error("usage: node scripts/shorts-voice/from-results.mjs SYMBOL [q2-fy27]"); process.exit(1); }

const api = await (await fetch(`${SITE}/api/public/stock/${encodeURIComponent(symbol)}`, UA)).json();
const st = api.stock ?? api;
const label = st.quarter?.label ?? "";
const slug = slugArg ?? label.toLowerCase().replace(" ", "-");
const url = `${SITE}/stock/${encodeURIComponent(symbol)}/results/${slug}`;
const res = await fetch(url, UA);
if (!res.ok) throw new Error(`${url}: ${res.status}`);
const html = await res.text();
const text = s => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
const table = html.slice(html.indexOf("rq-table"));
const rows = new Map([...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => text(c[1]))).filter(r => r.length >= 4).map(r => [r[0], r]));
const head = rows.get("Item");
const num = s => (s == null || s === "—" ? null : Number(s.replace(/[,%₹ ]/g, "").replace("−", "-").replace("pts", "")));
const get = item => { const r = rows.get(item); return r ? { now: num(r[1]), then: num(r[2]), nowTxt: r[1], thenTxt: r[2], chg: num(r[3]), chgTxt: r[3], prevTxt: r[4] ?? null, qoq: num(r[5] ?? null) } : null; };
const sales = get("Sales"), costs = get("Operating costs"), margin = get("Operating margin %"), profit = get("Net profit");
const opProfit = get("Operating profit"), otherIncome = get("Other income"), pbt = get("Profit before tax"), eps = get("EPS (₹)");
if (!head || !sales || !profit || head[2] == null) throw new Error(`${url}: no year-earlier quarter in the table`);
if (!(profit.now > 0) || !(profit.then > 0)) throw new Error(`${symbol}: a loss in one of the two quarters — not a two-figure story; pick another`);
// a profit that grew more than threefold came from a small base: said as
// "from ₹4.1 crore to ₹58.3 crore", never as "+1334%" (14 Nov 2026)
const smallBase = Math.abs(profit.chg) >= 200;
const hasMargin = margin && margin.now > 0 && margin.then > 0 && costs && costs.chg != null;

// numbers as Michael should say them
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const w99 = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""));
const w999 = n => (n >= 100 ? ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + w99(n % 100) : "") : w99(n));
const words = n => {
  n = Math.round(n); if (n === 0) return "zero";
  const parts = []; const lakh = Math.floor(n / 100000), th = Math.floor((n % 100000) / 1000), rest = n % 1000;
  if (lakh) parts.push(w999(lakh) + " lakh"); if (th) parts.push(w99(th) + " thousand"); if (rest) parts.push((parts.length && rest < 100 ? "and " : "") + w999(rest));
  return parts.join(" ");
};
const sayPct = x => { const a = Math.abs(x); return a >= 10 ? `${words(a)} percent` : `${words(Math.floor(a))} point ${ONES[Math.round((a % 1) * 10) % 10]} percent`; };
const sayCr = x => (x >= 10000 && Math.round(x / 100) * 100 !== Math.round(x) ? `about ${words(Math.round(x / 100) * 100)} crore` : `${words(x)} crore`);
const sayMargin = x => `${words(Math.floor(x))} point ${ONES[Math.round((x % 1) * 10) % 10]} percent`;
const rp = x => (Math.abs(x) < 10 ? Math.abs(x).toFixed(1) : String(Math.round(Math.abs(x))));
const pc = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}%`;
const upDown = x => (x >= 0 ? "up" : "down");
const tone = x => (x >= 0 ? "*" : "~");

const name = st.name.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
const month = new Date(st.quarter.end + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
const q = Math.round(st.quality);
const band = q >= 70 ? "teal" : q >= 50 ? "gold" : "red";
const ret = st.change1y;
const lines = [];
const L = (say, show, visual) => lines.push({ id: `l${String(lines.length + 1).padStart(2, "0")}`, say, show, visual });

// the story: which figure leads
let story;
if (hasMargin && margin.now - margin.then <= -1 && sales.chg > 0) story = "squeeze";
else if (hasMargin && margin.now - margin.then >= 3) story = "jump";
else if (profit.chg > 0 && sales.chg > 0 && profit.chg >= 2 * sales.chg) story = "leverage";
else if (profit.chg < 0) story = "fall";
else story = "steady";

if (story === "squeeze") L(`Sales ${upDown(sales.chg)} ${sayPct(sales.chg)}. So why did the margin shrink?`, `Sales up *${rp(sales.chg)}%*. So why did the ~margin shrink?~`, { type: "big", text: pc(sales.chg), sub: `Sales, ${label} vs a year earlier` });
else if (story === "jump") L(`Its operating margin jumped, from ${sayMargin(margin.then)}, to ${sayMargin(margin.now)}.`, `Its operating margin jumped from ${margin.thenTxt} to *${margin.nowTxt}*.`, { type: "big", text: `${margin.thenTxt} → ${margin.nowTxt}`, sub: `Operating margin, a year earlier → ${label}` });
else if (story === "leverage" && smallBase) L(`Profit went from ${sayCr(profit.then)}, to ${sayCr(profit.now)}, while sales grew ${sayPct(sales.chg)}.`, `Profit went from ₹${profit.thenTxt} crore to *₹${profit.nowTxt} crore*.`, { type: "big", text: `₹${profit.thenTxt} → ₹${profit.nowTxt} cr`, sub: `Net profit, a year earlier → ${label}` });
else if (story === "leverage") L(`Profit grew much faster than sales: up ${sayPct(profit.chg)}.`, `Profit grew much faster than sales: *up ${rp(profit.chg)}%*.`, { type: "big", text: pc(profit.chg), sub: `Net profit, ${label} vs a year earlier` });
else if (story === "fall") L(`Sales ${upDown(sales.chg)} ${sayPct(sales.chg)}. But profit fell ${sayPct(profit.chg)}.`, `Sales ${upDown(sales.chg)} ${tone(sales.chg)}${rp(sales.chg)}%${tone(sales.chg)}. But profit fell ~${rp(profit.chg)}%~.`, { type: "big", text: pc(profit.chg), sub: `Net profit, ${label} vs a year earlier`, tone: "red" });
else L(`Profit ${upDown(profit.chg)} ${sayPct(profit.chg)} in the ${month} quarter.`, `Profit ${upDown(profit.chg)} *${rp(profit.chg)}%* in the ${month} quarter.`, { type: "big", text: pc(profit.chg), sub: `Net profit, ${label} vs a year earlier` });

// search viewers come for the company: its name leads the first line (14 Nov 2026, the top results videos)
lines[0].say = `${name}. ${lines[0].say}`;
lines[0].show = `*${name}*: ${lines[0].show.charAt(0).toLowerCase()}${lines[0].show.slice(1)}`;
L(`Here are its ${month} quarter results, as filed.`, `Its *${month} quarter* results, as filed.`, { type: "page", symbol });
L(`Quality score: ${words(q)} out of a hundred.`, `Quality score: ${band === "red" ? "~" : "*"}${q} out of 100${band === "red" ? "~" : "*"}.`, { type: "card", symbol, card: "quality", tone: band === "red" ? "red" : "teal" });
L(`${month} quarter sales: ${sayCr(sales.now)}, ${upDown(sales.chg)} ${sayPct(sales.chg)}.`, `Sales: *₹${sales.nowTxt} crore*, ${upDown(sales.chg)} ${tone(sales.chg)}${Math.abs(sales.chg).toFixed(1)}%${tone(sales.chg)}.`, { type: "card", symbol, card: "results", circle: "sales" });
if (hasMargin) {
  // costs growing faster than sales is bad; when costs fall, falling more than sales is good (FACT, 14 Nov 2026)
  const faster = costs.chg > sales.chg;
  const vs = costs.chg >= 0 ? (faster ? "faster than sales" : "slower than sales") : (faster ? "less than sales" : "more than sales");
  const verb = costs.chg >= 0 ? "up" : "fell";
  L(`Operating costs ${verb === "up" ? "rose" : "fell"} ${sayPct(costs.chg)}, ${vs}.`, `Operating costs ${verb === "up" ? "up" : "fell"} ${faster ? "~" : "*"}${Math.abs(costs.chg).toFixed(1)}%${faster ? "~" : "*"}, ${vs}.`,
    { type: "bars", bars: [{ label: "Operating costs", value: Math.abs(costs.chg), prefix: costs.chg >= 0 ? "+" : "−", suffix: "%", dec: 1, tone: faster ? "red" : "teal" }, { label: "Sales", value: Math.abs(sales.chg), prefix: sales.chg >= 0 ? "+" : "−", suffix: "%", dec: 1, tone: "grey" }] });
  if (story !== "jump") { const better = margin.now >= margin.then; L(`So the operating margin went from ${sayMargin(margin.then)}, to ${sayMargin(margin.now)}.`, `So the operating margin went from ${margin.thenTxt} to ${better ? "*" : "~"}${margin.nowTxt}${better ? "*" : "~"}.`, { type: "big", text: `${margin.thenTxt} → ${margin.nowTxt}`, sub: `Operating margin, a year earlier → ${label}`, tone: better ? "teal" : "red" }); }
}
if (smallBase) L(`Net profit: ${sayCr(profit.now)}, against ${sayCr(profit.then)} a year earlier. A small base, so check what changed.`, `Net profit: *₹${profit.nowTxt} crore*, from ₹${profit.thenTxt} crore a year earlier.`, { type: "card", symbol, card: "results", circle: "profit" });
else L(`Net profit: ${sayCr(profit.now)}, ${upDown(profit.chg)} ${sayPct(profit.chg)}.`, `Net profit: *₹${profit.nowTxt} crore*, ${upDown(profit.chg)} ${tone(profit.chg)}${Math.abs(profit.chg).toFixed(1)}%${tone(profit.chg)}.`, { type: "card", symbol, card: "results", circle: "profit" });
// and against the quarter before, as the top results videos show both
if (profit.qoq != null && isFinite(profit.qoq) && profit.prevTxt && num(profit.prevTxt) > 0 && !smallBase) {
  const pq = new Date(st.quarter.end + "T00:00:00Z"); pq.setUTCDate(1); pq.setUTCMonth(pq.getUTCMonth() - 3);
  const prevMonth = pq.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  L(`Against the ${prevMonth} quarter, profit was ${upDown(profit.qoq)} ${sayPct(profit.qoq)}.`, `Against the ${prevMonth} quarter: profit ${upDown(profit.qoq)} ${tone(profit.qoq)}${Math.abs(profit.qoq).toFixed(1)}%${tone(profit.qoq)}.`,
    { type: "tiles", tiles: [{ label: `vs ${month.slice(0, 3)} last year`, value: Math.abs(profit.chg), prefix: profit.chg >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: "net profit", tone: profit.chg >= 0 ? "teal" : "red" }, { label: `vs ${prevMonth.slice(0, 3)} quarter`, value: Math.abs(profit.qoq), prefix: profit.qoq >= 0 ? "+" : "−", suffix: "%", dec: 1, sub: "net profit", tone: profit.qoq >= 0 ? "teal" : "red" }] });
}
if (ret != null) L(`The share price: ${upDown(ret)} ${sayPct(ret)} in a year.`, `The share price: ${upDown(ret)} ${tone(ret)}${Math.abs(ret).toFixed(1)}%${tone(ret)} in a year.`, { type: "card", symbol, card: "ret", tone: ret >= 0 ? "teal" : "red" });
const close = { squeeze: ["Growth is good. Watch what it costs.", "Growth is good. *Watch what it costs.*"], jump: ["One strong quarter is a start. Check that it lasts.", "One strong quarter is a start. *Check that it lasts.*"], leverage: ["When profit outruns sales, check why.", "When profit outruns sales, *check why*."], fall: hasMargin && margin.now >= margin.then - 0.5 ? ["The margin held, so look further down: interest, depreciation, tax and one-offs.", "The margin held, so look *further down*: interest, depreciation, tax, one-offs."] : ["Check the costs, before the headline.", "Check the *costs*, before the headline."], steady: ["Check the whole quarter, not just the headline.", "Check the *whole quarter*, not just the headline."] }[story];
// Where the profit came from (14 Nov 2026, the competitor check: viewers ask
// it): other income — interest, dividends, gains — as a share of profit before tax
const otherShare = otherIncome?.now > 0 && pbt?.now > 0 ? (otherIncome.now / pbt.now) * 100 : null;
if (otherShare != null && otherShare >= 30) L(`Note: other income, money not from the main business, was ${words(Math.round(otherShare))} percent of its profit before tax.`, `Other income was ~${Math.round(otherShare)}%~ of profit before tax: money *not from the main business*.`, { type: "big", text: `${Math.round(otherShare)}%`, sub: "of profit before tax came from other income", tone: "gold" });
// The verdict viewers ask for ("results are good or bad?"), said as a count of
// filed measures against a year earlier — a fact, not advice
const measures = [["Sales", sales], ["Operating profit", opProfit], ["Margin", margin], ["Net profit", profit], ["EPS", eps]]
  .filter(([, m]) => m && m.chg != null && isFinite(m.chg) && (m.now != null) && !(m === opProfit && !(opProfit.now > 0 && opProfit.then > 0)));
const better = measures.filter(([, m]) => m.chg > 0);
if (measures.length >= 3) {
  const names = better.map(([n]) => (n === "EPS" ? "earnings per share" : n.toLowerCase()));
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
  L(`Against a year earlier, it's better on ${words(better.length)} of ${words(measures.length)} measures${better.length ? `: ${list}` : ""}.`, `Better than a year ago on *${better.length} of ${measures.length}* measures.`,
    { type: "pills", items: measures.map(([n, m]) => ({ text: `${m.chg > 0 ? "✓" : "✗"} ${n}`, tone: m.chg > 0 ? "" : "red" })) });
}
// the verdict already sums it up; the general closing line only when there is no verdict
if (measures.length < 3) L(close[0], close[1], { type: "pills", items: [{ text: "✓ Sales" }, { text: "✓ Costs" }, { text: "✓ Profit" }] });
L("Save this, for the next results season.", "*Save this* for the next results season.", { type: "save" });
L("Jocular Insights. Every number tells a story.", "*Jocular Insights*. Every number tells a story.", { type: "brand" });

const day = s => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const key = `${symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${slug}`;
const spec = { key, source: `${name} · ${label} as filed with NSE · prices and scores at the ${day(st.closeDate)} close · not investment advice`, lines };
const DIR = join(homedir(), "Projects/files/shorts-v2", key);
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, "spec.json"), JSON.stringify(spec, null, 1));

// the post text: every figure as on the live page
const hook = lines[0].show.replace(/[*~]/g, "");
// What people type (the competitor check, 14 Nov 2026: "TCS Q2 Results 2027 | TCS Results Today" drew 80K views)
const qLabel = label.replace(/^(Q\d) (FY\d\d)$/, "$1 Results $2");
const profitBit = smallBase ? `Profit ₹${profit.thenTxt} → ₹${profit.nowTxt} Cr` : `Profit ${profit.chg >= 0 ? "+" : "−"}${rp(profit.chg)}%`;
const title = [`${name} ${qLabel}: ${profitBit}, Sales ${sales.chg >= 0 ? "+" : "−"}${rp(sales.chg)}% | ${name} Share News`, `${name} ${qLabel}: ${profitBit}, Sales ${sales.chg >= 0 ? "+" : "−"}${rp(sales.chg)}%`, `${name} ${qLabel}: ${profitBit}`].find(t => t.length <= 100) ?? `${name} ${qLabel}`.slice(0, 100);
const bullets = [
  `• Sales ₹${sales.nowTxt} crore, ${sales.chgTxt} (₹${sales.thenTxt} crore a year earlier)`,
  hasMargin ? `• Operating costs ${costs.chgTxt}` : null,
  hasMargin ? `• Operating margin ${margin.nowTxt} (${margin.thenTxt} a year earlier)` : null,
  `• Net profit ₹${profit.nowTxt} crore, ${profit.chgTxt} (₹${profit.thenTxt} crore)`,
  `• Quality score ${q}/100 on Jocular Insights`,
  ret != null ? `• Share price ${ret >= 0 ? "+" : "−"}${Math.abs(ret).toFixed(1)}% in a year (to ${day(st.closeDate)})` : null,
].filter(Boolean).join("\n");
const tag = "#" + name.replace(/[^A-Za-z0-9]/g, "");
const ask = "Which company's results should we explain next? Tell us in the comments.";
const body = `${hook}\n\n${name}'s ${label} (quarter to ${day(st.quarter.end)}, filed with NSE on ${day(st.quarter.filed)}):\n${bullets}\n\n${close[0]}`;
writeFileSync(join(DIR, "post.txt"),
  `YOUTUBE TITLE\n${title}\n\nYOUTUBE DESCRIPTION\n${body}\n\n${ask}\n\nThe full quarter, line by line: ${url}\n\nFigures as filed with NSE; prices and scores at the ${day(st.closeDate)} close. Educational content, not investment advice.\n\n${tag} #${symbol} #${label.replace(" ", "")}Results #IndianStockMarket #StockMarketIndia #Shorts\n\n` +
  `INSTAGRAM CAPTION\n${name}, ${label}: ${hook}\n\n${bullets}\n\n${close[0]}\n\n${ask}\n\nFull results, free: jocularinsights.in\n\nEducational content, not investment advice.\n\n${tag} #${symbol} #IndianStockMarket #StockMarketIndia #Q${label[1]}Results #Investing\n`);
console.log(JSON.stringify({ story, lines: lines.length, spec: join(DIR, "spec.json"), post: join(DIR, "post.txt") }, null, 2));
