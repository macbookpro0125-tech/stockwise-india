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
    name: "Small Cap Multibaggers",
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
    id: "ofss_style_filter",
    name: "My OFSS-Style Filter",
    icon: "⭐",
    description: "Based on OFSS pattern: steady growth, high margins, strong promoter",
    criteria: {
      revenue_growth_min: 5,
      opm_min: 25,
      roe_min: 20,
      promoter_holding_min: 50,
      debt_to_equity_max: 0.2,
    },
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
];
