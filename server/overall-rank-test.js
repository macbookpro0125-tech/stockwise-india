// Each company's place by overall score (screen.js rankByOverall, 12 Nov 2026)
import assert from "node:assert/strict";
import { rankByOverall } from "./screen.js";
import { rankLine } from "../src/overallRank.js";

const co = (symbol, score, sector = "Banks") => ({ symbol, sector, research: score == null ? null : { overall: { score } } });
const rows = [co("A", 80.4), co("B", 91), co("C", 79.6), co("D", null), co("E", 60, "IT"), co("F", 55, "IT"), co("G", 50, "IT")];
rankByOverall(rows);
const at = s => rows.find(r => r.symbol === s).overallRank;
assert.equal(at("B").rank, 1, "the highest score is first");
assert.equal(at("A").rank, 2);
assert.equal(at("C").rank, 2, "the same whole-number score (80) shares a place");
assert.equal(at("E").rank, 4, "after a shared place, the next counts both");
assert.equal(at("D"), null, "an unscored company has no place");
assert.equal(at("B").of, 6, "out of the scored companies only");
assert.deepEqual([at("B").sectorRank, at("B").sectorOf, at("E").sectorRank, at("G").sectorRank], [1, 3, 1, 3], "and within its sector");
assert.equal(rankLine(at("E")), "#4 of 6 on NSE · #1 of 3 in IT");
assert.equal(rankLine(null), null);
assert.equal(rankLine({ rank: 1500, of: 2000 }), "#1,500 of 2,000 on NSE", "a sector of fewer than 3 is left out");
console.log("ok: companies ranked by overall score, ties sharing a place, in the market and in their sector");
