// The News page's sorting and filtering (market-news.js): node --no-warnings server/market-news-test.js
import assert from "node:assert/strict";
import { newsKind, announcementsFrom, headlinesFrom, companyIndex, namedCompanies, tidy } from "./market-news.js";

// Announcements: the kinds, and paperwork left out
const kinds = [
  ["Outcome of Board Meeting", "The unaudited financial results for the quarter and half year ended 30 September 2026", "results"],
  ["Press Release", "A press release titled \"IHCL announces financial results for Q2 FY2027\"", "results"],
  ["Dividend", "Board of Directors declared Interim Dividend of Rs. 24 per equity share.", "dividends"],
  ["Record Date", "Record date for the purpose of Dividend is 02-Nov-2026.", "dividends"],
  ["Bagging/Receiving of orders/contracts", "Receipt of an order worth Rs 120 crore", "deals"],
  ["Acquisition", "Acquisition of 100% equity shares of a solar company", "deals"],
  ["Resignation of Director/KMP/SMP", "Resignation of the Chief Financial Officer", "people"],
  ["Credit Rating- Revision", "", "legal"],
  ["Initiation of Forensic Audit", "", "legal"],
  ["Press Release", "A press release titled \"Expansion into Nashik district\"", "updates"],
  ["Analysts/Institutional Investor Meet/Con. Call Updates", "Schedule of analyst meet", null],
  ["Copy of Newspaper Publication", "Copy of newspaper publication of results", null],
  ["Trading Window", "Trading window closure", null],
  ["Allotment of Securities", "Allotment of equity shares under the Employee Stock Option Plan 2023", null],
  ["Allotment of Securities", "Allotment of shares on a preferential basis to the promoters", "deals"],
  ["Disclosure under SEBI Takeover Regulations", "Disclosure under Regulation 10(6) in respect of an acquisition", null],
  ["Record Date", "Record date for the AGM", null],
  ["General Updates", "Investors' Presentation on Unaudited Financial Results for the quarter ended September 30, 2026", null],
];
for (const [subject, summary, want] of kinds) assert.equal(newsKind(subject, summary), want, `${subject}: ${summary}`);

assert.equal(tidy("'Outcome of Board Meeting held on October 22, 2026.'."), "Outcome of Board Meeting held on October 22, 2026.", "NSE's quotes taken off");
assert.equal(tidy('A press release dated October 21, 2026, titled "IHCL announces financial results for Q2 FY2027".'), "IHCL announces financial results for Q2 FY2027", "a press release: its own title");

const row = (seq, symbol, desc, text, time = "2026-10-22 15:30:00") => ({ seq_id: String(seq), symbol, sm_name: `${symbol} Limited`, desc, attchmntText: text, sort_date: time, attchmntFile: `https://nsearchives.nseindia.com/corporate/${symbol}_${seq}.pdf`, fileSize: "200 KB" });
const items = announcementsFrom([
  row(1, "AAA", "Dividend", "AAA Limited has informed the Exchange about Interim Dividend of Rs. 5 per share.", "2026-10-22 10:00:00"),
  row(2, "AAA", "Dividend", "AAA Limited has informed the Exchange about Interim Dividend of Rs. 5 per share.", "2026-10-22 10:05:00"),
  row(3, "BBB", "Acquisition", "Acquisition", "2026-10-22 11:00:00"),
  row(4, "CCC", "General Updates", "CCC Limited has informed the Exchange about General Updates", "2026-10-22 12:00:00"),
  row(5, "DDD", "Trading Window", "Trading window closure", "2026-10-22 13:00:00"),
  { ...row(6, "EEE", "Credit Rating", "Credit Rating"), attchmntFile: "https://elsewhere.example/x.pdf" },
]);
assert.deepEqual(items.map(i => i.id), ["nse-6", "nse-3", "nse-1"], "newest first; a notice filed twice once, its first filing; empty general updates and paperwork out");
assert.equal(items[2].summary, "Interim Dividend of Rs. 5 per share.", "in the company's words, without 'has informed the Exchange'");
assert.equal(items[1].summary, null, "a summary that only repeats the subject is none");
assert.equal(items[0].time, "2026-10-22T10:00:00.000Z", "NSE's times are India time");
assert.equal(items[0].url, null, "only NSE's own archive is linked");

