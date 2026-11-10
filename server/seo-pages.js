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
//   /learn, /learn/<slug>          our guides to reading the figures (guides.js)
//
// Facts from filings and NSE's prices only: no fair value, nothing about
// buying or selling. Publisher headlines aren't turned into pages (their words
// aren't ours to republish); announcements are the companies' own filings.
import { pageTitle } from "../src/pageTitle.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allMetrics } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { DATA_DIR } from "./paths.js";
import { niceName } from "../src/stockName.js";
import { GUIDES, GUIDES_UPDATED, GUIDE_PUBLISHED, guideBySlug } from "./guides.js";
import { updatedLine } from "./updated-line.js";

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
    title: pageTitle(`${n} balance sheet, profit & loss, cash flow | ${m.symbol}`),
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
  const sym = encodeURIComponent(m.symbol);
  // 8 Nov 2026 ("this is a 2/10 page, I want a total update"): the quarter's
  // four figures as cards with eight quarters of bars, what changed in plain
  // words, the quarters as charts, then the full table
  const tone = v => (v == null || !isFinite(v) ? "" : v > 0.05 ? " up" : v < -0.05 ? " down" : "");
  const chip = (v, unit = "%") => (v == null || !isFinite(v) ? "" : `<span class="rq-chip${tone(v)}">${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(v).toFixed(1)}${unit}</span>`);
  const span = qs.slice(i, i + 8).reverse(); // oldest first, ending at this quarter
  const bars = (f, big = false) => {
    const v = span.map(f);
    const max = Math.max(...v.filter(x => x != null).map(Math.abs), 0);
    if (!max) return "";
    return `<div class="rq-bars${big ? " big" : ""}" aria-hidden="true">${span.map((x, k) => {
      const val = v[k];
      const h = val == null ? 0 : Math.max(3, Math.round((Math.abs(val) / max) * 100));
      return `<span class="rq-bar-col${x === q ? " now" : ""}">${big ? `<span class="rq-bar-v">${val == null ? "—" : esc(crs(val))}</span>` : ""}<span class="rq-bar${val != null && val < 0 ? " neg" : ""}" style="height:${h}%"></span>${big ? `<span class="rq-bar-l">${esc(fyQuarter(x.fyEnd))}</span>` : ""}</span>`;
    }).join("")}</div>`;
  };
  const card = (title, f, fmt) => {
    const v = f(q);
    if (v == null) return "";
    const yy = change(v, f(yearAgo ?? {})), qq = change(v, f(prev ?? {}));
    return `<div class="rq-card"><span class="rq-card-l">${esc(title)}</span><b class="rq-card-v">${esc(fmt(v))}</b><span class="rq-card-chg">${yy != null ? `${chip(yy)} <small>on a year earlier</small>` : "<small>no year-earlier quarter on file</small>"}</span>${qq != null ? `<span class="rq-card-sub">${esc(pct(qq))} on the quarter before</span>` : ""}${bars(f)}</div>`;
  };
  const cards = [
    card("Sales", h => h.revenueCr, v => `₹${crs(v)} cr`),
    card("Operating profit", h => h.operatingProfitCr, v => `₹${crs(v)} cr`),
    card(q.profitCr != null && q.profitCr < 0 ? "Net loss" : "Net profit", h => h.profitCr, v => `₹${crs(v)} cr`),
    card("EPS", h => h.eps, v => `₹${num(v, 2)}`),
  ].join("");
  // what changed, in plain words, from the figures alone
  const said = [];
  const cy = change(opCosts(q), opCosts(yearAgo ?? {}));
  if (sy != null) said.push(`Sales ${sy >= 0 ? "grew" : "fell"} <b>${Math.abs(sy).toFixed(1)}%</b> on a year earlier${cy != null ? `, and operating costs ${cy >= 0 ? "rose" : "fell"} ${Math.abs(cy).toFixed(1)}%` : ""}.`);
  if (q.opm != null && yearAgo?.opm != null) {
    const d = q.opm - yearAgo.opm;
    said.push(Math.abs(d) < 0.3 ? `The operating margin held at <b>${num(q.opm)}%</b>.` : `So the operating margin ${d > 0 ? "widened" : "narrowed"} to <b>${num(q.opm)}%</b> from ${num(yearAgo.opm)}%, ${Math.abs(d).toFixed(1)} points ${d > 0 ? "better" : "lower"}${cy != null && sy != null ? ` (costs ${cy > sy ? "grew faster than" : "grew slower than"} sales)` : ""}.`);
  }
  for (const [what, f] of [["Other income", h => h.otherIncomeCr], ["Interest", h => h.financeCostsCr], ["Depreciation", h => h.depreciationCr]]) {
    const c = change(f(q), f(yearAgo ?? {}));
    if (c != null && Math.abs(c) >= 15 && f(q) >= Math.abs(q.revenueCr ?? 0) * 0.005) said.push(`${what} ${c >= 0 ? "rose" : "fell"} ${Math.abs(c).toFixed(0)}% to ₹${crs(f(q))} crore.`);
  }
  const rate = h => (h?.taxCr != null && h?.pbtCr > 0 ? (h.taxCr / h.pbtCr) * 100 : null);
  if (rate(q) != null && rate(yearAgo) != null && Math.abs(rate(q) - rate(yearAgo)) >= 2) said.push(`Tax took ${rate(q).toFixed(0)}% of profit before tax, against ${rate(yearAgo).toFixed(0)}% a year earlier.`);
  if (py != null) said.push(`Net ${q.profitCr < 0 ? "loss" : "profit"} ended ${py >= 0 ? "up" : "down"} <b>${Math.abs(py).toFixed(1)}%</b> at ₹${crs(Math.abs(q.profitCr))} crore${q.revenueCr > 0 ? `, ${num((q.profitCr / q.revenueCr) * 100)}% of sales` : ""}.`);
  const price = m.cmp != null ? `<span class="rq-price">₹${esc(num(m.cmp, 2))}${m.ret1d != null ? ` <span class="rq-chip${tone(m.ret1d)}">${m.ret1d > 0 ? "▲" : m.ret1d < 0 ? "▼" : ""}${Math.abs(m.ret1d).toFixed(2)}%</span>` : ""}<small>share price, last close</small></span>` : "";
  const tableRows = kept.map(([l, f, fmt = crs]) => {
    const isPct = l.endsWith("%");
    const diffV = (a, bb) => (isPct ? (a != null && bb != null ? a - bb : null) : change(a, bb));
    const diff = (a, bb) => { const v = diffV(a, bb); return v == null ? "—" : `<span class="rq-d${tone(v)}">${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}${isPct ? " pts" : "%"}</span>`; };
    const key = ["Sales", "Operating profit", "Net profit", "EPS (₹)"].includes(l);
    return `<tr${key ? ' class="rq-key"' : ""}><th>${esc(l)}</th><td>${esc(fmt(f(q)))}</td>${yearAgo ? `<td>${esc(fmt(f(yearAgo)))}</td><td>${diff(f(q), f(yearAgo))}</td>` : ""}${prev ? `<td>${esc(fmt(f(prev)))}</td><td>${diff(f(q), f(prev))}</td>` : ""}</tr>`;
  }).join("");
  const table2 = `<div class="ps-table-wrap rq-table"><table><caption>${esc(n)} ${esc(label)} results against a year earlier and the quarter before (₹ crore)</caption><thead><tr><th>Item</th><th>${esc(label)}</th>${yearAgo ? `<th>${esc(fyQuarter(yearAgo.fyEnd))}</th><th>Year on year</th>` : ""}${prev ? `<th>${esc(fyQuarter(prev.fyEnd))}</th><th>Quarter on quarter</th>` : ""}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
  const quarters = qs.slice(0, 8).map(x => (x === q ? `<span class="rq-q now" aria-current="page">${esc(fyQuarter(x.fyEnd))}</span>` : `<a class="rq-q" href="/stock/${sym}/results/${quarterSlug(x.fyEnd)}">${esc(fyQuarter(x.fyEnd))}</a>`)).join("");
  const sales8 = bars(h => h.revenueCr, true), profit8 = bars(h => h.profitCr, true);
  // plain questions and answers (8 Nov 2026, for AI search), also as FAQ data
  const cr = v => `₹${crs(Math.abs(v))} crore`;
  const nn = /s$/i.test(n) && !/ss$/i.test(n) ? `${n}'` : `${n}'s`;
  const updown = v => (v == null ? "—" : `${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(1)}%`);
  const qa = [
    { q: `How were ${nn} ${label} results?`, a: lede.replace(/^.*?\)( on [^.]*)?\. /, "") || lede },
    q.revenueCr != null && { q: `What were ${nn} sales in ${label}?`, a: `${cr(q.revenueCr)}${sy != null ? `, ${sy >= 0 ? "up" : "down"} ${Math.abs(sy).toFixed(1)}% on ${fyQuarter(yearAgo.fyEnd)}` : ""}${prev?.revenueCr ? ` and ${updown(change(q.revenueCr, prev.revenueCr))} on the quarter before` : ""}.` },
    q.profitCr != null && { q: `What was ${nn} ${q.profitCr < 0 ? "loss" : "profit"} in ${label}?`, a: `A net ${q.profitCr < 0 ? "loss" : "profit"} of ${cr(q.profitCr)}${py != null && q.profitCr > 0 ? `, ${py >= 0 ? "up" : "down"} ${Math.abs(py).toFixed(1)}% on a year earlier` : ""}${q.eps != null ? `; earnings per share ₹${num(q.eps, 2)}` : ""}.` },
    q.opm != null && { q: `What was ${nn} operating margin in ${label}?`, a: `${num(q.opm)}%${yearAgo?.opm != null ? `, against ${num(yearAgo.opm)}% a year earlier` : ""}.` },
    { q: `When did ${n} report ${label} results?`, a: q.filed ? `It filed them with NSE on ${day(q.filed)}, for the quarter to ${day(q.fyEnd)}.` : `For the quarter to ${day(q.fyEnd)}.` },
  ].filter(Boolean);
  return {
    title: resultsTitle(n, label, m.symbol, q, sy, py),
    desc: lede.slice(0, 300),
    canonical: `${SITE}/stock/${sym}/results/${slug}`,
    ld: { "@context": "https://schema.org", "@graph": [
      { "@type": "WebPage", name: resultsTitle(n, label, m.symbol, q, sy, py), description: lede, url: `${SITE}/stock/${sym}/results/${slug}`, dateModified: q.filed ? String(q.filed).slice(0, 10) : undefined },
      { "@type": "FAQPage", mainEntity: qa.map(x => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) },
    ] },
    body: `<main class="seo-stock seo-methodology rq">${crumb(m, `${label} results`).replace("<p>", '<p class="rq-crumb">')}
