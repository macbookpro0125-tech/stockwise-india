import { useState, useRef, useMemo, useEffect, useId } from "react";
import { Search, X } from "lucide-react";
import { isActiveFilter } from "./FilterPanel.jsx";
import { formatInput } from "./meta.js";

// Discover's one box for both jobs: type a company's name and the results
// narrow as you type; type a metric ("roe", "debt", "pledge") and it offers
// that filter. The active filters sit in the box as chips: click one to
// change its numbers, × to drop it. It edits the same filters as the sidebar
// (DiscoverView's `filters`), so the two always agree, and the server screens
// them exactly as before. Replaced the fixed Quality / Research / Piotroski
// boxes (14 Oct 2026): any of the 126 filters, as many or as few as wanted.

// Shown when the box is empty and opened: common first filters, ready-set
const POPULAR = [
  { id: "quality", min: 70 },
  { id: "researchScore", min: 65 },
  { id: "piotroski", min: 7 },
  { id: "roe", min: 15 },
  { id: "debtToEquity", max: 0.5 },
  { id: "pe", max: 25 },
];

const prefix = def => (def.unit === "₹" || def.unit === "₹ Cr" ? "₹" : "");
const suffix = def => ({ "%": "%", x: "x", "₹ Cr": " Cr" }[def.unit] ?? "");
const num = (def, v) => `${prefix(def)}${Number(formatInput(def, v)).toLocaleString("en-IN")}${suffix(def)}`;
const name = def => def.short || def.label;

// "ROE ≥ 15%", "P/E ≤ 25", "Sales 3Y 10%–40%", "Size: Large, Mid"
export function filterText(def, f) {
  if (f.values) return `${name(def)}: ${f.values.join(", ")}`;
  if (f.min != null && f.max != null) return `${name(def)} ${num(def, f.min)}–${num(def, f.max)}`;
  if (f.min != null) return `${name(def)} ≥ ${num(def, f.min)}`;
  return `${name(def)} ≤ ${num(def, f.max)}`;
}

function parse(text) {
  const t = String(text).trim().replace(/[,₹%x\s]|Cr/gi, "");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined; // undefined: not a number
}

