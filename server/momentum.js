// The Momentum screen: a short-term (about a month) view on price and volume
// alone — kept apart from the research score on purpose. Nothing here feeds
// Quality or Research, and nothing there feeds this.
//
// A company passes only on a confirmed uptrend: price over its 20-day average,
// over its 50-day, over its 200-day; near its 52-week high; on a day of
// heavier volume; with RSI showing strength but not a blow-off; priced ₹100+
// and trading enough rupees a day to get in and out of. Passers are ranked by
// a momentum score. A day when nothing passes is an answer, not a gap — the
// filters are never relaxed to fill the list.
//
// From the year of NSE daily files the snapshot already keeps (market-data.js
// yearOfDays, refreshed every weekday evening). Settings arrive with each
// request, so anyone can tighten or loosen them for themselves.

// Ranges a setting may take — anything outside is pulled back in
export const MOMENTUM_DEFAULTS = {
  minPrice: 100, // ₹
  minAvgValueCr: 10, // average rupees traded a day over 20 sessions, ₹ Cr
  nearHighPct: 8, // at most this far under the 52-week high
  volSurge: 1.3, // the last session's volume against its 20-day average
  rsiMin: 55,
  rsiMax: 80,
  stopPct: 6, // the calculator's default stop, % under your price
  targetR: 1.75, // the calculator's default target, in multiples of the stop
};
const LIMITS = {
  minPrice: [0, 100000], minAvgValueCr: [0, 1000], nearHighPct: [0, 100], volSurge: [0, 20],
  rsiMin: [0, 100], rsiMax: [0, 100], stopPct: [0.5, 50], targetR: [0.25, 10],
};
// The Momentum tab is short-term trading ground, where SEBI's research-
// analyst rules bite hardest, so on the public host it stays off until it's
// cleared: MOMENTUM=on opens it to everyone, MOMENTUM_USERS=a@x.com,b@y.com
// to those accounts only, MOMENTUM=off closes it. Copies on this Mac (no
// RENDER) have it on.
export function momentumAllowed(account, env = process.env) {
  // Typed into Render's form by hand: "On", " on" count too
  const setting = String(env.MOMENTUM ?? "").trim().toLowerCase();
  if (setting === "on") return true;
  if (setting === "off") return false;
  if (env.MOMENTUM_USERS?.trim()) {
    const allowed = env.MOMENTUM_USERS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    return !!account?.email && allowed.includes(account.email.toLowerCase());
  }
  return !env.RENDER;
}

// Who the tab is open to, for the health check — no emails, just the reach
export function momentumAudience(env = process.env) {
  const setting = String(env.MOMENTUM ?? "").trim().toLowerCase();
  if (setting === "on") return "everyone";
  if (setting === "off") return "off";
  if (env.MOMENTUM_USERS?.trim()) return "named accounts";
  return env.RENDER ? "off" : "everyone";
}

export const MIN_SESSIONS = 210; // under this, too little history for a 200-day average and a year's high
const HIGH_WINDOW = 250; // sessions in "52-week high"

export function cleanMomentumConfig(input = {}) {
  const out = { ...MOMENTUM_DEFAULTS };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    const v = Number(input[key]);
    if (input[key] !== undefined && input[key] !== "" && Number.isFinite(v)) out[key] = Math.min(Math.max(v, lo), hi);
  }
  if (out.rsiMin > out.rsiMax) [out.rsiMin, out.rsiMax] = [out.rsiMax, out.rsiMin];
  return out;
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const r2 = v => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

