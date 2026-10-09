// The research score's rules (research.js), on made-up companies run through
// the real metrics pipeline — the acceptance checks of the scoring proposal:
// weights add up, bands hit their anchors, a missing number never becomes a
// zero or a pass, items that don't apply leave the denominator, coverage
// gates hold, the overall formula is what's stated, and the price trend never
// moves the quality or overall score.
import { computeMetrics } from "./metrics.js";
import { band, GROUPS, computeResearch, justifiedPb, BANK_COST_OF_EQUITY, BANK_LONG_RUN_GROWTH } from "./research.js";
import { pricePosition } from "./levels.js";
import { classifyAnnouncement } from "./company-extras.js";

function assert(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok: ${msg}`);
}
const near = (a, b, tol = 0.11) => a != null && b != null && Math.abs(a - b) <= tol;
const NOW = Date.parse("2026-10-02T00:00:00Z");
const CR = 1e7;
const filingReview = classifyAnnouncement("Resignation of Statutory Auditor", "The auditor resigned effective 30 September; ₹12 crore penalty disclosed.");
assert(filingReview?.category === "Audit / accounts" && /statutory auditor|auditor resign/i.test(filingReview.matchedText), "filing triage explains its matched source phrase");
assert(filingReview.extractedAmounts.includes("₹12 crore") && filingReview.sentiment == null, "filing triage extracts stated amounts and avoids positive/negative conclusions");
assert(classifyAnnouncement("General update", "") == null, "unmatched filing descriptions stay unclassified");

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
for (const g of GROUPS) assert(near(g.items.filter(i => !i.bank).reduce((a, i) => a + i.weight, 0), 1, 1e-9), `${g.label}: item weights add up to 100%`);
// A bank's: its business items take the 20% reinvestment holds for others;
// its balance-sheet items add up to 100% on their own
const bankWeight = (gid, drop = []) => GROUPS.find(g => g.id === gid).items.filter(i => i.bank || (!drop.includes(i.id) && gid !== "balance")).reduce((a, i) => a + i.weight, 0);
assert(near(bankWeight("business", ["reinvestment"]), 1, 1e-9), "Business quality for a bank: item weights add up to 100%");
assert(near(bankWeight("balance"), 1, 1e-9), "Balance sheet for a bank: its own items add up to 100%");

// ── Bands ──
const roce = [[0, 0], [7, 25], [13, 50], [20, 75], [33, 100]];
assert(band(13, roce) === 50 && band(20, roce) === 75, "a band hits its anchors exactly");
assert(near(band(16.5, roce), 62.5, 1e-9), "a band interpolates between anchors");
assert(band(-5, roce) === 0 && band(80, roce) === 100, "a band is flat beyond its ends (no bonus points)");
assert(band(null, roce) === null && band(NaN, roce) === null, "a band gives null for a missing value, never 0");

// ── A complete company ──
const base = metricsOf(company(), snapshot());

// ── Whose profit and equity ──
// A holding company: half its group profit and equity belong to its
// subsidiaries' outside owners; its EPS is on its own half
const holdco = metricsOf(company({ tweak: y => ({ ...y, profitOwners: y.profit / 2, equityOwners: y.equity / 2, eps: y.eps / 2 }) }), snapshot());
assert(near(holdco.bookValuePerShare, base.bookValuePerShare / 2, 0.01) && near(holdco.priceToBook, base.priceToBook * 2, 0.05), "a holding company's book value is its own shareholders' equity, not the group's");
assert(near(holdco.roe, base.roe, 0.2), "ROE pairs own profit with own equity");
assert(holdco.epsRebased == null && near(holdco.eps, base.eps / 2, 0.001), "its EPS is left as filed — it already is the shareholders' own");
// A filing that contradicts itself: "₹ to owners" far below the total with
// nothing to anyone else, while EPS fits the total (Balkrishna's FY26)
const slip = metricsOf(company({ tweak: y => ({ ...y, profitOwners: y.profit * 0.7 }) }), snapshot());
assert(near(slip.roe, base.roe, 0.2) && slip.epsRebased == null, "an own-shareholders profit out of line with the filing's own EPS is a slip: ROE and EPS stay on the figure that fits");
// A large share issue after the year: twice the shares the EPS was worked out on
const issued = metricsOf(company({ holding: { totalShares: 20 * CR } }), snapshot());
assert(issued.epsRebased && near(issued.eps, base.eps / 2, 0.01) && near(issued.pe, base.pe * 2, 0.05), "after a large share issue, EPS is the year's profit over today's shares");
assert(near(issued.reportedEps, base.eps, 0.001) && near(issued.epsRebased.epsSharesCr, 10, 0.01), "…and the filing's EPS and its share count are kept for the page to show");
const small = metricsOf(company({ holding: { totalShares: 11 * CR } }), snapshot());
assert(small.epsRebased == null, "a share count only 10% higher (options, a small placement) leaves EPS as filed");
// ── Quarters ──
// Eight quarters, each 10% above the same quarter a year earlier
const qEnds = ["2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30", "2025-06-30", "2025-03-31", "2024-12-31", "2024-09-30"];
const withQuarters = (ends = qEnds) => ({ ...company(), quarters: ends.map((qEnd, i) => {
  const g = Math.pow(1.1, -Math.floor(i / 4)) * (1 - (i % 4) * 0.02);
  return { qEnd, scope: "Consolidated", source: "integrated", filed: qEnd.replace(/-\d\d$/, "-28"), revenue: 260 * CR * g, expenses: 205 * CR * g, profit: 35 * CR * g, eps: 3.5 * g, paidUp: 100 * CR, faceValue: 10 };
}) });
const qm = metricsOf(withQuarters(), snapshot());
assert(qm.quarters.length === 8 && near(qm.qSalesGrowthYoY, 10, 0.01) && near(qm.qProfitGrowthYoY, 10, 0.01), "the latest quarter is compared with the same quarter a year earlier");
assert(near(qm.qSalesGrowthQoQ, (1 / 0.98 - 1) * 100, 0.01), "…and with the quarter before");
assert(near(qm.ttmEps, qm.quarters.slice(0, 4).reduce((a, q) => a + q.eps, 0), 1e-9) && near(qm.peTtm, qm.cmp / qm.ttmEps, 1e-9), "P/E on the last four quarters uses their EPS added up");
const gappy = metricsOf(withQuarters(["2026-06-30", "2026-03-31", "2025-09-30", "2025-06-30", "2025-03-31"]), snapshot());
assert(gappy.ttmEps == null && gappy.peTtm == null, "a missing quarter (Dec 2025) means no trailing-twelve-month figure rather than three quarters passed off as four");
assert(metricsOf(company(), snapshot()).quarters.length === 0 && metricsOf(company(), snapshot()).qSalesGrowthYoY == null, "a company with no quarterly data has no quarterly figures, not zeros");
// ── A recent listing: two years of annual results, eight quarters ──
const recentListing = (() => { const c = withQuarters(); return { ...c, years: c.years.slice(0, 2) }; })();
const ym = metricsOf(recentListing, snapshot());
const yItems = ym.research.groups.flatMap(g => g.items);
assert(ym.research.quality != null, "a company listed two years ago is scored, its year-based checks judged on its last eight quarters");
assert(["marginStability", "revenueConsistency", "salesGrowth3y", "epsGrowth3y"].every(id => yItems.find(i => i.id === id)?.fromQuarters), "…margin steadiness, sales consistency and growth come from the quarters, and say so");
assert(/eight quarters/.test(ym.research.summary), "…and the summary says the company listed recently");
const established = metricsOf(withQuarters(), snapshot());
assert(established.research.quality === base.research.quality && !established.research.groups.some(g => g.items.some(i => i.fromQuarters)), "a company with the years keeps its year-based checks — quarters change nothing");
const tooNew = metricsOf({ ...company(), years: company().years.slice(0, 2) }, snapshot());
assert(tooNew.research.quality == null && /2 years of annual results/.test(tooNew.research.summary), "two years and no quarters is still too little, and the page says how many years there are");
const broken = metricsOf(company({ holding: { totalShares: 900 * CR } }), snapshot());
assert(broken.epsRebased == null, "90x the shares is a broken figure, not a share issue — EPS stays as filed");
const r = base.research;
assert(base.provenance?.financials?.period === base.fyEnd && base.provenance.financials.source.includes("NSE") && base.provenance.marketPrice.date === base.closeDate, "valuation inputs expose filing scope/date and price provenance");
assert(base.fcfYieldPct != null && near(base.fcfYieldPct, (base.fcfCr / base.marketCapCr) * 100, 0.001), "free-cash-flow yield uses same-period FCF and market value");
assert(r.quality != null && r.quality > 70, `the steady company scores well (quality ${r.quality})`);
assert(r.groups.every(g => g.score == null || (g.score >= 0 && g.score <= 100)), "every group score is between 0 and 100");
assert(group(r, "valuation").score != null && group(r, "valuation").coverage < 0.71, "the unbuilt DCF check lowers valuation coverage without blocking a valuation score");
const peerCheck = (sector, industry, peers) => {
  const pm = computeMetrics(company(), { ...snapshot({ sector }), industries: { TESTCO: industry } }, {}, { research: false });
  return itemOf(computeResearch(pm, { peers: new Map(peers), now: NOW }), "valuation", "peers");
};
const bothCohorts = [["Information Technology", { median: 22, n: 30 }], ["industry:Computers - Software", { median: 40, n: 12 }]];
assert(/22\.0 for 30 Information Technology/.test(peerCheck("Information Technology", "Computers - Software", bothCohorts).reason), "a known sector is the peer group, as in the Peers panel — not NSE's older industry label");
assert(/NSE industry Pharmaceuticals/.test(peerCheck(null, "Pharmaceuticals", [["industry:Pharmaceuticals", { median: 20, n: 12 }]]).reason ?? ""), "NSE's industry is the fallback when the sector is unknown");
assert(peerCheck(null, "Miscellaneous", [["industry:Miscellaneous", { median: 25, n: 19 }]]).score == null, "a catch-all industry like Miscellaneous is never a peer group");
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
assert(noCash.research.quality != null && noCash.research.qualityOnly != null, "other sufficiently covered groups still support quality scores when earnings is unscored");
const noPledge = metricsOf(company({ holding: { pledgedPct: null } }), snapshot());
assert(itemOf(noPledge.research, "governance", "pledge").score == null, "unknown pledge is missing, not a pass");

// ── Items that don't apply leave the denominator ──
const bank = metricsOf(company({ template: "BANKING", tweak: y => ({ ...y, cash: null, bankBalances: null, currentInvestments: null, debt: 9000 * CR }) }), snapshot());
assert(bank.lender && !group(bank.research, "balance").applicable, "a bank's balance-sheet group is not applicable");
assert(bank.research.quality != null, "a bank is still scored on the groups that apply");
assert(bank.research.quality <= 69 && bank.research.capped?.at === 69 && /bad-loan/.test(bank.research.capped.reason), "a bank whose own figures aren't on file is capped at 69, saying why");

// ── A bank with its own figures (fetch-nse.js bankFigures) is checked on them ──
const BANK_FIGURES = {
  v: 1, scope: "Standalone", asOf: "2026-06-30", fyEnd: "2026-03-31",
  gnpaPct: 1.17, nnpaPct: 0.41, gnpa: 3584 * CR, nnpa: 1236 * CR, cet1Pct: 19.57, at1Pct: 0, roaPct: 1.94,
  interestEarned: 307522 * CR, interestExpended: 178836 * CR, opex: 72660 * CR, otherIncome: 62533 * CR,
  provisions: 23390 * CR, advances: 2937166 * CR, deposits: 3105250 * CR, advancesPrev: 2619609 * CR, depositsPrev: 2714715 * CR,
};
const bankStock = extra => ({ ...company({ template: "BANKING", tweak: y => ({ ...y, cash: null, bankBalances: null, currentInvestments: null, debt: 9000 * CR }) }), bank: { ...BANK_FIGURES, ...extra } });
const goodBank = metricsOf(bankStock(), snapshot());
assert(near(goodBank.bank.pcrPct, 65.51, 0.01) && near(goodBank.bank.costToIncomePct, 38, 0.01) && near(goodBank.bank.creditCostPct, 0.84, 0.01) && near(goodBank.bank.loanGrowthPct, 12.12, 0.01), "bank ratios: provision cover, cost-to-income, credit cost and loan growth from the filed amounts");
const goodBalance = group(goodBank.research, "balance");
assert(goodBalance.applicable && goodBalance.score != null && goodBalance.checked === 5, "a bank's balance sheet is scored on bad loans, cover, capital and credit cost");
assert(!goodBalance.items.find(i => i.id === "netDebt").score && goodBalance.items.find(i => i.id === "netDebt").na, "industrial debt tests stay not applicable for a bank");
assert(goodBank.research.capped == null && goodBank.research.quality > 69, "with its own tests read, a sound bank isn't capped at 69");
assert(itemOf(goodBank.research, "business", "roa").score === 98.2 && itemOf(goodBank.research, "business", "costToIncome").score != null, "return on assets and cost-to-income count in business quality");
const weakBank = metricsOf(bankStock({ gnpaPct: 7.5, nnpaPct: 3.2, nnpa: 1800 * CR, cet1Pct: 9.2, roaPct: 0.3, provisions: 70000 * CR }), snapshot());
assert(group(weakBank.research, "balance").score < 35 && weakBank.research.quality < goodBank.research.quality - 10, "a bank with bad loans of 7.5% and thin capital scores low (the balance sheet is 15% of quality)");
const partBank = metricsOf(bankStock({ cet1Pct: null }), snapshot());
assert(itemOf(partBank.research, "balance", "cet1").score == null && /CET1/.test(itemOf(partBank.research, "balance", "cet1").missing), "a missing CET1 is missing, never a pass");
const nbfc = metricsOf(company({ template: "NBFC", tweak: y => ({ ...y, debt: 9000 * CR }) }), snapshot());
assert(!nbfc.lender || (nbfc.research.capped?.at === 69 && /NBFC/.test(nbfc.research.capped.reason) && !group(nbfc.research, "balance").applicable), "an NBFC lender stays capped — its filings carry no bad-loan or capital ratios");
for (const g of GROUPS) for (const it of g.items.filter(i => i.bank)) assert(it.compute(metricsOf(company(), snapshot())).na, `${it.label}: not applicable to an ordinary company`);
assert(near(GROUPS.find(g => g.id === "valuation").items.filter(i => i.bank || i.id !== "fcfYield").reduce((a, i) => a + i.weight, 0), 1, 1e-9), "Valuation for a bank: its book-value check takes the free-cash-flow yield's 15%");

// ── A bank's price-to-book against what its ROE supports ──
assert(near(justifiedPb(16.5), (16.5 - BANK_LONG_RUN_GROWTH) / (BANK_COST_OF_EQUITY - BANK_LONG_RUN_GROWTH), 1e-9) && justifiedPb(5) === 0.25, "justified P/B = (ROE − g) ÷ (cost of equity − g), floored for a return under growth");
const pbItem = itemOf(goodBank.research, "valuation", "bookValue");
assert(pbItem.score != null && /supports about/.test(pbItem.reason) && /cost of equity 12.5%/.test(pbItem.reason), "a bank's valuation checks its P/B against its ROE, stating the assumptions");
assert(itemOf(goodBank.research, "valuation", "fcfYield").hide, "the free-cash-flow yield isn't listed for a bank");

// ── The arithmetic behind the overall score reproduces it ──
const math = goodBank.research.overall.math;
const wavg = parts => parts.reduce((a, p) => a + p.score * p.weight, 0) / parts.reduce((a, p) => a + p.weight, 0);
assert(math.final === goodBank.research.overall.score, "the worked steps end on the displayed overall score");
assert(near(math.qualityOnly.raw, wavg(math.qualityOnly.parts), 0.06) && near(math.quality.raw, wavg(math.quality.parts), 0.06), "quality is the weighted average of the groups listed");
assert(near(math.blend, Math.exp(0.7 * Math.log(math.qualityOnly.value) + 0.3 * Math.log(math.valuation)), 0.06), "blend = quality before valuation^0.7 × valuation^0.3");
assert(near(math.afterTrim, math.blend * (1 - math.trimPct / 100), 0.06) && near(math.trimPct, 0.35 * math.overlay, 0.06), "trim = 35% of the price-swing and data-gap risk");
assert(bank.research.overall.math.qualityOnly.capAt === 69 || bank.research.qualityOnly <= 69, "a capped quality says so in the steps");

// ── Stale figures are flagged ──
const quartersOn = ends => ({ ...company(), quarters: ends.map(qEnd => ({ qEnd, scope: "Consolidated", source: "integrated", filed: qEnd.replace(/-\d\d$/, "-28"), revenue: 260 * CR, expenses: 205 * CR, profit: 35 * CR, eps: 3.5, paidUp: 100 * CR, faceValue: 10 })) });
const fresh = metricsOf(quartersOn(["2026-06-30", "2026-03-31", "2025-12-31"]), snapshot());
assert(!fresh.research.flags.some(f => f.id === "resultsOverdue"), "June results on file in October: not overdue");
const overdue = metricsOf(quartersOn(["2026-03-31", "2025-12-31", "2025-09-30"]), snapshot());
assert(overdue.research.flags.some(f => f.id === "resultsOverdue" && f.severity === "caution" && /31 Mar 2026/.test(f.text)), "March the latest in October: the June quarter's results are overdue");
const halfYearly = metricsOf(quartersOn(["2026-03-31", "2025-09-30", "2025-03-31"]), snapshot());
assert(!halfYearly.research.flags.some(f => f.id === "resultsOverdue"), "a half-yearly filer on its own rhythm isn't overdue");
assert(!overdue.research.flags.some(f => f.severity === "critical") && overdue.research.overall.status !== "review-required", "overdue results are a caution, not a score override");
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
