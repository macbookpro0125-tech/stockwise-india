// node --no-warnings server/gold-silver-test.js — gold, silver and ETFs (gold-silver.js)
import assert from "node:assert/strict";
import { amcOf, groupOf, parseEtfList, sgbMaturity, returnOver, etfRow, sgbRow, liveOf, withToday, nseDay } from "./gold-silver.js";

assert.equal(amcOf("NIPINDETFGOLDBEES"), "Nippon India");
assert.equal(amcOf("MIRAEAMC-MAGOLDETF"), "Mirae Asset");
assert.equal(amcOf("SomethingNew"), null, "an unknown fund house isn't guessed");
assert.equal(groupOf("COMMODITY", "GOLD"), "gold");
assert.equal(groupOf("COMMODITY", "SILVER"), "silver");
assert.equal(groupOf("DEBT", "Overnight ETFs and Liquid ETF"), "liquid");
assert.equal(groupOf("DEBT", "GSECS/GILT"), "bonds");
assert.equal(groupOf("GLOBAL INDICES", "GLOBAL INDICES"), "global");
assert.equal(groupOf("EQUITY", "Nifty 50"), "shares");
const list = parseEtfList("Symbol,Underlying Asset,SecurityName,DateofListing,MarketLot,ISINNumber,FaceValue,ETF Underlying,Underlying Key\r\nGOLDBEES,Gold,NIPINDETFGOLDBEES,19-Mar-07,1,INF204KB17I5,1,COMMODITY,GOLD\r\nNIFTYBEES,Nifty 50,NIPINDETFNIFTYBEES,08-Jan-02,1,INF204KB14I2,1,EQUITY,Nifty 50\r\n");
assert.deepEqual(list.get("GOLDBEES"), { group: "gold", tracks: "Gold", amc: "Nippon India", listed: "19-Mar-07", isin: "INF204KB17I5" });
assert.equal(list.get("NIFTYBEES").tracks, "Nifty 50");
console.log("ok: NSE's ETF list, grouped, with the fund house");

assert.deepEqual(sgbMaturity("SGBAUG28V"), { month: 7, year: 2028, tranche: "V" });
assert.deepEqual(sgbMaturity("SGBDEC26"), { month: 11, year: 2026, tranche: null });
assert.equal(sgbMaturity("GOLDBEES"), null);
const s = sgbRow({ symbol: "SGBAUG28V", issue_price: "5284", ltP: "12386", per: "-4.81", trdVal: "151488601.59", wkhi: "18800", wklo: "12245", perChange365d: 1.24 }, Date.UTC(2026, 10, 20));
assert.equal(s.matures, "Aug 2028");
assert.equal(Math.round(s.sinceIssuePct), 134);
assert.equal(s.interestYear, 132.1);
assert.ok(Math.abs(s.yearsLeft - 1.78) < 0.02);
console.log("ok: a gold bond's maturity, gain since issue and interest");

// the close against the same day's NAV; a dash from NSE is no figure
const e = etfRow({ symbol: "X", ltP: "101.3", prevClose: "106.3", nav: "106.5331", per: "-4.7", perChange30d: "-", trdVal: "1e9" }, null);
assert.ok(Math.abs(e.premiumPct + 0.2188) < 0.001);
assert.equal(e.ret1m, null);
assert.equal(e.valueCr, 100);
console.log("ok: an ETF's close against its NAV");

const bars = []; for (let i = 0; i <= 3 * 365; i += 1) bars.push([new Date(Date.UTC(2023, 0, 1) + i * 864e5).toISOString().slice(0, 10), 0, 0, 0, 100 * Math.pow(1.1, i / 365.25)]);
assert.ok(Math.abs(returnOver(bars, 3 * 365) - 10) < 0.1, "10% a year over three years");
assert.equal(returnOver(bars, 5 * 365), null, "history too short: no figure");
console.log("ok: returns, yearly over three years, none past the history");

// today's price for the chart: the ETFs it draws, dated from NSE's time
const live = liveOf({ asOf: "20-Nov-2026 13:54:24", groups: { gold: [{ symbol: "GOLDBEES", price: 101.96 }], shares: [{ symbol: "NIFTYBEES", price: 293.1 }, { symbol: "X", price: 1 }] } });
assert.deepEqual(live, { GOLDBEES: { date: "2026-11-20", price: 101.96, at: "13:54" }, NIFTYBEES: { date: "2026-11-20", price: 293.1, at: "13:54" } });
assert.deepEqual(liveOf({ asOf: null }), {});
console.log("ok: today's price for the chart");

// returns to today's price: the bars get today's on the end, only when newer
const kept = [["2026-11-18", 0, 0, 0, 107.85], ["2026-11-19", 0, 0, 0, 106.3]];
assert.equal(withToday(kept, "2026-11-20", 102.38).at(-1)[4], 102.38);
assert.equal(withToday(kept, "2026-11-19", 102.38).length, 2, "not the same day twice");
assert.equal(nseDay("20-Nov-2026 13:54:24"), "2026-11-20");
console.log("ok: returns run to today's price");
