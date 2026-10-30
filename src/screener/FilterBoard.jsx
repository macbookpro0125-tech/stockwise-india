import { useEffect, useId, useState } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { BOARD_GROUPS, choiceOf, setChoice, setValues, matchesFind, filterWords, boardItem } from "./filterBoard.js";
import { isActiveFilter } from "./FilterPanel.jsx";

// The Workspace's filters on a computer (31 Oct 2026, "see every option in
// one place"): a board of labelled dropdowns over the full-width results.
// Tabs by kind — the most used first, each kind of measure, then All — so a
// newcomer sees what there is; each tab says how many filters it holds, or
// how many of them are on. Under it, the filters that are on as chips. The
// drawer's sliders still set exact ranges, shown here as "Custom range".
function Pick({ item, def, filter, onPick }) {
  const id = useId();
  const on = filter && isActiveFilter(filter);
  if (item.category) {
    const values = filter?.values ?? [];
    const options = def.options ?? [];
    return (
      <div className="fb-item">
        <label htmlFor={id} title={def.about}>{item.label}</label>
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
      <label htmlFor={id} title={def.about ?? item.label}>{item.label}</label>
      <select id={id} className={`fb-select${on ? " on" : ""}`} title={value === "custom" ? filterWords(def, filter) : def.about} value={value} onChange={e => onPick(e.target.value)}>
        <option value="">Any</option>
        {value === "custom" && <option value="custom" title={filterWords(def, filter)}>Custom range</option>}
        {item.choices.map(([label], i) => <option key={label} value={String(i)}>{label}</option>)}
      </select>
    </div>
  );
}

// Open or folded, and the tab, remembered on this computer
const read = (key, fallback) => { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
const COMMON = "__common", ALL = "__all", ON = "__on";
const TAB_NAMES = { Size: "Size & listing", "Volume & technicals": "Technical", "Price & returns": "Price & returns", "Financial health": "Health", "Quarterly results": "Results" };

export default function FilterBoard({ meta, filters, onChange, onMore, onUndo = null, onRedo = null }) {
  const [open, setOpenState] = useState(() => read("filterBoardOpen", 1) !== 0);
  const setOpen = v => { setOpenState(v); write("filterBoardOpen", v ? 1 : 0); };
  const [tab, setTabState] = useState(() => read("filterBoardTab", COMMON));
  const setTab = v => { setTabState(v); write("filterBoardTab", v); };
  const [find, setFind] = useState("");
  const findId = useId(), ownId = useId();
  const symbolsText = (filters.find(f => f.id === "symbols")?.values ?? []).join(", ");
  const [own, setOwn] = useState(symbolsText);
  useEffect(() => setOwn(symbolsText), [symbolsText]);

  const active = filters.filter(isActiveFilter);
  const isOn = id => active.some(f => f.id === id);
  const known = def => def && def.id !== "symbols" && (def.known == null || def.known > 0);
  const defs = [...meta.metrics, ...(meta.categoryMetrics ?? [])].filter(known);
  const common = BOARD_GROUPS.flatMap(g => g.items).filter(i => known(meta.byId.get(i.id)));
  const kinds = meta.categories.filter(c => defs.some(d => d.category === c));
  const ofKind = c => defs.filter(d => d.category === c).map(boardItem).filter(Boolean);
  const everything = defs.map(boardItem).filter(Boolean);
  const finding = find.trim() !== "";
  const shownTab = tab === ON && !active.length ? COMMON : kinds.includes(tab) || [COMMON, ALL, ON].includes(tab) ? tab : COMMON;
  const items = finding ? everything.filter(i => matchesFind(i, find) || (meta.byId.get(i.id)?.about ?? "").toLowerCase().includes(find.trim().toLowerCase()))
    : shownTab === COMMON ? common
    : shownTab === ALL ? everything
    : shownTab === ON ? everything.filter(i => isOn(i.id))
    : ofKind(shownTab);
  const pick = item => value => onChange(item.category ? setValues(filters, item.id, value) : setChoice(filters, item, value));
  const applyOwn = () => onChange(setValues(filters, "symbols", [...new Set(own.toUpperCase().split(/[\s,;]+/).map(v => v.replace(/[^A-Z0-9&-]/g, "")).filter(Boolean))].slice(0, 60)));
  const count = list => list.filter(i => isOn(i.id)).length;
  const tabs = [
    [COMMON, "Most used", common],
    [ALL, "All", everything],
    ...kinds.map(k => [k, TAB_NAMES[k] ?? k, ofKind(k)]),
  ];

  return (
    <section className={`fb${open ? "" : " fb-folded"}`} aria-labelledby="fb-title">
      <div className="fb-bar">
        <h2 id="fb-title" className="sr-only">Filters</h2>
        <div className="fb-tabs" role="tablist" aria-label="Filters by kind">
          {tabs.map(([id, label, list]) => {
            const n = count(list);
            return (
              <button key={id} type="button" role="tab" aria-selected={open && !finding && shownTab === id} onClick={() => { setFind(""); setTab(id); if (!open) setOpen(true); }}>
                {label} <span className={n ? "on" : undefined}>{n ? `${n} on` : list.length}</span>
              </button>
            );
          })}
        </div>
        <div className="fb-tools">
          <button type="button" className="fb-icon" onClick={onUndo ?? undefined} disabled={!onUndo} aria-label="Undo the last filter change" title="Undo"><Undo2 size={15} aria-hidden="true" /></button>
          <button type="button" className="fb-icon" onClick={onRedo ?? undefined} disabled={!onRedo} aria-label="Redo" title="Redo"><Redo2 size={15} aria-hidden="true" /></button>
          <label htmlFor={findId} className="sr-only">Find a filter</label>
          <input id={findId} className="fb-find" type="search" value={find} onChange={e => { setFind(e.target.value); if (!open) setOpen(true); }}
            placeholder={`Find any of ${everything.length} filters`} autoComplete="off" spellCheck={false} />
          <button type="button" className="fb-fold" aria-expanded={open} aria-controls="fb-panel" onClick={() => setOpen(!open)}>{open ? "Hide filters ▴" : "Show filters ▾"}</button>
        </div>
      </div>
      {open && (
        <div id="fb-panel" className="fb-body">
          {items.length ? (
            <div className="fb-grid">
              {items.map(item => <Pick key={item.id} item={item} def={meta.byId.get(item.id)} filter={filters.find(f => f.id === item.id)} onPick={pick(item)} />)}
            </div>
          ) : (
            <p className="fb-none">{finding ? <>No filter matches "{find}".</> : "None of these are on yet."}</p>
          )}
          {(shownTab === COMMON || shownTab === "Size") && !finding && (
            <div className="fb-own">
              <label htmlFor={ownId}>Only these companies</label>
              <input id={ownId} value={own} onChange={e => setOwn(e.target.value)} onBlur={applyOwn} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyOwn(); } }}
                placeholder="TCS, INFY, RELIANCE" autoComplete="off" spellCheck={false} />
              <button type="button" className="fb-link" onClick={onMore}>Exact ranges with sliders</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// Under the board: every filter that's on, one click to remove; + Add filter
// opens the full list; the count on the right
export function ActiveFilters({ meta, filters, onChange, onAdd, matched, total }) {
  const active = filters.filter(isActiveFilter);
  return (
    <div className="fb-active" role="group" aria-label="Filters that are on">
      {active.map(f => (
        <button key={f.id} type="button" className="fb-chip" onClick={() => onChange(filters.filter(x => x.id !== f.id))} aria-label={`Remove ${filterWords(meta.byId.get(f.id), f)}`}>
          {filterWords(meta.byId.get(f.id), f)} <span aria-hidden="true">✕</span>
        </button>
      ))}
      {onAdd && <button type="button" className="fb-add" onClick={onAdd}>+ Add filter</button>}
      {active.length > 0 && <button type="button" className="fb-link fb-clear" onClick={() => onChange([])}>Clear all</button>}
      {matched != null && <span className="fb-count"><b>{matched.toLocaleString("en-IN")}</b>{total ? ` of ${total.toLocaleString("en-IN")}` : ""} companies</span>}
    </div>
  );
}
