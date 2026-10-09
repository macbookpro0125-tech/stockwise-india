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
import { fetchJson as requestJson, fetchText as requestText } from "./upstream.js";

export const NSE_BASE = "https://www.nseindia.com";
export const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const MAX_FILINGS_TO_SCAN = 5; // a year's worth of quarters, plus one revision

export async function fetchJson(url) {
  return requestJson(url, { headers: { "User-Agent": UA, Accept: "application/json" }, service: "NSE", maxBytes: 25 * 1024 * 1024 });
}

export async function fetchXbrl(url) {
  return requestText(url, { headers: { "User-Agent": UA }, service: "NSE XBRL", maxBytes: 25 * 1024 * 1024 });
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
export const SCHEMA = 8; // 3: capex, current liabilities, cost of goods, long-term debt (FCF, Piotroski); 4: lease liabilities; 5: cash and liquid investments, promoter history; 6: audit opinion and auditor; 7: profit and equity attributable to the parent's shareholders; 8: twelve quarters and eight years
// Eight year-ends: NSE's XBRL filings reach back to FY2019 (FY19–FY24 on the
// old endpoint, FY25 on in integrated filings); 5-year growth needs six
const YEARS = 8;
// Bumped when the bank figures (bankFigures) change shape: only banks are
// re-read for it, not the whole market (fetch-market.js needsSummary)
export const BANK_VERSION = 1;
// Three years of quarters: this quarter against the same one a year ago, two
// years running, and trailing-twelve-month figures
const QUARTERS = 12;
// XBRL files come from NSE's static archive, not its rate-limited API
const DOWNLOAD_CONCURRENCY = 5;

// Banks and NBFCs file on different templates with their own tag names for the
// same concepts — the first candidate with any facts wins.
export const TAGS = {
  revenue: ["RevenueFromOperations", "Income", "TotalIncome"],
  profit: ["ProfitLossForPeriod", "ProfitLossForThePeriod"],
  // The parent's own shareholders' share, without the subsidiaries' outside
  // owners: Bajaj Finserv's ₹19,669 Cr FY26 profit is ₹9,801 Cr to its own
  // shareholders — what its EPS (₹61.3) is worked out on. Banks file it as
  // profit after minority interest and associates.
  profitOwners: ["ProfitOrLossAttributableToOwnersOfParent", "ProfitLossAttributableToOwnersOfParent", "ProfitLossAfterTaxesMinorityInterestAndShareOfProfitLossOfAssociates"],
  equityOwners: ["EquityAttributableToOwnersOfParent"],
  // Banks file EPS before and after extraordinary items — see pickEps
  eps: [
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
    "BasicEarningsPerShareBeforeExtraordinaryItems",
    "BasicEarningsPerShareAfterExtraordinaryItems",
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
  // Net debt and enterprise value: cash, fixed deposits ("other bank
  // balances") and current investments — mostly liquid funds, which is where
  // companies like TCS keep most of their cash. Ind AS companies only.
  cash: ["CashAndCashEquivalents"],
  bankBalances: ["BankBalanceOtherThanCashAndCashEquivalents"],
  currentInvestments: ["CurrentInvestments"],
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

// The auditor's opinion on the year's results. Every annual filing, old format
// and new, says either "Declaration of unmodified opinion" or — when the
// auditor qualified the accounts — "Statement on impact of audit
// qualification". Text, not numbers, so read straight off the tag; null when
// a filing doesn't say.
const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function textFact(xml, tag) {
  const m = xml.match(new RegExp(`<[a-z-]+:${tag}\\b[^>]*>([^<]+)<`));
  return m ? m[1].trim().replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => XML_ENTITIES[e]) : null;
}
function auditOpinionOf(xml) {
  const t = textFact(xml, "DeclarationOfUnmodifiedOpinionOrStatementOnImpactOfAuditQualification");
  if (!t) return null;
  // "Unqualified" means clean and contains "qualif" — checked first. (Only
  // the two standard phrases and "Not applicable" were seen across 149
  // qualified filings sampled.)
  if (/unmodified|unqualified/i.test(t)) return "unmodified";
  if (/qualif|impact/i.test(t)) return "qualified";
  return null;
}

// `template` is the company's, taken from its latest filing: older legacy
// files don't reliably name the template (Bajaj Finance's FY23 file reads as
// an ordinary company, which put its debt at 0), and a company's business type
// doesn't change year to year.
// When a filing gives more than one EPS and they disagree, the one in line
// with the same filing's profit and share capital is right. Either can be the
// broken one: Indian Overseas Bank's FY26 "before extraordinary items" reads
// ₹16.94 (profit ÷ shares is ₹2.70; "after" says ₹2.81), while Yes Bank's FY23
// "after" holds a quarter's ₹0.07 and Central Bank's FY23 a placeholder 0.
// Without share capital to check against, the first non-zero one, in TAGS
// order, is used.
function pickEps(r, profit, read = r.year) {
  const found = TAGS.eps.map(tag => read([tag])).filter(v => v != null && v !== 0);
  if (found.length < 2 || found.every(v => Math.abs(v - found[0]) <= Math.abs(found[0]) * 0.05)) return found[0] ?? read(TAGS.eps);
  // read as extractYear reads them (filed against the period, not a date)
  const paidUp = r.any(TAGS.paidUp), faceValue = r.any(TAGS.faceValue);
  if (!(profit > 0) || !(paidUp > 0) || !(faceValue > 0)) return found[0];
  const perShare = profit / (paidUp / faceValue);
  return found.filter(v => v > 0).sort((a, b) => Math.abs(Math.log(a / perShare)) - Math.abs(Math.log(b / perShare)))[0] ?? found[0];
}

function extractYear(xml, row, template = templateOf(row.xbrl)) {
  const r = reader(xml, row);
  const equity = equityOf(r);
  const profit = r.year(TAGS.profit);
  // A 0 beside a real profit is an unused box in the template, not a figure
  const nonZero = v => (v === 0 ? null : v);
  const profitOwners = profit ? nonZero(r.year(TAGS.profitOwners)) : r.year(TAGS.profitOwners);
  return {
    fyEnd: isoDay(row.periodEnd),
    label: row.label,
    scope: row.scope,
    source: row.legacy ? "legacy" : "integrated",
    filed: row.filed ? isoDay(row.filed) : null,
    template,
    revenue: r.year(TAGS.revenue),
    profit,
    profitOwners,
    eps: pickEps(r, profitOwners ?? profit),
    expenses: r.year(TAGS.expenses),
    financeCosts: r.year(TAGS.financeCosts),
    depreciation: r.year(TAGS.depreciation),
    otherIncome: r.year(TAGS.otherIncome),
    pbt: r.year(TAGS.pbt),
    ocf: r.year(TAGS.ocf),
    // FY22-era legacy filings carry no balance sheet: equity is null there, and
    // debt must be null too rather than a "0" that reads as debt-free.
    equity,
    equityOwners: equity == null ? null : nonZero(r.atEnd(TAGS.equityOwners)),
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
    // A lender's cash is the stock it lends from, not a cushion against debt.
    // Only where the balance sheet is there (equity known): a filing without
    // one says nothing about cash, and null must not read as "no cash".
    ...(template === "INDAS" && equity != null
      ? { cash: r.atEnd(TAGS.cash), bankBalances: r.atEnd(TAGS.bankBalances), currentInvestments: r.atEnd(TAGS.currentInvestments) }
      : { cash: null, bankBalances: null, currentInvestments: null }),
    auditOpinion: auditOpinionOf(xml),
    // The audit firm's name — integrated filings (FY25 on) only
    auditor: textFact(xml, "AuditorsFirmName"),
  };
}

// One quarter's figures from a quarterly filing: the context ending on the
// quarter's last day that spans a quarter (80–100 days), never the
// year-to-date one beside it; old-format files name it "OneD"
function quarterReader(xml, row) {
  const ctx = parseContexts(xml);
  const end = isoDay(row.periodEnd);
  if (row.legacy) {
    const ok = !ctx.OneD?.end || ctx.OneD.end === end;
    return {
      quarter: tags => (ok ? valueById(xml, tags, "OneD") : null),
      any: tags => valueById(xml, tags, "OneD") ?? valueById(xml, tags, "FourD"),
    };
  }
  return {
    quarter: tags => firstFacts(xml, ctx, tags).find(f => f.end === end && f.days >= 80 && f.days <= 100)?.value ?? null,
    any: tags => firstFacts(xml, ctx, tags).find(f => f.end === end)?.value ?? null,
  };
}

function extractQuarter(xml, row) {
  const r = quarterReader(xml, row);
  const profit = r.quarter(TAGS.profit);
  const owners = r.quarter(TAGS.profitOwners);
  const profitOwners = profit && owners === 0 ? null : owners;
  return {
    qEnd: isoDay(row.periodEnd),
    label: row.label,
    scope: row.scope,
    source: row.legacy ? "legacy" : "integrated",
    filed: row.filed ? isoDay(row.filed) : null,
    revenue: r.quarter(TAGS.revenue),
    expenses: r.quarter(TAGS.expenses),
    financeCosts: r.quarter(TAGS.financeCosts),
    depreciation: r.quarter(TAGS.depreciation),
    otherIncome: r.quarter(TAGS.otherIncome),
    pbt: r.quarter(TAGS.pbt),
    profit,
    profitOwners,
    eps: pickEps(r, profitOwners ?? profit, r.quarter),
    // For the unit-slip check (unit-slips.js): share capital moves with a slip
    paidUp: r.any(TAGS.paidUp),
    faceValue: r.any(TAGS.faceValue),
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

async function legacyQuarterRows(symbol) {
  const rows = await fetchJson(
    `${NSE_BASE}/api/corporates-financial-results?index=equities&period=Quarterly&symbol=${encodeURIComponent(symbol)}`
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

// A bank's own health figures. SEBI's bank format carries them, but only
// the standalone filing fills them in (the consolidated one files zeros):
// from the latest quarter, gross and net bad loans and the CET1 capital
// ratio as at its end; from the latest year-end, the year's return on
// assets, interest, operating costs and provisions, with loans (advances)
// and deposits at the year's end — the year before gives growth and the
// average loan book. HDFC Bank, 30 Jun 2026: gross NPA 1.17%, net 0.41%,
// CET1 19.57%; FY26 ROA 1.94%. A figure the filing leaves out or files as 0
// is null — unknown, never a pass.
export const BANK_TAGS = {
  gnpaPct: ["PercentageOfGrossNpa"], nnpaPct: ["PercentageOfNpa"],
  gnpa: ["GrossNonPerformingAssets"], nnpa: ["NonPerformingAssets"],
  cet1: ["CET1Ratio"], at1: ["AdditionalTier1Ratio"], roa: ["ReturnOnAssets"],
  interestEarned: ["InterestEarned"], interestExpended: ["InterestExpended"],
  opex: ["OperatingExpenses"], otherIncome: ["OtherIncome"],
  provisions: ["ProvisionsOtherThanTaxAndContingencies"],
  advances: ["Advances"], deposits: ["Deposits"],
};
const positive = v => (v != null && v > 0 ? v : null);
const pct2 = v => (v == null ? null : Math.round(v * 10000) / 100); // 0.0117 -> 1.17
export async function bankFigures(integrated, getXml, fyLabel) {
  const standalone = integrated.filter(r => r.consolidated !== "Consolidated").map(r => ({ ...integratedRow(r), url: r.xbrl }));
  if (!standalone.length) return { v: BANK_VERSION, missing: "No standalone filing on NSE" };
  const monthDay = fyLabel.split("-").slice(0, 2).join("-");
  const latest = standalone[0];
  const years = standalone.filter(r => r.label.startsWith(monthDay));
  const [fy, prev] = years;
  const out = { v: BANK_VERSION, scope: "Standalone" };
  // Ratios at the latest quarter's end, as filed for its own period
  {
    const xml = await getXml(latest.url), ctx = parseContexts(xml), end = isoDay(latest.periodEnd);
    const at = tags => {
      const f = firstFacts(xml, ctx, tags).filter(x => x.end === end).sort((a, b) => a.days - b.days)[0];
      return f ? f.value : null;
    };
    Object.assign(out, {
      asOf: end, asOfFiled: latest.filed ? isoDay(latest.filed) : null, asOfUrl: latest.url,
      gnpaPct: pct2(positive(at(BANK_TAGS.gnpaPct))),
      // 0 net is real once there's a gross figure beside it
      nnpaPct: at(BANK_TAGS.gnpaPct) > 0 ? pct2(at(BANK_TAGS.nnpaPct)) : null,
      gnpa: positive(at(BANK_TAGS.gnpa)), nnpa: at(BANK_TAGS.gnpa) > 0 ? at(BANK_TAGS.nnpa) : null,
      cet1Pct: pct2(positive(at(BANK_TAGS.cet1))),
      at1Pct: at(BANK_TAGS.cet1) > 0 ? pct2(at(BANK_TAGS.at1) ?? 0) : null,
    });
  }
  // The year's flows and year-end book
  if (fy) {
    const r = reader(await getXml(fy.url), fy);
    Object.assign(out, {
      fyEnd: isoDay(fy.periodEnd), fyFiled: fy.filed ? isoDay(fy.filed) : null, fyUrl: fy.url,
      roaPct: r.year(BANK_TAGS.roa) ? pct2(r.year(BANK_TAGS.roa)) : null,
      interestEarned: positive(r.year(BANK_TAGS.interestEarned)), interestExpended: positive(r.year(BANK_TAGS.interestExpended)),
      opex: positive(r.year(BANK_TAGS.opex)), otherIncome: r.year(BANK_TAGS.otherIncome),
      provisions: r.year(BANK_TAGS.provisions),
      advances: positive(r.atEnd(BANK_TAGS.advances)), deposits: positive(r.atEnd(BANK_TAGS.deposits)),
    });
  }
  if (prev) {
    const r = reader(await getXml(prev.url), prev);
    Object.assign(out, { prevFyEnd: isoDay(prev.periodEnd), advancesPrev: positive(r.atEnd(BANK_TAGS.advances)), depositsPrev: positive(r.atEnd(BANK_TAGS.deposits)) });
  }
  return out;
}

async function fetchFinancials(symbol) {
  const integrated = await integratedFilings(symbol);
  // One download per file: a year-end filing is also that quarter's filing
  const xmlCache = new Map();
  const getXml = url => {
    if (!xmlCache.has(url)) xmlCache.set(url, fetchXbrl(url));
    return xmlCache.get(url);
  };
  const seen = new Set();
  const periods = integrated.filter(f => (seen.has(f.qe_Date) ? false : seen.add(f.qe_Date)));
  if (!periods.length) throw Object.assign(new Error(`No Integrated Filing financials for ${symbol}`), { noFilings: true });

  // Walk back from the newest filing to the fiscal year-end one — found by a
  // year-to-date period of a full year, not by assuming a March year-end
  // (P&G Hygiene and Gillette close their year in June).
  let quarter = null;
  let latestYear = null;
  let latestRow = null;
  for (const filing of periods.slice(0, MAX_FILINGS_TO_SCAN)) {
    const xml = await getXml(filing.xbrl);
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
  if (!latestYear) throw Object.assign(new Error(`No full-year filing among ${symbol}'s recent Integrated Filings`), { noFilings: true });

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
      return extractYear(await getXml(row.xbrl), row, latestYear.template);
    } catch (e) {
      return { fyEnd: isoDay(row.periodEnd), label: row.label, error: e.message };
    }
  });

  // The last twelve quarters, from integrated filings (Mar 2025 on) and the old
  // endpoint before that — in the latest year's scope wherever it was filed,
  // so a quarter-on-quarter change isn't consolidated against standalone
  const scope = latestRow.scope;
  const quarterCandidates = [...integrated.map(integratedRow), ...(await legacyQuarterRows(symbol))]
    .filter(r => r.periodEnd)
    .sort((a, b) =>
      b.periodEnd - a.periodEnd ||
      (a.scope === scope ? -1 : 1) - (b.scope === scope ? -1 : 1) ||
      (b.filed ?? 0) - (a.filed ?? 0));
  const byQuarter = new Set();
  const quarterRows = quarterCandidates.filter(r => !byQuarter.has(isoDay(r.periodEnd)) && byQuarter.add(isoDay(r.periodEnd))).slice(0, QUARTERS);
  const quarters = await mapLimit(quarterRows, DOWNLOAD_CONCURRENCY, async row => {
    try {
      return extractQuarter(await getXml(row.xbrl), row);
    } catch (e) {
      return { qEnd: isoDay(row.periodEnd), label: row.label, error: e.message };
    }
  });

  // Banks: their own health figures (bad loans, capital, ROA …)
  let bank = null;
  if (latestYear.template === "BANKING") {
    try {
      bank = await bankFigures(integrated, getXml, latestRow.label);
    } catch (e) {
      bank = null; // read again on the next run (no version stamp)
    }
  }

  return { quarter, years: [latestYear, ...earlierYears], quarters, bank };
}

// A distressed company can have negative net worth (accumulated losses
// exceeding paid-up capital) — AHLWEST is a real example. profit/negative-
// equity flips sign into a nonsense "415% ROE", and debt/negative-equity does
// the same for Debt-to-Equity. Both are undefined when equity isn't positive,
// so null them rather than let a loss-making company read as a compounder.
export async function fetchStockSummary(symbol) {
  const [{ quarter, years, quarters, bank }, holding] = await Promise.all([
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
    quarters,
    ...(bank && { bank }),
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
