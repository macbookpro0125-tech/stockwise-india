// More indicators for the price chart (PriceChartPanel.jsx), beside the ones
// in chartMath.js. They take bars ({ date, open, high, low, close, volume })
// and return arrays the same length, null until the window is full, so each
// value lines up with its bar. Formulas are the standard ones (Wilder's
// smoothing where he defined it); chartIndicators.test.js checks each
// against values worked out by hand.

const nulls = n => new Array(n).fill(null);

// A simple average over n non-null values in a row (null while fewer)
function smaOf(values, n) {
  const out = nulls(values.length);
  let sum = 0, run = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) { sum = 0; run = 0; continue; }
    sum += v; run++;
    if (run > n) { sum -= values[i - n]; run = n; }
    if (run === n) out[i] = sum / n;
  }
  return out;
}

const highest = (bars, i, n) => { let h = -Infinity; for (let j = i - n + 1; j <= i; j++) h = Math.max(h, bars[j].high); return h; };
const lowest = (bars, i, n) => { let l = Infinity; for (let j = i - n + 1; j <= i; j++) l = Math.min(l, bars[j].low); return l; };
const trueRange = (bars, i) => {
  const b = bars[i], prev = bars[i - 1];
  return prev ? Math.max(b.high - b.low, Math.abs(b.high - prev.close), Math.abs(b.low - prev.close)) : b.high - b.low;
};

// ---- Pivot points --------------------------------------------------------

