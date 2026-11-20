// node --no-warnings server/company-bonds-test.js — a company's bonds on NSE (company-bonds.js)
import assert from "node:assert/strict";
import { issuerOf, bondRow, mergeBonds, govYieldAt, isoOf } from "./company-bonds.js";

assert.equal(issuerOf("INE031A07840"), "031A", "HUDCO's bond");
assert.equal(issuerOf("INE031A01017"), "031A", "HUDCO's shares: the same issuer");
assert.equal(issuerOf("bad"), null);
assert.equal(isoOf("05-Mar-2027"), "2027-03-05");
const row = { isin: "INE031A07840", symbol: "82HUDCO27", series: "N2", coupr: "8.2", face_value: "1000", ltP: "1060.01", maturity_date: "05-Mar-2027", nxtip_date: "-", per: "0", trdValcsv: 14072929.78, credit_rating: null, rating_agency: null };
const b = bondRow(row, "2026-11-20");
assert.deepEqual([b.coupon, b.face, b.price, b.maturity, b.nextInterest, b.rating], [8.2, 1000, 1060.01, "2027-03-05", null, null]);
assert.ok(Math.abs(b.valueCr - 1.407) < 0.001);
console.log("ok: NSE's bond row, matched to its company by the ISIN");

// kept until it matures; a quiet day doesn't drop it; today's trade replaces the old
let kept = mergeBonds({}, [row], "2026-11-19");
kept = mergeBonds(kept, [], "2026-11-20");
assert.ok(kept.INE031A07840, "kept on a day it didn't trade");
kept = mergeBonds(kept, [{ ...row, ltP: "1061" }], "2026-11-21");
assert.equal(kept.INE031A07840.price, 1061);
assert.equal(kept.INE031A07840.traded, "2026-11-21");
assert.deepEqual(mergeBonds(kept, [], "2027-03-06", "2027-03-06"), {}, "gone once it matures");
console.log("ok: bonds kept until they mature");

const curve = { points: [{ years: 0.25, yield: 5.86 }, { years: 3, yield: 6.9 }, { years: 10, yield: 7.26 }, { years: 30, yield: 7.74 }] };
assert.equal(govYieldAt(curve, 0.1), 5.86);
assert.ok(Math.abs(govYieldAt(curve, 6.5) - 7.08) < 0.001, "halfway between 3 and 10 years");
assert.equal(govYieldAt(curve, 40), 7.74);
assert.equal(govYieldAt(null, 5), null);
console.log("ok: the government's yield for as long a loan");
