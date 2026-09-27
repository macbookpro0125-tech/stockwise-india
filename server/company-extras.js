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
import { allMetrics } from "./screen.js";

const HOUR = 3600 * 1000;
const memo = new Map();

async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const data = await fn();
  memo.set(key, { at: Date.now(), data });
  return data;
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
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(url, { headers: { "User-Agent": NEWS_UA } });
      if (!res.ok) return { news: [], error: `HTTP ${res.status}` };
      const xml = await res.text();
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
    } catch (e) {
      return { news: [], error: e.message };
    }
  });
}

// ---- Peers ------------------------------------------------------------------

// Companies in the same NSE sector, largest first — the original used
// Screener's narrower industry pages. The stock itself is always included.
export function sectorPeers(symbol, limit = 30) {
  const { rows } = allMetrics();
  const me = rows.find(r => r.symbol === symbol);
  if (!me?.sector) return { sector: null, rows: [] };
  const inSector = rows.filter(r => r.sector === me.sector).sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
  const top = inSector.slice(0, limit);
  if (!top.includes(me)) top.push(me);
  return {
    sector: me.sector,
    total: inSector.length,
    rows: top.map(r => ({
      symbol: r.symbol, name: r.name, cmp: r.cmp, pe: r.pe, marketCapCr: r.marketCapCr, divYield: r.divYield,
      profitCr: r.profitCr, revenueCr: r.revenueCr, salesGrowth3y: r.salesGrowth3y, roce: r.roce, roe: r.roe,
      score: { green: r.score.green, applicable: r.score.applicable },
    })),
  };
}
