// A company's name as a list card shows it (stockName.js): node src/stockName.test.js
import assert from "node:assert/strict";
import { cardName, niceName, initials, splitUnit } from "./stockName.js";

assert.equal(cardName("Indiamart Intermesh Limited"), "Indiamart Intermesh", "'Limited' is the same for every company");
assert.equal(cardName("Tata Consultancy Services Ltd."), "Tata Consultancy Services");
assert.equal(cardName("Saksoft Ltd"), "Saksoft");
assert.equal(cardName("The Federal Bank Limited"), "The Federal Bank");
assert.equal(cardName("Limited Brands India"), "Limited Brands India", "only at the end");
assert.equal(cardName("Infosys"), "Infosys");
assert.equal(cardName(""), "");
assert.equal(cardName(null), "");

// Names NSE has in capitals read as words; initials stay
assert.equal(niceName("SAGILITY LIMITED"), "Sagility");
assert.equal(niceName("BOSCH HOME COMFORT INDIA LIMITED"), "Bosch Home Comfort India");
assert.equal(niceName("ITC HOTELS LIMITED"), "ITC Hotels", "three letters: initials");
assert.equal(niceName("HDFC BANK LIMITED"), "HDFC Bank", "no vowel: initials");
assert.equal(niceName("HFCL Limited"), "HFCL", "no vowel: initials");
assert.equal(niceName("Pitti Engineering Limited"), "Pitti Engineering");
assert.equal(niceName("ITC Limited"), "ITC");
console.log("ok: names without the 'Limited' every company shares");

assert.equal(initials("Indiamart Intermesh Limited"), "II");
assert.equal(initials("Saksoft Limited"), "S");
assert.equal(initials("The Federal Bank Limited"), "FB", "'The' isn't the company's letter");
assert.equal(initials("BLS International Services Limited"), "BI", "two letters at most");
assert.equal(initials("3M India Limited"), "3I");
assert.equal(initials(""), "?");
console.log("ok: a company's letters for its tile when it has no logo");

// A card's measure: its unit set small, as "/100" is beside the scores, so
// "71.2%" fits a third of a phone's width (21 Oct 2026: it showed "71.…")
assert.deepEqual(splitUnit("71.2%"), ["71.2", "%"]);
assert.deepEqual(splitUnit("+12.3%"), ["+12.3", "%"]);
assert.deepEqual(splitUnit("−4.1%"), ["−4.1", "%"]);
assert.deepEqual(splitUnit("19.4x"), ["19.4", "x"]);
assert.deepEqual(splitUnit("7/9"), ["7", "/9"]);
assert.deepEqual(splitUnit("8/10"), ["8", "/10"]);
assert.deepEqual(splitUnit("147.1K"), ["147.1K", null], "a compact ₹ Cr figure keeps its letter");
assert.deepEqual(splitUnit("₹1,234"), ["₹1,234", null]);
assert.deepEqual(splitUnit("36.6 L"), ["36.6 L", null]);
assert.deepEqual(splitUnit("—"), ["—", null]);
assert.deepEqual(splitUnit(null), ["—", null]);
console.log("ok: a measure's unit set apart from its number");
