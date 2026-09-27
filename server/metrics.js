// Every number the Discover table and the stock page show, derived from one
// company's stored filings plus the market-wide snapshot — one place, so the
// same stock can't show two different P/Es on two screens.
import { calculateLevels } from "./levels.js";
import { computeScoreParts } from "./score.js";

const DAY = 86400000;
const MIN_PE_YEARS = 3;

// NSE sector (from its index lists) -> the original app's cyclical/utility
// treatment. Oil & gas counts as cyclical in full: the original's keywords
// cover refiners, explorers, coal and gas transmission/marketing alike.
const CYCLICAL_SECTORS = new Set(["Metals & Mining", "Oil Gas & Consumable Fuels", "Realty", "Construction Materials"]);
const UTILITY_SECTORS = new Set(["Power", "Utilities"]);
// Smaller companies aren't in NSE's sector lists; for those only, fall back
// to unambiguous words in the company name (the original matched the same
// words in Screener's industry names). "Metal" is left out on purpose — it
// catches forging and coating firms that don't live on commodity prices.
const CYCLICAL_NAME_WORDS = ["sugar", "steel", "cement", "fertiliser", "fertilizer", "shipping", "petrochem", "refiner",
  "mining", "coal", "realty", "real estate", "alumin", "copper", "zinc", "iron ore"];

