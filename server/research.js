// The research dashboard: a quality score out of 100 in six weighted groups,
// a separate technical setup and risk score, and an overall research score —
// in place of the original's 10-point checklist, after "Stockwise India —
// Scoring System Redesign" (2 Oct 2026). Adapted to what NSE's filings give:
//
// - Items the filings can't show (related-party deals, auditor issues,
//   competitive position, forecasts, market size, a cash-flow model) stay on
//   the list as "not checked", so a score never looks more complete than it
//   is. They count in coverage, never in the score.
// - A missing number is never a zero or a pass. The item is left out, the
//   group's weights renormalise over what was checked, and coverage says so.
//   An item that doesn't apply (a bank's debt ratio) leaves the group entirely.
// - Valuation is at NSE's last close, not a live price, so Discover and the
//   stock page show the same score.
// - The overall score blends quality *without* valuation with valuation —
//   blending the full score would count valuation twice — and its risk
//   overlay uses only price behaviour and data gaps, the proposal's own rule
//   against counting debt or pledging a second time.
// - No buy or sell labels anywhere: the result is research language.
//
// Weights and bands are a stated starting point, not a fitted model — the
// proposal says so too. Change them here and RESEARCH_VERSION together.

export const RESEARCH_VERSION = "1.5"; // 1.5: banks scored on their own bad-loan, capital and efficiency figures

// ── Helpers ────────────────────────────────────────────────────────────────

