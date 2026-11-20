// India's economy on Markets (20 Nov 2026, the owner: "show how the economy
// of India is working in the market page"). Three sources, each named on the
// page with its date:
//   - RBI's home page "Current Rates": the policy repo rate and the other
//     policy rates, CRR and SLR, call money, government bond yields and the
//     Treasury Bill cut-offs — RBI's figures, credited to RBI
//   - NSE's daily FII/FPI and DII buying and selling in the cash market
//     (/api/fiidiiTradeReact), kept day by day here to build a history
//   - the World Bank's yearly indicators for India (CC BY 4.0: free to reuse,
//     commercially too, with credit): growth, inflation, jobs, trade, reserves
// MoSPI's monthly figures (CPI, IIP, quarterly GDP) aren't here: its API
// couldn't be reached when this was built.
import { NSE_BASE, fetchJson } from "./fetch-nse.js";
import { fetchText } from "./upstream.js";
import { cached } from "./company-extras.js";
import { readCache, writeCache } from "./cache-dir.js";

const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0)";
const keep = name => name;
const readJson = readCache, writeJson = writeCache;
const pct = s => { const n = Number(String(s).replace(/[%\s]/g, "")); return Number.isFinite(n) ? n : null; };

// ---- RBI's current rates -------------------------------------------------------

const text = html => String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

// The "Current Rates" box of rbi.org.in → the rates, or null when it isn't there
export function parseRbiRates(html) {
  const t = text(html);
  const start = t.search(/Current Rates/i);
  if (start < 0) return null;
  const box = t.slice(start, start + 4000);
  const one = re => pct(re.exec(box)?.[1]);
  const repo = one(/Policy Repo Rate\s*:\s*([\d.]+)\s*%/i);
  if (repo == null || repo <= 0 || repo > 20) return null;
  const bonds = [...box.matchAll(/([\d.]+)%\s*GS\s*(\d{4})\s*:\s*([\d.]+)\s*%/gi)]
    .map(m => ({ coupon: pct(m[1]), year: Number(m[2]), yield: pct(m[3]) }))
    .filter(b => b.yield > 0 && b.yield < 25 && b.year > 2000)
    .sort((a, b) => a.year - b.year);
  const bills = [91, 182, 364].map(days => ({ days, yield: one(new RegExp(`${days} day T-bills\\s*:\\s*([\\d.]+)\\s*%`, "i")) })).filter(b => b.yield != null);
  const call = /Call Rates\s*:\s*([\d.]+)%\s*-\s*([\d.]+)%/i.exec(box);
  const asOn = /Government Securities Market[\s\S]*?as on ([A-Z][a-z]+ \d{1,2}, \d{4})/i.exec(box)?.[1] ?? /as on ([A-Z][a-z]+ \d{1,2}, \d{4})/i.exec(box)?.[1] ?? null;
  return {
    repo, sdf: one(/Standing Deposit Facility Rate\s*:\s*([\d.]+)/i), msf: one(/Marginal Standing Facility Rate\s*:\s*([\d.]+)/i),
    bankRate: one(/Bank Rate\s*:\s*([\d.]+)/i), crr: one(/CRR\s*:\s*([\d.]+)/i), slr: one(/SLR\s*:\s*([\d.]+)/i),
    callLow: call ? pct(call[1]) : null, callHigh: call ? pct(call[2]) : null,
    bonds, bills, asOn,
  };
}

// The bond yields as a curve: the shortest bill to the longest bond, and
// whether a longer one yields less than a shorter one (an inversion)
export function curveOf(r) {
  const thisYear = new Date().getUTCFullYear();
  const points = [
    ...(r?.bills ?? []).map(b => ({ label: `${b.days} days`, years: b.days / 365, yield: b.yield })),
    ...(r?.bonds ?? []).map(b => ({ label: `${b.year}`, years: Math.max(0.5, b.year - thisYear), yield: b.yield })),
  ].sort((a, b) => a.years - b.years);
  if (points.length < 2) return null;
  const first = points[0], last = points.at(-1);
  const inverted = points.some((p, i) => i > 0 && p.yield < points[i - 1].yield - 0.05);
  return { points, slope: last.yield - first.yield, inverted };
}

// A read kept `ttl`, its copy saved; a read that fails is tried again a
// minute on (cached()), never kept for the whole `ttl` as a stale one — on 20
// Nov 2026 a single failed first read of RBI's page, just after a restart,
// said "couldn't be read" for six hours while the next four reads worked.
// With nothing read yet since the start, the saved copy, marked stale.
async function freshOr(key, ttl, file, load) {
  try {
    return await cached(key, ttl, async () => { const d = await load(); writeJson(file, d); return d; });
  } catch (e) {
    const last = readJson(file, null);
    if (last) return { ...last, stale: true };
    throw e;
  }
}

function rbiRates() {
  return freshOr("rbi-rates", 6 * 3600_000, keep("rbi-rates.json"), async () => {
    const r = parseRbiRates(await fetchText("https://www.rbi.org.in/", { headers: { "User-Agent": UA }, service: "RBI", maxBytes: 3e6, timeoutMs: 20_000 }));
    if (!r) throw new Error("RBI's current rates weren't on its page");
    return { ...r, curve: curveOf(r), fetchedAt: new Date().toISOString() };
  });
}

