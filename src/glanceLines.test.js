// The "At a glance" card's picks (glanceLines.js): node src/glanceLines.test.js
import assert from "node:assert/strict";
import { pickLines } from "./glanceLines.js";

const item = (id, score, reason) => ({ id, label: id, score, reason });
const group = (id, score, items, applicable = true) => ({ id, label: `${id} group`, score, applicable, items });
const research = (groups, flags = []) => ({ groups, flags });

{
  // One line per group, strongest groups first, at most three
  const r = research([
    group("business", 90, [item("roce", 80, "ROCE 30% — strong."), item("margin", 100, "Margins steady — strong.")]),
    group("earnings", 95, [item("cash", 76, "Cash backs profit — strong.")]),
    group("balance", 70, [item("debt", 90, "Little debt — strong.")]),
    group("growth", 99, [item("sales", 60, "Sales grew 9% — fair.")]),
    group("governance", 60, [item("pledge", 100, "No pledges — strong.")]),
  ]);
  const { strengths } = pickLines(r);
  assert.deepEqual(strengths.map(s => s.key), ["earnings-cash", "business-margin", "balance-debt"]);
  assert.equal(strengths[1].text, "Margins steady.", "the verdict word is dropped");
  assert.equal(strengths[1].target, "why-business");
  console.log("ok: the best line of each of the three strongest groups, verdict dropped");
}
{
  // Flags first (critical on top), then the weakest line under fair per group
  const r = research([
    group("growth", 40, [item("eps", 30, "EPS fell 3% a year — weak."), item("sales", 45, "Sales grew 2% — weak.")]),
    group("balance", 20, [item("debt", 10, "Debt is 4x equity — poor.")]),
    group("valuation", 55, [item("pe", 50, "P/E near its usual — fair.")]),
  ], [
    { id: "late", severity: "caution", text: "Results came in late. More detail here." },
    { id: "audit", severity: "critical", text: "The auditor qualified the accounts. Read the statement." },
  ]);
  const { strengths, watch } = pickLines(r);
  assert.equal(strengths.length, 0);
  assert.deepEqual(watch.map(w => w.key), ["flag-audit", "flag-late", "balance-debt"]);
  assert.equal(watch[0].text, "The auditor qualified the accounts.", "a flag shows its first sentence");
  assert.equal(watch[0].tone, "bad");
  assert.equal(watch[2].text, "Debt is 4x equity.");
  console.log("ok: flags first, critical on top, then the weakest checks; three at most");
}
{
  // Groups that don't apply, and checks without data, are left out
  const r = research([
    group("business", 100, [item("roa", 100, "ROA 2% — strong.")], false),
    group("earnings", null, [item("cash", null, null)]),
  ]);
  assert.deepEqual(pickLines(r), { strengths: [], watch: [] });
  console.log("ok: nothing from groups that don't apply or checks without data");
}
