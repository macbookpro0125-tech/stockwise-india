// Insider and promoter trades (insiders.js): node server/insiders-test.js
import assert from "node:assert/strict";
import { summarizeInsiders } from "./insiders.js";

// Rows shaped like NSE's insider-trading (PIT) disclosures
const row = o => ({ acqName: "X", personCategory: "-", tdpTransactionType: "-", acqMode: "-", secType: "Equity Shares", secAcq: "0", secVal: "0", acqfromDt: "01-Jan-2026", acqtoDt: "01-Jan-2026", afterAcqSharesPer: "0", date: "02-Jan-2026 10:00", ...o });
const rows = [
  row({ acqName: "Promoter Holdco", personCategory: "Promoter Group", tdpTransactionType: "Buy", acqMode: "Market Purchase", secAcq: "336000", secVal: "119729027", acqtoDt: "28-Sep-2026", afterAcqSharesPer: "0.35" }),
  row({ acqName: "Promoter Holdco", personCategory: "Promoter Group", tdpTransactionType: "Buy", acqMode: "Market Purchase", secAcq: "1000", secVal: "356000", acqtoDt: "29-Sep-2026" }),
  row({ acqName: "A Director", personCategory: "Director", tdpTransactionType: "Sell", acqMode: "Market Sale", secAcq: "5000", secVal: "6000000", acqtoDt: "10-Aug-2026" }),
  row({ acqName: "Spouse", personCategory: "Immediate relative", tdpTransactionType: "Sell", acqMode: "Market Sale", secAcq: "200", secVal: "240000", acqtoDt: "12-Aug-2026" }),
  row({ acqName: "Employee", personCategory: "Designated Employees", tdpTransactionType: "Buy", acqMode: "ESOP", secAcq: "300", secVal: "30000", acqtoDt: "01-Jul-2026" }),
  row({ acqName: "Relative", personCategory: "Immediate relative", tdpTransactionType: "Buy", acqMode: "Gift", secAcq: "40000", secVal: "8778000", acqtoDt: "14-Jun-2026" }),
  row({ acqName: "Trust", personCategory: "Other", tdpTransactionType: "Sell", acqMode: "Market Sale", secType: "ADR/GDR/FCCB", secAcq: "25", secVal: "31743", acqtoDt: "27-Mar-2026" }),
  row({ acqName: "Old", personCategory: "Promoters", tdpTransactionType: "Sell", acqMode: "Market Sale", secAcq: "9", secVal: "9", acqtoDt: "01-Jan-2025" }),
];

const s = summarizeInsiders(rows, "2026-10-20");
{
  const promoters = s.groups.find(g => g.id === "promoters");
  assert.deepEqual(promoters.bought, { value: 119729027 + 356000, shares: 337000, trades: 2 });
  assert.deepEqual(promoters.sold, { value: 0, shares: 0, trades: 0 }, "the 2025 sale is outside the 12 months");
  const insiders = s.groups.find(g => g.id === "insiders");
  assert.deepEqual(insiders.sold, { value: 6240000, shares: 5200, trades: 2 }, "a director and a director's relative");
  assert.equal(insiders.bought.trades, 0, "an option exercise and a gift aren't market buying");
  console.log("ok: market purchases and sales of shares, by promoters and by directors, officers and relatives");
}
{
  assert.deepEqual(s.otherMoves, { "ESOP": 1, "Gift": 1 }, "other moves counted, not called buying or selling");
  assert.equal(s.recent[0].name, "Promoter Holdco");
  assert.equal(s.recent[0].date, "2026-09-29");
  assert.deepEqual(s.recent.map(r => r.side), ["buy", "buy", "sell", "sell"], "market trades, newest first, ADRs left out");
  assert.equal(s.recent[1].holdingAfter, 0.35);
  assert.equal(s.from, "2025-10-21");
  console.log("ok: the latest market trades, newest first; ADRs and old trades left out");
}
assert.deepEqual(summarizeInsiders([], "2026-10-20").recent, []);
assert.equal(summarizeInsiders(null, "2026-10-20"), null, "nothing read from NSE: unknown, not 'no trades'");
console.log("ok: no disclosures is none; nothing read is unknown");
