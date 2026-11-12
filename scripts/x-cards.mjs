// Pictures for the week's X posts (replica/launch/x-posts-week-1.md), 6 Nov 2026.
// Every figure is typed in from the live site at the 5 Nov close and the
// companies' filings; change them here for a new week. node scripts/x-cards.mjs
// (week 1), node scripts/x-cards.mjs week2 (12 Nov 2026: three results posts,
// figures from the live results pages)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "replica/launch/x-images");
const mark = `data:image/svg+xml;base64,${readFileSync(join(ROOT, "public/jocular-insights-mark.svg")).toString("base64")}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// rows: [label, valueText, barNow (0-1) | null, barThen (0-1) | null, note]
const card = ({ kicker, title, rows, legend, foot }) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;min-height:675px;overflow:hidden;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Inter,sans-serif;-webkit-font-smoothing:antialiased;color:#f4f5fb;
background:radial-gradient(800px 500px at 95% 0%,rgba(0,224,190,.18),transparent 62%),radial-gradient(700px 480px at 0% 105%,rgba(62,121,255,.14),transparent 60%),#07080f}
.wrap{position:relative;min-height:675px;padding:70px 76px 60px;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600;letter-spacing:-.02em}
.brand img{width:60px;height:60px;border-radius:15px}.brand span{color:#00e0be}
.kicker{margin-top:54px;font-size:22px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#00e0be}
h1{margin-top:12px;font-size:64px;line-height:1.05;font-weight:700;letter-spacing:-.04em}
.legend{margin-top:18px;font-size:22px;color:#a9afc4;display:flex;gap:26px;align-items:center}
.legend i{display:inline-block;width:18px;height:18px;border-radius:5px;margin-right:8px;vertical-align:-3px}
.rows{margin-top:34px;display:flex;flex-direction:column;gap:18px}
.row{display:grid;grid-template-columns:330px 1fr;gap:22px;align-items:center;padding:18px 24px;border-radius:20px;background:rgba(255,255,255,.045);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.07)}
.name{font-size:30px;font-weight:600;letter-spacing:-.01em}
.right{display:flex;flex-direction:column;gap:8px}
.val{font-size:30px;font-weight:600;font-variant-numeric:tabular-nums}
.val small{font-size:22px;color:#a9afc4;font-weight:500;margin-left:10px}
.bar{height:12px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}
.bar b{display:block;height:100%;border-radius:6px;background:#00e0be}
.bar.then b{background:rgba(169,175,196,.55)}
.foot{margin-top:auto;padding-top:48px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.src{font-size:20px;color:#7d84a0;max-width:700px;line-height:1.4}
.url{font-size:26px;font-weight:600;color:#00e0be}
</style></head><body><div class="wrap">
<div class="brand"><img src="${mark}" alt="">Jocular <span>Insights</span></div>
<div class="kicker">${esc(kicker)}</div><h1>${title}</h1>
${legend ? `<div class="legend">${legend}</div>` : ""}
<div class="rows">${rows.map(([n, v, now, then]) => `<div class="row"><div class="name">${esc(n)}</div><div class="right"><div class="val">${v}</div>${now != null ? `<div class="bar"><b style="width:${(now * 100).toFixed(1)}%"></b></div>` : ""}${then != null ? `<div class="bar then"><b style="width:${(then * 100).toFixed(1)}%"></b></div>` : ""}</div></div>`).join("")}</div>
<div class="foot"><div class="src">${esc(foot)}</div><div class="url">jocularinsights.in</div></div>
</div></body></html>`;

