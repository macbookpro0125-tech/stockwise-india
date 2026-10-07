import { useState, useEffect, useRef, useId } from "react";
import { formatInput, unitLabel } from "./meta.js";

// The screener's filter sidebar: market-cap size, one row per filter (a
// min–max range with a two-handle slider, or a sector checklist), and
// "+ Add filter". Filters are { id, min, max } or { id, values } — see
// server/metric-catalog.js.

export const isActiveFilter = f => (f.values ? f.values.length > 0 : f.min != null || f.max != null);

// Slider notch → percentile of companies, so every notch passes the same
// number of them (q is the metric's value at each percentile, 0–100)
function positionOf(q, v, side) {
  if (v == null) return side === "min" ? 0 : 100;
  if (side === "min") {
    const i = q.findIndex(x => x >= v);
    return i === -1 ? 100 : i;
  }
  for (let i = 100; i >= 0; i--) if (q[i] <= v) return i;
  return 0;
}

function DualRange({ q, min, max, onChange }) {
  const lo = positionOf(q, min, "min");
  const hi = positionOf(q, max, "max");
  const [pos, setPos] = useState([lo, hi]);
  const dragging = useRef(false);
  // Follow the boxes, but not mid-drag: many companies can share a value
  // (0% pledged), and snapping the handle to it would fight the pointer
  useEffect(() => { if (!dragging.current) setPos([lo, hi]); }, [lo, hi]);

  const move = (side, p) => {
    dragging.current = true;
    const next = side === "min" ? [Math.min(p, pos[1]), pos[1]] : [pos[0], Math.max(p, pos[0])];
    setPos(next);
    // The ends mean "no limit"
    onChange(side, side === "min" ? (next[0] === 0 ? null : q[next[0]]) : (next[1] === 100 ? null : q[next[1]]));
  };
  const end = () => { dragging.current = false; };

  return (
    <div className="dual-range" onPointerUp={end} onKeyUp={end} onBlur={end}>
      <div className="dual-range-track">
        <div className="dual-range-fill" style={{ left: `${pos[0]}%`, right: `${100 - pos[1]}%` }} />
      </div>
      <input type="range" min={0} max={100} value={pos[0]} aria-label="Lowest" onChange={e => move("min", Number(e.target.value))} style={{ zIndex: pos[0] > 90 ? 3 : 2 }} />
      <input type="range" min={0} max={100} value={pos[1]} aria-label="Highest" onChange={e => move("max", Number(e.target.value))} style={{ zIndex: 2 }} />
    </div>
  );
}

function BoundInput({ def, value, placeholder, onCommit, label }) {
  const [text, setText] = useState(formatInput(def, value));
  useEffect(() => { setText(formatInput(def, value)); }, [def, value]);
  const commit = () => {
    const t = text.trim().replace(/,/g, "");
    if (t === "") return onCommit(null);
    const v = Number(t);
    if (Number.isFinite(v)) onCommit(v);
    else setText(formatInput(def, value)); // not a number: put the old one back
  };
  return (
    <input
      className="input-base mono" inputMode="decimal" aria-label={label} placeholder={placeholder}
      value={text} onChange={e => setText(e.target.value)} onBlur={commit}
      // Enter applies straight away, not only by leaving the box
      onKeyDown={e => { if (e.key === "Enter") { commit(); e.currentTarget.blur(); } }}
      style={{ height: 34, fontSize: 12.5, padding: "0 10px", minWidth: 0 }}
    />
  );
}

function RowHeader({ def, onRemove, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)", lineHeight: 1.35 }} title={def.about || undefined}>
          {def.label}{unitLabel(def) && <span style={{ color: "var(--t3)", fontWeight: 500 }}> · {unitLabel(def)}</span>}
        </div>
        {children}
      </div>
      <button type="button" onClick={onRemove} title="Remove this filter" aria-label={`Remove ${def.label}`}
        style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: "var(--t3)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  );
}

function NumericFilter({ def, filter, companies, onChange, onRemove }) {
  const r = def.range;
  const set = (side, v) => onChange({ ...filter, [side]: v == null ? null : Number(formatInput(def, v)) });
  return (
    <div className="filter-row">
      <RowHeader def={def} onRemove={onRemove} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 6 }}>
        <BoundInput def={def} value={filter.min} label={`${def.label}: lowest`} placeholder={r ? `Min ${formatInput(def, r.min)}` : "Min"} onCommit={v => set("min", v)} />
        <span style={{ fontSize: 11, color: "var(--t3)" }}>to</span>
        <BoundInput def={def} value={filter.max} label={`${def.label}: highest`} placeholder={r ? `Max ${formatInput(def, r.max)}` : "Max"} onCommit={v => set("max", v)} />
      </div>
      {r && <DualRange q={r.q} min={filter.min} max={filter.max} onChange={set} />}
      {r && r.known < companies && isActiveFilter(filter) && (
        <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>
          Known for {r.known.toLocaleString("en-IN")} of {companies.toLocaleString("en-IN")} — the rest are left out
        </div>
      )}
    </div>
  );
}

