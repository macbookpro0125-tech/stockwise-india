// Lists people search for (6 Nov 2026: "make more" pages, after the visitor
// review showed Google starting to send people to the screens pages):
// an index's companies ("Nifty 50 stocks list"), NSE's themes ("defence
// stocks"), price bands ("stocks under ₹100") and a few plain filters
// ("debt-free stocks", "52-week high stocks"). /lists and /lists/<slug>.
//
// Every list is NSE's own membership (its index lists, already in the market
// snapshot) or a plain rule on reported figures at the last close, said on
// the page — never our pick. A list with too few companies isn't published.
import { allMetrics } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { SITE, esc, crore, num, day, pageHtml, ogCard, listData } from "./seo.js";
import { niceName } from "../src/stockName.js";
import { updatedLine } from "./updated-line.js";
import { LISTS_TITLE, listTitle } from "../src/pageTitle.js";

const NOT_ADVICE = "A list of companies on reported figures at the last close, as a starting point for research — not a recommendation to buy or sell. Check each company's filings before deciding anything.";
const link = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;
const quality = m => m.research?.quality ?? null;
const median = list => { const v = list.filter(x => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const byCap = (a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0);
const byQuality = (a, b) => (quality(b) ?? -1) - (quality(a) ?? -1) || byCap(a, b);
// the overall score: the app's one headline score (12 Nov 2026)
const overall = m => m.research?.overall?.score ?? null;
const byOverall = (a, b) => (overall(b) ?? -1) - (overall(a) ?? -1) || byQuality(a, b);
const OVERALL_COL = { label: "Overall score", get: m => (overall(m) != null ? `${Math.round(overall(m))}/100` : "—") };
// a company with figures worth showing: a price, a size
const listed = m => m.name && m.cmp > 0 && m.marketCapCr > 0;
const MIN = 5;
const SHOWN = 300;

// kind: "index" (NSE's index list), "theme" (NSE's thematic index), "rule"
const index = (slug, name, key, search, about) => ({ slug, name, kind: "index", from: snap => snap?.screenIndices?.[key], search, about });
const theme = (slug, name, key, search, about) => ({ slug, name, kind: "theme", from: snap => snap?.themes?.[key], search, about });
const rule = (slug, name, test, search, about, extra = null, order = byQuality) => ({ slug, name, kind: "rule", test, search, about, extra, order });

// The highest overall scores (12 Nov 2026, "which stock has the best score
// overall?"): the method's ranking, said as such, never "best to buy"
const scored = (slug, name, test, search, about) => ({ ...rule(slug, name, (m, c) => overall(m) != null && test(m, c), search, about, OVERALL_COL, byOverall), group: "score" });
const OVERALL_METHOD = "The overall score is our own method, out of 100: how good the business is from its filings (returns, cash behind profits, balance sheet, governance, growth: 70%) and how cheap the share is against its own usual P/E, its peers and its cash flow (30%), trimmed for big price swings and missing data, and held at 39 or under while a serious red flag (such as a qualified audit) stands. It ranks companies by those figures. When we re-scored the market on past dates (2024–26), higher-scoring companies did better than lower-scoring ones a year later on most dates, but did not beat the Nifty 50 on average: it is not a forecast.";

export const LISTS = [
  scored("highest-rated-stocks", "Highest overall scores", m => m.marketCapCr >= 500, "best stocks by score India", "NSE companies worth ₹500 crore or more, ranked by our overall score"),
  scored("highest-rated-large-cap-stocks", "Highest-scoring large caps", (m, c) => c.rank(m) <= 100, "best large cap stocks by score", "the 100 largest NSE companies by market value, ranked by our overall score"),
  scored("highest-rated-mid-cap-stocks", "Highest-scoring mid caps", (m, c) => c.rank(m) > 100 && c.rank(m) <= 250, "best mid cap stocks by score", "NSE companies ranked 101st to 250th by market value, ranked by our overall score"),
  scored("highest-rated-small-cap-stocks", "Highest-scoring small caps", (m, c) => c.rank(m) > 250 && m.marketCapCr >= 500, "best small cap stocks by score", "NSE companies ranked 251st or lower by market value, worth ₹500 crore or more, ranked by our overall score"),
  index("nifty-50-stocks", "Nifty 50 stocks", "Nifty 50", "Nifty 50 stocks list", "the 50 largest and most traded companies on NSE, the market's main index"),
  index("nifty-next-50-stocks", "Nifty Next 50 stocks", "Nifty Next 50", "Nifty Next 50 stocks list", "the 50 companies that come after the Nifty 50 by size"),
  index("nifty-bank-stocks", "Nifty Bank stocks", "Nifty Bank", "Nifty Bank stocks list", "the largest and most traded banks on NSE"),
  index("nifty-midcap-150-stocks", "Nifty Midcap 150 stocks", "Nifty Midcap 150", "Nifty Midcap 150 stocks list", "the 150 mid-sized companies NSE ranks after the largest 100"),
  index("nifty-smallcap-250-stocks", "Nifty Smallcap 250 stocks", "Nifty Smallcap 250", "Nifty Smallcap 250 stocks list", "the 250 smaller companies NSE ranks after the largest 250"),
  index("nifty-500-stocks", "Nifty 500 stocks", "Nifty 500", "Nifty 500 stocks list", "NSE's 500 largest companies, about nine tenths of the market's value"),
  theme("defence-stocks", "Defence stocks", "Defence", "defence stocks India", "the companies in NSE's Nifty India Defence index: defence equipment, shipbuilding, aerospace and their suppliers"),
  theme("railway-psu-stocks", "Railway PSU stocks", "Railways PSU", "railway PSU stocks", "the government-owned railway companies in NSE's Nifty India Railways PSU index"),
  theme("ev-stocks", "EV and new-age auto stocks", "EV and new-age auto", "EV stocks India", "the companies in NSE's Nifty EV & New Age Automotive index: electric vehicles, batteries, charging and their parts"),
  theme("psu-bank-stocks", "PSU bank stocks", "PSU banks", "PSU bank stocks list", "the government-owned banks in NSE's Nifty PSU Bank index"),
  theme("energy-stocks", "Energy stocks", "Energy", "energy stocks India", "the companies in NSE's Nifty Energy index: oil and gas, power and coal"),
  theme("digital-stocks", "Digital India stocks", "Digital", "digital stocks India", "the companies in NSE's Nifty India Digital index: software, internet and telecom"),
  theme("capital-market-stocks", "Capital market stocks", "Capital markets", "capital market stocks India", "the companies in NSE's Nifty Capital Markets index: exchanges, brokers, depositories and fund houses"),
  theme("housing-stocks", "Housing stocks", "Housing", "housing stocks India", "the companies in NSE's Nifty Housing index: builders, home loans, cement, paints and home goods"),
  theme("manufacturing-stocks", "Manufacturing stocks", "Manufacturing", "manufacturing stocks India", "the companies in NSE's Nifty India Manufacturing index"),
  theme("tourism-stocks", "Tourism stocks", "Tourism", "tourism stocks India", "the companies in NSE's Nifty India Tourism index: hotels, airlines and travel"),
  theme("healthcare-stocks", "Healthcare stocks", "Healthcare", "healthcare stocks India", "the companies in NSE's Nifty Healthcare index: drug makers, hospitals and diagnostics"),
  rule("stocks-under-50", "Stocks under ₹50", m => m.cmp < 50 && m.marketCapCr >= 100, "stocks under 50 rupees", "NSE companies whose share closed under ₹50, worth ₹100 crore or more"),
  rule("stocks-under-100", "Stocks under ₹100", m => m.cmp < 100 && m.marketCapCr >= 100, "stocks under 100 rupees", "NSE companies whose share closed under ₹100, worth ₹100 crore or more"),
  rule("stocks-under-500", "Stocks under ₹500", m => m.cmp < 500 && m.marketCapCr >= 500, "stocks under 500 rupees", "NSE companies whose share closed under ₹500, worth ₹500 crore or more"),
  rule("debt-free-stocks", "Debt-free stocks", m => !m.lender && m.debtToEquity != null && m.debtToEquity <= 0.05 && m.marketCapCr >= 500, "debt free stocks India", "NSE companies (not banks or lenders) with no debt or almost none — debt under 5% of shareholders' equity in their latest balance sheet — worth ₹500 crore or more"),
  rule("high-dividend-yield-stocks", "High dividend yield stocks", m => m.divYield >= 3 && m.marketCapCr >= 500, "high dividend yield stocks India", "NSE companies whose dividends of the last year come to 3% or more of the share price, worth ₹500 crore or more", { label: "Dividend yield", get: m => (m.divYield != null ? `${num(m.divYield, 1)}%` : "—") }, (a, b) => b.divYield - a.divYield),
  rule("low-pe-stocks", "Low P/E stocks", m => m.pe > 0 && m.pe < 12 && m.marketCapCr >= 1000, "low PE stocks India", "profitable NSE companies valued at under 12 times their earnings, worth ₹1,000 crore or more — a low P/E can mean cheap, or a business the market expects to shrink"),
  rule("52-week-high-stocks", "Stocks at a 52-week high", m => m.high52w > 0 && m.cmp >= m.high52w * 0.98 && m.marketCapCr >= 500, "52 week high stocks NSE", "NSE companies that closed within 2% of their highest price of the past year, worth ₹500 crore or more", { label: "52-week high", get: m => `₹${num(m.high52w, 2)}` }, byCap),
  // (6 Nov 2026, more) SEBI's size bands: the largest 100 by market value,
  // the next 150, then the rest
  rule("large-cap-stocks", "Large cap stocks", (m, c) => c.rank(m) <= 100, "large cap stocks India", "the 100 largest NSE companies by market value — SEBI's definition of a large cap", { label: "Size rank", get: (m, c) => `#${c.rank(m)}` }, byCap),
  rule("mid-cap-stocks", "Mid cap stocks", (m, c) => c.rank(m) > 100 && c.rank(m) <= 250, "mid cap stocks India", "NSE companies ranked 101st to 250th by market value — SEBI's definition of a mid cap", { label: "Size rank", get: (m, c) => `#${c.rank(m)}` }, byCap),
  rule("small-cap-stocks", "Small cap stocks", (m, c) => c.rank(m) > 250 && m.marketCapCr >= 500, "small cap stocks India", "NSE companies ranked 251st or lower by market value — SEBI's definition of a small cap — worth ₹500 crore or more", { label: "Size rank", get: (m, c) => `#${c.rank(m)}` }, byCap),
  rule("high-roe-stocks", "High ROE stocks", m => m.roe >= 20 && m.marketCapCr >= 1000, "high ROE stocks India", "NSE companies earning 20% or more on their shareholders' equity in the latest year, worth ₹1,000 crore or more", { label: "ROE", get: m => `${num(m.roe, 1)}%` }, (a, b) => b.roe - a.roe),
  rule("high-roce-stocks", "High ROCE stocks", m => !m.lender && m.roce >= 25 && m.marketCapCr >= 1000, "high ROCE stocks India", "NSE companies (not banks or lenders) earning 25% or more on all the capital they use, worth ₹1,000 crore or more", { label: "ROCE", get: m => `${num(m.roce, 1)}%` }, (a, b) => b.roce - a.roce),
  rule("high-promoter-holding-stocks", "High promoter holding stocks", m => m.promoterPct >= 70 && m.marketCapCr >= 500, "high promoter holding stocks", "NSE companies whose founders or parent (the promoters) own 70% or more, worth ₹500 crore or more", { label: "Promoters own", get: m => `${num(m.promoterPct, 1)}%` }, (a, b) => b.promoterPct - a.promoterPct),
  rule("piotroski-score-stocks", "Piotroski score 8 and 9 stocks", m => m.piotroski >= 8 && m.marketCapCr >= 500, "Piotroski score stocks India", "NSE companies passing 8 or all 9 of Piotroski's checks of financial strength in their latest results, worth ₹500 crore or more", { label: "Piotroski", get: m => `${m.piotroski}/9` }),
  rule("penny-stocks", "Penny stocks under ₹10", m => m.cmp < 10 && m.marketCapCr >= 50, "penny stocks India", "NSE companies whose share closed under ₹10, worth ₹50 crore or more — shares this cheap are often small, thinly traded and can swing hard"),
  // (6 Nov 2026, more again) NSE's own flags and ownership, growth and cash
  rule("psu-stocks", "PSU stocks", m => m.governmentOwned === true, "PSU stocks list India", "NSE companies the government owns: half or more of the shares held by the central or a state government, or in NSE's PSE index", null, byCap),
  rule("fno-stocks", "F&O stocks", m => m.fno === true, "F&O stocks list NSE", "the NSE companies with futures and options traded on them — NSE's own F&O list", null, byCap),
  rule("high-fii-holding-stocks", "High FII holding stocks", m => m.fiiPct >= 30 && m.marketCapCr >= 1000, "high FII holding stocks India", "NSE companies where foreign institutions own 30% or more, worth ₹1,000 crore or more", { label: "FIIs own", get: m => `${num(m.fiiPct, 1)}%` }, (a, b) => b.fiiPct - a.fiiPct),
  rule("high-mutual-fund-holding-stocks", "High mutual fund and DII holding stocks", m => m.diiPct >= 25 && m.marketCapCr >= 1000, "mutual fund holding stocks India", "NSE companies where Indian institutions — mutual funds, insurers and banks — own 25% or more, worth ₹1,000 crore or more", { label: "DIIs own", get: m => `${num(m.diiPct, 1)}%` }, (a, b) => b.diiPct - a.diiPct),
  rule("profit-growth-stocks", "Fast profit growth stocks", m => m.profitGrowth3y >= 25 && m.marketCapCr >= 1000, "high profit growth stocks India", "NSE companies whose profit grew 25% a year or faster over the last three years, worth ₹1,000 crore or more", { label: "Profit growth, 3 years", get: m => `${num(m.profitGrowth3y, 1)}% a year` }, (a, b) => b.profitGrowth3y - a.profitGrowth3y),
  rule("sales-growth-stocks", "Fast sales growth stocks", m => m.salesGrowth3y >= 20 && m.marketCapCr >= 1000, "high sales growth stocks India", "NSE companies whose sales grew 20% a year or faster over the last three years, worth ₹1,000 crore or more", { label: "Sales growth, 3 years", get: m => `${num(m.salesGrowth3y, 1)}% a year` }, (a, b) => b.salesGrowth3y - a.salesGrowth3y),
  rule("cash-rich-stocks", "Cash-rich stocks", m => !m.lender && m.netDebtCr < 0 && -m.netDebtCr >= 0.15 * m.marketCapCr && m.marketCapCr >= 500, "cash rich companies India", "NSE companies (not banks or lenders) holding more cash and liquid investments than all their debt, the surplus 15% or more of their market value, worth ₹500 crore or more", { label: "Net cash", get: m => crore(-m.netDebtCr) }, (a, b) => (-b.netDebtCr / b.marketCapCr) - (-a.netDebtCr / a.marketCapCr)),
  rule("52-week-low-stocks", "Stocks at a 52-week low", m => m.low52w > 0 && m.cmp <= m.low52w * 1.02 && m.marketCapCr >= 500, "52 week low stocks NSE", "NSE companies that closed within 2% of their lowest price of the past year, worth ₹500 crore or more", { label: "52-week low", get: m => `₹${num(m.low52w, 2)}` }, byCap),
];

// A list's companies at the last close, in its order; null if it isn't known
// each company's place by market value, for the size bands
// (worked out once per market build)
let ranks = null;
function sizeRanks() {
  const market = allMetrics();
  if (ranks?.market === market) return ranks;
  const order = (market.rows ?? []).filter(listed).sort(byCap);
  const map = new Map(order.map((m, i) => [m.symbol, i + 1]));
  ranks = { market, rank: m => map.get(m.symbol) ?? Infinity };
  return ranks;
}
function members(def) {
  const rows = (allMetrics().rows ?? []).filter(listed);
  const c = sizeRanks();
  if (def.kind === "rule") return rows.filter(m => { try { return def.test(m, c); } catch { return false; } }).sort(def.order);
  const symbols = def.from(loadMarketSnapshot());
  if (!symbols?.length) return null;
  const set = new Set(symbols);
  return rows.filter(m => set.has(m.symbol)).sort(byCap);
}

// an index's members we have no figures for (HDFCLIFE and SBILIFE in the
// Nifty 50, 6 Nov 2026): said on the page, never quietly dropped
function missing(def, list) {
  if (def.kind === "rule") return [];
  const have = new Set(list.map(m => m.symbol));
  return (def.from(loadMarketSnapshot()) ?? []).filter(s => !have.has(s));
}

export function publicLists() {
  return LISTS.map(def => ({ def, list: members(def) })).filter(x => x.list && x.list.length >= MIN);
}
export const LIST_PAGE_PATHS = () => ["/lists", ...publicLists().map(x => `/lists/${x.def.slug}`)];

const KIND = { score: "Highest scores", index: "NSE indices", theme: "Themes", rule: "Price and filters" };
const kindOf = def => def.group ?? def.kind;

export function listsIndexHtml(template) {
  const all = publicLists();
  const pricesDate = loadMarketSnapshot()?.pricesDate ?? null;
  const canonical = `${SITE}/lists`;
  const title = LISTS_TITLE;
  const desc = `${all.length} lists of NSE companies at the ${day(pricesDate) ?? "latest"} close: each index's companies, NSE's themes such as defence and railway PSUs, stocks under ₹50, ₹100 and ₹500, debt-free companies, high dividend yields and 52-week highs and lows.`;
  const groups = Object.entries(KIND).map(([k, label]) => {
    const items = all.filter(x => kindOf(x.def) === k);
    return items.length ? `<h2>${esc(label)}</h2><ul>${items.map(x => `<li>${link(`/lists/${x.def.slug}`, x.def.name)} — ${x.list.length} companies</li>`).join("")}</ul>` : "";
  }).join("");
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "NSE stock lists", itemListElement: all.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.def.name, url: `${SITE}/lists/${x.def.slug}` })) };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Lists</p><h1>NSE stock lists</h1>${updatedLine()}<p>${esc(desc)}</p>${groups}<p>${link("/screens", "Stock screens")} · ${link("/sectors", "Sectors")} · ${link("/results-calendar", "Results calendar")} · ${link("/methodology", "How the quality score works")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body: body + listData("lists", "lists", publicListsData()) });
}

