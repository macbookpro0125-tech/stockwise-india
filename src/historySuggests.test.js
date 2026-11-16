import assert from "node:assert";
import { historyLines } from "./historySuggests.js";
const q = (end, rev, filed) => ({ fyEnd: end, revenueCr: rev, filed });
const m = {
  latestQuarter: "2026-09-30", nextResults: null,
  quarters: [q("2026-09-30", 110, "2026-10-10"), q("2026-06-30", 100), q("2026-03-31", 95), q("2025-12-31", 130, "2026-01-12"), q("2025-09-30", 100, "2025-10-09"), q("2025-06-30", 92), q("2025-03-31", 88), q("2024-12-31", 120), q("2024-09-30", 90)],
  events: [{ kind: "action", title: "Interim Dividend Rs 10", date: "2025-07-15" }, { kind: "action", title: "Dividend Rs 12", date: "2024-07-18" }, { kind: "action", title: "Final Dividend", date: "2025-01-20" }],
  dividendRecord: { track: { years: 5, paid: 5, raised: 4, cut: 0 } },
  history: [{ revenueCr: 1000, profitCr: 100 }], salesGrowth5y: 10, profitGrowth5y: 8,
};
const L = historyLines(m, "2026-11-16");
const t = k => L.find(x => x.k === k)?.text ?? "";
assert(/last year the same quarter's results came on 12 Jan 2026, so around 12 Jan 2027/i.test(t("Next results")), t("Next results"));
assert(/usually gone ex-dividend in Jul; paid in 5 of the last 5 years, raised 4 times and cut 0/.test(t("Dividends")), t("Dividends"));
assert(/October–December quarter has usually had its biggest sales/.test(t("Busiest quarter")), t("Busiest quarter"));
assert(/sales of about ₹1,331 crore and a profit of about ₹126 crore/.test(t("If its pace continued")) && /not a forecast/.test(t("If its pace continued")), t("If its pace continued"));
assert.equal(historyLines({ ...m, nextResults: "2026-12-01" }, "2026-11-16")[0].text, "Announced for 1 Dec 2026.");
assert(!L.some(x => /\b(buy|sell|target)\b/i.test(x.text)), "no buy, sell or target words");
assert.deepEqual(historyLines(null), []);
console.log("ok: what a company's history suggests");
