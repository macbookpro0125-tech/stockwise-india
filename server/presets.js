export const PRESETS = [
  {
    id: "high_quality_compounders",
    name: "High Quality Compounders",
    icon: "📈",
    description: "Buffett-style: durable businesses with strong moats",
    criteria: {
      revenue_growth_min: 10,
      roe_min: 18,
      opm_min: 18,
      roce_min: 20,
      debt_to_equity_max: 0.3,
      promoter_holding_min: 40,
      pe_max: 50,
      exclude_pledged: true,
    },
  },
  {
    id: "dividend_aristocrats",
    name: "Dividend Aristocrats",
    icon: "💰",
    description: "Consistent dividend payers with stable cash flows",
    criteria: {
      dividend_yield_min: 1.5,   // relaxed from 2.5 — 2.5% is rare among quality mid/large caps
      roe_min: 12,
      debt_to_equity_max: 1.0,
      promoter_holding_min: 30,
      market_cap_min: 5000,
    },
  },
  {
    id: "undervalued_growth",
    name: "Undervalued Growth",
    icon: "💎",
    description: "Growing companies trading below fair value",
    criteria: {
      revenue_growth_min: 12,    // relaxed from 15 — 12%+ growth is still above-average
      roe_min: 15,
      debt_to_equity_max: 0.5,
      pe_max: 38,                // relaxed from 35 — more realistic for Indian growth stocks
    },
  },
  {
    id: "defensive_bluechips",
    name: "Defensive Bluechips",
    icon: "🛡️",
    description: "Stable large-caps for risk-averse investors",
    criteria: {
      market_cap_min: 50000,
      roe_min: 12,
      promoter_holding_min: 35,
      dividend_yield_min: 1.0,
    },
  },
  {
    id: "small_cap_multibaggers",
    // 25 Oct 2026: describes what it looks for, not a return it promises
    name: "Small Caps with Multibagger Traits",
    icon: "🚀",
    description: "High-growth small caps with strong fundamentals",
    criteria: {
      market_cap_min: 500,
      market_cap_max: 5000,
      revenue_growth_min: 15,    // relaxed from 20 — still high growth for small caps
      roce_min: 15,              // relaxed from 18 — still strong ROCE threshold
      debt_to_equity_max: 0.5,
      promoter_holding_min: 50,
    },
  },
  {
    // Named for what it finds (20 Oct 2026; was "My OFSS-Style Filter"); the
    // id stays, so its performance record carries on
    id: "ofss_style_filter",
    name: "High Margins, Low Debt",
    icon: "⭐",
    description: "Wide margins and high returns on equity, little debt, and promoters who own over half",
    criteria: {
      revenue_growth_min: 5,
      opm_min: 25,
      roe_min: 20,
      promoter_holding_min: 50,
      debt_to_equity_max: 0.2,
    },
  },
  // Asked for 22 Oct 2026: "a strategy where I can see the highest gained
  // stock — 1 year, 6 months, 1 week or 1 day", then "3 and 5 years". Ranked by the return over
  // the period picked (sort; the list's period switch offers the others),
  // risers only, from ₹500 crore up so the thinly traded smallest companies,
  // where a few trades move the price 20%, don't fill the top.
  {
    id: "top_gainers",
    name: "Top Gainers",
    icon: "🏆",
    description: "The shares that rose most over the last day, week, month, six months, year, three years or five years",
    filters: [
      { id: "ret1y", min: 0, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
    sort: "ret1y",
    // as asked, longest first; a year is the one it opens on
    periods: ["ret5y", "ret3y", "ret1y", "ret6m", "ret1m", "ret1w", "ret1d"],
  },
  {
    id: "momentum_growth",
    name: "Momentum Growth",
    icon: "⚡",
    description: "High quarterly growth with strong price momentum",
    criteria: {
      revenue_growth_min: 25,
      roe_min: 15,
      debt_to_equity_max: 1.0,
      promoter_holding_min: 30,
    },
  },
  {
    id: "turnaround_plays",
    name: "Turnaround Plays",
    icon: "🔄",
    description: "Improving businesses with low valuation and low debt",
    criteria: {
      revenue_growth_min: 10,
      pe_max: 20,
      debt_to_equity_max: 0.5,
      roce_min: 12,
    },
  },
  {
    id: "psu_value",
    name: "PSU Value Picks",
    icon: "🏛️",
    description: "Government-backed companies with dividends and low P/E",
    criteria: {
      pe_max: 15,
      dividend_yield_min: 2.0,
      roe_min: 10,
      market_cap_min: 5000,
    },
  },
  {
    id: "dividend_growth",
    name: "Dividend Growth",
    icon: "🌱",
    description: "Companies growing dividends with strong cash generation",
    criteria: {
      dividend_yield_min: 1.0,
      revenue_growth_min: 10,
      roe_min: 15,
      debt_to_equity_max: 0.5,
      promoter_holding_min: 35,
    },
  },
  {
    id: "fii_favorites",
    name: "FII Favorites",
    icon: "🌐",
    description: "Stocks with high foreign institutional investor holding",
    criteria: {
      fii_holding_min: 20,
      market_cap_min: 10000,
      roe_min: 12,
      debt_to_equity_max: 1.0,
    },
  },
  {
    id: "dii_backed",
    name: "DII Backed",
    icon: "🏦",
    description: "Strong domestic mutual fund and insurance backing",
    criteria: {
      dii_holding_min: 25,
      market_cap_min: 5000,
      roe_min: 10,
    },
  },
  {
    id: "net_net_value",
    name: "Net-Net (Graham)",
    icon: "🧮",
    description: "Market cap below net current asset value (Current Assets − Total Liabilities) — Graham's deepest value screen. ⅔-of-NCAV bargains are flagged green.",
    criteria: {
      net_net: true,
      market_cap_min: 10,
    },
  },
  // Asked for 9 Oct 2026: a price chart that's green on every view — up
  // over a month, six months, a year and five years (the longest the daily
  // files reach; the company page's chart shows the whole history). Filters
  // straight on the returns, which the old criteria never covered.
  {
    id: "up_every_timeframe",
    name: "Up on Every Timeframe",
    icon: "📈",
    description: "Share price higher over 1 month, 6 months, 1 year and 5 years",
    filters: [
      { id: "ret1m", min: 0, max: null },
      { id: "ret6m", min: 0, max: null },
      { id: "ret1y", min: 0, max: null },
      { id: "priceCagr5y", min: 0, max: null },
    ],
  },
  // Four more, 16 Oct 2026, after a look at the ready-made screens other
  // screeners offer for India: the ideas that work on NSE companies and on
  // this app's figures, in its own words. (Long dividend streaks find no
  // Indian company; staff counts and R&D spending aren't in the filings here.)
  {
    id: "near_highs_cheap",
    name: "Near Highs, Still Cheap",
    icon: "⛰️",
    description: "Close to their 52-week high, yet still on a low P/E with earnings rising fast",
    filters: [
      { id: "downFrom52wHigh", min: null, max: 10 },
      { id: "pe", min: 0, max: 20 },
      { id: "epsGrowth1y", min: 25, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
  },
  {
    id: "debt_paydown",
    name: "Paying Down Debt",
    icon: "⚖️",
    description: "Cutting debt hard while sales and operating profit keep growing",
    filters: [
      { id: "debtChange1y", min: null, max: -15 },
      { id: "salesGrowth1y", min: 15, max: null },
      { id: "ebitdaGrowth1y", min: 15, max: null },
      { id: "debtToEquity", min: null, max: 1 },
    ],
  },
  {
    id: "fallen_quality",
    name: "Fallen Quality",
    icon: "🔻",
    description: "Well-run companies whose shares have been sold off hard lately",
    filters: [
      { id: "quality", min: 60, max: null },
      { id: "rsi14", min: null, max: 30 },
    ],
  },
  {
    id: "doubled_in_year",
    name: "Doubled in a Year",
    icon: "⏫",
    description: "Established companies whose share price has at least doubled in a year",
    filters: [
      { id: "ret1y", min: 100, max: null },
      { id: "marketCapCr", min: 1000, max: null },
    ],
  },
  // Four more, 31 Oct 2026, after a look at the screen lists technical
  // screeners offer: the ones this app's own daily NSE figures support, in
  // plain words. (Chart patterns — cup with handle, VCP — are left out:
  // picking them by code is too unreliable to show as fact.)
  {
    id: "unusual_volume",
    name: "Unusual Volume",
    icon: "📊",
    description: "Traded three times a usual day or more on the last trading day",
    filters: [
      { id: "volVsAvg50", min: 3, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
    sort: "volVsAvg50",
  },
  {
    id: "delivery_spike",
    name: "Delivery Spike",
    icon: "📦",
    description: "Far more of the last day's trades were taken as delivery than usual for the company",
    filters: [
      { id: "deliveryJump", min: 20, max: null },
      { id: "delivery1d", min: 60, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
    sort: "deliveryJump",
  },
  {
    id: "pullback_50dma",
    name: "Pullback to the 50-Day Average",
    icon: "↩️",
    description: "In an uptrend, now back near its 50-day average price",
    filters: [
      { id: "vsSma50", min: -3, max: 3 },
      { id: "vsSma200", min: 10, max: null },
      { id: "ret6m", min: 15, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
  },
  {
    id: "beating_market",
    name: "Beating the Market",
    icon: "🏁",
    description: "Ahead of the NIFTY 50 over the last month, three months and year",
    filters: [
      { id: "ret3mVsNifty", min: 10, max: null },
      { id: "ret1mVsNifty", min: 0, max: null },
      { id: "ret1yVsNifty", min: 0, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
    sort: "ret3mVsNifty",
  },
  // 31 Oct 2026: a breakout as plain figures — at a 52-week high on the
  // last trading day, on clearly heavier volume than usual, the day up
  {
    id: "breaking_out",
    name: "Breaking Out",
    icon: "🚀",
    description: "At a 52-week high on the last trading day, on at least 1.5 times a usual day's volume",
    filters: [
      { id: "downFrom52wHigh", min: null, max: 1 },
      { id: "volVsAvg50", min: 1.5, max: null },
      { id: "ret1d", min: 0, max: null },
      { id: "marketCapCr", min: 500, max: null },
    ],
    sort: "volVsAvg50",
  },
  {
    // Banks on their own figures (bad loans, capital, return on assets) —
    // debt and margins don't fit a bank. Usual Indian yardsticks: gross NPA
    // under 2% healthy, CET1 well over the 8% floor with buffer, ROA over 1%.
    id: "sound_banks",
    name: "Sound Banks",
    icon: "🏦",
    description: "Banks with few bad loans, plenty of capital and a good return on assets",
    filters: [
      { id: "gnpaPct", min: null, max: 2 },
      { id: "nnpaPct", min: null, max: 0.5 },
      { id: "cet1Pct", min: 12, max: null },
      { id: "roaPct", min: 1, max: null },
    ],
  },
];
