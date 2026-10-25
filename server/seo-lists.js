// Pages people search for, open to everyone and to search engines (24 Oct
// 2026, "more pages Google can find"): each strategy's companies today, an
// index of the strategies, and the results calendar. The same data the app
// shows, at the last close — the companies that pass a set of filters, not
// recommendations; each page says so.
//
//   /screens                 every strategy, how many companies match, the first few
//   /screens/<strategy>      its rules in words and the companies that match
//   /results-calendar        board meetings for results, the next two weeks
//
// Each is written into the page for search engines (…Html below) and served
// as JSON for the app's own copy of the page (/api/public/…, PublicLists.jsx).
import { PRESETS } from "./presets.js";
import { screen, allMetrics } from "./screen.js";
import { resultsWeek } from "./explore.js";
import { loadMarketSnapshot } from "./market-data.js";
import { SITE, esc, crore, num, day, pageHtml } from "./seo.js";

import { niceName } from "../src/stockName.js";
import { publicSectors, publicSector } from "./seo-story.js";
import { SCREEN_GUIDES } from "./screen-guides.js";
import { loadSnapshots } from "./performance.js";

// as the app shows names: "Limited" off, capitals as words ("TATA CONSUMER PRODUCTS" → "Tata Consumer Products")
const plain = name => niceName(name);
// a sentence ends with a stop before the next one
const sentence = t => { const x = String(t ?? "").trim(); return x && !/[.!?]$/.test(x) ? `${x}.` : x; };
export const screenSlug = id => String(id).replace(/_/g, "-");
const bySlug = slug => PRESETS.find(p => screenSlug(p.id) === slug) ?? null;
const SHOWN = 50;
// a company's name, for one that has left a screen (so isn't in its results)
let nameMap = null, nameMarket = null;
function nameOf(sym) {
  const market = allMetrics();
  if (nameMarket !== market) { nameMap = new Map((market.rows ?? []).map(r => [r.symbol, plain(r.name)])); nameMarket = market; }
  return nameMap.get(sym) ?? sym;
}

function run(preset) {
  return screen(preset.filters ? { filters: preset.filters, sort: preset.sort } : preset.criteria);
}

// Which companies joined and left a screen since about a week ago: today's
// list against the strategy snapshot (performance.js, every three days) from
// six or more days back. null until there is one.
export function screenChanges(presetId, nowSymbols, names, snaps = loadSnapshots()) {
  const today = snaps.filter(x => x.presetId === presetId && Array.isArray(x.members)).map(x => x.date).sort().at(-1);
  if (!today) return null;
  const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const then = snaps.filter(x => x.presetId === presetId && Array.isArray(x.members) && x.date <= cutoff).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!then) return null;
  const before = new Set(then.members), now = new Set(nowSymbols);
  const named = sym => ({ symbol: sym, name: names.get(sym) ?? nameOf(sym) });
  return { since: then.date, joined: nowSymbols.filter(x => !before.has(x)).slice(0, 15).map(named), left: then.members.filter(x => !now.has(x)).slice(0, 15).map(named), joinedCount: nowSymbols.filter(x => !before.has(x)).length, leftCount: then.members.filter(x => !now.has(x)).length };
}

// One strategy: its rules in words and the companies that match, the best
// quality first (or, for one that ranks by a measure, by that measure)
export function publicScreen(slug) {
  const p = bySlug(slug);
  if (!p) return null;
  const res = run(p);
  return {
    slug, id: p.id, name: p.name, description: p.description ?? null,
    rules: String(res.queryUsed ?? "").split(" · ").filter(Boolean),
    matched: res.matched, total: res.total,
    pricesDate: loadMarketSnapshot()?.pricesDate ?? null,
    companies: (res.results ?? []).slice(0, SHOWN).map(r => ({
      symbol: r.symbol, name: plain(r.name), sector: r.sector ?? null,
      price: r.cmp ?? null, marketCapCr: r.marketCapCr ?? null, pe: r.pe ?? null, roe: r.roe ?? null, roce: r.roce ?? null,
      quality: r.research?.quality == null ? null : Math.round(r.research.quality),
    })),
    // what people search it by, what it looks for, who it may suit, its limits
    guide: SCREEN_GUIDES[p.id] ?? null,
    changes: screenChanges(p.id, (res.results ?? []).map(r => r.symbol), new Map((res.results ?? []).map(r => [r.symbol, plain(r.name)]))),
  };
}

