// What a company's own history suggests (16 Nov 2026, the owner: "can we
// predict anything of the future from the previous data, tell me where we can
// use that"). Not price forecasts — SEBI's rules keep those for registered
// advisers — but patterns in its own record: when results usually come, when
// dividends usually go ex, which quarter is usually its biggest, and where
// sales and profit would be if the past rate simply continued. Each line says
// it's history, not a forecast.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUARTER_OF_END = { 3: "January–March", 6: "April–June", 9: "July–September", 12: "October–December" };
const day = iso => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
const longDay = iso => day(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const crore = v => `₹${Math.round(v).toLocaleString("en-IN")} crore`;
// quarter ends are month ends: 30 Sep + 3 months is 31 Dec, not 30 Dec; a
// filing date keeps its day (12 Jan + 12 months is 12 Jan)
const addMonths = (iso, n) => {
  const d = day(iso), y = d.getUTCFullYear(), mo = d.getUTCMonth() + n;
  const monthEnd = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate() === d.getUTCDate();
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mo, monthEnd ? last : Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
};
const list = xs => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export function historyLines(m, today = new Date().toISOString().slice(0, 10)) {
  if (!m) return [];
  const out = [];
  // results: announced, else last year's date for the same quarter
  if (m.nextResults && m.nextResults >= today) out.push({ k: "Next results", text: `Announced for ${longDay(m.nextResults)}.` });
  else if (m.latestQuarter) {
    const next = addMonths(m.latestQuarter, 3);
    const lastYear = (m.quarters ?? []).find(q => q.fyEnd === addMonths(next, -12) && q.filed);
    if (lastYear) {
      const likely = addMonths(lastYear.filed, 12);
      out.push({ k: "Next results", text: `Not announced yet. Last year the same quarter's results came on ${longDay(lastYear.filed)}, so around ${likely >= today ? longDay(likely) : "the same time"} if it keeps to its habit.` });
    }
  }
  // dividends: the months it went ex-dividend in two or more different years
  const divs = (m.events ?? []).filter(e => e?.kind === "action" && /dividend/i.test(e.title ?? "") && e.date);
  const yearsByMonth = new Map();
  for (const e of divs) { const d = day(e.date); const k = d.getUTCMonth(); if (!yearsByMonth.has(k)) yearsByMonth.set(k, new Set()); yearsByMonth.get(k).add(d.getUTCFullYear()); }
  const usual = [...yearsByMonth].filter(([, ys]) => ys.size >= 2).map(([k]) => k).sort((a, b) => a - b);
  const t = m.dividendRecord?.track;
  if (usual.length || t?.years) {
    out.push({ k: "Dividends", text: [
      usual.length ? `It has usually gone ex-dividend in ${list(usual.map(k => MONTHS[k]))}` : null,
      t?.years ? `paid in ${t.paid} of the last ${t.years} years, raised ${t.raised} times and cut ${t.cut}` : null,
    ].filter(Boolean).join("; ").replace(/^./, c => c.toUpperCase()) + "." });
  }
  // the biggest quarter: each quarter's sales against its own four-quarter
  // average, averaged by quarter of the year; eight quarters or more
  const qs = (m.quarters ?? []).filter(q => q.revenueCr > 0 && q.fyEnd);
  if (qs.length >= 8) {
    const byEnd = new Map();
    for (let i = 0; i + 3 < qs.length; i++) {
      const avg = (qs[i].revenueCr + qs[i + 1].revenueCr + qs[i + 2].revenueCr + qs[i + 3].revenueCr) / 4;
      const mEnd = day(qs[i].fyEnd).getUTCMonth() + 1;
      if (!byEnd.has(mEnd)) byEnd.set(mEnd, []);
      byEnd.get(mEnd).push(qs[i].revenueCr / avg);
    }
    const means = [...byEnd].filter(([, v]) => v.length >= 1).map(([mEnd, v]) => [mEnd, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1]);
    // all four quarters of the year seen at least once
    if (means.length === 4 && QUARTER_OF_END[means[0][0]]) {
      const lift = (means[0][1] - 1) * 100;
      out.push({ k: "Busiest quarter", text: lift >= 4
        ? `Its ${QUARTER_OF_END[means[0][0]]} quarter has usually had its biggest sales, about ${Math.round(lift)}% above an average quarter.`
        : "Its sales have been spread evenly across the year: no quarter stands out." });
    }
  }
  // if the five-year rate simply continued: arithmetic, said as such
  const y = (m.history ?? [])[0];
  const go = (g, base, what) => (g != null && base > 0 && g > -50 && g < 100 ? `${what} ${crore(base * Math.pow(1 + g / 100, 3))}` : null);
  const proj = [go(m.salesGrowth5y, y?.revenueCr, "sales of about"), go(m.profitGrowth5y, y?.profitCr, "a profit of about")].filter(Boolean);
  if (proj.length) out.push({ k: "If its pace continued", text: `At its last five years' growth rate, in three years it would have ${list(proj)}. That's arithmetic on its past, not a forecast: growth rarely stays steady.` });
  return out;
}
