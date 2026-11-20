// One-time read (20 Nov 2026, the owner: the gold chart "does not show 5 years
// back"): the gold and Nifty ETFs' daily prices from before the price history
// starts (late Oct 2021), back ten years, from NSE's archived daily files
// (legacy-bhavcopy.js), one file at a time with a pause. Written to
// server/etf-history-old.json, on today's unit (the funds split their units in
// Dec 2019: each split found as a day-to-day jump of 5× or more, rounded to its
// ratio). Run again with --from YYYY-MM-DD to go further back.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { legacyUrl, unzipFirst, parseLegacyBhavcopy } from "../server/legacy-bhavcopy.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "server/etf-history-old.json");
const SYMBOLS = ["GOLDBEES", "NIFTYBEES"];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg("--from", "2016-10-17"), TO = arg("--to", "2021-10-22");
const PROGRESS = join(ROOT, "data/cache/etf-history-old.progress.json");
const UA = "Mozilla/5.0 (compatible; JocularInsights/1.0; educational)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

const raw = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, "utf8")) : { done: {}, bars: {} };
for (const s of SYMBOLS) raw.bars[s] ??= {};
let n = 0;
for (let t = Date.parse(`${TO}T00:00:00Z`); t >= Date.parse(`${FROM}T00:00:00Z`); t -= 86_400_000) {
  const d = new Date(t), iso = d.toISOString().slice(0, 10), wd = d.getUTCDay();
  if (wd === 0 || wd === 6 || raw.done[iso]) continue;
  try {
    const res = await fetch(legacyUrl(d), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) { raw.done[iso] = "closed"; }
    else if (!res.ok) throw new Error(`HTTP ${res.status}`);
    else {
      const { date, days } = parseLegacyBhavcopy(unzipFirst(Buffer.from(await res.arrayBuffer())));
      // a file whose own date can't be read is the day asked for
      for (const s of SYMBOLS) { const b = days.get(s); if (b) raw.bars[s][date ?? iso] = [b.open, b.high, b.low, b.close]; }
      raw.done[iso] = true;
    }
  } catch (e) { console.log(iso, "failed:", e.message); await sleep(3000); continue; }
  if (++n % 50 === 0) { writeFileSync(PROGRESS, JSON.stringify(raw)); console.log(iso, n); }
  await sleep(400);
}
writeFileSync(PROGRESS, JSON.stringify(raw));

// oldest first, on today's unit
const out = { source: "NSE archived daily bhavcopies", made: new Date().toISOString().slice(0, 10), splits: {}, bars: {} };
for (const s of SYMBOLS) {
  const rows = Object.entries(raw.bars[s]).sort(([a], [b]) => a.localeCompare(b));
  let f = 1; const adj = [], splits = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const [date, [o, h, l, c]] = rows[i];
    const next = rows[i + 1]?.[1]?.[3];
    if (next && c / next >= 5) { const r = c / next, ratio = [10, 100, 1000].find(x => Math.abs(r / x - 1) < 0.25) ?? Math.round(r); f *= ratio; splits.push({ before: date, ratio }); }
    const q = v => Math.round((v / f) * 10000) / 10000;
    adj.push([date, q(o), q(h), q(l), q(c)]);
  }
  out.bars[s] = adj.reverse();
  out.splits[s] = splits;
}
writeFileSync(OUT, JSON.stringify(out));
console.log("written", Object.fromEntries(SYMBOLS.map(s => [s, [out.bars[s].length, out.bars[s][0]?.[0], out.bars[s].at(-1)?.[0], out.splits[s]]])));
