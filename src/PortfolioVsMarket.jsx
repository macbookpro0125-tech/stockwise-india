import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { rupees } from "./portfolioText.js";

// Your portfolio against the market (31 Oct 2026): what your holdings have
// been worth each day, beside the same money had it gone into the Nifty 500
// on the same days you bought (server/portfolio-vs-market.js). Buying more
// lifts both lines alike, so the gap between them is the companies you chose.
const day = d => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export default function PortfolioVsMarket({ version }) {
  const [d, setD] = useState(null);
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
  useEffect(() => {
    let off = false;
    api.portfolioVsMarket().then(r => { if (!off) setD(r); }).catch(() => { if (!off) setD({ empty: true }); });
    return () => { off = true; };
  }, [version]);

  const chart = useMemo(() => {
    if (!d?.points?.length) return null;
    const W = wide, H = wide < 500 ? 200 : 230, L = 60, R = 10, T = 12, B = 26;
    const vals = d.points.flatMap(p => [p.you, p.market]);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || hi * 0.05 || 1; lo = Math.max(0, lo - pad); hi += pad;
    const n = d.points.length;
    const x = i => L + (i / Math.max(1, n - 1)) * (W - L - R);
    const y = v => T + ((hi - v) / (hi - lo)) * (H - T - B);
    const line = k => d.points.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
    // three gridlines at tidy steps (1, 2, 2.5 or 5 of a power of ten)
    const raw = (hi - lo) / 3, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= raw) ?? raw;
    const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    return { W, H, L, R, T, B, n, x, y, you: line("you"), market: line("market"), ticks };
  }, [d, wide]);

  if (!d || d.empty) return <div ref={wrap} />;
  if (!chart) return null;
  const p = d.points[at ?? d.points.length - 1];
  const edge = p.market > 0 ? ((p.you - p.market) / p.market) * 100 : 0;
  const ahead = edge >= 0;
  const short = v => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : rupees(v));
  return (
    <section className="pvm" aria-labelledby="pvm-h" ref={wrap}>
      <h3 id="pvm-h" className="pvm-h">You against the market</h3>
      <p className="pvm-line">
        {at != null ? <>On {day(p.date)}, your</> : <>Your</>} holdings {at != null ? "were" : "are"} worth <b>{rupees(p.you)}</b>. The same money in the Nifty 500, put in on the days you bought, {at != null ? "was" : "would be"} <b>{rupees(p.market)}</b>
        {Math.abs(edge) >= 0.05
          ? <> — you're <b className={ahead ? "up" : "down"}>{ahead ? "ahead" : "behind"} by {Math.abs(edge).toFixed(1)}%</b>.</>
          : <> — level with the market.</>}
      </p>
      <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="cc-svg" role="img"
        aria-label={`From ${day(d.from)} to ${day(d.to)}: your holdings ${rupees(d.you)}, the Nifty 500 ${rupees(d.market)}`}
        onPointerMove={e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * chart.W; setAt(Math.max(0, Math.min(chart.n - 1, Math.round(((px - chart.L) / (chart.W - chart.L - chart.R)) * (chart.n - 1))))); }}
        onPointerLeave={() => setAt(null)}>
        {chart.ticks.map(v => <g key={v}><line x1={chart.L} x2={chart.W - chart.R} y1={chart.y(v)} y2={chart.y(v)} className="cc-grid" /><text x={chart.L - 6} y={chart.y(v) + 4} className="cc-tick" textAnchor="end">{short(v)}</text></g>)}
        <polyline points={chart.market} fill="none" stroke="var(--t3)" strokeWidth="1.6" strokeDasharray="5 4" strokeLinejoin="round" />
        <polyline points={chart.you} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
        {at != null && <line x1={chart.x(at)} x2={chart.x(at)} y1={chart.T} y2={chart.H - chart.B} className="cc-cursor" />}
        <text x={chart.L} y={chart.H - 6} className="cc-tick">{day(d.from)}</text>
        <text x={chart.W - chart.R} y={chart.H - 6} className="cc-tick" textAnchor="end">{day(d.to)}</text>
      </svg>
      <ul className="cc-legend">
        <li><i style={{ background: "var(--accent)" }} /><span className="cc-name">Your holdings</span></li>
        <li><i className="dash" style={{ borderColor: "var(--t3)" }} /><span className="cc-name">The same money in the Nifty 500</span></li>
      </ul>
      <p className="pvm-note">
        NSE closes, on today's share basis; dividends, fees and taxes left out of both.
        {d.placedAtStart > 0 && ` ${d.placedAtStart} holding${d.placedAtStart === 1 ? " has" : "s have"} no buy date or ${d.placedAtStart === 1 ? "was" : "were"} bought before ${day(d.from)}, so ${d.placedAtStart === 1 ? "it joins" : "they join"} both lines on ${day(d.from)} at that day's prices.`}
        {d.unpriced > 0 && ` ${d.unpriced} without kept prices ${d.unpriced === 1 ? "is" : "are"} left out.`}
      </p>
    </section>
  );
}
