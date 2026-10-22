// Who a company's peers are (company-extras.js sectorPeers): node --no-warnings server/peers-test.js
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "peers-"));
process.env.DATA_DIR = dir;
const { sectorPeers } = await import("./company-extras.js");

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok: ${msg}`);
  else { failures++; console.error(`FAIL: ${msg}`); }
}

const co = (symbol, marketCapCr, more) => ({ symbol, name: `${symbol} Limited`, marketCapCr, ...more });
const rows = [
  co("BIGIT", 90000, { peerSector: "Information Technology", sector: "Information Technology" }),
  co("MIDIT", 20000, { peerSector: "Information Technology", sector: "Information Technology" }),
  co("SMALLSOFT", 300, { industry: "Computers - Software", peerSector: "Information Technology", sector: "Information Technology" }),
  co("BIGSTEEL", 50000, { peerSector: "Metals & Mining", sector: "Metals & Mining" }),
  co("TINYSTEEL", 120, { sector: "Metals & Mining", sectorByName: true }),
  co("OTHERSTEEL", 90, { sector: "Metals & Mining", sectorByName: true }),
  co("DAIRYCO", 400, { sector: "Fast Moving Consumer Goods", sectorByBusiness: true, businessLines: ["Milk and Milk Products"] }),
  co("BIGFOODS", 60000, { peerSector: "Fast Moving Consumer Goods", sector: "Fast Moving Consumer Goods" }),
  co("MYSTERY", 200, {}),
];

const it = sectorPeers("MIDIT", 30, rows);
assert(it.peerBasis === "sector" && it.peerLabel === "Information Technology", "a company in NSE's lists: its NSE sector");
assert(it.rows.map(r => r.symbol).join() === "BIGIT,MIDIT,SMALLSOFT", "its peers, largest first, itself among them");
assert(!it.rows.some(r => r.symbol === "TINYSTEEL"), "nothing from another sector");

const tiny = sectorPeers("TINYSTEEL", 30, rows);
assert(tiny.peerBasis === "name" && tiny.peerLabel === "Metals & Mining", "a company NSE doesn't classify: the sector its name gives, said as such");
assert(tiny.rows.map(r => r.symbol).join() === "BIGSTEEL,TINYSTEEL,OTHERSTEEL", "compared with the sector's companies, NSE-classified ones too");
assert(tiny.peerCount === 2, "the count leaves the company itself out");

const dairy = sectorPeers("DAIRYCO", 30, rows);
assert(dairy.peerBasis === "business" && dairy.peerLabel === "Fast Moving Consumer Goods", "neither NSE nor the name: the sector its results filing's business lines give");
assert(dairy.business?.join() === "Milk and Milk Products", "with the company's own words, to show beside it");
assert(dairy.rows.map(r => r.symbol).join() === "BIGFOODS,DAIRYCO", "compared with the sector's companies");

const none = sectorPeers("MYSTERY", 30, rows);
assert(none.peerBasis === null && none.rows.length === 0, "no sector from NSE or the name: no peers rather than wrong ones");

const capped = sectorPeers("SMALLSOFT", 2, rows);
assert(capped.rows.at(-1).symbol === "SMALLSOFT" && capped.total === 3, "a small company beyond the top peers is still in its own list");
assert(capped.topCount === 2, "and the list still says it's the top 2, not 3");

rmSync(dir, { recursive: true, force: true });
if (failures) { console.error(`${failures} peer check(s) failed`); process.exit(1); }
console.log("\nAll peer checks passed.");
