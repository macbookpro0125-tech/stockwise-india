import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import { AXES, axisById, mapPoints, bestZone, zoneLabel, zoneTone, inBox } from "./qualityValueMap.js";

// A screen's companies on one chart (30 Oct 2026, from the redesign ideas):
// a score up, another across, a dot sized by market value. Quality against
// P/E to start; any two of the scores can be picked (5 Nov 2026), and a box
// dragged on the chart lists the companies between those values. The lines
// are the medians of the companies shown, so the four corners are relative
// to this screen — "higher quality, lower P/E than the rest of this list",
// not a call on any company. Companies missing either figure are counted.
const W = 800, H = 440, PAD = { l: 48, r: 16, t: 16, b: 40 };
const TONE = { 2: "var(--green)", 1: "var(--accent)", [-1]: "var(--t3)", [-2]: "var(--red)" };
const KEY = "qv-axes";
const saved = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && axisById(v.y).id === v.y && axisById(v.x).id === v.x ? v : null; } catch { return null; } };

const fmt = (a, v) => (a.ratio ? `${v.toFixed(1)}×` : String(Math.round(v)));

// an axis's range: a ratio from 0 to where 90% of the list sits (a long tail
// would squeeze everyone else into a corner; beyond sits on the edge); a
// score to the nearest tens around the list
function scaleFor(a, values, mid) {
  if (a.ratio) {
    const s = [...values].sort((p, q) => p - q);
    const max = Math.max(mid * 2, s[Math.floor(s.length * 0.9)] * 1.1);
    return { min: 0, max, ticks: Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i)) };
  }
  const min = Math.max(0, Math.floor(Math.min(...values) / 10) * 10), max = Math.min(100, Math.max(min + 10, Math.ceil(Math.max(...values) / 10) * 10));
  return { min, max, ticks: Array.from({ length: Math.round((max - min) / 10) + 1 }, (_, i) => min + i * 10) };
}

