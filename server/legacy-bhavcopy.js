// NSE's daily price files from before 2019-20 (20 Nov 2026, for ten years of
// prices): the current file (sec_bhavdata_full_DDMMYYYY.csv) only goes back
// to late 2019, and before that NSE kept the older "cm…bhav.csv.zip" — the same
// open, high, low, close and volume for every company, zipped, with each
// company's ISIN and no delivery figures. Read into the same shape as
// market-data.js parseBhavcopy, so price-history.js keeps them alike.
import { inflateRawSync } from "node:zlib";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const SERIES_PREFERENCE = ["EQ", "BE", "BZ", "SM", "ST"];

// https://nsearchives.nseindia.com/content/historical/EQUITIES/2016/NOV/cm15NOV2016bhav.csv.zip
export function legacyUrl(d) {
  const dd = String(d.getUTCDate()).padStart(2, "0"), mon = MONTHS[d.getUTCMonth()], yyyy = d.getUTCFullYear();
  return `https://nsearchives.nseindia.com/content/historical/EQUITIES/${yyyy}/${mon}/cm${dd}${mon}${yyyy}bhav.csv.zip`;
}

// The first file in a zip, as text: its central directory says where the file
// starts and how big it is (the local header's sizes can be blank)
export function unzipFirst(buf) {
  const b = Buffer.from(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const cd = b.readUInt32LE(eocd + 16);
  if (b.readUInt32LE(cd) !== 0x02014b50) throw new Error("zip directory not found");
  const method = b.readUInt16LE(cd + 10), size = b.readUInt32LE(cd + 20), local = b.readUInt32LE(cd + 42);
  if (b.readUInt32LE(local) !== 0x04034b50) throw new Error("zip entry not found");
  const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
  const data = b.subarray(start, start + size);
  if (method === 0) return data.toString("utf8");
  if (method === 8) return inflateRawSync(data).toString("utf8");
  throw new Error(`zip method ${method} not supported`);
}

// "15-NOV-2016" -> "2016-11-15"
const isoOf = s => {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s ?? "").trim());
  const mi = m ? MONTHS.indexOf(m[2].toUpperCase()) : -1;
  return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

// { date, days: Map(symbol -> { open, high, low, close, volume }) }; isinToSymbol
// files a renamed company's old days under its symbol today
export function parseLegacyBhavcopy(csv, isinToSymbol = null) {
  const [header, ...lines] = String(csv).trim().split(/\r?\n/);
  const cols = header.split(",").map(c => c.trim().toUpperCase());
  const at = n => cols.indexOf(n);
  const iSym = at("SYMBOL"), iSeries = at("SERIES"), iOpen = at("OPEN"), iHigh = at("HIGH"), iLow = at("LOW"), iClose = at("CLOSE"), iQty = at("TOTTRDQTY"), iDate = at("TIMESTAMP"), iIsin = at("ISIN");
  if (iSym < 0 || iClose < 0 || iDate < 0) throw new Error("not an NSE bhavcopy");
  const best = new Map();
  let date = null;
  for (const line of lines) {
    const f = line.split(",").map(c => c.trim());
    date ??= isoOf(f[iDate]);
    const rank = SERIES_PREFERENCE.indexOf(f[iSeries]);
    const close = Number(f[iClose]);
    if (rank === -1 || !(close > 0)) continue;
    const sym = (iIsin >= 0 && isinToSymbol?.get(f[iIsin])) || f[iSym];
    const prev = best.get(sym);
    if (!prev || rank < prev.rank) best.set(sym, { rank, open: Number(f[iOpen]), high: Number(f[iHigh]), low: Number(f[iLow]), close, volume: iQty >= 0 ? Number(f[iQty]) : null });
  }
  return { date, days: best };
}