// The small panel that sets one filter's numbers (or its choices)
function Editor({ def, filter, companies, onSave, onRemove, onClose, isNew }) {
  const [min, setMin] = useState(formatInput(def, filter?.min));
  const [max, setMax] = useState(formatInput(def, filter?.max));
  const [values, setValues] = useState(filter?.values ?? []);
  const [bad, setBad] = useState(false);
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  const save = e => {
    e?.preventDefault();
    if (def.options) {
      if (!values.length) return isNew ? onClose() : onRemove();
      return onSave({ id: def.id, values });
    }
    const lo = parse(min), hi = parse(max);
    if (lo === undefined || hi === undefined) { setBad(true); return; }
    if (lo == null && hi == null) return isNew ? onClose() : onRemove();
    onSave({ id: def.id, min: lo, max: hi });
  };
  const unit = def.unit === "%" ? "%" : def.unit === "x" ? "×" : def.unit === "₹ Cr" ? "₹ Cr" : def.unit === "₹" ? "₹" : def.unit?.startsWith("/") ? `of ${def.unit.slice(1)}` : "";
  const box = { width: 92, height: 34, padding: "0 8px", fontSize: 14 };

  return (
    <form className="smart-editor" role="dialog" aria-label={`${def.label} filter`} onSubmit={save}
      onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
      <div style={{ fontSize: 13, fontWeight: 650, color: "var(--t1)", marginBottom: 2 }}>{def.label}</div>
      {def.about && <div style={{ fontSize: 11.5, color: "var(--t3)", lineHeight: 1.45, marginBottom: 10 }}>{def.about}</div>}

      {def.options ? (
        def.options.length <= 4 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {def.options.map((o, i) => {
              const on = values.includes(o);
              return (
                <button key={o} ref={i === 0 ? firstRef : undefined} type="button" aria-pressed={on} onClick={() => setValues(on ? values.filter(v => v !== o) : [...values, o])}
                  className="btn-ghost" style={{ height: 32, fontSize: 12.5, ...(on ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-glow)" } : {}) }}>
                  {o}
                </button>
              );
            })}
          </div>
        ) : (
          <select ref={firstRef} className="input-base" aria-label={def.label} value={values[0] ?? ""} onChange={e => setValues(e.target.value ? [e.target.value] : [])}
            style={{ width: "100%", height: 36, marginBottom: 10, cursor: "pointer" }}>
            <option value="">Any</option>
            {def.options.map(o => <option key={o} value={o}>{o}{def.counts?.[o] ? ` (${def.counts[o]})` : ""}</option>)}
          </select>
        )
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <input ref={firstRef} className="input-base" inputMode="decimal" aria-label={`${def.label}, at least`} placeholder={def.min != null ? `Min ${formatInput(def, def.min)}` : "Min"} value={min} onChange={e => { setMin(e.target.value); setBad(false); }} style={box} />
            <span style={{ fontSize: 12, color: "var(--t3)" }}>to</span>
            <input className="input-base" inputMode="decimal" aria-label={`${def.label}, at most`} placeholder={def.max != null ? `Max ${formatInput(def, def.max)}` : "Max"} value={max} onChange={e => { setMax(e.target.value); setBad(false); }} style={box} />
            {unit && <span style={{ fontSize: 12, color: "var(--t3)" }}>{unit}</span>}
          </div>
          <div role={bad ? "alert" : undefined} style={{ fontSize: 11, color: bad ? "var(--red)" : "var(--t3)", marginBottom: 10 }}>
            {bad ? "Numbers only, please." : `Leave a box empty for no limit.${def.known != null && companies ? ` Known for ${def.known.toLocaleString("en-IN")} of ${companies.toLocaleString("en-IN")}.` : ""}`}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {isNew ? <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 32, fontSize: 12.5 }}>Cancel</button>
          : <button type="button" className="btn-ghost" onClick={onRemove} style={{ height: 32, fontSize: 12.5, color: "var(--red)" }}>Remove</button>}
        <button type="submit" className="btn-primary" style={{ height: 32, padding: "0 16px", fontSize: 12.5 }}>{isNew ? "Add filter" : "Done"}</button>
      </div>
    </form>
  );
}

export default function SmartFilterBar({ meta, filters, onChange, query, onQuery }) {
  const [open, setOpen] = useState(false);       // the suggestion list
  const [active, setActive] = useState(-1);      // highlighted suggestion
  const [editing, setEditing] = useState(null);  // { id, isNew }
  const wrapRef = useRef(null), inputRef = useRef(null);
  const listId = useId();

  const list = filters ?? [];
  const chips = list.filter(f => isActiveFilter(f) && meta.byId.get(f.id));
  const allDefs = useMemo(() => [...meta.metrics, ...meta.categoryMetrics], [meta]);

  const text = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!text) {
      return POPULAR.filter(p => meta.byId.get(p.id) && !chips.some(c => c.id === p.id))
        .map(p => ({ kind: "popular", def: meta.byId.get(p.id), filter: { id: p.id, min: p.min ?? null, max: p.max ?? null } }));
    }
    if (text.length < 2) return [];
    const hit = d => [d.label, d.short, d.category, d.id].some(s => s && s.toLowerCase().includes(text));
    return allDefs.filter(hit).slice(0, 7).map(def => ({ kind: chips.some(c => c.id === def.id) ? "edit" : "add", def }));
  }, [text, meta, allDefs, chips]);

  // Close the list on a click elsewhere
  useEffect(() => {
    const away = e => { if (!wrapRef.current?.contains(e.target)) { setOpen(false); setEditing(null); } };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  useEffect(() => { setActive(-1); }, [text]);

  const upsert = f => {
    const exists = list.some(x => x.id === f.id);
    onChange(exists ? list.map(x => (x.id === f.id ? f : x)) : [...list, f]);
  };
  const remove = id => onChange(list.filter(x => x.id !== id));

  const pick = s => {
    setOpen(false);
    if (s.kind === "popular") { upsert(s.filter); onQuery(""); return; }
    onQuery("");
    setEditing({ id: s.def.id, isNew: s.kind === "add" });
  };

  const onKeyDown = e => {
    if (e.key === "ArrowDown" && suggestions.length) { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % suggestions.length); }
    else if (e.key === "ArrowUp" && suggestions.length) { e.preventDefault(); setActive(a => (a <= 0 ? suggestions.length - 1 : a - 1)); }
    else if (e.key === "Enter" && open && active >= 0) { e.preventDefault(); pick(suggestions[active]); }
    else if (e.key === "Escape") { if (open) setOpen(false); else if (query) onQuery(""); }
  };

  const editDef = editing && meta.byId.get(editing.id);
  const showList = open && !editing && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="smart-bar-wrap" style={{ position: "relative", marginBottom: 12 }}>
      <div className="smart-bar" onClick={e => { if (e.target === e.currentTarget) inputRef.current?.focus(); }}>
        <Search size={15} aria-hidden="true" style={{ color: "var(--t3)", flexShrink: 0, marginLeft: 4 }} />
        {/* One swipeable row on a phone (index.css .smart-chips); inline here */}
        {chips.length > 0 && <span className="smart-chips">{chips.map(f => {
          const def = meta.byId.get(f.id);
          const label = filterText(def, f);
          return (
            <span key={f.id} className="smart-chip">
              <button type="button" onClick={() => { setOpen(false); setEditing({ id: f.id, isNew: false }); }} aria-label={`${label} — change`} title={def.label}
                style={{ border: 0, background: "none", color: "inherit", font: "inherit", cursor: "pointer", padding: "0 2px 0 9px", height: "100%", whiteSpace: "nowrap" }}>
                {label}
              </button>
              <button type="button" onClick={() => remove(f.id)} aria-label={`Remove the ${def.label} filter`} className="smart-chip-x">
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          );
        })}</span>}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search a company or add a filter"
          placeholder={chips.length ? "Add a filter or search…" : "Search a company or add a filter (e.g. ROE)"}
          value={query}
          onChange={e => { onQuery(e.target.value); setOpen(true); setEditing(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="smart-input"
        />
        {query && (
          <button type="button" onClick={() => { onQuery(""); inputRef.current?.focus(); }} aria-label="Clear the search" className="smart-chip-x" style={{ marginRight: 2 }}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {showList && (
        <ul id={listId} role="listbox" aria-label={text ? "Filters matching your search" : "Popular filters"} className="smart-list">
          <li role="presentation" className="smart-list-head">{text ? "Filters" : "Popular filters"}</li>
          {suggestions.map((s, i) => (
            <li key={s.def.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onPointerDown={e => e.preventDefault()} onClick={() => pick(s)} onPointerEnter={() => setActive(i)}
              className={`smart-option${i === active ? " on" : ""}`}>
              <span style={{ color: "var(--t1)" }}>{s.kind === "popular" ? filterText(s.def, s.filter) : s.def.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>
                {s.kind === "edit" ? "Change" : s.kind === "popular" ? "Add" : s.def.category}
              </span>
            </li>
          ))}
        </ul>
      )}

      {editDef && (
        <Editor
          key={editing.id}
          def={editDef}
          filter={list.find(f => f.id === editing.id)}
          companies={meta.companies}
          isNew={editing.isNew}
          onSave={f => { upsert(f); setEditing(null); inputRef.current?.focus(); }}
          onRemove={() => { remove(editing.id); setEditing(null); inputRef.current?.focus(); }}
          onClose={() => { setEditing(null); inputRef.current?.focus(); }}
        />
      )}
    </div>
  );
}
