import { useEffect, useRef, useState } from "react";

// The statements as pictures (24 Oct 2026, "in animations so simple they can
// understand"): a year's profit and loss or cash flow as a bridge — each line
// a bar that starts where the one before ended, so sales visibly shrink to
// profit — and the balance sheet as two bars of the same length, what it owns
// and how that's paid for. Bars grow in once, when they come into view, one
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
export function Bridge({ steps, caption }) {
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
        const color = r.kind === "total" ? (r.value < 0 ? "var(--red)" : "var(--accent)") : r.value >= 0 ? "var(--green)" : "var(--red)";
        return (
          <div key={`${r.label}${i}`} className={`stm-row${r.kind === "total" ? " total" : ""}`}>
            <span className="stm-label">{r.label}</span>
            <span className="stm-track" aria-hidden="true">
              {lo < 0 && <span className="stm-zero" style={{ left: `${x(0)}%` }} />}
              <span className="stm-bar" style={{ left: `${left}%`, width: `${width}%`, background: color, transformOrigin: r.value >= 0 || r.kind === "total" ? "left" : "right", ...grow(shown, i) }} />
            </span>
            <span className="stm-value" style={{ color: r.kind === "total" ? "var(--t1)" : color, ...MONO }}>{r.kind === "total" ? "" : r.value >= 0 ? "+" : ""}{fmtCrShort(r.value)}</span>
          </div>
        );
      })}
      {caption && <figcaption className="stm-caption">{caption}</figcaption>}
    </figure>
  );
}

// One bar of parts adding to 100%, with its legend
export function StackBar({ title, parts, total, offset = 0, shown }) {
  return (
    <div className="stm-stack">
      <div className="stm-stack-head"><span>{title}</span><span style={MONO}>{fmtCrShort(total)}</span></div>
      <div className="stm-stack-bar" aria-hidden="true">
        {parts.map((p, i) => (
          <span key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: PALETTE[(i + offset) % PALETTE.length], transformOrigin: "left", ...grow(shown, i) }} />
        ))}
      </div>
      <ul className="stm-legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <span className="stm-dot" style={{ background: PALETTE[(i + offset) % PALETTE.length] }} />
            <span className="stm-legend-label">{p.label}</span>
            <span className="stm-legend-value" style={MONO}>{fmtCrShort(p.value)} · {Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BalancePicture({ parts }) {
  const [ref, shown] = useShown();
  if (!parts) return null;
  return (
    <figure ref={ref} style={{ margin: "0 0 14px" }}>
      <div className="stm-stacks">
        <StackBar title="What it owns" parts={parts.owns} total={parts.total} shown={shown} />
        <StackBar title="How that's paid for" parts={parts.funded} total={parts.total} offset={3} shown={shown} />
      </div>
      <figcaption className="stm-caption">The two always add up to the same total. More shareholders' money and less borrowing means the company carries less debt for what it owns.</figcaption>
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
