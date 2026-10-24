// Reading the statements in detail and sales by segment from a results
// filing (fetch-nse.js DETAIL_TAGS, segmentsOf), on a filing shaped like
// NSE's: plain contexts for the company, one dimension member per segment.
import assert from "node:assert/strict";
import { segmentsOf, segmentsArePlaces, DETAIL_TAGS } from "./fetch-nse.js";

const ctx = (id, start, end, member) => `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="x">X</xbrli:identifier>${member ? `<xbrli:segment><xbrldi:typedMember dimension="in-capmkt:SegmentsAxis"><in-capmkt:SegmentsDomain>${member}</in-capmkt:SegmentsDomain></xbrldi:typedMember></xbrli:segment>` : ""}</xbrli:entity><xbrli:period>${start ? `<xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate>` : `<xbrli:instant>${end}</xbrli:instant>`}</xbrli:period></xbrli:context>`;
const fact = (tag, id, v) => `<in-capmkt:${tag} contextRef="${id}" unitRef="INR" decimals="-5">${v}</in-capmkt:${tag}>`;
const xml = `<xbrli:xbrl>
${ctx("FourD", "2025-04-01", "2026-03-31")}${ctx("OneD", "2026-01-01", "2026-03-31")}
${ctx("FourD_1", "2025-04-01", "2026-03-31", 1)}${ctx("OneD_1", "2026-01-01", "2026-03-31", 1)}
${ctx("FourD_2", "2025-04-01", "2026-03-31", 2)}${ctx("OneD_2", "2026-01-01", "2026-03-31", 2)}
${ctx("FourD_3", "2025-04-01", "2026-03-31", 3)}${ctx("FourD_4", "2025-04-01", "2026-03-31", 4)}
${fact("DescriptionOfReportableSegment", "OneD_1", "Cement")}${fact("DescriptionOfReportableSegment", "OneD_2", "Chemicals &amp; Fibre")}
${fact("DescriptionOfReportableSegment", "FourD_3", "Inter Segment Revenue")}${fact("DescriptionOfReportableSegment", "FourD_4", "Unallocable")}
${fact("SegmentRevenue", "OneD_1", 2000000000)}${fact("SegmentRevenue", "FourD_1", 8000000000)}${fact("SegmentResult", "FourD_1", 1200000000)}
${fact("SegmentRevenue", "FourD_2", 2000000000)}${fact("SegmentRevenue", "FourD_3", -500000000)}${fact("SegmentRevenue", "FourD_4", 10000000)}
${fact("EmployeeBenefitExpense", "FourD", 900000000)}
</xbrli:xbrl>`;
const segs = segmentsOf(xml, "2026-03-31");
assert.deepEqual(segs, [{ name: "Cement", revenue: 8000000000, result: 1200000000 }, { name: "Chemicals & Fibre", revenue: 2000000000, result: null }], "the year's revenue by segment, reconciling lines left out");
assert.deepEqual(segmentsOf(xml, "2025-03-31"), [], "only the year asked for");
assert.deepEqual(segmentsOf(`<xbrli:xbrl>${ctx("FourD", "2025-04-01", "2026-03-31")}${fact("DescriptionOfSingleSegment", "FourD", "Cement")}</xbrli:xbrl>`, "2026-03-31"), [], "one segment: no split");
assert.ok(segmentsArePlaces([{ name: "India" }, { name: "Outside India" }]), "places");
assert.ok(!segmentsArePlaces([{ name: "Cement" }, { name: "Chemicals" }]), "businesses");
assert.ok(DETAIL_TAGS.year.employees.includes("EmployeeBenefitExpense") && DETAIL_TAGS.atEnd.receivables.length, "the detail lines are listed");
console.log("All statement-detail checks passed.");

// Its share of the listed sector's sales (sector-share.js)
import { sectorShare } from "./sector-share.js";
const rows = [["A", 600], ["B", 250], ["C", 100], ["D", 50], ["E", 0]].map(([symbol, revenueCr]) => ({ symbol, name: symbol, sector: "Cement", revenueCr }));
const sh = sectorShare(rows[2], rows, { top: 2 });
assert.equal(sh.companies, 4, "companies with sales only");
assert.equal(sh.rank, 3);
assert.equal(sh.sharePct, 10);
assert.deepEqual(sh.top.map(r => r.symbol), ["A", "B", "C"], "the biggest, and this one after them");
assert.equal(sectorShare(rows[0], rows.slice(0, 2)), null, "two companies is too few");
console.log("All sector-share checks passed.");
