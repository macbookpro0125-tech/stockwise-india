// The stock page's supporting panels, fetched when a page asks for them:
// shareholding over recent quarters, the company's own filings (announcements
// and annual reports), press coverage, and peers in the same sector. The
// original app took all of these from Screener.in's company page; here they
// come from NSE, Google News and this app's own data.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { shareholdingFilings, readShareholdingFiling } from "./fetch-shareholding.js";
import { allMetrics, researchBrief } from "./screen.js";
import { isPeerIndustry } from "./research.js";
import { fetchText as requestText } from "./upstream.js";

const HOUR = 3600 * 1000;
const memo = new Map();

async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit?.retryAt > Date.now()) return staleValue(hit.data);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const data = await fn();
    memo.set(key, { at: Date.now(), data });
    return data;
  } catch (error) {
    if (!hit) throw error;
    console.warn(`[cache] ${key} refresh failed; returning the last successful result (${error.name})`);
    memo.set(key, { ...hit, retryAt: Date.now() + 60_000 });
    return staleValue(hit.data);
  }
}

function staleValue(data) {
  return Array.isArray(data) ? data : { ...data, stale: true, staleReason: "Refresh failed; showing the last successful result." };
}

// ---- Shareholding history ---------------------------------------------------

const SHP_DIR = join(DATA_DIR, "shareholding");

// Promoter / FII / DII / everyone else for the last few quarters, as in the
// original's shareholding panel. A filed quarter never changes, so each one
// read is kept on disk and only a new quarter costs a download.
export function shareholdingHistory(symbol, quarters = 5) {
  return cached(`shp:${symbol}`, 6 * HOUR, async () => {
    const seen = new Set();
    const filings = (await shareholdingFilings(symbol)).filter(f => !seen.has(f.date) && seen.add(f.date)).slice(0, quarters);
    const path = join(SHP_DIR, `${symbol}.json`);
    const disk = existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
    let changed = false;
    for (const f of filings) {
      if (disk[f.date]) continue;
      disk[f.date] = await readShareholdingFiling(f);
      changed = true;
      await new Promise(r => setTimeout(r, 300)); // gentle on NSE's archive
    }
    if (changed) {
      mkdirSync(SHP_DIR, { recursive: true });
      writeFileSync(path, JSON.stringify(disk));
    }
    // Oldest first, as the original's table reads left to right
    return filings.map(f => disk[f.date]).reverse().map(q => {
      const known = [q.promoterPct, q.fiiPct, q.diiPct].every(v => v != null);
      return {
        period: q.asOf,
        promoter: q.promoterPct,
        fii: q.fiiPct ?? null,
        dii: q.diiPct ?? null,
        // Retail and everyone else: what promoters and institutions don't hold
        retail: known ? Math.round((100 - q.promoterPct - q.fiiPct - q.diiPct) * 100) / 100 : null,
      };
    });
  });
}

// ---- Filings: announcements and annual reports --------------------------------