const isoPlusDays = (iso, days) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
const round = (v, dp = 1) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const gt = (a, b) => a != null && a > b;
const lt = (a, b) => a != null && a < b;

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function computeMetrics(stock, snap, overrides = {}) {
  if (!stock || stock.error || !Array.isArray(stock.years)) return null;
  const years = stock.years.filter(y => !y.error && y.fyEnd);
  const latest = years[0];
  if (!latest) return null;
  const sym = stock.symbol;

  // A year exactly n years before `from` — never "whatever is 5th in the
  // list": some companies have no FY21 filing, and a 6-year span must not
  // pass for 5.
  const yearBack = (from, n) => {
    const target = new Date(`${from.fyEnd}T00:00:00Z`);
    target.setUTCFullYear(target.getUTCFullYear() - n);
    return years.find(y => Math.abs(new Date(`${y.fyEnd}T00:00:00Z`) - target) <= 45 * DAY) ?? null;
  };

  // Splits and bonuses change the share count. Anything filed before one is
  // per old share: divide per-share figures (and multiply share counts) by
  // every ratio since, so everything is on today's basis.
  const splits = snap?.splits?.[sym] ?? [];
  const factorAfter = iso => splits.filter(s => s.exDate > iso).reduce((f, s) => f * s.ratio, 1);
  const filedOf = y => y.filed ?? isoPlusDays(y.fyEnd, 60);

  const cmp = overrides.cmp ?? snap?.prices?.[sym] ?? null;
  const cmpDate = overrides.cmpDate ?? snap?.pricesDate ?? null;
  const latestFactor = factorAfter(filedOf(latest));
  const eps = latest.eps != null ? latest.eps / latestFactor : null;
  const holding = stock.holding ?? {};

  // Share count: the shareholding filing's own total, as of its quarter end.
  // Paid-up capital ÷ face value only where that's missing — and even then not
  // when it disagrees with profit ÷ EPS by half again, which is what a stale
  // face value looks like (LTIMindtree's filing says Rs 10 for a Rs 1 share,
  // which cut its share count to a tenth).
  let shares = null, sharesSource = null;
  if (holding.totalShares > 0) {
    shares = holding.totalShares * (holding.asOfIso ? factorAfter(holding.asOfIso) : 1);
    sharesSource = "shareholding filing";
  } else {
    const fromCapital = latest.paidUp > 0 && latest.faceValue > 0 ? (latest.paidUp / latest.faceValue) * latestFactor : null;
    const fromEps = latest.profit > 0 && latest.eps > 0 ? (latest.profit / latest.eps) * latestFactor : null;
    const disagree = fromCapital && fromEps && Math.max(fromCapital / fromEps, fromEps / fromCapital) > 1.5;
    if (fromCapital && !disagree) [shares, sharesSource] = [fromCapital, "paid-up capital ÷ face value"];
    else if (fromEps) [shares, sharesSource] = [fromEps, "profit ÷ EPS"];
  }
  const pe = cmp != null && eps > 0 ? cmp / eps : null;
  const marketCapCr = cmp != null && shares ? (cmp * shares) / 1e7 : null;

  const cagr = (field, n) => {
    const base = yearBack(latest, n);
    const now = latest[field], then = base?.[field];
    return now > 0 && then > 0 ? (Math.pow(now / then, 1 / n) - 1) * 100 : null;
  };

  // Screener's convention: profit over the year's *average* equity (and
  // capital employed), where the previous year-end is known.
  const roeOf = y => {
    if (y?.profit == null || !(y.equity > 0)) return null;
    const prev = yearBack(y, 1);
    return (y.profit / (prev?.equity > 0 ? (y.equity + prev.equity) / 2 : y.equity)) * 100;
  };
  const roceOf = y => {
    if (y?.pbt == null || y.financeCosts == null || !(y.equity > 0) || y.debt == null) return null;
    const prev = yearBack(y, 1);
    const ce = y.equity + y.debt;
    const cePrev = prev?.equity > 0 && prev.debt != null ? prev.equity + prev.debt : null;
    const denom = cePrev ? (ce + cePrev) / 2 : ce;
    return denom > 0 ? ((y.pbt + y.financeCosts) / denom) * 100 : null;
  };

  const roe = roeOf(latest);
  const roeHistory = [0, 1, 2, 3, 4].map(n => roeOf(yearBack(latest, n))).filter(v => v != null);
  const roeAvg = roeHistory.length ? roeHistory.reduce((a, b) => a + b, 0) / roeHistory.length : null;

  const debtToEquity = latest.equity > 0 && latest.debt != null ? latest.debt / latest.equity : null;

  // A lender borrows to lend. The filing format alone over-counts: fund
  // houses, brokers and holding companies file in the NBFC format too (69 of
  // the 149 that do carry under 1x debt), and the original scored those like
  // any other business, since Screener's industry names don't call them
  // lenders. So the NBFC format counts only when the company is leveraged.
  const lender = stock.template === "BANKING" || (stock.template === "NBFC" && debtToEquity >= 1);

  // Operating margin isn't reported for lenders (Screener shows none either —
  // the original's own hint says to keep OPM at 0 to include them).
  const opm = !lender && latest.revenue > 0 && latest.expenses != null
    ? ((latest.revenue - (latest.expenses - (latest.financeCosts ?? 0) - (latest.depreciation ?? 0))) / latest.revenue) * 100
    : null;
  const priceToBook = marketCapCr != null && latest.equity > 0 ? (marketCapCr * 1e7) / latest.equity : null;

  const dividendsTtm = (snap?.dividends?.[sym] ?? []).reduce((sum, d) => sum + d.amount / factorAfter(d.exDate), 0);
  const divYield = cmp ? (dividendsTtm / cmp) * 100 : null;
  const payoutPct = eps > 0 && dividendsTtm > 0 ? (dividendsTtm / eps) * 100 : null;

  const last3 = [0, 1, 2].map(n => yearBack(latest, n));
  const ocfPat3yPct = last3.every(y => y?.ocf != null && y?.profit != null) && last3.reduce((s, y) => s + y.profit, 0) > 0
    ? (last3.reduce((s, y) => s + y.ocf, 0) / last3.reduce((s, y) => s + y.profit, 0)) * 100
    : null;

  // Free cash flow: last year's operating cash flow less capital spending.
  // Not for lenders: their operating cash flow is deposits and loans moving
  // (HDFC Bank's reads Rs 1.1 lakh Cr) — the original's score skips cash
  // checks for them for the same reason.
  const fcf = !lender && latest.ocf != null && latest.capex != null ? latest.ocf - latest.capex : null;
  const piotroski = piotroskiScore(latest, yearBack(latest, 1), { lender, template: stock.template, factorBetween: (a, b) => splits.filter(s => s.exDate > a && s.exDate <= b).reduce((f, s) => f * s.ratio, 1), filedOf });

  // Graham NCAV = current assets − total liabilities (= total assets − equity)
  const ncavCr = stock.template === "INDAS" && latest.currentAssets != null && latest.totalAssets != null && latest.equity != null
    ? (latest.currentAssets - (latest.totalAssets - latest.equity)) / 1e7
    : null;

  // Historical P/E: close on the last trading day of each fiscal year over
  // that year's audited EPS, both brought to today's share basis.
  const peHistory = [0, 1, 2, 3, 4].map(n => yearBack(latest, n)).filter(Boolean).map(y => {
    const entry = snap?.fyEndPrices?.[y.fyEnd];
    const rawPrice = entry?.prices?.[sym] ?? null;
    const epsFactor = factorAfter(filedOf(y));
    const row = {
      fyEnd: y.fyEnd,
      eps: y.eps != null ? y.eps / epsFactor : null,
      reportedEps: y.eps,
      splitFactor: epsFactor,
      price: rawPrice != null && entry?.date ? rawPrice / factorAfter(entry.date) : null,
      priceDate: entry?.date ?? null,
    };
    if (row.eps == null) return { ...row, excluded: "EPS not in filing" };
    if (row.price == null) return { ...row, excluded: "no price for that date" };
    if (!(row.eps > 0)) return { ...row, excluded: "loss year — P/E not meaningful" };
    return { ...row, pe: row.price / row.eps };
  });
  const validPe = peHistory.filter(r => r.pe != null);
  const medianPe = validPe.length >= MIN_PE_YEARS ? median(validPe.map(r => r.pe)) : null;

  const salesGrowth3y = cagr("revenue", 3);
  const salesGrowth5y = cagr("revenue", 5);
  const profitGrowth3y = cagr("profit", 3);
  const profitGrowth5y = cagr("profit", 5);

  // Same inputs as the original's computeFairValue: 5-year profit growth,
  // else sales growth, else 12%, clamped to 0–25% (turnarounds report 100%+
  // growth that would compound into absurd fair values).
  const growthForValuation = Math.min(Math.max(profitGrowth5y ?? salesGrowth5y ?? 12, 0), 25);
  const valuationPe = medianPe ?? pe;
  const levels = eps > 0 && valuationPe ? calculateLevels(eps, valuationPe, growthForValuation, 10) : null;

  const range = snap?.range52w?.[sym] ?? null;

  const sector = snap?.sectors?.[sym] ?? null;
  const utility = sector ? UTILITY_SECTORS.has(sector) : false;
  const nameLower = String(stock.name || "").toLowerCase();
  const cyclical = sector ? CYCLICAL_SECTORS.has(sector) : CYCLICAL_NAME_WORDS.some(w => nameLower.includes(w));

  const m = {
    symbol: sym,
    name: stock.name,
    template: stock.template,
    sector, lender, utility, cyclical,
    cmp, cmpDate, eps, pe, marketCapCr, shares, sharesSource,
    low52w: range?.low ?? null,
    high52w: range?.high ?? null,
    fyEnd: latest.fyEnd,
    revenueCr: latest.revenue != null ? latest.revenue / 1e7 : null,
    profitCr: latest.profit != null ? latest.profit / 1e7 : null,
    salesGrowth3y, salesGrowth5y, profitGrowth3y, profitGrowth5y,
    roe, roeAvg, roeAvgYears: roeHistory.length,
    roce: roceOf(latest), opm,
    debtToEquity, priceToBook,
    promoterPct: holding.promoterPct ?? null,
    fiiPct: holding.fiiPct ?? null,
    diiPct: holding.diiPct ?? null,
    // % of the promoters' own shares that are pledged (Screener's measure)
    pledgedPct: holding.pledgedPct ?? null,
    holdingAsOf: holding.asOf ?? null,
    dividendsTtm, divYield, payoutPct,
    ocfPat3yPct,
    fcfCr: fcf != null ? fcf / 1e7 : null,
    piotroski: piotroski?.score ?? null,
    piotroskiChecks: piotroski?.checks ?? null,
    otherIncomePctOfPbt: latest.otherIncome != null && latest.pbt > 0 ? (latest.otherIncome / latest.pbt) * 100 : null,
    otherIncomeCr: latest.otherIncome != null ? latest.otherIncome / 1e7 : null,
    ncavCr,
    peHistory, medianPe, peYears: validPe.length,
    growthForValuation,
    valuationPe, valuationPeBasis: medianPe != null ? "median" : "current",
    levels,
    fairValue: levels?.fv27 ?? null,
    safeBuyPrice: levels?.p1 ?? null,
  };
  const { pros, cons } = prosAndCons(m, latest);
  m.pros = pros;
  m.cons = cons;
  m.score = computeScoreParts(m);
  return m;
}

