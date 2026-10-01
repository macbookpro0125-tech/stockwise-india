// Ported from stock-screener's src/score.js — same ten checks, same
// thresholds, same bank/utility/cyclical treatment. Two additions only:
// the classification flags can be supplied directly (this app knows lenders
// from their filing template and cyclicals/utilities from NSE's sector lists,
// rather than from Screener's industry text), and each check's outcome is
// returned so the stock page can show what passed.

function parsePct(s) {
  const m = String(s ?? "").match(/([-\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

const CYCLICAL_KEYWORDS = [
  "refineries", "crude oil", "oil exploration", "coal", "mining", "minerals",
  "steel", "iron", "aluminium", "aluminum", "copper", "zinc", "metals",
  "commodity", "sugar", "fertilizers", "petrochemicals", "shipping",
  "airlines", "real estate", "construction materials", "cement",
  "gas transmission", "gas marketing",
  "residential", "commercial projects", "realty",
];

export function isCyclical(industry, sector) {
  const text = `${industry || ""} ${sector || ""}`.toLowerCase();
  return CYCLICAL_KEYWORDS.some(k => text.includes(k));
}

const LENDER_KEYWORDS = [
  "sector bank", "nbfc", "non banking financial",
  "housing finance", "home finance", "consumer finance",
  "microfinance", "micro finance",
];

export function isLender(industry) {
  const text = String(industry || "").toLowerCase();
  return LENDER_KEYWORDS.some(k => text.includes(k));
}

const UTILITY_KEYWORDS = [
  "utilities", "power - transmission", "power transmission",
  "power generation", "power - generation", "power distribution",
  "electric utilities", "integrated power", "water supply",
];

export function isRegulatedUtility(industry, sector) {
  const text = `${industry || ""} ${sector || ""}`.toLowerCase();
  return UTILITY_KEYWORDS.some(k => text.includes(k));
}

/**
 * Green flags plus the number of checks that actually applied.
 * Only leverage and cash conversion may leave the denominator (for lenders),
 * so a bank scores out of 8 and everything else out of 10 — as in the original.
 */
export function computeScoreParts(enrichData, fallback = {}) {
  if (!enrichData) return null;
  const e = enrichData;
  const cyclical = e.cyclical ?? isCyclical(e.industry ?? e.industryName, e.sector);
  const lender = e.lender ?? isLender(e.industry ?? e.industryName);
  const utility = e.utility ?? isRegulatedUtility(e.industry ?? e.industryName, e.sector);

  let green = 0, applicable = 0;
  const checks = [];
  const check = (id, label, ok) => {
    applicable += 1;
    if (ok) green += 1;
    checks.push({ id, label, ok: !!ok });
  };

  // PT1 — growth. Cyclical growth is the cycle talking, so it earns nothing.
  check("growth", `Sales growth (5Y) ≥ ${utility ? 6 : 10}%${cyclical ? " — cyclical, not counted" : ""}`,
    parsePct(e.salesGrowth5y) >= (utility ? 6 : 10) && !cyclical);

  // PT2 — profitability. ROE for lenders and regulated utilities, ROCE otherwise.
  const profitability = (lender || utility) ? (e.roe ?? fallback.roe) : (e.roce ?? fallback.roce);
  check("profitability", `${lender || utility ? "ROE" : "ROCE"} ≥ 15%${cyclical ? " — cyclical, not counted" : ""}`,
    profitability != null && profitability >= 15 && !cyclical);

  // PT3 — business model: more pros than cons.
  check("business", `More pros than cons${cyclical ? " — cyclical, not counted" : ""}`,
    (e.pros?.length || 0) > 0 && e.pros.length >= (e.cons?.length || 0) && !cyclical);

  // PT4 — promoter signal.
  const promot = e.promoterPct ?? e.promoterHolding ?? fallback.promoterHolding;
  check("promoter", "Promoter holding ≥ 50%", promot != null && promot >= 50);

  // PT5 / PT6 — valuation and entry.
  check("fair-value", "Price at or below 2-year fair value", !!(e.fairValue && e.cmp && e.cmp <= e.fairValue));
  check("safe-buy", "Price at or below Phase 1 buy price", !!(e.safeBuyPrice && e.cmp && e.cmp <= e.safeBuyPrice));

  // PT7 — a profit every year. The original's point 7 was an analyst's call on
  // AI and tech disruption that defaulted to "safe", so every company got it
  // free. Now: a profit in every year on record — 3 to 5 consecutive years. A
  // shorter record doesn't count as a track record.
  const record = e.profitRecord ?? { years: 0, lossYears: [] };
  const losses = record.lossYears.length;
  check("record",
    record.years < 3 ? "Profit every year — under 3 years of results on file"
      : losses ? `Profit every year — a loss in ${losses} of the last ${record.years}`
        : `Profit every year — each of the last ${record.years}`,
    record.years >= 3 && losses === 0);

  // PT8 — leverage. Meaningless for lenders; a higher bar for utilities.
  if (!lender) check("leverage", `Debt/equity < ${utility ? 1.5 : 0.5}`, e.debtToEquity != null && e.debtToEquity < (utility ? 1.5 : 0.5));

  // PT9 — cash conversion. For a lender this tracks loan-book growth, not quality.
  if (!lender) check("cash", "Operating cash flow ≥ 80% of profit (3Y)", e.ocfPat3yPct != null && e.ocfPat3yPct >= 80);

  // PT10 — promoter pledging. The original checked client concentration (the
  // top 5 clients' share of revenue), which only annual reports give: always
  // unknown here, so no company could reach 10/10. Pledging is known for
  // every company from its shareholding filing, and pledged shares can be
  // sold by lenders in a fall. A widely held company has none to pledge.
  const pledged = e.pledgedPct ?? fallback.pledgedPct;
  check("pledge", "Promoter shares pledged under 5%", promot === 0 || (pledged != null && pledged < 5));

  return { green, applicable, checks };
}