const finite = v => v != null && Number.isFinite(v);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const median = a => { const s = [...a].sort((x, y) => x - y); const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const sd = a => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const r1 = v => Math.round(v * 10) / 10;
const pct = (v, dp = 1) => `${Number(v.toFixed(dp)).toLocaleString("en-IN")}%`;
const times = v => `${v.toFixed(v < 10 ? 1 : 0)}x`;
const crore = v => `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
const rupees = v => `₹${Math.round(v).toLocaleString("en-IN")}`;
const fy = iso => `FY${iso.slice(2, 4)}`;
const dayText = iso => new Date(`${iso}T00:00:00Z`).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
// "consolidated " / "standalone " — which accounts the figures (and the audit
// opinion) are from; a company can be clean on one and qualified on the other
const scopeWord = m => (/consolidated/i.test(m.scope ?? "") ? "consolidated " : /standalone/i.test(m.scope ?? "") ? "standalone " : "");

// Piecewise-linear score between anchors [x, score] (x ascending), flat
// beyond the ends — the proposal's "interpolate between published anchors"
export function band(x, anchors) {
  if (!finite(x)) return null;
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, s1] = anchors[i];
    if (x <= x1) {
      const [x0, s0] = anchors[i - 1];
      return s0 + ((x - x0) / (x1 - x0)) * (s1 - s0);
    }
  }
  return anchors.at(-1)[1];
}

// How an item's score reads in a sentence
const word = s => (s >= 75 ? "strong" : s >= 50 ? "fair" : s >= 25 ? "weak" : "poor");

const missing = reason => ({ missing: reason });
// Not in NSE's filings at all — needs an annual report or a forecast
const notInFilings = reason => ({ missing: reason, structural: true });
// hide: a test for another kind of company (a bank's on a manufacturer, a
// manufacturer's on a bank) — listed nowhere, rather than "doesn't apply"
const notApplicable = (reason, hide = false) => ({ na: reason, ...(hide && { hide: true }) });
const checked = (score, value, display, reason) => ({ score: clamp(score, 0, 100), value, display, reason });

const yearOf = h => Number(h.fyEnd.slice(0, 4));
// History rows from the latest fiscal year back n years (newest first)
const lastYears = (m, n) => m.history.filter(h => yearOf(m.history[0]) - yearOf(h) < n);
const yearsBack = (m, n) => m.history.find(h => yearOf(m.history[0]) - yearOf(h) === n) ?? null;
// [newer, older] pairs of consecutive fiscal years
// A company listed too recently for the years a check needs is judged on its
// last eight quarters instead (Waaree, Hyundai India, Swiggy: two years of
// annual results on NSE). Each quarter is set against the same quarter a year
// earlier, so a seasonal business isn't marked down for its seasons. Only ever
// a stand-in: a company with the years uses the years.
const sameQuarterPairs = m => {
  const qs = (m.quarters ?? []).slice(0, 8);
  return qs.slice(0, 4).map((q, i) => [q, qs[i + 4]])
    .filter(([q, ago]) => ago && Math.abs(Date.parse(q.fyEnd) - Date.parse(ago.fyEnd) - 365 * 86400000) <= 20 * 86400000);
};
const RECENT = "listed too recently for the years this check needs";

const consecutive = rows => rows.slice(0, -1).map((h, i) => [h, rows[i + 1]]).filter(([a, b]) => yearOf(a) - yearOf(b) === 1);

// ── Bands ──────────────────────────────────────────────────────────────────

// The proposal's ROIC bands (0% → 0, 5% → 25, 10% → 50, 15% → 75, 25% → 100)
// grossed up for a 25% tax rate, since ROCE is before tax
const ROCE_BANDS = [[0, 0], [7, 25], [13, 50], [20, 75], [33, 100]];
// Lenders and regulated utilities earn on equity; 15% is a good bank
const ROE_BANDS = [[0, 0], [8, 25], [12, 50], [15, 75], [20, 100]];
const GROWTH_BANDS = [[-5, 0], [0, 20], [5, 40], [10, 60], [15, 80], [25, 100]];
const EPS_GROWTH_BANDS = [[-10, 0], [0, 20], [5, 40], [10, 60], [15, 80], [25, 100]];
const D_E_BANDS = [[0, 100], [0.25, 85], [0.5, 65], [1, 40], [2, 10], [3, 0]];
// A regulated utility carries project debt against set returns
const D_E_BANDS_UTILITY = [[0, 100], [0.5, 85], [1, 70], [1.5, 55], [2.5, 20], [3.5, 0]];

// ── Banks ──────────────────────────────────────────────────────────────────
// A bank's own tests, from its standalone filings (metrics.js bankHealth):
// bad loans, provision cover, capital and credit cost in the balance-sheet
// group; return on assets and cost-to-income in business quality. They apply
// to banks only — every other company, NBFCs included (their filings don't
// carry these ratios), has them as not applicable, so no one else's score
// moves.
const NBFC_BALANCE = "Bad-loan and capital ratios — a lender's real balance-sheet tests — aren't in NBFC filings on NSE.";
const INDUSTRIAL_ONLY = "An industrial test — a bank is judged on its bad loans and capital instead.";
const BANK_NOT_READ = "The bank's bad-loan and capital figures aren't on file yet — they're read from its next filing check.";
const asAt = iso => (iso ? ` at ${dayText(iso)}` : "");
const inFy = iso => (iso ? ` in ${fy(iso)}` : "");
// Weights: in business quality the bank items share the 20% "reinvestment"
// holds for everyone else (it doesn't apply to a bank); in the balance sheet
// they add up to 100% on their own, as the industrial items do
function bankItem(id, weight, label, fn) {
  return {
    id, weight, label, bank: true,
    compute(m) {
      if (!m.lender) return notApplicable("A bank's test.", true);
      if (!m.bank) return notApplicable(m.template === "BANKING" ? BANK_NOT_READ : NBFC_BALANCE);
      return fn(m.bank, m);
    },
  };
}
// Gross and net bad loans, % of loans: Indian private banks run ~1–2% gross,
// under 0.5% net; 5%+ gross was the 2018 stress level
const GNPA_BANDS = [[1, 100], [2, 85], [3, 65], [5, 35], [8, 10], [12, 0]];
const NNPA_BANDS = [[0.3, 100], [0.7, 85], [1.5, 60], [3, 25], [5, 0]];
const PCR_BANDS = [[40, 10], [55, 40], [65, 60], [75, 85], [85, 100]];
// CET1: 8% is the floor with the conservation buffer (5.5% + 2.5%)
const CET1_BANDS = [[8, 0], [9, 25], [11, 55], [13, 80], [15, 100]];
const CREDIT_COST_BANDS = [[0.3, 100], [0.7, 80], [1.2, 55], [2, 25], [3.5, 0]];
const ROA_BANDS = [[0, 0], [0.5, 30], [1, 60], [1.5, 85], [2, 100]];
const COST_INCOME_BANDS = [[35, 100], [45, 80], [55, 55], [65, 30], [80, 0]];

// ── The six groups ─────────────────────────────────────────────────────────
// Weights inside a group sum to 1; group weights sum to 100.

const BUSINESS = {
  id: "business", label: "Business quality", weight: 25,
  items: [
    {
      id: "returns", weight: 0.30,
      label: m => (m.lender || m.utility ? "Return on equity, 5-year median" : "Return on capital (ROCE), 5-year median"),
      compute(m) {
        const useRoe = m.lender || m.utility;
        const name = useRoe ? "ROE" : "ROCE";
        const vals = lastYears(m, 5).map(h => (useRoe ? h.roe : h.roce)).filter(finite);
        // Two years will do: a recent listing's returns are the first thing to know
        if (vals.length < 2) return missing(`Only ${vals.length} year${vals.length === 1 ? "" : "s"} of ${name} on file — 2 are needed.`);
        const v = median(vals);
        const score = band(v, useRoe ? ROE_BANDS : ROCE_BANDS);
        return checked(score, v, pct(v), `${name} has a median of ${pct(v)} over ${vals.length} years — ${word(score)}.`);
      },
    },
    {
      id: "marginStability", weight: 0.20,
      label: m => (m.lender ? "Net margin stability, 5 years" : "Operating margin stability, 5 years"),
      compute(m) {
        const marginOf = h => (m.lender ? (finite(h.profitCr) && h.revenueCr > 0 ? (h.profitCr / h.revenueCr) * 100 : null) : h.opm);
        const vals = lastYears(m, 5).map(marginOf).filter(finite);
        if (vals.length < 3) {
          const qMargin = q => (m.lender ? (finite(q.profitCr) && q.revenueCr > 0 ? (q.profitCr / q.revenueCr) * 100 : null) : q.opm);
          const pairs = sameQuarterPairs(m).map(([q, ago]) => [qMargin(q), qMargin(ago)]).filter(([a, b]) => finite(a) && finite(b));
          if (pairs.length < 3) return missing(`Margins for only ${vals.length} year${vals.length === 1 ? "" : "s"} — 3 are needed.`);
          const level = avg(pairs.map(([a]) => a));
          const moved = avg(pairs.map(([a, b]) => Math.abs(a - b)));
          if (level <= 0) return { ...checked(0, null, `${pct(level)} avg`, `Quarterly margin averaged ${pct(level)} — negative, so its steadiness is no comfort (${RECENT}).`), fromQuarters: true };
          const score = band(moved, [[1, 100], [2.5, 75], [5, 45], [8, 20], [12, 0]]);
          return { ...checked(score, moved, `±${moved.toFixed(1)} pts`, `Quarterly margins moved ${moved.toFixed(1)} points on average from the same quarter a year earlier (${RECENT}) — ${word(score)}.`), fromQuarters: true };
        }
        const mean = avg(vals);
        const range = `${pct(Math.min(...vals))} to ${pct(Math.max(...vals))}`;
        if (mean <= 0) return checked(0, null, range, `Margin averaged ${pct(mean)} — negative, so its steadiness is no comfort.`);
        // Coefficient of variation: the swing relative to the average level
        const cv = sd(vals) / mean;
        const score = band(cv, [[0.05, 100], [0.10, 80], [0.20, 50], [0.35, 20], [0.50, 0]]);
        return checked(score, cv, range, `Margin ranged ${range} over ${vals.length} years, swinging ${pct(cv * 100, 0)} of its average — ${word(score)}.`);
      },
    },
    {
      id: "revenueConsistency", weight: 0.20,
      label: "Years of revenue growth",
      compute(m) {
        const pairs = consecutive(lastYears(m, 6).filter(h => h.revenueCr > 0));
        if (pairs.length < 3) {
          const qs = sameQuarterPairs(m).filter(([q, ago]) => q.revenueCr > 0 && ago.revenueCr > 0);
          if (qs.length < 3) return missing(`Revenue for only ${pairs.length + 1} consecutive years — 4 are needed.`);
          const up = qs.filter(([q, ago]) => q.revenueCr > ago.revenueCr).length;
          return { ...checked((100 * up) / qs.length, up, `${up} of ${qs.length} quarters`, `Sales were above the same quarter a year earlier in ${up} of the last ${qs.length} quarters (${RECENT}).`), fromQuarters: true };
        }
        const up = pairs.filter(([a, b]) => a.revenueCr > b.revenueCr).length;
        return checked((100 * up) / pairs.length, up, `${up} of ${pairs.length}`, `Revenue grew in ${up} of the last ${pairs.length} years.`);
      },
    },
    {
      id: "reinvestment", weight: 0.20,
      label: "Return on new capital (incremental ROCE)",
      compute(m) {
        if (m.lender) return notApplicable("Not meaningful for lenders — their capital is the loan book.");
        // Lease liabilities are itemised only from FY26, so they're left out
        // at both ends — otherwise a renter's FY26 leases would read as new capital
        const ce = h => (h?.equityCr > 0 && finite(h.debtCr) ? h.equityCr + h.debtCr : null);
        const ebit = h => (finite(h?.pbtCr) && finite(h?.financeCostsCr) ? h.pbtCr + h.financeCostsCr : null);
        const now = m.history[0];
        if (ce(now) == null || ebit(now) == null) return missing("Latest balance sheet or profit isn't complete.");
        for (const n of [5, 4, 3]) {
          const then = yearsBack(m, n);
          if (ce(then) == null || ebit(then) == null) continue;
          const dCe = ce(now) - ce(then), dEbit = ebit(now) - ebit(then);
          if (dCe <= 0.15 * ce(then)) return missing(`Capital grew only ${pct((dCe / ce(then)) * 100, 0)} over ${n} years — too little to measure a return on new money.`);
          const inc = clamp((dEbit / dCe) * 100, -50, 150);
          const score = band(inc, ROCE_BANDS);
          return checked(score, inc, pct(inc), `Over ${n} years, ${crore(dCe)} of new capital added ${crore(dEbit)} a year of operating profit — ${pct(inc)} on the new money, ${word(score)}.`);
        }
        return missing("Needs balance sheets at least 3 years apart.");
      },
    },
    {
      id: "competitive", weight: 0.10, label: "Competitive position",
      compute: () => notInFilings("Market share and pricing power aren't in the filings — the annual report covers them."),
    },
    bankItem("roa", 0.12, "Return on assets (banks)", b => {
      if (!finite(b.roaPct)) return missing("Return on assets isn't in the year-end filing.");
      const score = band(b.roaPct, ROA_BANDS);
      return checked(score, b.roaPct, pct(b.roaPct, 2), `Earned ${pct(b.roaPct, 2)} on its assets${inFy(b.fyEnd)} — ${word(score)} for a bank.`);
    }),
    bankItem("costToIncome", 0.08, "Cost-to-income (banks)", b => {
      if (!finite(b.costToIncomePct)) return missing("Operating costs or income aren't in the year-end filing.");
      const score = band(b.costToIncomePct, COST_INCOME_BANDS);
      return checked(score, b.costToIncomePct, pct(b.costToIncomePct, 0), `Operating costs took ${pct(b.costToIncomePct, 0)} of net interest and other income${inFy(b.fyEnd)} — ${word(score)}.`);
    }),
  ],
};

const EARNINGS = {
  id: "earnings", label: "Earnings quality", weight: 20,
  items: [
    {
      id: "cashConversion", weight: 0.25, label: "Operating cash flow ÷ profit",
      compute(m) {
        if (m.lender) return notApplicable("A lender's operating cash flow is loans and deposits moving, not earnings quality.");
        const rows = lastYears(m, 5).filter(h => finite(h.ocfCr) && finite(h.profitCr));
        if (rows.length < 2) return missing(`Cash-flow statements for only ${rows.length} year${rows.length === 1 ? "" : "s"} — 2 are needed.`);
        const p = rows.reduce((s, h) => s + h.profitCr, 0), c = rows.reduce((s, h) => s + h.ocfCr, 0);
        if (p <= 0) return missing("Profits add up to a loss over these years — the ratio isn't meaningful.");
        const ratio = c / p;
        const score = band(ratio, [[0, 0], [0.8, 50], [1, 80], [1.2, 100]]);
        return checked(score, ratio, pct(ratio * 100, 0), `Over ${rows.length} years, operating cash flow was ${pct(ratio * 100, 0)} of profit — ${word(score)}.`);
      },
    },
    {
      id: "accruals", weight: 0.25, label: "Profit not backed by cash (accruals) ÷ assets",
      compute(m) {
        if (m.lender) return notApplicable("Not meaningful for lenders.");
        const rows = lastYears(m, 5);
        const vals = rows.flatMap((h, i) => {
          if (!finite(h.ocfCr) || !finite(h.profitCr) || !(h.totalAssetsCr > 0)) return [];
          const prev = rows[i + 1];
          const assets = prev && yearOf(h) - yearOf(prev) === 1 && prev.totalAssetsCr > 0 ? (h.totalAssetsCr + prev.totalAssetsCr) / 2 : h.totalAssetsCr;
          return [(h.profitCr - h.ocfCr) / assets];
        });
        if (vals.length < 2) return missing(`Cash-flow statements for only ${vals.length} year${vals.length === 1 ? "" : "s"} — 2 are needed.`);
        const v = median(vals);
        const score = band(v, [[0, 100], [0.02, 80], [0.05, 50], [0.10, 20], [0.15, 0]]);
        return checked(score, v, pct(v * 100), v <= 0
          ? `Cash flow ran ahead of profit (median ${pct(v * 100)} of assets a year) — earnings are cash-backed.`
          : `Profit ran ahead of cash by a median ${pct(v * 100)} of assets a year — ${word(score)}.`);
      },
    },
    {
      id: "fcfConversion", weight: 0.20, label: "Free cash flow ÷ profit",
      compute(m) {
        if (m.lender) return notApplicable("Not meaningful for lenders.");
        const rows = lastYears(m, 5).filter(h => finite(h.ocfCr) && finite(h.capexCr) && finite(h.profitCr));
        if (rows.length < 2) return missing(`Cash flow and capital spending for only ${rows.length} year${rows.length === 1 ? "" : "s"} — 2 are needed.`);
        const p = rows.reduce((s, h) => s + h.profitCr, 0), f = rows.reduce((s, h) => s + h.ocfCr - h.capexCr, 0);
        if (p <= 0) return missing("Profits add up to a loss over these years — the ratio isn't meaningful.");
        const ratio = f / p;
        const score = band(ratio, [[-0.5, 0], [0, 30], [0.5, 60], [0.8, 80], [1, 100]]);
        return checked(score, ratio, pct(ratio * 100, 0), `Free cash flow was ${pct(ratio * 100, 0)} of profit over ${rows.length} years — ${word(score)}.${ratio < 0 ? " Heavy investment can explain it; worth seeing what it's buying." : ""}`);
      },
    },
    {
      id: "earningsConsistency", weight: 0.15, label: "EPS held up, last 5 years",
      compute(m) {
        const rows = lastYears(m, 5).filter(h => finite(h.eps));
        const pairs = consecutive(rows);
        if (pairs.length < 2) return missing(`EPS for only ${rows.length} consecutive year${rows.length === 1 ? "" : "s"} — 3 are needed.`);
        const held = pairs.filter(([a, b]) => (b.eps > 0 ? a.eps >= 0.95 * b.eps : a.eps >= b.eps)).length;
        const losses = rows.filter(h => h.eps <= 0).map(h => fy(h.fyEnd));
        // A loss year caps it: earnings that dip below zero aren't consistent
        const score = losses.length ? Math.min((100 * held) / pairs.length, 30) : (100 * held) / pairs.length;
        return checked(score, held, `${held} of ${pairs.length}`, `EPS held up (no fall over 5%) in ${held} of ${pairs.length} years${losses.length ? `, with a loss in ${losses.join(", ")}` : ""}.`);
      },
    },
    {
      id: "epsGrowth5y", weight: 0.15, label: "EPS growth, 5 years (per year)",
      compute(m) {
        if (!finite(m.epsGrowth5y)) return missing("Needs positive EPS at both ends, 5 years apart.");
        const score = band(m.epsGrowth5y, EPS_GROWTH_BANDS);
        return checked(score, m.epsGrowth5y, pct(m.epsGrowth5y), `EPS grew ${pct(m.epsGrowth5y)} a year over 5 years — ${word(score)}.`);
      },
    },
  ],
};

const LENDER_BALANCE = "Capital adequacy and bad-loan ratios — a lender's real balance-sheet tests — aren't in these filings.";
const BALANCE = {
  id: "balance", label: "Balance sheet", weight: 15,
  items: [
    {
      id: "netDebt", weight: 0.25, label: "Net debt ÷ operating profit (EBITDA)",
      compute(m) {
        if (m.lender) return m.bank ? notApplicable(INDUSTRIAL_ONLY, true) : notApplicable(LENDER_BALANCE);
        const h = m.history[0];
        if (!finite(h.liquidCr) || !finite(h.debtCr)) return missing("Cash or debt isn't in the latest balance sheet.");
        const netDebt = h.debtCr + (h.leasesCr ?? 0) - h.liquidCr;
        if (netDebt <= 0) return checked(100, netDebt, `Net cash ${crore(-netDebt)}`, `Net cash: ${crore(h.liquidCr)} of cash and liquid investments against ${crore(h.debtCr + (h.leasesCr ?? 0))} of debt and leases.`);
        if (!(h.operatingProfitCr > 0)) return missing("Debt with no operating profit to cover it — the ratio isn't meaningful (it counts in the risk score instead).");
        const ratio = netDebt / h.operatingProfitCr;
        const score = band(ratio, [[0, 100], [1, 80], [2, 60], [3, 35], [4, 15], [5, 0]]);
        return checked(score, ratio, times(ratio), `Net debt of ${crore(netDebt)} is ${times(ratio)} a year's operating profit — ${word(score)}.`);
      },
    },
    {
      id: "interestCover", weight: 0.20, label: "Interest cover (EBIT ÷ interest)",
      compute(m) {
        if (m.lender) return m.bank ? notApplicable(INDUSTRIAL_ONLY, true) : notApplicable(LENDER_BALANCE);
        const h = m.history[0];
        if (h.financeCostsCr === 0) return checked(100, null, "No interest", "No interest cost in the year.");
        if (!finite(m.interestCoverage)) return missing("Interest or profit isn't in the latest filing.");
        const score = band(m.interestCoverage, [[1, 0], [2, 25], [4, 50], [8, 75], [15, 100]]);
        return checked(score, m.interestCoverage, times(m.interestCoverage), `Operating profit covers interest ${times(m.interestCoverage)} — ${word(score)}.`);
      },
    },
    {
      id: "currentRatio", weight: 0.15, label: "Liquidity (current ratio)",
      compute(m) {
        if (m.lender) return m.bank ? notApplicable(INDUSTRIAL_ONLY, true) : notApplicable(LENDER_BALANCE);
        if (!finite(m.currentRatio)) return missing("Current assets or liabilities aren't in the latest filing.");
        const score = band(m.currentRatio, [[0.8, 0], [1, 40], [1.25, 60], [1.5, 80], [2, 100]]);
        return checked(score, m.currentRatio, times(m.currentRatio), `Current assets are ${times(m.currentRatio)} current liabilities — ${word(score)}.`);
      },
    },
    {
      id: "workingCapital", weight: 0.20, label: "Working capital ÷ sales",
      compute(m) {
        if (m.lender) return m.bank ? notApplicable(INDUSTRIAL_ONLY, true) : notApplicable(LENDER_BALANCE);
        const h = m.history[0];
        if (!finite(h.currentAssetsCr) || !finite(h.currentLiabilitiesCr) || !finite(h.liquidCr) || !(h.revenueCr > 0)) return missing("Current assets, liabilities or cash aren't in the latest filing.");
        // Operating working capital: cash and short-term borrowings are
        // financing, not operations
        const shortDebt = finite(h.debtCr) && finite(h.ltDebtCr) ? Math.max(0, h.debtCr - h.ltDebtCr) : 0;
        const ratio = (h.currentAssetsCr - h.liquidCr - (h.currentLiabilitiesCr - shortDebt)) / h.revenueCr;
        const score = band(ratio, [[0, 100], [0.10, 80], [0.25, 50], [0.40, 25], [0.60, 0]]);
        return checked(score, ratio, pct(ratio * 100, 0), ratio <= 0
          ? "Operating working capital is negative — suppliers and customers fund the business."
          : `Operating working capital ties up ${pct(ratio * 100, 0)} of a year's sales — ${word(score)}.`);
      },
    },
    {
      id: "debtToEquity", weight: 0.20, label: "Debt ÷ equity (with leases)",
      compute(m) {
        if (m.lender) return m.bank ? notApplicable(INDUSTRIAL_ONLY, true) : notApplicable(LENDER_BALANCE);
        const h = m.history[0];
        if (finite(h.equityCr) && h.equityCr <= 0) return checked(0, null, "Negative equity", "Equity is negative — losses have used up the shareholders' capital.");
        if (!finite(m.debtToEquity)) return missing("Debt or equity isn't in the latest balance sheet.");
        const score = band(m.debtToEquity, m.utility ? D_E_BANDS_UTILITY : D_E_BANDS);
        return checked(score, m.debtToEquity, times(m.debtToEquity), `Debt is ${times(m.debtToEquity)} equity${m.leasesCr > 0 ? `, ${crore(m.leasesCr)} of it lease liabilities` : ""}${m.utility ? " (a utility's higher bar)" : ""} — ${word(score)}.`);
      },
    },
    bankItem("grossNpa", 0.25, "Gross bad loans (gross NPA)", b => {
      if (!finite(b.gnpaPct)) return missing("Gross NPA isn't in the latest standalone filing.");
      const score = band(b.gnpaPct, GNPA_BANDS);
      return checked(score, b.gnpaPct, pct(b.gnpaPct, 2), `Gross bad loans are ${pct(b.gnpaPct, 2)} of loans${asAt(b.asOf)} — ${word(score)}.`);
    }),
    bankItem("netNpa", 0.20, "Net bad loans (net NPA)", b => {
      if (!finite(b.nnpaPct)) return missing("Net NPA isn't in the latest standalone filing.");
      const score = band(b.nnpaPct, NNPA_BANDS);
      return checked(score, b.nnpaPct, pct(b.nnpaPct, 2), `After provisions, ${pct(b.nnpaPct, 2)} of loans are bad${asAt(b.asOf)} — ${word(score)}.`);
    }),
    bankItem("provisionCover", 0.15, "Provision cover on bad loans", b => {
      if (!finite(b.pcrPct)) return missing("Gross and net NPA amounts aren't both in the latest filing.");
      const score = band(b.pcrPct, PCR_BANDS);
      return checked(score, b.pcrPct, pct(b.pcrPct, 0), `Provisions cover ${pct(b.pcrPct, 0)} of its bad loans${asAt(b.asOf)} (before technical write-offs) — ${word(score)}.`);
    }),
    bankItem("cet1", 0.25, "Capital (CET1 ratio)", b => {
      if (!finite(b.cet1Pct)) return missing("The CET1 ratio isn't in the latest standalone filing.");
      const score = band(b.cet1Pct, CET1_BANDS);
      return checked(score, b.cet1Pct, pct(b.cet1Pct, 2), `Core equity capital is ${pct(b.cet1Pct, 2)} of risk-weighted assets${asAt(b.asOf)}, against an 8% floor with buffer — ${word(score)}.`);
    }),
    bankItem("creditCost", 0.15, "Credit cost (provisions ÷ average loans)", b => {
      if (!finite(b.creditCostPct)) return missing("Provisions or two year-ends of loans aren't in the filings.");
      const score = band(b.creditCostPct, CREDIT_COST_BANDS);
      return checked(score, b.creditCostPct, pct(b.creditCostPct, 2), `Provisions were ${pct(b.creditCostPct, 2)} of the average loan book${inFy(b.fyEnd)} — ${word(score)}.`);
    }),
  ],
};

