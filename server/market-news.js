// The News page (asked for 22 Oct 2026: "a news page — do I need to post it
// daily?"). Nobody posts anything: it fills itself from two sources the app
// already reads. What every listed company told NSE over the last few days
// (its own announcements, routine paperwork left out, sorted into kinds), and
// the day's market headlines from Google News — the headline, publisher, time
// and link only; the story stays on the publisher's site. Nothing is written
// here: an announcement is shown in the company's own words, a headline as
// published.

import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { fetchText as requestText } from "./upstream.js";
import { allMetrics } from "./screen.js";
import { loadMarketSnapshot } from "./market-data.js";
import { cached, decodeRss, isJunkHeadline, companyNews } from "./company-extras.js";
import { ROUTINE, ONLY_THE_RULE, inOwnWords } from "./moves.js";
import { exploreBoard } from "./explore.js";

const MINUTE = 60_000;
const DAY = 86_400_000;
const PAGE = 40;
const NEWS_UA = "Mozilla/5.0 (compatible; JocularInsights/1.0; educational)";

// ---- Announcements ---------------------------------------------------------

// What kind of news an announcement is, from NSE's subject for it and the
// company's summary; null for paperwork. The kinds are the page's filters.
export const KINDS = {
  results: "Results",
  dividends: "Dividends & splits",
  deals: "Orders & deals",
  people: "Management",
  legal: "Ratings & legal",
  updates: "Company updates",
};
// Subjects that are never news: meeting and call notices, newspaper copies,
// certificates, insider-trading windows, staff share plans
const PAPERWORK = /analysts?\/institutional|investor meet|con\. call|newspaper|certificate|investor presentation|trading window|esop|esos|esps|structural digital database|monitoring agency|shareholders meeting|loss of share|statement of deviation|utilisation of funds|related party|scrutini[sz]er|voting results|e-voting|annual general meeting|book closure|investor complaints|reg(ulation)?\.? ?74|registrar|change in rta|disclosure of .*pledge|encumbrance|sast|substantial acquisition|takeover regulations|insider trading|closure of trading|listing approval|trading approval|committee meeting|corrigendum|addendum|guarantee|amendment to aoa|compliance report|alteration/i;
// …and summaries that are only a staff share plan, a call's slides, a
// meeting's date or a debt's routine payments
const NOT_NEWS = /employee stock|stock option|restricted stock|\brsu\b|\besop|\besos|investors?['’]? presentation|earnings presentation|analysts?['’]? presentation|meeting\b.{0,40}\bcancell?ed|scheduled to be held|commercial paper|redemption of (ncds?|non-convertible|debentures)|(payment|servicing) of interest|interest (payment|servicing)/i;

export function newsKind(subject = "", summary = "") {
  const s = String(subject), text = `${s} ${summary}`;
  if (PAPERWORK.test(s) || ROUTINE.test(text) || NOT_NEWS.test(text)) return null;
  if (/financial results?|integrated filing.{0,20}financ/i.test(s) || (/outcome of board meeting/i.test(s) && /financial results|unaudited|audited results|quarter (and half year )?ended/i.test(summary))) return "results";
  // a results press release ("IHCL announces financial results for Q2 FY2027")
  if (/press release/i.test(s) && /financial results|quarterly (net )?profit|\bq[1-4] ?fy|quarter (and half year )?ended|half year ended/i.test(summary)) return "results";
  if (/dividend|bonus|split|sub-?division|buy-?back|rights issue/i.test(text) || (/record date/i.test(s) && /dividend|bonus|split|rights/i.test(summary))) return "dividends";
  if (/record date/i.test(s)) return null;
  if (/allotment of securities/i.test(s)) return /preferential|qualified institutions|\bqip\b|rights/i.test(summary) ? "deals" : null;
  if (/bagging|receiving of orders|awarding of order|acquisition|amalgamation|merger|demerger|scheme of arrangement|agreement|joint venture|capacity addition|commencement of commercial|divest|sale of|fund rais|preferential|qualified institutions|\bqip\b|order win|large order|letter of award|issue of securities|restructuring/i.test(text)) return "deals";
  if (/resignation|retirement|change in management|appointment|change in director|change in company secretary|cessation|change in auditor|demise|\bkmp\b|managing director|chief executive|chief financial/i.test(s)) return "people";
  if (/credit rating|action\(s\)|orders? passed|insolvency|\bcirp\b|suspension|forensic|penalt|litigation|default|fraud|show cause|search|seizure|sebi order/i.test(text)) return "legal";
  if (/press release|general updates|^updates$|others|price movement|spurt in volume|clarification|verification|material issue|closure of operations|outcome of board meeting/i.test(s)) return "updates";
  return null;
}