function SectorFilter({ def, filter, companies, onChange, onRemove }) {
  const [q, setQ] = useState("");
  const chosen = new Set(filter.values ?? []);
  const toggle = s => {
    const next = new Set(chosen);
    if (next.has(s)) next.delete(s); else next.add(s);
    onChange({ ...filter, values: [...next] });
  };
  const options = (def.options ?? []).filter(s => !q || s.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="filter-row">
      <RowHeader def={def} onRemove={onRemove}>
        {def.known < companies && (
          <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 2 }}>
            Known for {def.known.toLocaleString("en-IN")} of {companies.toLocaleString("en-IN")} companies so far
          </div>
        )}
      </RowHeader>
      {(def.options?.length ?? 0) > 8 && (
        <input className="input-base" placeholder="Find a sector" value={q} onChange={e => setQ(e.target.value)} style={{ height: 32, fontSize: 12.5, marginBottom: 6 }} />
      )}
      <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {options.map(s => (
          <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: chosen.has(s) ? "var(--t1)" : "var(--t2)", padding: "4px 2px", cursor: "pointer" }}>
            <input type="checkbox" checked={chosen.has(s)} onChange={() => toggle(s)} style={{ margin: 0 }} />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}

// Always on show under market cap: pick a sector and the list keeps only its
// companies, best Quality score first. Several sectors at once (a strategy or
// a shared link can carry them) get the checklist instead.
function SectorPick({ def, filter, companies, onChange }) {
  const values = filter?.values ?? [];
  // The panel is drawn twice (sidebar and phone sheet), so the id can't be fixed
  const id = useId();
  if (values.length > 1) return <SectorFilter def={def} filter={filter} companies={companies} onChange={f => onChange(f.values)} onRemove={() => onChange([])} />;
  return (
    <div className="filter-row">
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--t1)", marginBottom: 8 }}>Sector</label>
      <select id={id} className="input-base" value={values[0] ?? ""} onChange={e => onChange(e.target.value ? [e.target.value] : [])}
        style={{ width: "100%", height: 36, fontSize: 13, cursor: "pointer" }}>
        <option value="">All sectors</option>
        {(def.options ?? []).map(s => <option key={s} value={s}>{s}{def.counts?.[s] ? ` (${def.counts[s]})` : ""}</option>)}
      </select>
      {values.length > 0 && def.known < companies && (
        <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 4 }}>
          Known for {def.known.toLocaleString("en-IN")} of {companies.toLocaleString("en-IN")} companies so far
        </div>
      )}
    </div>
  );
}

function CapSize({ def, filter, onChange }) {
  const chosen = new Set(filter?.values ?? []);
  const toggle = o => {
    const next = new Set(chosen);
    if (next.has(o)) next.delete(o); else next.add(o);
    onChange([...next]);
  };
  return (
    <div className="filter-row">
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1)", marginBottom: 8 }} title={def.about}>{def.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
        {def.options.map(o => {
          const on = chosen.has(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} aria-pressed={on}
              style={{ height: 32, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--bdr2)"}`, background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--t2)" }}>
              {o.replace(" cap", "")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterPanel({ meta, filters, onChange, onAddFilter, onReset }) {
  const active = filters.filter(isActiveFilter).length;
  const replace = (id, next) => onChange(filters.map(f => (f.id === id ? next : f)));
  const remove = id => onChange(filters.filter(f => f.id !== id));
  const cap = filters.find(f => f.id === "capSize");
  const setCap = values => {
    if (!values.length) return remove("capSize");
    if (cap) return replace("capSize", { id: "capSize", values });
    onChange([...filters, { id: "capSize", values }]);
  };
  const sector = filters.find(f => f.id === "sector");
  const setSector = values => {
    if (!values.length) return remove("sector");
    if (sector) return replace("sector", { id: "sector", values });
    onChange([...filters, { id: "sector", values }]);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>Filters</span>
          {active > 0 && <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 999, fontWeight: 700, background: "var(--accent)", color: "var(--on-accent)" }}>{active}</span>}
        </div>
        {filters.length > 0 && (
          <button type="button" className="btn-ghost" onClick={onReset} style={{ height: 28, fontSize: 11.5, padding: "0 10px" }}>Reset all</button>
        )}
      </div>

      <CapSize def={meta.byId.get("capSize")} filter={cap} onChange={setCap} />
      {meta.byId.get("sector") && <SectorPick def={meta.byId.get("sector")} filter={sector} companies={meta.companies} onChange={setSector} />}

      {filters.filter(f => f.id !== "capSize" && f.id !== "sector").map(f => {
        const def = meta.byId.get(f.id);
        if (!def) return null;
        const props = { key: f.id, def, filter: f, companies: meta.companies, onChange: next => replace(f.id, next), onRemove: () => remove(f.id) };
        return <NumericFilter {...props} />;
      })}

      <button type="button" className="btn-ghost" onClick={onAddFilter} style={{ width: "100%", height: 40, marginTop: 12, borderStyle: "dashed", color: "var(--accent)", fontWeight: 600 }}>
        + Add filter
      </button>
      <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5, margin: "10px 2px 0" }}>
        Results update as you change a filter. Leave a box empty for no limit.
      </p>
    </div>
  );
}
