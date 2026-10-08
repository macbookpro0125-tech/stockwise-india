// Every metric the screener can filter on and show as a column — one list
// that drives the filter picker, the table's columns, the range sliders and
// the strategies, so a metric added here appears everywhere at once. Values
// come from metrics.js's per-company object (get defaults to m[id]).
//
// A filter is { id, min, max } (inclusive, either end open) or, for a
// category metric, { id, values: [...] }. A company whose value is unknown is
// left out once a filter on that metric applies, and the screen says how many.

export const CATEGORIES = ["Research score", "Valuation", "Profitability", "Growth", "Quarterly results", "Price & returns", "Volume & technicals", "Ownership", "Financial health", "Cash flow", "Income statement", "Balance sheet", "Size"];

const NO_LENDERS = " Not shown for banks and other lenders.";
// The research score (research.js) and its groups
const groupScore = id => m => m.research?.groups.find(g => g.id === id)?.score ?? null;

export const METRICS = [
  // ── Research score ──
  { id: "quality", label: "Quality score", short: "Quality", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.quality ?? null, about: "Out of 100 across six groups: business, earnings, balance sheet, governance, growth and valuation. Checks the filings can't show are left out, never guessed." },
  { id: "qualityOnly", label: "Quality without valuation", short: "Quality ex-val", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.qualityOnly ?? null, about: "The five business groups only — how good the company is, whatever its price." },
  { id: "researchScore", label: "Overall research score", short: "Research", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.overall.score ?? null, about: "Quality (70%) and valuation (30%) blended, trimmed for price swings and data gaps. A research summary, not a buy or sell signal." },
  { id: "businessScore", label: "Business quality score", short: "Business", category: "Research score", unit: "/100", decimals: 0, get: groupScore("business"), about: "Returns on capital, margin stability, steady sales and returns on new investment." },
  { id: "earningsScore", label: "Earnings quality score", short: "Earnings", category: "Research score", unit: "/100", decimals: 0, get: groupScore("earnings"), about: "Cash behind the profits, accruals, free cash flow, steady EPS and EPS growth." },
  { id: "balanceScore", label: "Balance sheet score", short: "Balance", category: "Research score", unit: "/100", decimals: 0, get: groupScore("balance"), about: "Net debt, interest cover, liquidity, working capital and debt to equity." + NO_LENDERS },
  { id: "governanceScore", label: "Governance score", short: "Governance", category: "Research score", unit: "/100", decimals: 0, get: groupScore("governance"), about: "Promoter holding changes, pledging, dilution, the audit opinion and auditor resignations. Related-party deals aren't checked yet." },
  { id: "growthScore", label: "Growth score", short: "Growth", category: "Research score", unit: "/100", decimals: 0, get: groupScore("growth"), about: "3- and 5-year sales growth and 3-year EPS growth." },
  { id: "valuationScore", label: "Valuation score", short: "Valuation", category: "Research score", unit: "/100", decimals: 0, get: groupScore("valuation"), about: "Higher means cheaper: against its own usual P/E, sector peers, free cash flow and simple multiples, at the last close." },
  { id: "technicalScore", label: "Technical setup", short: "Technical", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.technical.score ?? null, about: "Price trend, strength against NIFTY 50, momentum, liquidity and swings. Kept out of the quality and research scores." },
  { id: "riskScore", label: "Risk score", short: "Risk", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.risk.score ?? null, about: "Higher means riskier: debt, cyclicality, governance, price swings, valuation and data gaps." },
  { id: "confidence", label: "Data quality", short: "Data quality", category: "Research score", unit: "/100", decimals: 0, get: m => m.research?.confidence ?? null, about: "A data-quality measure based on checks covered, filing recency and price freshness; it does not predict the stock's outcome." },

  // ── Valuation ──
  { id: "pe", label: "P/E ratio", short: "P/E", category: "Valuation", unit: "x", decimals: 1, about: "Price ÷ last year's earnings per share. Loss-making companies have none." },
  { id: "peTtm", label: "P/E on the last four quarters", short: "P/E TTM", category: "Valuation", unit: "x", decimals: 1, about: "Price ÷ EPS over the last four quarters (trailing twelve months) — the basis Screener's P/E uses." },
  { id: "medianPe", label: "5-year median P/E", short: "Median P/E", category: "Valuation", unit: "x", decimals: 1, about: "The company's usual P/E over its last five years — what its fair value is based on." },
  { id: "peVsMedian", label: "P/E vs its 5-year median", short: "P/E vs med", category: "Valuation", unit: "%", decimals: 0, signed: true, about: "How far today's P/E is above (+) or below (−) the company's own usual P/E." },
  { id: "priceToBook", label: "Price to book", short: "P/B", category: "Valuation", unit: "x", decimals: 2 },
  { id: "priceToSales", label: "Price to sales", short: "P/S", category: "Valuation", unit: "x", decimals: 2, about: "Market cap ÷ last year's sales." },
  { id: "priceToFcf", label: "Price to free cash flow", short: "P/FCF", category: "Valuation", unit: "x", decimals: 1, about: "Market cap ÷ last year's free cash flow; only where that was positive." + NO_LENDERS },
  { id: "priceToCfo", label: "Price to operating cash flow", short: "P/CFO", category: "Valuation", unit: "x", decimals: 1, about: "Market cap ÷ last year's cash from operations; only where that was positive." + NO_LENDERS },
  { id: "earningsYield", label: "Earnings yield", short: "Earn. yield", category: "Valuation", unit: "%", decimals: 1, signed: true, about: "Earnings per share ÷ price — the P/E turned upside down." },
  { id: "divYield", label: "Dividend yield", short: "Div yield", category: "Valuation", unit: "%", decimals: 1, about: "Dividends paid over the last 12 months ÷ today's price." },
  { id: "vsFairValue", label: "Price vs fair value", short: "vs FV", category: "Valuation", unit: "%", decimals: 1, signed: true, about: "How far today's price is above (+) or below (−) the company's 2-year fair value." },
  { id: "vsPhase1", label: "Price vs Phase 1 level", short: "vs P1", category: "Valuation", unit: "%", decimals: 1, signed: true, about: "0 or less means today's price is at or under the Phase 1 level (10% below today's fair value)." },
  { id: "mcapToNcav", label: "Market cap ÷ net current assets", short: "MCap/NCAV", category: "Valuation", unit: "x", decimals: 2, about: "Graham's net-net test: under 1 means the market values the company at less than its current assets minus all its liabilities." },
  { id: "evToEbitda", label: "EV / EBITDA", short: "EV/EBITDA", category: "Valuation", unit: "x", decimals: 1, about: "Enterprise value (market cap plus net debt, at the last close) ÷ operating profit; only where that was positive." + NO_LENDERS },

  // ── Profitability ──
  { id: "roce", label: "Return on capital employed (ROCE)", short: "ROCE", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roce5y", label: "ROCE, 5-year average", short: "ROCE 5Y", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roe", label: "Return on equity (ROE)", short: "ROE", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roeAvg", label: "ROE, 5-year average", short: "ROE 5Y", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roa", label: "Return on assets (ROA)", short: "ROA", category: "Profitability", unit: "%", decimals: 1, about: "Last year's profit ÷ total assets." },
  { id: "roa5y", label: "ROA, 5-year average", short: "ROA 5Y", category: "Profitability", unit: "%", decimals: 1 },
  { id: "opm", label: "Operating profit margin (OPM)", short: "OPM", category: "Profitability", unit: "%", decimals: 1, about: "Operating profit (EBITDA, before other income) ÷ sales." + NO_LENDERS },
  { id: "opm5y", label: "OPM, 5-year average", short: "OPM 5Y", category: "Profitability", unit: "%", decimals: 1, about: NO_LENDERS.trim() },
  { id: "netMargin", label: "Net profit margin", short: "Net margin", category: "Profitability", unit: "%", decimals: 1 },
  { id: "netMargin5y", label: "Net profit margin, 5-year average", short: "Net mgn 5Y", category: "Profitability", unit: "%", decimals: 1 },
  { id: "cashFlowMargin", label: "Cash flow margin", short: "CF margin", category: "Profitability", unit: "%", decimals: 1, signed: true, about: "Cash from operations ÷ sales." + NO_LENDERS },

  // ── Growth ──
  { id: "salesGrowth1y", label: "Sales growth, last year", short: "Sales 1Y", category: "Growth", unit: "%", decimals: 1, about: "Growth figures are left out when either year is a loss or a filing is missing." },
  { id: "salesGrowth3y", label: "3-year sales growth (per year)", short: "Sales 3Y", category: "Growth", unit: "%", decimals: 1 },
  // ── Quarterly results ──
  { id: "qSalesGrowthYoY", label: "Sales growth, latest quarter vs a year ago", short: "Q sales YoY", category: "Quarterly results", unit: "%", decimals: 1, signed: true, about: "The latest quarter's sales against the same quarter a year earlier." },
  { id: "qProfitGrowthYoY", label: "Profit growth, latest quarter vs a year ago", short: "Q profit YoY", category: "Quarterly results", unit: "%", decimals: 1, signed: true, about: "The latest quarter's profit (to the company's own shareholders) against the same quarter a year earlier. None when the earlier quarter was a loss." },
  { id: "qSalesGrowthQoQ", label: "Sales growth, latest quarter vs the one before", short: "Q sales QoQ", category: "Quarterly results", unit: "%", decimals: 1, signed: true, about: "Against the previous quarter — seasonal businesses swing on this." },
  { id: "qProfitGrowthQoQ", label: "Profit growth, latest quarter vs the one before", short: "Q profit QoQ", category: "Quarterly results", unit: "%", decimals: 1, signed: true, about: "Against the previous quarter. None when that quarter was a loss." },
  { id: "qOpm", label: "Operating margin, latest quarter", short: "Q OPM", category: "Quarterly results", unit: "%", decimals: 1, about: "Operating profit as a share of sales in the latest quarter." + NO_LENDERS },
  { id: "ttmRevenueCr", label: "Sales, last four quarters", short: "Sales TTM", category: "Quarterly results", unit: "₹ Cr", decimals: 0, about: "Trailing twelve months: the last four quarters added up." },
  { id: "ttmProfitCr", label: "Net profit, last four quarters", short: "Profit TTM", category: "Quarterly results", unit: "₹ Cr", decimals: 0, signed: true, about: "Trailing twelve months: the last four quarters added up." },
  { id: "salesGrowth5y", label: "5-year sales growth (per year)", short: "Sales 5Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "profitGrowth1y", label: "Profit growth, last year", short: "Profit 1Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "profitGrowth3y", label: "3-year profit growth (per year)", short: "Profit 3Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "profitGrowth5y", label: "5-year profit growth (per year)", short: "Profit 5Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "epsGrowth1y", label: "EPS growth, last year", short: "EPS 1Y", category: "Growth", unit: "%", decimals: 1, about: "Earnings per share on today's share count, so splits and bonuses don't distort it." },
  { id: "epsGrowth3y", label: "3-year EPS growth (per year)", short: "EPS 3Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "epsGrowth5y", label: "5-year EPS growth (per year)", short: "EPS 5Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "ebitdaGrowth1y", label: "Operating profit (EBITDA) growth, last year", short: "EBITDA 1Y", category: "Growth", unit: "%", decimals: 1, about: NO_LENDERS.trim() },
  { id: "ebitdaGrowth5y", label: "5-year operating profit (EBITDA) growth (per year)", short: "EBITDA 5Y", category: "Growth", unit: "%", decimals: 1, about: NO_LENDERS.trim() },
  { id: "ocfGrowth1y", label: "Operating cash flow growth, last year", short: "CFO 1Y", category: "Growth", unit: "%", decimals: 1, about: NO_LENDERS.trim() },

  // ── Price & returns ──
  { id: "cmp", label: "Price", short: "Price", category: "Price & returns", unit: "₹", decimals: 2 },
  { id: "ret1d", label: "1-day return", short: "1D", category: "Price & returns", unit: "%", decimals: 2, signed: true },
  { id: "ret1w", label: "1-week return", short: "1W", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1m", label: "1-month return", short: "1M", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret6m", label: "6-month return", short: "6M", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1y", label: "1-year return", short: "1Y", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1wVsNifty", label: "1-week return vs NIFTY 50", short: "1W vs NIFTY", category: "Price & returns", unit: "%", decimals: 1, signed: true, about: "The stock's return minus NIFTY 50's over the same days, in percentage points." },
  { id: "ret1mVsNifty", label: "1-month return vs NIFTY 50", short: "1M vs NIFTY", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret6mVsNifty", label: "6-month return vs NIFTY 50", short: "6M vs NIFTY", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1yVsNifty", label: "1-year return vs NIFTY 50", short: "1Y vs NIFTY", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "priceCagr5y", label: "5-year price growth (per year)", short: "Price 5Y", category: "Price & returns", unit: "%", decimals: 1, signed: true, about: "Share price growth a year over five years, on today's share basis." },
  { id: "downFrom52wHigh", label: "Below 52-week high", short: "↓52W high", category: "Price & returns", unit: "%", decimals: 1 },
  { id: "upFrom52wLow", label: "Above 52-week low", short: "↑52W low", category: "Price & returns", unit: "%", decimals: 1 },

  // ── Volume & technicals (from a year of NSE's daily prices) ──
  { id: "volume1d", label: "Volume, last day", short: "Volume", category: "Volume & technicals", unit: "shares", decimals: 0 },
  { id: "avgVolume1m", label: "Average daily volume, 1 month", short: "Avg vol 1M", category: "Volume & technicals", unit: "shares", decimals: 0 },
  { id: "avgVolume3m", label: "Average daily volume, 3 months", short: "Avg vol 3M", category: "Volume & technicals", unit: "shares", decimals: 0 },
  { id: "volumeChange1d", label: "Volume change, 1 day", short: "Vol chg 1D", category: "Volume & technicals", unit: "%", decimals: 0, signed: true },
  { id: "volumeChange1w", label: "Volume change, 1 week", short: "Vol chg 1W", category: "Volume & technicals", unit: "%", decimals: 0, signed: true, about: "This week's average daily volume vs last week's." },
  { id: "delivery1m", label: "Delivery %, 1-month average", short: "Delivery", category: "Volume & technicals", unit: "%", decimals: 1, about: "Share of traded shares actually taken into demat accounts rather than traded within the day. Higher means more long-term buying." },
  { id: "rsi14", label: "RSI, 14 days", short: "RSI", category: "Volume & technicals", unit: "", decimals: 1, about: "Relative strength index: above 70 is usually read as overbought, below 30 as oversold." },
  { id: "vsEma20", label: "Price vs 20-day EMA", short: "vs 20 EMA", category: "Volume & technicals", unit: "%", decimals: 1, signed: true },
  { id: "vsSma50", label: "Price vs 50-day SMA", short: "vs 50 SMA", category: "Volume & technicals", unit: "%", decimals: 1, signed: true },
  { id: "vsSma200", label: "Price vs 200-day SMA", short: "vs 200 SMA", category: "Volume & technicals", unit: "%", decimals: 1, signed: true },
  { id: "volatility1y", label: "Volatility, 1 year", short: "Volatility", category: "Volume & technicals", unit: "%", decimals: 1, about: "How much the price swings: the yearly standard deviation of daily moves." },
  { id: "maxLoss1y", label: "Biggest fall in a year", short: "Max fall 1Y", category: "Volume & technicals", unit: "%", decimals: 1, about: "The largest drop from a high to a later low over the past year." },
  { id: "beta1y", label: "Beta vs NIFTY 50, 1 year", short: "Beta", category: "Volume & technicals", unit: "", decimals: 2, about: "How much the stock tends to move when NIFTY 50 moves: 1 is in step, above 1 swings more, below 1 less." },

  // ── Ownership ──
  { id: "promoterPct", label: "Promoter holding", short: "Promoter", category: "Ownership", unit: "%", decimals: 1 },
  { id: "fiiPct", label: "FII holding", short: "FII", category: "Ownership", unit: "%", decimals: 1, about: "Foreign institutional investors." },
  { id: "diiPct", label: "DII holding", short: "DII", category: "Ownership", unit: "%", decimals: 1, about: "Domestic institutions: mutual funds, insurers, banks." },
  { id: "pledgedPct", label: "Promoter shares pledged", short: "Pledged", category: "Ownership", unit: "%", decimals: 1, about: "Share of the promoters' own holding that is pledged." },

  // ── Financial health ──
  { id: "debtToEquity", label: "Debt to equity", short: "D/E", category: "Financial health", unit: "x", decimals: 2 },
  { id: "ltDebtToEquity", label: "Long-term debt to equity", short: "LT D/E", category: "Financial health", unit: "x", decimals: 2 },
  { id: "netDebtToEbitda", label: "Net debt ÷ EBITDA", short: "ND/EBITDA", category: "Financial health", unit: "x", decimals: 1, signed: true, about: "Debt and leases less cash and liquid investments, ÷ operating profit. Below 0 means more cash than debt." + NO_LENDERS },
  { id: "interestCoverage", label: "Interest coverage", short: "Int. cover", category: "Financial health", unit: "x", decimals: 1, about: "Operating profit ÷ interest." + NO_LENDERS },
  { id: "currentRatio", label: "Current ratio", short: "Curr. ratio", category: "Financial health", unit: "x", decimals: 2, about: "Current assets ÷ current liabilities." + NO_LENDERS },
  { id: "assetTurnover", label: "Asset turnover", short: "Asset turn", category: "Financial health", unit: "x", decimals: 2, about: "Sales ÷ total assets — how hard the assets work." },
  { id: "piotroski", label: "Piotroski score", short: "Piotroski", category: "Financial health", unit: "/9", decimals: 0, about: "Nine checks of financial strength; 7 or more is strong. Not scored for lenders." },

  // ── Cash flow ──
  { id: "ocfCr", label: "Cash from operations, last year", short: "CFO", category: "Cash flow", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "capexCr", label: "Capital spending, last year", short: "Capex", category: "Cash flow", unit: "₹ Cr", decimals: 0 },
  { id: "fcfCr", label: "Free cash flow, last year", short: "FCF", category: "Cash flow", unit: "₹ Cr", decimals: 0, signed: true, about: "Operating cash flow minus capital spending." + NO_LENDERS },
  { id: "ocfPat3yPct", label: "Cash from operations ÷ profit, 3 years", short: "OCF/PAT", category: "Cash flow", unit: "%", decimals: 0, about: "How much of the profit arrives as cash; 80% or more is healthy." },
  { id: "payoutPct", label: "Dividend payout", short: "Payout", category: "Cash flow", unit: "%", decimals: 0 },
  { id: "dividendPerShare", label: "Dividend per share, last 12 months", short: "DPS", category: "Cash flow", unit: "₹", decimals: 2 },

  // ── Income statement (last financial year) ──
  { id: "revenueCr", label: "Sales", short: "Sales", category: "Income statement", unit: "₹ Cr", decimals: 0 },
  { id: "ebitdaCr", label: "Operating profit (EBITDA)", short: "EBITDA", category: "Income statement", unit: "₹ Cr", decimals: 0, signed: true, about: "Before other income, depreciation, interest and tax." + NO_LENDERS },
  { id: "otherIncomeCr", label: "Other income", short: "Other inc.", category: "Income statement", unit: "₹ Cr", decimals: 0 },
  { id: "depreciationCr", label: "Depreciation", short: "Deprec.", category: "Income statement", unit: "₹ Cr", decimals: 0 },
  { id: "interestCr", label: "Interest (finance costs)", short: "Interest", category: "Income statement", unit: "₹ Cr", decimals: 0 },
  { id: "pbitCr", label: "Profit before interest and tax", short: "PBIT", category: "Income statement", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "pbtCr", label: "Profit before tax", short: "PBT", category: "Income statement", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "profitCr", label: "Net profit", short: "Profit", category: "Income statement", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "eps", label: "Earnings per share", short: "EPS", category: "Income statement", unit: "₹", decimals: 2, signed: true },
  { id: "rawMaterialsCr", label: "Raw materials and goods bought", short: "Materials", category: "Income statement", unit: "₹ Cr", decimals: 0 },

  // ── Balance sheet (latest year-end) ──
  { id: "totalAssetsCr", label: "Total assets", short: "Assets", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "equityCr", label: "Shareholders' equity", short: "Equity", category: "Balance sheet", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "totalDebtCr", label: "Total debt", short: "Debt", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "ltDebtCr", label: "Long-term debt", short: "LT debt", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "liquidCr", label: "Cash and liquid investments", short: "Cash", category: "Balance sheet", unit: "₹ Cr", decimals: 0, about: "Cash, fixed deposits and current investments (mostly liquid funds)." + NO_LENDERS },
  { id: "netDebtCr", label: "Net debt", short: "Net debt", category: "Balance sheet", unit: "₹ Cr", decimals: 0, signed: true, about: "Debt and leases less cash and liquid investments. Below 0 is net cash." + NO_LENDERS },
  { id: "currentAssetsCr", label: "Current assets", short: "Curr. assets", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "currentLiabilitiesCr", label: "Current liabilities", short: "Curr. liab.", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "shareCapitalCr", label: "Share capital", short: "Share cap.", category: "Balance sheet", unit: "₹ Cr", decimals: 0 },
  { id: "bookValuePerShare", label: "Book value per share", short: "BVPS", category: "Balance sheet", unit: "₹", decimals: 2, signed: true },

  // ── Size ──
  { id: "marketCapCr", label: "Market cap", short: "Mkt cap", category: "Size", unit: "₹ Cr", decimals: 0 },
  { id: "sharesCr", label: "Shares outstanding", short: "Shares", category: "Size", unit: "Cr shares", decimals: 2 },
  { id: "faceValue", label: "Face value", short: "Face value", category: "Size", unit: "₹", decimals: 2, about: "As in the latest filing — a split since then isn't reflected." },
];

