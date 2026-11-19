// A company's quarterly results filings on NSE, for the links under its
// Quarterly results (src/QuarterDownloads.jsx, 19 Nov 2026): the readable
// version (iXBRL) and the PDF when NSE has one. Kept six hours.
import { integratedFilings } from "./fetch-nse.js";
import { cached } from "./company-extras.js";

const NSE_FILE = /^https:\/\/nsearchives\.nseindia\.(com|in)\/.+\.(html?|pdf|xml)$/i;
const MONTHS = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
// "30-SEP-2026" / "08-Oct-2026 22:08:10" -> "2026-09-30"
export const isoOf = s => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(s ?? ""));
  return m ? `${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}` : null;
};
const link = u => (NSE_FILE.test(String(u ?? "")) ? u : null);

export function filingsFrom(rows) {
  return rows.map(r => ({
    periodEnd: isoOf(r.qe_Date), scope: r.consolidated ?? null, filed: isoOf(r.creation_Date || r.broadcast_Date),
    view: link(r.ixbrl), pdf: link(r.pdf_attach), xbrl: link(r.xbrl),
  })).filter(f => f.periodEnd && (f.view || f.pdf || f.xbrl));
}

export function resultFilings(symbol) {
  return cached(`result-filings:${symbol}`, 6 * 3600_000, async () => filingsFrom(await integratedFilings(symbol)));
}
