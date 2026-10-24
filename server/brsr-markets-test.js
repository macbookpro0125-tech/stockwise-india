// What a company sells and where, read from its BRSR (company-extras.js
// brsrMarkets), on a filing shaped like NSE's
import assert from "node:assert/strict";
import { brsrMarkets } from "./company-extras.js";

const f = (tag, ctx, v) => `<in-capmkt:${tag} contextRef="${ctx}">${v}</in-capmkt:${tag}>`;
const xml = `<xbrli:xbrl>
${f("NameOfProductOrService", "P1", "Power transformers")}${f("NICCodeOfProductOrServiceSoldByTheEntity", "P1", "27101")}${f("PercentageOfTotalTurnoverContributed", "P1", "0.55")}
${f("NameOfProductOrService", "P2", "Grid automation &amp; services")}${f("PercentageOfTotalTurnoverContributed", "P2", "0.42")}
${f("DescriptionOfBusinessActivity", "A1", "Manufacturing")}${f("PercentageOfTurnoverOfTheEntity", "A1", "0.97")}
${f("ContributionOfExportsAsAPercentageOfTheTotalTurnoverOfTheEntity", "D", "0.27")}
${f("NumberOfStatesWhereMarketServedByTheEntity", "D", "28")}${f("NumberOfCountriesWhereMarketServedByTheEntity", "D", "40")}
${f("BriefOnTypesOfCustomers", "D", "Utilities, industries and railways")}
</xbrli:xbrl>`;
const m = brsrMarkets(xml);
assert.deepEqual(m.products, [{ name: "Power transformers", pct: 55 }, { name: "Grid automation & services", pct: 42 }], "products with their share, fractions scaled");
assert.deepEqual(m.activities, [{ name: "Manufacturing", pct: 97 }]);
assert.equal(m.exportsPct, 27, "exports as a share of turnover");
assert.deepEqual(m.marketsServed, { states: 28, countries: 40 });
assert.match(m.customers, /railways/);
const none = brsrMarkets("<xbrli:xbrl></xbrli:xbrl>");
assert.deepEqual([none.products, none.exportsPct, none.marketsServed, none.customers], [[], null, null, null], "nothing filed, nothing guessed");
assert.equal(brsrMarkets(f("NameOfProductOrService", "P1", "Cement") + f("PercentageOfTotalTurnoverContributed", "P1", "88.5")).products[0].pct, 88.5, "a percentage stays one");
console.log("All BRSR market checks passed.");
