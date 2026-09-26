// NSE's own public corporate-filings API, not Screener.in. No login, no IP
// block encountered (unlike Render -> Screener.in) — just needs a normal
// browser User-Agent header, confirmed via curl from a residential IP on
// 2026-09-26. Same layered shape as SEC EDGAR (and stockwise-us's spine):
// quarterly filings carry P&L/EPS, annual filings carry the balance sheet
// (Equity/Assets/Borrowings), a separate filing type carries shareholding.
const NSE_BASE = "https://www.nseindia.com";
const XBRL_NS = "in-bse-fin";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

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

// FourD/OneI etc. are contextRefs XBRL uses to distinguish "this quarter" from
// "year to date" from "as of this balance sheet date" — same filing carries
// several periods under one tag name, disambiguated only by contextRef.
function xbrlValues(xml, tag) {
  const re = new RegExp(`<${XBRL_NS}:${tag} contextRef="([^"]*)"[^>]*>([^<]*)</${XBRL_NS}:${tag}>`, "g");
  const out = {};
  for (const m of xml.matchAll(re)) out[m[1]] = Number(m[2]);
  return out;
}

function firstValue(xml, tag) {
  const values = xbrlValues(xml, tag);
  const key = Object.keys(values)[0];
  return key ? values[key] : null;
}

async function latestFiling(symbol, period) {
  const rows = await fetchJson(
    `${NSE_BASE}/api/corporates-financial-results?index=equities&period=${period}&symbol=${symbol}`
  );
  const usable = rows.filter(r => r.consolidated === "Consolidated" && r.xbrl && r.xbrl !== "-");
  if (!usable.length) throw new Error(`No usable ${period} XBRL filing for ${symbol}`);
  return usable[0]; // NSE returns newest first
}

async function fetchQuarterlyPnl(symbol) {
  const filing = await latestFiling(symbol, "Quarterly");
  const xml = await fetchXbrl(filing.xbrl);
  return {
    periodEnded: filing.toDate,
    revenueQuarter: firstValue(xml, "RevenueFromOperations"),
    profitQuarter: firstValue(xml, "ProfitLossForPeriod"),
    epsQuarter: firstValue(xml, "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations"),
  };
}

async function fetchAnnualBalanceSheet(symbol) {
  const filing = await latestFiling(symbol, "Annual");
  const xml = await fetchXbrl(filing.xbrl);
  const equity = firstValue(xml, "Equity");
  const borrowingsCurrent = firstValue(xml, "BorrowingsCurrent") ?? 0;
  const borrowingsNoncurrent = firstValue(xml, "BorrowingsNoncurrent") ?? 0;
  return {
    yearEnded: filing.toDate,
    netWorth: equity,
    totalAssets: firstValue(xml, "EquityAndLiabilities"),
    totalDebt: borrowingsCurrent + borrowingsNoncurrent,
  };
}

async function fetchPromoterHolding(symbol) {
  const rows = await fetchJson(`${NSE_BASE}/api/corporate-share-holdings-master?index=equities&symbol=${symbol}`);
  if (!rows.length) throw new Error(`No shareholding filing for ${symbol}`);
  const latest = rows[0];
  return { asOf: latest.date, promoterPct: Number(latest.pr_and_prgrp) };
}

export async function fetchStockSummary(symbol) {
  const [pnl, balanceSheet, holding] = await Promise.all([
    fetchQuarterlyPnl(symbol),
    fetchAnnualBalanceSheet(symbol),
    fetchPromoterHolding(symbol),
  ]);

  const roe = balanceSheet.netWorth ? (pnl.profitQuarter * 4) / balanceSheet.netWorth : null;
  const debtToEquity = balanceSheet.netWorth ? balanceSheet.totalDebt / balanceSheet.netWorth : null;

  return { symbol, pnl, balanceSheet, holding, roe, debtToEquity };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const symbol = process.argv[2] || "WIPRO";
  const summary = await fetchStockSummary(symbol);
  console.log(JSON.stringify(summary, null, 2));
}
