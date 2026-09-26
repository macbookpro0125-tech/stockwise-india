// Coverage smoke test before scaling the fetch pipeline to the whole market:
// does NSE's XBRL actually exist (not just "-") for companies outside the two
// mega-caps already proven (WIPRO, TCS)? Banks report differently (no simple
// "Borrowings" line — deposits and lending dominate the balance sheet), and
// smaller companies are more likely to skip XBRL entirely.
const NSE_BASE = "https://www.nseindia.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkSymbol(symbol) {
  const result = { symbol };
  try {
    const q = await fetchJson(`${NSE_BASE}/api/corporates-financial-results?index=equities&period=Quarterly&symbol=${symbol}`);
    const qUsable = q.filter(r => r.consolidated === "Consolidated" && r.xbrl && r.xbrl !== "-");
    result.quarterlyFilings = q.length;
    result.quarterlyXbrl = qUsable.length;
  } catch (e) { result.quarterlyError = e.message; }

  try {
    const a = await fetchJson(`${NSE_BASE}/api/corporates-financial-results?index=equities&period=Annual&symbol=${symbol}`);
    const aUsable = a.filter(r => r.consolidated === "Consolidated" && r.xbrl && r.xbrl !== "-");
    result.annualFilings = a.length;
    result.annualXbrl = aUsable.length;
  } catch (e) { result.annualError = e.message; }

  try {
    const h = await fetchJson(`${NSE_BASE}/api/corporate-share-holdings-master?index=equities&symbol=${symbol}`);
    result.holdingFilings = h.length;
    result.promoterPct = h[0] ? Number(h[0].pr_and_prgrp) : null;
  } catch (e) { result.holdingError = e.message; }

  return result;
}

const SAMPLE = [
  // Large cap, incl. a bank (different balance-sheet shape)
  "RELIANCE", "HDFCBANK", "ITC",
  // Mid cap
  "CDSL", "HAVELLS", "PIDILITIND",
  // Small cap
  "ALKYLAMINE", "RAJRATAN", "ACRYSIL", "SAFARI",
];

for (const symbol of SAMPLE) {
  const r = await checkSymbol(symbol);
  console.log(JSON.stringify(r));
  await new Promise(res => setTimeout(res, 300)); // don't hammer NSE
}
