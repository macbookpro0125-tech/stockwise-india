// Every number the Discover table and the stock page show, derived from one
// company's stored filings plus the market-wide snapshot — one place, so the
// same stock can't show two different P/Es on two screens.
import { calculateLevels } from "./levels.js";
import { computeScoreParts } from "./score.js";

const DAY = 86400000;
const MIN_PE_YEARS = 3;
// How far this year's EPS and the stock's P/E history can drift apart before
// the buy prices stop multiplying them as they are (see usualPe below)
const OUT_OF_LINE = 3;

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
  // Debt counts lease liabilities where the filing itemises them, as Screener
  // counts them in borrowings — their interest is in finance costs already, so
  // leaving them out of capital made a renter's ROCE look twice as good
  // (Cantabil 40% against Screener's 19%) and called it debt-free. Only
  // filings from FY26 itemise them; for the year before, ROCE's average takes
  // this year's leases as an estimate of last year's. (Dropping the average
  // for year-end capital instead cut ROCE by points for any company whose
  // capital grew in the year, leases or not — Torrent Pharma 15% -> 10% over
  // Rs 227 Cr of leases on its books.)
  const totalDebt = y => (y?.debt == null ? null : y.debt + (y.leases ?? 0));
  const roceOf = y => {
    if (y?.pbt == null || y.financeCosts == null || !(y.equity > 0) || y.debt == null) return null;
    const prev = yearBack(y, 1);
    const ce = y.equity + totalDebt(y);
    const prevLeases = y.leases == null ? 0 : (prev?.leases ?? y.leases);
    const cePrev = prev?.equity > 0 && prev.debt != null ? prev.equity + prev.debt + prevLeases : null;
    const denom = cePrev ? (ce + cePrev) / 2 : ce;
    return denom > 0 ? ((y.pbt + y.financeCosts) / denom) * 100 : null;
  };

  const roe = roeOf(latest);
  const roeHistory = [0, 1, 2, 3, 4].map(n => roeOf(yearBack(latest, n))).filter(v => v != null);
  const roeAvg = roeHistory.length ? roeHistory.reduce((a, b) => a + b, 0) / roeHistory.length : null;

  const debtToEquity = latest.equity > 0 && latest.debt != null ? totalDebt(latest) / latest.equity : null;
  const leasesCr = latest.leases > 0 ? latest.leases / 1e7 : null;

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
  // Buy prices multiply this year's EPS by the stock's usual P/E, which only
  // works if the two belong together. When the stock trades at under a third of
  // its usual P/E they usually don't, for one of two reasons — each had put buy
  // prices at many times the share price:
  // 1. A one-off gain (a land sale, a settlement, a demerger) lifted this year's
  //    EPS over 3× its usual level (the median of the same years), and the
  //    price didn't follow: Kiri Industries' Rs 941 EPS, usually Rs 35, made a
  //    Rs 10,826 buy price on a Rs 558 share. Buy prices use the usual EPS.
  // 2. Otherwise, the usual P/E came from years of near-zero profit, where any
  //    price is a huge P/E (Sunteck's 2,847 and 244). Years with under a third
  //    of this year's EPS are left out of the median.
  // The price test is what spares real growth: Bharti Airtel, Dixon and BSE
  // tripled their EPS too, but their prices rose with it; old EPS would have
  // made them sells, and fast growers would have lost their early years. It
  // uses the last NSE close even when a live price is passed in, so the stock
  // page and the Discover table can't disagree about the same stock.
  const priced = peHistory.filter(r => r.pe != null);
  const usualPe = priced.length >= MIN_PE_YEARS ? median(priced.map(r => r.pe)) : null;
  const usualEps = usualPe != null ? median(priced.map(r => r.eps)) : null;
  const close = snap?.prices?.[sym] ?? cmp;
  const closePe = close != null && eps > 0 ? close / eps : null;
  const outOfLine = usualPe != null && closePe != null && closePe < usualPe / OUT_OF_LINE;
  const epsJump = outOfLine && eps > OUT_OF_LINE * usualEps ? { eps, usualEps, pe: closePe } : null;
  const leftOut = r => outOfLine && !epsJump && r.eps < eps / OUT_OF_LINE;
  const validPe = priced.filter(r => !leftOut(r));
  const medianPe = validPe.length >= MIN_PE_YEARS ? median(validPe.map(r => r.pe)) : null;
  const valuationEps = epsJump ? usualEps : eps;

  const salesGrowth3y = cagr("revenue", 3);
  const salesGrowth5y = cagr("revenue", 5);
  const profitGrowth3y = cagr("profit", 3);
  const profitGrowth5y = cagr("profit", 5);

  // Same inputs as the original's computeFairValue: 5-year profit growth,
  // else sales growth, else 12%, clamped to 0–25% (turnarounds report 100%+
  // growth that would compound into absurd fair values).
  // Except that a 5-year rate starting from a dip — a year with under half of
  // the next year's figure, as COVID made FY21 for many companies — measures
  // the recovery, not the business, and gives way to the 3-year rate. Cantabil
  // went from Rs 10 Cr profit (FY21) to Rs 38 Cr (FY22) and Rs 96 Cr (FY26):
  // "58% a year", capped at 25%, put its two-year fair value at twice the
  // price, against 12.5% a year over the last three. Only ever lower: the same
  // test also catches a boom in the second year (Tata Steel's FY22), where the
  // 5-year rate wasn't flattered, and that mustn't raise anything.
  const clampGrowth = g => Math.min(Math.max(g, 0), 25);
  const dipAt = (field, n) => {
    const start = yearBack(latest, n)?.[field], next = yearBack(latest, n - 1)?.[field];
    return start > 0 && next > 0 && start < next / 2;
  };
  // { g, basis }: the rate and, for the stock page, where it came from
  const steadyGrowth = field => {
    const what = field === "profit" ? "profit" : "sales";
    const g5 = cagr(field, 5);
    if (g5 == null) return null;
    if (!dipAt(field, 5)) return { g: g5, basis: `5-year ${what} growth` };
    const g3 = cagr(field, 3);
    const fy = `FY${yearBack(latest, 5).fyEnd.slice(2, 4)}`;
    return g3 != null && !dipAt(field, 3) ? { g: g3, basis: `3-year ${what} growth — ${fy} was a dip` } : null;
  };
  const original = profitGrowth5y != null ? { g: profitGrowth5y, basis: "5-year profit growth" }
    : salesGrowth5y != null ? { g: salesGrowth5y, basis: "5-year sales growth" } : { g: 12, basis: "a default 12%" };
  const steady = steadyGrowth("profit") ?? steadyGrowth("revenue") ?? { g: 12, basis: "a default 12%" };
  const growthPick = clampGrowth(steady.g) < clampGrowth(original.g) ? steady : original;
  const growthForValuation = clampGrowth(growthPick.g);
  const growthBasis = growthPick.basis + (growthPick.g > 25 ? `, ${Math.round(growthPick.g)}% capped at 25%` : growthPick.g < 0 ? ", below 0% so taken as 0%" : "");
  const valuationPe = medianPe ?? pe;
  const levels = valuationEps > 0 && valuationPe ? calculateLevels(valuationEps, valuationPe, growthForValuation, 10) : null;

  const range = snap?.range52w?.[sym] ?? null;

  // Year by year for the stock page's financial statements and chart, on the
  // same definitions as the headline figures (EPS on today's share basis).
  const cr = v => (v == null ? null : v / 1e7);
  const history = years.map(y => {
    const operatingProfit = !lender && y.revenue != null && y.expenses != null
      ? y.revenue - (y.expenses - (y.financeCosts ?? 0) - (y.depreciation ?? 0))
      : null;
    return {
      fyEnd: y.fyEnd,
      scope: y.scope,
      revenueCr: cr(y.revenue),
      expensesCr: cr(y.expenses),
      operatingProfitCr: cr(operatingProfit),
      opm: operatingProfit != null && y.revenue > 0 ? (operatingProfit / y.revenue) * 100 : null,
      otherIncomeCr: cr(y.otherIncome),
      depreciationCr: cr(y.depreciation),
      financeCostsCr: cr(y.financeCosts),
      pbtCr: cr(y.pbt),
      profitCr: cr(y.profit),
      eps: y.eps != null ? y.eps / factorAfter(filedOf(y)) : null,
      equityCr: cr(y.equity),
      debtCr: cr(y.debt),
      leasesCr: cr(y.leases),
      totalAssetsCr: cr(y.totalAssets),
      currentAssetsCr: cr(y.currentAssets),
      currentLiabilitiesCr: cr(y.currentLiabilities),
      ocfCr: cr(y.ocf),
      capexCr: cr(y.capex),
      fcfCr: !lender && y.ocf != null && y.capex != null ? cr(y.ocf - y.capex) : null,
      roe: roeOf(y),
      roce: roceOf(y),
      debtToEquity: y.equity > 0 && y.debt != null ? totalDebt(y) / y.equity : null,
    };
  });

  const sector = snap?.sectors?.[sym] ?? null;
  const utility = sector ? UTILITY_SECTORS.has(sector) : false;
  const nameLower = String(stock.name || "").toLowerCase();
  const cyclical = sector ? CYCLICAL_SECTORS.has(sector) : CYCLICAL_NAME_WORDS.some(w => nameLower.includes(w));

  // For the stock page's 10-point checklist, on the original's definitions:
  // interest cover = EBIT / interest; EPS stability = coefficient of variation
  // of the last five years' EPS; margin swing = the five-year OPM range.
  const interestCoverage = !lender && latest.financeCosts > 0 && latest.pbt != null
    ? (latest.pbt + latest.financeCosts) / latest.financeCosts
    : null;
  const epsLast5 = history.slice(0, 5).map(h => h.eps).filter(v => v != null);
  const epsMean = epsLast5.length ? epsLast5.reduce((a, b) => a + b, 0) / epsLast5.length : null;
  const epsCV = epsLast5.length >= 3 && epsMean > 0
    ? Math.sqrt(epsLast5.reduce((a, v) => a + (v - epsMean) ** 2, 0) / epsLast5.length) / epsMean
    : null;
  const opmLast5 = history.slice(0, 5).map(h => h.opm).filter(v => v != null);
  const opmRange = opmLast5.length >= 3 ? Math.max(...opmLast5) - Math.min(...opmLast5) : null;

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
    debtToEquity, leasesCr, priceToBook, interestCoverage, epsCV, opmRange,
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
    peHistory: peHistory.map(r => (r.pe != null && leftOut(r) ? { ...r, excluded: "profit under a third of this year's — P/E left out" } : r)),
    medianPe, peYears: validPe.length,
    history,
    growthForValuation, growthBasis,
    valuationPe, valuationPeBasis: medianPe != null ? "median" : "current",
    valuationEps, epsJump,
    levels,
    fairValue: levels?.fv27 ?? null,
    safeBuyPrice: levels?.p1 ?? null,
  };

  // For the screener's filters and columns (metric-catalog.js). Returns are
  // from the snapshot's last close, so they stay consistent with each other
  // even when the stock page passes a live price.
  const ret = snap?.returns?.[sym] ?? {};
  const pct = (a, b) => (a != null && b > 0 ? (a / b - 1) * 100 : null);
  Object.assign(m, {
    ret1d: ret.d1 ?? null, ret1w: ret.w1 ?? null, ret1m: ret.m1 ?? null, ret6m: ret.m6 ?? null, ret1y: ret.y1 ?? null,
    upFrom52wLow: pct(cmp, m.low52w),
    downFrom52wHigh: cmp != null && m.high52w > 0 ? (1 - cmp / m.high52w) * 100 : null,
    netMargin: latest.profit != null && latest.revenue > 0 ? (latest.profit / latest.revenue) * 100 : null,
    currentRatio: !lender && latest.currentAssets != null && latest.currentLiabilities > 0 ? latest.currentAssets / latest.currentLiabilities : null,
    mcapToNcav: ncavCr > 0 && marketCapCr != null ? marketCapCr / ncavCr : null,
    vsFairValue: pct(cmp, m.fairValue),
    vsPhase1: pct(cmp, m.safeBuyPrice),
  });

  // More of the figures Tickertape screens on, from the same filings: growth
  // year on year and over 3 and 5 years (a gap in the filings counts as
  // unknown, as cagr() does), 5-year averages (3 years at least), ratios and
  // the statements' own lines. Cash-flow figures are left out for lenders,
  // whose operating cash flow is deposits and loans moving, as with FCF. No
  // 5-year cash-flow growth: the older filings carry no cash-flow statement,
  // so it was known for 6 companies.
  const pctOf = (a, b) => (a != null && b > 0 ? (a / b) * 100 : null);
  const ratio = (a, b) => (a != null && b > 0 ? a / b : null);
  const opProfitOf = y => (!lender && y?.revenue != null && y?.expenses != null ? y.revenue - (y.expenses - (y.financeCosts ?? 0) - (y.depreciation ?? 0)) : null);
  const epsOf = y => (y?.eps != null ? y.eps / factorAfter(filedOf(y)) : null);
  const growth = (get, n) => {
    const base = yearBack(latest, n);
    const now = get(latest), then = base ? get(base) : null;
    return now > 0 && then > 0 ? (Math.pow(now / then, 1 / n) - 1) * 100 : null;
  };
  const avg5 = get => {
    const vals = [0, 1, 2, 3, 4].map(n => yearBack(latest, n)).filter(Boolean).map(get).filter(v => v != null && Number.isFinite(v));
    return vals.length >= 3 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const tech = snap?.tech?.[sym] ?? {};

  // Checklist point 7, a profit every year: the run of consecutive fiscal
  // years from the latest (up to 5) and which of them were losses. A gap in
  // the filings ends the run — a missing year can't count as a profit.
  const run = [];
  for (const y of history) {
    if (y.profitCr == null) break;
    if (run.length && Number(run.at(-1).fyEnd.slice(0, 4)) - Number(y.fyEnd.slice(0, 4)) !== 1) break;
    run.push(y);
    if (run.length === 5) break;
  }
  m.profitRecord = { years: run.length, latestFy: run[0]?.fyEnd ?? null, lossYears: run.filter(y => y.profitCr <= 0).map(y => y.fyEnd) };

  Object.assign(m, {
    roa: pctOf(latest.profit, latest.totalAssets),
    roa5y: avg5(y => pctOf(y.profit, y.totalAssets)),
    roce5y: avg5(roceOf),
    netMargin5y: avg5(y => pctOf(y.profit, y.revenue)),
    opm5y: lender ? null : avg5(y => pctOf(opProfitOf(y), y.revenue)),
    cashFlowMargin: lender ? null : pctOf(latest.ocf, latest.revenue),

    salesGrowth1y: growth(y => y.revenue, 1),
    profitGrowth1y: growth(y => y.profit, 1),
    epsGrowth1y: growth(epsOf, 1),
    epsGrowth3y: growth(epsOf, 3),
    epsGrowth5y: growth(epsOf, 5),
    ebitdaGrowth1y: lender ? null : growth(opProfitOf, 1),
    ebitdaGrowth5y: lender ? null : growth(opProfitOf, 5),
    ocfGrowth1y: lender ? null : growth(y => y.ocf, 1),

    priceToSales: ratio(marketCapCr, cr(latest.revenue)),
    priceToFcf: m.fcfCr > 0 ? ratio(marketCapCr, m.fcfCr) : null,
    priceToCfo: lender ? null : ratio(marketCapCr, cr(latest.ocf)),
    earningsYield: eps != null && cmp > 0 ? (eps / cmp) * 100 : null,
    peVsMedian: pe != null && medianPe > 0 ? (pe / medianPe - 1) * 100 : null,

    ltDebtToEquity: ratio(latest.longTermDebt, latest.equity),
    assetTurnover: ratio(latest.revenue, latest.totalAssets),

    ebitdaCr: cr(opProfitOf(latest)),
    pbitCr: latest.pbt != null && latest.financeCosts != null ? cr(latest.pbt + latest.financeCosts) : null,
    pbtCr: cr(latest.pbt),
    depreciationCr: cr(latest.depreciation),
    interestCr: cr(latest.financeCosts),
    rawMaterialsCr: cr(latest.cogs),
    dividendPerShare: dividendsTtm,

    totalAssetsCr: cr(latest.totalAssets),
    equityCr: cr(latest.equity),
    totalDebtCr: cr(totalDebt(latest)),
    ltDebtCr: cr(latest.longTermDebt),
    currentAssetsCr: cr(latest.currentAssets),
    currentLiabilitiesCr: cr(latest.currentLiabilities),
    ocfCr: cr(latest.ocf),
    capexCr: cr(latest.capex),
    shareCapitalCr: cr(latest.paidUp),
    bookValuePerShare: latest.equity > 0 && shares ? latest.equity / shares : null,
    sharesCr: shares ? shares / 1e7 : null,
    faceValue: latest.faceValue ?? null,

    // From the year of daily prices (market-data.js technicals())
    volume1d: tech.volume1d ?? null,
    avgVolume1m: tech.avgVolume1m ?? null,
    avgVolume3m: tech.avgVolume3m ?? null,
    volumeChange1d: tech.volumeChange1d ?? null,
    volumeChange1w: tech.volumeChange1w ?? null,
    delivery1m: tech.delivery1m ?? null,
    rsi14: tech.rsi14 ?? null,
    vsEma20: tech.vsEma20 ?? null,
    vsSma50: tech.vsSma50 ?? null,
    vsSma200: tech.vsSma200 ?? null,
    volatility1y: tech.volatility1y ?? null,
    maxLoss1y: tech.maxLoss1y ?? null,
    beta1y: tech.beta1y ?? null,
    ret1wVsNifty: ret.w1VsNifty ?? null,
    ret1mVsNifty: ret.m1VsNifty ?? null,
    ret6mVsNifty: ret.m6VsNifty ?? null,
    ret1yVsNifty: ret.y1VsNifty ?? null,
    priceCagr5y: ret.cagr5y ?? null,
  });
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
  if (!m.lender && gt(m.debtToEquity, 1)) cons.push(`High debt: ${round(m.debtToEquity, 2)} times equity${m.leasesCr > 0 ? `, ₹${round(m.leasesCr, 0)} Cr of it lease liabilities` : ""}.`);
  if (gt(m.otherIncomePctOfPbt, 30)) cons.push(`Earnings include other income of ₹${round(m.otherIncomeCr, 0)} Cr (${pct(m.otherIncomePctOfPbt)} of pre-tax profit).`);
  if (!m.lender && lt(m.ocfPat3yPct, 60)) cons.push(`Weak cash conversion: operating cash flow is only ${pct(m.ocfPat3yPct)} of profit over 3 years.`);
  if (lt(latest.profit, 0)) cons.push("Company made a loss in the latest year.");
  return { pros, cons };
}
