// When niftyindices.com's sector lists don't load, the last good sectors stand
// (market-data.js fallbackSectors), never an empty map
import assert from "node:assert/strict";
import { fallbackSectors } from "./market-data.js";

const seed = fallbackSectors({});
assert.ok(Object.keys(seed).length >= 700, "an empty previous snapshot falls back to the saved list");
assert.equal(seed.RELIANCE, "Oil Gas & Consumable Fuels");
assert.equal(seed.TCS, "Information Technology");
const previous = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`S${i}`, "Chemicals"]));
assert.equal(fallbackSectors(previous), previous, "a previous snapshot with sectors is kept as it was");
console.log("All sector-fallback checks passed.");