export function listPageHtml(template, slug) {
  const def = LISTS.find(d => d.slug === slug);
  const list = def ? members(def) : null;
  if (!def || !list || list.length < MIN) return null;
  const pricesDate = loadMarketSnapshot()?.pricesDate ?? null;
  const when = day(pricesDate) ?? "latest";
  const canonical = `${SITE}/lists/${slug}`;
  const scored = list.filter(m => quality(m) != null);
  const best = [...scored].sort(byQuality).slice(0, 5);
  const medPe = median(list.map(m => (m.pe > 0 ? m.pe : null)));
  const medRoe = median(list.map(m => m.roe));
  const total = list.reduce((t, m) => t + (m.marketCapCr ?? 0), 0);
  const gone = missing(def, list);
  const title = listTitle({ name: def.name, kind: def.kind, count: list.length, group: def.group });
  const desc = `${def.name} at the ${when} close: ${list.length} companies, ${def.about}. Each with its price, market value, P/E, return on equity, debt and quality score.`;
  const intro = [
    `${list.length} companies: ${def.about}. Together they're worth ${crore(total)}.`,
    medPe ? `The middle P/E among them is ${num(medPe)}${medRoe != null ? ` and the middle return on equity ${num(medRoe)}%` : ""}.` : "",
    best.length && def.order !== byOverall ? `By quality score from their own filings, the highest are ${best.map(m => `${niceName(m.name)} (${Math.round(quality(m))})`).join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  const order = def.order === byOverall ? "highest overall score first" : def.kind === "rule" ? (def.order === byCap ? "largest first" : def.extra && def.order !== byQuality ? `by ${def.extra.label.toLowerCase()}, highest first` : "highest quality score first") : "largest first";
  const cell = (v, f) => (v == null ? "—" : f(v));
  const shown = list.slice(0, SHOWN);
  const rows = shown.map((m, i) => `<tr><td>${i + 1}</td><td>${link(`/stock/${encodeURIComponent(m.symbol)}`, niceName(m.name))} <small>${esc(m.symbol)}</small></td><td>₹${esc(num(m.cmp, 2))}</td><td>${esc(crore(m.marketCapCr) ?? "—")}</td>${def.extra ? `<td>${esc(def.extra.get(m, sizeRanks()))}</td>` : ""}<td>${cell(m.pe > 0 ? m.pe : null, v => esc(num(v)))}</td><td>${cell(m.roe, v => `${esc(num(v))}%`)}</td><td>${cell(m.lender ? null : m.debtToEquity, v => esc(num(v, 2)))}</td><td>${cell(quality(m), v => `${Math.round(v)}/100`)}</td></tr>`).join("");
  const others = publicLists().filter(x => kindOf(x.def) === kindOf(def) && x.def.slug !== slug).slice(0, 8);
  const source = def.kind === "rule"
    ? `The list is a plain rule on reported figures at the last close: ${def.about}. It changes with every close.`
    : `The companies are NSE's own list for this index, from niftyindices.com; NSE reviews its indices twice a year.`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "ItemList", name: def.name, numberOfItems: list.length, itemListElement: shown.slice(0, 100).map((m, i) => ({ "@type": "ListItem", position: i + 1, name: niceName(m.name), url: `${SITE}/stock/${encodeURIComponent(m.symbol)}` })) },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Jocular Insights", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Lists", item: `${SITE}/lists` }, { "@type": "ListItem", position: 3, name: def.name, item: canonical }] },
    ],
  };
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › ${link("/lists", "Lists")} › ${esc(def.name)}</p>
<h1>${esc(def.name)}</h1>${updatedLine()}
<p>${esc(intro)}</p>
<h2>${list.length > SHOWN ? `The ${SHOWN} ${order === "largest first" ? "largest" : "highest-scoring"} of ${list.length}` : `All ${list.length}`}, ${esc(order)}</h2>
<table><thead><tr><th>#</th><th>Company</th><th>Price</th><th>Market cap</th>${def.extra ? `<th>${esc(def.extra.label)}</th>` : ""}<th>P/E</th><th>ROE</th><th>Debt/equity</th><th>Quality</th></tr></thead><tbody>${rows}</tbody></table>
${gone.length ? `<p>Also in this index, but not covered here yet: ${esc(gone.join(", "))}.</p>` : ""}
${def.order === byOverall ? `<p>${esc(OVERALL_METHOD)} ${link("/methodology", "How the scores work")}.</p>` : ""}
<p>${esc(source)} Prices are NSE's closing prices of ${esc(when)}. ${esc(NOT_ADVICE)}</p>
${others.length ? `<h2>More lists</h2><ul>${others.map(x => `<li>${link(`/lists/${x.def.slug}`, x.def.name)} — ${x.list.length} companies</li>`).join("")}</ul>` : ""}
<p>${link("/lists", "All lists")} · ${link("/screens", "Stock screens")} · ${link("/sectors", "Sectors")} · ${link("/methodology", "How the quality score works")} · ${link("/disclaimer", "Disclaimer")}</p></main>`;
  return pageHtml(template, { title, desc, canonical, ld, body: body + listData("list", slug, publicListData(slug)), image: ogCard("lists", slug) });
}

// The same lists for the app (PublicLists.jsx: ListsIndexPage, ListPage),
// through /api/public/lists and /api/public/lists/<slug>
const row = m => ({ symbol: m.symbol, name: niceName(m.name), price: m.cmp ?? null, marketCapCr: m.marketCapCr ?? null, pe: m.pe > 0 ? m.pe : null, roe: m.roe ?? null, debtToEquity: m.lender ? null : m.debtToEquity ?? null, quality: quality(m), overall: overall(m) });
export function publicListsData() {
  return {
    pricesDate: loadMarketSnapshot()?.pricesDate ?? null, builtAt: loadMarketSnapshot()?.builtAt ?? null,
    groups: Object.entries(KIND).map(([kind, label]) => ({ kind, label, lists: publicLists().filter(x => kindOf(x.def) === kind).map(x => ({ slug: x.def.slug, name: x.def.name, count: x.list.length })) })).filter(g => g.lists.length),
  };
}
export function publicListData(slug) {
  const def = LISTS.find(d => d.slug === slug);
  const list = def ? members(def) : null;
  if (!def || !list || list.length < MIN) return null;
  const best = list.filter(m => quality(m) != null).sort(byQuality).slice(0, 5);
  return {
    slug, name: def.name, kind: def.kind, group: def.group ?? null, about: def.about, pricesDate: loadMarketSnapshot()?.pricesDate ?? null, builtAt: loadMarketSnapshot()?.builtAt ?? null,
    count: list.length, totalMarketCapCr: list.reduce((t, m) => t + (m.marketCapCr ?? 0), 0),
    medianPe: median(list.map(m => (m.pe > 0 ? m.pe : null))), medianRoe: median(list.map(m => m.roe)),
    best: best.map(m => ({ symbol: m.symbol, name: niceName(m.name), quality: quality(m) })),
    extraLabel: def.extra?.label ?? null, missing: missing(def, list),
    companies: list.slice(0, SHOWN).map(m => ({ ...row(m), ...(def.extra ? { extra: def.extra.get(m, sizeRanks()) } : {}) })),
    method: def.order === byOverall ? OVERALL_METHOD : null,
    others: publicLists().filter(x => kindOf(x.def) === kindOf(def) && x.def.slug !== slug).slice(0, 8).map(x => ({ slug: x.def.slug, name: x.def.name, count: x.list.length })),
  };
}