<header class="rq-head"><div><span class="rq-eyebrow">${esc(label)} results · quarter to ${esc(day(q.fyEnd))}${q.filed ? ` · filed ${esc(day(q.filed))}` : ""}</span><h1>${esc(n)} ${esc(label)} results</h1></div>${price}</header>
<p class="rq-lede">${esc(lede)}</p>
${cards ? `<section class="rq-cards" aria-label="The quarter's figures">${cards}</section><p class="rq-note">Small bars: the last ${span.length} quarters, this one darkest.</p>` : ""}
${said.length ? `<section class="rq-box" aria-label="What changed"><h2>What changed</h2><ul class="rq-said">${said.map(x => `<li>${x}</li>`).join("")}</ul><p class="rq-note">Read from the filed figures against the same quarter a year earlier. Figures, not a view on the shares.</p></section>` : ""}
${sales8 || profit8 ? `<section class="rq-grid2" aria-label="Quarter by quarter">${sales8 ? `<div class="rq-box"><h2>Sales, quarter by quarter</h2><p class="rq-note">₹ crore</p>${sales8}</div>` : ""}${profit8 ? `<div class="rq-box"><h2>Net profit, quarter by quarter</h2><p class="rq-note">₹ crore</p>${profit8}</div>` : ""}</section>` : ""}
${qa.length ? `<section class="rq-box" aria-label="Questions"><h2>Questions about these results</h2>${qa.map(x => `<h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>`).join("")}</section>` : ""}
<section class="rq-box" aria-label="The full results"><h2>The full results</h2>${table2}</section>
${qs.length > 1 ? `<nav class="rq-quarters" aria-label="Other quarters"><span>Other quarters</span>${quarters}</nav>` : ""}
<nav class="rq-links" aria-label="More">${[[`/stock/${sym}`, `${niceName(m.name)} overview`], ...stockPageLinks(m).filter(([p]) => !p.includes("/results/")), ["/results", "Other companies' latest results"], ["/results-calendar", "Results calendar"]].map(([p, t]) => link(p, t)).join("")}</nav>
<p class="rq-note">${esc(NOTE)} Quarterly figures are as filed; a company can restate them later.</p></main>`,
  };
}

// The title is what someone sees in Google's results, so it leads with the
// quarter's two figures people search for (6 Nov 2026: BEL's Q2 page sat near
// position 10 for "bharat electronics q2 fy27 results", 735 times, no click,
// under a title that said only "sales, profit and margin")
export function resultsTitle(n, label, symbol, q, sy, py) {
  const move = (v, what) => (v == null || !isFinite(v) ? null : `${what} ${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(v >= 100 || v <= -100 ? 0 : 1)}%`);
  const loss = q.profitCr != null && q.profitCr < 0;
  const profit = q.profitCr == null ? null
    : loss ? `net loss ₹${crs(Math.abs(q.profitCr))} cr`
    : py != null && isFinite(py) && q.profitCr / (1 + py / 100) > 0 ? `profit ${py >= 0 ? "up" : "down"} ${Math.abs(py).toFixed(Math.abs(py) >= 100 ? 0 : 1)}% to ₹${crs(q.profitCr)} cr`
    : `profit ₹${crs(q.profitCr)} cr`;
  const facts = [profit, move(sy, "sales")].filter(Boolean);
  return facts.length ? `${n} ${label} results: ${facts.join(", ")} | ${symbol}` : pageTitle(`${n} ${label} results: sales, profit and margin | ${symbol}`);
}

// ── /results ─────────────────────────────────────────────────────────────
// The companies that filed their latest quarter in the last two weeks of
// filings, newest first, each with sales and profit against a year earlier and
// a link to its own results page. Dated by the filings we hold, not the clock,
// so it never claims a day's results that haven't been read yet.
export function latestResults(days = 14, cap = 400) {
  const rows = (allMetrics().rows ?? []).filter(r => r.name && r.quarters?.[0]?.filed && r.quarters[0].fyEnd && (r.quarters[0].revenueCr != null || r.quarters[0].profitCr != null));
  const newest = rows.reduce((a, r) => (String(r.quarters[0].filed).slice(0, 10) > a ? String(r.quarters[0].filed).slice(0, 10) : a), "");
  if (!newest) return { newest: null, label: null, days: [], count: 0 };
  const from = new Date(Date.parse(`${newest}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const all = rows.filter(r => String(r.quarters[0].filed).slice(0, 10) >= from);
  const recent = all
    .sort((a, b) => String(b.quarters[0].filed).slice(0, 10).localeCompare(String(a.quarters[0].filed).slice(0, 10)) || (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0))
    .slice(0, cap);
  const labels = new Map();
  for (const r of recent) { const l = fyQuarter(r.quarters[0].fyEnd); labels.set(l, (labels.get(l) ?? 0) + 1); }
  const label = [...labels].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const byDay = new Map();
  for (const r of recent) {
    const d = String(r.quarters[0].filed).slice(0, 10), q = r.quarters[0];
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push({ symbol: r.symbol, name: niceName(r.name), quarter: fyQuarter(q.fyEnd), slug: quarterSlug(q.fyEnd), salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null, marketCapCr: r.marketCapCr ?? null });
  }
  return { newest, label, count: recent.length, total: all.length, days: [...byDay].map(([date, companies]) => ({ date, companies })) };
}

