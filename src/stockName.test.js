// A company's name as a list card shows it (stockName.js): node src/stockName.test.js
import assert from "node:assert/strict";
import { cardName, initials } from "./stockName.js";

assert.equal(cardName("Indiamart Intermesh Limited"), "Indiamart Intermesh", "'Limited' is the same for every company");
assert.equal(cardName("Tata Consultancy Services Ltd."), "Tata Consultancy Services");
assert.equal(cardName("Saksoft Ltd"), "Saksoft");
assert.equal(cardName("The Federal Bank Limited"), "The Federal Bank");
assert.equal(cardName("Limited Brands India"), "Limited Brands India", "only at the end");
assert.equal(cardName("Infosys"), "Infosys");
assert.equal(cardName(""), "");
assert.equal(cardName(null), "");
console.log("ok: names without the 'Limited' every company shares");

assert.equal(initials("Indiamart Intermesh Limited"), "II");
assert.equal(initials("Saksoft Limited"), "S");
assert.equal(initials("The Federal Bank Limited"), "FB", "'The' isn't the company's letter");
assert.equal(initials("BLS International Services Limited"), "BI", "two letters at most");
assert.equal(initials("3M India Limited"), "3I");
assert.equal(initials(""), "?");
console.log("ok: a company's letters for its tile when it has no logo");
