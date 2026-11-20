// A company's yearly results from before NSE's machine-readable (XBRL)
// filings, for ten years on its page (20 Nov 2026). NSE's older results list
// links each year to a page of its own (financial_res_<SYMBOL>_<n>.html): a
// table of "line = amount", typed in at the time — and not always right (TCS
// FY2017's "Finance costs" repeats its tax; its "Reserves" is in the wrong
// unit). So only sales, net profit and EPS are taken, and a year only when
// the page's own sums agree (profit before tax − tax = net profit) and its
// size is in line with the year after it. Kept apart from the years the
// scores use (stock.olderYears), never mixed into them.
import { NSE_BASE, fetchJson, parseQeDate } from "./fetch-nse.js";
import { fetchText } from "./upstream.js";

export const OLDER_VERSION = 1;
const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0; educational)";
const PAGE = /^https:\/\/nsearchives\.nseindia\.(com|in)\/archives\/financial_results\/financial_res_[A-Za-z0-9&%_-]+\.html$/;
const UNITS = [[/crore/i, 1e7], [/lakh|lac/i, 1e5], [/million/i, 1e6], [/thousand/i, 1e3]];

const num = s => { const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };

// The page's lines as [label, value], in order, up to the segment tables
export function oldResultLines(html) {
  const text = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  const cells = [...text.matchAll(/<td[\s\S]*?<\/td>/gi)]
    .map(m => m[0].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const out = [];
  const isNum = c => /^-?[\d,]+(\.\d+)?$/.test(c);
  for (let i = 0; i < cells.length - 1; i++) {
    if (isNum(cells[i]) || !isNum(cells[i + 1])) continue;
    if (/segment/i.test(cells[i])) break;
    out.push([cells[i], num(cells[i + 1])]);
  }
  return out;
}

// { unitRupees, revenue, profit, profitOwners, pbt, tax, eps } in rupees (EPS
// in rupees a share), or null when the page isn't a results table
export function parseOldResults(html, { bank = false } = {}) {
  const unitText = /Amount\s*\(([^)]*)\)/i.exec(String(html))?.[1] ?? "";
  const unit = UNITS.find(([re]) => re.test(unitText))?.[1] ?? null;
  const lines = oldResultLines(html);
  if (!unit || lines.length < 8) return null;
  const first = re => lines.find(([l]) => re.test(l))?.[1] ?? null;
  const revenueRaw = bank
    ? first(/^total income$/i)
    : first(/^total income from operations/i) ?? first(/net sales\/income from operations/i) ?? first(/^revenue from operations/i);
  const netRaw = first(/^net profit.{0,20}for the period/i) ?? first(/^profit.{0,12}for the period/i);
  const ownersRaw = first(/^consolidated net profit/i);
  const pbtRaw = first(/before tax/i);
  const taxRaw = first(/^tax expense/i);
  const eps = first(/^basic eps.{0,40}(?:after extraordinary|continuing operations)/i) ?? first(/^basic eps/i);
  const r = v => (v == null ? null : v * unit);
  return { unitRupees: unit, revenue: r(revenueRaw), profit: r(netRaw), profitOwners: r(ownersRaw), pbt: r(pbtRaw), tax: r(taxRaw), eps };
}

// The page's own sums agree, and the figures are there
export function saneOldYear(y) {
  if (!y || !(y.revenue > 0) || y.profit == null) return false;
  if (y.pbt != null && y.tax != null) {
    const gap = Math.abs(y.pbt - y.tax - y.profit);
    if (gap > Math.max(Math.abs(y.profit) * 0.03, y.revenue * 0.002)) return false;
  }
  // EPS, when given, has the profit's sign
  if (y.eps != null && y.eps !== 0 && Math.sign(y.eps) !== Math.sign(y.profitOwners ?? y.profit)) return false;
  return true;
}

// Each year's page for the company's year-end and scope, before `before`
// (the first XBRL year), newest first: NSE's older results list
export async function olderYearPages(symbol, { before, monthDay, scope }) {
  const rows = await fetchJson(`${NSE_BASE}/api/corporates-financial-results?index=equities&period=Annual&symbol=${encodeURIComponent(symbol)}`).catch(() => []);
  const want = scope === "Consolidated" ? "Consolidated" : "Non-Consolidated";
  const byYear = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (r.xbrl && /\.xml$/i.test(r.xbrl)) continue;
    if (!PAGE.test(r.resultDetailedDataLink ?? "") || r.consolidated !== want) continue;
    const end = parseQeDate(r.toDate);
    const label = String(r.toDate).toUpperCase();
    if (!end || !(end < before) || !label.startsWith(monthDay)) continue;
    const iso = end.toISOString().slice(0, 10);
    const prev = byYear.get(iso);
    // a revision supersedes the first filing
    if (!prev || String(r.broadCastDate) > String(prev.broadCastDate)) byYear.set(iso, { ...r, iso });
  }
  return [...byYear.values()].sort((a, b) => b.iso.localeCompare(a.iso));
}