export function publicScreens() {
  return {
    pricesDate: loadMarketSnapshot()?.pricesDate ?? null,
    screens: PRESETS.map(p => {
      const res = run(p);
      return { slug: screenSlug(p.id), name: p.name, description: p.description ?? null, matched: res.matched, first: (res.results ?? []).slice(0, 5).map(r => ({ symbol: r.symbol, name: plain(r.name) })) };
    }),
  };
}

export function publicResultsCalendar() {
  const w = resultsWeek(14);
  return { today: w.today, days: w.days.map(d => ({ date: d.date, count: d.count, companies: d.companies.map(c => ({ symbol: c.symbol, name: plain(c.name), sector: c.sector, marketCapCr: c.marketCapCr })) })) };
}

export const LIST_PATHS = () => ["/screens", "/results-calendar", ...PRESETS.map(p => `/screens/${screenSlug(p.id)}`)];

const NOT_ADVICE = "These are the NSE companies that pass a set of filters on reported figures at the last close — a starting point for research, not a recommendation to buy or sell. Check each company's filings before deciding anything.";
const link = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;

export function screenPageHtml(template, slug) {
  const s = publicScreen(slug);
  if (!s) return null;
  const canonical = `${SITE}/screens/${slug}`;
  // short enough for a search result (about 60 characters); the rules are in the description
  const g = s.guide;
  const title = g ? `${g.search}: ${s.matched} today | Jocular Insights` : `${s.name}: ${s.matched} NSE stocks that match today | Jocular Insights`;
  const desc = `${s.matched} NSE companies match ${s.name} at the ${day(s.pricesDate) ?? "latest"} close: ${s.rules.join(", ")}. ${sentence(s.description)}`.trim();
  const rows = s.companies.map((c, i) => `<tr><td>${i + 1}</td><td>${link(`/stock/${encodeURIComponent(c.symbol)}`, c.name)} <small>${esc(c.symbol)}</small></td><td>${c.price == null ? "—" : `₹${esc(num(c.price, 2))}`}</td><td>${esc(crore(c.marketCapCr) ?? "—")}</td><td>${c.pe > 0 ? esc(num(c.pe)) : "—"}</td><td>${c.roe == null ? "—" : `${esc(num(c.roe))}%`}</td><td>${c.quality == null ? "—" : `${c.quality}/100`}</td></tr>`).join("");
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${s.name}: matching NSE companies`,
    numberOfItems: s.companies.length,
    itemListElement: s.companies.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE}/stock/${encodeURIComponent(c.symbol)}` })),
  };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › ${link("/screens", "Stock screens")} › ${esc(s.name)}</p>
<h1>${g ? `${esc(g.search)} — ${esc(s.name)}` : `${esc(s.name)}: NSE companies that match today`}</h1>
<p>${esc(sentence(s.description))} ${s.matched} of ${s.total} companies pass at the ${esc(day(s.pricesDate) ?? "latest")} close.</p>
${g ? `<h2>What this screen looks for</h2><p>${esc(g.lookFor)}</p><h2>Who it may suit</h2><p>${esc(g.suits)} It is a starting point for research, not a list of recommendations.</p>` : ""}
<h2>The filters</h2><ul>${s.rules.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
${g ? `<h2>Limitations</h2><p>${esc(g.limits)}</p>` : ""}
${s.changes ? `<h2>What changed since ${esc(day(s.changes.since))}</h2><p>${s.changes.joinedCount} ${s.changes.joinedCount === 1 ? "company" : "companies"} joined and ${s.changes.leftCount} left.</p>${s.changes.joined.length ? `<p>Joined: ${s.changes.joined.map(c => link(`/stock/${encodeURIComponent(c.symbol)}`, c.name)).join(", ")}${s.changes.joinedCount > s.changes.joined.length ? " and more" : ""}.</p>` : ""}${s.changes.left.length ? `<p>Left: ${s.changes.left.map(c => link(`/stock/${encodeURIComponent(c.symbol)}`, c.name)).join(", ")}${s.changes.leftCount > s.changes.left.length ? " and more" : ""}.</p>` : ""}` : ""}
<h2>Companies that match${s.matched > s.companies.length ? ` (the first ${s.companies.length})` : ""}</h2>
<table><thead><tr><th>#</th><th>Company</th><th>Price</th><th>Market cap</th><th>P/E</th><th>ROE</th><th>Quality</th></tr></thead><tbody>${rows}</tbody></table>
<p>${esc(NOT_ADVICE)}</p>
<p>${link("/screens", "All stock screens")} · ${link("/results-calendar", "Results calendar")} · ${link("/methodology", "How the quality score works")} · ${link("/disclaimer", "Disclaimer")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body });
}

