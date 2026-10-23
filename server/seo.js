// What a search engine — or anyone not signed in — can read (asked for 23 Oct
// 2026: "when we search on Google it should be at the top"). Until now every
// address answered with the same empty app page and a company's figures sat
// behind sign-in, so Google saw one page. Now:
//   /robots.txt   everything but the API may be crawled; where the sitemap is
//   /sitemap.xml  the public pages and every company's page
//   /stock/TCS    the app's page with the company's own title, description,
//                 canonical address and structured data, and a summary of
//                 its figures written into the page — the app replaces it
//                 when it starts; a visitor not signed in sees the same
//                 summary (PublicStock.jsx, from /api/public/stock/TCS)
// The summary is figures at the last close; the fair value, charts and the
// scorecard's checks stay for members.

import { allMetrics } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { METHODOLOGY_DESCRIPTION, METHODOLOGY_SECTIONS, METHODOLOGY_TITLE } from "../src/methodology-content.js";
import { ANALYSIS_EXAMPLES, companyAnalysisFor } from "../src/company-analysis.js";

export const SITE = "https://jocularinsights.in";
const PUBLIC_PATHS = ["/", "/help", "/methodology", "/privacy", "/disclaimer"];

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plain = name => String(name ?? "").replace(/\s+(limited|ltd\.?)\s*$/i, "").trim();
const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (v, d = 1) => (v == null || !isFinite(v) ? null : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
const crore = v => (v == null ? null : v >= 100000 ? `₹${num(v / 100000, 2)} lakh crore` : `₹${Math.round(v).toLocaleString("en-IN")} crore`);
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
// A quarter ending in September 2026 is Q2 of FY27
const fyQuarter = iso => { const [y, m] = String(iso).split("-").map(Number); return y && m ? `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}` : null; };

export function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`;
}

export function sitemapXml() {
  const rows = allMetrics().rows ?? [];
  const lastmod = loadMarketSnapshot()?.pricesDate ?? null;
  const url = (path, freq, prio) => `<url><loc>${SITE}${path}</loc>${lastmod && path.startsWith("/stock/") ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...PUBLIC_PATHS.map(p => url(p, p === "/" ? "daily" : "monthly", p === "/" ? "1.0" : "0.4")),
    ...rows.filter(r => r.name).sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).map(r => url(`/stock/${encodeURIComponent(r.symbol)}`, "daily", (r.marketCapCr ?? 0) >= 10000 ? "0.8" : "0.6")),
  ].join("\n")}\n</urlset>\n`;
}

// A company's public summary: figures at the last close, from the app's data
export function publicStock(symbol) {
  const r = (allMetrics().rows ?? []).find(x => x.symbol === symbol);
  if (!r?.name) return null;
  const q = r.quarters?.[0] ?? null;
  return {
    symbol: r.symbol, name: r.name, sector: r.sector ?? null, industry: r.industry ?? null,
    close: r.close ?? r.cmp ?? null, closeDate: r.closeDate ?? r.cmpDate ?? null, change1d: r.ret1d ?? null, change1y: r.ret1y ?? null,
    low52w: r.low52w ?? null, high52w: r.high52w ?? null, marketCapCr: r.marketCapCr ?? null,
    pe: r.pe ?? null, pb: r.priceToBook ?? null, roe: r.roe ?? null, roce: r.roce ?? null, debtToEquity: r.debtToEquity ?? null, divYield: r.divYield ?? null,
    quality: r.research?.quality ?? null,
    quarter: q ? { end: q.fyEnd, filed: q.filed ?? null, label: fyQuarter(q.fyEnd), salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null, opm: q.opm ?? null, eps: q.eps ?? null } : null,
    recentQuarters: (r.quarters ?? []).slice(0, 8).map(x => ({ end: x.fyEnd, filed: x.filed ?? null, label: fyQuarter(x.fyEnd), salesCr: x.revenueCr ?? null, salesYoY: x.salesYoY ?? null, profitCr: x.profitCr ?? null, profitYoY: x.profitYoY ?? null, opm: x.opm ?? null, eps: x.eps ?? null })),
    nextResults: r.nextResults ?? null,
  };
}

function analysisHtml(s) {
  const a = companyAnalysisFor(s);
  if (!a) return "";
  const amount = v => v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")} crore`;
  const percent = v => v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  const ratio = (v, d = 1) => v == null ? "—" : Number(v).toFixed(d);
  const rows = (s.recentQuarters ?? []).slice(0, 4).map(q => `<tr><th>${esc(q.label ?? day(q.end) ?? "Quarter")}</th><td>${esc(amount(q.salesCr))}</td><td>${esc(amount(q.profitCr))}</td><td>${esc(q.opm == null ? "—" : `${ratio(q.opm)}%`)}</td><td>${esc(q.eps == null ? "—" : `₹${ratio(q.eps, 2)}`)}</td></tr>`).join("");
  const q = a.latest;
  const revenueLabel = s.symbol === "HDFCBANK" ? "reported revenue line" : "reported revenue";
  const period = q ? `${q.label ?? day(q.end)}${q.filed ? ` · filed ${day(q.filed)}` : ""}` : "Latest reported quarter";
  const introFacts = q ? [
    q.salesCr != null && `${revenueLabel} ${amount(q.salesCr)}${q.salesYoY != null ? ` (${percent(q.salesYoY)} year on year)` : ""}`,
    q.profitCr != null && `net profit ${amount(q.profitCr)}${q.profitYoY != null ? ` (${percent(q.profitYoY)} year on year)` : ""}`,
    q.opm != null && `operating margin ${ratio(q.opm)}%`,
  ].filter(Boolean).join("; ") : "Quarterly figures are not available in the latest snapshot.";
  const ratios = [
    ["P/E", a.marketRatios.pe == null ? null : ratio(a.marketRatios.pe)],
    ["Price-to-book", a.marketRatios.pb == null ? null : ratio(a.marketRatios.pb, 2)],
    ["ROE", a.marketRatios.roe == null ? null : `${ratio(a.marketRatios.roe)}%`],
    ["ROCE", a.marketRatios.roce == null ? null : `${ratio(a.marketRatios.roce)}%`],
    ["Debt-to-equity", a.marketRatios.debtToEquity == null ? null : ratio(a.marketRatios.debtToEquity, 2)],
    ["Dividend yield", a.marketRatios.divYield == null ? null : `${ratio(a.marketRatios.divYield, 2)}%`],
  ].filter(([, value]) => value != null).map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`).join("");
  const related = ANALYSIS_EXAMPLES.filter(item => item.symbol !== s.symbol).map(item => `<li><a href="/stock/${encodeURIComponent(item.symbol)}">${esc(item.name)}</a></li>`).join("");
  return `<section class="ps-analysis" aria-labelledby="company-analysis-title">
