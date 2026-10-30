import { useEffect, useId, useState } from "react";
import { BOARD_GROUPS, choiceOf, setChoice, setValues, matchesFind, filterWords } from "./filterBoard.js";
import { isActiveFilter } from "./FilterPanel.jsx";

// The filters on a computer (30 Oct 2026, the three mock-ups combined): a
// column beside the results, always in view — a search to find a filter,
// the most-used ones in groups that open and close (each says how many are
// on), the rest one click away. The column folds to a slim strip. Over the
// results, the filters that are on as chips, each removable (ActiveFilters).
// The drawer's sliders still set exact ranges — the column shows those as
// "Custom range".
function Pick({ item, def, filter, onPick }) {
  const id = useId();
  const on = filter && isActiveFilter(filter);
  if (item.category) {
    const values = filter?.values ?? [];
    const options = def.options ?? [];
    return (
      <div className="fb-item">
        <label htmlFor={id}>{item.label}</label>
        <select id={id} className={`fb-select${on ? " on" : ""}`} title={def.about} value={values.length > 1 ? "__many" : values[0] ?? ""}
          onChange={e => e.target.value !== "__many" && onPick(e.target.value ? [e.target.value] : [])}>
          <option value="">Any</option>
          {values.length > 1 && <option value="__many">{values.length} picked</option>}
          {options.map(o => <option key={o} value={o}>{o}{item.id === "sector" && def.counts?.[o] ? ` (${def.counts[o]})` : ""}</option>)}
        </select>
      </div>
    );
  }
  const value = choiceOf(item, filter);
  return (
    <div className="fb-item">
      <label htmlFor={id}>{item.label}</label>
      <select id={id} className={`fb-select${on ? " on" : ""}`} title={value === "custom" ? filterWords(def, filter) : def.about} value={value} onChange={e => onPick(e.target.value)}>
        <option value="">Any</option>
        {value === "custom" && <option value="custom" title={filterWords(def, filter)}>Custom range</option>}
        {item.choices.map(([label], i) => <option key={label} value={String(i)}>{label}</option>)}
      </select>
    </div>
  );
}

// Folded or open, and which groups are open, remembered on this computer
const OPEN_KEY = "filterBoardOpen", GROUPS_KEY = "filterGroupsOpen";
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

export default function FilterBoard({ meta, filters, onChange, onMore, matched, total }) {
  const [open, setOpenState] = useState(() => read(OPEN_KEY, 1) !== 0);
  const setOpen = v => { setOpenState(v); write(OPEN_KEY, v ? 1 : 0); };
  const [shut, setShutState] = useState(() => read(GROUPS_KEY, ["growth", "owners", "price"]));
  const toggle = id => setShutState(s => { const next = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; write(GROUPS_KEY, next); return next; });
  const [find, setFind] = useState("");
  const findId = useId(), ownId = useId();
  const symbolsText = (filters.find(f => f.id === "symbols")?.values ?? []).join(", ");
  const [own, setOwn] = useState(symbolsText);
  useEffect(() => setOwn(symbolsText), [symbolsText]);
  const active = filters.filter(isActiveFilter);
  const known = id => meta.byId.get(id) && (meta.byId.get(id).known == null || meta.byId.get(id).known > 0);
  const finding = find.trim() !== "";
  const groups = BOARD_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => known(i.id) && (!finding || matchesFind(i, find))) }))
    .filter(g => g.items.length);
  const onIn = g => g.items.filter(i => active.some(f => f.id === i.id)).length;
  const pick = item => value => onChange(item.category ? setValues(filters, item.id, value) : setChoice(filters, item, value));
  const applyOwn = () => onChange(setValues(filters, "symbols", [...new Set(own.toUpperCase().split(/[\s,;]+/).map(v => v.replace(/[^A-Z0-9&-]/g, "")).filter(Boolean))].slice(0, 60)));
  const more = meta.metrics.length;

  if (!open) return (
    <aside className="fb fb-folded" aria-label="Filters">
      <button type="button" className="fb-unfold" aria-expanded="false" onClick={() => setOpen(true)} title="Show filters">
        <span aria-hidden="true">»</span>
        <span className="fb-unfold-label">Show filters</span>
        {active.length > 0 && <span className="fb-on">{active.length}</span>}
      </button>
    </aside>
  );

  return (
    <aside className="fb" aria-labelledby="fb-title">
      <div className="fb-head">
        <h2 id="fb-title">Filters{active.length > 0 && <span className="fb-on">{active.length} on</span>}</h2>
        <button type="button" className="fb-link-btn" onClick={() => { onChange([]); setOwn(""); }} disabled={!active.length}>Clear all</button>
        <button type="button" className="fb-fold" aria-expanded="true" onClick={() => setOpen(false)} title="Hide filters" aria-label="Hide filters">«</button>
      </div>
      {matched != null && <p className="fb-count"><b>{matched.toLocaleString("en-IN")}</b>{total ? ` of ${total.toLocaleString("en-IN")}` : ""} companies match</p>}
      <label htmlFor={findId} className="sr-only">Find a filter</label>
      <input id={findId} className="fb-find" type="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Find a filter: ROCE, pledged, RSI…" autoComplete="off" spellCheck={false} />
      <div className="fb-groups">
        {groups.map(g => {
          const expanded = finding || !shut.includes(g.id);
          const n = onIn(g);
          return (
            <section key={g.id} className="fb-group">
              <h3>
                <button type="button" aria-expanded={expanded} aria-controls={`fb-g-${g.id}`} onClick={() => toggle(g.id)} disabled={finding}>
                  <span>{g.label}</span>
                  {n > 0 && <span className="fb-group-on">{n} on</span>}
                  <span className="fb-caret" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                </button>
              </h3>
              {expanded && (
                <div id={`fb-g-${g.id}`} className="fb-grid">
                  {g.items.map(item => <Pick key={item.id} item={item} def={meta.byId.get(item.id)} filter={filters.find(f => f.id === item.id)} onPick={pick(item)} />)}
                </div>
              )}
            </section>
          );
        })}
        {!groups.length && <p className="fb-none">None of these match "{find}". <button type="button" className="fb-link" onClick={onMore}>Search all {more} filters</button></p>}
      </div>
      <div className="fb-foot">
        <label htmlFor={ownId}>Only these companies</label>
        <input id={ownId} value={own} onChange={e => setOwn(e.target.value)} onBlur={applyOwn} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyOwn(); } }}
          placeholder="TCS, INFY, RELIANCE" autoComplete="off" spellCheck={false} />
        <button type="button" className="fb-more" onClick={onMore}>+ More filters ({more})</button>
      </div>
    </aside>
  );
}

// Over the results: every filter that's on, one click to remove
export function ActiveFilters({ meta, filters, onChange }) {
  const active = filters.filter(isActiveFilter);
  if (!active.length) return null;
  return (
    <div className="fb-active" role="group" aria-label="Filters that are on">
      {active.map(f => (
        <button key={f.id} type="button" className="fb-chip" onClick={() => onChange(filters.filter(x => x.id !== f.id))} aria-label={`Remove ${filterWords(meta.byId.get(f.id), f)}`}>
          {filterWords(meta.byId.get(f.id), f)} <span aria-hidden="true">✕</span>
        </button>
      ))}
      {active.length > 1 && <button type="button" className="fb-link fb-clear" onClick={() => onChange([])}>Clear all</button>}
    </div>
  );
}
