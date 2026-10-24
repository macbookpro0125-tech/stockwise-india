// A company's results as a table (24 Oct 2026, "this kind of details but
// improved", after Tijori's): the latest quarter's sales, operating profit,
// net profit, EPS and operating margin, each against the quarter before and
// the same quarter a year earlier, and the last eight quarters as a trend.
// Only the reported figures, compared.
//
// quarters: newest first, { end: "2026-09-30", salesCr, opCr, profitCr, eps, opm }

const DAY = 86_400_000;

// the quarter about `days` before this one, by its end date
function before(quarters, q, days) {
  const t = Date.parse(q.end) - days * DAY;
  return quarters.find(x => Math.abs(Date.parse(x.end) - t) <= 25 * DAY) ?? null;
}

// growth in %, only from a positive figure to a non-negative one; a loss either
// side is said in words instead (turn)
export function growth(now, then) {
  if (now == null || then == null) return null;
  return then > 0 && now >= 0 ? ((now - then) / then) * 100 : null;
}
export function turn(now, then) {
  if (now == null || then == null) return null;
  if (then <= 0 && now > 0) return "to profit";
  if (then > 0 && now < 0) return "to loss";
  if (then < 0 && now < 0) return now > then ? "smaller loss" : now < then ? "larger loss" : null;
  return null;
}

const ROWS = [
  ["salesCr", "Sales", "cr"],
  ["opCr", "Operating profit", "cr"],
  ["profitCr", "Net profit", "cr"],
  ["eps", "EPS", "eps"],
  ["opm", "Operating margin", "pct"],
];

export function resultsTable(quarters) {
  const qs = (quarters ?? []).filter(q => q?.end).sort((a, b) => b.end.localeCompare(a.end));
  const latest = qs[0];
  if (!latest) return null;
  const prev = before(qs, latest, 91), yago = before(qs, latest, 365);
  // the trend: up to eight quarters, oldest first
  const trendQs = qs.slice(0, 8).reverse();
  const rows = ROWS.filter(([k]) => latest[k] != null).map(([key, label, unit]) => {
    const v = q => (q ? q[key] ?? null : null);
    // a margin moves in basis points (1% = 100), not by a percentage of itself
    const change = unit === "pct"
      ? (then => (then == null || latest[key] == null ? null : (latest[key] - then) * 100))
      : (then => growth(latest[key], then));
    return {
      key, label, unit,
      latest: latest[key], prev: v(prev), yago: v(yago),
      yoy: change(v(yago)), qoq: change(v(prev)),
      yoyTurn: unit === "pct" ? null : turn(latest[key], v(yago)),
      qoqTurn: unit === "pct" ? null : turn(latest[key], v(prev)),
      trend: trendQs.map(q => ({ end: q.end, value: q[key] ?? null })),
    };
  });
  return { latest: latest.end, prev: prev?.end ?? null, yago: yago?.end ?? null, rows };
}
