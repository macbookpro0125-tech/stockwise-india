// The chart's longer list of indicators (1 Nov 2026, the owner: "do everything"
// from a broker app's list). Each is the standard formula on the daily bars
// ({ date, open, high, low, close, volume }, oldest first) and gives arrays the
// length of the bars, null until its window is full. PriceChartPanel.jsx draws
// them from this table, so a new one is one entry. chartStudies.test.js checks them.
const blank = n => new Array(n).fill(null);
const num = v => v != null && Number.isFinite(v);

export function smaN(v, n) {
  const out = blank(v.length);
  let sum = 0, run = 0;
  for (let i = 0; i < v.length; i++) {
    if (!num(v[i])) { sum = 0; run = 0; continue; }
    sum += v[i]; run++;
    if (run > n) { sum -= v[i - n]; run = n; }
    if (run === n) out[i] = sum / n;
  }
  return out;
}
export function emaN(v, n) {
  const out = blank(v.length), k = 2 / (n + 1);
  let prev = null, seed = 0, run = 0;
  for (let i = 0; i < v.length; i++) {
    if (!num(v[i])) continue;
    if (prev == null) { seed += v[i]; run++; if (run === n) { prev = seed / n; out[i] = prev; } continue; }
    prev = v[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
const wmaN = (v, n) => v.map((_, i) => {
  if (i < n - 1) return null;
  let s = 0;
  for (let j = 0; j < n; j++) { if (!num(v[i - j])) return null; s += v[i - j] * (n - j); }
  return s / (n * (n + 1) / 2);
});
const stdN = (v, n) => v.map((_, i) => {
  if (i < n - 1) return null;
  const w = v.slice(i - n + 1, i + 1);
  if (!w.every(num)) return null;
  const m = w.reduce((a, b) => a + b, 0) / n;
  return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / n);
});
const roll = (v, n, f) => v.map((_, i) => (i < n - 1 ? null : f(v.slice(i - n + 1, i + 1))));
const hi = (v, n) => roll(v, n, w => Math.max(...w));
const lo = (v, n) => roll(v, n, w => Math.min(...w));
const sumN = (v, n) => v.map((_, i) => {
  if (i < n - 1) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) { if (!num(v[j])) return null; s += v[j]; }
  return s;
});
const zip = (f, ...a) => a[0].map((_, i) => (a.every(x => num(x[i])) ? f(...a.map(x => x[i])) : null));
const safe = (a, b) => (b ? a / b : null);
const change = (v, n) => v.map((x, i) => (i >= n && num(x) && num(v[i - n]) ? x - v[i - n] : null));
const roc = (v, n) => v.map((x, i) => (i >= n && num(x) && v[i - n] ? ((x - v[i - n]) / v[i - n]) * 100 : null));
const wilder = (v, n) => {
  const out = blank(v.length);
  let prev = null, seed = 0, run = 0;
  for (let i = 0; i < v.length; i++) {
    if (!num(v[i])) continue;
    if (prev == null) { seed += v[i]; run++; if (run === n) { prev = seed / n; out[i] = prev; } continue; }
    prev = (prev * (n - 1) + v[i]) / n;
    out[i] = prev;
  }
  return out;
};
const cols = bars => ({
  O: bars.map(b => b.open), H: bars.map(b => b.high), L: bars.map(b => b.low), C: bars.map(b => b.close), V: bars.map(b => b.volume ?? 0),
  TP: bars.map(b => (b.high + b.low + b.close) / 3), MP: bars.map(b => (b.high + b.low) / 2),
  TR: bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low)),
});
function rsiOf(C, n = 14) {
  const up = C.map((c, i) => (i ? Math.max(c - C[i - 1], 0) : null)), dn = C.map((c, i) => (i ? Math.max(C[i - 1] - c, 0) : null));
  return zip((u, d) => (d === 0 ? 100 : 100 - 100 / (1 + u / d)), wilder(up, n), wilder(dn, n));
}
const stochOf = (v, n) => { const h = hi(v.map(x => x ?? -Infinity), n), l = lo(v.map(x => x ?? Infinity), n); return v.map((x, i) => (num(x) && num(h[i]) && num(l[i]) && h[i] > l[i] ? ((x - l[i]) / (h[i] - l[i])) * 100 : null)); };
const slope = (v, n) => v.map((_, i) => {
  if (i < n - 1) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let j = 0; j < n; j++) { const y = v[i - n + 1 + j]; if (!num(y)) return null; sx += j; sy += y; sxy += j * y; sxx += j * j; syy += y * y; }
  const d = n * sxx - sx * sx, m = (n * sxy - sx * sy) / d, b = (sy - m * sx) / n, rd = (n * syy - sy * sy) * d;
  return { m, b, r2: rd > 0 ? ((n * sxy - sx * sy) ** 2) / rd : 0, end: b + m * (n - 1), next: b + m * n };
});
const pick = (a, k) => a.map(x => (x ? x[k] : null));
const push = (v, by) => v.map((_, i) => (i >= by ? v[i - by] : null)); // moved later along the bars