// Piotroski F-score: nine yes/no checks on profitability, balance sheet and
// efficiency, this year against last. Ind AS companies only — lenders' balance
// sheets have no current/non-current split, and the checks weren't designed
// for them. Any missing input gives null, not a quietly lower score.
// Choices where the textbook leaves room, stated:
// - ROA and asset turnover use year-end total assets.
// - Gross margin needs cost of goods; companies without any (IT, services)
//   are compared on operating margin instead, the same basis both years.
// - Debt-free both years counts as "leverage didn't rise".
// - "No new shares" allows 1% (employee stock options) and any bonus issue or
//   split between the two filings.
function piotroskiScore(y, prev, { lender, template, factorBetween, filedOf }) {
  if (lender || template !== "INDAS" || !prev) return null;
  const inputs = [y.profit, y.ocf, y.totalAssets, y.currentAssets, y.currentLiabilities, y.longTermDebt, y.revenue, y.paidUp,
    prev.profit, prev.totalAssets, prev.currentAssets, prev.currentLiabilities, prev.longTermDebt, prev.revenue, prev.paidUp];
  if (inputs.some(v => v == null)) return null;
  if (!(y.totalAssets > 0 && prev.totalAssets > 0 && y.currentLiabilities > 0 && prev.currentLiabilities > 0 && y.revenue > 0 && prev.revenue > 0)) return null;

  const opMargin = r => (r.expenses != null ? (r.revenue - (r.expenses - (r.financeCosts ?? 0) - (r.depreciation ?? 0))) / r.revenue : null);
  const gross = y.cogs > 0 && prev.cogs > 0;
  const margin = r => (gross ? (r.revenue - r.cogs) / r.revenue : opMargin(r));
  if (margin(y) == null || margin(prev) == null) return null;

  const roa = r => r.profit / r.totalAssets;
  const lev = r => r.longTermDebt / r.totalAssets;
  const cr = r => r.currentAssets / r.currentLiabilities;
  const turnover = r => r.revenue / r.totalAssets;
  const checks = [
    { id: "profit", label: "Profitable", ok: y.profit > 0 },
    { id: "cfo", label: "Positive operating cash flow", ok: y.ocf > 0 },
    { id: "roa", label: "Return on assets improved", ok: roa(y) > roa(prev) },
    { id: "accruals", label: "Cash flow above profit", ok: y.ocf > y.profit },
    { id: "leverage", label: "Long-term debt/assets fell", ok: lev(y) < lev(prev) || (y.longTermDebt === 0 && prev.longTermDebt === 0) },
    { id: "liquidity", label: "Current ratio improved", ok: cr(y) > cr(prev) },
    { id: "dilution", label: "No new shares issued", ok: y.paidUp <= prev.paidUp * factorBetween(filedOf(prev), filedOf(y)) * 1.01 },
    { id: "margin", label: gross ? "Gross margin improved" : "Operating margin improved", ok: margin(y) > margin(prev) },
    { id: "turnover", label: "Asset turnover improved", ok: turnover(y) > turnover(prev) },
  ];
  return { score: checks.filter(c => c.ok).length, checks };
}

