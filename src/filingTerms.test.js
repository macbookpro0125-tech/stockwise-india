// The plain-English notes on an announcement (filingTerms.js)
import assert from "node:assert/strict";
import { explainFiling, explainHeadline } from "./filingTerms.js";

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
console.log("filingTerms tests passed");
