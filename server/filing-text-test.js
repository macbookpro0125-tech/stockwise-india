// Cleaning text read from a filing's PDF (filing-summary.js cleanText):
// node server/filing-text-test.js
import assert from "node:assert/strict";
import { cleanText } from "./filing-summary.js";

assert.equal(cleanText("demand in compliance, clinical  Communications"), "demand in compliance, clinical • Communications", "a symbol-font bullet becomes a bullet");
assert.equal(cleanText("eﬀort, ﬁnance, ﬂow, eﬃcient"), "effort, finance, flow, efficient", "ligature characters become their letters");
assert.equal(cleanText("₹3,785 Cr — 24%"), "₹3,785 Cr — 24%", "the rupee sign and dashes stay");
console.log("ok: bullets and ligatures from PDFs are made readable; the rest is left as filed");
