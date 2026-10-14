// Indicator maths for the stock page's price chart (PriceChartPanel.jsx).
// Each returns an array the same length as its input, null where the window
// isn't full yet, so values line up with the bars they belong to.

// Daily bars into weekly or monthly ones: open of the first day, close of the
// last, the period's high and low, volume summed. Dated by the first trading day.
export function aggregateBars(bars, interval) {
  if (interval === "D") return bars;
  const key = d => {
    if (interval === "M") return d.slice(0, 7);
    // ISO week: the Monday on or before the date
    const t = new Date(d + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    return t.toISOString().slice(0, 10);
  };
  const out = [];
  let cur = null, curKey = null;
  for (const b of bars) {
    const k = key(b.date);
    if (k !== curKey) {
      if (cur) out.push(cur);
      cur = { ...b }; curKey = k;
    } else {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      if (b.partial) cur.partial = true; // a week or month still trading
      cur.volume = cur.volume == null && b.volume == null ? null : (cur.volume ?? 0) + (b.volume ?? 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

// Seeded with the simple average of the first n values, as TradingView does
export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  if (values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = values.slice(0, n).reduce((a, v) => a + v, 0) / n;
  out[n - 1] = prev;
  for (let i = n; i < values.length; i++) out[i] = prev = values[i] * k + prev * (1 - k);
  return out;
}

export function bollinger(values, n = 20, mult = 2) {
  const mid = sma(values, n);
  const upper = new Array(values.length).fill(null), lower = new Array(values.length).fill(null);
  for (let i = n - 1; i < values.length; i++) {
    let sq = 0;
    for (let j = i - n + 1; j <= i; j++) sq += (values[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sq / n); // population SD, as TradingView's BB uses
    upper[i] = mid[i] + mult * sd;
    lower[i] = mid[i] - mult * sd;
  }
  return { mid, upper, lower };
}

// Wilder's smoothing: the first average is a simple mean of n changes
export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const ch = values[i] - values[i - 1];
    if (ch > 0) gain += ch; else loss -= ch;
  }
  gain /= n; loss /= n;
  const val = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  out[n] = val();
  for (let i = n + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(ch, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-ch, 0)) / n;
    out[i] = val();
  }
  return out;
}

export function macd(values, fast = 12, slow = 26, signal = 9) {
  const f = ema(values, fast), s = ema(values, slow);
  const line = values.map((_, i) => (f[i] == null || s[i] == null ? null : f[i] - s[i]));
  const start = line.findIndex(v => v != null);
  const sig = new Array(values.length).fill(null);
  if (start >= 0) {
    const tail = ema(line.slice(start), signal);
    tail.forEach((v, i) => { sig[start + i] = v; });
  }
  const hist = line.map((v, i) => (v == null || sig[i] == null ? null : v - sig[i]));
  return { line, signal: sig, hist };
}

// First bar on or after a date, for the 1M…5Y range buttons
export function indexFrom(bars, isoDate) {
  const i = bars.findIndex(b => b.date >= isoDate);
  return i < 0 ? bars.length - 1 : i;
}