<h2 id="company-analysis-title">${esc(a.title)}</h2>
<p>${esc(a.lens)}</p>
<h3>Latest reported figures · ${esc(period)}</h3><p>${esc(introFacts)}.</p>
${rows ? `<div class="ps-table-wrap"><table><caption>Recent quarterly figures, as reported (₹ crore unless stated)</caption><thead><tr><th>Period</th><th>Revenue line</th><th>Net profit</th><th>Operating margin</th><th>EPS</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}
<p>Quarterly figures are shown as reported in the available company results. Revenue lines can differ by business type and should not be compared across companies without checking each filing's definitions, especially for banks. Missing ratios or figures are omitted rather than treated as zero.</p>
<h3>Market ratios at the ${esc(day(s.closeDate) ?? "latest available")} close</h3><table><tbody>${ratios}</tbody></table>
<h3>How to read these numbers</h3><ul>${a.checks.map(item => `<li>${esc(item)}</li>`).join("")}</ul>
<h3>What the summary cannot answer</h3><p>${esc(a.watch)}</p>
<h3>More company examples</h3><ul>${related}</ul>
<p>Quarterly data is based on company results filed with NSE; market ratios are from the latest Jocular Insights data snapshot. Figures can be revised or restated. Check the original filings before relying on them. This page is educational information, not investment advice. <a href="/methodology">How Jocular calculates scores and reference fair values</a>.</p>
</section>`;
}

