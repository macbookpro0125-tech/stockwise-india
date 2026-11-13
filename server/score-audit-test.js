// The nightly score check (score-audit.js): each check fires on the case it
// is for and not on a normal company; a day's move needs no new results
import assert from "node:assert/strict";
const { auditScores } = await import("./score-audit.js");

const research = (over = {}) => ({
  quality: 70, confidence: 85, flags: [], overall: { score: 65 }, valuation: { score: 50 },
  groups: [{ id: "valuation", items: [{ id: "peers", value: 1 }] }], ...over,
});
const company = (over = {}) => ({ symbol: "NORM", name: "Normal Ltd", close: 100, latestQuarter: "2026-09-30", fyEnd: "2026-03-31", marketCapCr: 5000, peTtm: 20, roe: 18, opm: 20, ttmSalesGrowth: 12, priceToSales: 3, epsGrowth3y: 12, research: research(), ...over });

const ok = (cond, msg) => { assert.ok(cond, msg); console.log(`ok: ${msg}`); };
const flagsOf = (rows, prev) => auditScores(rows, prev).flags;

ok(flagsOf([company()]).length === 0, "a normal company raises nothing");
ok(flagsOf([company({ symbol: "GROW", epsGrowth3y: 45, research: research({ valuation: { score: 6 }, groups: [{ id: "valuation", items: [{ id: "peers", value: 1.5 }] }] }) })]).some(f => f.check === "growerMarkedDear"), "a fast grower marked nearly as dear as it gets is flagged");
ok(!flagsOf([company({ symbol: "HYPE", epsGrowth3y: 45, research: research({ valuation: { score: 0 }, groups: [{ id: "valuation", items: [{ id: "peers", value: 8 }] }] }) })]).some(f => f.check === "growerMarkedDear"), "…but not at 8× its sector's P/E, which no growth explains");
ok(flagsOf([company({ symbol: "CHEAP", peTtm: 0.6 })]).some(f => f.check === "oddPe" && f.severity === 3), "a P/E under 2 is flagged as serious");
ok(flagsOf([company({ symbol: "SLIP", ttmSalesGrowth: 900 })]).some(f => f.check === "oddGrowth"), "sales up 900% looks like a unit slip");
ok(flagsOf([company({ symbol: "THIN", research: research({ overall: { score: 75 }, confidence: 40 }) })]).some(f => f.check === "thinData"), "a high score on little data is flagged");

const prev = { NORM: { overall: 65, quality: 70, close: 100, quarter: "2026-09-30", fyEnd: "2026-03-31" } };
ok(flagsOf([company({ research: research({ overall: { score: 45 } }) })], prev).some(f => f.check === "jump"), "20 points down in a day with no new results is flagged");
ok(!flagsOf([company({ latestQuarter: "2026-12-31", research: research({ overall: { score: 45 } }) })], prev).some(f => f.check === "jump"), "…but not when new results came in");

const a = auditScores([company({ symbol: "SMALL", marketCapCr: 600, peTtm: 1 }), company({ symbol: "BIG", marketCapCr: 90000, peTtm: 1 })]);
ok(a.flags[0].symbol === "BIG" && a.flagged === 2 && a.scores.NORM === undefined && a.scores.BIG.overall === 65, "the larger company comes first; every company's scores are kept for the next night");