const L = (now, then, max) => [now / max, then / max];
const profit = [["Indian Oil", 22503, 8217], ["Reliance", 29550, 21010], ["ONGC", 18535, 11938], ["Bharti Airtel", 10710, 8184], ["Titan", 2393, 1119]];
const pmax = 29550;
const week1 = {
  "day1-q2-profit-jumps": { kicker: "Q2 FY27 results", title: "Big profit jumps<br>this results season", legend: `<span><i style="background:#00e0be"></i>Q2 FY27 net profit</span><span><i style="background:rgba(169,175,196,.55)"></i>A year earlier</span>`,
    rows: profit.map(([n, a, b]) => [n, `₹${a.toLocaleString("en-IN")} cr<small>from ₹${b.toLocaleString("en-IN")} cr</small>`, ...L(a, b, pmax)]),
    foot: "Net profit, July–September 2026 against July–September 2025, as filed with NSE. Not investment advice." },
  "day2-defence": { kicker: "Defence stocks", title: "Profit-making,<br>almost no debt", legend: `<span>Return on equity · P/E at the 5 Nov 2026 close</span>`,
    rows: [["HAL", "ROE 24.0%<small>P/E 36.2</small>", 24 / 32], ["BEL", "ROE 27.6%<small>P/E 45.2</small>", 27.6 / 32], ["Mazagon Dock", "ROE 29.2%<small>P/E 30.2</small>", 29.2 / 32], ["Garden Reach", "ROE 31.8%<small>P/E 30.6</small>", 31.8 / 32]].map(r => [r[0], r[1], r[2], null]),
    foot: "Companies in NSE's Nifty India Defence index; debt to equity 0.04 or less. The index's median P/E is 82.7. Not investment advice." },
  "day3-dividends": { kicker: "Dividend yield", title: "Large companies<br>paying 5%+", legend: `<span>Dividend yield at the 5 Nov 2026 close</span>`,
    rows: [["Coal India", 6.7], ["Vedanta", 6.1], ["ONGC", 5.8], ["Indian Oil", 5.7], ["PFC", 5.7], ["BPCL", 5.5], ["ITC", 5.2]].map(([n, y]) => [n, `${y.toFixed(1)}%`, y / 7, null]),
    foot: "Dividends paid over the last year against the share price. Past dividends are not a promise of future ones. Not investment advice." },
  "day4-results-week": { kicker: "Results calendar", title: "Results to watch<br>this week", legend: `<span>Board meetings to approve Q2 FY27 results, as told to NSE</span>`,
    rows: [["Tata Steel", "Sat 7 Nov"], ["Divi's Labs", "Sat 7 Nov"], ["Tata Power", "Wed 11 Nov"], ["HAL", "Thu 12 Nov"], ["Vodafone Idea", "Thu 12 Nov"], ["Grasim · ABB India", "Fri 13 Nov"]].map(([n, d]) => [n, d, null, null]),
    foot: "Dates companies have told NSE; they can change. 400+ companies report between 7 and 14 Nov." },
  "day5-debt-free": { kicker: "Debt-free stocks", title: "Almost no debt,<br>high returns", legend: `<span>Return on equity · 382 NSE companies worth ₹500 cr+ have debt under 5% of equity</span>`,
    rows: [["Castrol India", 45.5], ["IRCTC", 35.0], ["HUL", 30.6], ["Hero MotoCorp", 28.1], ["Polycab", 24.5]].map(([n, r]) => [n, `ROE ${r.toFixed(1)}%`, r / 48, null]),
    foot: "Return on equity from the companies' latest annual figures filed with NSE; prices at the 5 Nov 2026 close. Not investment advice." },
  "day6-sbi": { kicker: "SBI · Q2 FY27", title: "₹280 crore of profit,<br>every day", legend: `<span><i style="background:#00e0be"></i>Q2 FY27</span><span><i style="background:rgba(169,175,196,.55)"></i>A year earlier</span>`,
    rows: [["Net profit", "₹25,741 cr<small>from ₹21,454 cr, up 20%</small>", 25741 / 26500, 21454 / 26500], ["Per day", "≈ ₹280 cr<small>₹25,741 cr ÷ 92 days</small>", null, null]],
    foot: "State Bank of India's net profit for July–September 2026 against a year earlier, as filed with NSE. Not investment advice." },
  "day7-under-100": { kicker: "Stocks under ₹100", title: "A low price<br>isn't cheap", legend: `<span>Median return on equity · 5 Nov 2026 close</span>`,
    rows: [["Stocks under ₹100", "Median ROE 6.8%", 6.8 / 15, null], ["Debt-free stocks", "Median ROE 14.0%", 14 / 15, null]],
    foot: "523 NSE stocks worth ₹100 cr+ closed under ₹100; 382 worth ₹500 cr+ have debt under 5% of equity. Price per share says nothing about value. Not investment advice." },
};
const week2 = {
  "w2-banks": { kicker: "Q2 FY27 · Private banks", title: "HDFC Bank earns more.<br>ICICI grows faster.", legend: `<span><i style="background:#00e0be"></i>Q2 FY27 net profit</span><span><i style="background:rgba(169,175,196,.55)"></i>A year earlier</span>`,
    rows: [["HDFC Bank", "₹20,700 cr<small>from ₹19,611 cr, up 5.6%</small>", 20700 / 21500, 19611 / 21500], ["ICICI Bank", "₹17,312 cr<small>from ₹14,256 cr, up 21.4%</small>", 17312 / 21500, 14256 / 21500]],
    foot: "Net profit, July–September 2026 against July–September 2025, as filed with NSE. Not investment advice." },
  "w2-bel": { kicker: "Bharat Electronics · Q2 FY27", title: "Sales up 26.5%,<br>costs up 29.3%", legend: `<span><i style="background:#00e0be"></i>Q2 FY27</span><span><i style="background:rgba(169,175,196,.55)"></i>A year earlier</span>`,
    rows: [["Sales", "₹7,328 cr<small>from ₹5,792 cr</small>", 7328 / 7600, 5792 / 7600], ["Operating margin", "27.9%<small>from 29.4%</small>", 27.9 / 31, 29.4 / 31], ["Net profit", "₹1,540 cr<small>from ₹1,287 cr, up 19.7%</small>", 1540 / 1600, 1287 / 1600]],
    foot: "July–September 2026 against a year earlier, as filed with NSE. Costs grew faster than sales, so the margin narrowed. Not investment advice." },
  "w2-sterlite": { kicker: "Sterlite Technologies · Q2 FY27", title: "Margin from 12.5%<br>to 32.1%", legend: `<span><i style="background:#00e0be"></i>Q2 FY27</span><span><i style="background:rgba(169,175,196,.55)"></i>A year earlier</span>`,
    rows: [["Sales", "₹2,529 cr<small>from ₹1,034 cr, up 145%</small>", 2529 / 2600, 1034 / 2600], ["Operating margin", "32.1%<small>from 12.5%</small>", 32.1 / 34, 12.5 / 34], ["Net profit", "₹517 cr<small>from ₹4 cr</small>", 517 / 540, 4 / 540]],
    foot: "July–September 2026 against a year earlier, as filed with NSE. One quarter; a jump from a small base. Not investment advice." },
};
const cards = process.argv[2] === "week2" ? week2 : week1;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
for (const [name, c] of Object.entries(cards)) { await page.setContent(card(c), { waitUntil: "load" }); await page.setViewportSize({ width: 1200, height: 675 }); const h = await page.evaluate(() => document.querySelector('.wrap').scrollHeight); await page.setViewportSize({ width: 1200, height: h }); await page.waitForTimeout(150); await page.locator(".wrap").screenshot({ path: join(OUT, `${name}.png`) }); }
await browser.close(); console.log("ok");
