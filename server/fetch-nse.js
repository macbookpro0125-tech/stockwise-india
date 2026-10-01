// NSE's public corporate-filings API, not Screener.in. Reachable with a plain
// request and a normal browser User-Agent — no login, no IP block.
//
// Financials come from SEBI's Integrated Filing system, mandatory from Q4
// FY2024-25. The older /api/corporates-financial-results endpoint stopped
// receiving filings at Q3 FY25 (Dec 2024) — reading it in Sep 2026 returned
// ~20-month-old earnings for every company, priced against today's CMP.
// Same XBRL tag names in both; only the namespace prefix changed
// (in-bse-fin -> in-capmkt), so tags are matched namespace-agnostically.
import { fetchShareholding } from "./fetch-shareholding.js";

export const NSE_BASE = "https://www.nseindia.com";
export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const MAX_FILINGS_TO_SCAN = 5; // a year's worth of quarters, plus one revision

export async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`NSE API ${url} -> HTTP ${res.status}`);
  return res.json();
}

export async function fetchXbrl(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`XBRL fetch ${url} -> HTTP ${res.status}`);
  return res.text();
}

// "31-MAR-2026", "31-Mar-2024", or a timestamp like "12-Apr-2024 21:04" -> Date (UTC midnight)
export function parseQeDate(s) {
  const m = String(s || "").match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!m || MONTHS[m[2].toUpperCase()] == null) return null;
  return new Date(Date.UTC(Number(m[3]), MONTHS[m[2].toUpperCase()], Number(m[1])));
}

export function parseContexts(xml) {
  const out = {};
  for (const m of xml.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)) {
    const body = m[2];
    const start = body.match(/<xbrli:startDate>([^<]+)/)?.[1];
    const end = body.match(/<xbrli:endDate>([^<]+)/)?.[1];
    const instant = body.match(/<xbrli:instant>([^<]+)/)?.[1];
    out[m[1]] = {
      start, end, instant,
      dimensional: /<xbrli:(segment|scenario)>/.test(body),
      days: start && end ? (new Date(end) - new Date(start)) / 86400000 + 1 : 0,
    };
  }
  return out;
}

// Which period a fact covers is carried only by its context — the same tag
// appears once for the quarter, once year-to-date, once for the prior year.
// Resolve by the context's actual dates, not its id ("OneD"/"FourD"), since
// ids are filer-generated and "FourD" means 9 months in a Q3 filing.
export function facts(xml, contexts, tag) {
  const re = new RegExp(`<[a-z-]+:${tag}\\b[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)<`, "g");
  const out = [];
  for (const m of xml.matchAll(re)) {
    const ctx = contexts[m[1]];
    if (!ctx || ctx.dimensional) continue;
    out.push({ ...ctx, id: m[1], value: Number(m[2]) });
  }
  return out;
}


// Bump when the stored shape changes — fetch-market.js re-fetches any file on
// an older schema instead of treating it as done.
export const SCHEMA = 4; // 3: capex, current liabilities, cost of goods, long-term debt (FCF, Piotroski); 4: lease liabilities
const YEARS = 6; // 5-year growth needs six year-ends
const DOWNLOAD_CONCURRENCY = 3;

// Banks and NBFCs file on different templates with their own tag names for the
// same concepts — the first candidate with any facts wins.
export const TAGS = {
  revenue: ["RevenueFromOperations", "Income", "TotalIncome"],
  profit: ["ProfitLossForPeriod", "ProfitLossForThePeriod"],
  eps: [
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
    "BasicEarningsPerShareBeforeExtraordinaryItems",
    "BasicEarningsLossPerShareFromContinuingOperations",
  ],
  expenses: ["Expenses"],
  financeCosts: ["FinanceCosts"],
  depreciation: ["DepreciationDepletionAndAmortisationExpense"],
  otherIncome: ["OtherIncome"],
  pbt: ["ProfitBeforeTax", "ProfitLossFromOrdinaryActivitiesBeforeTax"],
  ocf: ["CashFlowsFromUsedInOperatingActivities"],
  totalAssets: ["EquityAndLiabilities", "CapitalAndLiabilities"],
  currentAssets: ["CurrentAssets"],
  paidUp: ["PaidUpValueOfEquityShareCapital"],
  faceValue: ["FaceValueOfEquityShareCapital"],
  // Free cash flow and the Piotroski score. Capex is filed as a positive
  // outflow. Cost of goods = materials + goods bought for resale + change in
  // inventories (negative when stock built up) — Ind AS companies only.
  capexPpe: ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  capexIntangibles: ["PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities"],
  currentLiabilities: ["CurrentLiabilities"],
  longTermDebt: ["BorrowingsNoncurrent"],
  materials: ["CostOfMaterialsConsumed"],
  purchases: ["PurchasesOfStockInTrade"],
  inventoryChange: ["ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade"],
};