// Screener's company pages list auto-generated pros and cons, and the
// original's "business model" check needs them. These are generated from the
// same numbers in the same spirit — thresholds are this app's own, stated here.
function prosAndCons(m, latest) {
  const pct = v => `${round(v, 1)}%`;
  const pros = [], cons = [];
  if (!m.lender && lt(m.debtToEquity, 0.1)) pros.push("Company is almost debt free.");
  if (m.roeAvgYears >= 2 && gt(m.roeAvg, 20)) pros.push(`Good return on equity track record: ${m.roeAvgYears}-year average ROE ${pct(m.roeAvg)}.`);
  if (gt(m.profitGrowth5y, 15)) pros.push(`Good profit growth of ${pct(m.profitGrowth5y)} CAGR over 5 years.`);
  if (gt(m.salesGrowth5y, 15)) pros.push(`Strong sales growth of ${pct(m.salesGrowth5y)} CAGR over 5 years.`);
  if (gt(m.payoutPct, 30)) pros.push(`Healthy dividend payout of ${pct(m.payoutPct)} of earnings.`);
  if (!m.lender && gt(m.ocfPat3yPct, 100)) pros.push(`Profits are backed by cash: operating cash flow is ${pct(m.ocfPat3yPct)} of profit over 3 years.`);

  if (gt(m.priceToBook, 6)) cons.push(`Stock is trading at ${round(m.priceToBook, 1)} times its book value.`);
  if (lt(m.salesGrowth5y, 7)) cons.push(`Poor sales growth of ${pct(m.salesGrowth5y)} over 5 years.`);
  if (m.roeAvgYears >= 2 && lt(m.roeAvg, 10)) cons.push(`Low return on equity: ${m.roeAvgYears}-year average ${pct(m.roeAvg)}.`);
  if (!m.lender && gt(m.debtToEquity, 1)) cons.push(`High debt: ${round(m.debtToEquity, 2)} times equity.`);
  if (gt(m.otherIncomePctOfPbt, 30)) cons.push(`Earnings include other income of ₹${round(m.otherIncomeCr, 0)} Cr (${pct(m.otherIncomePctOfPbt)} of pre-tax profit).`);
  if (!m.lender && lt(m.ocfPat3yPct, 60)) cons.push(`Weak cash conversion: operating cash flow is only ${pct(m.ocfPat3yPct)} of profit over 3 years.`);
  if (lt(latest.profit, 0)) cons.push("Company made a loss in the latest year.");
  return { pros, cons };
}