export function screensIndexHtml(template) {
  const s = publicScreens();
  const canonical = `${SITE}/screens`;
  const title = "Indian stock screens: NSE companies by quality, value, dividends and growth | Jocular Insights";
  const desc = `${s.screens.length} ready-made screens of NSE companies — quality compounders, dividend payers, undervalued growth and more — with the companies that match at the ${day(s.pricesDate) ?? "latest"} close.`;
  const items = s.screens.map(x => `<li><h2>${link(`/screens/${x.slug}`, x.name)}</h2><p>${esc(sentence(x.description))} ${x.matched} companies match${x.first.length ? `, including ${x.first.slice(0, 3).map(c => esc(c.name)).join(", ")}` : ""}.</p></li>`).join("");
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "Stock screens", itemListElement: s.screens.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: `${SITE}/screens/${x.slug}` })) };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Stock screens</p><h1>Indian stock screens</h1><p>${esc(desc)}</p><ul>${items}</ul><p>${esc(NOT_ADVICE)}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body });
}

export function resultsCalendarHtml(template) {
  const c = publicResultsCalendar();
  const canonical = `${SITE}/results-calendar`;
  const total = c.days.reduce((n, d) => n + d.count, 0);
  const title = "Quarterly results calendar: NSE companies announcing results this week | Jocular Insights";
  const desc = `${total} NSE companies have board meetings for results in the next two weeks — dates from NSE's calendar, the largest companies first.`;
  const days = c.days.map(d => `<section><h2>${esc(day(d.date))} — ${d.count} ${d.count === 1 ? "company" : "companies"}</h2><ul>${d.companies.slice(0, 60).map(x => `<li>${link(`/stock/${encodeURIComponent(x.symbol)}`, x.name)}${x.sector ? ` <small>${esc(x.sector)}</small>` : ""}</li>`).join("")}</ul>${d.count > 60 ? `<p>And ${d.count - 60} more.</p>` : ""}</section>`).join("");
  const ld = { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url: canonical };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Results calendar</p><h1>Quarterly results calendar</h1><p>${esc(desc)}</p>${days || "<p>No results dates in the next two weeks on NSE's calendar.</p>"}<p>Dates are board meetings companies have told NSE about; they can change. ${link("/screens", "Stock screens")} · ${link("/disclaimer", "Disclaimer")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body });
}

