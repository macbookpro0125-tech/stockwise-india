// node --no-warnings server/order-amount-test.js — order sizes as companies
// wrote them in their NSE notices (wording from real filings, 19 Nov 2026)
import assert from "node:assert/strict";
import { orderAmount, lowestBidder } from "./order-amount.js";

const cr = t => orderAmount(t)?.cr ?? null;

assert.equal(cr("7. Broad consideration or size of the order (s) / contract (s); INR 419.47 Cr (including GST) 8. Whether the promoter"), 419.47);
assert.equal(cr("7. Broad consideration or size of the order (s) /contract (s); Rs. 91,77,77,777 /- (Rupees Ninety-One Crore"), 91.78);
assert.equal(cr("Size of Order : Rs.1,24,00,00,000.00 (Rupees One Hundred Twenty-Four Crore Only)"), 124);
assert.equal(cr("Broad consideration or size of the order(s)/contract(s) ₹ 18,50,99,684 – Eighteen Crore"), 18.51);
assert.equal(cr("Broad consideration or size of the order(s)/contract(s) Rs. 194.06 Million (including GST)"), 19.41);
assert.equal(cr("Broad consideration or size of the order(s)/contract(s) Rupees 46,57,56,276.62/- (Rupees Forty-Six Crore"), 46.58);
assert.equal(cr("broad consideration or size of the order(s)/contract(s) approximately ₹ 48 Crores (Rupees Forty-Eight Crores only)"), 48);
assert.equal(cr("Broad commercial consideration or size of the Order/Contract The order is valued at ₹ 65.38 crores (Incl. GST)."), 65.38);
// the total, not a part listed before it
assert.equal(cr("a) NMDC – Civil-related Sub-Works Approximate contract value: ₹ 25 Crores (exclusive of GST). g) broad consideration or size of the order(s)/contract(s) approximately ₹ 48 Crores"), 48);
console.log("ok: SEBI's 'size of the order' line, in rupees, crore, lakh and million");

// OCR garbage in the first mention, a clean one in the line
assert.equal(cr("a purchase order worth Rs.9,0z,io,oo-07- lRupees Nine Crore 5 Broad consideration order(s)/conhact(s) or size of the Work order worth Rs.90740000/- (Rupees Nine Crore"), 9.07);
// no line: the plain phrasing
assert.equal(cr("Sub.: Receipt of order of Rs. 707.80 crore for AL-59 conductors"), 707.8);
assert.equal(cr("has received a supply order for a value of approx. INR 35.62 crore (inclusive of taxes)"), 35.62);
console.log("ok: 'order of', 'for a value of' when the line is missing");

// a foreign-currency order stays in its currency
assert.deepEqual(orderAmount("size of the order (s) / contract (s) The total value for execution of the job scope is for approximately USD 10.77 million exclusive of GST"), { currency: "USD", mn: 10.77, from: "size" });
assert.deepEqual(orderAmount("broad consideration or size of the order(s)/contract(s) inclusive Tax; : USD 2,345,208 (USD Two Million"), { currency: "USD", mn: 2.35, from: "size" });
console.log("ok: a dollar order is kept in dollars");

// not an order's size
assert.equal(orderAmount("Size of the project – 150 MW Contracted Capacity, at a tariff of Rs. 3.21 per unit."), null);
assert.equal(orderAmount("order size excluding taxes is as per below: Regular Orders Major Orders Large Orders Below ₹ 50 crore"), null, "a table of thresholds isn't an order");
assert.equal(orderAmount("The Company has informed the Exchange about Bagging/Receiving of orders/contracts"), null);
assert.equal(orderAmount(""), null);
assert.equal(orderAmount("7. Broad consideration or size of the order(s): Not disclosed 8. Whether the promoter group has any interest: No. Turnover Rs. 500 crore"), null, "a figure past the item isn't its size");
console.log("ok: tariffs, thresholds and silence give no amount");

assert.ok(lowestBidder("declared as the Lowest Bidder (L-1) for the said Project"));
assert.ok(lowestBidder("L1 for National Highways Authority of India (NHAI) Project"));
assert.ok(!lowestBidder("Northern Railway has awarded an order of Rs. 2.79 crores"));
console.log("ok: a lowest bid is told apart from an award");

