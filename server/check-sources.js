// Tries every outside data source the app depends on, once each, using the
// app's own fetch code — run it on any machine before trusting it to host the
// app or refresh the data. NSE sits behind bot protection that treats some
// networks differently (Screener.in blocked Render's IP outright), so "works
// on my Mac" says nothing about a cloud server.
//
//   node server/check-sources.js        (npm run check:sources)
import { fetchEquityList } from "./equity-list.js";
import { NSE_BASE, fetchJson, fetchXbrl, integratedFilings } from "./fetch-nse.js";
import { fetchShareholding } from "./fetch-shareholding.js";
import { fetchCmp } from "./quote.js";

const SYMBOL = "TCS";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function status(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return `${Math.round((await res.arrayBuffer()).byteLength / 1024)} KB`;
}

// Latest weekday's bhavcopy — NSE answers 404 for days without trading
async function bhavcopy() {
  const d = new Date();
  for (let i = 0; i < 7; i++, d.setUTCDate(d.getUTCDate() - 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    const [y, m, day] = d.toISOString().slice(0, 10).split("-");
    const res = await fetch(`https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${day}${m}${y}.csv`, { headers: { "User-Agent": UA } });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return `${day}-${m}-${y}, ${Math.round((await res.arrayBuffer()).byteLength / 1024)} KB`;
  }
  throw new Error("no bhavcopy in the last week");
}

const checks = [
  ["NSE equity list (archives)", async () => `${(await fetchEquityList()).length} symbols`],
  ["NSE filings API", async () => `${(await integratedFilings(SYMBOL)).length} filings for ${SYMBOL}`],
  ["NSE filing XBRL (nsearchives)", async () => `${Math.round((await fetchXbrl((await integratedFilings(SYMBOL))[0].xbrl)).length / 1024)} KB`],
  ["NSE shareholding API + XBRL", async () => { const h = await fetchShareholding(SYMBOL); return `${h.totalShares} shares, source ${h.source}`; }],
  ["NSE corporate actions API", async () => {
    const d = new Date(), from = new Date(d.getTime() - 30 * 86400000);
    const f = x => x.toISOString().slice(0, 10).split("-").reverse().join("-");
    return `${(await fetchJson(`${NSE_BASE}/api/corporates-corporateActions?index=equities&from_date=${f(from)}&to_date=${f(d)}`)).length} actions in 30 days`;
  }],
  ["NSE bhavcopy (nsearchives)", bhavcopy],
  ["Nifty index lists (niftyindices)", () => status("https://www.niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv")],
  ["Yahoo live price", async () => { const q = await fetchCmp(SYMBOL); return `${SYMBOL} ₹${q.cmp} on ${q.asOf}`; }],
];

let failed = 0;
for (const [name, run] of checks) {
  const started = Date.now();
  try {
    const detail = await run();
    console.log(`OK    ${name} — ${detail} (${Date.now() - started} ms)`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name} — ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ""} (${Date.now() - started} ms)`);
  }
}
console.log(failed ? `${failed} of ${checks.length} sources failed from this machine.` : `All ${checks.length} sources reachable from this machine.`);