// The front page as search engines and link previews read it (25 Oct 2026:
// it was an empty app shell — nine words, no heading). What the site is, every
// screen with today's count, the largest companies reporting results soon, and
// the pages that explain the numbers. The app replaces it when it starts.
export function homePageHtml(template) {
  const s = publicScreens();
  const c = publicResultsCalendar();
  const reporting = c.days.reduce((n, d) => n + d.count, 0);
  const soon = c.days.flatMap(d => d.companies.map(x => ({ ...x, date: d.date }))).sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).slice(0, 12);
  const title = "NSE Stock Screener & Quality Scores | Jocular Insights";
  const desc = "Screen every NSE-listed company with ready-made strategies, a quality score out of 100 from each company's own filings with every check explained, and results dates as they're announced. Free during early access.";
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE}/#website`, name: "Jocular Insights", alternateName: "Jocular", url: `${SITE}/`, inLanguage: "en-IN", publisher: { "@id": `${SITE}/#org` } },
      { "@type": "Organization", "@id": `${SITE}/#org`, name: "Jocular Insights", url: `${SITE}/`, logo: `${SITE}/icons/icon-512.png`, email: "jocularinsights@gmail.com" },
      { "@type": "WebApplication", name: "Jocular Insights", url: `${SITE}/`, applicationCategory: "FinanceApplication", operatingSystem: "Web, Android", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" }, description: "NSE stock screener with quality scores from company filings." },
    ],
  };
  const body = `<main class="seo-stock seo-methodology seo-home">
<h1>NSE stock screener with quality scores from company filings</h1>
<p>Jocular Insights covers every company listed on the National Stock Exchange of India. Each one gets a quality score out of 100, worked out from its own quarterly and annual filings with NSE, with every check shown and explained: return on capital, debt, cash flow, growth, governance and more. Its results are drawn as pictures — how sales became profit, what it owns and owes, where the cash came from and went — beside the full tables.</p>
<p>Prices are NSE's daily closes, at the ${esc(day(s.pricesDate) ?? "latest")} close. It is a research tool: it shows what the filings say, it doesn't tell anyone what to buy or sell.</p>
<h2>Ready-made stock screens</h2>
<p>Each screen is a set of filters on reported figures. These are the NSE companies that pass each one today:</p>
<ul>${s.screens.map(x => `<li>${link(`/screens/${x.slug}`, x.name)} — ${x.matched} ${x.matched === 1 ? "company" : "companies"}${x.description ? `. ${esc(sentence(x.description))}` : ""}</li>`).join("")}</ul>
<p>${link("/screens", "See all stock screens")}</p>
<h2>Results in the next two weeks</h2>
<p>${reporting} NSE companies have told the exchange they'll meet to approve results in the next two weeks${soon.length ? ", including:" : "."}</p>
${soon.length ? `<ul>${soon.map(x => `<li>${link(`/stock/${encodeURIComponent(x.symbol)}`, x.name)} — ${esc(day(x.date))}</li>`).join("")}</ul>` : ""}
<p>${link("/results-calendar", "Open the results calendar")}</p>
<h2>Browse by sector</h2>
<ul>${publicSectors().sectors.filter(x => x.count >= 3).map(x => `<li>${link(`/sector/${x.slug}`, x.name)} — ${x.count} companies</li>`).join("")}</ul>
<p>${link("/sectors", "All sectors")}</p>
<h2>How the quality score works</h2>
<p>The score adds up checks in six groups — business quality, earnings quality, balance sheet, governance, growth and valuation — each from the company's own filings, with banks and cyclical businesses judged on their own tests. Every check says what it found and why it passed or failed. ${link("/methodology", "Read the full methodology")}.</p>
<p>${link("/stock-screener-india", "About this Indian stock screener")} · ${link("/about", "About Jocular Insights")} · ${link("/help", "How the figures work")} · ${link("/disclaimer", "Disclaimer")} · ${link("/privacy", "Privacy")}</p>
</main>`;
  return pageHtml(template, { title, desc, canonical: `${SITE}/`, ld, body });
}

// /sectors and /sector/<slug> (25 Oct 2026, the SEO audit): every listed
// company in a sector, linked, with the sector's middle P/E and return on
// equity, its highest-quality names and the screens its companies pass most
export function sectorsIndexHtml(template) {
  const s = publicSectors();
  const canonical = `${SITE}/sectors`;
  const title = "NSE stocks by sector: every listed company, sector by sector | Jocular Insights";
  const desc = `NSE-listed companies in ${s.sectors.length} sectors — IT, banks and financial services, pharma, FMCG, auto, capital goods and more — with each sector's companies, P/E and return on equity at the ${day(s.pricesDate) ?? "latest"} close.`;
  const items = s.sectors.map(x => `<li><h2>${link(`/sector/${x.slug}`, x.name)}</h2><p>${x.count} ${x.count === 1 ? "company" : "companies"}${x.largest.length ? `, the largest ${x.largest.map(c => esc(c.name)).join(", ")}` : ""}.</p></li>`).join("");
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "NSE sectors", itemListElement: s.sectors.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: `${SITE}/sector/${x.slug}` })) };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Sectors</p><h1>NSE stocks by sector</h1><p>${esc(desc)}</p><ul>${items}</ul><p>${link("/screens", "Stock screens")} · ${link("/results-calendar", "Results calendar")} · ${link("/methodology", "How the quality score works")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body });
}