// NSE's "2026-10-22 23:25:43", India time
const nseTime = s => {
  const m = String(s ?? "").match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  return m ? new Date(`${m[1]}T${m[2]}+05:30`).toISOString() : null;
};
const ddmmyyyy = ms => { const d = new Date(ms + 5.5 * 3600_000); return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`; };

// NSE's summaries come in quotes now and then ("'Outcome of Board Meeting
// held on …'."), and a press release's is "A press release dated …, titled
// "…"" — its title is what it says
export function tidy(text) {
  // NSE leaves some characters as HTML codes ("&#8377;3,16,00,452" for ₹)
  let t = String(text ?? "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();
  const titled = t.match(/^a (?:revised )?press release dated .+?, titled\s*["“'](.+?)["”']\.?$/i);
  if (titled) t = titled[1].trim();
  t = t.replace(/^['"“‘]+/, "").replace(/['"”’]+\.?$/, "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

// A summary that is only the rule it's filed under, in any of NSE's wordings
// ("Disclosure under Regulation 30 of the Securities and Exchange Board of
// India (Listing Obligations and Disclosure Requirements) Regulations, 2015")
const onlyTheRule = text => /^['"]?(disclosure|intimation)s? (under|pursuant to) regulation \d+[^.]*?(listing obligations|lodr)[^.]*?regulations?,? ?(\d{4})?['"]?\.?['"]?$/i.test(String(text).trim());

// NSE's rows → the page's announcements: news only, newest first, one of
// each (a company files the same notice twice now and then)
export function announcementsFrom(rows) {
  const seen = new Set();
  const out = [];
  // oldest first, so a notice filed twice keeps its first filing
  const ordered = [...(rows ?? [])].sort((a, b) => String(a.sort_date).localeCompare(String(b.sort_date)));
  for (const r of ordered) {
    const said = r.attchmntText && !ONLY_THE_RULE.test(String(r.attchmntText).trim()) && !onlyTheRule(inOwnWords(r.attchmntText)) ? tidy(inOwnWords(r.attchmntText)) : null;
    // a summary that only repeats the subject ("Acquisition", "General Updates") is none
    const bare = t => String(t ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const summary = said && bare(said) !== bare(r.desc) ? said : null;
    const kind = newsKind(r.desc, summary ?? "");
    const time = nseTime(r.sort_date) ?? null;
    if (!kind || !r.symbol || !time || !r.seq_id) continue;
    // "General Updates" with nothing said but a PDF tells a reader nothing,
    // nor "Outcome of Board Meeting held on 22 October" with no outcome in it
    if (kind === "updates" && !summary && /general updates|^updates$|others/i.test(r.desc)) continue;
    if (kind === "updates" && summary && /^outcome of (the )?board meeting held on\b[^.]*\.?$/i.test(summary)) continue;
    const key = `${r.symbol}|${r.desc}|${summary}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `nse-${r.seq_id}`, type: "filing", kind, time,
      symbol: r.symbol, company: r.sm_name ?? r.symbol,
      title: r.desc, summary,
      url: /^https:\/\/nsearchives\.nseindia\.com\//.test(r.attchmntFile ?? "") ? r.attchmntFile : null,
      fileSize: r.fileSize ?? r.attFileSize ?? null,
    });
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
}

// The last four days (a Monday morning still has Friday's), every 15 minutes
function announcements() {
  return cached("market-news:nse", 15 * MINUTE, async () => {
    const now = Date.now();
    const rows = await fetchJson(`${NSE_BASE}/api/corporate-announcements?index=equities&from_date=${ddmmyyyy(now - 3 * DAY)}&to_date=${ddmmyyyy(now)}`);
    if (!Array.isArray(rows)) throw new Error("NSE's announcements couldn't be read");
    return announcementsFrom(rows);
  });
}

// ---- Headlines -------------------------------------------------------------

