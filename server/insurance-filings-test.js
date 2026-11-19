// Insurers' results filings read as every other company's (fetch-nse.js
// asStandardTags): node --no-warnings server/insurance-filings-test.js
import assert from "node:assert/strict";
import { templateOf, asStandardTags, parseContexts, firstFacts, TAGS } from "./fetch-nse.js";

const LIFE = "https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_LI_1670942_21052026082347_WEB.xml";
const GENERAL = "https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_GI_1651776_15042026105416_WEB.xml";
const PLAIN = "https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1661111_20042026_WEB.xml";

assert.equal(templateOf(LIFE), "INSURANCE");
assert.equal(templateOf(GENERAL), "INSURANCE");
assert.equal(templateOf(PLAIN), "INDAS");
assert.equal(templateOf("https://x/INTEGRATED_FILING_BANKING_1_WEB.xml"), "BANKING");
console.log("ok: life (LI) and general (GI) filings are insurers'");

const ctx = `<xbrli:context id="FourD"><xbrli:entity/><xbrli:period><xbrli:startDate>2025-04-01</xbrli:startDate><xbrli:endDate>2026-03-31</xbrli:endDate></xbrli:period></xbrli:context>`;
const fact = (tag, v) => `<in-capmkt:${tag} contextRef="FourD" unitRef="INR">${v}</in-capmkt:${tag}>`;
const read = (xml, tags) => firstFacts(xml, parseContexts(xml), tags)[0]?.value ?? null;

{
  // LIC FY26, as filed: profit ₹57,453 Cr, net premium ₹5.38 lakh Cr, EPS ₹90.84
  const xml = asStandardTags(ctx + fact("ProfitLossAfterTaxAndExtraordinaryItems", 574531500000) + fact("ProfitLossAfterTaxBeforeExtraordinaryItems", 574531500000)
    + fact("NetPremiumIncome", 5376037900000) + fact("Income", 9817786800000)
    + fact("BasicAndDilutedEPSAfterExtraordinaryItemsNetOfTaxExpenseForThePeriodNotToBeAnnualized", 90.84), LIFE);
  assert.equal(read(xml, TAGS.profit), 574531500000);
  assert.equal(read(xml, TAGS.revenue), 5376037900000, "sales is the net premium, not total income");
  assert.equal(read(xml, TAGS.eps), 90.84);
  console.log("ok: a life insurer's profit, net premium and EPS are read");
}
{
  // ICICI Lombard FY26: profit ₹2,772 Cr, net premium written ₹23,374 Cr
  const xml = asStandardTags(ctx + fact("ProfitLossAfterTax", 27719400000) + fact("NetPremiumWritten", 233744800000), GENERAL);
  assert.equal(read(xml, TAGS.profit), 27719400000);
  assert.equal(read(xml, TAGS.revenue), 233744800000);
  console.log("ok: a general insurer's profit and net premium are read");
}
{
  // another company's filing is left exactly as filed
  const raw = ctx + fact("ProfitLossAfterTax", 1) + fact("RevenueFromOperations", 2);
  assert.equal(asStandardTags(raw, PLAIN), raw);
  // and an insurer's line already under the standard name is not overwritten
  const both = ctx + fact("ProfitLossForPeriod", 5) + fact("ProfitLossAfterTax", 7);
  assert.equal(read(asStandardTags(both, GENERAL), TAGS.profit), 5);
  console.log("ok: only insurers' filings are renamed, and nothing filed is overwritten");
}
{
  // the policyholders' account's expenses aren't a cost of sales: not read
  const xml = asStandardTags(ctx + fact("NetPremiumIncome", 100) + fact("Expenses", 170), LIFE);
  assert.equal(read(xml, TAGS.expenses), null);
  console.log("ok: no operating margin is worked out for an insurer");
}
