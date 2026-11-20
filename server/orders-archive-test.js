// Big orders day by day (orders-archive.js): which NSE notices are orders,
// which days are on offer, and an order kept once
import assert from "node:assert/strict";
import { orderNoticesOf, recentDays, dayOrders } from "./orders-archive.js";

const rows = [
  { seq_id: 101, symbol: "ABC", sm_name: "ABC Ltd", desc: "Bagging/Receiving of orders/contracts", sort_date: "2026-11-18 14:05:00", attchmntText: "ABC has received an order of Rs 120 crore", attchmntFile: "https://nsearchives.nseindia.com/corporate/ABC.pdf" },
  { seq_id: 102, symbol: "XYZ", sm_name: "XYZ Ltd", desc: "Outcome of Board Meeting", sort_date: "2026-11-18 15:00:00" },
  { seq_id: 103, symbol: "PQR", desc: "Bagging/Receiving of orders/contracts", sort_date: "2026-11-18 16:00:00", attchmntFile: "https://example.com/x.pdf" },
];
const n = orderNoticesOf(rows);
assert.deepEqual(n.map(o => o.id), ["nse-101", "nse-103"], "orders only, with the live feed's ids");
assert.equal(n[0].url, "https://nsearchives.nseindia.com/corporate/ABC.pdf");
assert.equal(n[1].url, null, "a link that isn't NSE's own is dropped");
assert.equal(n[1].company, "PQR", "no name: the symbol");
assert.deepEqual(orderNoticesOf(null), []);

const days = recentDays("2026-11-23", 6);
assert.deepEqual(days, ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-23"], "weekdays only, newest last");
assert.equal(recentDays("2026-11-22", 1)[0], "2026-11-20", "a Sunday: Friday");

const a = { orders: {
  "nse-1": { id: "nse-1", day: "2026-11-18", symbol: "ABC", time: "2026-11-18T08:00:00Z", amountCr: 120 },
  "nse-2": { id: "nse-2", day: "2026-11-18", symbol: "ABC", time: "2026-11-18T09:00:00Z", amountCr: 120 },
  "nse-3": { id: "nse-3", day: "2026-11-18", symbol: "ABC", time: "2026-11-18T10:00:00Z", amountCr: 45 },
  "nse-4": { id: "nse-4", day: "2026-11-19", symbol: "ABC", time: "2026-11-19T10:00:00Z", amountCr: 120 },
} };
assert.deepEqual(dayOrders(a, "2026-11-18").map(o => o.id), ["nse-1", "nse-3"], "the same order filed twice in a day is kept once");
assert.equal(dayOrders(a, "2026-11-19").length, 1, "the same size on another day is its own order");
console.log("ok: order notices, the days on offer, and each order once");
