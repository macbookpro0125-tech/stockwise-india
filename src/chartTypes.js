// Chart types and levels worked out from the daily bars (31 Oct 2026):
// Heikin Ashi candles, Renko bricks, and Fibonacci levels between the
// year's low and high. Plain arithmetic on NSE's closes — nothing drawn by
// eye. Bars: { date, open, high, low, close }, oldest first.

// Heikin Ashi: each candle averages the bar with the one before, so runs
// read as runs. Close = the bar's average; open = the middle of the last
// candle's open and close; high and low take in both.
export function heikinAshi(bars) {
  const out = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ ...b, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close) });
  }
  return out;
}

// A Renko brick's size: 1% of the latest close, rounded to a tidy step
// (₹0.5 under ₹100, ₹1 to ₹1,000, ₹5 to ₹5,000, ₹10 above)
export function renkoBox(bars) {
  const last = bars.at(-1)?.close;
  if (!(last > 0)) return null;
  const step = last < 100 ? 0.5 : last < 1000 ? 1 : last < 5000 ? 5 : 10;
  return Math.max(step, Math.round((last * 0.01) / step) * step);
}

// Renko: a brick for every full box the close moves; a turn needs two
// boxes against the last brick. Time drops out — each brick keeps the date
// it was made on, several can share one.
export function renko(bars, box = renkoBox(bars)) {
  if (!box || bars.length < 2) return [];
  const out = [];
  let top = bars[0].close, bottom = bars[0].close - box; // the last brick's edges
  let up = null;
  for (const b of bars.slice(1)) {
    const c = b.close;
    while (up !== false && c >= top + box) { out.push({ date: b.date, open: top, close: top + box, up: true }); bottom = top; top += box; up = true; }
    while (up !== true && c <= bottom - box) { out.push({ date: b.date, open: bottom, close: bottom - box, up: false }); top = bottom; bottom -= box; up = false; }
    // a turn: two boxes the other way
    if (up === true && c <= bottom - box) { out.push({ date: b.date, open: bottom, close: bottom - box, up: false }); top = bottom; bottom -= box; up = false; }
    else if (up === false && c >= top + box) { out.push({ date: b.date, open: top, close: top + box, up: true }); bottom = top; top += box; up = true; }
  }
  return out;
}

// Fibonacci levels between the year's low and high (the daily bars of the
// last year): the usual 23.6, 38.2, 50, 61.8 and 78.6% back from the high
export const FIB_STEPS = [0.236, 0.382, 0.5, 0.618, 0.786];
export function fibLevels(dailyBars) {
  if (!dailyBars || dailyBars.length < 20) return null;
  const last = dailyBars[dailyBars.length - 1];
  const from = new Date(`${last.date}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  const since = from.toISOString().slice(0, 10);
  const year = dailyBars.filter(b => b.date > since);
  if (year.length < 20) return null;
  const high = Math.max(...year.map(b => b.high)), low = Math.min(...year.map(b => b.low));
  if (!(high > low)) return null;
  return { high, low, levels: FIB_STEPS.map(r => ({ ratio: r, price: high - (high - low) * r })) };
}
