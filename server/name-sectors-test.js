// The name test names a sector only on words that almost always mean one
import assert from "node:assert/strict";
import { sectorFromName } from "./name-sectors.js";

const cases = [
  ["Sun Pharmaceutical Industries Limited", "Healthcare"],
  ["Hindustan Oil & Gas Limited", "Oil Gas & Consumable Fuels"],
  ["Dhampur Sugar Mills Limited", "Fast Moving Consumer Goods"],
  ["Shree Cement Limited", "Construction Materials"],
  ["Sundaram Finance Limited", "Financial Services"],
  ["XYZ Infotech Limited", "Information Technology"],
  // Words that misled more often than not stay unnamed
  ["Greaves Cotton Limited", null],
  ["Garware Hi-Tech Films Limited", null],
  ["Bharat Heavy Electricals Limited", null],
  ["Avalon Technologies Limited", null],
  ["CG Power and Industrial Solutions Limited", null],
  ["", null],
];
for (const [name, sector] of cases) assert.equal(sectorFromName(name), sector, name);
console.log("All name-sector checks passed.");
