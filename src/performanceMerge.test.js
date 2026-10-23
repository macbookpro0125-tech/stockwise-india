// A strategy's snapshots as one list (performanceMerge.js)
import assert from "node:assert/strict";
import { mergePicks } from "./performanceMerge.js";

const pick = (ticker, cmp, currentPrice, returnPct) => ({ ticker, name: ticker, cmp, currentPrice, returnPct });
const snaps = [
  { date: "2026-09-27", picks: [pick("DPABHUSHAN", 1417.7, 2186, 54.2), pick("TIPS", 668.95, 717.05, 7.2), pick("KALYAN", 573, 512, -10.6)] },
  { date: "2026-09-30", picks: [pick("DPABHUSHAN", 1388.2, 2186, 57.5), pick("TIPS", 657.35, 717.05, 9.1), pick("KALYAN", 564, 512, -9.2)] },
  // KALYAN dropped out, TRENT came in
  { date: "2026-10-03", picks: [pick("DPABHUSHAN", 1500, 2186, 45.7), pick("TIPS", 690, 717.05, 3.9), pick("TRENT", 2626, 2727.5, 3.9)] },
];
const rows = mergePicks(snaps);

assert.equal(rows.length, 4, "each company once");
const dp = rows.find(r => r.ticker === "DPABHUSHAN");
assert.deepEqual([dp.firstDate, dp.entry, dp.now, dp.returnPct, dp.current], ["2026-09-27", 1417.7, 2186, 54.2, true], "first picked on its first snapshot, at that day's price and return");
const trent = rows.find(r => r.ticker === "TRENT");
assert.equal(trent.firstDate, "2026-10-03", "a later entrant: the day it joined");
const kalyan = rows.find(r => r.ticker === "KALYAN");
assert.deepEqual([kalyan.current, kalyan.leftOn, kalyan.returnPct], [false, "2026-10-03", -10.6], "one that dropped out: left on the first snapshot without it, its return still since it was first picked");
assert.deepEqual(rows.map(r => r.ticker), ["DPABHUSHAN", "TIPS", "TRENT", "KALYAN"], "still picked first, longest-held then best return; those that left last");

// a company that left and came back: one row, from its first day, still picked
const back = mergePicks([
  { date: "2026-09-01", picks: [pick("A", 100, 120, 20)] },
  { date: "2026-09-04", picks: [pick("B", 50, 55, 10)] },
  { date: "2026-09-07", picks: [pick("A", 105, 120, 14.3), pick("B", 52, 55, 5.8)] },
]);
assert.deepEqual(back.map(r => [r.ticker, r.firstDate, r.current]), [["A", "2026-09-01", true], ["B", "2026-09-04", true]]);

assert.deepEqual(mergePicks([]), []);
console.log("performanceMerge tests passed");