// ---- Screening --------------------------------------------------------------

// Criteria keys and meanings are the original's (server/discovery.js buildQuery):
// revenue growth = 3-year sales CAGR, ROE = multi-year average, strict > / <,
// D/E only applied below 3x and P/E only below 100x, 0/empty = off. A company
// missing a value fails that filter, as a Screener query would drop it.
const UNSUPPORTED = {};

export function unsupportedCriteria(c) {
  return Object.entries(UNSUPPORTED).filter(([k]) => c[k]).map(([, label]) => label);
}

// The applied filters in words, for the line above the results — the
// original showed the Screener query it ran; this is the same list.
export function describeCriteria(c) {
  const cr = v => `₹${Number(v).toLocaleString("en-IN")} Cr`;
  const parts = [];
  if (c.revenue_growth_min) parts.push(`Sales growth (3Y) > ${c.revenue_growth_min}%`);
  if (c.roe_min) parts.push(`ROE (5Y avg) > ${c.roe_min}%`);
  if (c.opm_min) parts.push(`OPM > ${c.opm_min}%`);
  if (c.roce_min) parts.push(`ROCE > ${c.roce_min}%`);
  if (c.debt_to_equity_max != null && c.debt_to_equity_max < 3) parts.push(`Debt/equity < ${c.debt_to_equity_max}`);
  if (c.promoter_holding_min) parts.push(`Promoter holding > ${c.promoter_holding_min}%`);
  if (c.fii_holding_min) parts.push(`FII holding > ${c.fii_holding_min}%`);
  if (c.dii_holding_min) parts.push(`DII holding > ${c.dii_holding_min}%`);
  if (c.exclude_pledged) parts.push("Pledged < 5% of promoter shares");
  if (c.market_cap_min) parts.push(`Market cap > ${cr(c.market_cap_min)}`);
  if (c.market_cap_max) parts.push(`Market cap < ${cr(c.market_cap_max)}`);
  if (c.pe_max && c.pe_max < 100) parts.push(`P/E < ${c.pe_max}`);
  if (c.dividend_yield_min) parts.push(`Dividend yield > ${c.dividend_yield_min}%`);
  if (c.price_to_book_max) parts.push(`Price/book < ${c.price_to_book_max}`);
  if (c.profit_growth_5y_min) parts.push(`Profit growth (5Y) > ${c.profit_growth_5y_min}%`);
  if (c.piotroski_min > 0) parts.push(`Piotroski score ≥ ${c.piotroski_min}`);
  if (c.fcf_positive) parts.push("Free cash flow last year > 0");
  if (c.near_52w_low_pct > 0) parts.push(`Up from 52-week low < ${c.near_52w_low_pct}%`);
  if (c.pct_below_52w_high_min > 0) parts.push(`Down from 52-week high > ${c.pct_below_52w_high_min}%`);
  if (c.net_net_graham) parts.push("Market cap < ⅔ of net current assets");
  else if (c.net_net) parts.push("Market cap < net current assets");
  if (Array.isArray(c.sectors) && c.sectors.length) parts.push(`Sector: ${c.sectors.join(", ")}`);
  return parts.join(" · ");
}