// The period a date falls in: a week (from its Monday), month, quarter or year
function periodKey(iso, basis) {
  if (basis === "Y") return iso.slice(0, 4);
  if (basis === "Q") return `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3)}`;
  if (basis === "M") return iso.slice(0, 7);
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

export const PIVOT_LEVELS = ["R3", "R2", "R1", "P", "S1", "S2", "S3"];

function pivotsFrom(h, l, c, kind) {
  const p = (h + l + c) / 3, r = h - l;
  if (kind === "fibonacci") return { P: p, R1: p + 0.382 * r, R2: p + 0.618 * r, R3: p + r, S1: p - 0.382 * r, S2: p - 0.618 * r, S3: p - r };
  if (kind === "camarilla") return { P: p, R1: c + (r * 1.1) / 12, R2: c + (r * 1.1) / 6, R3: c + (r * 1.1) / 4, S1: c - (r * 1.1) / 12, S2: c - (r * 1.1) / 6, S3: c - (r * 1.1) / 4 };
  return { P: p, R1: 2 * p - l, S1: 2 * p - h, R2: p + r, S2: p - r, R3: h + 2 * (p - l), S3: l - 2 * (h - p) };
}

// Each bar gets the pivots worked out from the previous whole period's high,
// low and last close — for this month's bars, last month's. starts marks the
// first bar of each period, where a drawn line breaks.
export function pivotPoints(bars, basis = "M", kind = "classic") {
  const out = Object.fromEntries(PIVOT_LEVELS.map(k => [k, nulls(bars.length)]));
  out.starts = new Array(bars.length).fill(false);
  let key = null, hi = -Infinity, lo = Infinity, last = null, cur = null;
  bars.forEach((b, i) => {
    const k = periodKey(b.date, basis);
    if (k !== key) {
      if (key !== null) cur = pivotsFrom(hi, lo, last, kind);
      key = k; hi = -Infinity; lo = Infinity;
      out.starts[i] = true;
    }
    if (cur) for (const L of PIVOT_LEVELS) out[L][i] = cur[L];
    hi = Math.max(hi, b.high); lo = Math.min(lo, b.low); last = b.close;
  });
  return out;
}

// ---- Volatility and trend ------------------------------------------------

// Average true range, Wilder's smoothing seeded with a simple mean
export function atr(bars, n = 14) {
  const out = nulls(bars.length);
  if (bars.length < n) return out;
  let a = 0;
  for (let i = 0; i < n; i++) a += trueRange(bars, i);
  out[n - 1] = a /= n;
  for (let i = n; i < bars.length; i++) out[i] = a = (a * (n - 1) + trueRange(bars, i)) / n;
  return out;
}

// Supertrend: a line mult × ATR from the bar's midpoint that only tightens,
// under the price while it trends up and over it while it trends down
export function supertrend(bars, period = 10, mult = 3) {
  const a = atr(bars, period);
  const value = nulls(bars.length), up = nulls(bars.length);
  let fu = null, fl = null, isUp = null;
  for (let i = 0; i < bars.length; i++) {
    if (a[i] == null) continue;
    const b = bars[i], prevClose = bars[i - 1]?.close;
    const mid = (b.high + b.low) / 2, bu = mid + mult * a[i], bl = mid - mult * a[i];
    fu = fu == null || bu < fu || prevClose > fu ? bu : fu;
    fl = fl == null || bl > fl || prevClose < fl ? bl : fl;
    if (isUp == null) isUp = false;
    else if (isUp && b.close < fl) isUp = false;
    else if (!isUp && b.close > fu) isUp = true;
    value[i] = isUp ? fl : fu;
    up[i] = isUp;
  }
  return { value, up };
}

// Parabolic SAR (Wilder): a stop that accelerates toward the trend's extreme
export function psar(bars, start = 0.02, step = 0.02, max = 0.2) {
  const out = nulls(bars.length);
  if (bars.length < 2) return out;
  let up = bars[1].close >= bars[0].close;
  let ep = up ? Math.max(bars[0].high, bars[1].high) : Math.min(bars[0].low, bars[1].low);
  let sar = up ? Math.min(bars[0].low, bars[1].low) : Math.max(bars[0].high, bars[1].high);
  let af = start;
  out[1] = sar;
  for (let i = 2; i < bars.length; i++) {
    const b = bars[i];
    sar += af * (ep - sar);
    if (up) {
      sar = Math.min(sar, bars[i - 1].low, bars[i - 2].low);
      if (b.low < sar) { up = false; sar = ep; ep = b.low; af = start; }
      else if (b.high > ep) { ep = b.high; af = Math.min(af + step, max); }
    } else {
      sar = Math.max(sar, bars[i - 1].high, bars[i - 2].high);
      if (b.high > sar) { up = true; sar = ep; ep = b.high; af = start; }
      else if (b.low < ep) { ep = b.low; af = Math.min(af + step, max); }
    }
    out[i] = sar;
  }
  return out;
}

// Donchian channel: the highest high and lowest low of the last n bars
export function donchian(bars, n = 20) {
  const upper = nulls(bars.length), lower = nulls(bars.length), mid = nulls(bars.length);
  for (let i = n - 1; i < bars.length; i++) {
    upper[i] = highest(bars, i, n); lower[i] = lowest(bars, i, n);
    mid[i] = (upper[i] + lower[i]) / 2;
  }
  return { upper, lower, mid };
}

// ADX with +DI and −DI (Wilder, period n)
export function adx(bars, n = 14) {
  const plusDI = nulls(bars.length), minusDI = nulls(bars.length), out = nulls(bars.length);
  if (bars.length <= n) return { adx: out, plusDI, minusDI };
  let sTR = 0, sP = 0, sM = 0, sumDX = 0, a = null;
  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].high - bars[i - 1].high, downMove = bars[i - 1].low - bars[i].low;
    const pdm = upMove > downMove && upMove > 0 ? upMove : 0;
    const mdm = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = trueRange(bars, i);
    if (i <= n) { sTR += tr; sP += pdm; sM += mdm; }
    else { sTR = sTR - sTR / n + tr; sP = sP - sP / n + pdm; sM = sM - sM / n + mdm; }
    if (i < n) continue;
    const p = sTR ? (100 * sP) / sTR : 0, m = sTR ? (100 * sM) / sTR : 0;
    plusDI[i] = p; minusDI[i] = m;
    const dx = p + m ? (100 * Math.abs(p - m)) / (p + m) : 0;
    if (i < 2 * n - 1) sumDX += dx;
    else if (i === 2 * n - 1) out[i] = a = (sumDX + dx) / n;
    else out[i] = a = (a * (n - 1) + dx) / n;
  }
  return { adx: out, plusDI, minusDI };
}

// ---- Momentum ------------------------------------------------------------

// Stochastic: where the close sits in the last k bars' range, smoothed
export function stochastic(bars, k = 14, smooth = 3, d = 3) {
  const raw = nulls(bars.length);
  for (let i = k - 1; i < bars.length; i++) {
    const h = highest(bars, i, k), l = lowest(bars, i, k);
    raw[i] = h === l ? 50 : (100 * (bars[i].close - l)) / (h - l);
  }
  const slowK = smooth > 1 ? smaOf(raw, smooth) : raw;
  return { k: slowK, d: d > 1 ? smaOf(slowK, d) : slowK };
}

