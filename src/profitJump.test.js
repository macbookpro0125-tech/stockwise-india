// Why profit jumped (profitJump.js): only from the filed lines
import assert from "node:assert/strict";
import { isJump, profitBridge, headline, profitWords } from "./profitJump.js";

// a loss of ₹10 cr turned into ₹55 cr: sales up, margin up, plus a one-off gain
const then = { revenueCr: 200, operatingProfitCr: 10, opm: 5, otherIncomeCr: 2, financeCostsCr: 8, depreciationCr: 6, exceptionalCr: null, pbtCr: -2, taxCr: 8, profitCr: -10 };
const now = { revenueCr: 300, operatingProfitCr: 60, opm: 20, otherIncomeCr: 4, financeCostsCr: 7, depreciationCr: 7, exceptionalCr: 20, pbtCr: 70, taxCr: 15, profitCr: 55 };
assert.ok(isJump(now, then));
const b = profitBridge(now, then);
assert.equal(b.change, 65);
const by = Object.fromEntries(b.parts.map(p => [p.key, p.cr]));
assert.deepEqual(by, { business: 50, exceptional: 20, tax: -7, otherIncome: 2, interest: 1, depreciation: -1 });
assert.equal(b.parts.reduce((s, p) => s + p.cr, 0), 65, "the parts add up to the change");
assert.equal(headline(b), "Mostly from the business itself (sales up 50%, operating margin up from 5.0% to 20.0%).");
assert.match(b.parts.find(p => p.key === "exceptional").note, /one-off gain of ₹20 cr in this period/);
assert.equal(profitWords(-10), "a loss of ₹10 cr");
console.log("ok: a loss turned to profit, split into its lines");

// a jump from a one-off; what the lines don't cover is "other lines"
const b2 = profitBridge({ ...then, profitCr: 100, pbtCr: 108, exceptionalCr: 110, taxCr: 8 }, { ...then, profitCr: 5, pbtCr: 13, taxCr: 8 });
assert.equal(b2.main.key, "exceptional");
assert.match(headline(b2), /^Mostly from a one-off/);
// profit up with no line before tax to show it: lines after tax
const b3 = profitBridge({ ...then, profitCr: 30 }, { ...then, profitCr: 10 });
assert.equal(b3.main.key, "afterTax");
// pre-tax profit up with no line to show it (an exceptional item the filing has but we don't), tax not filed
const b4 = profitBridge({ ...then, pbtCr: 120, taxCr: null, profitCr: 100 }, { ...then, taxCr: null, pbtCr: -2, profitCr: -10 });
assert.deepEqual(Object.fromEntries(b4.parts.map(p => [p.key, p.cr])), { other: 122, afterTax: -12 });
assert.match(headline(b4), /results filing shows them/);
console.log("ok: a one-off, and lines not split out");

// not a jump: small moves, or missing figures
assert.equal(isJump({ profitCr: 110 }, { profitCr: 100 }), false);
assert.equal(isJump({ profitCr: 0.6 }, { profitCr: 0.1 }), false, "under ₹1 cr");
assert.equal(isJump({ profitCr: null }, { profitCr: 5 }), false);
assert.equal(profitBridge({ profitCr: 110 }, { profitCr: 100 }), null);
assert.ok(isJump({ profitCr: 40 }, { profitCr: 100 }), "down 60%");
console.log("ok: ordinary quarters aren't explained");

// a bank: the lending business, other income, tax
const bank = profitBridge({ profitCr: 300, pbtCr: 400, otherIncomeCr: 150, taxCr: 100 }, { profitCr: 150, pbtCr: 200, otherIncomeCr: 100, taxCr: 50 }, { lender: true });
assert.deepEqual(Object.fromEntries(bank.parts.map(p => [p.key, p.cr])), { business: 150, otherIncome: 50, tax: -50 });
assert.match(headline(bank), /lending business/);
console.log("ok: a bank's jump");
