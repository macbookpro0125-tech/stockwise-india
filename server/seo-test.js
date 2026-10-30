// What search engines read (seo.js): node --no-warnings server/seo-test.js
import assert from "node:assert/strict";
const { robotsTxt, sitemapXml, sitemapPart, publicStock, stockPageHtml, aboutPageHtml, helpPageHtml } = await import("./seo.js");
const { GUIDES, GUIDE_PATHS } = await import("./guides.js");
const { publicSubPage, isSubPagePath } = await import("./seo-pages.js");
const { allMetrics } = await import("./screen.js");

assert.match(robotsTxt(), /Disallow: \/api\//);
assert.match(robotsTxt(), /Sitemap: https:\/\/jocularinsights\.in\/sitemap\.xml/);

// an index of three sitemaps, which together list every page once
const index = sitemapXml();
for (const n of ["pages", "screens", "stocks"]) assert.ok(index.includes(`<loc>https://jocularinsights.in/sitemap-${n}.xml</loc>`), `the index lists sitemap-${n}.xml`);
assert.ok(!/changefreq|priority/.test(index + sitemapPart("stocks")), "no changefreq or priority (Google ignores them)");
assert.equal(sitemapPart("nope"), null);
const sm = ["pages", "screens", "stocks"].map(sitemapPart).join("\n");
const companies = allMetrics().rows.filter(r => r.name).length;
// every company, and the public pages — counted by name, so a new guide page
// is a line here rather than a total to recount
const { PRESETS } = await import("./presets.js");
const { screenPageHtml, screensIndexHtml, resultsCalendarHtml, publicScreen, screenSlug } = await import("./seo-lists.js");
const pages = ["/", "/about", "/help", "/methodology", "/stock-screener-india", "/privacy", "/disclaimer",
  // the strategies' pages and the results calendar (seo-lists.js)
  "/screens", "/results-calendar", ...PRESETS.map(p => `/screens/${screenSlug(p.id)}`),
  // the guides (guides.js, 30 Oct 2026)
  ...GUIDE_PATHS()];
for (const p of pages) assert.ok(sm.includes(`<loc>https://jocularinsights.in${p}</loc>`), `the sitemap lists ${p}`);
assert.equal((sm.match(/<loc>/g) ?? []).length, companies + pages.length, "the public pages and every company, nothing else");
assert.match(sm, /<loc>https:\/\/jocularinsights\.in\/stock\/[A-Z0-9&%-]+<\/loc>/);
// a company's page dated by its latest filing, not today
assert.match(sitemapPart("stocks"), /<loc>[^<]+<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
// what IndexNow is told about: the front page, the calendar and every company, each dated as in the sitemap
{
  const { changedPageEntries } = await import("./seo.js");
  const e = changedPageEntries();
  assert.deepEqual(e.slice(0, 2).map(([p]) => p), ["/", "/results-calendar"]);
  assert.equal(e.length - 2, (sitemapPart("stocks").match(/<loc>/g) ?? []).length);
}
// the front page and /about written into the page
{
  const template = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';
  const { homePageHtml } = await import("./seo-lists.js");
  const home = homePageHtml(template);
  assert.match(home, /<h1>Indian stock market screener/);
  assert.match(home, /<link rel="canonical" href="https:\/\/jocularinsights\.in\/" \/>/);
  assert.ok(home.includes('"@type":"WebApplication"') && home.includes("/screens/high-quality-compounders"), "structured data, and a link to every screen");
  assert.ok(home.replace(/<[^>]+>/g, " ").split(/\s+/).length > 300, "the front page has real words in it");
  assert.match(aboutPageHtml(template), /<h1>About Jocular Insights<\/h1>/);
}
// the sector pages and each company's page in words (seo-story.js)
{
  const template = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';
  const { sectorsIndexHtml, sectorPageHtml } = await import("./seo-lists.js");
  const { stockStory, publicSectors } = await import("./seo-story.js");
  const sectors = publicSectors().sectors;
  assert.ok(sectors.length >= 10, "a page for each sector");
  assert.ok(sitemapPart("sectors").includes(`/sector/${sectors[0].slug}</loc>`) && sitemapXml().includes("sitemap-sectors.xml"), "the sector pages are in the sitemap");
  const page = sectorPageHtml(template, sectors[0].slug);
  assert.ok((page.match(/href="\/stock\//g) ?? []).length >= sectors[0].count, "a sector page links to every company in it");
  assert.equal(sectorPageHtml(template, "no-such-sector"), null);
  assert.match(sectorsIndexHtml(template), /<h1>NSE stocks by sector<\/h1>/);
  const tcs = stockStory("TCS");
  if (tcs) {
    assert.ok(tcs.summary.length >= 2 && tcs.peers.length >= 3 && tcs.qa.length >= 3, "TCS in words, with peers and answers");
    assert.ok(tcs.peers.every(p => p.symbol !== "TCS"), "not its own peer");
    assert.ok(!/fair value|buy|sell/i.test(JSON.stringify(tcs)), "facts only: no fair value, nothing about buying or selling");
    const html = stockPageHtml(template, "TCS");
    assert.ok(html.includes(`href="/sector/${tcs.sector.slug}"`) && !/fair value &amp;/.test(html), "the breadcrumb links its sector; the title doesn't promise a fair value");
  }
}

const sym = allMetrics().rows.find(r => r.name && r.close && r.marketCapCr > 10000)?.symbol;
const s = publicStock(sym);
assert.equal(s.symbol, sym);
assert.equal(publicStock("NOT-A-COMPANY"), null);

const template = `<!doctype html><html><head><title>Jocular Insights — NSE stock screener</title><meta name="description" content="generic" /></head><body><div id="root"></div></body></html>`;
const html = stockPageHtml(template, sym);
assert.equal((html.match(/<title>/g) ?? []).length, 1, "one title, the company's");
assert.match(html, new RegExp(`<title>[^<]*\\| ${sym} \\| Jocular Insights</title>`));
assert.equal((html.match(/<meta name="description"/g) ?? []).length, 1, "one description, the company's");
assert.doesNotMatch(html, /content="generic"/);
assert.match(html, new RegExp(`<link rel="canonical" href="https://jocularinsights.in/stock/${encodeURIComponent(sym)}"`));
assert.match(html, /"@type":"Corporation"/);
assert.match(html, /<div id="root"><main class="seo-stock">[\s\S]*<h1>/, "the summary is in the page itself");
assert.equal(stockPageHtml(template, "NOT-A-COMPANY"), null);
// a company name can't break out of the page
assert.doesNotMatch(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ""), /<script>(?!)/);
// a strategy's page: its own title (short enough for a search result), canonical, rules, and its companies linked
const hqc = publicScreen("high-quality-compounders");
assert.ok(hqc && hqc.rules.length >= 3 && hqc.matched === hqc.companies.length + Math.max(0, hqc.matched - 50), "a strategy: its rules and its companies");
assert.ok(hqc.companies.every((c, i, a) => i === 0 || (a[i - 1].quality ?? -1) >= (c.quality ?? -1)), "the best quality first");
const sp = screenPageHtml(template, "high-quality-compounders");
assert.equal((sp.match(/<title>/g) ?? []).length, 1);
// titled in the words people search for it (screen-guides.js), the name in the heading
assert.match(sp, /<title>High quality stocks India with high ROCE and low debt: \d+ today \| Jocular Insights<\/title>/);
assert.match(sp, /<h1>[^<]*High Quality Compounders<\/h1>/);
assert.match(sp, /<h2>Limitations<\/h2>/);
assert.match(sp, /<link rel="canonical" href="https:\/\/jocularinsights\.in\/screens\/high-quality-compounders"/);
assert.match(sp, /"@type":"ItemList"/);
assert.ok((sp.match(/href="\/stock\//g) ?? []).length === Math.min(hqc.matched, 50), "every company shown links to its page");
assert.match(sp, /not a recommendation/, "says it isn't advice");
assert.equal(screenPageHtml(template, "no-such-strategy"), null);
assert.equal((screensIndexHtml(template).match(/href="\/screens\//g) ?? []).length, PRESETS.length, "the index links every strategy");
assert.match(resultsCalendarHtml(template), /<h1>Quarterly results calendar<\/h1>/);
// the guides and /help, written for search engines in full (30 Oct 2026, AdSense's "more content")
{
  const template = '<html><head><title>x</title></head><body><div id="root"></div></body></html>';
  const words = h => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  assert.ok(words(helpPageHtml(template)) > 400, "/help is written into the page");
  assert.ok(GUIDES.length >= 10 && new Set(GUIDES.map(g => g.slug)).size === GUIDES.length, "ten or more guides, each its own address");
  for (const p of GUIDE_PATHS()) {
    assert.ok(isSubPagePath(p), `${p} is a public page`);
    const page = await publicSubPage(p);
    assert.ok(page && page.canonical === `https://jocularinsights.in${p}` && words(page.body) > 250, `${p} has its own text`);
    for (const [, to] of page.body.matchAll(/href="(\/[^"]*)"/g)) assert.ok(!/undefined|null/.test(to), `${p} links to ${to}`);
  }
  assert.equal(await publicSubPage("/learn/no-such-guide"), null);
}
console.log(`ok: robots.txt, a sitemap of ${companies + pages.length} pages, and ${sym}'s page with its own title, description, canonical, structured data and figures`);

// each screen's guide, and what joined and left since a week ago (seo-lists.js)
{
  const { SCREEN_GUIDES } = await import("./screen-guides.js");
  const { screenChanges, publicScreen } = await import("./seo-lists.js");
  for (const p of PRESETS) assert.ok(SCREEN_GUIDES[p.id]?.search && SCREEN_GUIDES[p.id]?.limits, `${p.id} has a guide`);
  assert.ok(!/\b(buy|sell)\b/i.test(JSON.stringify(SCREEN_GUIDES)), "the guides never say buy or sell");
  const snaps = [
    { presetId: "x", date: "2026-10-10", members: ["A", "B", "C"] },
    { presetId: "x", date: "2026-10-14", members: ["A", "B"] },
    { presetId: "x", date: "2026-10-17", members: ["A", "D"] },
  ];
  const ch = screenChanges("x", ["A", "D", "E"], new Map([["D", "Dee"], ["E", "Ee"]]), snaps);
  assert.equal(ch.since, "2026-10-10", "against the list from six or more days before the latest");
  assert.deepEqual(ch.joined.map(c => c.symbol), ["D", "E"]);
  assert.deepEqual(ch.left.map(c => c.symbol), ["B", "C"]);
  assert.equal(screenChanges("x", ["A"], new Map(), snaps.slice(1)), null, "no list a week old: nothing said");
  assert.equal(publicScreen("high-quality-compounders").guide.search, SCREEN_GUIDES.high_quality_compounders.search);
}
console.log("ok: every screen has its guide; joined and left are worked out against a week ago");

// a company's financials, results and call pages, /explore (seo-pages.js)
{
  const { publicSubPage, isSubPagePath, quarterSlug, fyQuarter, subPagePaths } = await import("./seo-pages.js");
  assert.equal(fyQuarter("2026-09-30"), "Q2 FY27");
  assert.equal(quarterSlug("2026-03-31"), "q4-fy26");
  assert.ok(isSubPagePath("/stock/TCS/financials") && isSubPagePath("/stock/TCS/results/q2-fy27") && isSubPagePath("/news") && !isSubPagePath("/stock/TCS/whatever"));
  const row = allMetrics().rows.find(r => r.name && r.history?.length >= 3 && r.quarters?.length >= 5);
  const fin = await publicSubPage(`/stock/${row.symbol}/financials`);
  assert.ok(fin && /<h1>[^<]+ financial statements<\/h1>/.test(fin.body) && /Profit and loss/.test(fin.body), "a financials page");
  const res = await publicSubPage(`/stock/${row.symbol}/results/${quarterSlug(row.quarters[0].fyEnd)}`);
  assert.ok(res && res.body.includes(fyQuarter(row.quarters[0].fyEnd)), "its latest quarter's results page");
  assert.equal(await publicSubPage(`/stock/${row.symbol}/results/q1-fy01`), null, "a quarter it doesn't have: none");
  const call = await publicSubPage(`/stock/${row.symbol}/earnings-call`);
  assert.ok(call && (call.noindex === true || /Earnings call,/.test(call.body)), "no saved summary: left out of search");
  for (const p of [fin, res, call]) assert.ok(!/\b(null|undefined|NaN)\b/.test(p.body.replace(/<[^>]+>/g, " ")), "no null in the words");
  assert.ok(sitemapXml().includes("sitemap-details.xml") && subPagePaths().some(([p]) => p.endsWith("/financials")), "in the sitemap");
}
// NSE's own classification, only for sector names the index lists use
{
  const { nseClassification } = await import("./market-data.js");
  const known = new Set(["Capital Goods", "Information Technology"]);
  assert.deepEqual(nseClassification({ industryInfo: { macro: "Industrials", sector: "Capital Goods", industry: "Aerospace & Defense", basicIndustry: "Aerospace & Defense" } }, known), { sector: "Capital Goods", basic: "Aerospace & Defense", macro: "Industrials" });
  assert.equal(nseClassification({ industryInfo: { sector: "Something New" } }, known), null, "an unknown name isn't taken");
  assert.equal(nseClassification({}, known), null);
}
console.log("ok: financials, results and call pages; NSE's classification");
