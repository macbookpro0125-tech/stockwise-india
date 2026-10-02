// The research score's rules (research.js), on made-up companies run through
// the real metrics pipeline — the acceptance checks of the scoring proposal:
// weights add up, bands hit their anchors, a missing number never becomes a
// zero or a pass, items that don't apply leave the denominator, coverage
// gates hold, the overall formula is what's stated, and the price trend never
// moves the quality or overall score.
import { computeMetrics } from "./metrics.js";
import { band, GROUPS, computeResearch } from "./research.js";
import { pricePosition } from "./levels.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}
const near = (a, b, tol = 0.11) => a != null && b != null && Math.abs(a - b) <= tol;
const NOW = Date.parse("2026-10-02T00:00:00Z");
const CR = 1e7;

// A steady, debt-light company with six years of filings. `tweak` edits the
// raw years (newest first) before they're stored.
function company({ tweak = y => y, template = "INDAS", holding = {}, sector = "Information Technology" } = {}) {
  const years = [2026, 2025, 2024, 2023, 2022, 2021].map((yr, i) => {
    const g = Math.pow(1.12, -i); // 12% a year growth, newest first
    return tweak({
      fyEnd: `${yr}-03-31`, label: `FY${yr}`, scope: "Consolidated", source: "integrated", filed: `${yr}-05-15`, template,
      revenue: 1000 * CR * g, expenses: 800 * CR * g, financeCosts: 5 * CR, depreciation: 30 * CR * g, otherIncome: 10 * CR,
      pbt: 175 * CR * g, profit: 130 * CR * g, eps: 13 * g, ocf: 150 * CR * g, capex: 40 * CR * g,
      equity: 900 * CR * g, debt: 50 * CR, leases: i === 0 ? 20 * CR : null, longTermDebt: 30 * CR,
      totalAssets: 1300 * CR * g, currentAssets: 600 * CR * g, currentLiabilities: 250 * CR * g,
      cash: 200 * CR * g, bankBalances: 50 * CR, currentInvestments: 100 * CR * g,
      paidUp: 100 * CR, faceValue: 10, cogs: 400 * CR * g,
      auditOpinion: "unmodified", auditor: i < 2 ? "Example & Co LLP" : null,
    }, i);
  });
  return {
    symbol: "TESTCO", name: "Test Company Ltd", template, years,
    holding: {
      promoterPct: 60, pledgedPct: 0, totalShares: 10 * CR, asOf: "30-JUN-2026", asOfIso: "2026-06-30",
      promoterHistory: Array.from({ length: 20 }, (_, q) => ({ asOfIso: new Date(Date.UTC(2026, 5 - 3 * q, 30)).toISOString().slice(0, 10), pct: 60 })),
      ...holding,
    },
  };
}

function snapshot({ price = 200, tech = {}, sector = "Information Technology" } = {}) {
  const fyEndPrices = {};
  [2026, 2025, 2024, 2023, 2022, 2021].forEach((yr, i) => {
    fyEndPrices[`${yr}-03-31`] = { date: `${yr}-03-31`, prices: { TESTCO: 260 * Math.pow(1.12, -i) } }; // P/E 20 each year
  });
  return {
    pricesDate: "2026-10-01", prices: { TESTCO: price }, splits: {}, dividends: {}, sectors: { TESTCO: sector },
    fyEndPrices,
    tech: { TESTCO: { rsi14: 55, vsSma50: 3, vsSma200: 8, volatility1y: 25, maxLoss1y: 15, avgVolume3m: 500000, beta1y: 0.9, ...tech } },
    returns: { TESTCO: { m6VsNifty: 5, y1VsNifty: 10 } },
  };
}

const metricsOf = (stock, snap) => {
  const m = computeMetrics(stock, snap, {}, { research: false });
  return { ...m, research: computeResearch(m, { peers: new Map([["Information Technology", { median: 22, n: 30 }]]), now: NOW }) };
};
const group = (r, id) => r.groups.find(g => g.id === id);
const itemOf = (r, gid, iid) => group(r, gid).items.find(i => i.id === iid);

// ── Structure ──
assert(GROUPS.reduce((a, g) => a + g.weight, 0) === 100, "group weights add up to 100 (25/20/15/15/10/15)");
assert(GROUPS.map(g => g.weight).join("/") === "25/20/15/15/10/15", "group weights are the proposal's 25/20/15/15/10/15");
for (const g of GROUPS) assert(near(g.items.reduce((a, i) => a + i.weight, 0), 1, 1e-9), `${g.label}: item weights add up to 100%`);

// ── Bands ──
const roce = [[0, 0], [7, 25], [13, 50], [20, 75], [33, 100]];
assert(band(13, roce) === 50 && band(20, roce) === 75, "a band hits its anchors exactly");
assert(near(band(16.5, roce), 62.5, 1e-9), "a band interpolates between anchors");
assert(band(-5, roce) === 0 && band(80, roce) === 100, "a band is flat beyond its ends (no bonus points)");
assert(band(null, roce) === null && band(NaN, roce) === null, "a band gives null for a missing value, never 0");

