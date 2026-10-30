// The filter board's ready ranges (filterBoard.js)
import assert from "node:assert/strict";
import { BOARD_GROUPS, choiceOf, setChoice, setValues, matchesFind, filterWords } from "./filterBoard.js";

const item = id => BOARD_GROUPS.flatMap(g => g.items).find(i => i.id === id);
const pe = item("pe");
assert.equal(choiceOf(pe, { id: "pe", min: null, max: 20 }), "2", "a range that is a choice shows as it");
assert.equal(choiceOf(pe, { id: "pe", min: 12, max: 18 }), "custom", "a slider's own range is Custom");
assert.equal(choiceOf(pe, undefined), "");
let f = setChoice([], pe, "4");
assert.deepEqual(f, [{ id: "pe", min: null, max: 40 }]);
f = setChoice(f, pe, "5");
assert.deepEqual(f, [{ id: "pe", min: 40, max: null }], "a new choice replaces the old");
assert.deepEqual(setChoice(f, pe, ""), [], "Any removes it");
assert.deepEqual(setValues([{ id: "pe", min: 1, max: 2 }], "theme", ["Defence"]), [{ id: "pe", min: 1, max: 2 }, { id: "theme", values: ["Defence"] }]);
assert.deepEqual(setValues([{ id: "theme", values: ["Defence"] }], "theme", []), []);
assert.ok(matchesFind(item("pledgedPct"), "pledg") && !matchesFind(item("pe"), "pledg") && matchesFind(item("rsi14"), "RSI"));
assert.equal(filterWords({ label: "P/E", short: "P/E TTM/FY", unit: "x" }, { id: "pe", min: null, max: 40 }), "P/E: Under 40");
assert.equal(filterWords({ label: "P/E", short: "P/E TTM/FY", unit: "x" }, { id: "pe", min: 12, max: 18 }), "P/E TTM/FY 12× to 18×");
assert.equal(filterWords({ label: "Theme" }, { id: "theme", values: ["Defence"] }), "Theme: Defence");
for (const it of BOARD_GROUPS.flatMap(g => g.items).filter(i => i.choices)) for (const [label, min, max] of it.choices) assert.ok(label && (min != null || max != null), `${it.id}: ${label} sets a bound`);
console.log("filterBoard tests passed");
