// More pages search engines can read (25 Oct 2026, the SEO re-audit: the new
// features only appeared after JavaScript or behind sign-in, so they brought
// no one new). Each is written into the page by the server and served as
// { title, body } to the app, which shows the same HTML to anyone who opens
// it (PublicHtmlPage.jsx) — so what Google reads and what people see agree.
//
//   /stock/TCS/financials          profit and loss, balance sheet, cash flow
//   /stock/TCS/results/q2-fy27     a quarter's results against a year ago
//   /stock/TCS/earnings-call       the next results date and saved call summaries
//   /explore                       indices, the day's biggest moves, results this week
//   /news                          the latest company announcements to NSE
//
// Facts from filings and NSE's prices only: no fair value, nothing about
// buying or selling. Publisher headlines aren't turned into pages (their words
// aren't ours to republish); announcements are the companies' own filings.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allMetrics } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { DATA_DIR } from "./paths.js";
import { niceName } from "../src/stockName.js";

const SITE = "https://jocularinsights.in";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const crs = v => (v == null || !isFinite(v) ? "—" : Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-IN") : num(v, 1));
const pct = v => (v == null || !isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
const day = iso => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const link = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;
// A quarter ending in September 2026 is Q2 of FY27
export const fyQuarter = iso => { const [y, m] = String(iso).split("-").map(Number); return y && m ? `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}` : null; };
export const quarterSlug = iso => fyQuarter(iso)?.toLowerCase().replace(" ", "-") ?? null;
const fy = iso => `FY${iso.slice(2, 4)}`;
const NOTE = "Figures from the company's filings with NSE, in ₹ crore unless marked. An educational tool, not investment advice.";

const rowOf = symbol => (allMetrics().rows ?? []).find(r => r.symbol === symbol && r.name) ?? null;
const opCosts = h => (h.expensesCr != null ? h.expensesCr - (h.depreciationCr ?? 0) - (h.financeCostsCr ?? 0) : null);
const sum = (...v) => { const k = v.filter(x => x != null); return k.length ? k.reduce((a, b) => a + b, 0) : null; };

// A table of lines (rows: [label, fn(column) → value, format]) over columns,
// leaving out a line no column has
function table(caption, heads, cols, rows) {
  const kept = rows.filter(([, f]) => cols.some(c => f(c) != null && isFinite(f(c))));
  if (!kept.length) return "";
  return `<div class="ps-table-wrap"><table><caption>${esc(caption)}</caption><thead><tr><th>Item</th>${heads.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${kept.map(([label, f, fmt = crs]) => `<tr><th>${esc(label)}</th>${cols.map(c => `<td>${esc(fmt(f(c)))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
const crumb = (m, last) => `<p>${link("/", "Jocular Insights")} › ${m.sector ? link(`/sector/${m.sector.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, m.sector) : link("/sectors", "Sectors")} › ${link(`/stock/${encodeURIComponent(m.symbol)}`, niceName(m.name))} › ${esc(last)}</p>`;
// Each company's other pages, linked from every one of them and the stock page
export function stockPageLinks(m) {
  const q = m.quarters?.[0];
  return [
    [`/stock/${encodeURIComponent(m.symbol)}/financials`, "Financial statements"],
    q?.fyEnd && [`/stock/${encodeURIComponent(m.symbol)}/results/${quarterSlug(q.fyEnd)}`, `${fyQuarter(q.fyEnd)} results`],
    [`/stock/${encodeURIComponent(m.symbol)}/earnings-call`, "Earnings calls"],
  ].filter(Boolean);
}
const more = m => `<p>More on ${esc(niceName(m.name))}: ${[[`/stock/${encodeURIComponent(m.symbol)}`, "Overview"], ...stockPageLinks(m)].map(([p, t]) => link(p, t)).join(" · ")}</p>`;

// ── /stock/TCS/financials ──────────────────────────────────────────────────
function financialsPage(m) {
  const n = niceName(m.name);
  const years = [...(m.history ?? [])].filter(h => h.fyEnd).slice(0, 8).reverse();
  if (!years.length) return null;
  const heads = years.map(h => fy(h.fyEnd));
  const pl = table(`${n}: profit and loss, year by year`, heads, years, [
    ["Sales", h => h.revenueCr],
    ["Raw materials & goods bought", h => sum(h.materialsCr, h.purchasesCr)],
    ["Change in stock", h => h.inventoryChangeCr],
    ["Employee costs", h => h.employeesCr],
    ["Other expenses", h => h.otherExpensesCr],
    ["Operating costs", opCosts],
    ["Operating profit", h => h.operatingProfitCr],
    ["Operating margin %", h => h.opm, v => (v == null ? "—" : `${num(v)}%`)],
    ["Other income", h => h.otherIncomeCr],
    ["Interest", h => h.financeCostsCr],
    ["Depreciation", h => h.depreciationCr],
    ["Profit before tax", h => h.pbtCr],
    ["Tax", h => h.taxCr],
    ["Net profit", h => h.profitCr],
    ["EPS (₹)", h => h.eps, v => (v == null ? "—" : num(v, 2))],
  ]);
  const bs = table(`${n}: balance sheet at each year-end`, heads, years, [
    ["Share capital", h => h.shareCapitalCr], ["Reserves", h => h.otherEquityCr], ["Net worth", h => h.equityCr],
    ["Long-term borrowings", h => h.ltDebtCr], ["Short-term borrowings", h => h.borrowingsCurrentCr], ["Total borrowings", h => h.debtCr],
    ["Lease liabilities", h => h.leasesCr], ["Owed to suppliers", h => h.payablesCr], ["Current liabilities", h => h.currentLiabilitiesCr],
    ["Factories & equipment", h => h.ppeCr], ["Work in progress (capex)", h => h.cwipCr], ["Goodwill & intangibles", h => sum(h.goodwillCr, h.intangiblesCr)],
    ["Long-term investments", h => h.investmentsNcCr], ["Inventory", h => h.inventoriesCr], ["Owed by customers", h => h.receivablesCr],
    ["Cash & liquid investments", h => h.liquidCr], ["Current assets", h => h.currentAssetsCr], ["Total assets", h => h.totalAssetsCr],
  ]);
  const cf = table(`${n}: cash flow, year by year`, heads, years, [
    ["Cash from operations", h => h.ocfCr], ["Cash from investing", h => h.investingCfCr], ["Cash from financing", h => h.financingCfCr],
    ["Net change in cash", h => h.netCashChangeCr], ["Capital spending", h => (h.capexCr == null ? null : -h.capexCr)], ["Free cash flow", h => h.fcfCr],
    ["Dividends paid", h => (h.dividendsPaidCr == null ? null : -Math.abs(h.dividendsPaidCr))],
  ]);
  const last = m.history[0];
  const lede = [
    `${n}'s results for the last ${years.length} financial years, from its filings with NSE${last?.scope ? ` (${last.scope.toLowerCase()})` : ""}.`,
    last?.revenueCr != null && `In ${fy(last.fyEnd)} its sales were ₹${crs(last.revenueCr)} crore${last.profitCr != null ? ` and its net profit ₹${crs(last.profitCr)} crore` : ""}${last.opm != null ? `, an operating margin of ${num(last.opm)}%` : ""}.`,
    m.salesGrowth5y != null && `Sales grew ${num(m.salesGrowth5y)}% a year over five years${m.profitGrowth5y != null ? `, profit ${num(m.profitGrowth5y)}% a year` : ""}.`,
  ].filter(Boolean).join(" ");
  return {
    title: `${n} balance sheet, profit & loss and cash flow | ${m.symbol} | Jocular Insights`,
    desc: `${n} (NSE: ${m.symbol}) financial statements: profit and loss, balance sheet and cash flow for ${heads[0]}–${heads[heads.length - 1]}, from its NSE filings.`,
    canonical: `${SITE}/stock/${encodeURIComponent(m.symbol)}/financials`,
    body: `<main class="seo-stock seo-methodology">${crumb(m, "Financials")}<h1>${esc(n)} financial statements</h1><p>${esc(lede)}</p>
<h2>Profit and loss</h2>${pl}<h2>Balance sheet</h2>${bs || "<p>Not in this company's filings.</p>"}<h2>Cash flow</h2>${cf || "<p>Not in this company's filings.</p>"}
<p>${esc(NOTE)}</p>${more(m)}</main>`,
  };
}

// ── /stock/TCS/results/q2-fy27 ───────────────────────────────────────────
function resultsPage(m, slug) {
  const n = niceName(m.name);
  const qs = m.quarters ?? [];
  const i = qs.findIndex(q => quarterSlug(q.fyEnd) === slug);
  if (i < 0) return null;
  const q = qs[i];
  const near = (days) => qs.find(x => Math.abs(Date.parse(x.fyEnd) - (Date.parse(q.fyEnd) - days * 86400000)) <= 20 * 86400000) ?? null;
  const yearAgo = near(365), prev = near(91);
  const label = fyQuarter(q.fyEnd);
  const change = (a, b) => (a != null && b > 0 ? (a / b - 1) * 100 : null);
  const cols = [q, yearAgo, prev].map(c => c ?? {});
  const lines = [
    ["Sales", h => h.revenueCr], ["Operating costs", opCosts], ["Operating profit", h => h.operatingProfitCr],
    ["Operating margin %", h => h.opm, v => (v == null ? "—" : `${num(v)}%`)], ["Other income", h => h.otherIncomeCr], ["Interest", h => h.financeCostsCr],
    ["Depreciation", h => h.depreciationCr], ["Profit before tax", h => h.pbtCr], ["Tax", h => h.taxCr], ["Net profit", h => h.profitCr],
    ["EPS (₹)", h => h.eps, v => (v == null ? "—" : num(v, 2))],
  ];
  const kept = lines.filter(([, f]) => cols.some(c => f(c) != null));
  const tableHtml = `<div class="ps-table-wrap"><table><caption>${esc(n)} ${esc(label)} results against a year earlier and the quarter before (₹ crore)</caption><thead><tr><th>Item</th><th>${esc(label)}</th>${yearAgo ? `<th>${esc(fyQuarter(yearAgo.fyEnd))}</th><th>Year on year</th>` : ""}${prev ? `<th>${esc(fyQuarter(prev.fyEnd))}</th><th>Quarter on quarter</th>` : ""}</tr></thead><tbody>${kept.map(([l, f, fmt = crs]) => {
    const isPct = l.endsWith("%");
    const diff = (a, b) => (isPct ? (a != null && b != null ? `${(a - b) >= 0 ? "+" : "−"}${Math.abs(a - b).toFixed(1)} pts` : "—") : pct(change(a, b)));
    return `<tr><th>${esc(l)}</th><td>${esc(fmt(f(q)))}</td>${yearAgo ? `<td>${esc(fmt(f(yearAgo)))}</td><td>${esc(diff(f(q), f(yearAgo)))}</td>` : ""}${prev ? `<td>${esc(fmt(f(prev)))}</td><td>${esc(diff(f(q), f(prev)))}</td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>`;
  const sy = change(q.revenueCr, yearAgo?.revenueCr), py = change(q.profitCr, yearAgo?.profitCr);
  const lede = [
    `${n} reported its ${label} results (the quarter to ${day(q.fyEnd)})${q.filed ? ` on ${day(q.filed)}` : ""}.`,
    q.revenueCr != null && `Sales were ₹${crs(q.revenueCr)} crore${sy != null ? `, ${sy >= 0 ? "up" : "down"} ${Math.abs(sy).toFixed(1)}% on a year earlier` : ""}.`,
    q.profitCr != null && `Net ${q.profitCr < 0 ? "loss" : "profit"} was ₹${crs(Math.abs(q.profitCr))} crore${py != null ? `, ${py >= 0 ? "up" : "down"} ${Math.abs(py).toFixed(1)}%` : ""}${q.opm != null ? `, and the operating margin ${num(q.opm)}%` : ""}.`,
  ].filter(Boolean).join(" ");
  const others = qs.slice(0, 8).filter(x => x !== q).map(x => link(`/stock/${encodeURIComponent(m.symbol)}/results/${quarterSlug(x.fyEnd)}`, `${fyQuarter(x.fyEnd)}`));
  return {
    title: `${n} ${label} results: sales, profit and margin | ${m.symbol} | Jocular Insights`,
    desc: lede.slice(0, 300),
    canonical: `${SITE}/stock/${encodeURIComponent(m.symbol)}/results/${slug}`,
    body: `<main class="seo-stock seo-methodology">${crumb(m, `${label} results`)}<h1>${esc(n)} ${esc(label)} results</h1><p>${esc(lede)}</p>${tableHtml}
${others.length ? `<p>Other quarters: ${others.join(" · ")}</p>` : ""}<p>${esc(NOTE)} Quarterly figures are as filed; a company can restate them later.</p>${more(m)}</main>`,
  };
}

// ── /stock/TCS/earnings-call ─────────────────────────────────────────────
// Only summaries already written (call-summary.js saves each one): a crawler
// never sets one off
export function savedCallSummaries(symbol) {
  try { return JSON.parse(readFileSync(join(DATA_DIR, "call-summaries", `${symbol.replace(/[^A-Z0-9&-]/g, "")}.json`), "utf-8")).calls ?? []; } catch { return []; }
}
function earningsCallPage(m) {
  const n = niceName(m.name);
  const calls = savedCallSummaries(m.symbol);
  const latest = calls[0];
  const lede = [
    m.nextResults ? `${n}'s board meets to approve its next results on ${day(m.nextResults)}; companies usually hold the earnings call the same day or the day after.` : `${n} hasn't told NSE its next results date yet.`,
    latest ? `The latest call transcript it filed (${day(latest.date)}) is summed up below, each point with its page in the transcript.` : `A summary of its latest earnings call appears here once someone has opened it in the app; the transcripts are on NSE.`,
  ].join(" ");
  const section = c => `<h2>Earnings call, ${esc(day(c.date) ?? "")}</h2><ul>${c.points.map(p => `<li>${esc(p.text)}${p.page ? ` <small>(page ${esc(p.page)})</small>` : ""}</li>`).join("")}</ul>${c.url ? `<p>${link(c.url, "The transcript on NSE")}</p>` : ""}`;
  return {
    title: `${n} earnings call${latest ? ` highlights, ${day(latest.date)}` : ""} and next results date | ${m.symbol} | Jocular Insights`,
    desc: lede.slice(0, 300),
    canonical: `${SITE}/stock/${encodeURIComponent(m.symbol)}/earnings-call`,
    // nothing written yet: a page search engines should skip
    noindex: !latest,
    body: `<main class="seo-stock seo-methodology">${crumb(m, "Earnings calls")}<h1>${esc(n)} earnings calls</h1><p>${esc(lede)}</p>${calls.slice(0, 4).map(section).join("")}
<p>Summaries are written by an AI model from the transcript the company filed, and checked against it; what management said isn't a forecast or advice. ${esc(NOTE)}</p>${more(m)}</main>`,
  };
}

// ── /explore ─────────────────────────────────────────────────────────────
async function explorePage() {
  const { exploreBoard, topMovers, resultsWeek } = await import("./explore.js");
  const board = await exploreBoard().catch(() => ({ market: [], sectors: [] }));
  const movers = topMovers("1d", 10);
  const week = resultsWeek(7);
  const idx = list => list.map(i => `<tr><th>${esc(i.name)}</th><td>${esc(num(i.close, 2) ?? "—")}</td><td>${esc(pct(i.changePct))}</td><td>${esc(i.pe != null ? num(i.pe) : "—")}</td></tr>`).join("");
  const mv = list => `<ol>${list.map(r => `<li>${link(`/stock/${encodeURIComponent(r.symbol)}`, niceName(r.name))} ${esc(pct(r.change))} <small>₹${esc(num(r.close, 2))}</small></li>`).join("")}</ol>`;
  const asOf = day(movers.asOf);
  return {
    title: "Indian stock market today: Nifty, sector indices and top movers | Jocular Insights",
    desc: `The NSE market at the ${asOf ?? "latest"} close: Nifty 50, Bank, Midcap and every sector index; the day's biggest gainers and losers; and the companies reporting results this week.`,
    canonical: `${SITE}/explore`,
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Explore</p><h1>The market at the ${esc(asOf ?? "latest")} close</h1>
<p>NSE's indices, the biggest moves among companies worth ₹${esc(movers.floorCr?.toLocaleString("en-IN") ?? "1,000")} crore or more, and this week's results.</p>
${board.market?.length ? `<h2>Market indices</h2><div class="ps-table-wrap"><table><thead><tr><th>Index</th><th>Close</th><th>Day</th><th>P/E</th></tr></thead><tbody>${idx(board.market)}</tbody></table></div>` : ""}
${board.sectors?.length ? `<h2>Sector indices</h2><div class="ps-table-wrap"><table><thead><tr><th>Index</th><th>Close</th><th>Day</th><th>P/E</th></tr></thead><tbody>${idx(board.sectors)}</tbody></table></div>` : ""}
${movers.gainers.length ? `<h2>Top gainers today</h2>${mv(movers.gainers)}` : ""}${movers.losers.length ? `<h2>Top losers today</h2>${mv(movers.losers)}` : ""}
<h2>Results this week</h2>${week.days?.length ? week.days.map(d => `<h3>${esc(day(d.date))} — ${d.count}</h3><p>${d.companies.slice(0, 15).map(c => link(`/stock/${encodeURIComponent(c.symbol)}`, niceName(c.name))).join(", ")}${d.count > 15 ? ` and ${d.count - 15} more` : ""}</p>`).join("") : "<p>None on NSE's calendar this week.</p>"}
<p>${link("/results-calendar", "Results calendar")} · ${link("/sectors", "Sectors")} · ${link("/screens", "Stock screens")} · ${link("/news", "Company announcements")}</p></main>`,
  };
}

// ── /news ────────────────────────────────────────────────────────────────
async function newsPage() {
  const { marketNews, KINDS } = await import("./market-news.js");
  const feed = await marketNews({ kind: "all" }).catch(() => ({ items: [] }));
  const filings = (feed.items ?? []).filter(i => i.type === "filing" && i.symbol).slice(0, 40);
  const byDay = new Map();
  for (const f of filings) { const d = String(f.time).slice(0, 10); (byDay.get(d) ?? byDay.set(d, []).get(d)).push(f); }
  return {
    title: "NSE company announcements today: results, dividends, orders | Jocular Insights",
    desc: "The latest announcements listed companies filed with NSE — results, dividends and splits, orders and deals, management changes — each linked to the company's figures.",
    canonical: `${SITE}/news`,
    // NSE didn't answer: nothing worth indexing this time
    noindex: !filings.length,
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Company announcements</p><h1>Company announcements to NSE</h1>
<p>What listed companies have told the exchange most recently, newest first, with each company's own figures a click away.</p>
${[...byDay].map(([d, list]) => `<h2>${esc(day(d))}</h2><ul>${list.map(f => `<li>${link(`/stock/${encodeURIComponent(f.symbol)}`, niceName(f.company ?? f.symbol))} — ${esc(KINDS[f.kind] ?? "Update")}: ${esc(f.title ?? "")}${f.summary ? ` <small>${esc(f.summary)}</small>` : ""}</li>`).join("")}</ul>`).join("") || "<p>No announcements could be read from NSE just now.</p>"}
<p>${link("/explore", "The market today")} · ${link("/results-calendar", "Results calendar")} · ${link("/sectors", "Sectors")}</p></main>`,
  };
}

// The page for a path, or null: { title, desc, canonical, body, noindex? }
export async function publicSubPage(path) {
  if (path === "/explore") return explorePage();
  if (path === "/news") return newsPage();
  const m = path.match(/^\/stock\/([^/]+)\/(financials|earnings-call|results\/(q[1-4]-fy\d\d))$/);
  if (!m) return null;
  const row = rowOf(decodeURIComponent(m[1]).toUpperCase());
  if (!row) return null;
  if (m[2] === "financials") return financialsPage(row);
  if (m[2] === "earnings-call") return earningsCallPage(row);
  return resultsPage(row, m[3]);
}
export const isSubPagePath = path => path === "/explore" || path === "/news" || /^\/stock\/[^/]+\/(financials|earnings-call|results\/q[1-4]-fy\d\d)$/.test(path);

// For the sitemap: each company's financials and its latest results; an
// earnings-call page only once a summary has been written
export function subPagePaths() {
  const rows = (allMetrics().rows ?? []).filter(r => r.name && r.history?.length);
  return [
    ["/explore", loadMarketSnapshot()?.pricesDate ?? null], ["/news", null],
    ...rows.map(r => [`/stock/${encodeURIComponent(r.symbol)}/financials`, r.history?.[0]?.filed ?? null]),
    ...rows.filter(r => r.quarters?.[0]?.fyEnd).map(r => [`/stock/${encodeURIComponent(r.symbol)}/results/${quarterSlug(r.quarters[0].fyEnd)}`, r.quarters[0].filed ?? null]),
    ...rows.filter(r => savedCallSummaries(r.symbol).length).map(r => [`/stock/${encodeURIComponent(r.symbol)}/earnings-call`, savedCallSummaries(r.symbol)[0]?.date ?? null]),
  ];
}
