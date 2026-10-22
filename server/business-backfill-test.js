// Reading the business lines of companies already on disk (fetch-market.js
// "business", data-jobs.js refreshBusinessLines): node --no-warnings server/business-backfill-test.js
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "business-"));
process.env.DATA_DIR = dir;
const { SCHEMA } = await import("./fetch-nse.js");
const { fetchCompanies, needsBusiness } = await import("./fetch-market.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok: ${msg}`);
  else { failures++; console.error(`FAIL: ${msg}`); }
}

const market = join(dir, "market");
mkdirSync(market, { recursive: true });
const put = (symbol, body) => writeFileSync(join(market, `${symbol}.json`), JSON.stringify({ symbol, name: `${symbol} Limited`, schema: SCHEMA, ...body }));
const read = symbol => JSON.parse(readFileSync(join(market, `${symbol}.json`), "utf8"));

put("DAIRYCO", { years: [{ label: "FY26", profit: 120 }], holding: { promoterPct: 70 } });
put("DONECO", { years: [{ label: "FY26" }], business: ["Paints"] });
put("BROKENCO", { error: "No Integrated Filing financials" });
put("NEWCO", { years: [{ label: "FY26" }] });
assert(needsBusiness("DAIRYCO") && needsBusiness("NEWCO"), "a company read before business lines needs them");
assert(!needsBusiness("DONECO"), "one that has them doesn't");
assert(!needsBusiness("BROKENCO"), "nor one whose figures couldn't be read");

// NSE, stubbed: DAIRYCO's newest filing describes its business; NEWCO has filed none yet
globalThis.fetch = async url => {
  const u = String(url);
  const respond = (body, type) => { const r = new Response(body, { status: 200, headers: { "content-type": type } }); Object.defineProperty(r, "url", { value: u }); return r; };
  if (u.includes("integrated-filing-results") && u.includes("DAIRYCO")) return respond(JSON.stringify({ data: [{ symbol: "DAIRYCO", qe_Date: "30-JUN-2026", consolidated: "Standalone", creation_Date: "12-Aug-2026 16:30:34", xbrl: "https://nsearchives.nseindia.com/corporate/xbrl/DAIRYCO.xml" }] }), "application/json");
  if (u.includes("integrated-filing-results")) return respond(JSON.stringify({ data: [] }), "application/json");
  if (u.endsWith("DAIRYCO.xml")) return respond(`<xbrli:xbrl><in-capmkt:DescriptionOfSingleSegment contextRef="OneD">Milk and Milk Products</in-capmkt:DescriptionOfSingleSegment></xbrli:xbrl>`, "application/xml");
  return new Response("", { status: 404 });
};

const result = await fetchCompanies([{ symbol: "DAIRYCO", name: "DAIRYCO Limited" }, { symbol: "NEWCO", name: "NEWCO Limited" }], "business", { log: () => {} });
assert(result.ok === 2 && result.fail === 0, "both read");
const dairy = read("DAIRYCO");
assert(dairy.business?.join() === "Milk and Milk Products", "the filing's business line is kept with the company");
assert(dairy.years?.[0]?.profit === 120 && dairy.holding?.promoterPct === 70 && dairy.schema === SCHEMA, "and its figures are untouched");
assert(Array.isArray(read("NEWCO").business) && read("NEWCO").business.length === 0, "a company with no filing yet is marked read, not asked again every evening");
assert(!needsBusiness("DAIRYCO") && !needsBusiness("NEWCO"), "neither needs reading again");

rmSync(dir, { recursive: true, force: true });
if (failures) { console.error(`${failures} business backfill check(s) failed`); process.exit(1); }
console.log("\nAll business backfill checks passed.");