const GOVERNANCE = {
  id: "governance", label: "Management & governance", weight: 15,
  items: [
    {
      id: "promoterStability", weight: 0.10, label: "Promoter holding, change over 3 years",
      compute(m) {
        const hist = m.promoterHistory ?? [];
        if (hist.length && hist.every(h => h.pct === 0)) return notApplicable("No promoter group — the company is widely held.");
        if (hist.length < 8) return missing("Under 2 years of shareholding filings on file.");
        const latest = hist[0];
        // The filing nearest 3 years back, else the oldest held (2 years at least)
        const target = new Date(`${latest.asOfIso}T00:00:00Z`);
        target.setUTCFullYear(target.getUTCFullYear() - 3);
        const then = hist.reduce((best, h) => (Math.abs(new Date(`${h.asOfIso}T00:00:00Z`) - target) < Math.abs(new Date(`${best.asOfIso}T00:00:00Z`) - target) ? h : best));
        const delta = latest.pct - then.pct;
        const since = new Date(`${then.asOfIso}T00:00:00Z`).toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
        const score = band(delta, [[-20, 0], [-12, 20], [-7, 45], [-3, 75], [-1, 100]]);
        return checked(score, delta, `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts`, delta >= -1
          ? `Promoters hold ${pct(latest.pct)}, ${delta >= 0.05 ? `up from ${pct(then.pct)}` : "about the same as"} in ${since}.`
          : `Promoters cut their holding from ${pct(then.pct)} to ${pct(latest.pct)} since ${since} — ${word(score)}.`);
      },
    },
    {
      id: "pledge", weight: 0.20, label: "Promoter shares pledged",
      compute(m) {
        if (m.promoterPct === 0) return checked(100, 0, "No promoter group", "No promoter group, so no promoter shares can be pledged.");
        if (!finite(m.pledgedPct)) return missing("Pledge isn't in the latest shareholding filing.");
        const score = band(m.pledgedPct, [[0, 100], [5, 70], [15, 40], [25, 15], [40, 0]]);
        return checked(score, m.pledgedPct, pct(m.pledgedPct), m.pledgedPct === 0
          ? "No promoter shares pledged — no forced-selling risk."
          : `${pct(m.pledgedPct)} of the promoters' shares are pledged; lenders can sell them in a fall — ${word(score)}.`);
      },
    },
    {
      id: "dilution", weight: 0.15, label: "Share count growth (per year)",
      compute(m) {
        const now = m.history[0];
        if (!(now.sharesCr > 0)) return missing("Share count isn't in the latest filing.");
        // 2 years at the least — a young listing's IPO or fund-raise is
        // exactly the dilution this is for
        for (const n of [5, 4, 3, 2]) {
          const then = yearsBack(m, n);
          if (!(then?.sharesCr > 0)) continue;
          const g = (Math.pow(now.sharesCr / then.sharesCr, 1 / n) - 1) * 100;
          const score = band(g, [[0, 100], [1, 80], [3, 50], [5, 25], [10, 0]]);
          return checked(score, g, pct(g), g < -0.2 ? `Share count fell ${pct(-g)} a year over ${n} years — buybacks.`
            : g <= 0.2 ? `Share count barely changed over ${n} years.`
              : `Shares grew ${pct(g)} a year over ${n} years — new shares for stock options, fund-raising or mergers dilute existing holders.`);
        }
        return missing("Needs share counts at least 2 years apart.");
      },
    },
    { id: "relatedParty", weight: 0.15, label: "Related-party transactions", compute: () => notInFilings("Deals with promoter-group companies are in the annual report and separate NSE filings — not checked yet.") },
    {
      id: "auditor", weight: 0.25, label: "Audit opinion and auditor resignations, 3 years",
      compute(m) {
        // Each annual filing states the auditor's opinion (fetch-nse.js);
        // resignations come from NSE's announcements (market-data.js)
        const rows = lastYears(m, 3).filter(h => h.auditOpinion);
        if (!rows.length) return missing("The filings on file don't state the audit opinion.");
        const qualified = rows.filter(h => h.auditOpinion === "qualified").map(h => fy(h.fyEnd));
        const latest = m.history[0];
        const firm = m.history.find(h => h.auditor)?.auditor;
        const resigned = m.auditorResignations?.[0] ?? null;
        const resignedText = resigned ? ` The statutory auditor resigned on ${dayText(resigned)}.` : "";
        if (latest.auditOpinion === "qualified") {
          return checked(0, "qualified", "Qualified", `The auditor qualified ${fy(latest.fyEnd)}'s ${scopeWord(m)}accounts — the company filed a statement on the impact of audit qualifications with its results.${resignedText}`);
        }
        // A resignation mid-term can mean a disagreement — or a routine change
        // of firm; the reasons are in the company's disclosure. Half marks.
        if (qualified.length || resigned) {
          return checked(qualified.length && resigned ? 25 : 50, qualified.length ? "earlier" : "resigned", qualified.length ? `${qualified.join(", ")} qualified` : "Auditor resigned",
            `${qualified.length ? `Clean opinion on the latest accounts, but the auditor qualified ${qualified.join(" and ")}.` : "Clean audit opinions, but the auditor didn't serve out the term."}${resignedText}`);
        }
        const resignationsKnown = m.auditorResignations != null;
        return checked(100, "unmodified", "Clean", `Unmodified (clean) audit opinion in each of the last ${rows.length} year${rows.length > 1 ? "s" : ""}${resignationsKnown ? " and no auditor resignation" : ""}${firm ? ` — auditor ${firm}` : ""}.`);
      },
    },
    { id: "governanceFlags", weight: 0.15, label: "Governance disclosures", compute: () => notInFilings("Board independence and governance reports — not checked yet.") },
  ],
};

