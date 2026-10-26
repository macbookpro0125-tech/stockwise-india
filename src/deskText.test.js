// What a company's page says beside its chart on a computer (deskText.js):
// its next results, its dividend, what to be careful of, the key figures
import assert from "node:assert/strict";
import { quarterName, resultsWatch, dividendWatch, cautions, keyFigures, growthNote } from "./deskText.js";

// TCS's figures as the page had them on 26 Oct 2026
const tcs = {
  latestQuarter: "2026-09-30", nextResults: null,
  quarters: [{ fyEnd: "2026-09-30", filed: "2026-10-08" }, { fyEnd: "2025-12-31", filed: "2026-01-12" }],
  events: [
    { date: "2026-07-15", kind: "action", title: "Interim Dividend - Rs 12 Per Share" },
    { date: "2026-10-14", kind: "action", title: "Interim Dividend - Rs 12 Per Share" },
  ],
  dividendRecord: {
    ttm: 112, yield: 4.43, next: null,
    byYear: [{ fy: 2022, regular: 36, special: 0 }, { fy: 2023, regular: 46, special: 67 }, { fy: 2024, regular: 51, special: 18 },
      { fy: 2025, regular: 58, special: 66 }, { fy: 2026, regular: 63, special: 46 }, { fy: 2027, regular: 55, special: 0, partial: true }],
  },
  salesGrowth3y: 5.8, salesGrowth5y: 10.2, payoutPct: 82.3, pledgedPct: 0, debtChange1y: null, ret1yVsNifty: -4.96,
  promoterHistory: [{ asOfIso: "2026-09-30", pct: 71.77 }, { asOfIso: "2025-09-30", pct: 71.77 }],
  history: [
    { fyEnd: "2019-03-31", revenueCr: 146463, profitCr: 31562 },
    { fyEnd: "2022-03-31", revenueCr: 191754, profitCr: 38449 },
    { fyEnd: "2024-03-31", revenueCr: 240893, profitCr: 46099 },
    { fyEnd: "2025-03-31", revenueCr: 255324, profitCr: 48797 },
    { fyEnd: "2026-03-31", revenueCr: 267021, profitCr: 49454 },
  ],
  marketCapCr: 915376.14, ttmRevenueCr: 283248, ttmProfitCr: 51858, ttmEps: 142.64, priceToBook: 8.5358,
};
const today = "2026-10-26";

assert.equal(quarterName("2026-09-30"), "July–September");
assert.equal(quarterName("2026-12-31"), "October–December");
assert.equal(quarterName("2027-03-31"), "January–March");

// No date told to NSE: the quarter that's due, and when last year's came
assert.deepEqual(resultsWatch(tcs, today), { kind: "results", title: "Results for October–December", text: "Date not announced yet · last year’s came on 12 Jan" });
// A date told to NSE
assert.equal(resultsWatch({ ...tcs, nextResults: "2026-10-27" }, today).title, "Results tomorrow");
assert.equal(resultsWatch({ ...tcs, nextResults: "2026-10-29" }, today).title, "Results on Thu 29 Oct");
assert.equal(resultsWatch({ ...tcs, nextResults: "2026-10-29" }, today).text, "For October–December");
// A date gone by isn't the next one
assert.equal(resultsWatch({ ...tcs, nextResults: "2026-10-08" }, today).title, "Results for October–December");
assert.equal(resultsWatch({}, today), null, "no quarters, nothing to say");

// The last dividend, and its habit of special ones (not the year still going)
assert.deepEqual(dividendWatch(tcs, today), { kind: "dividend", title: "Last dividend ₹12 a share, ex-date 14 Oct", text: "Special dividends in 4 of the last 5 years (₹46 in FY26)" });
// A declared one ahead comes first
const declared = { ...tcs, dividendRecord: { ...tcs.dividendRecord, next: { date: "2026-11-04", title: "Interim Dividend - Rs 15 Per Share", amount: 15 } } };
assert.equal(dividendWatch(declared, today).title, "Dividend ₹15 a share, ex-date 4 Nov");
// No specials: its yield instead
const plain = { ...tcs, dividendRecord: { ttm: 24, yield: 1.2, byYear: [{ fy: 2025, special: 0 }, { fy: 2026, special: 0 }] } };
assert.equal(dividendWatch(plain, today).text, "Yields 1.2% on the last 12 months");
assert.equal(dividendWatch({ events: [] }, today), null, "pays none, says none");

// TCS: growth is slow and its margin slipped; nothing else trips
assert.deepEqual(cautions(tcs), [
  { title: "Growth is slow", text: "Sales 5.8% a year over 3 years, against 10% over 5" },
  { title: "Profit margin has slipped", text: "21.5% in FY19, 18.5% in FY26" },
]);
// Pledges and paying out more than it earns come first, two at most
const worry = { ...tcs, pledgedPct: 22, payoutPct: 130 };
assert.deepEqual(cautions(worry).map(c => c.title), ["Promoters have pledged shares", "Pays out more than it earns"]);
// Shrinking sales say so
assert.equal(cautions({ salesGrowth3y: -4.2 })[0].text, "Sales −4.2% a year over 3 years");
// Promoters selling: a fall of 3 points or more over a year
const selling = { promoterHistory: [{ asOfIso: "2026-09-30", pct: 48.1 }, { asOfIso: "2026-06-30", pct: 50 }, { asOfIso: "2025-09-30", pct: 55.4 }] };
assert.equal(cautions(selling)[0].text, "Their stake fell from 55.4% to 48.1% in a year");
// Rising debt only when there's real debt
assert.equal(cautions({ debtChange1y: 80, totalDebtCr: 50, debtToEquity: 0.05 }).length, 0);
assert.equal(cautions({ debtChange1y: 45, totalDebtCr: 900, debtToEquity: 0.8 })[0].text, "Up 45% in a year; debt is 0.80× equity");
assert.deepEqual(cautions(null), []);

assert.deepEqual(keyFigures(tcs), [
  ["Market cap", "₹9,15,376 Cr"], ["Sales · 4 qtrs", "₹2,83,248 Cr"], ["Profit · 4 qtrs", "₹51,858 Cr"],
  ["EPS · 4 qtrs", "₹142.64"], ["Price / book", "8.54×"],
]);
assert.deepEqual(keyFigures({ marketCapCr: 120 }), [["Market cap", "₹120 Cr"]]);

// The last quarter against three years
const quick = { ...tcs, qSalesGrowthYoY: 11.23, qProfitGrowthYoY: 14.86 };
assert.deepEqual(growthNote(quick), { lead: "Growth picked up lately.", text: "In July–September sales were +11.2% and profit +14.9% on a year ago, against 5.8% a year over 3 years. Whether it lasts will show in the next results." });
assert.equal(growthNote({ ...tcs, qSalesGrowthYoY: -3, qProfitGrowthYoY: null }).text, "In July–September sales were −3.0% on a year ago, against 5.8% a year over 3 years. The next results will show whether it's a blip.");
assert.equal(growthNote({ ...tcs, qSalesGrowthYoY: 7 }), null, "close enough: nothing to explain");
assert.equal(growthNote({}), null);

console.log("deskText tests passed");
