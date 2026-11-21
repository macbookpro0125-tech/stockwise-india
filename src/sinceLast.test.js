import assert from "node:assert/strict";
import { pickBaseline, sinceLast } from "./sinceLast.js";

const rows = [
  { symbol: "TCS", name: "Tata Consultancy Services", cmp: 3300, latestQuarterFiled: "2026-11-19", events: [] },
  { symbol: "INFY", name: "Infosys", cmp: 1100, latestQuarterFiled: "2026-10-16", events: [{ date: "2026-11-20", kind: "action", title: "Dividend - Rs 21 Per Share" }] },
  { symbol: "BEL", name: "Bharat Electronics", cmp: 402, latestQuarterFiled: "2026-10-30", events: [] },
];

// first visit: nothing to compare with; this visit kept
let r = pickBaseline(null, "2026-11-18", rows);
assert.equal(r.baseline, null);
assert.equal(r.next.current.prices.TCS, 3300);

// a later close: compared with the last visit
const saved = { current: { at: "2026-11-17", prices: { TCS: 3000, INFY: 1095, BEL: 420 } }, prev: null };
r = pickBaseline(saved, "2026-11-20", rows);
assert.equal(r.baseline.at, "2026-11-17");
const s = sinceLast(r.baseline, rows);
assert.equal(s.since, "2026-11-17");
assert.deepEqual(s.moves.map(m => [m.symbol, Math.round(m.pct)]), [["TCS", 10], ["BEL", -4]], "the big moves, biggest first; INFY's 0.5% left out");
assert.deepEqual(s.results.map(x => x.symbol), ["TCS"], "results filed after the last visit");
assert.deepEqual(s.actions.map(x => x.symbol), ["INFY"]);

// a reload the same day keeps the same comparison
r = pickBaseline(r.next, "2026-11-20", rows);
assert.equal(r.baseline.at, "2026-11-17", "same day: still since the 17th");

// the next close compares with the 20th
r = pickBaseline(r.next, "2026-11-23", rows);
assert.equal(r.baseline.at, "2026-11-20");
assert.deepEqual(sinceLast(r.baseline, rows).moves, [], "no change in price: nothing listed");
console.log("ok: since you were last here — moves, results and actions since the last visit, steady through the day");
