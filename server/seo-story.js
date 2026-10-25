// What a company's public page says in words, and the sector pages (25 Oct
// 2026, the SEO audit: 2,264 stock pages of ~130 words each read as one
// template, and linked to no other company). Built from the same data as the
// app, facts only — scores, ratios, ranks among the company's sector, its
// growth, its results date, its peers and the screens it passes — never the
// fair value or anything that says what to do. The server writes it into the
// page (seo.js) and the app shows the same words to anyone signed out
// (PublicStock.jsx, SectorPage in PublicLists.jsx), so what Google indexes
// and what people read agree.
import { allMetrics, screen } from "./screen.js";
import { PRESETS } from "./presets.js";
import { peerKey } from "./sector-compare.js";
import { loadMarketSnapshot } from "./market-data.js";
import { niceName } from "../src/stockName.js";

const SITE_SCREEN_SLUG = id => String(id).replace(/_/g, "-");
export const sectorSlug = name => String(name ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const median = list => { const v = list.filter(x => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const f1 = v => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const f2 = v => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const dayText = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const quality = m => m.research?.quality ?? null;
// "Infosys'", "TCS's"
const poss = n => (/s$/i.test(n) && !/ss$/i.test(n) ? `${n}'` : `${n}'s`);
const mini = m => ({ symbol: m.symbol, name: niceName(m.name), price: m.cmp ?? null, marketCapCr: m.marketCapCr ?? null, pe: m.pe > 0 ? m.pe : null, roe: m.roe ?? null, roce: m.lender ? null : m.roce ?? null, debtToEquity: m.lender ? null : m.debtToEquity ?? null, quality: quality(m) });

// Worked out once per market build: the companies by sector, everyone's
// quality in order, and which screens each company passes
let ctx = null;
function context() {
  const market = allMetrics();
  if (ctx?.market === market) return ctx;
  const rows = (market.rows ?? []).filter(r => r.name);
  const bySector = new Map(), byPeers = new Map();
  for (const r of rows) {
    if (r.sector) (bySector.get(r.sector) ?? bySector.set(r.sector, []).get(r.sector)).push(r);
    const k = peerKey(r);
    if (k) (byPeers.get(k) ?? byPeers.set(k, []).get(k)).push(r);
  }
  const qualities = rows.map(quality).filter(q => q != null).sort((a, b) => a - b);
  const screens = new Map();
  for (const p of PRESETS) {
    let res;
    try { res = screen(p.filters ? { filters: p.filters, sort: p.sort } : p.criteria); } catch { continue; }
    for (const r of res.results ?? []) (screens.get(r.symbol) ?? screens.set(r.symbol, []).get(r.symbol)).push({ slug: SITE_SCREEN_SLUG(p.id), name: p.name });
  }
  ctx = { market, rows, bySector, byPeers, qualities, screens };
  return ctx;
}

// The share of scored companies a score beats
const beats = (q, all) => (q == null || !all.length ? null : Math.round((all.filter(x => x < q).length / all.length) * 100));

export function stockStory(symbol) {
  const c = context();
  const m = c.rows.find(r => r.symbol === symbol);
  if (!m) return null;
  const n = niceName(m.name);
  const sectorName = m.sector ?? null;
  const peersAll = (c.byPeers.get(peerKey(m)) ?? []).filter(r => r.symbol !== m.symbol);
  // the closest in size, either side
  const peers = [...peersAll].sort((a, b) => Math.abs(Math.log((a.marketCapCr || 1) / (m.marketCapCr || 1))) - Math.abs(Math.log((b.marketCapCr || 1) / (m.marketCapCr || 1)))).slice(0, 6)
    .sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).map(mini);
  const group = [m, ...peersAll];
  const sectorPe = median(group.map(r => (r.pe > 0 ? r.pe : null)));
  const sectorRoe = median(group.map(r => r.roe));
  const q = quality(m);
  const sentences = [];
  if (q != null) {
    const b = beats(q, c.qualities);
    sentences.push(`${n} has a quality score of ${Math.round(q)} out of 100 from its own filings, higher than ${b}% of the ${c.qualities.length.toLocaleString("en-IN")} NSE companies scored.`);
  }
  if (m.roe != null && sectorName) {
    const ranked = group.filter(r => r.roe != null).sort((a, b) => b.roe - a.roe);
    const rank = ranked.findIndex(r => r.symbol === m.symbol) + 1;
    if (ranked.length >= 5 && rank > 0 && rank <= 3) sentences.push(`Its return on equity of ${f1(m.roe)}% is the ${rank === 1 ? "highest" : `${ord(rank)} highest`} of the ${ranked.length} listed ${sectorName} companies with the figure.`);
    else if (ranked.length >= 5 && sectorRoe != null) sentences.push(`Its return on equity is ${f1(m.roe)}%, ${m.roe >= sectorRoe ? "above" : "below"} the ${sectorName} median of ${f1(sectorRoe)}%.`);
    else sentences.push(`Its return on equity is ${f1(m.roe)}%.`);
  }
  if (m.lender) sentences.push(`As a lender it borrows to lend, so debt to equity isn't compared here.`);
  else if (m.debtToEquity != null) sentences.push(m.debtToEquity < 0.05 ? `It has almost no borrowings (debt to equity ${f2(m.debtToEquity)}).` : `Its borrowings are ${f2(m.debtToEquity)} times its shareholders' equity.`);

  // five years in words: growth a year, and which way the margin went
  const hist = (m.history ?? []).filter(h => h.revenueCr > 0);
  const first = hist[Math.min(hist.length - 1, 5)], last = hist[0];
  const trendParts = [
    m.salesGrowth5y != null ? `sales grew ${f1(m.salesGrowth5y)}% a year over five years` : m.salesGrowth3y != null ? `sales grew ${f1(m.salesGrowth3y)}% a year over three years` : null,
    m.profitGrowth5y != null ? `profit ${m.profitGrowth5y >= 0 ? "grew" : "fell"} ${f1(Math.abs(m.profitGrowth5y))}% a year` : m.profitGrowth3y != null ? `profit ${m.profitGrowth3y >= 0 ? "grew" : "fell"} ${f1(Math.abs(m.profitGrowth3y))}% a year over three years` : null,
    !m.lender && first && last && first !== last && first.opm != null && last.opm != null ? `the operating margin went from ${f1(first.opm)}% in FY${first.fyEnd.slice(2, 4)} to ${f1(last.opm)}% in FY${last.fyEnd.slice(2, 4)}` : null,
  ].filter(Boolean).map(s => s.replace("sales grew -", "sales fell "));
  const trend = trendParts.length ? `${trendParts[0].charAt(0).toUpperCase()}${trendParts[0].slice(1)}${trendParts.length > 1 ? `; ${trendParts.slice(1).join("; ")}` : ""}.` : null;

  const screens = c.screens.get(m.symbol) ?? [];
  const latestFiled = m.quarters?.[0]?.filed ?? null;
  const qa = [
    m.pe > 0 && { q: `What is ${poss(n)} P/E ratio?`, a: `${f1(m.pe)} at the ${dayText(loadMarketSnapshot()?.pricesDate) ?? "latest"} close${sectorPe && sectorName && group.length >= 5 ? `, against a median of ${f1(sectorPe)} for listed ${sectorName} companies` : ""}.` },
    !m.lender && m.debtToEquity != null && { q: `Is ${n} debt-free?`, a: m.debtToEquity < 0.01 ? `Yes — its latest balance sheet shows no meaningful borrowings.` : m.debtToEquity < 0.05 ? `Almost: its debt is only ${f2(m.debtToEquity)} times its equity in the latest balance sheet.` : `No. Its debt is ${f2(m.debtToEquity)} times its equity in the latest balance sheet.` },
    { q: `When are ${poss(n)} next results?`, a: m.nextResults ? `Its board meets to approve results on ${dayText(m.nextResults)}, as told to NSE.` : `No results date has been announced to NSE yet${latestFiled ? `; its latest results were filed on ${dayText(latestFiled)}` : ""}.` },
    q != null && { q: `What is ${poss(n)} quality score?`, a: `${Math.round(q)} out of 100, from checks on its business, earnings, balance sheet, governance, growth and valuation in its own filings. The methodology explains each check.` },
    { q: `Does ${n} pay dividends?`, a: m.divYield > 0 ? `Yes. Its dividends over the last year come to a ${f2(m.divYield)}% yield at the latest close.` : `It has paid no dividend in the last year.` },
  ].filter(Boolean);

  // a page with nothing to say is better left out of search (the SEO audit)
  const sparse = !m.quarters?.length && !(m.history?.length) && q == null;
  return {
    sector: sectorName ? { name: sectorName, slug: sectorSlug(sectorName) } : null,
    summary: sentences, trend, peers, screens, qa, sparse,
    sectorMedians: { pe: sectorPe, roe: sectorRoe, companies: group.length },
  };
}

// ── Sector pages: /sectors and /sector/<slug> ───────────────────────────────
export function publicSectors() {
  const c = context();
  return {
    pricesDate: loadMarketSnapshot()?.pricesDate ?? null,
    sectors: [...c.bySector].map(([name, list]) => ({ name, slug: sectorSlug(name), count: list.length, largest: [...list].sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).slice(0, 3).map(r => ({ symbol: r.symbol, name: niceName(r.name) })) }))
      .sort((a, b) => b.count - a.count),
  };
}

export function publicSector(slug) {
  const c = context();
  const entry = [...c.bySector].find(([name]) => sectorSlug(name) === slug);
  if (!entry) return null;
  const [name, list] = entry;
  const companies = [...list].sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0)).map(mini);
  const best = [...list].filter(r => quality(r) != null).sort((a, b) => quality(b) - quality(a)).slice(0, 5).map(r => ({ symbol: r.symbol, name: niceName(r.name), quality: quality(r) }));
  // the screens most of its companies pass
  const counts = new Map();
  for (const r of list) for (const s of c.screens.get(r.symbol) ?? []) counts.set(s.slug, { ...s, count: (counts.get(s.slug)?.count ?? 0) + 1 });
  return {
    name, slug, pricesDate: loadMarketSnapshot()?.pricesDate ?? null, count: list.length,
    medianPe: median(list.map(r => (r.pe > 0 ? r.pe : null))), medianRoe: median(list.map(r => r.roe)),
    medianRoce: median(list.filter(r => !r.lender).map(r => r.roce)),
    totalMarketCapCr: list.reduce((t, r) => t + (r.marketCapCr ?? 0), 0),
    best, companies, screens: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4),
  };
}
export const SECTOR_PATHS = () => ["/sectors", ...publicSectors().sectors.map(s => `/sector/${s.slug}`)];