export function matchesCriteria(m, c) {
  if (c.revenue_growth_min && !gt(m.salesGrowth3y, c.revenue_growth_min)) return false;
  if (c.roe_min && !gt(m.roeAvg, c.roe_min)) return false;
  if (c.opm_min && !gt(m.opm, c.opm_min)) return false;
  if (c.roce_min && !gt(m.roce, c.roce_min)) return false;
  if (c.debt_to_equity_max != null && c.debt_to_equity_max < 3 && !lt(m.debtToEquity, c.debt_to_equity_max)) return false;
  if (c.promoter_holding_min && !gt(m.promoterPct, c.promoter_holding_min)) return false;
  if (c.fii_holding_min && !gt(m.fiiPct, c.fii_holding_min)) return false;
  if (c.dii_holding_min && !gt(m.diiPct, c.dii_holding_min)) return false;
  if (c.exclude_pledged && !lt(m.pledgedPct, 5)) return false;
  if (c.market_cap_min && !gt(m.marketCapCr, c.market_cap_min)) return false;
  if (c.market_cap_max && !lt(m.marketCapCr, c.market_cap_max)) return false;
  if (c.pe_max && c.pe_max < 100 && !lt(m.pe, c.pe_max)) return false;
  if (c.dividend_yield_min && !gt(m.divYield, c.dividend_yield_min)) return false;
  if (c.price_to_book_max && !lt(m.priceToBook, c.price_to_book_max)) return false;
  if (c.profit_growth_5y_min && !gt(m.profitGrowth5y, c.profit_growth_5y_min)) return false;
  if (c.piotroski_min > 0 && !(m.piotroski != null && m.piotroski >= c.piotroski_min)) return false;
  if (c.fcf_positive && !gt(m.fcfCr, 0)) return false;
  // The original's Screener clauses: "Up from 52w low < X", "Down from 52w high > X"
  if (c.near_52w_low_pct > 0 && !(m.cmp != null && m.low52w > 0 && lt((m.cmp / m.low52w - 1) * 100, c.near_52w_low_pct))) return false;
  if (c.pct_below_52w_high_min > 0 && !(m.cmp != null && m.high52w > 0 && gt((1 - m.cmp / m.high52w) * 100, c.pct_below_52w_high_min))) return false;
  if (c.net_net_graham && !(gt(m.ncavCr, 0) && m.marketCapCr != null && m.ncavCr > 1.5 * m.marketCapCr)) return false;
  if (c.net_net && !(gt(m.ncavCr, 0) && m.marketCapCr != null && m.ncavCr > m.marketCapCr)) return false;
  if (Array.isArray(c.sectors) && c.sectors.length && !c.sectors.includes(m.sector)) return false;
  return true;
}