function latestResultsPage() {
  const { newest, label, count, total, days } = latestResults();
  const q = label ?? "Quarterly";
  // a change is only a percentage between two profits; a swing into or out of a loss reads "—"
  const pctR = v => (v == null || !isFinite(v) ? "—" : Math.abs(v) >= 100 ? `${v > 0 ? "+" : "−"}${Math.round(Math.abs(v)).toLocaleString("en-IN")}%` : pct(v));
  const profitMove = c => (c.profitCr == null || c.profitYoY == null || !isFinite(c.profitYoY) || c.profitCr <= 0 || c.profitCr / (1 + c.profitYoY / 100) <= 0 ? "—" : pctR(c.profitYoY));
  const row = c => `<tr><th>${link(`/stock/${encodeURIComponent(c.symbol)}/results/${c.slug}`, c.name)}${c.quarter !== label ? ` <small>${esc(c.quarter)}</small>` : ""}</th><td>${esc(crs(c.salesCr))}</td><td>${esc(pctR(c.salesYoY))}</td><td>${esc(c.profitCr == null ? "—" : c.profitCr < 0 ? `−${crs(Math.abs(c.profitCr))}` : crs(c.profitCr))}</td><td>${esc(profitMove(c))}</td></tr>`;
  // ₹5,000 crore and up, so a tiny company's jump from a small base doesn't lead
  const ups = days.flatMap(d => d.companies).filter(c => c.marketCapCr >= 5000 && c.profitCr > 0 && c.profitYoY != null && isFinite(c.profitYoY)).sort((a, b) => b.profitYoY - a.profitYoY).slice(0, 5);
  return {
    title: pageTitle(`${q} results today: latest NSE company results`),
    desc: `${total} NSE companies' ${q} results filed${newest ? ` up to ${day(newest)}` : ""}: sales and net profit against a year earlier, newest first, each linked to its full results.`,
    canonical: `${SITE}/results`,
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Latest results</p><h1>Latest ${esc(q)} results</h1>${updatedLine()}
<p>${count ? `${total} companies filed their ${esc(q)} results with NSE in the two weeks to ${esc(day(newest))}. ${total > count ? `The latest ${count} are below` : "Here they are"}, newest first, with sales and net profit against the same quarter a year earlier (YoY). Open a company for its full results.` : "No results have been read from NSE's filings yet."}</p>
${ups.length ? `<h2>Biggest profit growth among companies worth ₹5,000 crore or more</h2><ol>${ups.map(c => `<li>${link(`/stock/${encodeURIComponent(c.symbol)}/results/${c.slug}`, c.name)}: net profit ₹${esc(crs(c.profitCr))} crore, up from ₹${esc(crs(c.profitCr / (1 + c.profitYoY / 100)))} crore a year earlier</li>`).join("")}</ol>` : ""}
${days.map(d => `<h2>Filed ${esc(day(d.date))} — ${d.companies.length} ${d.companies.length === 1 ? "company" : "companies"}</h2><div class="ps-table-wrap"><table class="lr-table"><thead><tr><th>Company</th><th>Sales ₹ cr</th><th><abbr title="Year on year">YoY</abbr></th><th>Profit ₹ cr</th><th><abbr title="Year on year">YoY</abbr></th></tr></thead><tbody>${d.companies.map(row).join("")}</tbody></table></div>`).join("")}
<p>${link("/results-calendar", "Coming results: the calendar")} · ${link("/explore", "The market today")} · ${link("/news", "Company announcements")} · ${link("/learn/how-to-read-quarterly-results", "How to read quarterly results")}</p>
<p>Figures from each company's filings with NSE, in ₹ crore. An educational tool, not investment advice. A company can restate its figures later. A profit change reads "—" where either quarter was a loss, or a year-earlier quarter isn't held.</p></main>`,
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
    title: pageTitle(`${n} earnings call${latest ? ` highlights, ${day(latest.date)}` : ""} and next results date | ${m.symbol}`),
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
    title: pageTitle("Indian stock market today: Nifty, sectors, top movers"),
    desc: `The NSE market at the ${asOf ?? "latest"} close: Nifty 50, Bank, Midcap and every sector index; the day's biggest gainers and losers; and the companies reporting results this week.`,
    canonical: `${SITE}/explore`,
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Explore</p><h1>The market at the ${esc(asOf ?? "latest")} close</h1>
<p>NSE's indices, the biggest moves among companies worth ₹${esc(movers.floorCr?.toLocaleString("en-IN") ?? "1,000")} crore or more, and this week's results.</p>
${board.market?.length ? `<h2>Market indices</h2><div class="ps-table-wrap"><table><thead><tr><th>Index</th><th>Close</th><th>Day</th><th>P/E</th></tr></thead><tbody>${idx(board.market)}</tbody></table></div>` : ""}
${board.sectors?.length ? `<h2>Sector indices</h2><div class="ps-table-wrap"><table><thead><tr><th>Index</th><th>Close</th><th>Day</th><th>P/E</th></tr></thead><tbody>${idx(board.sectors)}</tbody></table></div>` : ""}
${movers.gainers.length ? `<h2>Top gainers today</h2>${mv(movers.gainers)}` : ""}${movers.losers.length ? `<h2>Top losers today</h2>${mv(movers.losers)}` : ""}
<h2>Results this week</h2>${week.days?.length ? week.days.map(d => `<h3>${esc(day(d.date))} — ${d.count}</h3><p>${d.companies.slice(0, 15).map(c => link(`/stock/${encodeURIComponent(c.symbol)}`, niceName(c.name))).join(", ")}${d.count > 15 ? ` and ${d.count - 15} more` : ""}</p>`).join("") : "<p>None on NSE's calendar this week.</p>"}
<p>${link("/results", "Latest results")} · ${link("/results-calendar", "Results calendar")} · ${link("/sectors", "Sectors")} · ${link("/screens", "Stock screens")} · ${link("/news", "Company announcements")}</p></main>`,
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
    title: pageTitle("NSE company announcements today: results, dividends"),
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

// ── /learn ───────────────────────────────────────────────────────────────
// The guides' own HTML, written in guides.js; the titles and descriptions escaped
function learnIndexPage() {
  return {
    title: pageTitle("Learn: plain-English guides to Indian stocks"),
    desc: "Short guides to reading an Indian company's results, balance sheet, cash flow and shareholding, and what P/E, ROE, ROCE and debt to equity really tell you.",
    canonical: `${SITE}/learn`,
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Learn</p><h1>Learn to read a company's figures</h1>
<p>Short guides, in plain words, to the numbers on every company page: what each one measures, how to compare it fairly, and the traps to avoid. They explain ideas, never what to buy or sell.</p>
<ul>${GUIDES.map(g => `<li>${link(`/learn/${g.slug}`, g.title)}<br /><small>${esc(g.desc)}</small></li>`).join("")}</ul>
<p>${link("/methodology", "How our scores and fair values work")} · ${link("/help", "How the figures work")} · ${link("/screens", "Stock screens")}</p></main>`,
  };
}
function guidePage(g) {
  const i = GUIDES.indexOf(g), next = GUIDES[(i + 1) % GUIDES.length];
  return {
    title: pageTitle(g.title),
    desc: g.desc,
    canonical: `${SITE}/learn/${g.slug}`,
    ld: { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.desc, image: `${SITE}/og/default.png`, datePublished: GUIDE_PUBLISHED[g.slug] ?? GUIDES_UPDATED, dateModified: GUIDES_UPDATED, author: { "@type": "Organization", name: "Jocular Insights" }, publisher: { "@type": "Organization", name: "Jocular Insights", url: `${SITE}/` }, mainEntityOfPage: `${SITE}/learn/${g.slug}` },
    body: `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › ${link("/learn", "Learn")}</p><article><h1>${esc(g.title)}</h1>
<p><b>${esc(g.desc)}</b></p>
${g.sections.map(([h, html]) => `<h2>${esc(h)}</h2>${html}`).join("\n")}
${g.see?.length ? `<h2>See it on real data</h2><ul>${g.see.map(([to, text]) => `<li>${link(to, text)}</li>`).join("")}</ul>` : ""}
<p><small>Updated ${esc(day(GUIDES_UPDATED))}. For learning only, not investment advice: see the ${link("/disclaimer", "disclaimer")}.</small></p></article>
<p>Next: ${link(`/learn/${next.slug}`, next.title)} · ${link("/learn", "All guides")}</p></main>`,
  };
}

