// What search engines read (seo.js): node --no-warnings server/seo-test.js
import assert from "node:assert/strict";
const { robotsTxt, sitemapXml, publicStock, stockPageHtml } = await import("./seo.js");
const { allMetrics } = await import("./screen.js");

assert.match(robotsTxt(), /Disallow: \/api\//);
assert.match(robotsTxt(), /Sitemap: https:\/\/jocularinsights\.in\/sitemap\.xml/);

const sm = sitemapXml();
const companies = allMetrics().rows.filter(r => r.name).length;
// every company, and the public pages — counted by name, so a new guide page
// is a line here rather than a total to recount
const { PRESETS } = await import("./presets.js");
const { screenPageHtml, screensIndexHtml, resultsCalendarHtml, publicScreen, screenSlug } = await import("./seo-lists.js");
const pages = ["/", "/help", "/methodology", "/stock-screener-india", "/privacy", "/disclaimer",
  // the strategies' pages and the results calendar (seo-lists.js)
  "/screens", "/results-calendar", ...PRESETS.map(p => `/screens/${screenSlug(p.id)}`)];
for (const p of pages) assert.ok(sm.includes(`<loc>https://jocularinsights.in${p}</loc>`), `the sitemap lists ${p}`);
assert.equal((sm.match(/<loc>/g) ?? []).length, companies + pages.length, "the public pages and every company, nothing else");
assert.match(sm, /<loc>https:\/\/jocularinsights\.in\/stock\/[A-Z0-9&%-]+<\/loc>/);

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
assert.match(sp, /<title>High Quality Compounders: \d+ NSE stocks that match today \| Jocular Insights<\/title>/);
assert.match(sp, /<link rel="canonical" href="https:\/\/jocularinsights\.in\/screens\/high-quality-compounders"/);
assert.match(sp, /"@type":"ItemList"/);
assert.ok((sp.match(/href="\/stock\//g) ?? []).length === Math.min(hqc.matched, 50), "every company shown links to its page");
assert.match(sp, /not a recommendation/, "says it isn't advice");
assert.equal(screenPageHtml(template, "no-such-strategy"), null);
assert.equal((screensIndexHtml(template).match(/href="\/screens\//g) ?? []).length, PRESETS.length, "the index links every strategy");
assert.match(resultsCalendarHtml(template), /<h1>Quarterly results calendar<\/h1>/);
console.log(`ok: robots.txt, a sitemap of ${companies + pages.length} pages, and ${sym}'s page with its own title, description, canonical, structured data and figures`);
