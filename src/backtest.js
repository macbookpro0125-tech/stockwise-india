// Test a rule on one company's past prices (20 Nov 2026, the owner, from a
// rival's list: "backtesting"). Long only. A rule is read on each day's
// close; the trade happens at the next day's open, as it could have been
// done. An optional stop-loss sells during the day the price first touches
// it (at the open, if it opened below). Costs: `cost` of each buy and each
// sell (brokerage, STT and the rest, roughly). Taxes left out. A reading of
// the past, never a prediction.

export const RULES = [
  { id: "ma", label: "Price above its moving average", params: [["n", "Average", [20, 50, 100, 200], 50]],
    about: n => `Buy when the price closes above its ${n}-day average; sell when it closes below.` },
  { id: "cross", label: "Golden cross (50 over 200)", params: [],
    about: () => "Buy when the 50-day average crosses above the 200-day; sell when it crosses back below." },
  { id: "breakout", label: "Breakout to a new high", params: [["n", "High of the last", [20, 50, 250], 50]],
    about: n => `Buy when the price closes above its highest close of the ${n === 250 ? "last year" : `last ${n} days`}; sell when it closes below its lowest close of the last ${Math.max(10, Math.round(n / 2.5))} days.` },
  { id: "rsi", label: "RSI: buy weak, sell strong", params: [["n", "Buy under", [25, 30, 35], 30]],
    about: n => `Buy when the 14-day RSI closes under ${n}; sell when it closes over 70.` },
];
export const STOPS = [0, 5, 8, 10, 15];

const sma = (closes, n) => {
  const out = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= n) sum -= closes[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
};
// Wilder's 14-day RSI
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = Math.max(d, 0), l = Math.max(-d, 0);
    if (i <= n) { gain += g / n; loss += l / n; if (i === n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss); continue; }
    gain = (gain * (n - 1) + g) / n; loss = (loss * (n - 1) + l) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}
const highest = (closes, i, n) => { if (i < n) return null; let m = -Infinity; for (let k = i - n; k < i; k++) m = Math.max(m, closes[k]); return m; };
const lowest = (closes, i, n) => { if (i < n) return null; let m = Infinity; for (let k = i - n; k < i; k++) m = Math.min(m, closes[k]); return m; };

// Each day: "buy", "sell" or null, from that day's close
export function signals(bars, rule, n) {
  const c = bars.map(b => b.close);
  const out = new Array(c.length).fill(null);
  if (rule === "ma") {
    const a = sma(c, n);
    for (let i = 1; i < c.length; i++) if (a[i] != null && a[i - 1] != null) {
      if (c[i] > a[i] && !(c[i - 1] > a[i - 1])) out[i] = "buy";
      else if (c[i] < a[i] && !(c[i - 1] < a[i - 1])) out[i] = "sell";
    }
    // already above on the first day it can be read: in from there
    const first = a.findIndex(v => v != null);
    if (first >= 0 && c[first] > a[first]) out[first] = "buy";
  } else if (rule === "cross") {
    const f = sma(c, 50), s = sma(c, 200);
    for (let i = 1; i < c.length; i++) if (s[i] != null && s[i - 1] != null) {
      if (f[i] > s[i] && f[i - 1] <= s[i - 1]) out[i] = "buy";
      else if (f[i] < s[i] && f[i - 1] >= s[i - 1]) out[i] = "sell";
    }
  } else if (rule === "breakout") {
    const exitN = Math.max(10, Math.round(n / 2.5));
    for (let i = 0; i < c.length; i++) {
      const hi = highest(c, i, n), lo = lowest(c, i, exitN);
      if (hi != null && c[i] > hi) out[i] = "buy";
      else if (lo != null && c[i] < lo) out[i] = "sell";
    }
  } else if (rule === "rsi") {
    const r = rsi(c);
    for (let i = 0; i < c.length; i++) if (r[i] != null) {
      if (r[i] < n) out[i] = "buy";
      else if (r[i] > 70) out[i] = "sell";
    }
  }
  return out;
}