// Category filters: a set of values rather than a range
export const CATEGORY_METRICS = [
  { id: "capSize", label: "Market cap size", category: "Size", options: ["Large cap", "Mid cap", "Small cap"], about: "By market-cap rank, as AMFI does: the top 100 are large, 101–250 mid, the rest small." },
  { id: "sector", label: "Sector", category: "Size" },
];

const BY_ID = new Map([...METRICS, ...CATEGORY_METRICS].map(x => [x.id, x]));
export const metricById = id => BY_ID.get(id);
export const valueOf = (x, m) => (x.get ? x.get(m) : m[x.id] ?? null);

// Large / mid / small by rank, the AMFI way (it ranks every listed company;
// this ranks the ones screened, which hold all the large and mid caps)
export function capSizes(rows) {
  const ranked = rows.filter(m => m.marketCapCr != null).sort((a, b) => b.marketCapCr - a.marketCapCr);
  const out = new Map();
  ranked.forEach((m, i) => out.set(m.symbol, i < 100 ? "Large cap" : i < 250 ? "Mid cap" : "Small cap"));
  return out;
}

// Each metric's spread across the market, for the sliders: min, max, and the
// value at every percentile (q[0] … q[100]). A slider steps through
// percentiles, so each notch moves past the same number of companies — a
// plain linear slider over market cap (₹6 Cr to ₹16 lakh Cr) would crush
// nearly every company into its first few pixels.
export function metricRanges(rows) {
  const out = {};
  for (const x of METRICS) {
    const vals = rows.map(m => valueOf(x, m)).filter(v => v != null && Number.isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) continue;
    const round = v => Number(v.toPrecision(4));
    const q = Array.from({ length: 101 }, (_, p) => round(vals[Math.round((p / 100) * (vals.length - 1))]));
    out[x.id] = { min: round(vals[0]), max: round(vals.at(-1)), q, known: vals.length };
  }
  return out;
}

