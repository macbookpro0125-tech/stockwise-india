// newsPlain.js against filings as NSE words them (6 Nov 2026)
import assert from "node:assert/strict";
import { plainNews, amountIn } from "./newsPlain.js";

const f = (title, summary, extra = {}) => plainNews({ type: "filing", kind: extra.kind ?? "updates", title, summary, ...extra });
const is = (r, line, weight) => { assert.equal(r.line, line); if (weight) assert.equal(r.weight, weight, line); };

is(f("Bagging/Receiving of orders/contracts", "Receipt of Orders worth Rs. 428.55 Crores in aggregate (incl. taxes) from Ultratech Cement Ltd", { kind: "deals" }), "Won orders worth ₹428.55 crore", "big");
is(f("Bagging/Receiving of orders/contracts", "", { kind: "deals" }), "Won a new order or contract", "normal");
// an order book is not an order won
assert.ok(!/^Won/.test(f("Press Release", "Data Patterns Announces Q2 & H1 FY27 Results. Order Book Surges to ₹2,697.83 Crore").line));
is(f("Dividend", "Board of Directors at its meeting held on November 06, 2026, declared Interim Dividend of Rs. 14.40 per equity share.", { kind: "dividends" }), "Declared an interim dividend of ₹14.4 a share", "big");
is(f("Record Date", "Record date for the purpose of Dividend is 13-Nov-2026.", { kind: "dividends" }), "Record date 13 Nov: own the shares by then to get the dividend");
is(f("Stock split", "The Board of Directors has considered and approved subdivision of 1 equity shares of Rs. 10 each into 5 equity shares of Rs. 2 each", { kind: "dividends" }), "Splitting each share into 5", "big");
is(f("Bonus", "approved bonus at the ratio of 442441500 : 147480500"), "Bonus shares: 3 free for every 1 held", "big");
is(f("Appointment", "Appointment of Mr Satish Kumar Kaushik as Chief Financial Officer of the company w.e.f. November 06, 2026.", { kind: "people" }), "New CFO: Mr Satish Kumar Kaushik", "big");
// a new CFO named beside the one who left is news of the new one
is(plainNews({ type: "filing", kind: "people", title: "Appointment", summary: "Appointment of Mr. Vishal Begwani as Chief Financial Officer of the company w.e.f. November 06, 2026.", also: [{ title: "Resignation", summary: "Resignation of Mr. Nilesh Hirapara as Chief Financial Officer" }] }), "New CFO: Mr. Vishal Begwani", "big");
is(f("Press Release", "Wipro Appoints Angan Guha as President and Chief Executive Officer forAmericas 2 Strategic Market Unit"), "New head of a business unit or subsidiary: Angan Guha", "normal");
is(f("Cessation", "Cessation of Mr Inderjeet as Non- Executive Director of the company w.e.f. November 06, 2026.", { kind: "people" }), "A director left the board", "minor");
is(f("Updates", "Announcement under Regulation 30(9) of SEBI LODR Regulations 2015"), "Routine notice filed with NSE", "minor");
is(f("Updates", "Submission of Half-Yearly Report for FY2027."), "Routine paperwork filed with NSE", "minor");
is(f("Corporate Insolvency Resolution Process", "Corporate Insolvency Resolution Process-Intimation of the Meeting of the Committee of Creditors"), "Under insolvency proceedings: an update on the process", "big");
is(f("Press Release", "Further to our letter dated October 23, 2026, we wish to inform you that the Company took delivery of a Very Large Gas Carrier", { kind: "results" }), "Took delivery of a Very Large Gas Carrier");
is(f("Outcome of Board Meeting", "Unaudited financial results for the quarter and half year ended September 30, 2026.", { kind: "results" }), "Announced its Q2 FY27 results");
is(f("General Updates", "Meeting of the Board of Directors of the Company is scheduled on 13/11/2026 ,inter alia, to consider and approve Un-Audited Financial Results"), "Board meets on 13 Nov to approve its results");
// figures from the results, never from the words
is(plainNews({ type: "filing", kind: "results", title: "Outcome of Board Meeting", summary: "", numbers: { quarter: "2026-09-30", profitCr: 1540.37, profitYoY: 19.6, salesCr: 7327.7, salesYoY: 26.5 } }), "Q2 FY27 results: profit up 20% to ₹1,540 cr, sales up 27%", "big");
is(plainNews({ type: "filing", kind: "results", title: "x", summary: "", numbers: { quarter: "2026-09-30", profitCr: -50, profitYoY: null, salesCr: 100, salesYoY: -3 } }), "Q2 FY27 results: a loss of ₹50 cr, sales down 3%", "big");
assert.equal(plainNews({ type: "headline", title: "x" }), null);
assert.deepEqual(amountIn("worth INR 1,450 Crore"), { value: 1450, unit: "crore", text: "₹1,450 crore" });
assert.equal(amountIn("No money here"), null);
console.log("ok: news in plain words");