export function sectorPageHtml(template, slug) {
  const s = publicSector(slug);
  if (!s) return null;
  const canonical = `${SITE}/sector/${slug}`;
  const title = `${s.name} stocks on NSE: ${s.count} companies by P/E, ROE and quality | Jocular Insights`;
  const desc = `All ${s.count} NSE-listed ${s.name} companies at the ${day(s.pricesDate) ?? "latest"} close${s.medianPe ? `: median P/E ${num(s.medianPe)}` : ""}${s.medianRoe != null ? `, median return on equity ${num(s.medianRoe)}%` : ""}, with each company's price, P/E, ROE, debt and quality score.`;
  const intro = [
    `${s.count} companies listed on NSE are in ${s.name}, together worth ${crore(s.totalMarketCapCr)}.`,
    s.medianPe ? `The middle P/E among them is ${num(s.medianPe)}${s.medianRoe != null ? ` and the middle return on equity ${num(s.medianRoe)}%` : ""}${s.medianRoce != null ? `, return on capital ${num(s.medianRoce)}%` : ""}.` : "",
    s.best.length ? `By quality score from their own filings, the highest are ${s.best.map(b => `${b.name} (${Math.round(b.quality)})`).join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  const cell = (v, f) => (v == null ? "—" : f(v));
  const rows = s.companies.map((c, i) => `<tr><td>${i + 1}</td><td>${link(`/stock/${encodeURIComponent(c.symbol)}`, c.name)} <small>${esc(c.symbol)}</small></td><td>${cell(c.price, v => `₹${esc(num(v, 2))}`)}</td><td>${esc(crore(c.marketCapCr) ?? "—")}</td><td>${cell(c.pe, v => esc(num(v)))}</td><td>${cell(c.roe, v => `${esc(num(v))}%`)}</td><td>${cell(c.debtToEquity, v => esc(num(v, 2)))}</td><td>${cell(c.quality, v => `${Math.round(v)}/100`)}</td></tr>`).join("");
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "ItemList", name: `${s.name} companies on NSE`, numberOfItems: s.companies.length, itemListElement: s.companies.slice(0, 100).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, url: `${SITE}/stock/${encodeURIComponent(c.symbol)}` })) },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Jocular Insights", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Sectors", item: `${SITE}/sectors` }, { "@type": "ListItem", position: 3, name: s.name, item: canonical }] },
    ],
  };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › ${link("/sectors", "Sectors")} › ${esc(s.name)}</p>
<h1>${esc(s.name)} stocks on NSE</h1>
<p>${esc(intro)}</p>
${s.screens.length ? `<h2>Screens its companies pass most</h2><ul>${s.screens.map(x => `<li>${link(`/screens/${x.slug}`, x.name)} — ${x.count} ${s.name} ${x.count === 1 ? "company" : "companies"}</li>`).join("")}</ul>` : ""}
<h2>Every listed ${esc(s.name)} company</h2>
<table><thead><tr><th>#</th><th>Company</th><th>Price</th><th>Market cap</th><th>P/E</th><th>ROE</th><th>Debt/equity</th><th>Quality</th></tr></thead><tbody>${rows}</tbody></table>
<p>Sectors are NSE's own, from its index lists; a company NSE doesn't classify is placed by its industry or its filings. ${esc(NOT_ADVICE)}</p>
<p>${link("/sectors", "All sectors")} · ${link("/screens", "Stock screens")} · ${link("/methodology", "How the quality score works")} · ${link("/disclaimer", "Disclaimer")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body });
}
