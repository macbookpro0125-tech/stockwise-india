import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";

// Compare's price chart (31 Oct 2026): the companies' moves on one graph, each
// from 0% on the first day they all have, with the Nifty 500 dashed beside
// them — who did better over a month, six months, a year or five. NSE closes,
// on today's share basis (a split doesn't show as a fall).
const RANGES = [["1mo", "1M"], ["6mo", "6M"], ["1y", "1Y"], ["5y", "5Y"]];
export const COMPARE_COLOURS = ["#00C2A8", "#5B8CFF", "#F5A524", "#E25C8B", "#A78BFA"];
const day = d => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const pct = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

export default function CompareChart({ stocks }) {
  const [range, setRange] = useState("1y");
  const [data, setData] = useState(null);
  const [at, setAt] = useState(null);
  // drawn at the width it has, so its words keep their size on a phone
  const wrap = useRef(null);
  const [wide, setWide] = useState(820);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrap.current]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = stocks.map(s => s.symbol).join(",");
  useEffect(() => {
    let off = false;
    setData(null);
    Promise.all(stocks.map(s => api.prices(s.symbol, range).catch(() => null))).then(r => { if (!off) setData(r); });
    return () => { off = true; };
  }, [key, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(() => {
    if (!data) return null;
    const got = data.map((d, i) => ({ s: stocks[i], bars: (d?.bars ?? []).filter(b => b.close > 0) })).filter(x => x.bars.length > 1);
    if (!got.length) return { series: [], dates: [] };
    // from the first day every company has
    const start = got.map(x => x.bars[0].date).sort().at(-1);
    const dates = [...new Set(got.flatMap(x => x.bars.map(b => b.date)))].filter(d => d >= start).sort();
    const at0 = (bars, d) => bars.find(b => b.date >= d)?.close;
    const seriesOf = (bars, colour, name, symbol, dashed = false) => {
      const base = at0(bars, start);
      const by = new Map(bars.map(b => [b.date, b.close]));
      let carry = base;
      const pts = dates.map(d => { if (by.has(d)) carry = by.get(d); return (carry / base - 1) * 100; });
      return { name, symbol, colour, dashed, pts };
    };
    const series = got.map(x => seriesOf(x.bars, COMPARE_COLOURS[stocks.indexOf(x.s) % COMPARE_COLOURS.length], x.s.name, x.s.symbol));
    const bench = data.find(d => d?.benchmark?.closes?.length)?.benchmark;
    if (bench) {
      const bars = bench.closes.filter(([, c]) => c > 0).map(([date, close]) => ({ date, close }));
      if (bars.length && bars[0].date <= start) series.push(seriesOf(bars, "var(--t3)", bench.name, null, true));
    }
    return { series, dates };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const W = wide, H = wide < 500 ? 220 : 260, L = 44, R = 10, T = 12, B = 26;
  let body = null;
  if (!lines) body = <div className="cc-wait" role="status">Drawing the chart…</div>;
  else if (!lines.series.length) body = <div className="cc-wait">No prices kept for these over this range.</div>;
  else {
    const all = lines.series.flatMap(s => s.pts);
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all);
    const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    const n = lines.dates.length;
    const x = i => L + (i / Math.max(1, n - 1)) * (W - L - R);
    const y = v => T + ((hi - v) / (hi - lo)) * (H - T - B);
    // gridlines at a tidy step
    const span = hi - lo, raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
    const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.round(v * 100) / 100);
    const i = at ?? n - 1;
    body = (
      <>
        <svg viewBox={`0 0 ${W} ${H}`} className="cc-svg" role="img"
          aria-label={`Price moves from ${day(lines.dates[0])}: ${lines.series.map(s => `${s.symbol ?? s.name} ${pct(s.pts[n - 1])}`).join(", ")}`}
          onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setAt(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))))); }}
          onPointerLeave={() => setAt(null)}>
          {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 0 ? "cc-zero" : "cc-grid"} /><text x={L - 6} y={y(v) + 4} className="cc-tick" textAnchor="end">{v > 0 ? "+" : ""}{v}%</text></g>)}
          {lines.series.map(s => (
            <polyline key={s.name} points={s.pts.map((v, j) => `${x(j).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={s.colour} strokeWidth={s.dashed ? 1.5 : 2.2} strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />
          ))}
          {at != null && <line x1={x(at)} x2={x(at)} y1={T} y2={H - B} className="cc-cursor" />}
          <text x={L} y={H - 6} className="cc-tick">{day(lines.dates[0])}</text>
          <text x={W - R} y={H - 6} className="cc-tick" textAnchor="end">{day(lines.dates[n - 1])}</text>
        </svg>
        <ul className="cc-legend">
          {lines.series.map(s => (
            <li key={s.name}><i style={{ background: s.dashed ? "transparent" : s.colour, borderColor: s.colour }} className={s.dashed ? "dash" : ""} />
              <span className="cc-name">{s.symbol ?? s.name}</span>
              <b className={s.pts[i] >= 0 ? "up" : "down"}>{pct(s.pts[i])}</b></li>
          ))}
          <li className="cc-when">{at != null ? `to ${day(lines.dates[i])}` : `since ${day(lines.dates[0])}`}</li>
        </ul>
      </>
    );
  }
  return (
    <section className="cc" aria-labelledby="cc-h" ref={wrap}>
      <div className="cc-top">
        <h3 id="cc-h" className="cc-h">How their prices moved</h3>
        <div className="ex-ranges" role="group" aria-label="Over">
          {RANGES.map(([r, l]) => <button key={r} type="button" className="ex-range" aria-pressed={range === r} onClick={() => setRange(r)}>{l}</button>)}
        </div>
      </div>
      {body}
    </section>
  );
}
