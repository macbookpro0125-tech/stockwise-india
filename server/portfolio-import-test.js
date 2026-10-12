// Broker files to holdings (portfolio-import.js): each row matched to a
// listed company by symbol, ISIN or name, and what can't be added says why.
import assert from "node:assert/strict";
import { resolveImportRows, numberOf } from "./portfolio-import.js";

const list = [
  { symbol: "TCS", name: "Tata Consultancy Services Limited", isin: "INE467B01029" },
  { symbol: "INFY", name: "Infosys Limited", isin: "INE009A01021" },
  { symbol: "M&M", name: "Mahindra & Mahindra Limited", isin: "INE101A01026" },
  { symbol: "HDFCBANK", name: "HDFC Bank Limited", isin: "INE040A01034" },
];

assert.equal(numberOf("1,234.50"), 1234.5);
assert.equal(numberOf("₹ 950"), 950);
assert.equal(numberOf("—"), null);
console.log("ok: numbers as brokers write them (commas, ₹)");

const rows = resolveImportRows([
  { symbol: "TCS", qty: "10", avgPrice: "2,950.40" },             // Zerodha / Kite: symbol
  { symbol: "INFY-EQ", qty: 5, avgPrice: 1500 },                    // a series suffix
  { name: "Mahindra and Mahindra Ltd", isin: "", qty: 3, avgPrice: 2800 }, // name only
  { name: "HDFC BANK LTD", isin: "INE040A01034", qty: 20, avgPrice: 1600 }, // Groww: name + ISIN
  { symbol: "TCS", qty: 1, avgPrice: 3000 },                        // twice in the file
  { symbol: "GOLDBEES", qty: 4, avgPrice: 60 },                     // not in the list
  { symbol: "INFY", qty: 0, avgPrice: 1500 },                       // no quantity
], list, new Set(["HDFCBANK"]));
assert.deepEqual(rows.map(r => [r.symbol ?? null, r.status]), [
  ["TCS", "ok"], ["INFY", "ok"], ["M&M", "ok"], ["HDFCBANK", "held"], ["TCS", "duplicate"], [null, "unknown"], ["INFY", "invalid"],
]);
assert.equal(rows[0].avgPrice, 2950.4);
console.log("ok: matched by symbol, by symbol with a series suffix, by name, by ISIN; held, repeated, unknown and empty rows say so");
console.log("All portfolio-import checks passed.");
