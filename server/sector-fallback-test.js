// When niftyindices.com's sector lists don't load, the last good sectors stand
// (market-data.js fallbackSectors), never an empty map
import assert from "node:assert/strict";
import { fallbackSectors, _nseSectorsForTest as nseSectors } from "./market-data.js";
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
console.log("All sector-fallback checks passed.");