// RSI on Wilder's smoothing — the same RSI the Discover column and the
// company page show, so one company reads one RSI everywhere
export function rsi14(closes) {
  if (closes.length < 15) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= 14; i++) { const ch = closes[i] - closes[i - 1]; if (ch > 0) gain += ch; else loss -= ch; }
  gain /= 14; loss /= 14;
  for (let i = 15; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    gain = (gain * 13 + Math.max(ch, 0)) / 14;
    loss = (loss * 13 + Math.max(-ch, 0)) / 14;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

// A company's figures from its daily sessions, oldest first:
// [{ close, high, volume }] on today's share basis (splits adjusted).
export function momentumStats(days) {
  const n = days.length;
  if (n < MIN_SESSIONS) return { sessions: n, insufficient: true };
  const closes = days.map(d => d.close);
  const last = closes[n - 1];
  const sma = k => mean(closes.slice(-k));
  const recent = days.slice(-20);
  const vols = recent.map(d => d.volume ?? 0);
  const avgVol20 = mean(vols);
  const high52 = Math.max(...days.slice(-HIGH_WINDOW).map(d => (d.high > 0 ? d.high : d.close)));
  return {
    sessions: n,
    close: r2(last),
    sma20: r2(sma(20)), sma50: r2(sma(50)), sma200: r2(sma(200)),
    avgVol20: Math.round(avgVol20),
    // Rupees traded a day: each session's close × its volume, averaged
    avgValueCr: r2(mean(recent.map(d => d.close * (d.volume ?? 0))) / 1e7),
    volToday: days[n - 1].volume ?? null,
    high52: r2(high52),
    pctFromHigh: r2(((high52 - last) / high52) * 100),
    rsi14: r2(rsi14(closes)),
  };
}

// Pass or fail on the settings, with every condition that failed; the score
// for ranking passers (also worked out for those that fail, never shown as
// a pass)
export function evaluateMomentum(stats, config = MOMENTUM_DEFAULTS) {
  if (!stats || stats.insufficient) return { pass: false, insufficient: true, failed: ["Under 210 sessions of price history"], score: null };
  const c = config, s = stats;
  const volRatio = s.avgVol20 > 0 && s.volToday != null ? s.volToday / s.avgVol20 : 0;
  const failed = [];
  if (!(s.close > s.sma20 && s.sma20 > s.sma50 && s.sma50 > s.sma200)) failed.push("Not a stacked uptrend (price > 20-day > 50-day > 200-day average)");
  if (!(s.close >= c.minPrice)) failed.push(`Price under ₹${c.minPrice}`);
  if (!(s.avgValueCr >= c.minAvgValueCr)) failed.push(`Trades under ₹${c.minAvgValueCr} Cr a day`);
  if (!(s.pctFromHigh <= c.nearHighPct)) failed.push(`More than ${c.nearHighPct}% under its 52-week high`);
  if (!(volRatio >= c.volSurge)) failed.push(`Last session's volume under ${c.volSurge}× its 20-day average`);
  if (!(s.rsi14 >= c.rsiMin && s.rsi14 <= c.rsiMax)) failed.push(`RSI outside ${c.rsiMin}–${c.rsiMax}`);
  const score = (50 - s.pctFromHigh) + (s.rsi14 - 50) + Math.min(volRatio, 3) * 10 + (s.close > s.sma200 ? 10 : 0);
  return { pass: failed.length === 0, failed, score: r2(score), volRatio: r2(volRatio) };
}

// The screen over the companies Discover covers (or a list given), using
// the snapshot's stats. resultsDates: { SYMBOL: "2026-10-23" } from NSE's
// board-meeting calendar; null when it couldn't be read.
export function screenMomentum({ rows, snapshot, config: input, symbols = null, today = snapshot?.pricesDate }) {
  const config = cleanMomentumConfig(input);
  const wanted = symbols?.length ? new Set(symbols.map(s => String(s).toUpperCase())) : null;
  const universe = wanted ? rows.filter(m => wanted.has(m.symbol)) : rows;
  const stats = snapshot?.momentum ?? {};
  const resultsDates = snapshot?.resultsDates ?? null;
  const counts = { screened: universe.length, insufficient: 0, noData: 0, passed: 0 };
  const passers = [];
  const soon = iso => {
    if (!iso || !today) return false;
    const days = (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
    return days >= 0 && days <= 30;
  };
  for (const m of universe) {
    const s = stats[m.symbol];
    if (!s) { counts.noData++; continue; }
    if (s.insufficient) { counts.insufficient++; continue; }
    const e = evaluateMomentum(s, config);
    if (!e.pass) continue;
    const nextResults = resultsDates ? resultsDates[m.symbol] ?? null : null;
    passers.push({
      symbol: m.symbol, name: m.name, sector: m.sector ?? null,
      ...s, score: e.score, volRatio: e.volRatio, ret1m: m.ret1m ?? null,
      nextResults, resultsSoon: soon(nextResults),
    });
  }
  passers.sort((a, b) => b.score - a.score);
  counts.passed = passers.length;
  // Data built before this screen existed has no figures at all: that's
  // "not available yet", never "nothing passes"
  const available = !!snapshot?.momentum;
  return { asOf: snapshot?.pricesDate ?? null, available, config, defaults: MOMENTUM_DEFAULTS, counts, resultsKnown: resultsDates != null, passers };
}