// ── A complete company ──
const base = metricsOf(company(), snapshot());
const r = base.research;
assert(r.quality != null && r.quality > 70, `the steady company scores well (quality ${r.quality})`);
assert(r.groups.every(g => g.score == null || (g.score >= 0 && g.score <= 100)), "every group score is between 0 and 100");
assert(near(r.groups.reduce((a, g) => a + (g.points ?? 0), 0), r.quality, 0.6), "quality = the sum of the groups' points when every group is scored");
assert(itemOf(r, "business", "competitive").structural && itemOf(r, "business", "competitive").score == null, "items the filings can't show stay listed as not checked");
assert(group(r, "governance").checked === 4 && group(r, "governance").total === 6, "governance shows 4 of 6 checked (related parties and governance flags unchecked)");
assert(itemOf(r, "governance", "auditor").score === 100 && /Example & Co LLP/.test(itemOf(r, "governance", "auditor").reason), "clean audit opinions score 100 and name the auditor");
assert(r.flags.length === 0, "a clean company has no red flags");
assert(r.overall.status === "rated" && r.overall.score != null, "a complete company gets an overall research score");

// The overall formula, recomputed from the parts
const g = Math.exp(0.7 * Math.log(r.qualityOnly) + 0.3 * Math.log(r.valuation.score));
assert(near(r.overall.score, g * (1 - 0.35 * r.risk.overlay / 100), 0.11), "overall = quality-ex-valuation^0.7 × valuation^0.3 × (1 − 0.35 × risk overlay)");
assert(!/\b(BUY|SELL|buy|sell)\b/.test(JSON.stringify(r)), "no buy or sell wording anywhere in the result");

// ── A qualified audit opinion ──
const qualifiedNow = metricsOf(company({ tweak: (y, i) => (i === 0 ? { ...y, auditOpinion: "qualified" } : y) }), snapshot());
const qn = qualifiedNow.research;
assert(itemOf(qn, "governance", "auditor").score === 0, "the auditor qualified the latest accounts: the audit check scores 0");
assert(qn.flags.some(f => f.id === "auditQualified" && f.severity === "critical"), "…and it's a critical red flag");
assert(qn.overall.status === "review-required" && qn.overall.score <= 39 && qn.overall.stance === "Review required", "…which holds the overall score at 39 or under, marked Review required");
const qualifiedBefore = metricsOf(company({ tweak: (y, i) => (i === 2 ? { ...y, auditOpinion: "qualified" } : y) }), snapshot());
assert(itemOf(qualifiedBefore.research, "governance", "auditor").score === 50 && qualifiedBefore.research.flags.length === 0, "an older qualification scores 50 and isn't a red flag");
const resignedSnap = { ...snapshot(), auditorResignations: { TESTCO: ["2026-05-12"] } };
const resigned = metricsOf(company(), resignedSnap).research;
assert(itemOf(resigned, "governance", "auditor").score === 50 && /resigned on 12 May 2026/.test(itemOf(resigned, "governance", "auditor").reason), "an auditor's resignation halves the audit check and says when");
assert(resigned.flags.some(f => f.id === "auditorResigned" && f.severity === "caution") && resigned.overall.status === "rated", "…shows as a caution, without the review-required override");
const knownNone = metricsOf(company(), { ...snapshot(), auditorResignations: {} }).research;
assert(/no auditor resignation/.test(itemOf(knownNone, "governance", "auditor").reason) && knownNone.flags.length === 0, "resignations checked and none found: the reason says so");
assert(!/resignation/.test(itemOf(r, "governance", "auditor").reason), "resignations not checked: the reason doesn't claim there were none");
const noOpinion = metricsOf(company({ tweak: y => ({ ...y, auditOpinion: null }) }), snapshot());
assert(itemOf(noOpinion.research, "governance", "auditor").score == null, "no audit opinion on file: missing, not a pass");

// ── Missing data is left out, never scored 0 ──
const noCapex = metricsOf(company({ tweak: y => ({ ...y, capex: null }) }), snapshot());
const fc = itemOf(noCapex.research, "earnings", "fcfConversion");
assert(fc.score == null && fc.missing, "no capital spending filed: free-cash-flow conversion is missing, not 0");
const eq = group(noCapex.research, "earnings");
const reweighted = eq.items.filter(i => i.score != null).reduce((a, i) => a + i.score * i.weight, 0) / eq.items.filter(i => i.score != null).reduce((a, i) => a + i.weight, 0);
assert(eq.checked === 4 && near(eq.score, reweighted, 0.06), "the earnings group renormalises over the 4 items checked");
const noCash = metricsOf(company({ tweak: y => ({ ...y, ocf: null, capex: null }) }), snapshot());
assert(group(noCash.research, "earnings").score == null, "no cash-flow statements at all: 30% of earnings checked is under the 35% minimum, so it isn't scored");
assert(noCash.research.quality != null, "…and the quality score stands on the other groups");
const noPledge = metricsOf(company({ holding: { pledgedPct: null } }), snapshot());
assert(itemOf(noPledge.research, "governance", "pledge").score == null, "unknown pledge is missing, not a pass");