function describe(s) {
  const n = plain(s.name);
  const parts = [
    s.close != null && `${n} (NSE: ${s.symbol}) closed at ₹${num(s.close, 2)} on ${day(s.closeDate)}${s.change1d != null ? ` (${pct(s.change1d, 2)})` : ""}.`,
    s.marketCapCr != null && `Market cap ${crore(s.marketCapCr)}`,
    s.pe != null && s.pe > 0 && `P/E ${num(s.pe)}`,
    s.roce != null && `ROCE ${num(s.roce)}%`,
    s.quality != null && `quality score ${Math.round(s.quality)}/100`,
  ].filter(Boolean);
  const analysis = companyAnalysisFor(s);
  const result = analysis?.latest;
  const analysisFact = result && [
    result.salesYoY != null && `revenue ${pct(result.salesYoY)} year on year`,
    result.profitYoY != null && `profit ${pct(result.profitYoY)} year on year`,
  ].filter(Boolean).join(", ");
  return `${parts[0] ?? `${n} on NSE.`} ${parts.slice(1).join(", ")}${parts.length > 1 ? "." : ""}${analysisFact ? ` Latest results: ${analysisFact}.` : ""} Results analysis, fair value and filings on Jocular Insights.`.slice(0, 300);
}

// The summary as plain HTML, for the page itself (what a crawler reads)
function summaryHtml(s) {
  const n = plain(s.name);
  const row = (label, value) => (value == null ? "" : `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`);
  const q = s.quarter;
  return `<main class="seo-stock">
<p><a href="/">Jocular Insights</a> › ${esc(s.sector ?? "NSE")} › ${esc(s.symbol)}</p>
<h1>${esc(n)} share price, P/E and quality score</h1>
<p>${esc(n)} (NSE: ${esc(s.symbol)})${s.industry ? ` · ${esc(s.industry)}` : ""}</p>
${s.close != null ? `<p><strong>₹${esc(num(s.close, 2))}</strong> ${esc(pct(s.change1d, 2) ?? "")} · close on ${esc(day(s.closeDate))}</p>` : ""}
<table>
${row("Market cap", crore(s.marketCapCr))}
${row("52-week range", s.low52w != null && s.high52w != null ? `₹${num(s.low52w, 2)} – ₹${num(s.high52w, 2)}` : null)}
${row("1-year return", pct(s.change1y))}
${row("P/E", s.pe != null && s.pe > 0 ? num(s.pe) : null)}
${row("P/B", s.pb != null && s.pb > 0 ? num(s.pb, 2) : null)}
${row("ROE", s.roe != null ? `${num(s.roe)}%` : null)}
${row("ROCE", s.roce != null ? `${num(s.roce)}%` : null)}
${row("Debt to equity", s.debtToEquity != null ? num(s.debtToEquity, 2) : null)}
${row("Dividend yield", s.divYield != null ? `${num(s.divYield, 2)}%` : null)}
${row("Quality score", s.quality != null ? `${Math.round(s.quality)} / 100` : null)}
${q ? row(`${q.label} sales`, q.salesCr != null ? `₹${Math.round(q.salesCr).toLocaleString("en-IN")} crore${q.salesYoY != null ? ` (${pct(q.salesYoY)} on a year earlier)` : ""}` : null) : ""}
${q ? row(`${q.label} profit`, q.profitCr != null ? `₹${Math.round(q.profitCr).toLocaleString("en-IN")} crore${q.profitYoY != null ? ` (${pct(q.profitYoY)} on a year earlier)` : ""}` : null) : ""}
${row("Next results", s.nextResults ? day(s.nextResults) : null)}
</table>
${analysisHtml(s)}
<p>Figures from NSE filings and prices at the last close. <a href="/">Sign in for ${esc(n)}'s fair value, scorecard, charts and filings</a>.</p>
<p><a href="/methodology">How the scores and fair values are calculated</a> · <a href="/disclaimer">Important limitations</a>. Not investment advice.</p>
</main>`;
}

