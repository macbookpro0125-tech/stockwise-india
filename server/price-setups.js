// The Desk's market mood and price patterns (31 Oct 2026), from each
// company's own daily bars (price-history.js): which stage of its trend a
// share price is in, and which of a handful of chart patterns it shows today.
// A reading of past prices, never a forecast; every rule is written out here
// so the page can say exactly what each one means.
import { historyBars } from "./price-history.js";
import { loadMarketSnapshot } from "./market-data.js";

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const smaAt = (closes, k, end = closes.length) => (end >= k ? mean(closes.slice(end - k, end)) : null);

// Enough history for a 200-day average a month old
export const MIN_BARS = 222;

// The four stages, from the 50- and 200-day averages and where the 200-day
// is heading (against 21 sessions earlier):
//   advancing  price over a rising 50-day, which is over a rising 200-day
//   declining  price under a falling 50-day, which is under a falling 200-day
//   topping    50-day still over the 200-day, but not advancing
//   basing     50-day at or under the 200-day, but not declining
export const STAGES = [
  { id: "advancing", label: "Advancing", about: "Price over a rising 50-day average, which is over a rising 200-day" },
  { id: "topping", label: "Topping", about: "50-day average still over the 200-day, but the price has lost the climb" },
  { id: "declining", label: "Declining", about: "Price under a falling 50-day average, which is under a falling 200-day" },
  { id: "basing", label: "Basing", about: "50-day average at or under the 200-day, the fall having stopped" },
];

// The patterns; each id is what setupsOf() returns
export const SETUPS = [
  { id: "breakout", label: "Breakout", about: "Closed above every high of the 40 sessions before, on volume 1.4× its 50-day average or more" },
  { id: "nearHigh", label: "Near highs", about: "Advancing, and within 5% of its 52-week high" },
  { id: "pullback", label: "Pullback", about: "Advancing on a rising 200-day, back to within 4% under to 2% over its 50-day, 8–25% off its 3-month high" },
  { id: "tight", label: "Tight weeks", about: "The last three weekly closes within 1.5% of each other, over a 50-day average above the 200-day" },
  { id: "tightening", label: "Tightening range", about: "The last 10 sessions' range under 8% and under half the 20 sessions' before, in an uptrend" },
  { id: "volumeDryUp", label: "Quiet volume", about: "Advancing, and the last 5 sessions' volume under 60% of the 50-day average" },
];

// bars: oldest first, { date, high, low, close, volume } on today's share basis
export function setupsOf(bars) {
  const n = bars?.length ?? 0;
  if (n < MIN_BARS) return null;
  const closes = bars.map(b => b.close);
  const last = closes[n - 1];
  const s50 = smaAt(closes, 50), s200 = smaAt(closes, 200);
  const s50then = smaAt(closes, 50, n - 21), s200then = smaAt(closes, 200, n - 21);
  if (!(last > 0) || s50 == null || s200 == null) return null;
  const rising200 = s200 > s200then, rising50 = s50 > s50then;

  let stage;
  if (last > s50 && s50 > s200 && rising50 && rising200) stage = "advancing";
  else if (last < s50 && s50 < s200 && !rising50 && !rising200) stage = "declining";
  else if (s50 > s200) stage = "topping";
  else stage = "basing";

  const highOf = b => (b.high > 0 ? b.high : b.close);
  const lowOf = b => (b.low > 0 ? b.low : b.close);
  const vols = bars.map(b => b.volume ?? 0);
  const avgVol50 = mean(vols.slice(-51, -1));
  const high52 = Math.max(...bars.slice(-250).map(highOf));
  const high3m = Math.max(...bars.slice(-63).map(highOf));
  const priorHigh40 = Math.max(...bars.slice(-41, -1).map(highOf));
  const range = (from, to) => { const part = bars.slice(from, to); const hi = Math.max(...part.map(highOf)), lo = Math.min(...part.map(lowOf)); return lo > 0 ? (hi - lo) / lo : null; };

  // the last close of each week (Monday-started), newest last
  const weekly = [];
  let wk = null;
  for (const b of bars.slice(-30)) {
    const d = new Date(`${b.date}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    if (monday !== wk) { weekly.push(b.close); wk = monday; } else weekly[weekly.length - 1] = b.close;
  }

  const setups = [];
  if (last > priorHigh40 && avgVol50 > 0 && vols[n - 1] >= 1.4 * avgVol50) setups.push("breakout");
  if (stage === "advancing" && last >= high52 * 0.95) setups.push("nearHigh");
  const off50 = (last / s50 - 1) * 100, off3m = (1 - last / high3m) * 100;
  if (rising200 && last > s200 && s50 > s200 && off50 >= -4 && off50 <= 2 && off3m >= 8 && off3m <= 25) setups.push("pullback");
  const w3 = weekly.slice(-3);
  if (w3.length === 3 && last > s50 && s50 > s200 && (Math.max(...w3) - Math.min(...w3)) / Math.min(...w3) <= 0.015) setups.push("tight");
  const r10 = range(-10), r20 = range(-30, -10);
  if (r10 != null && r20 != null && r10 < 0.08 && r10 < r20 / 2 && last > s50 && s50 > s200) setups.push("tightening");
  if (stage === "advancing" && avgVol50 > 0 && mean(vols.slice(-5)) < 0.6 * avgVol50) setups.push("volumeDryUp");

  return {
    stage, setups,
    above50: last > s50, above200: last > s200,
    // rupees traded a day over 20 sessions, in crore: the mood counts only companies that trade
    valueCr: mean(bars.slice(-20).map(b => b.close * (b.volume ?? 0))) / 1e7,
  };
}

// Counted only where at least this much trades a day, so a few untraded
// shares can't swing the mood
export const LIQUID_CR = 1;

// The whole market's mood and each company's stage and patterns:
// { date, liquid, stages: { id: n }, above50, above200, setups: { id: n },
//   bySymbol: { SYM: { stage, setups } } } — worked out once per day of prices
let cached = null;
export async function deskMarket(symbols, { snapshot = loadMarketSnapshot(), barsOf = sym => historyBars(sym, snapshot) } = {}) {
  const date = snapshot?.pricesDate ?? null;
  if (cached && cached.date === date && cached.count === symbols.length) return cached.value;
  if (cached?.pending && cached.date === date) return cached.pending;
  const pending = (async () => {
    const bySymbol = {};
    const stages = Object.fromEntries(STAGES.map(s => [s.id, 0]));
    const setups = Object.fromEntries(SETUPS.map(s => [s.id, 0]));
    let liquid = 0, a50 = 0, a200 = 0, i = 0;
    for (const sym of symbols) {
      // a breath every 100 companies, so the server keeps answering meanwhile
      if (++i % 100 === 0) await new Promise(r => setImmediate(r));
      let s = null;
      try { s = setupsOf(barsOf(sym)); } catch { s = null; }
      if (!s) continue;
      bySymbol[sym] = { stage: s.stage, setups: s.setups };
      for (const id of s.setups) setups[id]++;
      if (s.valueCr >= LIQUID_CR) { liquid++; stages[s.stage]++; if (s.above50) a50++; if (s.above200) a200++; }
    }
    const value = { date, liquid, stages, above50: liquid ? (a50 / liquid) * 100 : null, above200: liquid ? (a200 / liquid) * 100 : null, setups, bySymbol };
    cached = { date, count: symbols.length, value };
    return value;
  })().catch(e => { cached = null; throw e; });
  cached = { ...(cached ?? {}), date, pending };
  return pending;
}