const GROWTH = {
  id: "growth", label: "Growth", weight: 10,
  items: [
    {
      id: "salesGrowth3y", weight: 0.30, label: "Sales growth, 3 years (per year)",
      compute(m) {
        if (!finite(m.salesGrowth3y)) {
          if (!finite(m.ttmSalesGrowth)) return missing("Needs sales 3 years apart.");
          const score = band(m.ttmSalesGrowth, GROWTH_BANDS);
          return { ...checked(score, m.ttmSalesGrowth, pct(m.ttmSalesGrowth), `Sales grew ${pct(m.ttmSalesGrowth)} over the last twelve months against the twelve before (${RECENT}) — ${word(score)}.`), fromQuarters: true };
        }
        const score = band(m.salesGrowth3y, GROWTH_BANDS);
        return checked(score, m.salesGrowth3y, pct(m.salesGrowth3y), `Sales grew ${pct(m.salesGrowth3y)} a year over 3 years — ${word(score)}.`);
      },
    },
    {
      id: "salesGrowth5y", weight: 0.30, label: "Sales growth, 5 years (per year)",
      compute(m) {
        if (!finite(m.salesGrowth5y)) return missing("Needs sales 5 years apart.");
        const score = band(m.salesGrowth5y, GROWTH_BANDS);
        return checked(score, m.salesGrowth5y, pct(m.salesGrowth5y), `Sales grew ${pct(m.salesGrowth5y)} a year over 5 years — ${word(score)}.`);
      },
    },
    {
      id: "epsGrowth3y", weight: 0.10, label: "EPS growth, 3 years (per year)",
      compute(m) {
        if (!finite(m.epsGrowth3y)) {
          if (!finite(m.ttmEpsGrowth)) return missing("Needs positive EPS at both ends, 3 years apart.");
          const score = band(m.ttmEpsGrowth, EPS_GROWTH_BANDS);
          return { ...checked(score, m.ttmEpsGrowth, pct(m.ttmEpsGrowth), `EPS grew ${pct(m.ttmEpsGrowth)} over the last twelve months against the twelve before (${RECENT}) — ${word(score)}.`), fromQuarters: true };
        }
        const score = band(m.epsGrowth3y, EPS_GROWTH_BANDS);
        return checked(score, m.epsGrowth3y, pct(m.epsGrowth3y), `EPS grew ${pct(m.epsGrowth3y)} a year over 3 years — ${word(score)}.`);
      },
    },
    { id: "forwardGrowth", weight: 0.15, label: "Forward growth", compute: () => notInFilings("No forecasts — the app uses reported results only.") },
    { id: "marketSize", weight: 0.15, label: "Market size and capacity", compute: () => notInFilings("Market size and expansion plans are in the annual report, not the filings.") },
  ],
};

