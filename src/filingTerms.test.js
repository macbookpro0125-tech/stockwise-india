// The plain-English notes on an announcement (filingTerms.js)
import assert from "node:assert/strict";
import { explainFiling, explainHeadline, newsTone } from "./filingTerms.js";

const names = r => r.terms.map(t => t.term);

// The one the owner couldn't follow (Raymond Realty, 23 Oct 2026)
const raymond = explainFiling({ kind: "deals", title: "General Updates", summary: "In-principle approval from BSE and NSE of Preferential Issue of convertible warrants on a private placement basis." });
assert.deepEqual(names(raymond), ["In-principle approval", "Preferential issue", "Convertible warrants", "Private placement"]);
assert.match(raymond.kind, /order, contract/);

// a subsidiary set up: the narrower term, not both
assert.deepEqual(names(explainFiling({ kind: "updates", title: "General Updates", summary: "Intimation of incorporation of subsidiary companies." })), ["Incorporation of a subsidiary"]);

// face value, dividend and record date
assert.deepEqual(names(explainFiling({ kind: "dividends", title: "Dividend", summary: "Interim dividend of Rs 5 per share of face value Rs 10; record date 30 Oct." })), ["Record date", "Interim dividend", "Face value"]);

// "order" only as work won, not "in order to" or a court's order
assert.deepEqual(names(explainFiling({ title: "Updates", summary: "In order to comply with the court order dated 1 Oct." })), []);
assert.deepEqual(names(explainFiling({ title: "Bagging/Receiving of orders/contracts", summary: "The company has received a large order worth Rs 400 crore." })), ["Order"]);
assert.deepEqual(names(explainFiling({ summary: "This is to define the scope." })), []);

// at most five, and nothing for an unknown kind
assert.ok(explainFiling({ summary: "preferential issue warrants private placement QIP rights issue bonus buyback record date dividend" }).terms.length <= 5);
assert.equal(explainFiling({ kind: "nope" }).kind, null);
// a headline's market words
assert.deepEqual(explainHeadline("Equity market valuations reset as earnings momentum builds: Report").map(t => t.term), ["Valuation", "Earnings"]);
assert.deepEqual(explainHeadline("Sensex falls as FIIs sell and crude surges").map(t => t.term), ["FIIs / FPIs", "Sensex and Nifty", "Crude oil"]);
assert.deepEqual(explainHeadline("Phone launch next week"), []);
// good or bad news, as such news is usually read
const tone = x => newsTone(x).tone;
assert.equal(tone({ kind: "legal", title: "Action(s) taken or orders passed", summary: "Orders passed." }), "unclear"); // Waaree, 2 Nov 2026
assert.equal(tone({ kind: "legal", title: "Credit Rating", summary: "ICRA has downgraded the long-term rating." }), "bad");
assert.equal(tone({ kind: "legal", title: "Credit Rating", summary: "CRISIL has reaffirmed the rating." }), "routine");
assert.equal(tone({ kind: "legal", title: "Credit Rating", summary: "CARE upgraded the rating to AA+." }), "good");
assert.equal(tone({ kind: "legal", summary: "GST demand order with penalty of Rs 2 crore." }), "bad");
assert.equal(tone({ kind: "legal", summary: "The Tribunal ruled in favour of the company and quashed the demand." }), "good");
assert.equal(tone({ kind: "deals", title: "Bagging/Receiving of orders/contracts", summary: "The company has received an order worth Rs 400 crore." }), "good");
assert.equal(tone({ kind: "deals", summary: "Preferential issue of convertible warrants." }), "mixed");
assert.equal(tone({ kind: "people", summary: "Resignation of statutory auditor." }), "bad");
assert.equal(tone({ kind: "people", summary: "Appointment of a director." }), "routine");
assert.equal(tone({ kind: "dividends", summary: "Bonus issue 1:1." }), "routine");
assert.equal(tone({ kind: "results", numbers: { profitCr: 120, profitYoY: 22, salesYoY: 9 } }), "good");
assert.match(newsTone({ kind: "results", numbers: { profitCr: 120, profitYoY: 22, salesYoY: 9 } }).why, /^Profit up 22%, sales up 9%/);
assert.equal(tone({ kind: "results", numbers: { profitCr: 80, profitYoY: -30, salesYoY: -2 } }), "bad");
assert.equal(tone({ kind: "results", numbers: { profitCr: -5, profitYoY: null, salesYoY: 4 } }), "bad");
assert.equal(tone({ kind: "results", numbers: { profitCr: 50, profitYoY: 15, salesYoY: -12 } }), "mixed");
assert.equal(tone({ kind: "results", numbers: null }), "waiting");
console.log("filingTerms tests passed");
