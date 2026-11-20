// A company's bonds and NCDs on NSE (20 Nov 2026): the ones that traded in
// NSE's cash market (/api/liveBonds-traded-on-cm?type=bonds) — each bond's
// interest rate, maturity, price and the rating it carried at listing — matched
// to the company by the issuer code in its ISIN (INE031A07840 is HUDCO's,
// INE031A01017 its shares). A bond seen once is kept (data/cache/nse-bonds.json)
// until it matures, with the day it last traded, so one quiet day doesn't drop
// it. NSE gives no yield here, nor how often each bond pays interest or
// whether its price includes the interest earned so far — so no yield is
// worked out: one tried on 20 Nov 2026 came to 30% for an IRFC bond. The
// page shows the facts: interest rate, price against face value, maturity,
// the rating at listing, and what the government pays now for as long.
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { cached } from "./company-extras.js";
import { readCache, writeCache } from "./cache-dir.js";
import { getStock } from "./screen.js";
import { govCurve } from "./economy.js";

const FILE = "nse-bonds.json";
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
export const isoOf = s => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(s ?? "")); return m && MON[m[2].toUpperCase()] ? `${m[3]}-${MON[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}` : null; };
const num = v => { const n = Number(String(v ?? "").replace(/,/g, "")); return v != null && v !== "" && v !== "-" && Number.isFinite(n) ? n : null; };
// "INE031A07840" → "031A": the issuer's code, the same in its shares' ISIN
export const issuerOf = isin => (/^IN[EF][0-9A-Z]{4}/.test(String(isin ?? "")) ? String(isin).slice(3, 7) : null);

// NSE's row → our bond, or null when it isn't one we can read
export function bondRow(r, day) {
  const coupon = num(r.coupr), face = num(r.face_value), price = num(r.ltP) ?? num(r.close), maturity = isoOf(r.maturity_date);
  if (!r.isin || !maturity || !(face > 0)) return null;
  return {
    isin: r.isin, symbol: r.symbol, series: r.series ?? null, coupon, face, maturity,
    nextInterest: isoOf(r.nxtip_date), price, changePct: num(r.per), valueCr: num(r.trdValcsv) != null ? num(r.trdValcsv) / 1e7 : null,
    rating: r.credit_rating || null, agency: r.rating_agency || null, traded: day,
  };
}

// The bonds kept: today's trades over the ones seen before, matured ones gone
export function mergeBonds(kept, rows, day, today = day) {
  const out = { ...(kept ?? {}) };
  for (const r of rows ?? []) {
    const b = bondRow(r, day);
    if (b && b.price > 0) out[b.isin] = b;
  }
  for (const [isin, b] of Object.entries(out)) if (!b.maturity || b.maturity < today) delete out[isin];
  return out;
}

const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function allBonds() {
  return cached("nse-bonds", 30 * 60_000, async () => {
    const kept = readCache(FILE, {});
    const d = await fetchJson(`${NSE_BASE}/api/liveBonds-traded-on-cm?type=bonds`);
    if (!Array.isArray(d?.data)) throw new Error("NSE's bond prices couldn't be read");
    const day = isoOf(d.timeStamp) ?? todayIst();
    const merged = mergeBonds(kept, d.data, day, todayIst());
    writeCache(FILE, merged);
    return { bonds: merged, asOf: d.timeStamp ?? null };
  }).catch(() => ({ bonds: readCache(FILE, {}), asOf: null, stale: true }));
}

// The government's yield for a loan of `years`, between the two nearest
// points of RBI's curve (economy.js)
export function govYieldAt(curve, years) {
  const pts = curve?.points ?? [];
  if (!pts.length || !(years > 0)) return null;
  if (years <= pts[0].years) return pts[0].yield;
  if (years >= pts.at(-1).years) return pts.at(-1).yield;
  const i = pts.findIndex(p => p.years >= years);
  const a = pts[i - 1], b = pts[i];
  return a.yield + ((b.yield - a.yield) * (years - a.years)) / (b.years - a.years);
}

// One company's: [{ …bond, years, currentYield, govYield }], nearest maturity first
export async function companyBonds(symbol) {
  const issuer = issuerOf(getStock(symbol)?.isin);
  if (!issuer) return { bonds: [], asOf: null };
  const [{ bonds, asOf, stale }, curve] = await Promise.all([allBonds(), govCurve().catch(() => null)]);
  const now = Date.parse(`${todayIst()}T00:00:00Z`);
  const list = Object.values(bonds).filter(b => issuerOf(b.isin) === issuer).map(b => {
    const years = (Date.parse(`${b.maturity}T00:00:00Z`) - now) / (365.25 * 864e5);
    // its price against its face value, and what the government pays now for
    // a loan as long — facts side by side, not a yield of our own
    return { ...b, years, vsFace: b.price > 0 && b.face > 0 ? (b.price / b.face - 1) * 100 : null, govYield: govYieldAt(curve, years) };
  }).sort((a, b) => a.maturity.localeCompare(b.maturity));
  return { bonds: list, asOf, stale: !!stale, govAsOn: curve?.asOn ?? null };
}