// Valued at NSE's last close. P/E on the usual EPS when one year's profit
// jumped on a one-off (metrics.js valuationEps), as the fair value is.
const closePe = m => (m.close > 0 && m.valuationEps > 0 ? m.close / m.valuationEps : null);
const closeMcapCr = m => (m.close > 0 && m.shares > 0 ? (m.close * m.shares) / 1e7 : null);
const VALUATION = {
  id: "valuation", label: "Valuation", weight: 15,
  items: [
    { id: "dcf", weight: 0.30, label: "Cash-flow (DCF) value", compute: () => notInFilings("An editable five-year cash-flow scenario is available on the stock page, but its assumptions are user inputs and it is not included in the research score.") },
    {
      id: "peers", weight: 0.25, label: "P/E against comparable peers",
      compute(m, ctx) {
        // The company's sector first (the same cohort the Peers panel shows);
        // NSE's older industry label only when the sector is unknown or has
        // too few P/Es — and never a catch-all like "Miscellaneous"
        const peers = ctx.peers ?? PEERS;
        // NSE's sector only — a sector read from the company's name is for
        // finding companies, not for pricing them against peers
        const sector = m.peerSector !== undefined ? m.peerSector : m.sector;
        const bySector = sector ? (peers instanceof Map ? peers.get(sector) ?? peers.get(`sector:${sector}`) : peers.sectors?.get(sector)) : null;
        const byIndustry = isPeerIndustry(m.industry) ? (peers instanceof Map ? peers.get(`industry:${m.industry}`) : peers.industries?.get(m.industry)) : null;
        const [cohort, s] = bySector?.n >= 5 ? [sector, bySector] : byIndustry?.n >= 5 ? [`NSE industry ${m.industry}`, byIndustry] : [sector, bySector];
        if (!cohort) return missing("Sector isn't known for this company — it's needed to compare with peers.");
        if (!s || s.n < 5) return missing(`Fewer than 5 ${cohort} companies with a P/E to compare.`);
        const pe = closePe(m);
        if (pe == null) return missing("Loss-making — no P/E to compare.");
        const ratio = pe / s.median;
        const score = band(ratio, [[0.6, 100], [0.8, 75], [1, 50], [1.25, 25], [1.6, 0]]);
        return checked(score, ratio, `${pe.toFixed(1)} vs ${s.median.toFixed(1)}`, `P/E of ${pe.toFixed(1)} against a median of ${s.median.toFixed(1)} for ${s.n} ${cohort} companies — ${ratio < 0.95 ? "cheaper than" : ratio > 1.05 ? "dearer than" : "in line with"} peers.`);
      },
    },
    {
      id: "ownHistory", weight: 0.20, label: "Price against its own usual P/E",
      compute(m) {
        if (!finite(m.medianPe) || !(m.valuationEps > 0) || !(m.close > 0)) return missing("Needs 3 years of P/E history and a profit.");
        const fv = m.valuationEps * m.medianPe;
        const mos = ((fv - m.close) / fv) * 100;
        const score = band(mos, [[-30, 0], [-10, 25], [0, 50], [20, 75], [40, 100]]);
        return checked(score, mos, mos >= 0 ? `${pct(mos, 0)} below` : `${pct(-mos, 0)} above`, `${rupees(m.close)} is ${mos >= 0 ? `${pct(mos, 0)} below` : `${pct(-mos, 0)} above`} today's fair value of ${rupees(fv)} (EPS × its usual P/E of ${m.medianPe.toFixed(1)}).`);
      },
    },
    {
      id: "fcfYield", weight: 0.15, label: "Free cash flow yield",
      compute(m) {
        if (m.lender) return notApplicable("Not meaningful for lenders.");
        const rows = lastYears(m, 3).filter(h => finite(h.ocfCr) && finite(h.capexCr));
        const mcap = closeMcapCr(m);
        if (rows.length < 2 || mcap == null) return missing("Needs 2 years of cash flow and capital spending.");
        const fcfs = rows.map(h => h.ocfCr - h.capexCr);
        const y = (avg(fcfs) / mcap) * 100;
        const negative = fcfs.some(v => v < 0);
        // Volatile or negative free cash flow isn't a yield to lean on
        const score = negative ? Math.min(band(y, [[0, 0], [2, 40], [4, 65], [6, 85], [8, 100]]), 50) : band(y, [[0, 0], [2, 40], [4, 65], [6, 85], [8, 100]]);
        return checked(score, y, pct(y), `Free cash flow averaged ${pct(y)} of the market value over ${rows.length} years${negative ? ", with a negative year" : ""}.`);
      },
    },
    {
      id: "multiples", weight: 0.10,
      label: m => (m.lender ? "P/E and price-to-book check" : "P/E and EV/EBITDA check"),
      compute(m) {
        const parts = [], shown = [];
        const pe = closePe(m);
        if (pe != null) { parts.push(band(pe, [[10, 100], [15, 80], [20, 60], [30, 35], [45, 15], [60, 0]])); shown.push(`P/E ${pe.toFixed(1)}`); }
        const mcap = closeMcapCr(m);
        const h = m.history[0];
        if (m.lender) {
          const pb = mcap != null && h.equityCr > 0 ? mcap / h.equityCr : null;
          if (pb != null) { parts.push(band(pb, [[1, 100], [1.5, 75], [2.5, 50], [4, 25], [6, 0]])); shown.push(`P/B ${pb.toFixed(1)}`); }
        } else if (mcap != null && finite(h.debtCr) && finite(h.liquidCr) && h.operatingProfitCr > 0) {
          const ev = mcap + h.debtCr + (h.leasesCr ?? 0) - h.liquidCr;
          const multiple = ev / h.operatingProfitCr;
          parts.push(band(multiple, [[6, 100], [10, 75], [15, 50], [22, 25], [30, 0]]));
          shown.push(`EV/EBITDA ${multiple.toFixed(1)}`);
        }
        if (!parts.length) return missing("Loss-making with no operating profit — no multiple to check.");
        const score = avg(parts);
        return checked(score, null, shown.join(" · "), `${shown.join(" and ")} — ${score >= 60 ? "undemanding" : score >= 40 ? "middling" : "demanding"} on simple multiples.`);
      },
    },
  ],
};