// Market headlines that are calls rather than reporting ("Top 15 stocks to
// buy"), and quote pages, are left out, as on a company's News tab
// Search results that are a price page or a comparison tool, not a story
// ("RAYMONDREL Stock Price and Chart", "Compare CHOKHANI BUS with", 23 Oct 2026)
const PRICE_PAGE = /stock price and chart|^compare\b.*\bwith\b|share price (today|live)|\bstock quote\b|price chart|\b(ltd|limited)? ?news\s*[—-]\s*(nse|bse):/i;
const TIPS = /trade setup|['‘’"]?\bbuy['‘’"]? (rating|call|initiation)|initiates? (coverage|with a buy)|\bupside\b|\bto buy\b|stocks? to (buy|watch|pick)|buy or sell|target price|top picks|should you buy|technical picks|intraday|trading ideas|stock recommendations?|stocks? under ₹|share price (today|live)|stock price live|\blive (updates|blog)\b/i;
const STOP_WORDS = new Set("the a an and or of in on for to as at by with from is are its it this that over amid after says say".split(" "));
const words = t => new Set(String(t).toLowerCase().replace(/[^a-z0-9₹%.\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));
// Six sites report the same close in nearly the same words; the first is kept
function sameStory(a, b) {
  let common = 0, figures = 0;
  for (const w of a) if (b.has(w)) { common++; if (/\d{2,}/.test(w)) figures++; }
  return common / (a.size + b.size - common || 1) >= 0.4 || (figures >= 1 && common >= 3);
}

// The broad query brings phone launches and court cases too
const MARKET = /\b(sensex|nifty|stocks?|shares?|markets?|ipos?|sebi|rbi|rupee|fiis?|fpis?|diis?|results|earnings|profits?|dividends?|q[1-4]|crore|listings?|listed|investors?|bse|nse|mutual funds?|bonds?|inflation|gdp)\b/i;

export function headlinesFrom(xmls, now = Date.now(), named = null) {
  const kept = [];
  for (const xml of xmls) {
    for (const b of String(xml).split("<item>").slice(1)) {
      const title = decodeRss((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const link = decodeRss((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]);
      const pub = decodeRss((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]);
      const source = decodeRss((b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
      if (!title || !/^https:\/\//.test(link)) continue;
      const clean = source && title.endsWith(` - ${source}`) ? title.slice(0, -(source.length + 3)).trim() : title;
      const time = pub ? new Date(pub) : null;
      if (!clean || !time || isNaN(time) || now - time > 2 * DAY || isJunkHeadline(clean) || TIPS.test(clean)) continue;
      if (!MARKET.test(clean) && !named?.(clean)) continue;
      const w = words(clean);
      // the same story from another site: kept with the first, for its page ("Also reported by")
      const first = kept.find(k => sameStory(k.words, w));
      if (first) {
        if (source && source !== first.publisher && first.others.length < 6 && !first.others.some(o => o.publisher === source)) first.others.push({ title: clean, publisher: source, url: link, time: time.toISOString() });
        continue;
      }
      kept.push({ words: w, title: clean, publisher: source || null, url: link, time: time.toISOString(), others: [] });
    }
  }
  // the day's close is reported by every site in its own words: the six latest
  let wraps = 0;
  return kept
    .map(({ words: _, ...h }) => ({ id: `h-${hash(h.url)}`, type: "headline", kind: "headlines", ...h }))
    .sort((a, b) => b.time.localeCompare(a.time))
    .filter(h => !/sensex|nifty/i.test(h.title) || ++wraps <= 6);
}

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

const QUERIES = ["Sensex Nifty when:1d", "stock market India when:1d"];
function headlines() {
  return cached("market-news:headlines", 20 * MINUTE, async () => {
    const xmls = await Promise.all(QUERIES.map(q => requestText(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`, { headers: { "User-Agent": NEWS_UA }, service: "Google News", timeoutMs: 10_000, maxBytes: 4 * 1024 * 1024 })));
    const index = indexNow();
    return headlinesFrom(xmls, Date.now(), t => namedCompanies(t, index).length > 0).slice(0, 40);
  });
}

// ---- RBI and SEBI ------------------------------------------------------------

// What the market's regulators announced (24 Oct 2026, "add official
// sources"): the RBI's press releases and notifications, SEBI's press
// releases, circulars and orders, from their own RSS feeds. As with a
// headline, the title, date and link only: SEBI's website policy asks for
// permission before its material is reproduced, so the text stays on its site.
const OFFICIAL_FEEDS = [
  ["RBI", "https://www.rbi.org.in/pressreleases_rss.xml"],
  ["RBI", "https://www.rbi.org.in/notifications_rss.xml"],
  ["SEBI", "https://www.sebi.gov.in/sebirss.xml"],
];
// SEBI's orders against small traders and brokers are most of its feed and seldom news
const MINOR_ORDER = /adjudication order|settlement order|recovery (certificate|proceedings)|order in (the matter|respect) of|summons|attachment|exemption order|prohibitive order|ex-?parte|confirmatory order|revocation order|order under section/i;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// RFC dates ("Fri, 24 Oct 2026 17:30:00 +0530") and the "24 Oct, 2026" kind
export function officialTime(text) {
  const t = String(text ?? "").trim();
  // a date alone ("24 Oct, 2026", SEBI's) isn't Date.parse's: it would read
  // it as midnight wherever the server runs, a day early east of London
  const d = /\d:\d\d/.test(t) ? Date.parse(t) : NaN;
  if (!isNaN(d)) return new Date(d);
  const m = t.match(/(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*[\s,-]+(\d{4})/);
  return m && MONTHS[m[2].toLowerCase()] != null ? new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1], 6, 30)) : null;
}
export function officialFrom(feeds, now = Date.now(), named = null) {
  const out = [], seen = new Set();
  for (const [publisher, xml] of feeds) {
    for (const b of String(xml ?? "").split(/<item[\s>]/).slice(1)) {
      const title = decodeRss((b.match(/<title>([\s\S]*?)<\/title>/) || [])[1]).replace(/\s+/g, " ").trim();
      const link = decodeRss((b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]).trim();
      const time = officialTime(decodeRss((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]));
      if (!title || !/^https?:\/\//.test(link) || !time || now - time > 7 * DAY || time - now > DAY) continue;
      if (MINOR_ORDER.test(title) && !named?.(title)) continue;
      const key = `${publisher}|${title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `r-${hash(link)}`, type: "official", kind: "regulators", title, publisher, url: link.replace(/^http:/, "https:"), time: time.toISOString() });
    }
  }
  return out.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 30);
}
function officials() {
  return cached("market-news:officials", 30 * MINUTE, async () => {
    const got = await Promise.allSettled(OFFICIAL_FEEDS.map(([, url]) => requestText(url, { headers: { "User-Agent": NEWS_UA }, service: "RBI and SEBI", timeoutMs: 10_000, maxBytes: 4 * 1024 * 1024 })));
    if (got.every(g => g.status === "rejected")) throw got[0].reason;
    const index = indexNow();
    return officialFrom(OFFICIAL_FEEDS.map(([who], i) => [who, got[i].status === "fulfilled" ? got[i].value : ""]), Date.now(), t => namedCompanies(t, index).length > 0);
  });
}

// ---- What a headline is about -------------------------------------------------

// Its topic, for its picture in the list and the page's "Talked about" row: a
// sector by its words (TOPICS, below) or a named company's, else a theme
const THEMES = [
  ["rates", "RBI & rates", /\brbi\b|repo rate|rate (cut|hike)|monetary policy|\bmpc\b|inflation|\bcpi\b/i],
  ["crude", "Crude oil", /\bcrude\b|oil prices?|brent/i],
  ["fii", "Foreign investors", /\bfiis?\b|\bfpis?\b|foreign (portfolio )?investors?|foreign funds?|foreign outflows?|foreign inflows?/i],
  ["ipo", "IPOs", /\bipos?\b|\blisting\b|\bgmp\b|grey market|public issue/i],
  ["results", "Results", /\bq[1-4]\b|quarterly|\bresults?\b|\bearnings\b|net profit/i],
  ["rupee", "Rupee", /\brupee\b|\bforex\b/i],
  ["gold", "Gold & silver", /\bgold\b|\bsilver\b/i],
  ["global", "Global markets", /\bfed\b|wall street|\bus (markets?|stocks|tariffs?)\b|\btariffs?\b|\bchina\b|global cues|\bdow\b|nasdaq/i],
  ["sebi", "SEBI & rules", /\bsebi\b|regulator|circular/i],
  ["market", "Sensex & Nifty", /\bsensex\b|\bnifty\b|\bmarkets?\b|\bmidcaps?\b|\bsmallcaps?\b/i],
];
export function headlineTopic(item, sectorIndices = []) {
  const title = item.title ?? "";
  // a regulator's own announcement is about the regulator
  if (item.type === "official") return item.publisher === "RBI" ? { key: "rates", label: "RBI & rates" } : { key: "sebi", label: "SEBI & rules" };
  const sector = headlineTopics(title, sectorIndices)[0];
  // (a sector named in words wins over a theme: "IT stocks rally on Q2 results" is IT)
  if (sector && TOPICS.some(([re, name]) => name === sector && re.test(title))) return { key: `idx:${sector}`, label: sectorLabel(sector), index: sector };
  for (const [key, label, re] of THEMES) if (re.test(title)) return { key, label };
  return sector ? { key: `idx:${sector}`, label: sectorLabel(sector), index: sector } : { key: "market", label: "Sensex & Nifty" };
}
const sectorLabel = name => name.replace(/^nifty\s+/i, "").replace(/ index$/i, "").replace(/^India /, "");

// ---- Which companies a headline names ---------------------------------------

// Larger companies only (₹5,000 crore up), by their whole name without
// "Limited" ("Coal India", "CIE Automotive India"), their symbol in capitals
// ("TCS"), or the short name everyone uses for a few (below). Not by a first
// word alone: "global portfolio" isn't Global Health, nor "tech stocks" Tech
// Mahindra. A one-word name must match as written ("Eternal", not "eternal").
// BSE the company isn't tagged at all: "BSE" is nearly always the exchange
// ("listed on NSE and BSE", "BSE Sensex").
const KNOWN_AS = {
  SBIN: ["SBI"], LT: ["L&T"], HINDUNILVR: ["HUL"], BHARTIARTL: ["Airtel", "Bharti Airtel"], KOTAKBANK: ["Kotak Bank", "Kotak Mahindra"],
  INDHOTEL: ["IHCL", "Indian Hotels"], RELIANCE: ["Reliance Industries", "RIL"], "M&M": ["M&M", "Mahindra & Mahindra"], MARUTI: ["Maruti"],
  ULTRACEMCO: ["UltraTech"], HDFCLIFE: ["HDFC Life"], SBILIFE: ["SBI Life"], ONGC: ["ONGC"], NTPC: ["NTPC"], LICI: ["LIC"], BAJFINANCE: ["Bajaj Finance"],
};
const NOT_A_COMPANY = new Set(["BSE", "NSE", "IT", "GST", "RBI", "SEBI", "IPO", "FII", "FPI", "EPI", "AMC"]);
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const plainName = name => String(name ?? "").replace(/\b(limited|ltd\.?)\b/gi, "").replace(/\(india\)/gi, "").replace(/^the\s+/i, "").replace(/\s+/g, " ").trim();
const wordRe = (text, flags) => new RegExp(`(?<![\\w&])${escape(text)}(?![\\w&])`, flags);

export function companyIndex(rows) {
  return (rows ?? []).filter(r => r.marketCapCr >= 5000 && r.name).map(r => {
    const plain = plainName(r.name);
    const res = [];
    if (plain.length >= 4) res.push(wordRe(plain, plain.includes(" ") ? "i" : ""));
    if (/^[A-Z&]{3,}$/.test(r.symbol) && !NOT_A_COMPANY.has(r.symbol)) res.push(wordRe(r.symbol, ""));
    for (const alias of KNOWN_AS[r.symbol] ?? []) res.push(wordRe(alias, ""));
    // lower-case pieces a headline must contain before the patterns are tried
    const keys = [plain.length >= 4 ? plain : null, r.symbol, ...(KNOWN_AS[r.symbol] ?? [])].filter(Boolean).map(k => k.toLowerCase());
    return { symbol: r.symbol, res, keys, cap: r.marketCapCr };
  }).filter(c => c.res.length);
}

export function namedCompanies(title, index, max = 3) {
  const lower = String(title).toLowerCase();
  return index.filter(c => c.keys.some(k => lower.includes(k)) && c.res.some(re => re.test(title))).sort((a, b) => b.cap - a.cap).slice(0, max).map(c => c.symbol);
}

// A result's own figures, as the app reads them from the company's results
// filing (metrics.js quarters) — the quarter on file must have been filed
// within three days of the announcement; until the evening data update
// brings a new one, there are none (never last quarter's in its place)
export function resultNumbers(row, time) {
  const q = row?.quarters?.[0];
  if (!q?.filed || !q.fyEnd || Math.abs(Date.parse(istDay(time)) - Date.parse(q.filed)) > 3 * DAY) return null;
  if (q.revenueCr == null && q.profitCr == null) return null;
  return { quarter: q.fyEnd, salesCr: q.revenueCr ?? null, salesYoY: q.salesYoY ?? null, profitCr: q.profitCr ?? null, profitYoY: q.profitYoY ?? null };
}

// One index per version of the market data, not one per request
let indexCache = null;
function indexNow() {
  const m = allMetrics();
  if (indexCache?.version !== m.version) indexCache = { version: m.version, index: companyIndex(m.rows ?? []) };
  return indexCache.index;
}

// ---- The page ---------------------------------------------------------------

// A company often files one piece of news twice in a day — a dividend, then
// its record date; results, then their press release. One row: the notice
// that says most leads (the dividend, not its record date; the results, not
// the press release), the others go with it (`also`).
const istDay = iso => new Date(Date.parse(iso) + 5.5 * 3600_000).toISOString().slice(0, 10);
const GENERIC_SUBJECT = /^(record date|press release.*|general updates|updates|others|outcome of board meeting)$/i;
export function sameDayTogether(filings) {
  const groups = new Map();
  for (const f of filings) {
    const key = `${f.symbol}|${f.kind}|${istDay(f.time)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const out = [];
  for (const group of groups.values()) {
    const lead = group.find(f => !GENERIC_SUBJECT.test(f.title) && f.summary) ?? group.find(f => f.summary) ?? group[0];
    // (a notice filed twice in the same words goes with it unsaid)
    const same = f => f.summary && lead.summary && (lead.summary.startsWith(f.summary.replace(/…$/, "").slice(0, 120)) || f.summary.startsWith(lead.summary.slice(0, 120)));
    out.push({ ...lead, also: group.filter(f => f !== lead && !same(f)).map(f => ({ id: f.id, title: f.title, summary: f.summary, time: f.time })) });
  }
  return out.sort((a, b) => b.time.localeCompare(a.time));
}

function quoteOf(row) {
  return row ? { symbol: row.symbol, name: row.name, price: row.cmp ?? null, change1d: row.ret1d ?? null, change1w: row.ret1w ?? null, marketCapCr: row.marketCapCr ?? null } : null;
}

// Built once per refresh of either source (or of the market data), then
// shared by every request until the next
let built = null;
async function feed() {
  const [nse, heads, official] = await Promise.allSettled([announcements(), headlines(), officials()]);
  const metrics = allMetrics();
  const sources = [nse.status === "fulfilled" ? nse.value : nse.reason, heads.status === "fulfilled" ? heads.value : heads.reason, official.status === "fulfilled" ? official.value : official.reason, metrics.version];
  if (built && built.sources.every((v, i) => v === sources[i])) return built.value;
  const value = buildFeed(nse, heads, metrics.rows ?? [], official);
  built = { sources, value };
  return value;
}

function buildFeed(nse, heads, rows, official = { status: "fulfilled", value: [] }) {
  // the day the prices beside each item are from
  const asOf = loadMarketSnapshot()?.pricesDate ?? null;
  const bySymbol = new Map(rows.map(r => [r.symbol, r]));
  const index = indexNow();
  const filings = (nse.status === "fulfilled" ? nse.value : []).map(f => {
    const row = bySymbol.get(f.symbol);
    return { ...f, quote: quoteOf(row), numbers: f.kind === "results" ? resultNumbers(row, f.time) : null };
  });
  const news = [...(heads.status === "fulfilled" ? heads.value : []), ...(official.status === "fulfilled" ? official.value : [])];
  const items = [
    ...sameDayTogether(filings),
    ...news.map(h => {
      const companies = namedCompanies(h.title, index).map(s => quoteOf(bySymbol.get(s))).filter(Boolean);
      return { ...h, companies, topic: headlineTopic(h, companies.map(c => bySymbol.get(c.symbol)?.sectorIndex)) };
    }),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const unread = [nse.status === "rejected" ? "NSE's announcements" : null, heads.status === "rejected" ? "the headlines" : null, official.status === "rejected" ? "RBI and SEBI" : null].filter(Boolean);
  return { items, unread, asOf, filings, bySymbol };
}

const listed = ({ quote, others: _, ...item }) => ({ ...item, summary: item.summary && item.summary.length > 240 ? `${item.summary.slice(0, 239).trimEnd()}…` : item.summary ?? null, quote });

// A page of the feed: one kind, or the watchlist's companies, newest first;
// `before` is the last item's time and id
// Companies under ₹1,000 crore are a quarter of the announcements and seldom
// news to most readers: left out unless asked for (`size: "all"`); a
// watchlist's companies are always in
export const LARGE_CR = 1000;
export async function marketNews({ kind = "all", symbols = null, before = null, size = "large", topic = null } = {}) {
  const { items: everything, unread, asOf } = await feed();
  const sized = size === "all" || kind === "watchlist" ? everything : everything.filter(i => i.type !== "filing" || (i.quote?.marketCapCr ?? 0) >= LARGE_CR || symbols?.has(i.symbol));
  const topics = await talkedAbout(sized);
  const items = topic ? sized.filter(i => i.topic?.key === topic) : sized;
  const watched = i => (i.symbol && symbols?.has(i.symbol)) || i.companies?.some(c => symbols?.has(c.symbol));
  // how many of each, for the filters
  const counts = { all: items.length, watchlist: symbols ? items.filter(watched).length : null };
  for (const i of items) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
  let list = kind === "all" ? items : kind === "watchlist" ? items.filter(watched) : items.filter(i => i.kind === kind);
  if (before) {
    const at = list.findIndex(i => `${i.time}|${i.id}` === before);
    list = at >= 0 ? list.slice(at + 1) : list.filter(i => i.time < before.split("|")[0]);
  }
  const page = list.slice(0, PAGE).map(listed);
  const last = page[page.length - 1];
  return { items: page, next: list.length > PAGE && last ? `${last.time}|${last.id}` : null, unread, kinds: KINDS, counts, asOf, size, topics, topic };
}

// The "Talked about" row: the topics with most headlines in the last day,
// each with its market move — the sector's index, or the NIFTY 50
const TALK_MOVE = { market: "Nifty 50", rates: "Nifty Bank", fii: "Nifty 50", crude: "Nifty Oil & Gas", results: "Nifty 50", ipo: "Nifty 50", global: "Nifty 50" };
export function topicCounts(items, now = Date.now()) {
  const by = new Map();
  for (const i of items) {
    if (!i.topic || now - Date.parse(i.time) > DAY) continue;
    const t = by.get(i.topic.key) ?? { ...i.topic, count: 0 };
    t.count++;
    by.set(i.topic.key, t);
  }
  return [...by.values()].filter(t => t.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8);
}
async function talkedAbout(items) {
  const counts = topicCounts(items);
  if (!counts.length) return [];
  const board = await exploreBoard().catch(() => null);
  const all = [...(board?.market ?? []), ...(board?.sectors ?? [])];
  const move = name => all.find(i => i.name.toLowerCase() === String(name).toLowerCase());
  return counts.map(t => {
    const idx = move(t.index ?? TALK_MOVE[t.key] ?? "");
    return { ...t, move: idx ? { name: idx.name, changePct: idx.changePct } : null };
  });
}

// Discover's card: three from companies over ₹10,000 crore, from the last day
// and a half of announcements — results with their figures first, then
// deals, dividends and ratings, then the rest, no more than two of a kind —
// then headlines if there aren't three
const WEIGHT = item => (item.kind === "results" && item.numbers ? 3 : ["deals", "dividends", "legal"].includes(item.kind) ? 2 : item.kind === "results" ? 1 : 0);
export function pickTop(items, n = 3) {
  const big = items.filter(i => i.type === "filing" && i.kind !== "updates" && (i.quote?.marketCapCr ?? 0) >= 10000);
  const newest = big.length ? Date.parse(big[0].time) : 0;
  const recent = big.filter(i => newest - Date.parse(i.time) <= 36 * 3600_000).sort((a, b) => WEIGHT(b) - WEIGHT(a) || b.time.localeCompare(a.time));
  const pick = [], count = {};
  for (const i of [...recent, ...items.filter(i => i.type === "headline")]) {
    if (pick.length === n) break;
    if ((count[i.kind] ?? 0) >= Math.max(2, Math.ceil(n / 2))) continue;
    count[i.kind] = (count[i.kind] ?? 0) + 1;
    pick.push(i);
  }
  return pick.sort((a, b) => b.time.localeCompare(a.time));
}
export async function topNews(n = 3) {
  const { items, unread, asOf } = await feed();
  return { items: pickTop(items, n).map(listed), unread, asOf };
}

// The news about a set of companies (an index's, on the Explore page)
export async function newsForSymbols(symbols, max = 8) {
  const { items } = await feed();
  return items.filter(i => (i.symbol && symbols.has(i.symbol)) || i.companies?.some(c => symbols.has(c.symbol))).slice(0, max).map(listed);
}

// What's new about a watchlist since a moment (the Watchlist tab's dot,
// Header.jsx): how many items about its companies came after `since`, and
// the newest one's time. Headlines count only when they name a company.
export async function watchlistLatest(symbols, since = null) {
  const { items } = await feed();
  const about = items.filter(i => (i.symbol && symbols.has(i.symbol)) || i.companies?.some(c => symbols.has(c.symbol)));
  const after = since ? about.filter(i => i.time > since) : about;
  return { latest: about[0]?.time ?? null, newCount: since ? after.length : 0 };
}

// The items themselves, newest first, for the phone notifications
// (news-push.js)
export async function watchlistNews(symbols, since) {
  const { items } = await feed();
  return items.filter(i => i.time > since && ((i.symbol && symbols.has(i.symbol)) || i.companies?.some(c => symbols.has(c.symbol))));
}

// An announcement, for reading its attachment
export async function newsItemFiling(id) {
  const { filings } = await feed();
  return filings.find(f => f.id === id) ?? null;
}

// One item in full, with what's around it: the company's price and other
// announcements, and headlines that name it; for a headline, the companies
// it names and their latest announcements
export async function newsItem(id) {
  const { items, filings, bySymbol, asOf } = await feed();
  // a row of the list, or one of the notices that went with another
  const item = items.find(i => i.id === id) ?? filings.find(f => f.id === id);
  if (!item) return null;
  const shown = new Set([id, ...(item.also ?? []).map(a => a.id)]);
  const announced = symbol => sameDayTogether(filings.filter(f => f.symbol === symbol && !shown.has(f.id))).slice(0, 4).map(f => listed({ ...f, quote: null }));
  if (item.type === "filing") {
    const row = bySymbol.get(item.symbol);
    // its headlines from the last two weeks — older ones aren't news about this
    const news = row ? await companyNews(row.name, 10).then(r => r.news ?? []).catch(() => []) : [];
    const recent = news.filter(n => n.date && Date.now() - Date.parse(n.date) <= 14 * DAY && !TIPS.test(n.title) && !PRICE_PAGE.test(n.title)).slice(0, 4);
    // results: the company's last eight quarters, for how this one compares (src/resultsCompare.js)
    const quarters = item.kind === "results" && row?.quarters?.length
      ? row.quarters.slice(0, 9).map(q => ({ end: q.fyEnd, salesCr: q.revenueCr ?? null, opCr: q.operatingProfitCr ?? null, profitCr: q.profitCr ?? null, opm: q.opm ?? null, eps: q.eps ?? null, salesYoY: q.salesYoY ?? null, profitYoY: q.profitYoY ?? null }))
      : null;
    // the results table's header: what the market pays for these earnings
    // (PEG: the P/E over three years' yearly profit growth, both positive)
    const valuation = quarters && row ? { marketCapCr: row.marketCapCr ?? null, pe: row.pe ?? null, peg: row.pe > 0 && row.profitGrowth3y > 0 ? row.pe / row.profitGrowth3y : null } : null;
    return { item: { ...item, quote: quoteOf(row) }, more: announced(item.symbol), news: recent, quarters, valuation, asOf };
  }
  return { item, companies: (item.companies ?? []).map(q => ({ ...q, announced: announced(q.symbol).slice(0, 2) })), asOf, ...(await headlineContext(item, items, bySymbol)) };
}

// ---- Around a headline --------------------------------------------------------

// A headline's page shows only the app's own figures beside it (24 Oct 2026,
// "I should be able to see something here in the app itself"; the story stays
// on the publisher's site): the market that day, the sectors it's about and
// their biggest moves, the same story elsewhere, and related headlines.

// What a headline is about, by its words: [pattern, the board's index]
const TOPICS = [
  [/\bpsu banks?\b|public sector banks?/i, "Nifty PSU Bank"],
  [/\bprivate banks?\b/i, "Nifty Private Bank"],
  [/\bbank(s|ing)?\b|\blenders?\b/i, "Nifty Bank"],
  [/\bnbfcs?\b|financial services|\binsurers?\b|\binsurance\b/i, "Nifty Financial Services"],
  [/\bIT\b|\btech (stocks|sector|companies|shares|majors?)\b|\bsoftware\b|\bit services\b/, "Nifty IT"],
  [/\bauto(mobile|makers?|s)?\b|\bcars?\b|two-wheelers?|\bev\b|electric vehicles?/i, "Nifty Auto"],
  [/\bpharma(ceutical)?s?\b|\bdrug(maker)?s?\b/i, "Nifty Pharma"],
  [/\bhealthcare\b|\bhospitals?\b/i, "Nifty Healthcare Index"],
  [/\bmetals?\b|\bsteel\b|\balumin(i)?um\b|\bcopper\b|\bmining\b/i, "Nifty Metal"],
  [/\bfmcg\b|consumer goods/i, "Nifty FMCG"],
  [/\brealty\b|real estate|\bhousing\b|\bdevelopers?\b/i, "Nifty Realty"],
  [/\boil (& |and )?gas\b|\bomcs?\b|oil marketing|\brefiners?\b|\boil (stocks|companies|majors?)\b/i, "Nifty Oil & Gas"],
  [/\bpower\b|\belectricity\b|\butilit(y|ies)\b/i, "Nifty Power"],
  [/\benergy\b|\brenewables?\b|\bsolar\b/i, "Nifty Energy"],
  [/\bdefen[cs]e\b/i, "Nifty India Defence"],
  [/\bcement\b/i, "Nifty Cement"],
  [/\bmedia\b|\bentertainment\b/i, "Nifty Media"],
  [/\bchemicals?\b/i, "Nifty Chemicals"],
  [/\bcapital markets?\b|\bbrokers?\b|\bamcs?\b|\bexchanges?\b/i, "Nifty Capital Markets"],
  [/\binfra(structure)?\b/i, "Nifty Infrastructure"],
  [/consumer durables?/i, "Nifty Consumer Durables"],
];
export function headlineTopics(title, namedSectorIndices = []) {
  const out = [];
  for (const [re, name] of TOPICS) if (re.test(title) && !out.includes(name)) out.push(name);
  for (const name of namedSectorIndices) if (name && !out.includes(name)) out.push(name);
  return out.slice(0, 2);
}

// The other headlines that share most of its words (not the same story)
export function relatedHeadlines(item, headlines, max = 5) {
  const mine = words(item.title);
  return headlines
    .filter(h => h.id !== item.id)
    .map(h => { let n = 0; for (const w of words(h.title)) if (mine.has(w)) n++; return [n, h]; })
    .filter(([n]) => n >= 2)
    .sort((a, b) => b[0] - a[0] || b[1].time.localeCompare(a[1].time))
    .slice(0, max).map(([, h]) => h);
}

// A sector's companies over ₹1,000 crore that moved most on the day
function sectorMovers(indexName, rows) {
  const members = rows.filter(r => r.sectorIndex === indexName && r.ret1d != null && r.marketCapCr >= LARGE_CR);
  const by = [...members].sort((a, b) => b.ret1d - a.ret1d);
  const q = r => quoteOf(r);
  return { companies: members.length, gainers: by.filter(r => r.ret1d > 0).slice(0, 3).map(q), losers: by.filter(r => r.ret1d < 0).reverse().slice(0, 3).map(q) };
}

const MARKET_SHOWN = ["Nifty 50", "Nifty Bank", "NIFTY Midcap 100", "NIFTY Smallcap 100"];
async function headlineContext(item, items, bySymbol) {
  const board = await exploreBoard().catch(() => null);
  const all = [...(board?.market ?? []), ...(board?.sectors ?? [])];
  const card = name => all.find(i => i.name.toLowerCase() === name.toLowerCase()) ?? null;
  const market = MARKET_SHOWN.map(card).filter(Boolean);
  const named = (item.companies ?? []).map(c => bySymbol.get(c.symbol)?.sectorIndex);
  const rows = [...bySymbol.values()];
  const sectors = headlineTopics(item.title, named).map(name => ({ name, index: card(name), ...sectorMovers(name, rows) }))
    .filter(s => s.index || s.companies);
  const headlines = items.filter(i => i.type === "headline");
  return {
    boardAsOf: board?.asOf ?? null,
    market,
    sectors,
    others: item.others ?? [],
    related: relatedHeadlines(item, headlines).map(listed),
  };
}
