// A sector from how a company describes its business in its results filing
// (business-sectors.js, fetch-nse.js businessOf): node server/business-sectors-test.js
// Every description below is copied from a company's filing on NSE.
import { sectorFromBusiness, cleanBusiness } from "./business-sectors.js";
import { businessOf } from "./fetch-nse.js";

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log(`ok: ${msg}`);
  else { failures++; console.error(`FAIL: ${msg}`); }
}
const is = (lines, sector, msg) => {
  const got = sectorFromBusiness(lines);
  assert(got === sector, `${msg}${got === sector ? "" : ` (got ${got})`}`);
};

is(["Milk and Milk Products"], "Fast Moving Consumer Goods", "a dairy (Hatsun Agro)");
is(["Pharmaceutical Business Segment"], "Healthcare", "a drug maker (Neclife)");
is(["Agro Chemicals"], "Chemicals", "crop chemicals");
is(["Travel QSR outlets and Lounge services"], "Consumer Services", "airport restaurants and lounges — not consumer goods, as its name 'Food' suggested");
is(["Pellet Plant", "Pig Iron Plant", "Other opreating revenue", "Unallocable"], "Metals & Mining", "iron ore pellets and pig iron (KIOCL)");
is(["IT AND IT ENABLED SERVICES"], "Information Technology", "IT services");
is(["Paints"], "Consumer Durables", "paints, as NSE files them");
is(["NBFC"], "Financial Services", "a lender");
is(["Films Production, Distribution & exhibition"], "Media Entertainment & Publication", "films");
is(["Dairy", "Renewable Energy"], "Fast Moving Consumer Goods", "the main business is listed first: a dairy with some wind power");
is(["Sugar", "Power", "Distillery", "Unallocated"], "Fast Moving Consumer Goods", "a sugar mill that also sells power");
is(["Manufacturing of ERW steel tube and pipes"], "Capital Goods", "steel pipes are capital goods, as NSE files them, not metals");
is(["Ship Construction"], "Capital Goods", "a shipyard isn't a builder");
is(["Retail Trade of Apparel & Non Apparel"], "Consumer Services", "a clothes retailer is a retailer, not a textile mill");
is(["Fabric Care", "Home Care", "Personal Care"], "Fast Moving Consumer Goods", "fabric care is a detergent, not a fabric");
is(["Manufacture and marketing of lead acid & other storage batteries"], "Automobile and Auto Components", "batteries, as NSE files them");
is(["Infra &amp; Energy"], "Construction", "XML's &amp; is read as &");

is(["SINGLE SEGMENT"], null, "\"single segment\" says nothing");
is(["The company operates in a single segment and in line with Ind AS 108 Operating Segments the"], null, "a sentence about segment reporting says nothing");
is(["Domestic", "outside India"], null, "markets aren't a business");
is(["Manufacturing"], null, "the form isn't a business");
is(["BRANDED", "BULK"], null, "nor are product forms");
is([], null, "no lines, no sector");
assert(cleanBusiness(["Pellet Plant", "Unallocable", "  ", "Others"]).join() === "Pellet Plant", "unallocated and blank lines are dropped");
assert(cleanBusiness(["Pellet Plant", "Pig Iron Plant", "Other opreating revenue"]).join("; ") === "Pellet Plant; Pig Iron Plant", "other operating revenue isn't a business, however it's spelt (KIOCL's filing)");

// Read from the filing itself, in the company's own order
const xml = `<xbrli:xbrl>
<in-capmkt:NameOfTheCompany contextRef="OneD">KIOCL Limited</in-capmkt:NameOfTheCompany>
<in-capmkt:DescriptionOfReportableSegment contextRef="Seg1">Pellet Plant</in-capmkt:DescriptionOfReportableSegment>
<in-capmkt:DescriptionOfReportableSegment contextRef="Seg2">Pig Iron Plant</in-capmkt:DescriptionOfReportableSegment>
<in-capmkt:DescriptionOfReportableSegment contextRef="Seg1x">Pellet Plant</in-capmkt:DescriptionOfReportableSegment>
<in-capmkt:DescriptionOfSingleSegment contextRef="OneD">Infra &amp; Energy</in-capmkt:DescriptionOfSingleSegment>
</xbrli:xbrl>`;
assert(businessOf(xml).join("; ") === "Pellet Plant; Pig Iron Plant; Infra & Energy", "a filing's segment lines, in order, each once, entities read");
assert(businessOf("<xbrli:xbrl></xbrli:xbrl>").length === 0, "a filing without segment lines gives none");

if (failures) { console.error(`${failures} business sector check(s) failed`); process.exit(1); }
console.log("\nAll business sector checks passed.");
