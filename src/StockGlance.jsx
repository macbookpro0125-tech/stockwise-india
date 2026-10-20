import { Check, AlertTriangle, ChevronRight } from "lucide-react";
import { openCheck } from "./StockSide.jsx";
import { pickLines } from "./glanceLines.js";

// The top of the stock page's overview: the six group scores in one picture,
// then what stands out and what to watch — picked from the research model's
// own checks and flags (server/research.js), in its own sentences. Nothing is
// added here that the scorecard below doesn't say; this only brings the
// strongest and weakest lines up front.

const GROUPS = [
  ["business", "Business"], ["earnings", "Earnings"], ["balance", "Balance sheet"],
  ["governance", "Governance"], ["growth", "Growth"], ["valuation", "Valuation"],
];
const band = s => (s == null ? "none" : s >= 70 ? "good" : s >= 50 ? "mid" : "bad");

// Six axes, one per group, 0 at the centre and 100 at the rim
function Hexagon({ r }) {
  const C = 110, R = 64;
  const byId = Object.fromEntries(r.groups.map(g => [g.id, g]));
  const at = (i, k) => {
    const a = (-90 + i * 60) * (Math.PI / 180);
    return [C + Math.cos(a) * R * k, C + Math.sin(a) * R * k];
  };
  const ring = k => GROUPS.map((_, i) => at(i, k).join(",")).join(" ");
  const pts = GROUPS.map(([id], i) => {
    const g = byId[id];
    const s = g?.applicable && g.score != null ? g.score : null;
    return { id, i, s, xy: at(i, Math.max(0, Math.min(100, s ?? 0)) / 100) };
  });
  const label = GROUPS.map(([id, name], i) => {
    const [x, y] = at(i, 1.32);
    const s = pts[i].s;
    const anchor = Math.abs(x - C) < 4 ? "middle" : x > C ? "start" : "end";
    return (
      <text key={id} x={x} y={y} textAnchor={anchor} className="sd-hex-label">
        <tspan x={x} dy={i === 0 ? "-0.2em" : i === 3 ? "0.6em" : "0.2em"}>{name}</tspan>
        <tspan x={x} dy="1.2em" className={`sd-hex-num sd-tone-${band(s)}`}>{s == null ? "—" : Math.round(s)}</tspan>
      </text>
    );
  });
  const summary = GROUPS.map(([, name], i) => `${name} ${pts[i].s == null ? "no score" : Math.round(pts[i].s)}`).join(", ");
  return (
    <svg className="sd-hex" viewBox="-45 0 310 225" role="img" aria-label={`Scores out of 100: ${summary}.`}>
      {[0.25, 0.5, 0.75, 1].map(k => <polygon key={k} points={ring(k)} className="sd-hex-ring" />)}
      {GROUPS.map(([id], i) => { const [x, y] = at(i, 1); return <line key={id} x1={C} y1={C} x2={x} y2={y} className="sd-hex-axis" />; })}
      <polygon points={pts.map(p => p.xy.join(",")).join(" ")} className="sd-hex-area" />
      {pts.map(p => <circle key={p.id} cx={p.xy[0]} cy={p.xy[1]} r="3.5" className={`sd-hex-dot sd-tone-${band(p.s)}`} />)}
      {r.quality != null && <>
        <text x={C} y={C - 2} textAnchor="middle" className="sd-hex-q">{Math.round(r.quality)}</text>
        <text x={C} y={C + 12} textAnchor="middle" className="sd-hex-qlabel">quality</text>
      </>}
      {label}
    </svg>
  );
}

function Line({ item, Icon, tone }) {
  return (
    <li>
      <button type="button" className={`sd-glance-line sd-tone-${item.tone ?? tone}`} onClick={() => openCheck(item.target)}>
        <span className="sd-glance-icon" aria-hidden="true"><Icon size={14} strokeWidth={2.4} /></span>
        <span className="sd-glance-text"><b>{item.group}</b>{item.text}</span>
        <ChevronRight size={15} className="sd-score-go" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function StockGlance({ r }) {
  if (!r) return null;
  const { strengths, watch } = pickLines(r);
  return (
    <section className="sd-card sd-glance" aria-labelledby="glance-title">
      <h3 id="glance-title" className="sd-card-title">At a glance</h3>
      <div className="sd-glance-body">
        <Hexagon r={r} />
        <div className="sd-glance-lists">
          <div>
            <h4 className="sd-glance-h">What stands out</h4>
            {strengths.length
              ? <ul className="sd-glance-list">{strengths.map(s => <Line key={s.key} item={s} Icon={Check} tone="good" />)}</ul>
              : <p className="sd-muted">No check scored strong.</p>}
          </div>
          <div>
            <h4 className="sd-glance-h">What to watch</h4>
            {watch.length
              ? <ul className="sd-glance-list">{watch.map(s => <Line key={s.key} item={s} Icon={AlertTriangle} tone="mid" />)}</ul>
              : <p className="sd-muted">No red flags, and no check scored below fair.</p>}
          </div>
        </div>
      </div>
      <p className="sd-foot">The strongest and weakest of the scorecard's checks, from NSE filings — each opens its check below. Observations, not advice.</p>
    </section>
  );
}
