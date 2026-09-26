// NSE's public corporate-filings API, not Screener.in. Reachable with a plain
// request and a normal browser User-Agent — no login, no IP block.
//
// Financials come from SEBI's Integrated Filing system, mandatory from Q4
// FY2024-25. The older /api/corporates-financial-results endpoint stopped
// receiving filings at Q3 FY25 (Dec 2024) — reading it in Sep 2026 returned
// ~20-month-old earnings for every company, priced against today's CMP.
// Same XBRL tag names in both; only the namespace prefix changed
// (in-bse-fin -> in-capmkt), so tags are matched namespace-agnostically.
const NSE_BASE = "https://www.nseindia.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
const MAX_FILINGS_TO_SCAN = 5; // a year's worth of quarters, plus one revision

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`NSE API ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchXbrl(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`XBRL fetch ${url} -> HTTP ${res.status}`);
  return res.text();
}

function parseQeDate(s) {
  // "31-MAR-2026" -> Date
  const [d, m, y] = String(s).split("-");
  return new Date(Date.UTC(Number(y), MONTHS[m?.toUpperCase()], Number(d)));
}

function parseContexts(xml) {
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
function facts(xml, contexts, tag) {
  const re = new RegExp(`<[a-z-]+:${tag}\\b[^>]*?contextRef="([^"]+)"[^>]*>([^<]*)<`, "g");
  const out = [];
  for (const m of xml.matchAll(re)) {
    const ctx = contexts[m[1]];
    if (!ctx || ctx.dimensional) continue;
    out.push({ ...ctx, value: Number(m[2]) });
  }
  return out;
}

// Banks file on a different template (INTEGRATED_FILING_BANKING) with its own
// tag names for the same concepts — first candidate with any facts wins.
const TAGS = {
  revenue: ["RevenueFromOperations", "Income", "TotalIncome"],
  profit: ["ProfitLossForPeriod", "ProfitLossForThePeriod"],
  eps: [
    "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
    "BasicEarningsPerShareBeforeExtraordinaryItems",
    "BasicEarningsLossPerShareFromContinuingOperations",
  ],
  totalAssets: ["EquityAndLiabilities", "CapitalAndLiabilities"],
};

function firstFacts(xml, contexts, tags) {
  for (const tag of tags) {
    const found = facts(xml, contexts, tag);
    if (found.length) return found;
  }
  return [];
}

function netWorthFact(xml, ctx) {
  const equity = instantFact(facts(xml, ctx, "Equity"));
  if (equity) return equity.value;
  // Bank template: no single Equity line — capital plus reserves
  const capital = instantFact(facts(xml, ctx, "Capital"));
  const reserves = instantFact(facts(xml, ctx, "ReservesAndSurplus"));
  return capital && reserves ? capital.value + reserves.value : null;
}

function totalDebtFact(xml, ctx) {
  const current = instantFact(facts(xml, ctx, "BorrowingsCurrent"));
  const noncurrent = instantFact(facts(xml, ctx, "BorrowingsNoncurrent"));
  if (current || noncurrent) return (current?.value ?? 0) + (noncurrent?.value ?? 0);
  return instantFact(facts(xml, ctx, "Borrowings"))?.value ?? 0;
}

function durationFact(list, pick) {
  const current = list.filter(f => f.days > 0);
  if (!current.length) return null;
  const latestEnd = current.map(f => f.end).sort().at(-1); // drop prior-year comparatives
  const sameEnd = current.filter(f => f.end === latestEnd).sort((a, b) => a.days - b.days);
  return pick === "shortest" ? sameEnd[0] : sameEnd.at(-1);
}

function instantFact(list) {
  const instants = list.filter(f => f.instant).sort((a, b) => a.instant.localeCompare(b.instant));
  return instants.at(-1) ?? null;
}

async function integratedFilings(symbol) {
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

function onePerPeriod(filings) {
  const seen = new Set();
  return filings.filter(f => (seen.has(f.qe_Date) ? false : seen.add(f.qe_Date)));
}

async function fetchFinancials(symbol) {
  const filings = onePerPeriod(await integratedFilings(symbol));
  if (!filings.length) throw new Error(`No Integrated Filing financials for ${symbol}`);

  let quarter = null;
  let annual = null;
  for (const filing of filings.slice(0, MAX_FILINGS_TO_SCAN)) {
    const xml = await fetchXbrl(filing.xbrl);
    const ctx = parseContexts(xml);
    const revenue = firstFacts(xml, ctx, TAGS.revenue);
    const profit = firstFacts(xml, ctx, TAGS.profit);
    const eps = firstFacts(xml, ctx, TAGS.eps);

    if (!quarter) {
      const q = durationFact(profit, "shortest");
      quarter = {
        periodEnded: filing.qe_Date,
        scope: filing.consolidated,
        revenueQuarter: durationFact(revenue, "shortest")?.value ?? null,
        profitQuarter: q?.value ?? null,
        epsQuarter: durationFact(eps, "shortest")?.value ?? null,
      };
    }

    // The fiscal year-end filing is the one whose year-to-date period is a
    // full year — found by its dates, not by assuming a March year-end
    // (P&G Hygiene and Gillette close their year in June).
    const ytd = durationFact(profit, "longest");
    if (ytd && ytd.days >= 350) {
      annual = {
        yearEnded: filing.qe_Date,
        scope: filing.consolidated,
        revenue: durationFact(revenue, "longest")?.value ?? null,
        profit: ytd.value,
        eps: durationFact(eps, "longest")?.value ?? null,
        netWorth: netWorthFact(xml, ctx),
        totalAssets: instantFact(firstFacts(xml, ctx, TAGS.totalAssets))?.value ?? null,
        totalDebt: totalDebtFact(xml, ctx),
      };
      break;
    }
  }
  if (!annual) throw new Error(`No full-year filing among ${symbol}'s recent Integrated Filings`);
  return { quarter, annual };
}

async function fetchPromoterHolding(symbol) {
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-share-holdings-master?index=equities&symbol=${encodeURIComponent(symbol)}`);
  if (!rows.length) throw new Error(`No shareholding filing for ${symbol}`);
  const latest = rows[0];
  return { asOf: latest.date, promoterPct: Number(latest.pr_and_prgrp) };
}

// A distressed company can have negative net worth (accumulated losses
// exceeding paid-up capital) — AHLWEST is a real example. profit/negative-
// equity flips sign into a nonsense "415% ROE", and debt/negative-equity does
// the same for Debt-to-Equity. Both are undefined when equity isn't positive,
// so null them rather than let a loss-making company read as a compounder.
export async function fetchStockSummary(symbol) {
  const [{ quarter, annual }, holding] = await Promise.all([
    fetchFinancials(symbol),
    fetchPromoterHolding(symbol),
  ]);

  const hasPositiveEquity = annual.netWorth > 0;
  // ROE from the audited full-year profit over year-end equity — the same
  // basis Screener reports, not a single quarter scaled x4.
  const roe = hasPositiveEquity && annual.profit != null ? annual.profit / annual.netWorth : null;
  const debtToEquity = hasPositiveEquity ? annual.totalDebt / annual.netWorth : null;

  return {
    symbol,
    pnl: quarter,
    annual: { yearEnded: annual.yearEnded, scope: annual.scope, revenue: annual.revenue, profit: annual.profit, eps: annual.eps },
    balanceSheet: { yearEnded: annual.yearEnded, netWorth: annual.netWorth, totalAssets: annual.totalAssets, totalDebt: annual.totalDebt },
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
