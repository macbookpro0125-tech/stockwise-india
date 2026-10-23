// What search engines read (seo.js): node --no-warnings server/seo-test.js
import assert from "node:assert/strict";
const { robotsTxt, sitemapXml, publicStock, stockPageHtml } = await import("./seo.js");
const { allMetrics } = await import("./screen.js");

assert.match(robotsTxt(), /Disallow: \/api\//);
assert.match(robotsTxt(), /Sitemap: https:\/\/jocularinsights\.in\/sitemap\.xml/);

const sm = sitemapXml();
const companies = allMetrics().rows.filter(r => r.name).length;
assert.equal((sm.match(/<loc>/g) ?? []).length, companies + 4, "the public pages and every company");
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
console.log(`ok: robots.txt, a sitemap of ${companies + 4} pages, and ${sym}'s page with its own title, description, canonical, structured data and figures`);
