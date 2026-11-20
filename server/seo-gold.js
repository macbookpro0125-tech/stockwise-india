// /gold-silver for search engines (20 Nov 2026): the gold and silver ETFs and
// every Sovereign Gold Bond series at NSE's latest prices, with the data the
// app's page draws from (gold-silver.js) written in, as the other public pages
import { SITE, esc, num, pageHtml, listData } from "./seo.js";
import { goldSilver } from "./gold-silver.js";
import { GOLD_TITLE } from "../src/pageTitle.js";

const link = (path, text) => `<a href="${esc(path)}">${esc(text)}</a>`;
const rs = v => (v == null ? "—" : `₹${esc(num(v, 2))}`);
const pc = v => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${esc(num(Math.abs(v), 1))}%`);

export async function goldSilverHtml(template) {
  let d;
  try { d = await goldSilver(); } catch { d = null; }
  const canonical = `${SITE}/gold-silver`;
  const desc = "Gold and silver ETF prices, NAV and premium on NSE, every Sovereign Gold Bond series with its issue price and maturity, and gold, silver and the Nifty 50 compared over 1 to 10 years. Free, from NSE's data.";
  const etfRows = list => list.map(e => `<tr><td>${esc(e.symbol)}${e.amc ? ` <small>${esc(e.amc)}</small>` : ""}</td><td>${rs(e.price)}</td><td>${pc(e.changePct)}</td><td>${pc(e.premiumPct)}</td><td>${pc(e.ret1y)}</td></tr>`).join("");
  const table = (cap, list) => `<h2>${esc(cap)}</h2><table><thead><tr><th>ETF</th><th>Price</th><th>Day</th><th>Close vs NAV</th><th>1 year</th></tr></thead><tbody>${etfRows(list)}</tbody></table>`;
  const sgb = (d?.sgb ?? []).map(s => `<tr><td>${esc(s.symbol)}</td><td>${esc(s.matures ?? "—")}</td><td>${rs(s.issuePrice)}</td><td>${rs(s.price)}</td><td>${pc(s.sinceIssuePct)}</td></tr>`).join("");
  const body = `<main class="seo-stock seo-methodology"><p>${link("/", "Jocular Insights")} › Gold &amp; silver</p><h1>Gold, silver and ETF prices on NSE</h1>
<p>${esc(desc)}${d?.asOf ? ` Prices from NSE at ${esc(d.asOf)} IST.` : ""}</p>
${d ? table("Gold ETFs", d.groups.gold) + table("Silver ETFs", d.groups.silver) : ""}
${sgb ? `<h2>Sovereign Gold Bonds</h2><p>One bond is one gram of gold. Each pays 2.5% a year on its issue price and is repaid at the price of gold when it matures, eight years after issue.</p><table><thead><tr><th>Series</th><th>Matures</th><th>Issue price</th><th>Price</th><th>Since issue</th></tr></thead><tbody>${sgb}</tbody></table>` : ""}
<p>Source: NSE (its list of ETFs, ETF prices and NAV, Sovereign Gold Bond prices). Prices, not advice: nothing here suggests buying or selling.</p>
<p>${link("/sectors", "Sectors")} · ${link("/lists", "Stock lists")} · ${link("/screens", "Stock screens")}</p></main>`;
  const ld = { "@context": "https://schema.org", "@type": "WebPage", name: GOLD_TITLE, url: canonical, description: desc };
  return pageHtml(template, { title: GOLD_TITLE, desc, canonical, ld, body: body + (d ? listData("gold", "gold", d) : "") });
}
