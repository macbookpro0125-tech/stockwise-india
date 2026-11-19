// node --no-warnings src/position-plan-test.js
import assert from "node:assert/strict";
import { planPosition } from "./positionPlan.js";

{
  // three levels, equal parts, stop below all
  const { result, stopAbove } = planPosition({ capital: 90000, levels: { p1: 100, p2: 90, p3: 80, stopLoss: 70 }, split: ["1", "1", "1"] });
  assert.deepEqual(result.tranches.map(r => [r.level, r.shares]), [[1, 300], [2, 333], [3, 375]]);
  assert.equal(result.lossAtStop, 300 * 30 + 333 * 20 + 375 * 10);
  assert.deepEqual(stopAbove, []);
  console.log("ok: three levels split equally");
}
{
  // level 2 missing: level 3 keeps its own number and its own part
  const { result } = planPosition({ capital: 100000, levels: { p1: 100, p3: 80, stopLoss: 70 }, split: ["50", "0", "50"] });
  assert.deepEqual(result.tranches.map(r => r.level), [1, 3]);
  assert.equal(result.tranches[1].budget, 50000, "level 3 gets level 3's part, not level 2's");
  console.log("ok: a missing level doesn't shift the others");
}
{
  // a stop above a level is flagged, not counted as no loss
  const { stopAbove } = planPosition({ capital: 100000, levels: { p1: 100, p2: 90, p3: 80, stopLoss: 85 }, split: ["1", "1", "1"] });
  assert.deepEqual(stopAbove, [3]);
  console.log("ok: a stop above a level is flagged");
}
{
  // the loss limit shrinks every level and is never exceeded after rounding
  const { result } = planPosition({ capital: 300000, maxLoss: 5000, levels: { p1: 100, p2: 90, p3: 80, stopLoss: 70 }, split: ["1", "1", "1"] });
  assert.ok(result.scaled);
  assert.ok(result.lossAtStop <= 5000);
  assert.equal(result.reserve, 300000 - result.invested);
  console.log("ok: the loss limit is kept");
}
{
  // a share dearer than its level's cash is flagged
  const { result } = planPosition({ capital: 3000, levels: { p1: 2500, p2: 2000, stopLoss: 1500 }, split: ["1", "1", "1"] });
  assert.deepEqual(result.tooSmall, [1, 2]);
  console.log("ok: a level too small for one share is flagged");
}