// The page for a path, or null: { title, desc, canonical, body, noindex?, ld? }
export async function publicSubPage(path) {
  if (path === "/explore") return explorePage();
  if (path === "/news") return newsPage();
  if (path === "/results") return latestResultsPage();
  if (path === "/learn") return learnIndexPage();
  const guide = path.match(/^\/learn\/([a-z0-9-]+)$/);
  if (guide) { const g = guideBySlug(guide[1]); return g ? guidePage(g) : null; }
  const m = path.match(/^\/stock\/([^/]+)\/(financials|earnings-call|results\/(q[1-4]-fy\d\d))$/);
  if (!m) return null;
  const row = rowOf(decodeURIComponent(m[1]).toUpperCase());
  if (!row) return null;
  if (m[2] === "financials") return financialsPage(row);
  if (m[2] === "earnings-call") return earningsCallPage(row);
  return resultsPage(row, m[3]);
}
export const isSubPagePath = path => path === "/explore" || path === "/news" || path === "/results" || /^\/learn(\/[a-z0-9-]+)?$/.test(path) || /^\/stock\/[^/]+\/(financials|earnings-call|results\/q[1-4]-fy\d\d)$/.test(path);

// For the sitemap: each company's financials and its latest results; an
// earnings-call page only once a summary has been written
export function subPagePaths() {
  const rows = (allMetrics().rows ?? []).filter(r => r.name && r.history?.length);
  return [
    ["/explore", loadMarketSnapshot()?.pricesDate ?? null], ["/news", null], ["/results", latestResults().newest],
    ...rows.map(r => [`/stock/${encodeURIComponent(r.symbol)}/financials`, r.history?.[0]?.filed ?? null]),
    ...rows.filter(r => r.quarters?.[0]?.fyEnd).map(r => [`/stock/${encodeURIComponent(r.symbol)}/results/${quarterSlug(r.quarters[0].fyEnd)}`, r.quarters[0].filed ?? null]),
    ...rows.filter(r => savedCallSummaries(r.symbol).length).map(r => [`/stock/${encodeURIComponent(r.symbol)}/earnings-call`, savedCallSummaries(r.symbol)[0]?.date ?? null]),
  ];
}