// Up to `want` older years, newest first, each checked against its own sums
// and against the year after it (a tenth to ten times its sales: a page in
// the wrong unit is left out, and so is everything before it)
export async function olderYearsFor(symbol, { firstYear, scope, bank = false, want = 3, getPage = null, notBefore = null }) {
  const before = new Date(`${firstYear.fyEnd}T00:00:00Z`);
  const monthDay = String(firstYear.label ?? "").split("-").slice(0, 2).join("-") || `${String(before.getUTCDate()).padStart(2, "0")}-${before.toLocaleString("en", { month: "short", timeZone: "UTC" }).toUpperCase()}`;
  // ten years is the aim: a year from long before (Bharti Airtel: 2016, then 2008) isn't one of them
  const pages = (await olderYearPages(symbol, { before, monthDay, scope })).filter(p => !notBefore || p.iso >= notBefore).slice(0, want + 2);
  const fetchPage = getPage ?? (url => fetchText(url, { headers: { "User-Agent": UA }, service: "NSE results archive", maxBytes: 2 * 1024 * 1024, timeoutMs: 15_000, notFoundAsNull: true }));
  const out = [];
  let next = firstYear.revenue > 0 ? firstYear.revenue : null;
  for (const p of pages) {
    if (out.length >= want) break;
    let html;
    try { html = await fetchPage(p.resultDetailedDataLink); } catch { break; }
    if (!html || /doesn't appear to exist/i.test(html)) continue;
    const y = parseOldResults(html, { bank });
    if (!saneOldYear(y)) continue;
    if (next && (y.revenue < next / 10 || y.revenue > next * 10)) break;
    out.push({
      fyEnd: p.iso, scope, revenue: y.revenue, profit: y.profit, profitOwners: y.profitOwners ?? null, eps: y.eps ?? null,
      basis: /non-ind-as/i.test(p.indAs ?? "") ? "Indian GAAP" : "Ind AS", source: p.resultDetailedDataLink,
    });
    next = y.revenue;
  }
  return out;
}

// The evening job's batch (scripts/refresh-data.mjs): companies whose older
// years haven't been read at this version, biggest first, `batch` a run.
// Each company's file gets olderYears (maybe empty) and olderVersion, so it
// isn't asked again; one that NSE refuses is left for the next run.
export async function backfillOlderResults({ batch = 250, pauseMs = 400, log = console.log } = {}) {
  const { allMetrics, getStock, saveStock } = await import("./screen.js");
  const rows = [...allMetrics().rows].sort((a, b) => (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
  const todo = rows.filter(r => getStock(r.symbol)?.olderVersion !== OLDER_VERSION).slice(0, batch);
  let found = 0, done = 0, refused = 0;
  for (const r of todo) {
    const stock = getStock(r.symbol);
    const years = stock?.years ?? [];
    if (!years.length || stock.error) continue;
    try {
      const want = Math.max(0, Math.min(5, 11 - years.length));
      // no further back than eleven years before the latest year
      const latest = years[0].fyEnd;
      const notBefore = `${Number(latest.slice(0, 4)) - 11}${latest.slice(4)}`;
      const olderYears = want ? await olderYearsFor(r.symbol, { firstYear: years.at(-1), scope: years[0].scope ?? years.at(-1).scope, bank: stock.template === "BANKING", want, notBefore }) : [];
      saveStock(r.symbol, { ...getStock(r.symbol), olderYears, olderVersion: OLDER_VERSION });
      if (olderYears.length) found++;
      done++;
    } catch (e) {
      if (++refused >= 5) { log(`older results: stopped (${e.message})`); break; }
    }
    if (pauseMs) await new Promise(res => setTimeout(res, pauseMs));
  }
  log(`older results: ${done} companies read, ${found} with older years; ${rows.filter(x => getStock(x.symbol)?.olderVersion !== OLDER_VERSION).length} left`);
  return { done, found };
}
