// The technical panel in plain words (16 Nov 2026, the owner: "can we improve
// the Technical Analysis"): a few sentences a beginner can read before the
// signal rows. Descriptions of what the price has done, never what to do with
// it (no buy, sell or target words).
const rs = v => `₹${Math.round(v).toLocaleString("en-IN")}`;
const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

export function techLines(d) {
  if (!d || !(d.price > 0)) return [];
  const out = [];
  if (d.sma200 > 0) {
    const gap = (d.price / d.sma200 - 1) * 100;
    out.push({ k: "Long-term trend", tone: gap >= 0 ? "good" : "bad", text: `The price (${rs(d.price)}) is ${Math.abs(gap).toFixed(0)}% ${gap >= 0 ? "above" : "below"} its 200-day average (${rs(d.sma200)}), so the long-term trend is ${gap >= 0 ? "up" : "down"}.` });
  }
  if (d.sma50 > 0 && d.sma200 > 0) {
    const up = d.sma50 > d.sma200;
    out.push({ k: "Medium-term trend", tone: up ? "good" : "bad", text: `Its 50-day average is ${up ? "above" : "below"} the 200-day: the last few months have been ${up ? "stronger" : "weaker"} than the year.` });
  }
  const moves = [d.return20d != null ? `${pct(d.return20d)} in about a month` : null, d.return60d != null ? `${pct(d.return60d)} in about three months` : null].filter(Boolean);
  if (moves.length) out.push({ k: "Recent moves", tone: (d.return20d ?? 0) >= 0 ? "good" : "bad", text: `${moves.join(", ")}.`.replace(/^./, c => c.toUpperCase()) });
  if (d.rsi14 != null) {
    const r = Math.round(d.rsi14);
    out.push(r > 70
      ? { k: "Momentum", tone: "mid", text: `RSI ${r}, over 70: the price has risen fast lately and is stretched.` }
      : r < 30
        ? { k: "Momentum", tone: "mid", text: `RSI ${r}, under 30: the price has fallen fast lately and is stretched on the downside.` }
        : { k: "Momentum", tone: "none", text: `RSI ${r}, between 30 and 70: neither stretched up nor down.` });
  }
  const p = d.pivots;
  if (p) {
    const below = [p.pp, p.s1, p.s2, p.s3].filter(v => v > 0 && v < d.price).sort((a, b) => b - a)[0];
    const above = [p.pp, p.r1, p.r2, p.r3].filter(v => v > 0 && v > d.price).sort((a, b) => a - b)[0];
    if (below || above) out.push({ k: "Nearby levels", tone: "none", text: [below ? `the nearest support below is ${rs(below)}` : null, above ? `the nearest resistance above is ${rs(above)}` : null].filter(Boolean).join("; ").replace(/^./, c => c.toUpperCase()) + ". Prices often pause near these." });
  }
  const s = d.summary;
  if (s?.total) out.push({ k: "All signals", tone: s.bullish > s.bearish ? "good" : s.bearish > s.bullish ? "bad" : "none", text: `Of ${s.total} standard signals, ${s.bullish} point up and ${s.bearish} point down.` });
  return out;
}