// bars: oldest first, { date, open, high, low, close }. from: the first day
// counted (the rule's averages are worked out on the days before it too)
export function backtest(bars, { rule = "ma", n = 50, stop = 0, cost = 0.001, from = null } = {}) {
  if (!Array.isArray(bars) || bars.length < 30) return null;
  const sig = signals(bars, rule, n);
  // counted from the first day the rule can be read (or `from`, if later),
  // and holding the shares is counted from the same day
  const warm = { ma: n, cross: 200, breakout: n, rsi: 15 }[rule] ?? 1;
  const asked = from ? bars.findIndex(b => b.date >= from) : 0;
  const start = Math.max(warm, asked < 0 ? bars.length : asked, 1);
  if (start < 1 || start >= bars.length - 1) return null;
  const trades = [];
  let pos = null, equity = 1;
  const curve = [];
  const open = b => (b.open > 0 ? b.open : b.close);
  for (let i = start; i < bars.length; i++) {
    const b = bars[i];
    // yesterday's close said buy or sell: done at today's open
    const said = sig[i - 1];
    if (!pos && said === "buy" && i - 1 >= start - 1) {
      pos = { entryDate: b.date, entryPrice: open(b), at: i, stopPrice: stop ? open(b) * (1 - stop / 100) : null };
      equity *= 1 - cost;
    } else if (pos && said === "sell") {
      const p = open(b);
      equity *= (p / pos.last) * (1 - cost);
      trades.push({ ...close(pos, b.date, p, i, "rule") });
      pos = null;
    }
    // the stop, touched during the day
    if (pos && pos.stopPrice && (b.low > 0 ? b.low : b.close) <= pos.stopPrice) {
      const p = Math.min(open(b), pos.stopPrice);
      equity *= (p / (pos.last ?? pos.entryPrice)) * (1 - cost);
      trades.push(close(pos, b.date, p, i, "stop"));
      pos = null;
    }
    if (pos) { equity *= b.close / (pos.last ?? pos.entryPrice); pos.last = b.close; }
    curve.push({ date: b.date, value: equity * 100 });
  }
  const hold = bars.slice(start).map(b => ({ date: b.date, value: (b.close / open(bars[start])) * 100 }));
  const last = bars.at(-1);
  const openTrade = pos ? { entryDate: pos.entryDate, entryPrice: pos.entryPrice, price: last.close, pct: (last.close / pos.entryPrice - 1) * 100, days: daysBetween(pos.entryDate, last.date) } : null;
  const wins = trades.filter(t => t.pct > 0), losses = trades.filter(t => t.pct <= 0);
  const years = daysBetween(bars[start].date, last.date) / 365.25;
  const total = (equity - 1) * 100, holdTotal = (last.close / open(bars[start]) - 1) * 100;
  const perYear = r => (years >= 1 ? (Math.pow(1 + r / 100, 1 / years) - 1) * 100 : null);
  const inMarket = trades.reduce((s, t) => s + t.days, 0) + (openTrade?.days ?? 0);
  return {
    from: bars[start].date, to: last.date, years,
    trades, openTrade,
    total, perYear: perYear(total), holdTotal, holdPerYear: perYear(holdTotal),
    winRate: trades.length ? (wins.length / trades.length) * 100 : null,
    avgWin: wins.length ? wins.reduce((s, t) => s + t.pct, 0) / wins.length : null,
    avgLoss: losses.length ? losses.reduce((s, t) => s + t.pct, 0) / losses.length : null,
    maxDrop: maxDrawdown(curve), holdMaxDrop: maxDrawdown(hold),
    inMarketPct: Math.min(100, (inMarket / Math.max(1, daysBetween(bars[start].date, last.date))) * 100),
    curve, hold,
  };
}

function close(pos, date, price, i, why) {
  return { entryDate: pos.entryDate, entryPrice: pos.entryPrice, exitDate: date, exitPrice: price, pct: (price / pos.entryPrice - 1) * 100, days: daysBetween(pos.entryDate, date), why };
}
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// the largest fall from a high, in %, of a curve [{ value }]
export function maxDrawdown(curve) {
  let peak = -Infinity, worst = 0;
  for (const p of curve) { peak = Math.max(peak, p.value); if (peak > 0) worst = Math.min(worst, (p.value / peak - 1) * 100); }
  return worst;
}
