// Run: node src/aboutText.test.js
import assert from "node:assert/strict";
import { aboutParagraph } from "./aboutText.js";

const m = { sector: "Information Technology", industry: "Computers - Software", history: [{ fyEnd: "2026-03-31", revenueCr: 267000 }] };
assert.equal(
  aboutParagraph("TCS", m, { profile: { about: "The Company is a provider of IT consulting services and business solutions" }, filedBusiness: ["Banking, Financial Services and Insurance", "Manufacturing"] }),
  "TCS is a provider of IT consulting services and business solutions. Its businesses: Banking, Financial Services and Insurance and Manufacturing. Sales in the year to Mar 2026: ₹2,67,000 crore.");
console.log("ok: its own description, its businesses, its sales");

assert.equal(
  aboutParagraph("Micron Co", { sector: "Chemicals", industry: null, history: [] }, { profile: null, filedBusiness: ["MICRONIZED MINERALS"] }),
  "Micron Co is a company in the Chemicals sector. Its business: Micronized minerals.");
console.log("ok: no report: its sector and its filed business line, tidied");

assert.equal(aboutParagraph("X", { history: [{ revenueCr: 5 }] }, { profile: null, filedBusiness: [] }), null);
console.log("ok: nothing filed, nothing said");

assert.equal(
  aboutParagraph("Lemon Tree Hotels", { history: [{ fyEnd: "2026-03-31", revenueCr: 1445 }] }, { profile: { mainActivity: "Operating Hotels" }, filedBusiness: ["Hotel Business"] }),
  "Lemon Tree Hotels' main activity is operating hotels. Sales in the year to Mar 2026: ₹1,445 crore.");
console.log("ok: a phrase becomes a sentence, and a line that only repeats it is dropped");