export const GROUPS = [BUSINESS, EARNINGS, BALANCE, GOVERNANCE, GROWTH, VALUATION];

// ── Technical setup (never in the quality or overall score) ───────────────

function technical(m) {
  const parts = [];
  const add = (id, label, weight, score, display, reason) => { if (finite(score)) parts.push({ id, label, weight, score: clamp(score, 0, 100), display, reason }); };

  const t200 = band(m.vsSma200, [[-20, 0], [-10, 20], [0, 50], [10, 80], [20, 100]]);
  const t50 = band(m.vsSma50, [[-10, 0], [-5, 25], [0, 50], [5, 75], [10, 100]]);
  // 50-day average over the 200-day: (price/200d) ÷ (price/50d)
  const cross = finite(m.vsSma200) && finite(m.vsSma50) ? ((1 + m.vsSma200 / 100) / (1 + m.vsSma50 / 100) - 1) * 100 : null;
  const tCross = band(cross, [[-10, 0], [0, 50], [10, 100]]);
  const trendParts = [[t200, 0.5], [t50, 0.25], [tCross, 0.25]].filter(([s]) => finite(s));
  if (trendParts.length) {
    const s = trendParts.reduce((a, [v, w]) => a + v * w, 0) / trendParts.reduce((a, [, w]) => a + w, 0);
    add("trend", "Trend", 35, s,
      [finite(m.vsSma200) && `${m.vsSma200 >= 0 ? "+" : ""}${m.vsSma200.toFixed(1)}% vs 200-day`, finite(m.vsSma50) && `${m.vsSma50 >= 0 ? "+" : ""}${m.vsSma50.toFixed(1)}% vs 50-day`].filter(Boolean).join(" · "),
      finite(m.vsSma200) ? `Price is ${m.vsSma200 >= 0 ? "above" : "below"} its 200-day average${finite(cross) ? `, and the 50-day average is ${cross >= 0 ? "above" : "below"} the 200-day` : ""}.` : "Under 200 days of prices — trend read from the 50-day average.");
  }
  const rs = [m.ret6mVsNifty, m.ret1yVsNifty].filter(finite);
  if (rs.length) {
    const s = avg(rs.map(v => band(v, [[-30, 0], [-15, 25], [0, 50], [15, 75], [30, 100]])));
    add("relativeStrength", "Relative strength vs NIFTY 50", 25, s,
      [finite(m.ret6mVsNifty) && `6M ${m.ret6mVsNifty >= 0 ? "+" : ""}${m.ret6mVsNifty.toFixed(1)} pts`, finite(m.ret1yVsNifty) && `1Y ${m.ret1yVsNifty >= 0 ? "+" : ""}${m.ret1yVsNifty.toFixed(1)} pts`].filter(Boolean).join(" · "),
      `${avg(rs) >= 0 ? "Ahead of" : "Behind"} NIFTY 50 over ${rs.length === 2 ? "6 and 12 months" : finite(m.ret6mVsNifty) ? "6 months" : "12 months"}.`);
  }
  // RSI scored for momentum without rewarding an overbought extreme
  add("momentum", "Momentum (RSI 14)", 20, band(m.rsi14, [[25, 15], [40, 40], [55, 75], [65, 85], [75, 70], [85, 50]]),
    finite(m.rsi14) ? `RSI ${m.rsi14.toFixed(0)}` : null,
    finite(m.rsi14) ? (m.rsi14 > 70 ? "Strong recent buying — stretched (over 70)." : m.rsi14 < 30 ? "Heavy recent selling (under 30)." : `Recent momentum ${m.rsi14 >= 50 ? "positive" : "soft"}.`) : null);
  const turnoverCr = finite(m.avgVolume3m) && m.close > 0 ? (m.avgVolume3m * m.close) / 1e7 : null;
  const turnover = turnoverCr >= 1 ? crore(turnoverCr) : `₹${Math.max(r1(turnoverCr ?? 0), 0.1)} Cr`;
  add("liquidity", "Trading liquidity", 10, turnoverCr > 0 ? band(Math.log10(turnoverCr), [[-1, 0], [0, 40], [1, 75], [1.7, 100]]) : null,
    turnoverCr > 0 ? `${turnover}/day` : null,
    turnoverCr > 0 ? `About ${turnover} traded a day over 3 months.` : null);
  const vol = band(m.volatility1y, [[20, 100], [30, 75], [45, 40], [70, 0]]);
  const dd = band(m.maxLoss1y, [[10, 100], [20, 70], [35, 35], [50, 0]]);
  const vd = [vol, dd].filter(finite);
  add("volatility", "Volatility and drawdown", 10, vd.length ? avg(vd) : null,
    [finite(m.volatility1y) && `${m.volatility1y.toFixed(0)}% volatility`, finite(m.maxLoss1y) && `−${m.maxLoss1y.toFixed(0)}% worst fall`].filter(Boolean).join(" · "),
    finite(m.maxLoss1y) ? `Biggest fall in the past year: ${m.maxLoss1y.toFixed(0)}% from a high.` : null);

  const weight = parts.reduce((a, p) => a + p.weight, 0);
  // Under 60% of the weight (a recent listing) is too thin to call a trend
  const score = weight >= 60 ? parts.reduce((a, p) => a + p.score * p.weight, 0) / weight : null;
  return {
    score: score == null ? null : r1(score),
    label: score == null ? "Not enough price history" : score >= 65 ? "Constructive" : score >= 40 ? "Mixed" : "Weak",
    parts: parts.map(p => ({ ...p, score: r1(p.score) })),
    asOf: m.closeDate ?? null,
  };
}

// ── Assembly ───────────────────────────────────────────────────────────────

// Sector P/E medians for the peer comparison, set by screen.js from the
// whole market each time it recomputes — one company alone can't know them
let PEERS = { sectors: new Map(), industries: new Map() };
// NSE industry labels that name no real peer group
const CATCH_ALL_INDUSTRIES = /^(miscellaneous|diversified|others?)$/i;
export const isPeerIndustry = industry => !!industry && !CATCH_ALL_INDUSTRIES.test(industry);
export const setResearchPeers = peers => { PEERS = peers; };