export function zigzag(bars, pct = 5) {
  const out = blank(bars.length);
  if (bars.length < 2) return out;
  let dir = 0, pivot = 0;
  out[0] = bars[0].close;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], p = bars[pivot];
    if (dir >= 0 && b.high >= (dir > 0 ? p.high : p.close)) { if (dir > 0) { pivot = i; } else if (b.high >= p.close * (1 + pct / 100)) { dir = 1; pivot = i; } }
    if (dir <= 0 && b.low <= (dir < 0 ? p.low : p.close)) { if (dir < 0) { pivot = i; } else if (b.low <= p.close * (1 - pct / 100)) { dir = -1; pivot = i; } }
    if (dir > 0 && b.low <= bars[pivot].high * (1 - pct / 100)) { out[pivot] = bars[pivot].high; dir = -1; pivot = i; }
    else if (dir < 0 && b.high >= bars[pivot].low * (1 + pct / 100)) { out[pivot] = bars[pivot].low; dir = 1; pivot = i; }
  }
  out[pivot] = dir > 0 ? bars[pivot].high : dir < 0 ? bars[pivot].low : bars[pivot].close;
  // joined straight between the turns
  let a = 0;
  for (let i = 1; i < out.length; i++) if (out[i] != null) { for (let j = a + 1; j < i; j++) out[j] = out[a] + ((out[i] - out[a]) * (j - a)) / (i - a); a = i; }
  return out;
}

// A box: a high not passed for three bars is its top, the low after it not broken
// for three more its bottom; it ends where the price leaves it
export function darvas(bars) {
  const top = blank(bars.length), bottom = blank(bars.length);
  let t = null, b = null, tAt = 0;
  for (let i = 0; i < bars.length; i++) {
    if (t != null && b != null) {
      if (bars[i].close > t || bars[i].close < b) { t = null; b = null; tAt = i; }
      else { top[i] = t; bottom[i] = b; continue; }
    }
    if (i < tAt + 3) continue;
    const h = Math.max(...bars.slice(i - 3, i + 1).map(x => x.high));
    if (bars[i - 3].high === h) {
      const l = Math.min(...bars.slice(i - 2, i + 1).map(x => x.low));
      t = h; b = l; top[i] = t; bottom[i] = b;
    }
  }
  return { top, bottom };
}