// the list: biggest rupee orders first, then dollar ones, then unstated;
// the share of market value from rupees only
import { ordersFrom } from "./market-news.js";
{
  const f = (id, symbol, mcap, time = "2026-11-19T10:00:00Z") => ({ id, symbol, company: symbol, title: "Bagging/Receiving of orders/contracts", time, quote: { name: symbol, marketCapCr: mcap } });
  const read = new Map([
    ["a", { amount: { cr: 100 } }], ["b", { amount: { cr: 1465 }, l1: true }],
    ["c", { amount: { currency: "USD", mn: 10.77 } }], ["d", { amount: null }], ["e", { failed: true }],
  ]);
  const list = ordersFrom([f("a", "A", 1000), f("b", "B", 2765), f("c", "C", 3896), f("d", "D", 500), f("e", "E", 100), f("x", "X", 50)], read);
  assert.deepEqual(list.map(i => i.symbol), ["B", "A", "C", "D", "E", "X"]);
  assert.equal(list[0].pctOfValue, 53);
  assert.equal(list[0].lowestBidder, true);
  assert.equal(list[2].pctOfValue, null, "no rupee figure, no share of value");
  assert.deepEqual(list.slice(3).map(i => i.status), ["none", "unread", "reading"]);
  console.log("ok: the list is biggest first, honest about what wasn't stated");
}
{
  const { orderDetails } = await import("./order-amount.js");
  const t = "Particulars Details 1. Name of the entity awarding the Order/Contract Ministry of Railways 2. Significant terms and conditions of the Order/ Contract awarded in brief Additional order 3. Whether awarded by domestic Domestic Entity 4. Nature of Order/Contract Manufacture and Supply of BOXNHL and BCNAHSM1Wagons. 5. Whether domestic or international Domestic";
  assert.deepEqual(orderDetails(t), { from: "Ministry of Railways", what: "Manufacture and Supply of BOXNHL and BCNAHSM1Wagons" });
  const d = "1. Name of the entity awarding the order(s) /contract(s); Gurugram Metro Rail Limited (GMRL). 2. Significant terms 4. Nature of order(s) / contract(s); “Construction of Depot cum Workshop for Elevated Corridor of Gurgaon Metro.”. 5. Whether domestic or international";
  assert.deepEqual(orderDetails(d), { from: "Gurugram Metro Rail Limited (GMRL)", what: "Construction of Depot cum Workshop for Elevated Corridor of Gurgaon Metro" });
  assert.deepEqual(orderDetails("Bagging of orders"), { from: null, what: null });
  const n = orderDetails("Name of the entity awarding the order(s) : Overseas entity situated in Ghana (the Customer’s name is withheld) (ii) Nature of order(s) Automated Credit Management Solution. (vi) Whether");
  assert.deepEqual(n, { from: "Overseas entity situated in Ghana (the Customer’s name is withheld)", what: "Automated Credit Management Solution" });
  assert.equal(orderDetails("1. Name of the entity awarding the order Awarded by -MSEDCL 2. Significant").from, "MSEDCL");
  assert.equal(orderAmount("7. Broad consideration or size of the order(s)/ contract(s) Cumulative Maximum Award Value of Rs. 28,00,00,000 (excl. all taxes) 8. Whether").wholeContract, undefined, "a contract's ceiling isn't an enlarged contract");
  assert.equal(orderDetails("4. Nature of order(s) / contract(s) , Significant terms & Conditions of order 5. Whether").what, null);
  assert.equal(orderDetails("d) Nature of order (s) / contract (s) Normal Course of Business e) Whether").what, null);
  console.log("ok: who gave the order and what it is for, as the notice says");
}
{
  const t = "an additional quantity of 4,955 BOXNHL wagons valued at INR 1716.90 crores plus GST, has been ordered on the Company on the same price. 7. Broad commercial consideration or size of the Order/Contract The total amended value of the Contract after the above increase in quantity is ₹ 10,404.10 Crores (inclusive of GST). 8. Whether the Promoter";
  const a = orderAmount(t);
  assert.equal(a.cr, 1716.9, "the added order, not the whole enlarged contract");
  assert.equal(a.wholeContract.cr, 10404.1);
  const only = orderAmount("7. Broad consideration or size of the order: The total amended value of the Contract after the above increase is Rs 500 crore 8. Whether");
  assert.equal(only.cr, 500);
  assert.equal(only.wholeContract, true, "said to be the whole contract when the added part isn't stated");
  console.log("ok: an enlarged contract gives the new order's amount, or says it's the whole contract");
}
process.exit(0);
