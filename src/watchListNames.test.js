// Suggested names for a watchlist list (watchListNames.js): node src/watchListNames.test.js
import assert from "node:assert/strict";
import { suggestListNames, COMMON_NAMES } from "./watchListNames.js";

const starred = [
  { ticker: "TCS", sector: "Information Technology" }, { ticker: "INFY", sector: "Information Technology" },
  { ticker: "WIPRO", sector: "Information Technology" }, { ticker: "HDFCBANK", sector: "Financial Services" },
  { ticker: "ICICIBANK", sector: "Financial Services" }, { ticker: "TITAN", sector: "Consumer Durables" }, { ticker: "X", sector: null },
];
const s = suggestListNames({ starred });
assert.deepEqual(s.slice(0, 2), [{ name: "IT stocks", tickers: ["TCS", "INFY", "WIPRO"] }, { name: "Banks & finance", tickers: ["HDFCBANK", "ICICIBANK"] }], "sectors with two or more starred, most first, with their stocks");
assert.ok(!s.some(x => x.name === "Consumer durables"), "a sector with one stock isn't suggested");
assert.equal(s[2].name, COMMON_NAMES[0], "then the usual names");
assert.equal(s.length, 8);

// names already used are left out, whatever their case
const t = suggestListNames({ starred, existing: ["it STOCKS", "Long term"] });
assert.ok(!t.some(x => /^(it stocks|long term)$/i.test(x.name)));
assert.equal(t[0].name, "Banks & finance");

// nothing starred: the usual names
assert.deepEqual(suggestListNames().map(x => x.name), COMMON_NAMES.slice(0, 8));
// a list for one stock: its sector's name first
assert.equal(suggestListNames({ sector: "Healthcare" })[0].name, "Pharma & healthcare");
assert.equal(suggestListNames({ sector: "Healthcare", existing: ["pharma & healthcare"] })[0].name, COMMON_NAMES[0]);
console.log("watchListNames tests passed");