export function firstFacts(xml, contexts, tags) {
  for (const tag of tags) {
    const found = facts(xml, contexts, tag);
    if (found.length) return found;
  }
  return [];
}

function valueById(xml, tags, contextId) {
  for (const tag of tags) {
    const m = xml.match(new RegExp(`<[a-z-]+:${tag}\\b[^>]*?contextRef="${contextId}"[^>]*>([^<]*)<`));
    if (m) return Number(m[1]);
  }
  return null;
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export function templateOf(xbrlUrl) {
  const file = String(xbrlUrl).split("/").pop().toUpperCase();
  if (file.includes("BANKING")) return "BANKING";
  if (file.includes("NBFC")) return "NBFC";
  if (file.includes("INSURANCE")) return "INSURANCE";
  return "INDAS";
}

// One interface over both filing formats. Integrated filings date their XBRL
// contexts correctly, so periods are resolved by date. The legacy utility
// always uses fixed ids ("FourD" = year to date, "OneI" = balance sheet) but
// its dates can't be trusted: FY24 files write the quarter's start date on
// "FourD", and FY22-era files reference contexts they never define. So legacy
// files are read by id, with the end-date check kept where the context exists
// and a sanity check that the "year" column's revenue really is a year's.
function reader(xml, row) {
  const ctx = parseContexts(xml);
  const end = isoDay(row.periodEnd);
  if (row.legacy) {
    const revYear = valueById(xml, TAGS.revenue, "FourD");
    const revQuarter = valueById(xml, TAGS.revenue, "OneD");
    const yearOk = (!ctx.FourD?.end || ctx.FourD.end === end) &&
      !(revYear != null && revQuarter != null && !(revYear > 1.5 * revQuarter));
    const instantOk = !ctx.OneI?.instant || ctx.OneI.instant === end;
    return {
      year: tags => (yearOk ? valueById(xml, tags, "FourD") : null),
      atEnd: tags => (instantOk ? valueById(xml, tags, "OneI") : null),
      any: tags => valueById(xml, tags, "FourD") ?? valueById(xml, tags, "OneD"),
    };
  }
  return {
    year: tags => firstFacts(xml, ctx, tags)
      .filter(f => f.end === end && f.days >= 350)
      .sort((a, b) => b.days - a.days)[0]?.value ?? null,
    atEnd: tags => firstFacts(xml, ctx, tags).find(f => f.instant === end)?.value ?? null,
    any: tags => firstFacts(xml, ctx, tags).find(f => f.end === end)?.value ?? null,
  };
}

function sumKnown(...values) {
  const known = values.filter(v => v != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

function equityOf(r) {
  const equity = r.atEnd(["Equity"]);
  if (equity != null) return equity;
  // Bank template: no single Equity line — capital plus reserves
  const capital = r.atEnd(["Capital"]);
  const reserves = r.atEnd(["ReservesAndSurplus"]);
  return capital != null && reserves != null ? capital + reserves : null;
}

// Lenders spread debt over several lines. Counting only "Borrowings" (the old
// code) put Bajaj Finance at 1.46x debt/equity when its filing shows 3.72x —
// debt securities, deposits and subordinated debt are all debt. Bank deposits
// count too, which is why banks run 5–10x (the original app's own hint).
// null = unknown, never a guessed 0: Bajaj Finance's FY23 filing tags only
// total liabilities, and reading that as "no debt" made an NBFC debt-free.
function debtOf(r, template) {
  if (template === "BANKING") return sumKnown(r.atEnd(["Borrowings"]), r.atEnd(["Deposits"]));
  if (template === "NBFC") {
    return sumKnown(r.atEnd(["DebtSecurities"]), r.atEnd(["Borrowings"]), r.atEnd(["Deposits"]), r.atEnd(["SubordinatedLiabilities"]));
  }
  const current = r.atEnd(["BorrowingsCurrent"]);
  const noncurrent = r.atEnd(["BorrowingsNoncurrent"]);
  if (current != null || noncurrent != null) return (current ?? 0) + (noncurrent ?? 0);
  const borrowings = r.atEnd(["Borrowings"]);
  if (borrowings != null) return borrowings;
  // No borrowing line at all means debt-free only when the balance sheet is
  // itemised; an aggregates-only filing just doesn't say.
  const itemised = r.atEnd(["CurrentLiabilities"]) != null || r.atEnd(["NoncurrentLiabilities"]) != null;
  return itemised ? 0 : null;
}

// Lease liabilities — what Ind AS 116 books for rented shops, offices and
// aircraft. Screener counts them as borrowings, and their interest is already
// in finance costs, so leaving them out made debt-free retailers of companies
// with hundreds of crores of rent to pay: Cantabil's Rs 544 Cr put its ROCE at
// 40% (Screener 19%). Filings itemise them inside "other financial
// liabilities", each item with a description on its own context. null when
// the filing has no such itemisation: unknown, not "no leases".
const LEASE_PARENTS = ["OtherNoncurrentFinancialLiabilities", "OtherCurrentFinancialLiabilities"];
function leasesOf(xml, row) {
  if (row.legacy) return null;
  const ctx = parseContexts(xml);
  const end = isoDay(row.periodEnd);
  let itemised = false, total = 0;
  for (const parent of LEASE_PARENTS) {
    const descRe = new RegExp(`<[a-z-]+:DescriptionOf${parent}\\b[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)<`, "g");
    for (const [, id, text] of xml.matchAll(descRe)) {
      if (ctx[id]?.instant !== end) continue;
      itemised = true;
      if (!/lease/i.test(text)) continue;
      const m = xml.match(new RegExp(`<[a-z-]+:${parent}\\b[^>]*?contextRef="${id}"[^>]*>([^<]*)<`));
      if (m && Number.isFinite(Number(m[1]))) total += Number(m[1]);
    }
  }
  return itemised ? total : null;
}

// `template` is the company's, taken from its latest filing: older legacy
// files don't reliably name the template (Bajaj Finance's FY23 file reads as
// an ordinary company, which put its debt at 0), and a company's business type
// doesn't change year to year.
function extractYear(xml, row, template = templateOf(row.xbrl)) {
  const r = reader(xml, row);
  const equity = equityOf(r);
  return {
    fyEnd: isoDay(row.periodEnd),
    label: row.label,
    scope: row.scope,
    source: row.legacy ? "legacy" : "integrated",
    filed: row.filed ? isoDay(row.filed) : null,
    template,
    revenue: r.year(TAGS.revenue),
    profit: r.year(TAGS.profit),
    eps: r.year(TAGS.eps),
    expenses: r.year(TAGS.expenses),
    financeCosts: r.year(TAGS.financeCosts),
    depreciation: r.year(TAGS.depreciation),
    otherIncome: r.year(TAGS.otherIncome),
    pbt: r.year(TAGS.pbt),
    ocf: r.year(TAGS.ocf),
    // FY22-era legacy filings carry no balance sheet: equity is null there, and
    // debt must be null too rather than a "0" that reads as debt-free.
    equity,
    debt: equity == null ? null : debtOf(r, template),
    totalAssets: r.atEnd(TAGS.totalAssets),
    currentAssets: r.atEnd(TAGS.currentAssets),
    paidUp: r.any(TAGS.paidUp),
    faceValue: r.any(TAGS.faceValue),
    // null when neither purchase line is filed — unknown, not "spent nothing",
    // or free cash flow would come out as the whole operating cash flow.
    capex: sumKnown(r.year(TAGS.capexPpe), r.year(TAGS.capexIntangibles)),
    currentLiabilities: r.atEnd(TAGS.currentLiabilities),
    longTermDebt: equity == null ? null : r.atEnd(TAGS.longTermDebt) ?? (r.atEnd(TAGS.currentLiabilities) != null ? 0 : null),
    cogs: sumKnown(r.year(TAGS.materials), r.year(TAGS.purchases), r.year(TAGS.inventoryChange)),
    // Lenders' leases are a rounding error next to their deposits and bonds
    leases: template === "INDAS" ? leasesOf(xml, row) : null,
  };
}

function durationFact(list, pick) {
  const current = list.filter(f => f.days > 0);
  if (!current.length) return null;
  const latestEnd = current.map(f => f.end).sort().at(-1); // drop prior-year comparatives
  const sameEnd = current.filter(f => f.end === latestEnd).sort((a, b) => a.days - b.days);
  return pick === "shortest" ? sameEnd[0] : sameEnd.at(-1);
}

export async function integratedFilings(symbol) {
  const json = await fetchJson(
    `${NSE_BASE}/api/integrated-filing-results?symbol=${encodeURIComponent(symbol)}&type=Integrated%20Filing-%20Financials&page=1&size=50`
  );
  const rows = (json.data || []).filter(r => r.xbrl && /\.xml$/i.test(r.xbrl));

  // A revision supersedes the original for the same period and scope.
  const latest = new Map();
  for (const r of rows) {
    const key = `${r.qe_Date}|${r.consolidated}`;
    const prev = latest.get(key);
    if (!prev || new Date(r.creation_Date) > new Date(prev.creation_Date)) latest.set(key, r);
  }

  // Newest period first; within a period Consolidated (the group-wide
  // picture) before Standalone. Ordering by period date, not by type, is
  // what stops a company that stopped consolidating from resolving to a
  // years-old Consolidated filing (ALKYLAMINE, found live).
  return [...latest.values()].sort((a, b) =>
    parseQeDate(b.qe_Date) - parseQeDate(a.qe_Date) ||
    (a.consolidated === "Consolidated" ? -1 : 1) - (b.consolidated === "Consolidated" ? -1 : 1)
  );
}

function integratedRow(r) {
  return {
    periodEnd: parseQeDate(r.qe_Date),
    label: String(r.qe_Date).toUpperCase(),
    scope: r.consolidated,
    xbrl: r.xbrl,
    filed: parseQeDate(r.creation_Date || r.broadcast_Date),
    legacy: false,
  };
}

// The pre-2025 endpoint: frozen at Q3 FY25, but it holds every earlier
// year-end, which is where 3- and 5-year history comes from.
async function legacyAnnualRows(symbol) {
  const rows = await fetchJson(
    `${NSE_BASE}/api/corporates-financial-results?index=equities&period=Annual&symbol=${encodeURIComponent(symbol)}`
  ).catch(() => []);
  return (Array.isArray(rows) ? rows : []).filter(r => r.xbrl && /\.xml$/i.test(r.xbrl)).map(r => ({
    periodEnd: parseQeDate(r.toDate),
    label: String(r.toDate).toUpperCase(),
    scope: r.consolidated === "Consolidated" ? "Consolidated" : "Standalone",
    xbrl: r.xbrl,
    filed: parseQeDate(r.filingDate || r.broadCastDate),
    legacy: true,
  })).filter(r => r.periodEnd);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

async function fetchFinancials(symbol) {
  const integrated = await integratedFilings(symbol);
  const seen = new Set();
  const periods = integrated.filter(f => (seen.has(f.qe_Date) ? false : seen.add(f.qe_Date)));
  if (!periods.length) throw new Error(`No Integrated Filing financials for ${symbol}`);

  // Walk back from the newest filing to the fiscal year-end one — found by a
  // year-to-date period of a full year, not by assuming a March year-end
  // (P&G Hygiene and Gillette close their year in June).
  let quarter = null;
  let latestYear = null;
  let latestRow = null;
  for (const filing of periods.slice(0, MAX_FILINGS_TO_SCAN)) {
    const xml = await fetchXbrl(filing.xbrl);
    const ctx = parseContexts(xml);
    const profit = firstFacts(xml, ctx, TAGS.profit);

    if (!quarter) {
      quarter = {
        periodEnded: filing.qe_Date,
        scope: filing.consolidated,
        revenueQuarter: durationFact(firstFacts(xml, ctx, TAGS.revenue), "shortest")?.value ?? null,
        profitQuarter: durationFact(profit, "shortest")?.value ?? null,
        epsQuarter: durationFact(firstFacts(xml, ctx, TAGS.eps), "shortest")?.value ?? null,
      };
    }
    const ytd = durationFact(profit, "longest");
    if (ytd && ytd.days >= 350) {
      latestRow = integratedRow(filing);
      latestYear = extractYear(xml, latestRow);
      break;
    }
  }
  if (!latestYear) throw new Error(`No full-year filing among ${symbol}'s recent Integrated Filings`);

  // Earlier year-ends from both systems, filtered to this company's fiscal
  // year-end so a past change of year-end doesn't mix bases.
  const monthDay = latestRow.label.split("-").slice(0, 2).join("-");
  const candidates = [
    ...integrated.map(integratedRow),
    ...(await legacyAnnualRows(symbol)),
  ].filter(r => r.periodEnd && r.periodEnd < latestRow.periodEnd && r.label.startsWith(monthDay));
  candidates.sort((a, b) =>
    b.periodEnd - a.periodEnd ||
    (a.scope === "Consolidated" ? -1 : 1) - (b.scope === "Consolidated" ? -1 : 1) ||
    (b.filed ?? 0) - (a.filed ?? 0)
  );
  const byYear = new Set();
  const earlier = candidates.filter(r => !byYear.has(isoDay(r.periodEnd)) && byYear.add(isoDay(r.periodEnd))).slice(0, YEARS - 1);

  const earlierYears = await mapLimit(earlier, DOWNLOAD_CONCURRENCY, async row => {
    try {
      return extractYear(await fetchXbrl(row.xbrl), row, latestYear.template);
    } catch (e) {
      return { fyEnd: isoDay(row.periodEnd), label: row.label, error: e.message };
    }
  });

  return { quarter, years: [latestYear, ...earlierYears] };
}

// A distressed company can have negative net worth (accumulated losses
// exceeding paid-up capital) — AHLWEST is a real example. profit/negative-
// equity flips sign into a nonsense "415% ROE", and debt/negative-equity does
// the same for Debt-to-Equity. Both are undefined when equity isn't positive,
// so null them rather than let a loss-making company read as a compounder.
export async function fetchStockSummary(symbol) {
  const [{ quarter, years }, holding] = await Promise.all([
    fetchFinancials(symbol),
    fetchShareholding(symbol),
  ]);
  const latest = years[0];

  const hasPositiveEquity = latest.equity > 0;
  // ROE from the audited full-year profit over year-end equity — the same
  // basis Screener reports, not a single quarter scaled x4.
  const roe = hasPositiveEquity && latest.profit != null ? latest.profit / latest.equity : null;
  const debtToEquity = hasPositiveEquity && latest.debt != null ? latest.debt / latest.equity : null;

  return {
    symbol,
    schema: SCHEMA,
    template: latest.template,
    pnl: quarter,
    annual: { yearEnded: latest.label, scope: latest.scope, revenue: latest.revenue, profit: latest.profit, eps: latest.eps },
    balanceSheet: {
      yearEnded: latest.label,
      netWorth: latest.equity,
      totalAssets: latest.totalAssets,
      totalDebt: latest.debt,
      currentAssets: latest.currentAssets,
    },
    years,
    holding,
    roe,
    debtToEquity,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const symbol = process.argv[2] || "WIPRO";
  const summary = await fetchStockSummary(symbol);
  console.log(JSON.stringify(summary, null, 2));
}