// The strategies (presets.js) and older clients speak the original's criteria
// names; each is a range on one of the metrics above
export function criteriaToFilters(c = {}) {
  const f = [];
  const add = (id, min, max) => f.push({ id, min: min ?? null, max: max ?? null });
  if (c.revenue_growth_min) add("salesGrowth3y", c.revenue_growth_min);
  if (c.roe_min) add("roeAvg", c.roe_min);
  if (c.opm_min) add("opm", c.opm_min);
  if (c.roce_min) add("roce", c.roce_min);
  if (c.debt_to_equity_max != null && c.debt_to_equity_max < 3) add("debtToEquity", null, c.debt_to_equity_max);
  if (c.promoter_holding_min) add("promoterPct", c.promoter_holding_min);
  if (c.fii_holding_min) add("fiiPct", c.fii_holding_min);
  if (c.dii_holding_min) add("diiPct", c.dii_holding_min);
  if (c.exclude_pledged) add("pledgedPct", null, 5);
  if (c.market_cap_min || c.market_cap_max) add("marketCapCr", c.market_cap_min || null, c.market_cap_max || null);
  if (c.pe_max && c.pe_max < 100) add("pe", null, c.pe_max);
  if (c.dividend_yield_min) add("divYield", c.dividend_yield_min);
  if (c.price_to_book_max) add("priceToBook", null, c.price_to_book_max);
  if (c.profit_growth_5y_min) add("profitGrowth5y", c.profit_growth_5y_min);
  if (c.piotroski_min > 0) add("piotroski", c.piotroski_min);
  if (c.fcf_positive) add("fcfCr", 0);
  if (c.near_52w_low_pct > 0) add("upFrom52wLow", null, c.near_52w_low_pct);
  if (c.pct_below_52w_high_min > 0) add("downFrom52wHigh", c.pct_below_52w_high_min);
  if (c.net_net_graham) add("mcapToNcav", null, 2 / 3);
  else if (c.net_net) add("mcapToNcav", null, 1);
  if (Array.isArray(c.sectors) && c.sectors.length) f.push({ id: "sector", values: c.sectors });
  return f;
}

