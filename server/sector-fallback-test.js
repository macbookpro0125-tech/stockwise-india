// When niftyindices.com's sector lists don't load, the last good sectors stand
// (market-data.js fallbackSectors), never an empty map
import assert from "node:assert/strict";
import { fallbackSectors, _nseSectorsForTest as nseSectors, _bseSectorsForTest as bseSectors, bseCodes, bseClassification, votedSectors } from "./market-data.js";
import { nseSession } from "./fetch-nse.js";

const seed = fallbackSectors({});
assert.ok(Object.keys(seed).length >= 700, "an empty previous snapshot falls back to the saved list");
assert.equal(seed.RELIANCE, "Oil Gas & Consumable Fuels");
assert.equal(seed.TCS, "Information Technology");
const previous = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`S${i}`, "Chemicals"]));
assert.equal(fallbackSectors(previous), previous, "a previous snapshot with sectors is kept as it was");

// NSE's quote API refuses a request without the cookies its pages set; the
// session opens a page first and sends them back
const asked = [];
const fakeNse = async (url, options) => {
  asked.push(url);
  const headers = new Headers();
  if (!url.includes("/api/")) {
    headers.append("set-cookie", url.includes("get-quotes") ? "nseappid=abc; Path=/; HttpOnly" : "nsit=xyz; Path=/");
    return new Response("<html></html>", { status: 200, headers });
  }
  const cookie = options.headers.Cookie ?? "";
  if (!cookie.includes("nsit=xyz") || !cookie.includes("nseappid=abc")) return new Response("denied", { status: 401 });
  const sym = new URL(url).searchParams.get("symbol");
  return Response.json({ industryInfo: { macro: "Consumer Discretionary", sector: sym === "FLAIR" ? "Consumer Durables" : "Brand New Sector", basicIndustry: "Stationary" } });
};
const session = nseSession({ fetchImpl: fakeNse });
const got = await nseSectors(["FLAIR", "ODDCO", "TCS"], { TCS: "Information Technology" }, { pauseMs: 0, session });
assert.deepEqual(got.FLAIR, { sector: "Consumer Durables", basic: "Stationary", macro: "Consumer Discretionary" }, "read with the page's cookies");
assert.equal(got.ODDCO, null, "a sector name NSE's lists don't use isn't taken");
assert.ok(!asked.some(u => u.includes("symbol=TCS") && u.includes("/api/")), "a company with an index sector isn't asked");
assert.ok(asked[0].endsWith("nseindia.com/") && asked[1].includes("get-quotes"), "the home page and a quote page open first");

// a refusal renews the session and asks once more; five in a row stop the run
let refusals = 0;
const stubborn = { cookies: 0, renewed: 0, async renew() { this.renewed++; }, async quote() { refusals++; throw new Error("NSE: returned HTTP 403"); } };
const none = await nseSectors(["A", "B", "C", "D", "E", "F", "G"], {}, { pauseMs: 0, session: stubborn });
assert.equal(refusals, 10, "each of five companies asked twice, then it stops");
assert.equal(stubborn.renewed, 5);
assert.ok(!("F" in none));

// BSE's list gives each NSE company its BSE code, by ISIN (a different BSE
// symbol still matches), else by the same symbol
const bseRows = [
  { SCRIP_CD: 544000, scrip_id: "FLAIRWRIT", ISIN_NUMBER: "INE00Y201027", INDUSTRY: null },
  { SCRIP_CD: "500001", scrip_id: "SAMECO", ISIN_NUMBER: "INE999X01011", INDUSTRY: null },
  { SCRIP_CD: "", scrip_id: "BLANK", ISIN_NUMBER: "INE888X01011" },
];
const equityList = [
  { symbol: "FLAIR", isin: "INE00Y201027" },
  { symbol: "SAMECO", isin: "INE000000000" },
  { symbol: "BLANK", isin: "INE888X01011" },
  { symbol: "NSEONLY", isin: "INE777X01011" },
];
assert.deepEqual(bseCodes(bseRows, equityList), { FLAIR: "544000", SAMECO: "500001" });
assert.deepEqual(bseCodes(null, equityList), {});
const knownSectors = new Set(["Consumer Durables", "Information Technology"]);
assert.deepEqual(bseClassification({ Sector: "Consumer Durables", ISubGroupName: "Stationary" }, knownSectors), { sector: "Consumer Durables", basic: "Stationary" });
assert.equal(bseClassification({ Sector: "Made Up" }, knownSectors), null);
// BSE's "Sector" is the macro sector: the finer field wins where it's a known sector
const known2 = new Set(["Chemicals", "Fast Moving Consumer Goods"]);
assert.deepEqual(bseClassification({ Sector: "Commodities", IndustryNew: "Chemicals", IGroupName: "Chemicals & Petrochemicals", ISubGroupName: "Specialty Chemicals" }, known2), { sector: "Chemicals", basic: "Specialty Chemicals" });
assert.deepEqual(bseClassification({ Sector: "Commodities", Other: "Chemicals" }, known2), { sector: "Chemicals" }, "any field naming a known sector");
assert.equal(bseClassification({ Sector: "Commodities" }, known2), null);

// each company NSE's lists miss is asked for once; the codes come from BSE's list
const bseAsked = [];
const fakeBse = async url => {
  bseAsked.push(url);
  if (url.includes("ListofScripData")) return bseRows;
  return url.includes("scripcode=544000") ? { Sector: "Consumer Durables", ISubGroupName: "Stationary" } : { Sector: "Something Else" };
};
const fromBse = await bseSectors(["FLAIR", "SAMECO", "NSEONLY", "TCS"], { TCS: "Information Technology" }, { pauseMs: 0, getJson: fakeBse, equityList });
assert.deepEqual(fromBse.FLAIR, { sector: "Consumer Durables", basic: "Stationary" });
assert.equal(fromBse.SAMECO, null, "a sector name NSE's lists don't use isn't taken");
assert.ok(!("NSEONLY" in fromBse) && !bseAsked.some(u => u.includes("TCS")), "no BSE code, or an NSE sector already: not asked");

// an industry takes the sector most of its indexed companies have, 75% of at least `min`
const labels = { A: "Software", B: "Software", C: "Software", D: "Software", E: "Sugar", F: "Sugar", G: "Mixed", H: "Mixed", I: "Lone" };
const indexed = { A: "Information Technology", B: "Information Technology", C: "Information Technology", E: "Fast Moving Consumer Goods", F: "Fast Moving Consumer Goods", G: "Realty", H: "Construction", I: "Textiles" };
assert.deepEqual(votedSectors(labels, indexed), { Software: "Information Technology" });
assert.deepEqual(votedSectors(labels, indexed, 2), { Software: "Information Technology", Sugar: "Fast Moving Consumer Goods" }, "a split industry and a lone one stay unmapped");
console.log("All sector-fallback checks passed.");
