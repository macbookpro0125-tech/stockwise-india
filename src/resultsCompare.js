// How a company's latest quarter compares (23 Oct 2026, results season): in
// plain sentences — against the same quarter a year earlier, against the
// quarter before, the margin, and a run of growth or decline — and the
// quarters for a small chart. Only the company's reported figures, compared;
// no view on what comes next.
//
// quarters: newest first, { end: "2026-09-30", salesCr, profitCr, opm, salesYoY, profitYoY }

const DAY = 86_400_000;
const cr = v => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 })} crore`;
const pct = v => `${Math.abs(v).toFixed(1)}%`;
const growth = (now, then) => (now != null && then != null && then > 0 && now >= 0 ? ((now - then) / then) * 100 : null);
const moved = (v, up = "up", down = "down") => (Math.abs(v) < 0.05 ? "flat" : `${v > 0 ? up : down} ${pct(v)}`);

// the quarter about a year before this one, by its end date
function yearBefore(quarters, q) {
  const t = Date.parse(q.end);
  return quarters.find(x => { const d = (t - Date.parse(x.end)) / DAY; return d > 330 && d < 400; }) ?? null;
}

// yoy: the growth as reported with the figures, if there is one (the list shows the same)
function profitLine(now, then, yoy) {
  if (now == null) return null;
  if (then == null) return yoy != null && now >= 0 ? `Profit ${cr(now)}, ${moved(yoy)} on the same quarter a year earlier.` : `${now < 0 ? "A loss" : "Profit"} of ${cr(now)}.`;
  if (now >= 0 && then > 0) return `Profit ${cr(now)}, ${moved(yoy ?? growth(now, then))} on the same quarter a year earlier (${cr(then)}).`;
  if (now < 0 && then < 0) return `A loss of ${cr(now)}, ${Math.abs(now) < Math.abs(then) ? "smaller than" : Math.abs(now) > Math.abs(then) ? "larger than" : "the same as"} the loss of ${cr(then)} a year earlier.`;
  if (now < 0) return `A loss of ${cr(now)}, against a profit of ${cr(then)} a year earlier.`;
  return `Profit ${cr(now)}, against a loss of ${cr(then)} a year earlier.`;
}

// how many quarters in a row, from the latest, a figure grew (or fell) on a year earlier
function run(quarters, key) {
  const sign = Math.sign(quarters[0]?.[key] ?? 0);
  if (!sign) return { sign: 0, n: 0 };
  let n = 0;
  for (const q of quarters) { if (q[key] == null || Math.sign(q[key]) !== sign) break; n++; }
  return { sign, n };
}

export function compareResults(quarters) {
  const qs = (quarters ?? []).filter(q => q?.end && (q.salesCr != null || q.profitCr != null));
  const [latest, before] = qs;
  if (!latest) return null;
  const ago = yearBefore(qs, latest);
  const lines = [];

  // against a year earlier
  if (latest.salesCr != null) {
    const yoy = latest.salesYoY ?? growth(latest.salesCr, ago?.salesCr);
    lines.push(yoy != null
      ? `Sales ${cr(latest.salesCr)}, ${moved(yoy)} on the same quarter a year earlier${ago?.salesCr != null ? ` (${cr(ago.salesCr)})` : ""}.`
      : `Sales ${cr(latest.salesCr)}.`);
  }
  const profit = profitLine(latest.profitCr, ago?.profitCr ?? null, latest.profitYoY ?? null);
  if (profit) lines.push(profit);

  // against the quarter before (seasons differ, so said as a second look)
  if (before && (Date.parse(latest.end) - Date.parse(before.end)) / DAY < 120) {
    const parts = [];
    const s = growth(latest.salesCr, before.salesCr), p = growth(latest.profitCr, before.profitCr);
    if (s != null) parts.push(`sales ${moved(s)}`);
    if (p != null) parts.push(`profit ${moved(p)}`);
    if (parts.length) lines.push(`On the quarter before: ${parts.join(", ")}.`);
  }

  // the margin
  if (latest.opm != null) {
    lines.push(ago?.opm != null
      ? `Operating margin ${latest.opm.toFixed(1)}%, ${Math.abs(latest.opm - ago.opm) < 0.05 ? "the same as" : `${latest.opm > ago.opm ? "up" : "down"} from ${ago.opm.toFixed(1)}%`} a year earlier.`
      : `Operating margin ${latest.opm.toFixed(1)}%.`);
  }

  // a run of three or more
  for (const [key, what] of [["salesYoY", "Sales"], ["profitYoY", "Profit"]]) {
    const r = run(qs, key);
    if (r.n >= 3) lines.push(`${what} ${r.sign > 0 ? "grew" : "fell"} on a year earlier for ${r.n === qs.length ? `all ${r.n} quarters shown` : `${r.n} quarters in a row`}.`);
  }

  // up to eight quarters, oldest first, for the chart
  const bars = qs.slice(0, 8).reverse().map(q => ({ end: q.end, salesCr: q.salesCr ?? null, profitCr: q.profitCr ?? null }));
  return { lines, bars };
}