// Williams %R: 0 at the window's high, −100 at its low
export function williamsR(bars, n = 14) {
  const out = nulls(bars.length);
  for (let i = n - 1; i < bars.length; i++) {
    const h = highest(bars, i, n), l = lowest(bars, i, n);
    out[i] = h === l ? -50 : (-100 * (h - bars[i].close)) / (h - l);
  }
  return out;
}

const typical = b => (b.high + b.low + b.close) / 3;

// Commodity Channel Index: typical price against its average, in mean deviations
export function cci(bars, n = 20) {
  const tp = bars.map(typical), avg = smaOf(tp, n), out = nulls(bars.length);
  for (let i = n - 1; i < bars.length; i++) {
    let md = 0;
    for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - avg[i]);
    md /= n;
    out[i] = md === 0 ? 0 : (tp[i] - avg[i]) / (0.015 * md);
  }
  return out;
}

// ---- Volume --------------------------------------------------------------

// On-balance volume: volume added on an up close, taken away on a down one
export function obv(bars) {
  const out = nulls(bars.length);
  if (!bars.length) return out;
  out[0] = 0;
  for (let i = 1; i < bars.length; i++) {
    const v = bars[i].volume ?? 0, ch = bars[i].close - bars[i - 1].close;
    out[i] = out[i - 1] + (ch > 0 ? v : ch < 0 ? -v : 0);
  }
  return out;
}

// Money Flow Index: RSI-like, on typical price × volume over n bars
export function mfi(bars, n = 14) {
  const out = nulls(bars.length);
  const tp = bars.map(typical);
  for (let i = n; i < bars.length; i++) {
    let pos = 0, neg = 0;
    for (let j = i - n + 1; j <= i; j++) {
      const flow = tp[j] * (bars[j].volume ?? 0);
      if (tp[j] > tp[j - 1]) pos += flow; else if (tp[j] < tp[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? (pos === 0 ? 50 : 100) : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

// The highest high in the year to the last bar (dailyBars: the daily bars,
// whatever the chart's interval), and the last close's distance below it in %
export function yearHigh(dailyBars) {
  if (!dailyBars?.length) return null;
  const last = dailyBars[dailyBars.length - 1];
  const from = new Date(`${last.date}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const fromIso = from.toISOString().slice(0, 10);
  let high = null;
  for (const b of dailyBars) if (b.date > fromIso && b.high > 0 && (high == null || b.high > high.price)) high = { price: b.high, date: b.date };
  if (!high) return null;
  return { ...high, belowPct: ((high.price - last.close) / high.price) * 100 };
}

// Each bar's volume as a multiple of the average of the n bars before it
// (null until there are n, or with no volume)
export function volumeRatio(bars, n = 50) {
  const out = bars.map(() => null);
  let sum = 0, count = 0;
  for (let i = 0; i < bars.length; i++) {
    if (i >= n) {
      if (count === n && sum > 0 && bars[i].volume != null) out[i] = bars[i].volume / (sum / n);
      const old = bars[i - n].volume;
      if (old != null) { sum -= old; count--; }
    }
    if (bars[i].volume != null) { sum += bars[i].volume; count++; }
  }
  return out;
}

// The price against an index: close ÷ the index's close on the bar's last
// day (benchCloses: [[date, close]] daily, oldest first), rebased to 100 at
// the first bar both have. A bar is a day, week or month starting on its
// date; its last day is the last index day before the next bar starts.
export function relativeLine(bars, benchCloses) {
  if (!bars?.length || !benchCloses?.length) return bars?.map(() => null) ?? [];
  const days = benchCloses.filter(([, c]) => c > 0);
  const out = [];
  let j = -1, base = null;
  for (let i = 0; i < bars.length; i++) {
    const next = bars[i + 1]?.date;
    while (j + 1 < days.length && (next == null || days[j + 1][0] < next)) j++;
    const idx = j >= 0 && days[j][0] >= bars[i].date ? days[j][1] : null;
    const ratio = idx ? bars[i].close / idx : null;
    if (ratio != null && base == null) base = ratio;
    out.push(ratio == null ? null : (ratio / base) * 100);
  }
  return out;
}