// ── Items that don't apply leave the denominator ──
const bank = metricsOf(company({ template: "BANKING", tweak: y => ({ ...y, cash: null, bankBalances: null, currentInvestments: null, debt: 9000 * CR }) }), snapshot());
assert(bank.lender && !group(bank.research, "balance").applicable, "a bank's balance-sheet group is not applicable");
assert(bank.research.quality != null, "a bank is still scored on the groups that apply");
assert(bank.research.quality <= 69 && bank.research.capped?.at === 69 && /bad loans/.test(bank.research.capped.reason), "a bank's quality is capped at 69, saying why (bad loans and capital adequacy aren't in the filings)");
assert(r.capped === null, "a fully checked company isn't capped");
const noShareholding = metricsOf(company({ holding: { pledgedPct: null, promoterHistory: [] }, tweak: y => ({ ...y, auditOpinion: null }) }), snapshot());
assert(group(noShareholding.research, "governance").score == null, "no pledge, promoter history or audit opinion: governance has too little to score");
assert(noShareholding.research.quality != null && noShareholding.research.quality <= 69 && /Shareholding/.test(noShareholding.research.capped?.reason), "governance that can't be checked caps quality at 69, saying why");
assert(group(bank.research, "earnings").items.filter(i => i.na).length === 3, "a bank's cash-flow items are not applicable rather than missing");
const widelyHeld = metricsOf(company({ holding: { promoterPct: 0, promoterHistory: Array.from({ length: 12 }, (_, q) => ({ asOfIso: `20${26 - Math.floor(q / 4)}-0${3 + 0 * q}-31`, pct: 0 })) } }), snapshot());
assert(itemOf(widelyHeld.research, "governance", "promoterStability").na, "no promoter group: promoter stability doesn't apply");
assert(itemOf(widelyHeld.research, "governance", "pledge").score === 100, "no promoter group: nothing can be pledged");

// ── Coverage gates ──
const young = metricsOf(company({ tweak: (y, i) => (i >= 2 ? { ...y, revenue: null, profit: null, eps: null, equity: null, debt: null, ocf: null } : y) }), snapshot());
assert(young.research.quality == null && young.research.overall.status === "not-rated", "two usable years: not rated rather than a guess");

// ── The price trend never moves quality or overall ──
const hot = metricsOf(company(), snapshot({ tech: { rsi14: 80, vsSma50: 15, vsSma200: 40 } }));
const cold = metricsOf(company(), snapshot({ tech: { rsi14: 20, vsSma50: -15, vsSma200: -30 } }));
assert(hot.research.technical.score > cold.research.technical.score, "technical setup responds to the price trend");
assert(hot.research.quality === cold.research.quality, "technical setup doesn't change the quality score");
assert(hot.research.overall.score === cold.research.overall.score, "technical setup doesn't change the overall score");

// ── Price moves valuation, not the business groups ──
const cheap = metricsOf(company(), snapshot({ price: 150 }));
const dear = metricsOf(company(), snapshot({ price: 400 }));
assert(group(cheap.research, "valuation").score > group(dear.research, "valuation").score, "a lower price raises the valuation score");
for (const id of ["business", "earnings", "balance", "governance", "growth"]) {
  assert(group(cheap.research, id).score === group(dear.research, id).score, `price doesn't move ${id}`);
}

// ── Provisional when confidence is low ──
const stale = metricsOf(company(), { ...snapshot(), pricesDate: "2025-01-01" });
const staleR = computeResearch({ ...stale, closeDate: "2025-01-01" }, { peers: new Map(), now: NOW });
assert(staleR.confidence < r.confidence, "an old price lowers confidence");

// ── Where the price sits: described, never instructed ──
const levels = { fv25: 1000, p1: 900, p2: 810, p3: 720, stopLoss: 670, target: 1300 };
const zones = [[650, "below-stop"], [700, "phase3"], [800, "phase2"], [880, "phase1"], [950, "above-phase1"], [1350, "above-upper"], [1600, "far-above"]];
for (const [p, z] of zones) assert(pricePosition(p, levels).zone === z, `₹${p} sits in the ${z} zone`);
assert(zones.every(([p]) => !/\b(BUY|SELL|buy|sell|deploy|exit)/i.test(JSON.stringify(pricePosition(p, levels)))), "price positions never say buy, sell, deploy or exit");

console.log("\nAll research-score checks passed.");