// Keeps only well-formed filters on known metrics
export function cleanFilters(filters) {
  if (!Array.isArray(filters)) return [];
  const num = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return filters.flatMap(f => {
    // Share links from before 3 Oct 2026 filter on the old score out of 10
    if (f?.id === "score") f = { id: "quality", min: num(f.min) == null ? null : num(f.min) * 10, max: num(f.max) == null ? null : num(f.max) * 10 };
    const x = f && BY_ID.get(f.id);
    if (!x) return [];
    if (x.options || x.id === "sector") {
      const values = Array.isArray(f.values) ? f.values.filter(v => typeof v === "string").slice(0, 60) : [];
      return values.length ? [{ id: x.id, values }] : [];
    }
    const min = num(f.min), max = num(f.max);
    return min === null && max === null ? [] : [{ id: x.id, min, max }];
  });
}

export function matchesFilters(m, filters, sizes) {
  for (const f of filters) {
    if (f.values) {
      const v = f.id === "capSize" ? sizes.get(m.symbol) : m[f.id];
      if (!f.values.includes(v)) return false;
      continue;
    }
    const v = valueOf(BY_ID.get(f.id), m);
    if (v == null || !Number.isFinite(v)) return false;
    if (f.min !== null && v < f.min) return false;
    if (f.max !== null && v > f.max) return false;
  }
  return true;
}

