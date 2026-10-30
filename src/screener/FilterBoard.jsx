import { useId, useState } from "react";
import { BOARD_GROUPS, choiceOf, setChoice, setValues, matchesFind, filterWords } from "./filterBoard.js";
import { isActiveFilter } from "./FilterPanel.jsx";

// The filter board on a computer (30 Oct 2026, "see everything, very easy to
// get the option"): the most-used filters open in groups, each a list of
// ready ranges; a search to find one; tabs for one group; the rest one click
// away. Under it, every filter that's on, each removable. The drawer's
// sliders still set exact ranges — the board shows those as "Custom".
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

// Folded or open, remembered on this computer; open the first time
const OPEN_KEY = "filterBoardOpen";
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; } };
const writeOpen = v => { try { localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch {} };

export default function FilterBoard({ meta, filters, onChange, onMore, matched, total }) {
  const [open, setOpenState] = useState(readOpen);
  const setOpen = v => { setOpenState(v); writeOpen(v); };
  const [tab, setTab] = useState("all");
  const [find, setFind] = useState("");
  const findId = useId(), ownId = useId();
  const symbols = filters.find(f => f.id === "symbols");
  const [own, setOwn] = useState((symbols?.values ?? []).join(", "));
  const active = filters.filter(isActiveFilter);
  const known = id => meta.byId.get(id) && (meta.byId.get(id).known == null || meta.byId.get(id).known > 0);
  const groups = BOARD_GROUPS
    .filter(g => tab === "all" || g.id === tab)
    .map(g => ({ ...g, items: g.items.filter(i => known(i.id) && (!find.trim() || matchesFind(i, find))) }))
    .filter(g => g.items.length);
  const pick = item => value => onChange(item.category ? setValues(filters, item.id, value) : setChoice(filters, item, value));
  const applyOwn = () => onChange(setValues(filters, "symbols", [...new Set(own.toUpperCase().split(/[\s,;]+/).map(v => v.replace(/[^A-Z0-9&-]/g, "")).filter(Boolean))].slice(0, 60)));
  const remove = id => { onChange(filters.filter(f => f.id !== id)); if (id === "symbols") setOwn(""); };
  const more = meta.metrics.length;
  return (
    <>
      <section className="fb" aria-labelledby="fb-title">
        <div className="fb-head">
          <div className="fb-title">
            <h2 id="fb-title">Filters</h2>
            {active.length > 0 && <span className="fb-on">{active.length} on</span>}
            {matched != null && <span className="fb-count"><b>{matched.toLocaleString("en-IN")}</b>{total ? ` of ${total.toLocaleString("en-IN")}` : ""} companies match</span>}
          </div>
          {!open ? (
            <button type="button" className="fb-ghost fb-toggle" aria-expanded="false" aria-controls="fb-panel" onClick={() => setOpen(true)}>Show filters ▾</button>
          ) : (
          <div className="fb-tools">
            <label htmlFor={findId}>Find a filter</label>
            <input id={findId} type="search" value={find} onChange={e => setFind(e.target.value)} placeholder="ROCE, pledged, RSI…" autoComplete="off" spellCheck={false} />
            <button type="button" className="fb-ghost" onClick={() => { onChange([]); setOwn(""); }} disabled={!active.length}>Clear all</button>
          </div>
          )}
        </div>
        {open && (<div id="fb-panel">
        <div className="fb-tabs" role="group" aria-label="Filter groups">
          {[{ id: "all", label: "All" }, ...BOARD_GROUPS].map(g => (
            <button key={g.id} type="button" aria-pressed={tab === g.id} onClick={() => setTab(g.id)}>{g.label}</button>
          ))}
        </div>
        <div className="fb-body">
          {groups.map(g => (
            <div key={g.id} className={`fb-group fb-${g.id}`}>
              <h3>{g.label}</h3>
              <div className="fb-grid">
                {g.items.map(item => <Pick key={item.id} item={item} def={meta.byId.get(item.id)} filter={filters.find(f => f.id === item.id)} onPick={pick(item)} />)}
              </div>
            </div>
          ))}
          {!groups.length && <p className="fb-none">None of the filters here match "{find}". <button type="button" className="fb-link" onClick={onMore}>Search all {more} filters</button></p>}
          <div className="fb-foot">
            <label htmlFor={ownId}>Only these companies</label>
            <input id={ownId} value={own} onChange={e => setOwn(e.target.value)} onBlur={applyOwn} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyOwn(); } }}
              placeholder="TCS, INFY, RELIANCE" autoComplete="off" spellCheck={false} />
            <button type="button" className="fb-more" onClick={onMore}>+ More filters ({more})</button>
          </div>
        </div>
        <button type="button" className="fb-fold" aria-expanded="true" aria-controls="fb-panel" onClick={() => setOpen(false)}>Hide filters ▴</button>
        </div>)}
      </section>
      {active.length > 0 && (
        <div className="fb-active" role="group" aria-label="Filters that are on">
          <span>On now</span>
          {active.map(f => (
            <button key={f.id} type="button" className="fb-chip" onClick={() => remove(f.id)} aria-label={`Remove ${filterWords(meta.byId.get(f.id), f)}`}>
              {filterWords(meta.byId.get(f.id), f)} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
