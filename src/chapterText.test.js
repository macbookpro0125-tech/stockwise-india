// What a company page's chapters say (chapterText.js): each answer agrees
// with the figures shown under it. A sweep of every listed company (26 Oct
// 2026) found these cases worded against their own figures.
import assert from "node:assert/strict";
import { chapterJudgement, chapterFigures, gistLine } from "./chapterText.js";

const group = (id, score, items = []) => ({ id, applicable: true, score, weight: 1, items });
const research = (scores = {}, extra = {}) => ({
  groups: [
    group("business", scores.business ?? 80), group("earnings", scores.earnings ?? 80), group("balance", scores.balance ?? 80),
    group("governance", scores.governance ?? 80, [{ id: "auditor", score: 100 }]), group("growth", scores.growth ?? 80), group("valuation", scores.valuation ?? 80),
  ],
  valuation: { label: scores.valuation >= 70 || scores.valuation == null ? "Inexpensive" : scores.valuation >= 50 ? "Reasonable" : "Expensive" },
  technical: { score: scores.technical ?? 60, label: "Mixed" },
  flags: [],
  ...extra,
});
const company = (over = {}, scores = {}) => ({ research: research(scores), promoterPct: 60, pledgedPct: 0, promoterHistory: [{ asOfIso: "2026-09-30", pct: 60 }, { asOfIso: "2021-09-30", pct: 60 }], ...over });

// Owners: shares pledged, however few, are never "nothing pledged"
assert.equal(chapterJudgement("owners", company({ pledgedPct: 12 })), "Steady owners, though some of their shares are pledged");
assert.equal(chapterJudgement("owners", company({ pledgedPct: 0.2 })), "Steady owners, hardly any shares pledged");
assert.equal(chapterJudgement("owners", company()), "Steady owners, nothing pledged, clean audits");
// a big fall in the promoters' stake is said, with a pledge beside it
const fell = { promoterPct: 42, promoterHistory: [{ asOfIso: "2026-09-30", pct: 42 }, { asOfIso: "2021-09-30", pct: 75 }] };
assert.equal(chapterJudgement("owners", company(fell)), "The promoters' stake has fallen sharply since 2021");
assert.equal(chapterJudgement("owners", company({ ...fell, pledgedPct: 5 })), "The promoters' stake has fallen sharply since 2021, and some of it is pledged");
// no promoter group: said before any history of one
assert.equal(chapterJudgement("owners", company({ promoterPct: 0, promoterHistory: [{ asOfIso: "2026-09-30", pct: 0 }, { asOfIso: "2022-09-30", pct: 26 }] })), "No promoter group, clean audits");
console.log("ok: owners — pledges, a falling stake, no promoter");

// Growth: the words read the figures shown, 3 years first
assert.equal(chapterJudgement("growth", company({ salesGrowth3y: 18, epsGrowth3y: -10 })), "Sales are growing, but earnings per share are falling");
assert.equal(chapterJudgement("growth", company({ salesGrowth3y: -9, epsGrowth3y: -37 })), "Sales and earnings are both shrinking");
assert.equal(chapterJudgement("growth", company({ salesGrowth3y: 34, epsGrowth3y: 6 })), "Sales growing fast, earnings slowly");
assert.equal(chapterJudgement("growth", company({ salesGrowth3y: 11, epsGrowth3y: 9 })), "Growing steadily");
// a change under half a percent is flat, in the words and the figures
assert.equal(chapterJudgement("growth", company({ salesGrowth3y: 2.2, epsGrowth3y: -0.3 })), "Growing, but slowly");
assert.equal(chapterFigures("growth", company({ salesGrowth3y: 2.2, epsGrowth3y: -0.3 }))[1].value, "flat");
// the figure shown is the one the words read: 3 years, 5 beside it
const suz = chapterFigures("growth", company({ salesGrowth3y: 41, salesGrowth5y: 38, epsGrowth3y: -4.4, epsGrowth5y: 75 }));
assert.deepEqual(suz.map(f => [f.label, f.value, f.against]), [["Sales growth, 3 yrs", "41% a yr", "5 yrs: 38% a yr"], ["EPS growth, 3 yrs", "-4.4% a yr", "5 yrs: 75% a yr"]]);
console.log("ok: growth — mixed, shrinking, flat, and the period shown");

// Value: the words agree with the fair value shown beside the price
assert.equal(chapterJudgement("value", company({}, { valuation: 30 }), { fairValue: 8885, price: 7730 }), "Under its own fair value, but dear against its peers");
assert.equal(chapterJudgement("value", company({}, { valuation: 80 }), { fairValue: 277, price: 282 }), "Cheap against its peers, though above its own fair value");
assert.equal(chapterJudgement("value", company({}, { valuation: 60 }), { fairValue: 557, price: 693 }), "Priced above its own fair value");
assert.equal(chapterJudgement("value", company({}, { valuation: 80 }), { fairValue: 335, price: 258 }), "Priced below what its earnings suggest");
console.log("ok: value — against its own fair value");

// Business: a loss is said; the words follow the return shown
assert.equal(chapterJudgement("business", company({ ttmProfitCr: -2394 })), "Earned well for years, but made a loss lately");
assert.equal(chapterJudgement("business", company({ roce5y: 0.8, sectorCompare: [{ id: "roce5y", value: 0.8, median: 12, beats: 0.1 }] }, { business: 55 })), "Earns little on the money it uses");
assert.equal(chapterJudgement("business", company({ roce5y: 66, sectorCompare: [{ id: "roce5y", value: 66, median: 17, beats: 0.99 }] })), "Earns far more on its money than most companies");
console.log("ok: business — losses and returns");

// The gist agrees with the chapters
assert.match(gistLine(company({ ttmProfitCr: -100 })), /made a loss lately/);
assert.match(gistLine(company({ salesGrowth3y: 18, epsGrowth3y: -10 })), /with sales up but earnings down/);
assert.match(gistLine(company({}, { valuation: 60 }), { fairValue: 557, price: 693 }), /priced above its own fair value/);
console.log("All chapter wording checks passed.");