function fmt(x, v) {
  const n = Number(v);
  const s = x.unit === "₹ Cr" ? `₹${Math.round(n).toLocaleString("en-IN")} Cr`
    : x.unit === "₹" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
      : `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${x.unit === "%" ? "%" : x.unit === "x" ? "x" : ""}`;
  return s;
}

// The applied filters in words, for the line above the results
export function describeFilters(filters) {
  return filters.map(f => {
    const x = BY_ID.get(f.id);
    if (f.values) return `${x.label}: ${f.values.join(", ")}`;
    if (f.min !== null && f.max !== null) return `${x.label} ${fmt(x, f.min)} to ${fmt(x, f.max)}`;
    return f.min !== null ? `${x.label} ≥ ${fmt(x, f.min)}` : `${x.label} ≤ ${fmt(x, f.max)}`;
  }).join(" · ");
}

// Filters on data only some companies have: say how many, since the rest
// are left out rather than guessed
export function coverageNotes(rows, filters) {
  const notes = [];
  for (const f of filters) {
    if (f.values && f.id !== "sector") continue;
    const x = BY_ID.get(f.id);
    const known = f.id === "sector" ? rows.filter(m => m.sector).length : rows.filter(m => valueOf(x, m) != null).length;
    if (known < rows.length) {
      notes.push(`${x.label} is known for ${known.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} companies — the rest are left out.`);
    }
  }
  return notes;
}