// A group counts once at least this share of its applicable weight is
// checked; the quality score once its scored groups carry this share of the
// applicable group weight. Looser than the proposal's 70%: NSE's filings reach
// back only ~5 years, so one missing 5-year figure would leave HDFC Bank,
// ICICI Bank or Nestle unrated, and hide a qualified audit behind "Not rated".
const MIN_GROUP_COVERAGE = 0.35;
const MIN_SCORE_COVERAGE = 0.6;
const CAPPED_AT = 69;
// The overall score's ceiling while a critical red flag is unresolved
const FLAG_CEILING = 39;

function scoreGroup(group, m, ctx) {
  const items = group.items.map(it => {
    const label = typeof it.label === "function" ? it.label(m) : it.label;
    const res = it.compute(m, ctx);
    return { id: it.id, label, weight: it.weight, ...res, score: finite(res.score) ? r1(res.score) : null };
  });
  const applicable = items.filter(i => !i.na);
  const done = applicable.filter(i => i.score != null);
  const applicableWeight = applicable.reduce((a, i) => a + i.weight, 0);
  const doneWeight = done.reduce((a, i) => a + i.weight, 0);
  const coverage = applicableWeight > 0 ? doneWeight / applicableWeight : 0;
  const score = applicable.length && coverage >= MIN_GROUP_COVERAGE ? done.reduce((a, i) => a + i.score * i.weight, 0) / doneWeight : null;
  return {
    id: group.id, label: group.label, weight: group.weight,
    applicable: applicable.length > 0,
    score: score == null ? null : r1(score),
    points: score == null ? null : r1((score * group.weight) / 100),
    checked: done.length, total: applicable.length, coverage,
    items,
  };
}

// Weighted average of the scored groups among `ids`, once they carry enough
// of those groups' applicable weight
function combine(groups, ids) {
  const pool = groups.filter(g => ids.includes(g.id) && g.applicable);
  const scored = pool.filter(g => g.score != null);
  const poolWeight = pool.reduce((a, g) => a + g.weight, 0);
  const scoredWeight = scored.reduce((a, g) => a + g.weight, 0);
  if (!poolWeight || scoredWeight / poolWeight < MIN_SCORE_COVERAGE) return null;
  return scored.reduce((a, g) => a + g.score * g.weight, 0) / scoredWeight;
}

const QUALITY_IDS = ["business", "earnings", "balance", "governance", "growth"];
const BANDS_ORS = [
  [80, "Strong", "Research evidence is comparatively strong"],
  [65, "Constructive", "Constructive, with material questions"],
  [50, "Mixed", "Mixed evidence; further work needed"],
  [35, "Challenged", "Evidence is challenged"],
  [0, "Weak", "Significant unresolved concerns"],
];
const valuationLabel = v => (v >= 75 ? "Inexpensive" : v >= 60 ? "Reasonable" : v >= 45 ? "Fair" : v >= 30 ? "Moderately expensive" : "Expensive");
const riskLabel = r => (r >= 75 ? "High" : r >= 50 ? "Elevated" : r >= 25 ? "Moderate" : "Low");

function riskProfile(m, groups, tech, confidence) {
  const g = id => groups.find(x => x.id === id);
  const item = (gid, iid) => g(gid).items.find(i => i.id === iid);
  const inv = s => (finite(s) ? 100 - s : null);
  const parts = [];
  const add = (id, label, weight, score, reason) => { if (finite(score)) parts.push({ id, label, weight, score: r1(clamp(score, 0, 100)), reason }); };

  // Financial distress: the balance-sheet group, and debt without profit
  const bal = g("balance");
  const h = m.history[0];
  const distressed = finite(h.debtCr) && h.debtCr > 0 && !(h.operatingProfitCr > 0) && !m.lender;
  if (bal.applicable && (bal.score != null || distressed)) {
    add("financial", "Financial distress", 25, Math.max(inv(bal.score) ?? 0, distressed ? 80 : 0),
      distressed ? "Debt with no operating profit to service it." : `Balance sheet scores ${Math.round(bal.score)}/100${finite(m.debtToEquity) ? `; debt ${times(m.debtToEquity)} equity` : ""}.`);
  }
  // Business: margin swings, cyclicality and loss years
  const ms = item("business", "marginStability");
  const lossYears = lastYears(m, 5).filter(x => finite(x.profitCr) && x.profitCr <= 0).length;
  const why = [m.cyclical && "a cyclical business", lossYears > 0 && `${lossYears} loss year${lossYears > 1 ? "s" : ""} in 5`, finite(ms.score) && `margins ${ms.score >= 75 ? "steady" : "swing"} (${ms.display})`].filter(Boolean);
  add("business", "Business and cyclicality", 20, (inv(ms.score) ?? 50) + (m.cyclical ? 25 : 0) + 15 * lossYears,
    why.length ? `${why.join(", ").replace(/^./, c => c.toUpperCase())}.` : "Margin history too short to judge.");
  // Governance: pledging, dilution, promoter selling — and what's unchecked
  const gov = ["pledge", "dilution", "promoterStability", "auditor"].map(id => item("governance", id)).filter(i => i.score != null);
  add("governance", "Governance and accounting", 20, gov.length ? avg(gov.map(i => 100 - i.score)) : 50,
    gov.length ? `${gov.map(i => `${i.label.toLowerCase()}: ${i.display}`).join("; ")}. Related-party deals not checked.` : "Shareholding and audit data missing; related-party deals not checked.");
  // Market: price swings, falls and how easily it trades
  const tp = id => tech.parts.find(p => p.id === id);
  const mk = [tp("volatility"), tp("liquidity")].filter(Boolean);
  add("market", "Price swings and liquidity", 15, mk.length ? avg(mk.map(p => 100 - p.score)) + (m.beta1y > 1.3 ? 10 : 0) : null,
    mk.map(p => p.display).filter(Boolean).join(" · ") + (m.beta1y > 1.3 ? ` · beta ${m.beta1y.toFixed(2)}` : ""));
  const val = g("valuation");
  add("valuationDownside", "Valuation downside", 10, inv(val.score) ?? 50, val.score != null ? `Valuation scores ${Math.round(val.score)}/100 — ${valuationLabel(val.score).toLowerCase()}.` : "Valuation couldn't be scored.");
  add("data", "Data gaps", 10, 100 - confidence, `Data quality ${Math.round(confidence)}/100 — several checks need annual reports.`);

  const weight = parts.reduce((a, p) => a + p.weight, 0);
  const score = parts.reduce((a, p) => a + p.score * p.weight, 0) / weight;
  // The overall score's overlay: only what the quality score doesn't hold
  const overlayParts = parts.filter(p => p.id === "market" || p.id === "data");
  const overlay = overlayParts.length ? overlayParts.reduce((a, p) => a + p.score * p.weight, 0) / overlayParts.reduce((a, p) => a + p.weight, 0) : 50;
  return {
    score: r1(score), label: riskLabel(score), overlay: r1(overlay),
    parts,
    top: [...parts].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 3).map(p => p.id),
  };
}

