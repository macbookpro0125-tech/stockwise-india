// "Around the web" links (webLinks.js): node src/webLinks.test.js
import assert from "node:assert/strict";
import { webLinks, searchName, SEARCH_ALL } from "./webLinks.js";

assert.equal(searchName("Tata Consultancy Services Limited"), "Tata Consultancy Services");
assert.equal(searchName("Bharat Heavy Electricals Ltd."), "Bharat Heavy Electricals");
assert.equal(searchName("ABB India Limited"), "ABB India");
assert.equal(searchName("Gillette (India) Limited"), "Gillette");
assert.equal(searchName("", "TCS"), "TCS", "no name: the symbol");

const all = webLinks({ name: "Mahindra & Mahindra Limited", symbol: "M&M" }).flatMap(([, l]) => l);
const by = id => all.find(l => l.id === id).url;
assert.ok(all.every(l => /^https:\/\//.test(l.url)), "every link is https");
assert.equal(new Set(all.map(l => l.id)).size, all.length, "one of each");
assert.equal(by("tradingview"), "https://www.tradingview.com/symbols/NSE-M_M/", "TradingView's way of writing M&M");
assert.equal(by("nse"), "https://www.nseindia.com/get-quotes/equity?symbol=M%26M", "the & encoded");
assert.ok(by("x").includes(encodeURIComponent('"Mahindra & Mahindra"')), "X: the name quoted, without Limited");
assert.equal(by("screener"), "https://www.screener.in/company/M%26M/consolidated/");
assert.ok(SEARCH_ALL.every(id => all.some(l => l.id === id)));
console.log("webLinks tests passed");
