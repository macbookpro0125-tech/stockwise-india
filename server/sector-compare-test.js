// A company against its sector (sector-compare.js): node server/sector-compare-test.js
import assert from "node:assert/strict";
import { buildSectorStats, sectorComparison, peerKey } from "./sector-compare.js";

const co = (symbol, sector, o = {}) => ({ symbol, sector, lender: false, ...o });
const rows = [
  co("A", "IT", { roe: 10, debtToEquity: 0.1, peTtm: 20 }),
  co("B", "IT", { roe: 20, debtToEquity: 0.5, peTtm: 30 }),
  co("C", "IT", { roe: 30, debtToEquity: 0, peTtm: 40 }),
  co("D", "IT", { roe: 40, debtToEquity: 1, peTtm: -5 }),
  co("E", "IT", { roe: 50, debtToEquity: null, peTtm: 25 }),
  co("F", "IT", { roe: null }),
  co("BANK1", "Fin", { lender: true, roe: 15, debtToEquity: 9 }),
  co("NBFC", "Fin", { roe: 25 }),
];

assert.equal(peerKey(rows[0]), "IT");
assert.equal(peerKey(rows[6]), "Fin · lenders");
console.log("ok: lenders are compared with lenders in their sector");

{
  const stats = buildSectorStats(rows, { minPeers: 3 });
  const cmp = sectorComparison(rows[2], stats);   // C: ROE 30, D/E 0, P/E 40
  const roe = cmp.find(r => r.id === "roe");
  assert.equal(roe.median, 30);
  assert.equal(roe.n, 5);
  assert.equal(roe.beats, 0.5, "beats 2 of the other 4 on ROE (10 and 20)");
  const de = cmp.find(r => r.id === "debtToEquity");
  assert.equal(de.beats, 1, "less debt than all 3 others with a figure");
  const pe = cmp.find(r => r.id === "peTtm");
  assert.equal(pe.n, 4, "a negative P/E is left out");
  assert.equal(pe.beats, 0, "the dearest of the four");
  assert.equal(cmp.find(r => r.id === "salesGrowth5y"), undefined, "no sector figures: no row");
  console.log("ok: the sector's middle, and how many of the others it beats, with lower better for D/E and P/E");
}
{
  const stats = buildSectorStats(rows, { minPeers: 3 });
  assert.equal(sectorComparison(rows[6], stats).length, 0, "a lender with too few lenders beside it");
  const stats1 = buildSectorStats(rows, { minPeers: 1 });
  const bank = sectorComparison(rows[6], stats1);
  assert.ok(!bank.some(r => ["debtToEquity", "opm5y", "roce5y"].includes(r.id)), "no D/E, margin or ROCE for a lender");
  assert.equal(sectorComparison(rows[5], stats).find(r => r.id === "roe"), undefined, "its own figure missing: no row");
  console.log("ok: rows only where the company and enough of its sector have the figure");
}
