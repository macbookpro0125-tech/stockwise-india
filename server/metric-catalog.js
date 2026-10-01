// Every metric the screener can filter on and show as a column — one list
// that drives the filter picker, the table's columns, the range sliders and
// the strategies, so a metric added here appears everywhere at once. Values
// come from metrics.js's per-company object (get defaults to m[id]).
//
// A filter is { id, min, max } (inclusive, either end open) or, for a
// category metric, { id, values: [...] }. A company whose value is unknown is
// left out once a filter on that metric applies, and the screen says how many.

export const CATEGORIES = ["Valuation", "Profitability", "Growth", "Price & returns", "Ownership", "Financial health", "Cash flow", "Size", "Stockwise"];

const score10 = m => (m.score?.applicable ? Math.round((m.score.green / m.score.applicable) * 10) : null);

export const METRICS = [
  // ── Valuation ──
  { id: "pe", label: "P/E ratio", short: "P/E", category: "Valuation", unit: "x", decimals: 1, about: "Price ÷ last year's earnings per share. Loss-making companies have none." },
  { id: "medianPe", label: "5-year median P/E", short: "Median P/E", category: "Valuation", unit: "x", decimals: 1, about: "The company's usual P/E over its last five years — what its fair value is based on." },
  { id: "priceToBook", label: "Price to book", short: "P/B", category: "Valuation", unit: "x", decimals: 2 },
  { id: "divYield", label: "Dividend yield", short: "Div yield", category: "Valuation", unit: "%", decimals: 1, about: "Dividends paid over the last 12 months ÷ today's price." },
  { id: "vsFairValue", label: "Price vs fair value", short: "vs FV", category: "Valuation", unit: "%", decimals: 1, signed: true, about: "How far today's price is above (+) or below (−) the company's 2-year fair value." },
  { id: "vsPhase1", label: "Price vs Phase 1 buy price", short: "vs P1", category: "Valuation", unit: "%", decimals: 1, signed: true, about: "0 or less means today's price is at or under the Phase 1 buy price." },
  { id: "mcapToNcav", label: "Market cap ÷ net current assets", short: "MCap/NCAV", category: "Valuation", unit: "x", decimals: 2, about: "Graham's net-net test: under 1 means the market values the company at less than its current assets minus all its liabilities." },

  // ── Profitability ──
  { id: "roce", label: "Return on capital employed (ROCE)", short: "ROCE", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roe", label: "Return on equity (ROE)", short: "ROE", category: "Profitability", unit: "%", decimals: 1 },
  { id: "roeAvg", label: "ROE, 5-year average", short: "ROE 5Y", category: "Profitability", unit: "%", decimals: 1 },
  { id: "opm", label: "Operating profit margin (OPM)", short: "OPM", category: "Profitability", unit: "%", decimals: 1, about: "Banks and other lenders don't report one." },
  { id: "netMargin", label: "Net profit margin", short: "Net margin", category: "Profitability", unit: "%", decimals: 1 },

  // ── Growth ──
  { id: "salesGrowth3y", label: "3-year sales growth (per year)", short: "Sales 3Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "salesGrowth5y", label: "5-year sales growth (per year)", short: "Sales 5Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "profitGrowth3y", label: "3-year profit growth (per year)", short: "Profit 3Y", category: "Growth", unit: "%", decimals: 1 },
  { id: "profitGrowth5y", label: "5-year profit growth (per year)", short: "Profit 5Y", category: "Growth", unit: "%", decimals: 1 },

  // ── Price & returns ──
  { id: "cmp", label: "Price", short: "Price", category: "Price & returns", unit: "₹", decimals: 2 },
  { id: "ret1d", label: "1-day return", short: "1D", category: "Price & returns", unit: "%", decimals: 2, signed: true },
  { id: "ret1w", label: "1-week return", short: "1W", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1m", label: "1-month return", short: "1M", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret6m", label: "6-month return", short: "6M", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "ret1y", label: "1-year return", short: "1Y", category: "Price & returns", unit: "%", decimals: 1, signed: true },
  { id: "downFrom52wHigh", label: "Below 52-week high", short: "↓52W high", category: "Price & returns", unit: "%", decimals: 1 },
  { id: "upFrom52wLow", label: "Above 52-week low", short: "↑52W low", category: "Price & returns", unit: "%", decimals: 1 },

  // ── Ownership ──
  { id: "promoterPct", label: "Promoter holding", short: "Promoter", category: "Ownership", unit: "%", decimals: 1 },
  { id: "fiiPct", label: "FII holding", short: "FII", category: "Ownership", unit: "%", decimals: 1, about: "Foreign institutional investors." },
  { id: "diiPct", label: "DII holding", short: "DII", category: "Ownership", unit: "%", decimals: 1, about: "Domestic institutions: mutual funds, insurers, banks." },
  { id: "pledgedPct", label: "Promoter shares pledged", short: "Pledged", category: "Ownership", unit: "%", decimals: 1, about: "Share of the promoters' own holding that is pledged." },

  // ── Financial health ──
  { id: "debtToEquity", label: "Debt to equity", short: "D/E", category: "Financial health", unit: "x", decimals: 2 },
  { id: "interestCoverage", label: "Interest coverage", short: "Int. cover", category: "Financial health", unit: "x", decimals: 1, about: "Operating profit ÷ interest. Not shown for lenders." },
  { id: "currentRatio", label: "Current ratio", short: "Curr. ratio", category: "Financial health", unit: "x", decimals: 2, about: "Current assets ÷ current liabilities. Not shown for lenders." },
  { id: "piotroski", label: "Piotroski score", short: "Piotroski", category: "Financial health", unit: "/9", decimals: 0, about: "Nine checks of financial strength; 7 or more is strong. Not scored for lenders." },

  // ── Cash flow ──
  { id: "fcfCr", label: "Free cash flow, last year", short: "FCF", category: "Cash flow", unit: "₹ Cr", decimals: 0, signed: true, about: "Operating cash flow minus capital spending. Not shown for lenders." },
  { id: "ocfPat3yPct", label: "Cash from operations ÷ profit, 3 years", short: "OCF/PAT", category: "Cash flow", unit: "%", decimals: 0, about: "How much of the profit arrives as cash; 80% or more is healthy." },
  { id: "payoutPct", label: "Dividend payout", short: "Payout", category: "Cash flow", unit: "%", decimals: 0 },

  // ── Size ──
  { id: "marketCapCr", label: "Market cap", short: "Mkt cap", category: "Size", unit: "₹ Cr", decimals: 0 },
  { id: "revenueCr", label: "Sales, last year", short: "Sales", category: "Size", unit: "₹ Cr", decimals: 0 },
  { id: "profitCr", label: "Net profit, last year", short: "Profit", category: "Size", unit: "₹ Cr", decimals: 0, signed: true },
  { id: "eps", label: "Earnings per share", short: "EPS", category: "Size", unit: "₹", decimals: 2, signed: true },

  // ── Stockwise ──
  { id: "score", label: "Quality score", short: "Score", category: "Stockwise", unit: "/10", decimals: 0, get: score10, about: "Green flags out of the 10 checks that apply, scaled to 10." },
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
