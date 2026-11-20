// node --no-warnings server/older-results-test.js — yearly results from NSE's
// older results pages (older-results.js), only where the page agrees with itself
import assert from "node:assert/strict";
import { parseOldResults, saneOldYear } from "./older-results.js";

const page = (unit, lines) => `<html><body><table><tr><td>Description</td><td>Amount(${unit})</td></tr>${lines.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join("")}<tr><td>Segment Revenue</td><td></td></tr><tr><td>Others</td><td>1.00</td></tr></table></body></html>`;

// TCS FY2017 as NSE's page has it (in lakhs), its typed-in mistakes included
const tcs = page("Rs. in lakhs", [
  ["(a) Net sales/income from operations (Inclusive of excise duty)", "11796600.00"], ["(b) Other operating income", "0.00"],
  ["Total income from operations (net) ( a + b)", "11796600.00"], ["(d) Employee benefits expense", "6162100.00"],
  ["(f) Finance costs", "815600.00"], ["Total expenses", "8764200.00"],
  ["Profit / (Loss) from ordinary activities before tax", "3451300.00"], ["Tax expense", "815600.00"],
  ["Net Profit / (Loss) for the period", "2635700.00"], ["Consolidated Net Profit/Loss for the period", "2635700.00"],
  ["Basic EPS for continuing operations", "133.41"],
]);
const t = parseOldResults(tcs);
assert.equal(t.revenue / 1e7, 117966, "sales ₹1,17,966 cr");
assert.equal(t.profit / 1e7, 26357);
assert.equal(t.eps, 133.41);
assert.ok(saneOldYear(t), "before tax − tax = net profit: kept");
console.log("ok: a company's sales and profit, in lakhs, from its older page");

// a bank: its sales are total income, as the newer filings count them
const bank = page("Rs. in lakhs", [
  ["Interest Earned", "7327136.00"], ["Other Income", "1287763.00"], ["Total Income", "8614899.00"], ["Interest Expended", "3804158.00"],
  ["Operating Expenses", "2075107.00"], ["Profit(+) / Loss(-) from Ordinary Activities before tax", "2336553.00"], ["Tax Expense", "807812.00"],
  ["Net Profit (+) / Loss (-) for the period", "1528741.00"], ["Consolidated Net Profit (+) / Loss (-) for the period", "1525303.00"],
  ["Basic EPS after Extraordinary items (in Rs.)", "60.00"],
]);
const b = parseOldResults(bank, { bank: true });
assert.equal(b.revenue / 1e7, 86148.99);
assert.equal(b.profitOwners / 1e7, 15253.03);
assert.ok(saneOldYear(b));
console.log("ok: a bank's total income and profit");

// a page whose own sums don't agree is left out
const off = parseOldResults(page("Rs. in lakhs", [
  ["Total income from operations (net)", "1000.00"], ["Total expenses", "800.00"], ["Profit / (Loss) from ordinary activities before tax", "200.00"],
  ["Tax expense", "50.00"], ["Net Profit / (Loss) for the period", "90.00"], ["a", "1"], ["b", "2"], ["c", "3"],
]));
assert.equal(saneOldYear(off), false, "200 − 50 isn't 90");
// a page with no unit, or not a results page, gives nothing
assert.equal(parseOldResults("<html>The file you are trying to access doesn't appear to exist.</html>"), null);
assert.equal(parseOldResults(page("", [["Total income from operations (net)", "10"]])), null);
// crore and thousand pages
assert.equal(parseOldResults(page("Rs. in Crores", [["Total income from operations (net)", "500"], ["x", "1"], ["y", "1"], ["z", "1"], ["w", "1"], ["v", "1"], ["u", "1"], ["Net Profit / (Loss) for the period", "50"]])).revenue, 500e7);
console.log("ok: a page that disagrees with itself, or isn't one, gives no year");