export function companyFilings(symbol) {
  return cached(`filings:${symbol}`, HOUR, async () => {
    const [ann, reports] = await Promise.allSettled([
      fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol)}`),
      fetchJson(`${NSE_BASE}/api/annual-reports?index=equities&symbol=${encodeURIComponent(symbol)}`),
    ]);
    const announcements = ann.status === "fulfilled" && Array.isArray(ann.value)
      ? ann.value.slice(0, 40).map(a => ({
        title: a.desc,
        summary: a.attchmntText && a.attchmntText !== a.desc ? a.attchmntText : null,
        date: a.an_dt,
        url: a.attchmntFile || null,
        review: classifyAnnouncement(a.desc, a.attchmntText),
      }))
      : [];
    const reportRows = reports.status === "fulfilled" ? (reports.value?.data ?? reports.value) : [];
    const annualReports = Array.isArray(reportRows)
      ? reportRows.map(r => ({ title: `${r.fromYr}–${r.toYr}`, url: r.fileName, date: r.disseminationDateTime ?? r.broadcast_dttm ?? null }))
      : [];
    return {
      announcements,
      annualReports,
      error: ann.status === "rejected" ? ann.reason.message : null,
    };
  });
}

// Structured triage from NSE's published notice description and attachment
// text. It extracts the matched basis and any plainly stated amounts; it does
// not infer whether the event is financially positive or negative.
export function classifyAnnouncement(title = "", body = "") {
  const text = `${String(title)} ${String(body)}`.replace(/\s+/g, " ").trim();
  const rules = [
    // Precise phrases only: a clean audit says "unmodified opinion", most
    // accounts mention a "going concern basis", and "insolvency" also turns up
    // in a foreign registrar's name (Reliance's Cyprus subsidiary)
    { priority: "Review promptly", category: "Audit / accounts", re: /(?<!un)qualified opinion|(?<!un)modified opinion|adverse opinion|disclaimer of opinion|statement on impact of audit qualification|auditor(?:s)?(?:'s)? resign(?:ation|ed)?|resignation of (?:the )?statutory auditor|delay.{0,40}(?:financial )?results|(?:financial )?results.{0,40}delay|\bfraud\b|forensic audit|material uncertainty.{0,80}going concern|going concern.{0,80}(?:doubt|uncertain)/i, review: "Read the full notice and the linked filing; confirm the affected period, auditor or result detail." },
    { priority: "Review promptly", category: "Debt / insolvency", re: /corporate insolvency resolution|\bCIRP\b|insolvency (?:and bankruptcy )?(?:petition|application|proceeding)|admitted.{0,60}insolvency|\bdefault(?:ed)? (?:in|on) (?:the )?(?:re)?payment|\bdefault(?:ed)? (?:in|on) (?:the )?(?:interest|principal)|wilful defaulter/i, review: "Check the lender or creditor, the amount, the dates, and what the company says it is doing about it." },
    { priority: "Review promptly", category: "Regulatory / legal", re: /show cause|penalty|fine imposed|SEBI.{0,60}order|search and seizure|investigation|enforcement directorate|court order|litigation|material weakness/i, review: "Check the regulator/court, parties, amount, current status, and whether the company disclosed an appeal." },
    { priority: "Review promptly", category: "Management change", re: /resignation.{0,60}(?:director|CFO|CEO|company secretary|auditor)|(?:director|CFO|CEO|company secretary).{0,60}resign/i, review: "Confirm the person's role, effective date, and the reason stated in the filing." },
    { priority: "Read for context", category: "Capital allocation / transaction", re: /acquisition|acquire|merger|amalgamation|divest|sale of|fund rais|preferential issue|qualified institutions placement|\bQIP\b|rights issue|buyback/i, review: "Check transaction size, funding, counterparties, approvals, and expected completion conditions." },
    { priority: "Read for context", category: "Operations / outlook", re: /capacity|plant|expansion|large order|order win|production|guidance|outlook|joint venture|subsidiary/i, review: "Check the disclosed amount, timing, execution milestones, and whether the notice states a financial impact." },
    { priority: "Routine disclosure", category: "Results / governance", re: /board meeting|financial results|shareholding pattern|annual report|dividend|record date|postal ballot/i, review: "Open the linked notice for the underlying numbers, resolutions, or period covered." },
  ];
  const match = rules.find(rule => rule.re.test(text));
  if (!match) return null;
  const amounts = [...text.matchAll(/(?:₹|\bRs\.?\s*)(\d[\d,]*(?:\.\d+)?)\s*(crore|cr\.?|lakh|mn|million|%|rupees)?/gi)]
    .slice(0, 3)
    .map(m => m[0].trim());
  return {
    priority: match.priority,
    category: match.category,
    matchedText: (text.match(match.re)?.[0] ?? "").slice(0, 120),
    extractedAmounts: [...new Set(amounts)],
    reviewPrompt: match.review,
    method: "NSE description keyword rule",
    sentiment: null,
  };
}

// ---- News (ported from stock-screener's server/news.js) -----------------------

const NEWS_UA = "Mozilla/5.0 (compatible; StockwiseIndia/1.0; educational)";

function decode(s) {
  return String(s ?? "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Price-prediction and "target for tomorrow" pieces are the bulk of what SEO
// farms publish against an Indian ticker — not reporting. Dropped, not ranked.
const JUNK = [
  /share price prediction/i,
  /price prediction for tomorrow/i,
  /\btarget price for tomorrow\b/i,
  /prediction for (tomorrow|today|next week)/i,
  /\b(astrology|numerology)\b/i,
  /multibagger.*(buy now|will make you)/i,
];

// Google News, not Yahoo: Yahoo's news search isn't ticker-specific for Indian
// symbols. Returns an empty list rather than throwing — news is the least
// important thing on the page and must never take it down.
export function companyNews(name, limit = 8) {
  const query = `${String(name || "").trim()} share price`;
  return cached(`news:${query}`, HOUR, async () => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const xml = await requestText(url, { headers: { "User-Agent": NEWS_UA }, service: "Google News", timeoutMs: 10_000, maxBytes: 4 * 1024 * 1024 });
      const seen = new Set();
      const news = [];
      for (const b of xml.split("<item>").slice(1)) {
        const title = decode((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
        const link = decode((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
        const pub = decode((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
        const source = decode((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
        if (!title || !link) continue;
        // Google appends " - Publisher" to headlines; the publisher is shown separately
        const clean = source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)).trim() : title;
        if (!clean || JUNK.some(re => re.test(clean))) continue;
        if (seen.has(clean.toLowerCase())) continue;
        seen.add(clean.toLowerCase());
        const d = pub ? new Date(pub) : null;
        news.push({ title: clean, publisher: source || null, url: link, date: d && !isNaN(d) ? d.toISOString() : null });
        if (news.length >= limit) break;
      }
      return { news };
  });
}

// ---- Peers ------------------------------------------------------------------

// Companies in the same NSE sector (or, when absent, NSE industry), largest
// first. Peer medians use the full cohort and exclude the subject company.
export function sectorPeers(symbol, limit = 30) {
  const { rows } = allMetrics();
  const me = rows.find(r => r.symbol === symbol);
  if (!me) return { sector: null, industry: null, peerBasis: null, peerCount: 0, benchmark: null, rows: [] };
  // Sector first, then NSE's industry label — the same order as the research
  // score's peer P/E, so the two never quote different cohorts
  const peerBasis = me.sector ? "sector" : isPeerIndustry(me.industry) ? "industry" : null;
  const peerLabel = peerBasis === "sector" ? me.sector : peerBasis === "industry" ? me.industry : null;
  if (!peerBasis) return { sector: null, industry: me.industry, peerBasis: null, peerLabel: null, peerCount: 0, benchmark: null, rows: [] };
  const cohort = rows.filter(r => r.symbol !== symbol && (peerBasis === "sector" ? r.sector === me.sector : r.industry === me.industry));
  const median = values => {
    const sorted = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    if (sorted.length < 5) return { value: null, n: sorted.length };
    const middle = sorted.length >> 1;
    return { value: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, n: sorted.length };
  };
  const pe = median(cohort.map(r => r.pe));
  const evEbitda = median(cohort.filter(r => !r.lender).map(r => r.evToEbitda));
  const fcfYield = median(cohort.filter(r => !r.lender).map(r => r.fcfYieldPct));
  const ordered = [me, ...rows.filter(r => r.symbol !== symbol && (peerBasis === "sector" ? r.sector === me.sector : r.industry === me.industry))]
    .sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
  const top = ordered.slice(0, limit);
  if (!top.includes(me)) top.push(me);
  return {
    sector: me.sector ?? null,
    industry: me.industry ?? null,
    peerBasis,
    peerLabel,
    peerCount: cohort.length,
    benchmark: {
      pe: pe.value, peN: pe.n,
      evToEbitda: evEbitda.value, evToEbitdaN: evEbitda.n,
      fcfYieldPct: fcfYield.value, fcfYieldN: fcfYield.n,
    },
    total: ordered.length,
    rows: top.map(r => ({
      symbol: r.symbol, name: r.name, cmp: r.cmp, pe: r.pe, marketCapCr: r.marketCapCr, divYield: r.divYield,
      profitCr: r.profitCr, revenueCr: r.revenueCr, salesGrowth3y: r.salesGrowth3y, roce: r.roce, roe: r.roe,
      evToEbitda: r.evToEbitda, fcfYieldPct: r.fcfYieldPct,
      research: researchBrief(r.research),
    })),
  };
}
