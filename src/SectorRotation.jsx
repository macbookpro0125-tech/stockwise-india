import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

// Sector rotation on Markets (17 Nov 2026): each NSE sector index against the
// NIFTY 50 over three months (across) and the last month (up), from
// server/explore.js rotationOf. A faint line shows where it was each week for
// the last four. Below the chart, the same sectors in their four groups, so
// it reads on a phone too. What happened, not where sectors go next.

const GROUPS = [
  ["leading", "Leading", "Ahead of the NIFTY 50 over three months and the last month"],
  ["improving", "Picking up", "Behind over three months, ahead over the last month"],
  ["fading", "Fading", "Ahead over three months, behind over the last month"],
  ["lagging", "Lagging", "Behind over three months and the last month"],
];
const WORD = Object.fromEntries(GROUPS.map(([id, w]) => [id, w.toLowerCase()]));
export const shortSector = n => String(n).replace(/^nifty\s*/i, "").replace(/\s*index$/i, "").replace(/^India /, "")
  .replace("Financial Services", "Fin. services").replace("Consumer Durables", "Durables").replace("Capital Markets", "Capital mkts")
  .replace("Private Bank", "Pvt bank").replace("Infrastructure", "Infra");
const pts = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "");

function Chart({ sectors }) {
  const W = 640, H = 400, P = 34;
  const all = sectors.flatMap(s => [s, s.trail[0]]).filter(Boolean);
  const span = (k, min) => Math.max(min, ...all.map(t => Math.abs(t[k]))) * 1.15;
  const sx = span("long", 4), sy = span("short", 3);
  const x = v => P + ((v + sx) / (2 * sx)) * (W - 2 * P);
  const y = v => H - P - ((v + sy) / (2 * sy)) * (H - 2 * P);
  // labels beside each dot; one that would sit on another tries the other
  // side, then a step up or down, and is left off (it's in the list below)
  // rather than drawn far from its dot
  const labels = useMemo(() => {
    const placed = [];
    const hits = (bx, by, w) => placed.some(p => bx < p.x + p.w && bx + w > p.x && Math.abs(p.y - by) < 13)
      || sectors.some(o => Math.abs(x(o.long) - (bx + w / 2)) < w / 2 + 4 && Math.abs(y(o.short) - (by - 4)) < 7);
    const out = [];
    for (const s of [...sectors].sort((a, b) => Math.abs(b.long) + Math.abs(b.short) - (Math.abs(a.long) + Math.abs(a.short)))) {
      const text = shortSector(s.name), w = text.length * 6.6, cx = x(s.long), cy = y(s.short) + 4;
      const tries = [[cx + 9, cy], [cx - 9 - w, cy], [cx + 9, cy - 13], [cx + 9, cy + 13], [cx - 9 - w, cy - 13], [cx - 9 - w, cy + 13]];
      const spot = tries.find(([bx, by]) => bx > P && bx + w < W - P && by > P + 4 && by < H - P && !hits(bx, by, w));
      if (!spot) continue;
      placed.push({ x: spot[0], y: spot[1], w });
      out.push({ name: s.name, text, x: spot[0], y: spot[1] });
    }
    return out;
  }, [sectors]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg className="rot-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sectors placed by their three-month and one-month moves against the NIFTY 50">
      <rect x={x(0)} y={P} width={W - P - x(0)} height={y(0) - P} className="rot-q rot-q-lead" />
      <rect x={P} y={y(0)} width={x(0) - P} height={H - P - y(0)} className="rot-q rot-q-lag" />
      <rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} className="rot-frame" />
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="rot-axis" />
      <line x1={x(0)} x2={x(0)} y1={P} y2={H - P} className="rot-axis" />
      <text x={W - P} y={P - 10} textAnchor="end" className="rot-qname">Leading</text>
      <text x={P} y={P - 10} className="rot-qname">Picking up</text>
      <text x={W - P} y={H - P + 18} textAnchor="end" className="rot-qname">Fading</text>
      <text x={P} y={H - P + 18} className="rot-qname">Lagging</text>
      <text x={W / 2} y={H - P + 18} textAnchor="middle" className="rot-axis-l">3 months vs NIFTY 50 →</text>
      <text x={14} y={H / 2} textAnchor="middle" className="rot-axis-l" transform={`rotate(-90 14 ${H / 2})`}>last month →</text>
      {sectors.map(s => {
        const from = s.trail[0];
        return (
          <g key={s.name} className={`rot-dot rot-${s.quadrant}`}>
            {from && from !== s.trail.at(-1) && <><line x1={x(from.long)} y1={y(from.short)} x2={x(s.long)} y2={y(s.short)} className="rot-trail" /><circle cx={x(from.long)} cy={y(from.short)} r={2} className="rot-from" /></>}
            <circle cx={x(s.long)} cy={y(s.short)} r={5} />
            <title>{`${s.name}: 3 months ${pts(s.long)} pts, last month ${pts(s.short)} pts vs NIFTY 50`}</title>
          </g>
        );
      })}
      {labels.map(l => <text key={l.name} x={l.x} y={l.y} className="rot-label">{l.text}</text>)}
    </svg>
  );
}

export default function SectorRotation({ onOpen }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.rotation().then(setD).catch(() => setD({ sectors: [] })); }, []);
  if (!d) return <div className="mk-chart mk-skel" />;
  if (!d.sectors?.length) return <p className="mk-note">Sector rotation appears once a few months of NSE's index closes are on file.</p>;
  return (
    <div className="rot">
      <p className="rot-lead">Where each sector stands against the NIFTY 50 over three months, and which way it moved over the last one. The faint line runs from where it stood four weeks ago ("was" below){d.asOf ? `, to ${day(d.asOf)}` : ""}.</p>
      <Chart sectors={d.sectors} />
      <div className="rot-groups">
        {GROUPS.map(([id, label, about]) => {
          const list = d.sectors.filter(s => s.quadrant === id).sort((a, b) => b.long + b.short - (a.long + a.short));
          return (
            <section key={id} className={`rot-group rot-${id}`}>
              <div className="rot-group-h"><h3><i aria-hidden="true" />{label} <span>{list.length}</span></h3><p>{about}</p></div>
              {list.length ? (
                <ul>
                  {list.map(s => (
                    <li key={s.name}>
                      <button type="button" onClick={() => onOpen?.(s.name)}>
                        <b>{shortSector(s.name)}</b>
                        <span className="mk-num">3M {pts(s.long)} · 1M {pts(s.short)}</span>
                        {s.was && s.was !== s.quadrant && <small>was {WORD[s.was]}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="rot-none">None now</p>}
            </section>
          );
        })}
      </div>
      <p className="mk-note">Percentage points ahead (+) or behind (−) the NIFTY 50, from NSE's closing index values. It shows what has happened, not where a sector goes next, and isn't advice.</p>
    </div>
  );
}