// ---- FII and DII flows --------------------------------------------------------

// NSE's answer → { date, fii, dii } in ₹ crore, net (bought − sold)
export function parseFlows(rows) {
  if (!Array.isArray(rows)) return null;
  const pick = re => rows.find(r => re.test(r.category ?? ""));
  const fii = pick(/FII|FPI/i), dii = pick(/DII/i);
  const n = v => { const x = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(x) ? x : null; };
  if (!fii || !dii || !fii.date) return null;
  return { date: fii.date, fii: n(fii.netValue), fiiBuy: n(fii.buyValue), fiiSell: n(fii.sellValue), dii: n(dii.netValue), diiBuy: n(dii.buyValue), diiSell: n(dii.sellValue) };
}

const MON = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const isoOf = d => { const m = /^(\d{1,2})-(\w{3})-(\d{4})$/.exec(d ?? ""); return m && MON[m[2]] ? `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, "0")}` : null; };

async function flows() {
  return cached("fii-dii", 3600_000, async () => {
    const file = keep("fii-dii.json");
    const kept = readJson(file, []);
    try {
      const today = parseFlows(await fetchJson(`${NSE_BASE}/api/fiidiiTradeReact`));
      const iso = isoOf(today?.date);
      if (iso) {
        const next = [...kept.filter(x => x.iso !== iso), { ...today, iso }].sort((a, b) => a.iso.localeCompare(b.iso)).slice(-250);
        writeJson(file, next);
        return next;
      }
    } catch { /* NSE out of reach: the days kept */ }
    return kept;
  });
}

// ---- World Bank ---------------------------------------------------------------

export const INDICATORS = [
  { id: "NY.GDP.MKTP.KD.ZG", key: "growth", label: "GDP growth", unit: "%", about: "How much more the economy produced than the year before, after inflation" },
  { id: "FP.CPI.TOTL.ZG", key: "inflation", label: "Inflation", unit: "%", about: "How much consumer prices rose over the year" },
  { id: "SL.UEM.TOTL.ZS", key: "unemployment", label: "Unemployment", unit: "%", about: "Share of the labour force without a job (the ILO's estimate)" },
  { id: "NE.GDI.TOTL.ZS", key: "investment", label: "Investment", unit: "% of GDP", about: "Spending on factories, roads, homes and machines, as a share of the economy" },
  { id: "BN.CAB.XOKA.GD.ZS", key: "currentAccount", label: "Current account", unit: "% of GDP", about: "What India earns from the world less what it pays; below zero means it pays more" },
  { id: "BX.KLT.DINV.WD.GD.ZS", key: "fdi", label: "Foreign investment (FDI)", unit: "% of GDP", about: "Money foreign companies put into businesses in India" },
  { id: "FI.RES.TOTL.CD", key: "reserves", label: "Forex reserves", unit: "US$ bn", scale: 1e9, about: "Foreign currency and gold RBI holds" },
  { id: "NE.EXP.GNFS.CD", key: "exports", label: "Exports", unit: "US$ bn", scale: 1e9, about: "Goods and services sold abroad" },
  { id: "NY.GDP.MKTP.CD", key: "gdp", label: "Size of the economy", unit: "US$ trn", scale: 1e12, about: "Everything produced in a year, in today's dollars" },
  { id: "NY.GDP.PCAP.CD", key: "perCapita", label: "Income per person", unit: "US$", about: "The economy's size divided by the people" },
];

// The World Bank's answer → [{ year, value }], oldest first, nulls dropped
export function parseWorldBank(json, scale = 1) {
  const rows = Array.isArray(json) ? json[1] : null;
  if (!Array.isArray(rows)) return null;
  return rows.filter(r => r.value != null && /^\d{4}$/.test(r.date)).map(r => ({ year: Number(r.date), value: r.value / scale })).sort((a, b) => a.year - b.year);
}

function worldBank() {
  return freshOr("world-bank-india", 24 * 3600_000, keep("world-bank-india.json"), async () => {
      const out = [];
      let updated = null;
      for (const ind of INDICATORS) {
        const json = await fetchJson(`https://api.worldbank.org/v2/country/IND/indicator/${ind.id}?format=json&per_page=11&mrv=11`).catch(() => null);
        const years = parseWorldBank(json, ind.scale ?? 1);
        if (years?.length) out.push({ ...ind, years });
        updated = json?.[0]?.lastupdated ?? updated;
      }
      // all ten, or try again: a passing failure mustn't drop a figure for a day
      if (out.length < INDICATORS.length) throw new Error("The World Bank's figures couldn't all be read");
      return { indicators: out, updated, fetchedAt: new Date().toISOString() };
  });
}

// ---- together -----------------------------------------------------------------

export async function economy() {
  const [rates, flowDays, wb] = await Promise.all([rbiRates().catch(() => null), flows().catch(() => []), worldBank().catch(() => null)]);
  return { rates, flows: flowDays.slice(-30), worldBank: wb };
}
