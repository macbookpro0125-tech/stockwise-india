// Banks valued on book, not earnings (the sector-aware valuation spec of
// 11 Oct 2026). A bank's product is its balance sheet: its earnings swing
// with provisioning, and its cash flow is deposits and loans moving, so the
// P/E history and the DCF both mislead. Instead
//
//   fair value     = justified P/B × adjusted book value per share
//   justified P/B  = (through-cycle ROE − g) ÷ (cost of equity − g)
//   g              = ROE × (1 − payout), at most 8% and 4 points under the
//                    cost of equity — the formula explodes as g nears it
//   adjusted book  = owners' equity − net NPA (bad loans not yet provided for)
//
// The research score's price-to-book check (research.js) and the stock
// page's fair value and levels (metrics.js) both come from here, so they
// can't disagree.

import { roundPrice } from "./levels.js";

export const COST_OF_EQUITY = 12; // %, as the DCF on the stock page
// Government-owned banks: a point more for the state's say in lending and
// capital (the spec's +1)
export const PSU_PREMIUM = 1;
export const MAX_GROWTH = 8;
export const MIN_SPREAD = 4;
// Five to seven years of return on equity on file, the bad ones included
export const MIN_ROE_YEARS = 5, MAX_ROE_YEARS = 7;
// Which return the value runs on (decided 12 Oct 2026). With bad loans
// cleaned up — net NPA under 2% — the last three years' median: the
// through-cycle median of seven was mostly the 2018–22 clean-up for the
// government banks (PNB's 4.4% against 13–15% since, a fair value of ₹32 at
// ₹117) and the formula punishes a return under the cost of equity hard.
// The through-cycle value stays beside it, "on seven years, bad ones included".
// With bad loans still high, the through-cycle median: they may not be over.
export const RECENT_ROE_YEARS = 3, CLEAN_NNPA_PCT = 2;
// A return at or under the growth rate supports little more than a fraction
// of book; floored so the multiple stays meaningful
export const PB_FLOOR = 0.25;

// The government holds a majority in each (IDBI with LIC)
export const PSU_BANKS = new Set([
  "SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK", "BANKINDIA", "INDIANB",
  "CENTRALBK", "IOB", "UCOBANK", "MAHABANK", "PSB", "IDBI",
]);

const finite = v => typeof v === "number" && Number.isFinite(v);
const r2 = v => (finite(v) ? Math.round(v * 100) / 100 : null);
function median(values) {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (!v.length) return null;
  const k = v.length >> 1;
  return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
}

export const costOfEquity = symbol => COST_OF_EQUITY + (PSU_BANKS.has(symbol) ? PSU_PREMIUM : 0);

// { raw, g }: the rate retained earnings support, and the one the model uses
export function sustainableGrowth(roe, payoutPct, ke) {
  if (!finite(roe) || !finite(ke)) return null;
  const retained = 1 - Math.min(Math.max(finite(payoutPct) ? payoutPct : 0, 0), 100) / 100;
  const raw = roe * retained;
  return { raw, g: Math.min(raw, MAX_GROWTH, ke - MIN_SPREAD) };
}

export function justifiedPb(roe, g, ke) {
  if (![roe, g, ke].every(finite) || !(ke > g)) return null;
  return Math.max((roe - g) / (ke - g), PB_FLOOR);
}

// roes: the last years' return on equity, newest first (%); payoutPct: the
// share of earnings paid out; equity and nnpa in rupees; shares on today's
// basis; pbHistory: the bank's P/B at past year-ends, for the cross-check.
// Returns { needsData } when the inputs aren't there — never a forced number.
export function bankValuation({ symbol, roes, payoutPct, equity, nnpa, nnpaPct, shares, pbHistory = [] }) {
  const years = (roes ?? []).slice(0, MAX_ROE_YEARS).filter(finite);
  if (years.length < MIN_ROE_YEARS) return { needsData: `Needs ${MIN_ROE_YEARS} years of return on equity; ${years.length} on file.` };
  if (!(equity > 0) || !(shares > 0)) return { needsData: "Needs the bank's equity and share count." };
  const ke = costOfEquity(symbol);
  const throughRoe = median(years);
  const recent = years.slice(0, RECENT_ROE_YEARS);
  const clean = finite(nnpaPct) && nnpaPct < CLEAN_NNPA_PCT;
  const roeBasis = clean && recent.length === RECENT_ROE_YEARS ? "recent" : "through-cycle";
  const roe = roeBasis === "recent" ? median(recent) : throughRoe;
  const growth = sustainableGrowth(roe, payoutPct, ke);
  const pb = justifiedPb(roe, growth.g, ke);
  const nnpaKnown = finite(nnpa);
  const adjustedBook = equity - (nnpaKnown ? Math.max(nnpa, 0) : 0);
  if (!(adjustedBook > 0)) return { needsData: "Net bad loans exceed the bank's equity." };
  const adjustedBvps = adjustedBook / shares;
  // Two rates against two costs of equity, so the fragility is in view: the
  // retained-earnings rate uncapped (or two points over the model's when the
  // cap didn't bind) beside the model's, at its cost of equity and a point more
  const gHigh = growth.raw > growth.g + 0.05 ? growth.raw : growth.g + 2;
  const cell = (g, k) => {
    const m = justifiedPb(roe, g, k);
    return { g: r2(g), ke: k, pb: r2(m), value: m != null ? roundPrice(m * adjustedBvps) : null };
  };
  const grid = [
    { label: growth.raw > growth.g + 0.05 ? "uncapped" : "+2 points", cells: [cell(gHigh, ke), cell(gHigh, ke + 1)] },
    { label: "the model's", cells: [cell(growth.g, ke), cell(growth.g, ke + 1)] },
  ];
  // The P/B twin of the P/E-median method: what the market has usually paid
  // The same book on the seven-year median, bad years included
  const stressG = sustainableGrowth(throughRoe, payoutPct, ke);
  const stressPb = justifiedPb(throughRoe, stressG.g, ke);
  const throughCycle = roeBasis === "recent" ? { roe: r2(throughRoe), years: years.length, growth: r2(stressG.g), pb: r2(stressPb), value: stressPb != null ? roundPrice(stressPb * adjustedBvps) : null } : null;
  const usualPb = pbHistory.filter(v => finite(v) && v > 0).length >= 3 ? median(pbHistory.filter(v => finite(v) && v > 0)) : null;
  return {
    model: "book",
    roe: r2(roe), roeYears: roeBasis === "recent" ? RECENT_ROE_YEARS : years.length, roeBasis,
    nnpaPct: finite(nnpaPct) ? r2(nnpaPct) : null, throughCycle,
    payoutPct: r2(finite(payoutPct) ? payoutPct : 0),
    growthRaw: r2(growth.raw), growth: r2(growth.g), costOfEquity: ke, psu: PSU_BANKS.has(symbol),
    justifiedPb: r2(pb),
    // Unrounded, for the price levels: the fair value and fv25 then agree to
    // the rupee (rounded P/B × rounded book drifted by ₹1)
    exact: { pb, adjustedBvps },
    equityCr: equity / 1e7, nnpaCr: nnpaKnown ? nnpa / 1e7 : null, nnpaKnown,
    adjustedBookCr: adjustedBook / 1e7, adjustedBvps: r2(adjustedBvps), bookPerShare: r2(equity / shares),
    fairValue: pb != null ? roundPrice(pb * adjustedBvps) : null,
    grid,
    usualPb: r2(usualPb), usualPbYears: pbHistory.filter(v => finite(v) && v > 0).length,
    crossCheck: usualPb != null ? roundPrice(usualPb * adjustedBvps) : null,
  };
}
