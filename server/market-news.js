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
  if (/press release/i.test(s) && /financial results|quarterly (net )?profit|q[1-4] ?fy|quarter (and half year )?ended|half year ended/i.test(summary)) return "results";
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
      if (kept.some(k => sameStory(k.words, w))) continue;
      kept.push({ words: w, title: clean, publisher: source || null, url: link, time: time.toISOString() });
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
  const [nse, heads] = await Promise.allSettled([announcements(), headlines()]);
  const metrics = allMetrics();
  const sources = [nse.status === "fulfilled" ? nse.value : nse.reason, heads.status === "fulfilled" ? heads.value : heads.reason, metrics.version];
  if (built && built.sources.every((v, i) => v === sources[i])) return built.value;
  const value = buildFeed(nse, heads, metrics.rows ?? []);
  built = { sources, value };
  return value;
}

function buildFeed(nse, heads, rows) {
  // the day the prices beside each item are from
  const asOf = loadMarketSnapshot()?.pricesDate ?? null;
  const bySymbol = new Map(rows.map(r => [r.symbol, r]));
  const index = indexNow();
  const filings = (nse.status === "fulfilled" ? nse.value : []).map(f => {
    const row = bySymbol.get(f.symbol);
    return { ...f, quote: quoteOf(row), numbers: f.kind === "results" ? resultNumbers(row, f.time) : null };
  });
  const news = heads.status === "fulfilled" ? heads.value : [];
  const items = [
    ...sameDayTogether(filings),
    ...news.map(h => ({ ...h, companies: namedCompanies(h.title, index).map(s => quoteOf(bySymbol.get(s))).filter(Boolean) })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const unread = [nse.status === "rejected" ? "NSE's announcements" : null, heads.status === "rejected" ? "the headlines" : null].filter(Boolean);
  return { items, unread, asOf, filings, bySymbol };
}

const listed = ({ quote, ...item }) => ({ ...item, summary: item.summary && item.summary.length > 240 ? `${item.summary.slice(0, 239).trimEnd()}…` : item.summary ?? null, quote });

// A page of the feed: one kind, or the watchlist's companies, newest first;
// `before` is the last item's time and id
// Companies under ₹1,000 crore are a quarter of the announcements and seldom
// news to most readers: left out unless asked for (`size: "all"`); a
// watchlist's companies are always in
export const LARGE_CR = 1000;
export async function marketNews({ kind = "all", symbols = null, before = null, size = "large" } = {}) {
  const { items: everything, unread, asOf } = await feed();
  const items = size === "all" || kind === "watchlist" ? everything : everything.filter(i => i.type !== "filing" || (i.quote?.marketCapCr ?? 0) >= LARGE_CR || symbols?.has(i.symbol));
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
  return { items: page, next: list.length > PAGE && last ? `${last.time}|${last.id}` : null, unread, kinds: KINDS, counts, asOf, size };
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
      ? row.quarters.slice(0, 8).map(q => ({ end: q.fyEnd, salesCr: q.revenueCr ?? null, profitCr: q.profitCr ?? null, opm: q.opm ?? null, salesYoY: q.salesYoY ?? null, profitYoY: q.profitYoY ?? null }))
      : null;
    return { item: { ...item, quote: quoteOf(row) }, more: announced(item.symbol), news: recent, quarters, asOf };
  }
  return { item, companies: (item.companies ?? []).map(q => ({ ...q, announced: announced(q.symbol).slice(0, 2) })), asOf };
}
