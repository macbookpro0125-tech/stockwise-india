import { useMemo, useState } from "react";
import { mapPoints } from "./qualityValueMap.js";

// A screen's companies on one chart (30 Oct 2026, from the redesign ideas):
// quality score up, P/E across, a dot sized by market value. The lines are
// the medians of the companies shown, so the four corners are relative to
// this screen — "higher quality, lower P/E than the rest of this list", not a
// call on any company. Losses (no P/E) and companies without a score are
// left out and counted.
const W = 800, H = 440, PAD = { l: 48, r: 16, t: 16, b: 40 };
const ZONES = {
  hl: { label: "Higher quality, lower P/E", tone: "var(--green)" },
  hh: { label: "Higher quality, higher P/E", tone: "var(--accent)" },
  ll: { label: "Lower quality, lower P/E", tone: "var(--t3)" },
  lh: { label: "Lower quality, higher P/E", tone: "var(--red)" },
};

export default function QualityValueMap({ matches, onAnalyze }) {
  const { points, left, peMid, qMid } = useMemo(() => mapPoints(matches), [matches]);
  const [zone, setZone] = useState("hl");
  if (!points.length) return <p className="qv-empty">The chart needs at least three companies with a P/E and a quality score.</p>;
  // a long tail of P/Es squeezes everyone else into a corner: the axis stops
  // at the 90th percentile, and anything beyond sits on the edge
  const pes = points.map(p => p.pe).sort((a, b) => a - b);
  const xMax = Math.max(peMid * 2, pes[Math.floor(pes.length * 0.9)] * 1.1);
  const qs = points.map(p => p.quality);
  const yMin = Math.max(0, Math.floor(Math.min(...qs) / 10) * 10), yMax = Math.min(100, Math.max(yMin + 10, Math.ceil(Math.max(...qs) / 10) * 10));
  const x = pe => PAD.l + (Math.min(pe, xMax) / xMax) * (W - PAD.l - PAD.r);
  const y = q => PAD.t + (1 - (q - yMin) / Math.max(1, yMax - yMin)) * (H - PAD.t - PAD.b);
  const capMax = Math.max(...points.map(p => p.cap), 1);
  // smaller dots, and fewer names, when the list is long (the whole market is ~1,800)
  const many = points.length > 150;
  const r = cap => (many ? 2 + Math.sqrt(cap / capMax) * 7 : 4 + Math.sqrt(cap / capMax) * 14);
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round((xMax / 4) * i));
  const yTicks = Array.from({ length: Math.round((yMax - yMin) / 10) + 1 }, (_, i) => yMin + i * 10);
  const inZone = points.filter(p => p.zone === zone).sort((a, b) => b.quality - a.quality || a.pe - b.pe);
  const mx = x(peMid), my = y(qMid);
  // names for the biggest, skipping any that would sit on a name already placed
  const labelled = new Set(), placed = [];
  for (const p of [...points].sort((a, b) => b.cap - a.cap)) {
    if (labelled.size >= (many ? 10 : 16)) break;
    const lx = x(p.pe) + r(p.cap) + 4, ly = y(p.quality), w = p.symbol.length * 7;
    if (lx + w > W - PAD.r || placed.some(b => lx < b.x + b.w + 4 && b.x < lx + w + 4 && Math.abs(b.y - ly) < 13)) continue;
    placed.push({ x: lx, y: ly, w });
    labelled.add(p.symbol);
  }
  return (
    <section className="qv" aria-label="Quality against P/E">
      <div className="qv-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${points.length} companies by quality score and P/E; the lines are this list's medians, quality ${Math.round(qMid)} and P/E ${peMid.toFixed(1)}`}>
          <rect x={PAD.l} y={PAD.t} width={mx - PAD.l} height={my - PAD.t} className="qv-zone qv-hl" />
          <rect x={mx} y={PAD.t} width={W - PAD.r - mx} height={my - PAD.t} className="qv-zone qv-hh" />
          <rect x={mx} y={my} width={W - PAD.r - mx} height={H - PAD.b - my} className="qv-zone qv-lh" />
          {yTicks.map(t => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="qv-grid" /><text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="qv-tick">{t}</text></g>)}
          {xTicks.map(t => <text key={t} x={x(t)} y={H - PAD.b + 18} textAnchor="middle" className="qv-tick">{t}×</text>)}
          <line x1={mx} x2={mx} y1={PAD.t} y2={H - PAD.b} className="qv-mid" />
          <line x1={PAD.l} x2={W - PAD.r} y1={my} y2={my} className="qv-mid" />
          <text x={PAD.l + 8} y={PAD.t + 16} className="qv-zl" style={{ fill: ZONES.hl.tone }}>{ZONES.hl.label}</text>
          <text x={W - PAD.r - 8} y={PAD.t + 16} textAnchor="end" className="qv-zl" style={{ fill: ZONES.hh.tone }}>{ZONES.hh.label}</text>
          <text x={PAD.l + 8} y={H - PAD.b - 8} className="qv-zl" style={{ fill: ZONES.ll.tone }}>{ZONES.ll.label}</text>
          <text x={W - PAD.r - 8} y={H - PAD.b - 8} textAnchor="end" className="qv-zl" style={{ fill: ZONES.lh.tone }}>{ZONES.lh.label}</text>
          <text x={W - PAD.r} y={H - 4} textAnchor="end" className="qv-axis">P/E (last 12 months) →</text>
          <text x={12} y={PAD.t + 4} className="qv-axis" transform={`rotate(-90 12 ${PAD.t + 4})`} textAnchor="end">↑ Quality score</text>
          {[...points].sort((a, b) => b.cap - a.cap).map(p => (
            <g key={p.symbol} className="qv-dot" tabIndex={0} role="button" aria-label={`${p.name}: quality ${Math.round(p.quality)}, P/E ${p.pe.toFixed(1)}`}
              onClick={() => onAnalyze?.(p.symbol)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAnalyze?.(p.symbol); } }}>
              <title>{`${p.name} · quality ${Math.round(p.quality)} · P/E ${p.pe.toFixed(1)}${p.pe > xMax ? " (beyond the axis)" : ""}`}</title>
              <circle cx={x(p.pe)} cy={y(p.quality)} r={r(p.cap)} style={{ fill: `color-mix(in srgb, ${ZONES[p.zone].tone} ${many ? 45 : 28}%, transparent)`, stroke: ZONES[p.zone].tone }} />
              {labelled.has(p.symbol) && <text x={x(p.pe) + r(p.cap) + 4} y={y(p.quality) + 4} className="qv-label">{p.symbol}</text>}
            </g>
          ))}
        </svg>
        <p className="qv-note">Dot size is market value. The lines are this list's middle values (quality {Math.round(qMid)}, P/E {peMid.toFixed(1)}×), so the corners compare these companies with each other.{left > 0 ? ` ${left} without a P/E (a loss) or a score ${left === 1 ? "isn't" : "aren't"} shown.` : ""} Not a recommendation.</p>
      </div>
      <aside className="qv-side">
        <div className="qv-tabs" role="group" aria-label="Corner">
          {Object.entries(ZONES).map(([id, z]) => (
            <button key={id} type="button" aria-pressed={zone === id} onClick={() => setZone(id)}>{z.label} · {points.filter(p => p.zone === id).length}</button>
          ))}
        </div>
        <ul className="qv-list">
          {inZone.slice(0, 12).map(p => (
            <li key={p.symbol}><button type="button" onClick={() => onAnalyze?.(p.symbol)}><span><b>{p.name}</b><small>{p.symbol}</small></span><span className="qv-figs">P/E {p.pe.toFixed(1)} <em>{Math.round(p.quality)}</em></span></button></li>
          ))}
          {inZone.length > 12 && <li className="qv-more">and {inZone.length - 12} more</li>}
        </ul>
      </aside>
    </section>
  );
}
