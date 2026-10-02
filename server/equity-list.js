// The authoritative, always-current symbol list — NSE's own master CSV.
// Fixes the failure mode that broke ACRYSIL: a hand-maintained ticker list
// goes stale the moment a company renames (it became CARYSIL in 2021) and
// silently returns zero records with no clue why. This is fetched live, not
// hardcoded, for the same reason. No comma-in-field risk in this file
// (checked against the real CSV, 2026-09-26) so a plain split is safe —
// switch to a real CSV parser if NSE ever adds a company name containing one.
const EQUITY_LIST_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
import { fetchText } from "./upstream.js";

export async function fetchEquityList() {
  const csv = await fetchText(EQUITY_LIST_URL, { headers: { "User-Agent": UA }, service: "NSE equity list", maxBytes: 5 * 1024 * 1024 });
  const [, ...lines] = csv.trim().split("\n");
  return lines.map(line => {
    const [symbol, name, series, dateOfListing, , , isin, faceValue] = line.split(",");
    return { symbol, name, series, dateOfListing, isin, faceValue: Number(faceValue) };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = await fetchEquityList();
  console.log(`${list.length} NSE-listed equities`);
  console.log(list.slice(0, 3));
}