// A public, server-rendered explanation so people and search crawlers can
// read the scoring and valuation methodology without waiting for app JS.
export function methodologyPageHtml(template) {
  const sections = METHODOLOGY_SECTIONS.map(section => `<section><h2>${esc(section.title)}</h2>${section.paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}${section.bullets ? `<ul>${section.bullets.map(item => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>`).join("\n");
  const canonical = `${SITE}/methodology`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: METHODOLOGY_TITLE,
    description: METHODOLOGY_DESCRIPTION,
    url: canonical,
    publisher: { "@type": "Organization", name: "Jocular Insights", url: SITE },
  };
  const head = `<title>${esc(METHODOLOGY_TITLE)} | Jocular Insights</title>
<meta name="description" content="${esc(METHODOLOGY_DESCRIPTION)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(METHODOLOGY_TITLE)} | Jocular Insights" />
<meta property="og:description" content="${esc(METHODOLOGY_DESCRIPTION)}" />
<meta property="og:url" content="${esc(canonical)}" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  const examples = `<section><h2>Worked company examples</h2><p>See how to read recent reported figures in context:</p><ul>${ANALYSIS_EXAMPLES.map(item => `<li><a href="/stock/${encodeURIComponent(item.symbol)}">${esc(item.name)}</a></li>`).join("")}</ul></section>`;
  const body = `<main class="seo-stock seo-methodology"><p><a href="/">Jocular Insights</a> › Methodology</p><h1>${esc(METHODOLOGY_TITLE)}</h1><p>${esc(METHODOLOGY_DESCRIPTION)}</p>${sections}${examples}<p><a href="/disclaimer">Read the full disclaimer</a> · <a href="/help">How figures are updated</a> · Contact <a href="mailto:jocularinsights@gmail.com">jocularinsights@gmail.com</a>.</p></main>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace(/<meta property="og:(title|description|url|type)"[^>]*>/g, "")
    .replace("</head>", `${head}\n</head>`)
    .replace(/<div id="root">\s*<\/div>/, `<div id="root">${body}</div>`);
}

// The app's page, made the company's own: title, description, canonical,
// social cards and structured data in the head; the summary in the root
export function stockPageHtml(template, symbol) {
  const s = publicStock(symbol);
  if (!s) return null;
  const n = plain(s.name);
  const title = `${n} share price${companyAnalysisFor(s) ? ", results analysis" : ""}, P/E, fair value & quality score | ${s.symbol} | Jocular Insights`;
  const desc = describe(s);
  const canonical = `${SITE}/stock/${encodeURIComponent(s.symbol)}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Corporation", name: s.name, tickerSymbol: `NSE:${s.symbol}`, ...(s.industry ? { industry: s.industry } : {}) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Jocular Insights", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: n, item: canonical },
      ] },
    ],
  };
  const head = `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(`${n} (${s.symbol}) — Jocular Insights`)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(canonical)}" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  return template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>/, "")
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace(/<meta property="og:(title|description|url|type)"[^>]*>/g, "")
    .replace("</head>", `${head}\n</head>`)
    .replace(/<div id="root">\s*<\/div>/, `<div id="root">${summaryHtml(s)}<script id="public-stock-data" type="application/json">${JSON.stringify(s).replace(/</g, "\\u003c")}</script></div>`);
}