// Named patterns only: shapes the candles made, not a view on what follows
export function candlePatterns(bars) {
  const out = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1], body = Math.abs(b.close - b.open), span = b.high - b.low;
    if (span <= 0) continue;
    const top = Math.max(b.open, b.close), bot = Math.min(b.open, b.close);
    const pBody = Math.abs(p.close - p.open);
    let text = null, under = true;
    if (body / span < 0.04) text = "Doji";
    else if (b.close > b.open && p.close < p.open && b.close >= p.open && b.open <= p.close && body > pBody) text = "Bullish engulfing";
    else if (b.close < b.open && p.close > p.open && b.open >= p.close && b.close <= p.open && body > pBody) { text = "Bearish engulfing"; under = false; }
    else if ((bot - b.low) / span > 0.6 && (b.high - top) / span < 0.12) text = "Hammer";
    else if ((b.high - top) / span > 0.6 && (bot - b.low) / span < 0.12) { text = "Shooting star"; under = false; }
    if (text) out.push({ index: i, text, under });
  }
  return out;
}

const P = "Price lines", T = "Trend & bands", V = "Volume", O = "Oscillators", M = "Volatility & statistics", S = "Patterns";
const line = (values, label) => ({ values, label });
const hist = (values, label) => ({ values, label, hist: true });

