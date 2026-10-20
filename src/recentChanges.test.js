// What changed recently (recentChanges.js): node src/recentChanges.test.js
import assert from "node:assert/strict";
import { recentChanges } from "./recentChanges.js";

const TODAY = "2026-10-20";
const base = {
  closeDate: "2026-10-19", close: 1130.7, high52w: 1728, low52w: 980.4, ret1w: 1.2,
  quarters: [
    { fyEnd: "2026-09-30", filed: "2026-10-16", revenueCr: 50000, profitCr: 8000, salesYoY: 14.2, profitYoY: -3.4 },
    { fyEnd: "2026-06-30", filed: "2026-07-23", salesYoY: 10, profitYoY: 9 },
  ],
  events: [
    { date: "2026-10-14", kind: "action", title: "Interim Dividend - Rs 12 Per Share", detail: "Ex-date 2026-10-14; record date 2026-10-15" },
    { date: "2026-10-28", kind: "board", title: "Board meeting: fund raising" },
    { date: "2026-12-10", kind: "action", title: "Bonus 1:1", detail: "Ex-date 2026-12-10" },
    { date: "2027-01-20", kind: "board", title: "Board meeting: buyback" },
    { date: "2026-07-01", kind: "action", title: "Bonus 1:1" },
  ],
};
const holding = { promoterHistory: [{ asOfIso: "2026-09-30", pct: 13.82 }, { asOfIso: "2026-06-30", pct: 14.38 }, { asOfIso: "2026-03-31", pct: 14.52 }] };

{
  const { recent, upcoming } = recentChanges(base, holding, TODAY);
  assert.deepEqual(recent.map(r => r.kind), ["results", "dividend", "promoters"], "newest first");
  assert.equal(recent[0].date, "2026-10-16");
  assert.equal(recent[0].text, "Results for the September 2026 quarter: sales up 14.2% and profit down 3.4% on a year ago.");
  assert.equal(recent[1].text, "Went ex-dividend: ₹12 a share (record date 15 Oct).");
  // the holding itself is in Holdings; here, only how much it moved
  assert.equal(recent[2].text, "Promoters' holding fell 0.56 percentage points in the quarter to September.");
  assert.deepEqual(upcoming.map(u => u.text), ["Board meeting: fund raising.", "Ex-bonus 1:1."], "announced dates up to two months ahead");
  console.log("ok: results, an ex-dividend date with its record date and a promoter change, newest first; what's announced for the next two months");
}
{
  const { recent } = recentChanges({ ...base, quarters: [], events: [], ret1w: -11.4, close: 990 }, null, TODAY);
  // the week's change and the 52-week range are in the Overview, so not repeated here
  assert.deepEqual(recent.map(r => r.text), [
    "The price fell sharply over the past week.",
    "It closed near its 52-week low.",
  ]);
  const high = recentChanges({ ...base, quarters: [], events: [], ret1w: 8, close: 1720 }, null, TODAY).recent;
  assert.ok(high.some(r => r.text === "The price rose sharply over the past week.") && high.some(r => r.text === "It closed near its 52-week high."));
  assert.ok(!recent.concat(high).some(r => /%|₹/.test(r.text)), "no figure the page already shows");
  console.log("ok: a big week, and a close near the 52-week high or low, without repeating the figures");
}
{
  // Old news isn't news: results filed in July, a bonus in July, a tiny promoter change
  const old = recentChanges({ ...base, quarters: [base.quarters[1]], events: [base.events[3]] }, { promoterHistory: [{ asOfIso: "2026-09-30", pct: 14.4 }, { asOfIso: "2026-06-30", pct: 14.38 }] }, TODAY);
  assert.deepEqual(old.recent, []);
  // a promoter change for the June quarter (filed in July) is three months old by 20 Oct
  const june = recentChanges({ ...base, quarters: [], events: [] }, { promoterHistory: [{ asOfIso: "2026-06-30", pct: 13.82 }, { asOfIso: "2026-03-31", pct: 14.38 }] }, TODAY);
  assert.deepEqual(june.recent, []);
  // a loss: no percentage on a year ago
  const loss = recentChanges({ ...base, events: [], quarters: [{ fyEnd: "2026-09-30", filed: "2026-10-16", profitCr: -120, salesYoY: 5, profitYoY: null }] }, null, TODAY);
  assert.equal(loss.recent[0].text, "Results for the September 2026 quarter: sales up 5.0% on a year ago, and a loss of ₹120 Cr.");
  console.log("ok: nothing older than six weeks; a loss is said plainly");
}