export function computeResearch(m, ctx = { peers: PEERS }) {
  if (!m?.history?.length) return null;
  const groups = GROUPS.map(g => scoreGroup(g, m, ctx));
  // No quality score unless the business groups carry it on their own — a
  // young listing's balance sheet and price alone would pass for "quality"
  const rawQualityOnly = combine(groups, QUALITY_IDS);
  const rawQuality = rawQualityOnly == null ? null : combine(groups, [...QUALITY_IDS, "valuation"]);
  // The proposal's coverage cap: when the balance sheet or governance can't be
  // checked, quality stops at 69 with a warning. Lenders always — their real
  // tests, bad loans and capital adequacy, aren't in the filings — which keeps
  // a bank scored on the easy groups from outranking a fully checked company
  // (Power Finance at 96, above Infosys, before this).
  const balance = groups.find(g => g.id === "balance"), governance = groups.find(g => g.id === "governance");
  // A bank with its bad-loan and capital tests read is checked like anyone
  // else; NBFCs' filings don't carry those ratios, so they stay capped
  const bankChecked = m.lender && !!m.bank && balance.score != null;
  const capReason = m.lender && !bankChecked
    ? (m.bank ? "The bank's bad-loan and capital figures couldn't be read from its filings, so quality is capped at 69."
      : m.template === "BANKING" ? "The bank's bad-loan and capital figures aren't on file yet, so quality is capped at 69."
        : "NBFC filings don't carry bad-loan and capital ratios, a lender's key tests, so quality is capped at 69.")
    : balance.score == null ? "The balance sheet couldn't be checked from the filings, so quality is capped at 69."
      : governance.score == null ? "Shareholding data is missing, so governance couldn't be checked and quality is capped at 69." : null;
  const cap = v => (v == null || !capReason ? v : Math.min(v, CAPPED_AT));
  const qualityOnly = cap(rawQualityOnly), quality = cap(rawQuality);

  // Coverage: share of the applicable weight actually checked, groups weighted
  const appGroups = groups.filter(g => g.applicable);
  const coverage = appGroups.reduce((a, g) => a + g.weight * g.coverage, 0) / appGroups.reduce((a, g) => a + g.weight, 0);
  // Confidence, after the proposal's formula — its "cross-source agreement"
  // term (there's one source here) is replaced by how fresh the price is
  const monthsOld = (Date.parse(m.closeDate ?? m.fyEnd) - Date.parse(m.fyEnd)) / (30.44 * 86400000);
  const recency = band(monthsOld, [[15, 100], [27, 50], [39, 0]]) ?? 50;
  const source = /consolidated/i.test(m.scope ?? "") ? 100 : 85;
  const priceAge = m.closeDate ? ((ctx.now ?? Date.now()) - Date.parse(m.closeDate)) / 86400000 : null;
  const freshness = band(priceAge, [[5, 100], [30, 0]]) ?? 0;
  const confidence = r1(0.4 * coverage * 100 + 0.25 * source + 0.2 * recency + 0.15 * freshness);

  const tech = technical(m);
  const risk = riskProfile(m, groups, tech, confidence);
  const valuation = groups.find(g => g.id === "valuation");

  // Red flags: shown on the page and an override on the overall score, as
  // the proposal sets for critical accounting events (its default ceiling of
  // 39, "Review required") — on top of the audit check's own 0 in governance
  const flags = [];
  const latestYear = m.history[0];
  if (latestYear.auditOpinion === "qualified") {
    flags.push({
      id: "auditQualified", severity: "critical",
      text: `The auditor qualified ${fy(latestYear.fyEnd)}'s ${scopeWord(m)}accounts. Read the company's statement on the impact of audit qualifications, filed with its results, before relying on any figure here.`,
    });
  }
  if (m.auditorResignations?.length) {
    flags.push({
      id: "auditorResigned", severity: "caution",
      text: `The statutory auditor resigned on ${dayText(m.auditorResignations[0])}${m.auditorResignations.length > 1 ? ` (and ${m.auditorResignations.length - 1} more time${m.auditorResignations.length > 2 ? "s" : ""} in three years)` : ""}. Companies must publish the auditor's reasons — worth reading before relying on the accounts.`,
    });
  }
  const critical = flags.some(f => f.severity === "critical");

  // Overall research score: quality without valuation (70%) and valuation
  // (30%) blended geometrically, so a weak side can't be fully made up by the
  // other; then trimmed by price-swing and data-gap risk
  let ors = null, status;
  if (quality == null || qualityOnly == null) status = "not-rated";
  else if (valuation.score == null) status = "quality-only";
  else {
    const g = Math.exp(0.7 * Math.log(Math.max(qualityOnly, 1)) + 0.3 * Math.log(Math.max(valuation.score, 1)));
    ors = g * (1 - 0.35 * (risk.overlay / 100));
    status = "rated";
    if (confidence < 50) { ors = Math.min(ors, 59); status = "provisional"; }
  }
  if (critical && status !== "not-rated") {
    if (ors != null) ors = Math.min(ors, FLAG_CEILING);
    status = "review-required";
  }
  const bandRow = ors == null || status === "review-required" ? null : BANDS_ORS.find(([min]) => ors >= min);

  const out = {
    version: RESEARCH_VERSION,
    quality: quality == null ? null : r1(quality),
    qualityOnly: qualityOnly == null ? null : r1(qualityOnly),
    provisional: quality != null && appGroups.some(g => g.score == null),
    // Set when the coverage cap applies, with what it would be uncapped
    capped: quality != null && capReason ? { at: CAPPED_AT, reason: capReason, uncapped: r1(rawQuality) } : null,
    groups,
    coverage: { pct: r1(coverage * 100), checked: groups.reduce((a, g) => a + g.checked, 0), total: groups.reduce((a, g) => a + g.total, 0) },
    confidence,
    valuation: { score: valuation.score, label: valuation.score == null ? "Not enough data" : valuationLabel(valuation.score), asOf: m.closeDate ?? null, price: m.close ?? null },
    technical: tech,
    risk,
    overall: {
      score: ors == null ? null : r1(ors), status,
      stance: bandRow?.[1] ?? (status === "review-required" ? "Review required" : status === "quality-only" ? "Quality view only" : "Not rated"),
      text: bandRow?.[2] ?? (status === "review-required" ? `Review required — ${flags[0].text.split(".")[0].replace(/^The/, "the")}.`
        : status === "quality-only" ? "Quality view only — valuation needs more data." : "Not rated — too little filed data to score."),
    },
    flags,
  };
  out.summary = summarise(out, m);
  return out;
}

// A few plain sentences from the numbers — templates, never generated prose
function summarise(r, m) {
  const years = m.yearsOnFile ?? m.history.length;
  const fromQuarters = r.groups.some(g => g.items.some(i => i.fromQuarters));
  if (r.quality == null) {
    if (years < 3 && (m.quarters?.length ?? 0) < 8) return `Only ${years} year${years === 1 ? "" : "s"} of annual results on NSE — too few to score yet. Most checks need 3 years, or 8 quarters for a recent listing.`;
    // Enough history, too few checks: say which groups and, for a loss-maker, why
    const blank = r.groups.filter(g => g.applicable && g.score == null).map(g => g.label.toLowerCase());
    const list = blank.length > 1 ? `${blank.slice(0, -1).join(", ")} and ${blank.at(-1)}` : blank[0];
    const loss = !(m.history[0]?.profitCr > 0);
    return `Too few checks have data to score it yet: ${list} couldn't be scored${loss ? " — it made a loss, so checks built on EPS and P/E have nothing to work with" : ""}.`;
  }
  const groups = r.groups.filter(g => g.score != null && g.id !== "valuation");
  const ranked = [...groups].sort((a, b) => b.score - a.score);
  const strong = ranked.filter(g => g.score >= 65).slice(0, 2).map(g => g.label.toLowerCase());
  const weak = ranked.at(-1)?.score < 50 ? ranked.at(-1).label.toLowerCase() : null;
  const q = r.qualityOnly ?? r.quality;
  const qWord = q >= 75 ? "strong" : q >= 60 ? "good" : q >= 45 ? "mixed" : "weak";
  // The cap's reason has its own warning on the page; here it's a word
  // The card's "Without valuation" figure — named so, since the headline
  // Quality beside it includes valuation and can differ
  const s = [`${r.qualityOnly != null ? "Quality before valuation" : "Quality"} is ${qWord} (${Math.round(q)}/100${r.capped ? ", capped" : ""})${strong.length ? `, best in ${strong.join(" and ")}` : ""}${weak && !strong.includes(weak) ? `; ${weak} is the weak spot` : ""}.`];
  if (r.valuation.score != null) s.push(`At the ${m.closeDate ? new Date(`${m.closeDate}T00:00:00Z`).toLocaleString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "last"} close, valuation looks ${r.valuation.label.toLowerCase()} (${Math.round(r.valuation.score)}/100).`);
  s.push(`${r.technical.score != null ? `The price trend is ${r.technical.label.toLowerCase()}; r` : "R"}isk is ${r.risk.label.toLowerCase()} (${Math.round(r.risk.score)}/100).`);
  const conf = r.confidence >= 80 ? "high" : r.confidence >= 60 ? "moderate" : "low";
  s.push(`Data quality is ${conf}: ${r.coverage.checked} of ${r.coverage.total} checks have data, and related-party deals, forecasts and a cash-flow model aren't covered. It reflects coverage and recency, not confidence in a future outcome.`);
  if (fromQuarters) s.push(`Listed recently, with ${years} year${years === 1 ? "" : "s"} of annual results on NSE: margin steadiness, sales consistency and growth are judged on its last eight quarters instead.`);
  return s.join(" ");
}
