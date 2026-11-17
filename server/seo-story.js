// What a company's public page says in words, and the sector pages (25 Oct
// 2026, the SEO audit: 2,264 stock pages of ~130 words each read as one
// template, and linked to no other company). Built from the same data as the
// app, facts only — scores, ratios, ranks among the company's sector, its
// growth, its results date, its peers and the screens it passes — never the
// fair value or anything that says what to do. The server writes it into the
// page (seo.js) and the app shows the same words to anyone signed out
// (PublicStock.jsx, SectorPage in PublicLists.jsx), so what Google indexes
// and what people read agree.
import { allMetrics, screen, getStock } from "./screen.js";
import { cleanBusiness } from "./business-sectors.js";
import { PRESETS } from "./presets.js";
import { peerKey } from "./sector-compare.js";
import { loadMarketSnapshot } from "./market-data.js";
import { niceName } from "../src/stockName.js";
import { profitGrowth } from "./profit-growth.js";

import { screenSlug as SITE_SCREEN_SLUG } from "./seo-lists.js";
import { listMembership } from "./seo-collections.js";
export const sectorSlug = name => String(name ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const median = list => { const v = list.filter(x => Number.isFinite(x)).sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const f1 = v => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const f2 = v => Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const ord = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const dayText = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const quality = m => m.research?.quality ?? null;
// "Infosys'", "TCS's"
const fyLabel = iso => { const [y, mo] = String(iso).split("-").map(Number); return `Q${mo >= 4 ? Math.ceil((mo - 3) / 3) : 4} FY${String(mo >= 4 ? y + 1 : y).slice(2)}`; };
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
// ── What makes each company's page its own (17 Nov 2026) ─────────────────────
// Google kept few of our company pages: much of each page read the same for
// every company. These three parts say only what is true of this company:
// its filed business lines, the facts that stand out in its own record, and
// its strongest and weakest checks in the words of its research.
const crn = v => `₹${Math.round(v).toLocaleString("en-IN")} crore`;
const fyOf = iso => `FY${String(iso).slice(2, 4)}`;
export function recordSentences(m) {
  const H = (m.history ?? []).filter(h => h.fyEnd).slice(0, 6); // newest first
  if (H.length < 3) return [];
  const span = `${fyOf(H[H.length - 1].fyEnd)} to ${fyOf(H[0].fyEnd)}`;
  const out = [];
  // sales: every year up, or the years it fell
  const sales = H.filter(h => h.revenueCr > 0);
  if (sales.length >= 3) {
    const falls = [];
    for (let i = 0; i < sales.length - 1; i++) { const g = (sales[i].revenueCr / sales[i + 1].revenueCr - 1) * 100; if (g < 0) falls.push([sales[i].fyEnd, g]); }
    if (!falls.length) out.push(`Its sales grew every year from ${fyOf(sales[sales.length - 1].fyEnd)} to ${fyOf(sales[0].fyEnd)}.`);
    else if (falls.length === 1) out.push(`Its sales fell once in that time: ${f1(Math.abs(falls[0][1]))}% in ${fyOf(falls[0][0])}.`);
    else out.push(`Its sales fell in ${falls.length} of the last ${sales.length - 1} years (${falls.map(([y, g]) => `${fyOf(y)} ${f1(g)}%`).join(", ")}).`);
  }
  // losses
  const losses = H.filter(h => h.profitCr < 0);
  if (losses.length) out.push(losses.length === H.length ? `It made a loss in every year from ${span}.` : `It made a loss in ${[...losses].reverse().map(h => fyOf(h.fyEnd)).join(", ")}.`);
  if (!m.lender) {
    // borrowings, when they moved a lot or stayed near nil
    const d0 = H[0].debtCr, d1 = H[H.length - 1].debtCr;
    if (d0 != null && d1 != null) {
      if (H.every(h => (h.debtCr ?? 0) < 50)) out.push(`It has had almost no borrowings in any year from ${span}.`);
      else if (d1 > 0 && Math.abs(d0 / d1 - 1) >= 0.3 && Math.abs(d0 - d1) >= 100) out.push(`Its borrowings went from ${crn(d1)} in ${fyOf(H[H.length - 1].fyEnd)} to ${crn(d0)} in ${fyOf(H[0].fyEnd)}.`);
    }
    // cash against profit, over the years on file
    const both = H.filter(h => h.ocfCr != null && h.profitCr != null);
    const pr = both.reduce((a, h) => a + h.profitCr, 0), oc = both.reduce((a, h) => a + h.ocfCr, 0);
    if (both.length >= 3 && pr > 0) {
      const r = Math.round((oc / pr) * 100);
      out.push(`Over ${both.length} years its cash from operations came to ${r}% of its profit${r >= 90 ? ", so the profit turned into cash" : r >= 60 ? ", most of it turning into cash" : ", well short of it: worth a look at stock and money owed to it"}.`);
    }
  }
  // share count: buybacks or new shares
  const s0 = H[0].sharesCr, s1 = H[H.length - 1].sharesCr;
  if (s0 > 0 && s1 > 0) {
    const ch = (s0 / s1 - 1) * 100;
    if (ch <= -2) out.push(`Its share count fell ${f1(Math.abs(ch))}% from ${span}, as it bought back shares.`);
    else if (ch >= 2) out.push(`Its share count rose ${f1(ch)}% from ${span} as it issued new shares, so each share owns a smaller part.`);
  }
  // dividends paid, as cash out in the cash flow
  const dv = H.filter(h => h.dividendsPaidCr != null);
  if (dv.length >= 3) {
    const paid = dv.filter(h => Math.abs(h.dividendsPaidCr) > 0).length;
    out.push(paid === dv.length ? `It paid dividends in each of the last ${dv.length} years.` : paid === 0 ? `It paid no dividends in the last ${dv.length} years.` : `It paid dividends in ${paid} of the last ${dv.length} years.`);
  }
  return out;
}
export function strengthsAndWatch(m) {
  const items = (m.research?.groups ?? []).filter(g => g.applicable !== false).flatMap(g => g.items ?? []).filter(i => i.score != null && i.reason);
  const strong = items.filter(i => i.score >= 80).sort((a, b) => b.weight - a.weight || b.score - a.score).slice(0, 3).map(i => i.reason);
  const watch = items.filter(i => i.score <= 40).sort((a, b) => a.score - b.score || b.weight - a.weight).slice(0, 3).map(i => i.reason);
  return { strong, watch };
}
export function businessLines(symbol) {
  return cleanBusiness(getStock(symbol)?.business).slice(0, 6);
}

const beats = (q, all) => (q == null || !all.length ? null : Math.round((all.filter(x => x < q).length / all.length) * 100));

export function stockStory(symbol) {
  const c = context();
  const m = c.rows.find(r => r.symbol === symbol);
  if (!m) return null;
  const n = niceName(m.name);
  const sectorName = m.sector ?? null;
  const peersAll = (c.byPeers.get(peerKey(m)) ?? []).filter(r => r.symbol !== m.symbol);
  // the closest in size, either side; from its own industry where that has
  // at least three others (a hotel chain beside hotels, not a burger chain
  // and an online marketplace from the same broad sector)
  const sameIndustry = m.industry ? peersAll.filter(r => r.industry === m.industry) : [];
  const peersIn = sameIndustry.length >= 3 ? m.industry : null;
  const peers = [...(peersIn ? sameIndustry : peersAll)].sort((a, b) => Math.abs(Math.log((a.marketCapCr || 1) / (m.marketCapCr || 1))) - Math.abs(Math.log((b.marketCapCr || 1) / (m.marketCapCr || 1)))).slice(0, 6)
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
  // the stock lists it is in (14 Nov 2026), the most specific — fewest companies — first
  const lists = [...(listMembership().get(m.symbol) ?? [])].sort((a, b) => a.count - b.count).slice(0, 10).map(({ slug, name }) => ({ slug, name }));
  const latestFiled = m.quarters?.[0]?.filed ?? null;
  const qa = [
    m.pe > 0 && { q: `What is ${poss(n)} P/E ratio?`, a: `${f1(m.pe)} at the ${dayText(loadMarketSnapshot()?.pricesDate) ?? "latest"} close${sectorPe && sectorName && group.length >= 5 ? `, against a median of ${f1(sectorPe)} for listed ${sectorName} companies` : ""}.` },
    !m.lender && m.debtToEquity != null && { q: `Is ${n} debt-free?`, a: m.debtToEquity < 0.01 ? `Yes — its latest balance sheet shows no meaningful borrowings.` : m.debtToEquity < 0.05 ? `Almost: its debt is only ${f2(m.debtToEquity)} times its equity in the latest balance sheet.` : `No. Its debt is ${f2(m.debtToEquity)} times its equity in the latest balance sheet.` },
    { q: `When are ${poss(n)} next results?`, a: m.nextResults ? `Its board meets to approve results on ${dayText(m.nextResults)}, as told to NSE.` : `No results date has been announced to NSE yet${latestFiled ? `; its latest results were filed on ${dayText(latestFiled)}` : ""}.` },
    q != null && { q: `What is ${poss(n)} quality score?`, a: `${Math.round(q)} out of 100, from checks on its business, earnings, balance sheet, governance, growth and valuation in its own filings. The methodology explains each check.` },
    // 8 Nov 2026 (AI search answers questions in a line): its price and size,
    // its latest results, and who owns it
    m.cmp != null && { q: `What is ${poss(n)} share price?`, a: `₹${f2(m.cmp)} at the ${dayText(loadMarketSnapshot()?.pricesDate) ?? "latest"} NSE close${m.ret1y != null ? `, ${m.ret1y >= 0 ? "up" : "down"} ${f1(Math.abs(m.ret1y))}% over a year` : ""}${m.marketCapCr ? `, a market value of ₹${Math.round(m.marketCapCr).toLocaleString("en-IN")} crore` : ""}.` },
    m.quarters?.[0]?.revenueCr != null && (() => {
      const k = m.quarters[0], py = profitGrowth(m.quarters, 0);
      const sales = `Sales of ₹${Math.round(k.revenueCr).toLocaleString("en-IN")} crore${k.salesYoY != null ? `, ${k.salesYoY >= 0 ? "up" : "down"} ${f1(Math.abs(k.salesYoY))}% on a year earlier` : ""}`;
      const profit = k.profitCr == null ? "" : `; net ${k.profitCr < 0 ? "loss" : "profit"} of ₹${Math.round(Math.abs(k.profitCr)).toLocaleString("en-IN")} crore${k.profitCr > 0 && py != null ? ` (${py >= 0 ? "up" : "down"} ${f1(Math.abs(py))}%)` : ""}`;
      const filed = k.filed ? `, filed with NSE on ${dayText(String(k.filed).slice(0, 10))}` : "";
      return { q: `How were ${poss(n)} ${fyLabel(k.fyEnd)} results?`, a: `${sales}${profit}${filed}.` };
    })(),
    m.promoterPct != null && { q: `How much of ${n} do its promoters own?`, a: `${f1(m.promoterPct)}% at the latest shareholding filing${m.pledgedPct > 0 ? `, with ${f1(m.pledgedPct)}% of that pledged` : m.pledgedPct === 0 ? `, none of it pledged` : ""}.` },
    { q: `Does ${n} pay dividends?`, a: m.divYield > 0 ? `Yes. Its dividends over the last year come to a ${f2(m.divYield)}% yield at the latest close.` : `It has paid no dividend in the last year.` },
  ].filter(Boolean);

  // a page with nothing to say is better left out of search (the SEO audit)
  const sparse = !m.quarters?.length && !(m.history?.length) && q == null;
  return {
    sector: sectorName ? { name: sectorName, slug: sectorSlug(sectorName) } : null,
    summary: sentences, trend, peers, peersIn, screens, lists, qa, sparse,
    business: businessLines(m.symbol), record: recordSentences(m), recordTitle: `${poss(n)} record, year by year`, checks: strengthsAndWatch(m),
    sectorMedians: { pe: sectorPe, roe: sectorRoe, companies: group.length },
  };
}

// ── Sector pages: /sectors and /sector/<slug> ───────────────────────────────
export function publicSectors() {
  const c = context();
  return {
    pricesDate: loadMarketSnapshot()?.pricesDate ?? null, builtAt: loadMarketSnapshot()?.builtAt ?? null,
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
  // and the stock lists most of them are in (14 Nov 2026)
  const lists = new Map(), member = listMembership();
  for (const r of list) for (const l of member.get(r.symbol) ?? []) lists.set(l.slug, { slug: l.slug, name: l.name, count: (lists.get(l.slug)?.count ?? 0) + 1 });
  return {
    name, slug, pricesDate: loadMarketSnapshot()?.pricesDate ?? null, builtAt: loadMarketSnapshot()?.builtAt ?? null, count: list.length,
    medianPe: median(list.map(r => (r.pe > 0 ? r.pe : null))), medianRoe: median(list.map(r => r.roe)),
    medianRoce: median(list.filter(r => !r.lender).map(r => r.roce)),
    totalMarketCapCr: list.reduce((t, r) => t + (r.marketCapCr ?? 0), 0),
    best, companies, screens: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4),
    lists: [...lists.values()].sort((a, b) => b.count - a.count).slice(0, 6),
  };
}
export const SECTOR_PATHS = () => ["/sectors", ...publicSectors().sectors.map(s => `/sector/${s.slug}`)];