export default function QualityValueMap({ matches, onAnalyze }) {
  const [axes, setAxes] = useState(() => saved() ?? { y: "quality", x: "pe" });
  const ya = axisById(axes.y), xa = axisById(axes.x);
  const { points, left, xMid, yMid } = useMemo(() => mapPoints(matches, axes.y, axes.x), [matches, axes.y, axes.x]);
  const [zone, setZone] = useState(() => bestZone(ya, xa));
  const [box, setBox] = useState(null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);
  const setTo = next => {
    setAxes(next);
    setZone(bestZone(axisById(next.y), axisById(next.x)));
    setBox(null);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* a convenience only */ }
  };
  const pick = (which, id) => setTo({ ...axes, [which]: id });
  const swap = () => setTo({ y: axes.x, x: axes.y });

  const pickers = (
    <div className="qv-axes">
      <label>Up <select value={axes.y} onChange={e => pick("y", e.target.value)} className="qv-select" aria-label="Score up the side">{AXES.filter(a => a.id !== axes.x).map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      <button type="button" className="qv-swap" onClick={swap} aria-label="Swap up and across" title="Swap"><ArrowLeftRight size={14} aria-hidden="true" /></button>
      <label>Across <select value={axes.x} onChange={e => pick("x", e.target.value)} className="qv-select" aria-label="Score across the bottom">{AXES.filter(a => a.id !== axes.y).map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      <span className="qv-hint">Drag on the chart to list the companies in a range</span>
    </div>
  );
  if (!points.length) return <section className="qv qv-one" aria-label="Scores chart">{pickers}<p className="qv-empty">The chart needs at least three companies with both a {ya.short} and a {xa.short}.</p></section>;

  const xs = scaleFor(xa, points.map(p => p.x), xMid), ys = scaleFor(ya, points.map(p => p.y), yMid);
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  const x = v => PAD.l + ((Math.min(Math.max(v, xs.min), xs.max) - xs.min) / Math.max(1e-9, xs.max - xs.min)) * pw;
  const y = v => PAD.t + (1 - (Math.min(Math.max(v, ys.min), ys.max) - ys.min) / Math.max(1e-9, ys.max - ys.min)) * ph;
  const xv = px => xs.min + ((px - PAD.l) / pw) * (xs.max - xs.min);
  const yv = py => ys.min + (1 - (py - PAD.t) / ph) * (ys.max - ys.min);
  const capMax = Math.max(...points.map(p => p.cap), 1);
  // smaller dots, and fewer names, when the list is long (the whole market is ~1,800)
  const many = points.length > 150;
  const r = cap => (many ? 2 + Math.sqrt(cap / capMax) * 7 : 4 + Math.sqrt(cap / capMax) * 14);
  const zones = ["hl", "hh", "ll", "lh"].map(id => ({ id, label: zoneLabel(id, ya, xa), tone: TONE[zoneTone(id, ya, xa)] }));
  const zoneById = Object.fromEntries(zones.map(z => [z.id, z]));
  // the good end of each first
  const order = (a, b) => (ya.better === "high" ? b.y - a.y : a.y - b.y) || (xa.better === "high" ? b.x - a.x : a.x - b.x);
  const boxed = box ? inBox(points, box) : null;
  const shown = (boxed ?? points.filter(p => p.zone === zone)).sort(order);
  const inside = boxed ? new Set(boxed.map(p => p.symbol)) : null;
  const mx = x(xMid), my = y(yMid);
  // names for the biggest, skipping any that would sit on a name already placed
  const labelled = new Set(), placed = [];
  for (const p of [...points].sort((a, b) => b.cap - a.cap)) {
    if (labelled.size >= (many ? 10 : 16)) break;
    const lx = x(p.x) + r(p.cap) + 4, ly = y(p.y), w = p.symbol.length * 7;
    if (lx + w > W - PAD.r || placed.some(b => lx < b.x + b.w + 4 && b.x < lx + w + 4 && Math.abs(b.y - ly) < 13)) continue;
    placed.push({ x: lx, y: ly, w });
    labelled.add(p.symbol);
  }

  // a drag draws the box; a short press is still a click on a dot
  const at = e => {
    const m = svgRef.current.getScreenCTM()?.inverse();
    if (!m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: Math.min(Math.max(pt.x, PAD.l), W - PAD.r), y: Math.min(Math.max(pt.y, PAD.t), H - PAD.b) };
  };
  const down = e => { if (e.button !== 0) return; const p = at(e); if (p) setDrag({ a: p, b: p, on: false, id: e.pointerId, sx: e.clientX, sy: e.clientY }); };
  const move = e => {
    if (!drag) return;
    const on = drag.on || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
    if (on && !drag.on) svgRef.current.setPointerCapture?.(drag.id);
    const p = at(e);
    if (p) setDrag({ ...drag, b: p, on });
  };
  const up = () => {
    if (drag?.on && Math.abs(drag.a.x - drag.b.x) > 4 && Math.abs(drag.a.y - drag.b.y) > 4) {
      setBox({ x0: xv(drag.a.x), x1: xv(drag.b.x), y0: yv(drag.a.y), y1: yv(drag.b.y) });
    }
    setDrag(null);
  };
  const liveBox = drag?.on ? drag : box ? { a: { x: x(box.x0), y: y(box.y0) }, b: { x: x(box.x1), y: y(box.y1) } } : null;
  const range = box && (() => {
    const [x0, x1] = [box.x0, box.x1].sort((p, q) => p - q), [y0, y1] = [box.y0, box.y1].sort((p, q) => p - q);
    return `${ya.label.replace(/ \(.*\)/, "")} ${fmt(ya, y0)}–${fmt(ya, y1)} · ${xa.short} ${fmt(xa, x0)}–${fmt(xa, x1)}`;
  })();

  return (
    <section className="qv" aria-label={`${ya.label} against ${xa.label}`}>
      <div className="qv-chart">
        {pickers}
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" className={drag?.on ? "qv-dragging" : undefined}
          aria-label={`${points.length} companies by ${ya.label} and ${xa.label}; the lines are this list's medians, ${ya.short} ${fmt(ya, yMid)} and ${xa.short} ${fmt(xa, xMid)}`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
          {[["hl", PAD.l, PAD.t, mx - PAD.l, my - PAD.t], ["hh", mx, PAD.t, W - PAD.r - mx, my - PAD.t], ["ll", PAD.l, my, mx - PAD.l, H - PAD.b - my], ["lh", mx, my, W - PAD.r - mx, H - PAD.b - my]].map(([id, rx, ry, rw, rh]) => {
            const t = zoneTone(id, ya, xa);
            return t === -1 ? null : <rect key={id} x={rx} y={ry} width={Math.max(0, rw)} height={Math.max(0, rh)} className="qv-zone" style={{ fill: `color-mix(in srgb, ${TONE[t]} ${t === 2 ? 9 : 6}%, transparent)` }} />;
          })}
          {ys.ticks.map(t => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="qv-grid" /><text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="qv-tick">{t}{ya.ratio ? "×" : ""}</text></g>)}
          {xs.ticks.map(t => <text key={t} x={x(t)} y={H - PAD.b + 18} textAnchor="middle" className="qv-tick">{t}{xa.ratio ? "×" : ""}</text>)}
          <line x1={mx} x2={mx} y1={PAD.t} y2={H - PAD.b} className="qv-mid" />
          <line x1={PAD.l} x2={W - PAD.r} y1={my} y2={my} className="qv-mid" />
          <text x={PAD.l + 8} y={PAD.t + 16} className="qv-zl" style={{ fill: zoneById.hl.tone }}>{zoneById.hl.label}</text>
          <text x={W - PAD.r - 8} y={PAD.t + 16} textAnchor="end" className="qv-zl" style={{ fill: zoneById.hh.tone }}>{zoneById.hh.label}</text>
          <text x={PAD.l + 8} y={H - PAD.b - 8} className="qv-zl" style={{ fill: zoneById.ll.tone }}>{zoneById.ll.label}</text>
          <text x={W - PAD.r - 8} y={H - PAD.b - 8} textAnchor="end" className="qv-zl" style={{ fill: zoneById.lh.tone }}>{zoneById.lh.label}</text>
          <text x={W - PAD.r} y={H - 4} textAnchor="end" className="qv-axis">{xa.label} →</text>
          <text x={12} y={PAD.t + 4} className="qv-axis" transform={`rotate(-90 12 ${PAD.t + 4})`} textAnchor="end">↑ {ya.label}</text>
          {[...points].sort((a, b) => b.cap - a.cap).map(p => {
            const tone = zoneById[p.zone].tone, dim = inside && !inside.has(p.symbol);
            const beyond = (xa.ratio && p.x > xs.max) || (ya.ratio && p.y > ys.max);
            return (
              <g key={p.symbol} className={`qv-dot${dim ? " qv-dim" : ""}`} tabIndex={0} role="button" aria-label={`${p.name}: ${ya.short} ${fmt(ya, p.y)}, ${xa.short} ${fmt(xa, p.x)}`}
                onClick={() => onAnalyze?.(p.symbol)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAnalyze?.(p.symbol); } }}>
                <title>{`${p.name} · ${ya.short} ${fmt(ya, p.y)} · ${xa.short} ${fmt(xa, p.x)}${beyond ? " (beyond the axis)" : ""}`}</title>
                <circle cx={x(p.x)} cy={y(p.y)} r={r(p.cap)} style={{ fill: `color-mix(in srgb, ${tone} ${many ? 45 : 28}%, transparent)`, stroke: tone }} />
                {labelled.has(p.symbol) && <text x={x(p.x) + r(p.cap) + 4} y={y(p.y) + 4} className="qv-label">{p.symbol}</text>}
              </g>
            );
          })}
          {liveBox && <rect className="qv-box" x={Math.min(liveBox.a.x, liveBox.b.x)} y={Math.min(liveBox.a.y, liveBox.b.y)} width={Math.abs(liveBox.a.x - liveBox.b.x)} height={Math.abs(liveBox.a.y - liveBox.b.y)} />}
        </svg>
        <p className="qv-note">Dot size is market value. The lines are this list's middle values ({ya.short} {fmt(ya, yMid)}, {xa.short} {fmt(xa, xMid)}), so the corners compare these companies with each other.{left > 0 ? ` ${left} without a ${ya.short} or a ${xa.short} ${left === 1 ? "isn't" : "aren't"} shown.` : ""} Not a recommendation.</p>
      </div>
      <aside className="qv-side">
        <div className="qv-tabs" role="group" aria-label="Corner">
          {zones.map(z => (
            <button key={z.id} type="button" aria-pressed={!box && zone === z.id} onClick={() => { setBox(null); setZone(z.id); }}>{z.label} · {points.filter(p => p.zone === z.id).length}</button>
          ))}
        </div>
        {box && (
          <div className="qv-boxed">
            <span><b>In your box · {boxed.length}</b><small>{range}</small></span>
            <button type="button" onClick={() => setBox(null)} aria-label="Clear the box"><X size={14} aria-hidden="true" /></button>
          </div>
        )}
        <ul className="qv-list">
          {shown.slice(0, 12).map(p => (
            <li key={p.symbol}><button type="button" onClick={() => onAnalyze?.(p.symbol)}><span><b>{p.name}</b><small>{p.symbol}</small></span><span className="qv-figs">{xa.short} {fmt(xa, p.x)} <em style={{ color: zoneById[p.zone].tone, background: `color-mix(in srgb, ${zoneById[p.zone].tone} 14%, transparent)` }}>{fmt(ya, p.y)}</em></span></button></li>
          ))}
          {box && !shown.length && <li className="qv-more">No company in that box. Drag a bigger one.</li>}
          {shown.length > 12 && <li className="qv-more">and {shown.length - 12} more</li>}
        </ul>
      </aside>
    </section>
  );
}
