// node --no-warnings server/rbi-gold-test.js — RBI's gold price a gram (rbi-gold.js)
import assert from "node:assert/strict";
import { parseSgbNotice, feedItems, caratTable } from "./rbi-gold.js";

// RBI's notice of 17 Nov 2026, as its page reads
const page = `<html><body><p>Date : Nov 17, 2026</p><h2>Premature redemption under Sovereign Gold Bond (SGB) Scheme - Redemption Price for premature redemption of SGB 2020-21 Series VIII due on November 18, 2026</h2>
<p>In terms of GOI notification ... premature redemption of Gold Bond may be permitted after fifth year ... the next due date of premature redemption of the above tranche shall be on November 18, 2026.</p>
<p>2. Further, the redemption price of SGB shall be based on simple average of closing price of gold of 999 purity of previous three business days from the date of redemption, as published by the India Bullion and Jewellers Association Ltd (IBJA). Accordingly, the redemption price for premature redemption due on November 18, 2026, shall be &#8377;13,499/- (Rupees Thirteen Thousand Four Hundred and Ninety Nine only) per unit of SGB.</p></body></html>`;
const n = parseSgbNotice(page, { prid: 63990 });
assert.deepEqual(n, { price: 13499, redeemOn: "2026-11-18", issued: "2026-11-17", series: "SGB 2020-21 Series VIII", prid: 63990 });
assert.equal(parseSgbNotice("<p>Result of the 3-day Variable Rate Repo auction: cut off 5.58%</p>"), null, "not a gold bond notice");
assert.equal(parseSgbNotice("<p>Sovereign Gold Bond Scheme 2026-27 Series I: issue price to be announced; redemption price as per terms</p>"), null, "no figure, nothing guessed");
console.log("ok: RBI's redemption price, its date and series");

const items = feedItems(`<rss><channel><item><title><![CDATA[Premature redemption under Sovereign Gold Bond (SGB) Scheme]]></title><link>https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=63996</link><description><![CDATA[<p>text</p>]]></description></item></channel></rss>`);
assert.equal(items[0].prid, 63996);
assert.match(items[0].title, /Sovereign Gold Bond/);
console.log("ok: RBI's feed");

const t = caratTable(13499);
assert.equal(Math.round(t["24K"][1]), 13499);
assert.equal(Math.round(t["22K"][1]), 12377, "916 of 999");
assert.equal(Math.round(t["18K"][10]), 101344, "750 of 999, ten grams");
console.log("ok: each carat by its purity");
