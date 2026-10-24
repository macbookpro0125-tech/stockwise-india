import { useEffect, useRef, useState } from "react";
import { squarify, sourcesAndUses } from "./statements.js";

// The statements as pictures (24 Oct 2026, "in animations so simple they can
// understand"): a year's profit and loss or cash flow as a bridge — each line
// a bar that starts where the one before ended, so sales visibly shrink to
// profit — the balance sheet as a map of tiles, and where the cash came from
// and went over 1, 3 or 5 years. Bars grow in once, when they come into view, one
// after another; with reduced motion they're simply there. Arithmetic in
// statements.js.

const MONO = { fontVariantNumeric: "tabular-nums" };
export const PALETTE = ["var(--accent)", "#5B8DEF", "#A78BFA", "#F5B544", "#F472B6", "#38BDF8", "#FB923C", "var(--t3)"];

export function fmtCrShort(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(2)}L Cr`;
  if (a >= 1000) return `${sign}₹${Math.round(a).toLocaleString("en-IN")} Cr`;
  if (a >= 10) return `${sign}₹${a.toFixed(0)} Cr`;
  return `${sign}₹${a.toFixed(1)} Cr`;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// true once the element has been on screen (and stays true)
export function useShown() {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => reducedMotion() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (shown || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return [ref, shown];
}

const grow = (shown, i, axis = "X") => ({
  transform: shown ? "none" : `scale${axis}(0)`,
  // a year picked later slides the bars to their new place
  transition: reducedMotion() ? "none" : `transform 620ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 90}ms, left 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1)`,
});

// A bridge: totals are bars from zero (accent), steps run from the last
// position, green when they add and red when they take away
export function Bridge({ steps, caption, stepColor = null, signed = true }) {
  const [ref, shown] = useShown();
  if (!steps?.length) return null;
  let at = 0;
  const rows = steps.map(s => {
    const from = s.kind === "total" ? 0 : at;
    const to = s.kind === "total" ? s.value : at + s.value;
    at = to;
    return { ...s, from, to };
  });
  const lo = Math.min(0, ...rows.flatMap(r => [r.from, r.to]));
  const hi = Math.max(0, ...rows.flatMap(r => [r.from, r.to]));
  const span = hi - lo || 1;
  const x = v => ((v - lo) / span) * 100;
  return (
    <figure ref={ref} className="stm-bridge" style={{ margin: "0 0 14px" }}>
      {rows.map((r, i) => {
        const left = x(Math.min(r.from, r.to)), width = Math.max(0.6, Math.abs(x(r.to) - x(r.from)));
        const color = r.kind === "total" ? (r.value < 0 ? "var(--red)" : "var(--accent)") : stepColor ?? (r.value >= 0 ? "var(--green)" : "var(--red)");
        return (
          <div key={`${r.label}${i}`} className={`stm-row${r.kind === "total" ? " total" : ""}`}>
            <span className="stm-label">{r.label}</span>
            <span className="stm-track" aria-hidden="true">
              {lo < 0 && <span className="stm-zero" style={{ left: `${x(0)}%` }} />}
              <span className="stm-bar" style={{ left: `${left}%`, width: `${width}%`, background: color, transformOrigin: r.value >= 0 || r.kind === "total" ? "left" : "right", ...grow(shown, i) }} />
            </span>
            <span className="stm-value" style={{ color: r.kind === "total" ? "var(--t1)" : color, ...MONO }}>{r.kind === "total" || !signed ? "" : r.value >= 0 ? "+" : ""}{fmtCrShort(r.value)}</span>
          </div>
        );
      })}
      {caption && <figcaption className="stm-caption">{caption}</figcaption>}
    </figure>
  );
}

// Pick a year: the newest first, as chips
export function YearChips({ years, at, onPick }) {
  if (years.length < 2) return null;
  return (
    <div className="stm-years" role="tablist" aria-label="Year">
      {years.map((y, i) => (
        <button key={y.fyEnd} type="button" role="tab" aria-selected={i === at} className={`stm-year${i === at ? " on" : ""}`} onClick={() => onPick(i)}>
          FY{y.fyEnd.slice(2, 4)}
        </button>
      ))}
    </div>
  );
}

// ── The balance sheet as a map (24 Oct 2026): each tile's area is its share
// of the total, what it owns on one side and how that's paid for on the
// other, so the big things look big. Colours say what kind of thing a tile
// is: money and what's owed to it in greens and ambers, plant in blue; on
// the other side the owners' money green and debt red.
const TONE = {
  "Cash & liquid investments": "#1E8F7A", "Owed by customers": "#9A6A12", "Inventory": "#B4541B",
  "Factories & equipment": "#3A66C4", "Goodwill & intangibles": "#7556C9", "Long-term investments": "#2683B5",
  "Shareholders' money": "#2E8B57", "Borrowings": "#C03A3A", "Leases": "#B0457A", "Owed to suppliers": "#9A6A12",
};
const toneOf = label => TONE[label] ?? "#5B6170";

export function useBoxWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function TileMap({ title, parts, total, width, height, shown, delay = 0 }) {
  const tiles = squarify(parts.map(p => ({ ...p })), width, height);
  const tiny = tiles.filter(t => !(t.w > 64 && t.h > 34));
  return (
    <div className="bsm-side">
      <div className="stm-stack-head"><span>{title}</span><span style={MONO}>{fmtCrShort(total)}</span></div>
      <div className="bsm-map" style={{ height }} role="img" aria-label={`${title}: ${parts.map(p => `${p.label} ${fmtCrShort(p.value)}`).join(", ")}`}>
        {tiles.map((t, i) => {
          const pct = Math.round((t.value / total) * 100);
          const roomy = t.w > 104 && t.h > 54, fits = t.w > 64 && t.h > 34;
          return (
            <div key={t.label} className="bsm-tile" title={`${t.label}: ${fmtCrShort(t.value)} (${pct}%)`} style={{
              left: t.x, top: t.y, width: t.w, height: t.h, "--tone": toneOf(t.label),
              opacity: shown ? 1 : 0, transform: shown ? "none" : "scale(0.92)",
              transition: reducedMotion() ? "none" : `opacity 420ms ease ${delay + i * 80}ms, transform 560ms cubic-bezier(0.22, 1, 0.36, 1) ${delay + i * 80}ms`,
            }}>
              {fits && <span className="bsm-label">{t.label}</span>}
              {roomy && <span className="bsm-value" style={MONO}>{fmtCrShort(t.value)}</span>}
              {fits && <span className="bsm-pct" style={MONO}>{pct}%</span>}
            </div>
          );
        })}
      </div>
      {tiny.length > 0 && (
        <ul className="stm-legend">
          {tiny.map(t => (
            <li key={t.label}><span className="stm-dot" style={{ background: toneOf(t.label) }} /><span className="stm-legend-label">{t.label}</span><span className="stm-legend-value" style={MONO}>{fmtCrShort(t.value)} · {Math.round((t.value / total) * 100)}%</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BalanceMap({ parts }) {
  const [ref, shown] = useShown();
  const [box, width] = useBoxWidth();
  if (!parts) return null;
  const wide = width >= 560;
  const w = wide ? (width - 16) / 2 : width;
  const h = wide ? 300 : 230;
  return (
    <figure ref={ref} style={{ margin: "0 0 14px" }}>
      <div ref={box} className="bsm-sides">
        {width > 0 && (
          <>
            <TileMap title="What it owns" parts={parts.owns} total={parts.total} width={w} height={h} shown={shown} />
            <TileMap title="How that's paid for" parts={parts.funded} total={parts.total} width={w} height={h} shown={shown} delay={250} />
          </>
        )}
      </div>
      <figcaption className="stm-caption">Each block's size is its share of the total, and the two sides always add up to the same amount. A big green "Shareholders' money" and a small red "Borrowings" means the company owns its assets mostly with its owners' money.</figcaption>
    </figure>
  );
}

// ── Where the cash came from, and where it went (24 Oct 2026): the cash-flow
// lines over 1, 3 or 5 years added up, as two staircases that climb to the
// same total — what came in on the left, what it was spent on on the right
export function FundFlow({ history }) {
  const options = [1, 3, 5].filter(n => sourcesAndUses(history, n));
  const [years, setYears] = useState(options[0] ?? 1);
  if (!options.length) return null;
  const n = options.includes(years) ? years : options[0];
  const flow = sourcesAndUses(history, n);
  const steps = list => [...list.map(l => ({ label: l.label, value: l.value, kind: "step" })), { label: "Total", value: flow.total, kind: "total" }];
  const span = n === 1 ? `FY${history[0].fyEnd.slice(2, 4)}` : `the ${n} years to FY${history[0].fyEnd.slice(2, 4)}`;
  return (
    <section className="fund-flow">
      <div className="fund-flow-head">
        <h3>Where the cash came from, and where it went</h3>
        {options.length > 1 && (
          <div className="stm-years" role="tablist" aria-label="Period" style={{ margin: 0 }}>
            {options.map(o => <button key={o} type="button" role="tab" aria-selected={o === n} className={`stm-year${o === n ? " on" : ""}`} onClick={() => setYears(o)}>{o}Y</button>)}
          </div>
        )}
      </div>
      <div className="stm-stacks">
        <div><div className="stm-stack-head"><span>Came in</span></div><Bridge key={`in${n}`} steps={steps(flow.sources)} stepColor="var(--green)" signed={false} /></div>
        <div><div className="stm-stack-head"><span>Went out</span></div><Bridge key={`out${n}`} steps={steps(flow.uses)} stepColor="var(--red)" signed={false} /></div>
      </div>
      <p className="stm-caption">Over {span}, from the cash-flow statements added together. Both sides add up to the same {fmtCrShort(flow.total)}: every rupee that came in was spent, paid out or kept as cash.</p>
    </section>
  );
}