// Headlines: no tips or quote pages, one of each story, six wraps at most
const rss = list => list.map(([title, source, pub, link]) => `<item><title>${title} - ${source}</title><link>${link}</link><pubDate>${pub}</pubDate><source url="x">${source}</source></item>`).join("");
const now = Date.parse("2026-10-22T18:00:00Z");
const at = h => new Date(now - h * 3600_000).toUTCString();
const heads = headlinesFrom([rss([
  ["Sensex falls 460 points as crude surges past $110", "Paper A", at(1), "https://a.example/1"],
  ["Sensex falls 460 points, Nifty below 22,700 as crude surges", "Paper B", at(2), "https://b.example/1"],
  ["Top 10 stocks to buy in October", "Blog", at(1), "https://c.example/1"],
  ["Infosys Share Price Today, Live Chart & News", "Quotes", at(1), "https://d.example/1"],
  ["Trade setup for Oct 23: Nifty support at 22,600", "Paper C", at(1), "https://e.example/1"],
  ["Phone maker's first-week stock sold out ahead of launch", "Gadgets", at(1), "https://f.example/1"],
  ["Old story about results", "Paper D", at(80), "https://g.example/1"],
  ["Coal India Q2 results date announced", "Paper E", at(3), "https://h.example/1"],
  ["Prediction site Polymarket's account withheld", "Paper F", at(2), "https://i.example/1"],
])], now);
assert.deepEqual(heads.map(h => h.title), ["Sensex falls 460 points as crude surges past $110", "Phone maker's first-week stock sold out ahead of launch", "Coal India Q2 results date announced"], "tips, quote pages, trade setups, a repeat and an old story left out");
assert.equal(heads[0].publisher, "Paper A");
assert.ok(heads.every(h => /^h-[a-z0-9]+$/.test(h.id)));
const wraps = headlinesFrom([rss(Array.from({ length: 9 }, (_, n) => [`Sensex ${["rises", "slips", "jumps", "dips", "gains", "drops", "climbs", "sinks", "edges"][n]} in ${["early", "noon", "late", "morning", "midday", "closing", "opening", "afternoon", "evening"][n]} deals on ${["banks", "metals", "autos", "pharma", "IT", "FMCG", "realty", "power", "media"][n]}`, `P${n}`, at(n + 1), `https://p${n}.example/`]))], now);
assert.equal(wraps.length, 6, "the day's close: the six latest stories");

// Which companies a headline names: whole names, symbols in capitals, a few short names
const index = companyIndex([
  { symbol: "MEDANTA", name: "Global Health Limited", marketCapCr: 30000 },
  { symbol: "TECHM", name: "Tech Mahindra Limited", marketCapCr: 140000 },
  { symbol: "TCS", name: "Tata Consultancy Services Limited", marketCapCr: 1100000 },
  { symbol: "SBIN", name: "State Bank of India", marketCapCr: 700000 },
  { symbol: "ETERNAL", name: "Eternal Limited", marketCapCr: 250000 },
  { symbol: "BSE", name: "BSE Limited", marketCapCr: 90000 },
  { symbol: "COALINDIA", name: "Coal India Limited", marketCapCr: 230000 },
  { symbol: "TINYCO", name: "Tiny Company Limited", marketCapCr: 300 },
]);
const names = t => namedCompanies(t, index);
assert.deepEqual(names("Insurer expects India to take more of its global portfolio"), [], "a first word alone is not a company");
assert.deepEqual(names("Tech stocks the lone bright spot"), []);
assert.deepEqual(names("TCS and Tech Mahindra lead IT gains"), ["TCS", "TECHM"], "symbol in capitals, whole name; largest first");
assert.deepEqual(names("Buying in SBI lifts banks"), ["SBIN"], "a short name everyone uses");
assert.deepEqual(names("Eternal top gainer on the Nifty"), ["ETERNAL"]);
assert.deepEqual(names("An eternal question for investors"), [], "a one-word name as written");
assert.deepEqual(names("BSE Sensex falls 400 points"), [], "the Sensex isn't BSE the company");
assert.deepEqual(names("Listed on NSE and BSE from Monday"), [], "nor is the exchange — BSE is never tagged");
assert.deepEqual(names("Coal India Q2 results"), ["COALINDIA"]);
assert.deepEqual(names("Tiny Company wins an order"), [], "small companies aren't tagged");

console.log("ok: announcements sorted into kinds, paperwork out; headlines without tips or repeats; companies named only when named");