export const STUDIES = [
  // On the price
  { id: "keltner", label: "Keltner Channel (20, 2)", group: T, calc: b => { const { C, TR } = cols(b), m = emaN(C, 20), a = wilder(TR, 20); return [line(zip((x, y) => x + 2 * y, m, a), "KC up"), line(m, "KC"), line(zip((x, y) => x - 2 * y, m, a), "KC low")]; } },
  { id: "atrbands", label: "ATR Bands (14, 2)", group: T, calc: b => { const { C, TR } = cols(b), a = wilder(TR, 14); return [line(zip((c, y) => c + 2 * y, C, a), "ATR up"), line(zip((c, y) => c - 2 * y, C, a), "ATR low")]; } },
  { id: "atrstop", label: "ATR Trailing Stop (14, 3)", group: T, calc: b => { const { C, TR } = cols(b), a = wilder(TR, 14), out = blank(C.length); for (let i = 1; i < C.length; i++) { if (!num(a[i])) continue; const d = 3 * a[i], p = out[i - 1]; out[i] = p == null ? C[i] - d : C[i] > p && C[i - 1] > p ? Math.max(p, C[i] - d) : C[i] < p && C[i - 1] < p ? Math.min(p, C[i] + d) : C[i] > p ? C[i] - d : C[i] + d; } return [line(out, "ATR stop")]; } },
  { id: "starc", label: "STARC Bands (6, 2)", group: T, calc: b => { const { C, TR } = cols(b), m = smaN(C, 6), a = wilder(TR, 15); return [line(zip((x, y) => x + 2 * y, m, a), "STARC up"), line(zip((x, y) => x - 2 * y, m, a), "STARC low")]; } },
  { id: "envelope", label: "Moving Average Envelope (20, 5%)", group: T, calc: b => { const m = smaN(cols(b).C, 20); return [line(m.map(x => (num(x) ? x * 1.05 : null)), "Env up"), line(m.map(x => (num(x) ? x * 0.95 : null)), "Env low")]; } },
  { id: "highlow", label: "High Low Bands (10)", group: T, calc: b => { const { H, L } = cols(b); return [line(smaN(H, 10), "High avg"), line(smaN(L, 10), "Low avg")]; } },
  { id: "fractal", label: "Fractal Chaos Bands", group: T, calc: b => { const { H, L } = cols(b); const u = blank(H.length), d = blank(L.length); let lu = null, ld = null; for (let i = 0; i < H.length; i++) { if (i >= 4) { if (H[i - 2] === Math.max(...H.slice(i - 4, i + 1))) lu = H[i - 2]; if (L[i - 2] === Math.min(...L.slice(i - 4, i + 1))) ld = L[i - 2]; } u[i] = lu; d[i] = ld; } return [line(u, "Fractal up"), line(d, "Fractal low")]; } },
  { id: "ichimoku", label: "Ichimoku Clouds (9, 26, 52)", group: T, calc: b => { const { H, L, C } = cols(b), mid = n => zip((x, y) => (x + y) / 2, hi(H, n), lo(L, n)), ten = mid(9), kij = mid(26); return [line(ten, "Tenkan"), line(kij, "Kijun"), line(push(zip((x, y) => (x + y) / 2, ten, kij), 26), "Span A"), line(push(mid(52), 26), "Span B"), line(C.map((_, i) => C[i + 26] ?? null), "Chikou")]; } },
  { id: "alligator", label: "Alligator", group: T, calc: b => { const m = cols(b).MP; return [line(push(wilder(m, 13), 8), "Jaw"), line(push(wilder(m, 8), 5), "Teeth"), line(push(wilder(m, 5), 3), "Lips")]; } },
  { id: "guppy", label: "Guppy Moving Averages", group: T, calc: b => { const C = cols(b).C; return [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60].map(n => line(emaN(C, n), `G${n}`)); } },
  { id: "rainbow", label: "Rainbow Moving Average", group: T, calc: b => { let v = cols(b).C; const out = []; for (let i = 1; i <= 10; i++) { v = smaN(v, 2); out.push(line(v, `R${i}`)); } return out; } },
  { id: "vwap", label: "Anchored VWAP (from the year's start, an estimate on daily bars)", group: T, calc: b => { const { TP, V } = cols(b), out = blank(b.length); let pv = 0, vv = 0, y = null; const lastY = b.at(-1)?.date.slice(0, 4); b.forEach((x, i) => { y = x.date.slice(0, 4); if (y !== lastY) return; pv += TP[i] * V[i]; vv += V[i]; out[i] = vv ? pv / vv : null; }); return [line(out, "A-VWAP")]; } },
  { id: "tsf", label: "Time Series Forecast (14)", group: T, calc: b => [line(pick(slope(cols(b).C, 14), "next"), "TSF")] },
  { id: "lrf", label: "Linear Reg Forecast (14)", group: T, calc: b => [line(pick(slope(cols(b).C, 14), "end"), "LR")] },
  { id: "median", label: "Median Price", group: P, calc: b => [line(cols(b).MP, "Median")] },
  { id: "typical", label: "Typical Price", group: P, calc: b => [line(cols(b).TP, "Typical")] },
  { id: "weighted", label: "Weighted Close", group: P, calc: b => [line(b.map(x => (x.high + x.low + 2 * x.close) / 4), "Weighted")] },
  { id: "zigzag", label: "ZigZag (5%)", group: P, calc: b => [line(zigzag(b), "ZigZag")] },
  { id: "darvas", label: "Darvas Box", group: S, calc: b => { const d = darvas(b); return [line(d.top, "Box top"), line(d.bottom, "Box low")]; } },
  { id: "patterns", label: "Candlestick Patterns", group: S, markers: candlePatterns, calc: () => [] },

  // In a pane of their own
  { id: "stochrsi", label: "Stochastic RSI (14)", group: O, pane: true, range: [0, 100], guides: [80, 20], calc: b => { const k = smaN(stochOf(rsiOf(cols(b).C), 14), 3); return [line(k, "%K"), line(smaN(k, 3), "%D")]; } },
  { id: "smi", label: "Stochastic Momentum Index", group: O, pane: true, guides: [40, -40], calc: b => { const { H, L, C } = cols(b), h = hi(H, 13), l = lo(L, 13), d = zip((c, x, y) => c - (x + y) / 2, C, h, l), r = zip((x, y) => x - y, h, l), ds = emaN(emaN(d, 25), 2), rs = emaN(emaN(r, 25), 2), v = zip((x, y) => safe(x, y / 2) * 100, ds, rs); return [line(v, "SMI"), line(emaN(v, 3), "Signal")]; } },
  { id: "roc", label: "Price Rate of Change (12)", group: O, pane: true, guides: [0], calc: b => [line(roc(cols(b).C, 12), "ROC")] },
  { id: "momentum", label: "Momentum Indicator (10)", group: O, pane: true, guides: [0], calc: b => [line(change(cols(b).C, 10), "Mom")] },
  { id: "aroon", label: "Aroon (25)", group: O, pane: true, range: [0, 100], guides: [70, 30], calc: b => { const { H, L } = cols(b), since = (v, f) => v.map((_, i) => { if (i < 25) return null; const w = v.slice(i - 25, i + 1), x = f(...w); return ((25 - (25 - w.lastIndexOf(x))) / 25) * 100; }); return [line(since(H, Math.max), "Up"), line(since(L, Math.min), "Down")]; } },
  { id: "aroonosc", label: "Aroon Oscillator (25)", group: O, pane: true, guides: [0], calc: b => { const { H, L } = cols(b), since = (v, f) => v.map((_, i) => { if (i < 25) return null; const w = v.slice(i - 25, i + 1); return (w.lastIndexOf(f(...w)) / 25) * 100; }); return [line(zip((u, d) => u - d, since(H, Math.max), since(L, Math.min)), "Aroon")]; } },
  { id: "ao", label: "Awesome Oscillator", group: O, pane: true, guides: [0], calc: b => { const m = cols(b).MP; return [hist(zip((x, y) => x - y, smaN(m, 5), smaN(m, 34)), "AO")]; } },
  { id: "bop", label: "Balance of Power", group: O, pane: true, range: [-1, 1], guides: [0], calc: b => [line(smaN(b.map(x => safe(x.close - x.open, x.high - x.low) ?? 0), 14), "BOP")] },
  { id: "cmo", label: "Chande Momentum Oscillator (9)", group: O, pane: true, range: [-100, 100], guides: [50, -50], calc: b => { const C = cols(b).C, u = C.map((c, i) => (i ? Math.max(c - C[i - 1], 0) : null)), d = C.map((c, i) => (i ? Math.max(C[i - 1] - c, 0) : null)); return [line(zip((x, y) => safe(x - y, x + y) * 100, sumN(u, 9), sumN(d, 9)), "CMO")]; } },
  { id: "coppock", label: "Coppock Curve", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C; return [line(wmaN(zip((x, y) => x + y, roc(C, 14), roc(C, 11)), 10), "Coppock")]; } },
  { id: "dpo", label: "Detrended Price Oscillator (20)", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C; return [line(zip((c, m) => c - m, C, push(smaN(C, 20), 11)), "DPO")]; } },
  { id: "disparity", label: "Disparity Index (14)", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C; return [line(zip((c, m) => ((c - m) / m) * 100, C, emaN(C, 14)), "Disparity")]; } },
  { id: "fisher", label: "Ehler Fisher Transform (10)", group: O, pane: true, guides: [0], calc: b => { const { MP } = cols(b), s = stochOf(MP, 10), out = blank(MP.length); let x = 0, f = 0; s.forEach((v, i) => { if (!num(v)) return; x = 0.33 * 2 * (v / 100 - 0.5) + 0.67 * x; x = Math.max(-0.999, Math.min(0.999, x)); f = 0.5 * Math.log((1 + x) / (1 - x)) + 0.5 * f; out[i] = f; }); return [line(out, "Fisher"), line(push(out, 1), "Trigger")]; } },
  { id: "elderray", label: "Elder Ray Index (13)", group: O, pane: true, guides: [0], calc: b => { const { H, L, C } = cols(b), e = emaN(C, 13); return [line(zip((x, y) => x - y, H, e), "Bull"), line(zip((x, y) => x - y, L, e), "Bear")]; } },
  { id: "kst", label: "Pring's Know Sure Thing", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C, k = zip((a, c, d, e) => a + 2 * c + 3 * d + 4 * e, smaN(roc(C, 10), 10), smaN(roc(C, 15), 10), smaN(roc(C, 20), 10), smaN(roc(C, 30), 15)); return [line(k, "KST"), line(smaN(k, 9), "Signal")]; } },
  { id: "ppo", label: "Price Oscillator (12, 26)", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C; return [line(zip((x, y) => ((x - y) / y) * 100, emaN(C, 12), emaN(C, 26)), "PPO")]; } },
  { id: "qstick", label: "QStick (14)", group: O, pane: true, guides: [0], calc: b => [line(smaN(b.map(x => x.close - x.open), 14), "QStick")] },
  { id: "ravi", label: "RAVI (7, 65)", group: O, pane: true, guides: [0], calc: b => { const C = cols(b).C; return [line(zip((x, y) => ((x - y) / y) * 100, smaN(C, 7), smaN(C, 65)), "RAVI")]; } },
  { id: "rvi", label: "Relative Vigor Index (10)", group: O, pane: true, guides: [0], calc: b => { const r = zip((x, y) => safe(x, y), smaN(b.map(x => x.close - x.open), 10), smaN(b.map(x => x.high - x.low), 10)); return [line(r, "RVI"), line(wmaN(r, 4), "Signal")]; } },
  { id: "schaff", label: "Schaff Trend Cycle", group: O, pane: true, range: [0, 100], guides: [75, 25], calc: b => { const C = cols(b).C, m = zip((x, y) => x - y, emaN(C, 23), emaN(C, 50)); return [line(emaN(stochOf(emaN(stochOf(m, 10), 3), 10), 3), "STC")]; } },
  { id: "trix", label: "TRIX (15)", group: O, pane: true, guides: [0], calc: b => [line(roc(emaN(emaN(emaN(cols(b).C, 15), 15), 15), 1), "TRIX")] },
  { id: "ultimate", label: "Ultimate Oscillator", group: O, pane: true, range: [0, 100], guides: [70, 30], calc: b => { const { L, C, TR } = cols(b), bp = C.map((c, i) => (i ? c - Math.min(L[i], C[i - 1]) : null)), avg = n => zip((x, y) => safe(x, y), sumN(bp, n), sumN(TR.map((t, i) => (i ? t : null)), n)); return [line(zip((a, c, d) => (100 * (4 * a + 2 * c + d)) / 7, avg(7), avg(14), avg(28)), "UO")]; } },
  { id: "vortex", label: "Vortex Indicator (14)", group: O, pane: true, guides: [1], calc: b => { const { H, L, TR } = cols(b), up = H.map((h, i) => (i ? Math.abs(h - L[i - 1]) : null)), dn = L.map((l, i) => (i ? Math.abs(l - H[i - 1]) : null)), t = sumN(TR.map((x, i) => (i ? x : null)), 14); return [line(zip((x, y) => safe(x, y), sumN(up, 14), t), "VI+"), line(zip((x, y) => safe(x, y), sumN(dn, 14), t), "VI−")]; } },
  { id: "bbpct", label: "Bollinger %b (20, 2)", group: M, pane: true, guides: [1, 0], calc: b => { const C = cols(b).C, m = smaN(C, 20), s = stdN(C, 20); return [line(zip((c, x, y) => safe(c - (x - 2 * y), 4 * y), C, m, s), "%b")]; } },
  { id: "bbw", label: "Bollinger Bandwidth (20, 2)", group: M, pane: true, calc: b => { const C = cols(b).C; return [line(zip((x, y) => (400 * y) / x, smaN(C, 20), stdN(C, 20)), "BBW")]; } },
  { id: "chop", label: "Choppiness Index (14)", group: M, pane: true, range: [0, 100], guides: [61.8, 38.2], calc: b => { const { H, L, TR } = cols(b); return [line(zip((t, h, l) => (h > l ? (100 * Math.log10(t / (h - l))) / Math.log10(14) : null), sumN(TR, 14), hi(H, 14), lo(L, 14)), "CHOP")]; } },
  { id: "cvol", label: "Chaikin Volatility (10)", group: M, pane: true, guides: [0], calc: b => [line(roc(emaN(b.map(x => x.high - x.low), 10), 10), "CVol")] },
  { id: "dcw", label: "Donchian Width (20)", group: M, pane: true, calc: b => { const { H, L } = cols(b); return [line(zip((x, y) => x - y, hi(H, 20), lo(L, 20)), "Width")]; } },
  { id: "hmr", label: "High Minus Low", group: M, pane: true, calc: b => [line(b.map(x => x.high - x.low), "H−L")] },
  { id: "hhv", label: "Highest High Value (14)", group: M, pane: true, calc: b => [line(hi(cols(b).H, 14), "HHV")] },
  { id: "llv", label: "Lowest Low Value (14)", group: M, pane: true, calc: b => [line(lo(cols(b).L, 14), "LLV")] },
  { id: "hv", label: "Historical Volatility (20)", group: M, pane: true, calc: b => { const C = cols(b).C; return [line(stdN(C.map((c, i) => (i && C[i - 1] > 0 && c > 0 ? Math.log(c / C[i - 1]) : null)), 20).map(x => (num(x) ? x * Math.sqrt(252) * 100 : null)), "HV %")]; } },
  { id: "lrslope", label: "Linear Reg Slope (14)", group: M, pane: true, guides: [0], calc: b => [line(pick(slope(cols(b).C, 14), "m"), "Slope")] },
  { id: "lrr2", label: "Linear Reg R² (14)", group: M, pane: true, range: [0, 1], calc: b => [line(pick(slope(cols(b).C, 14), "r2"), "R²")] },
  { id: "mass", label: "Mass Index (25)", group: M, pane: true, guides: [27], calc: b => { const r = b.map(x => x.high - x.low), e = emaN(r, 9); return [line(sumN(zip((x, y) => safe(x, y), e, emaN(e, 9)), 25), "Mass")]; } },
  { id: "std", label: "Standard Deviation (20)", group: M, pane: true, calc: b => [line(stdN(cols(b).C, 20), "SD")] },
  { id: "tr", label: "True Range", group: M, pane: true, calc: b => [line(cols(b).TR, "TR")] },
  { id: "ulcer", label: "Ulcer Index (14)", group: M, pane: true, calc: b => { const C = cols(b).C, dd = zip((c, h) => ((c - h) / h) * 100, C, hi(C, 14)); return [line(smaN(dd.map(x => (num(x) ? x * x : null)), 14).map(x => (num(x) ? Math.sqrt(x) : null)), "Ulcer")]; } },
  { id: "rvol", label: "Relative Volatility (10)", group: M, pane: true, range: [0, 100], guides: [50], calc: b => { const C = cols(b).C, s = stdN(C, 10), u = s.map((x, i) => (i && num(x) ? (C[i] > C[i - 1] ? x : 0) : null)), d = s.map((x, i) => (i && num(x) ? (C[i] < C[i - 1] ? x : 0) : null)); return [line(zip((x, y) => safe(100 * x, x + y), emaN(u, 14), emaN(d, 14)), "RVol")]; } },
  { id: "ad", label: "Accumulation/Distribution", group: V, pane: true, volume: true, calc: b => { let s = 0; return [line(b.map(x => { s += (safe(2 * x.close - x.low - x.high, x.high - x.low) ?? 0) * (x.volume ?? 0); return s; }), "A/D")]; } },
  { id: "cmf", label: "Chaikin Money Flow (20)", group: V, pane: true, guides: [0], calc: b => { const mf = b.map(x => (safe(2 * x.close - x.low - x.high, x.high - x.low) ?? 0) * (x.volume ?? 0)); return [line(zip((x, y) => safe(x, y), sumN(mf, 20), sumN(b.map(x => x.volume ?? 0), 20)), "CMF")]; } },
  { id: "eom", label: "Ease of Movement (14)", group: V, pane: true, guides: [0], calc: b => { const { MP, V: vol } = cols(b); return [line(smaN(b.map((x, i) => (i && vol[i] ? ((MP[i] - MP[i - 1]) * (x.high - x.low)) / (vol[i] / 1e6) : null)), 14), "EoM")]; } },
  { id: "force", label: "Elder Force Index (13)", group: V, pane: true, volume: true, guides: [0], calc: b => { const { C, V: vol } = cols(b); return [line(emaN(C.map((c, i) => (i ? (c - C[i - 1]) * vol[i] : null)), 13), "Force")]; } },
  { id: "nvi", label: "Negative Volume Index", group: V, pane: true, calc: b => { let v = 1000; return [line(b.map((x, i) => { if (i && (x.volume ?? 0) < (b[i - 1].volume ?? 0) && b[i - 1].close) v *= x.close / b[i - 1].close; return v; }), "NVI")]; } },
  { id: "pvi", label: "Positive Volume Index", group: V, pane: true, calc: b => { let v = 1000; return [line(b.map((x, i) => { if (i && (x.volume ?? 0) > (b[i - 1].volume ?? 0) && b[i - 1].close) v *= x.close / b[i - 1].close; return v; }), "PVI")]; } },
  { id: "pvt", label: "Price Volume Trend", group: V, pane: true, volume: true, calc: b => { let s = 0; return [line(b.map((x, i) => { if (i && b[i - 1].close) s += ((x.close - b[i - 1].close) / b[i - 1].close) * (x.volume ?? 0); return s; }), "PVT")]; } },
  { id: "vosc", label: "Volume Oscillator (5, 10)", group: V, pane: true, guides: [0], calc: b => { const v = cols(b).V; return [line(zip((x, y) => safe(x - y, y) * 100, smaN(v, 5), smaN(v, 10)), "VOsc")]; } },
  { id: "vroc", label: "Volume Rate of Change (14)", group: V, pane: true, guides: [0], calc: b => [line(roc(cols(b).V, 14), "VROC")] },
];
export const STUDY_GROUPS = [P, T, V, O, M, S];

// Chart types whose bars are made from the closes, with time dropping out
const lastIs = (rows, up) => rows.length && rows.at(-1).up === up;
export function lineBreak(bars, n = 3) {
  if (bars.length < 2) return [];
  const rows = [{ date: bars[0].date, open: bars[0].open, close: bars[0].close, up: bars[0].close >= bars[0].open }];
  for (const b of bars.slice(1)) {
    const tail = rows.slice(-n), top = Math.max(...tail.map(r => Math.max(r.open, r.close))), low = Math.min(...tail.map(r => Math.min(r.open, r.close)));
    const last = rows.at(-1);
    if (b.close > top) rows.push({ date: b.date, open: lastIs(rows, true) ? last.close : last.open, close: b.close, up: true });
    else if (b.close < low) rows.push({ date: b.date, open: lastIs(rows, false) ? last.close : last.open, close: b.close, up: false });
  }
  return rows;
}
// Kagi: the line carries on while the close keeps going its way, and turns when it
// comes back `pct` percent from the last extreme
export function kagi(bars, pct = 4) {
  if (bars.length < 2) return [];
  const out = [{ date: bars[0].date, value: bars[0].close, up: true }];
  let dir = 0, ext = bars[0].close;
  for (const b of bars.slice(1)) {
    const c = b.close;
    if (dir === 0) { if (Math.abs(c - ext) / ext >= pct / 100) { dir = c > ext ? 1 : -1; ext = c; out.push({ date: b.date, value: c, up: dir > 0 }); } continue; }
    if (dir > 0 ? c > ext : c < ext) { ext = c; out.push({ date: b.date, value: c, up: dir > 0 }); }
    else if (dir > 0 ? c <= ext * (1 - pct / 100) : c >= ext * (1 + pct / 100)) { dir = -dir; ext = c; out.push({ date: b.date, value: c, up: dir > 0 }); }
  }
  return out;
}
