import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Undo2, Redo2, Settings2, Pencil, Search } from "lucide-react";
import { BOARD_GROUPS, choiceOf, setChoice, setValues, matchesFind, filterWords, boardItem, rangeWords } from "./filterBoard.js";
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
        {value === "custom" && <option value="custom" title={filterWords(def, filter)}>{rangeWords(def, filter)}</option>}
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
  // Most used, as you've arranged it (31 Oct 2026): each group's filters,
  // with ones you've added and without ones you've taken off — remembered
  // on this device; Reset brings back the app's own
  const [layout, setLayoutState] = useState(() => read("boardLayout", null));
  const setLayout = v => { setLayoutState(v); write("boardLayout", v); };
  const [editing, setEditing] = useState(false);
  // three columns on a wide window, two on a narrower one
  const [colCount, setColCount] = useState(() => (typeof window !== "undefined" && window.innerWidth < 1100 ? 2 : 3));
  useEffect(() => {
    const fit = () => setColCount(window.innerWidth < 1100 ? 2 : 3);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  // A mouse wheel over the tabs turns them sideways while some are out of
  // view, and the page stays put; at either end the page scrolls as usual
  const tabsRef = useRef(null);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const turn = e => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener("wheel", turn, { passive: false });
    return () => el.removeEventListener("wheel", turn);
  });
  const itemFor = id => BOARD_GROUPS.flatMap(g => g.items).find(i => i.id === id) ?? (meta.byId.get(id) ? boardItem(meta.byId.get(id)) : null);
  const groupsNow = BOARD_GROUPS.map(g => ({ ...g, items: (layout?.[g.id] ?? g.items.map(i => i.id)).map(itemFor).filter(i => i && known(meta.byId.get(i.id))) }));
  const common = groupsNow.flatMap(g => g.items);
  const layoutNow = () => Object.fromEntries(groupsNow.map(g => [g.id, g.items.map(i => i.id)]));
  const takeOff = id => { const l = layoutNow(); for (const k of Object.keys(l)) l[k] = l[k].filter(x => x !== id); setLayout(l); };
  const GROUP_OF_KIND = { Valuation: "value", Profitability: "quality", "Financial health": "quality", "Research score": "quality", Banks: "quality", "Cash flow": "quality", "Income statement": "quality", "Balance sheet": "quality", Growth: "growth", "Quarterly results": "growth", Ownership: "owners", "Price & returns": "price", "Volume & technicals": "price", Size: "company" };
  // editing: true (Customise, each filter to the card for its kind) or a
  // card's id (✎ on that card: what's ticked goes into it)
  const toggleOn = id => {
    if (common.some(i => i.id === id)) return takeOff(id);
    putOn(typeof editing === "string" ? editing : GROUP_OF_KIND[meta.byId.get(id)?.category] ?? "company", id);
  };
  const putOn = (groupId, id) => { const l = layoutNow(); if (Object.values(l).some(list => list.includes(id))) return; l[groupId] = [...l[groupId], id]; setLayout(l); };
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
  // The cards to show: the most used in their six groups; All by kind; one
  // kind, or what a search found, as one card
  // Every rule in force shows in the cards (31 Oct 2026, "whenever I choose
  // a screener it should show all the rules"): one that isn't on Most used
  // joins the card for its kind while it's on, marked as the screener's;
  // your own layout isn't changed
  const ruleExtras = active
    .filter(f => f.id !== "symbols" && !common.some(i => i.id === f.id) && meta.byId.get(f.id))
    .map(f => ({ item: { ...(itemFor(f.id) ?? { id: f.id, label: meta.byId.get(f.id).label, choices: [] }), extra: true }, group: GROUP_OF_KIND[meta.byId.get(f.id).category] ?? "company" }));
  const cards = finding || (shownTab !== COMMON && shownTab !== ALL)
    ? [{ id: "one", label: finding ? "" : (TAB_NAMES[shownTab] ?? (shownTab === ON ? "On now" : shownTab)), items }]
    : shownTab === COMMON
      ? groupsNow.map(g => ({ id: g.id, label: g.label, items: [...g.items, ...ruleExtras.filter(x => x.group === g.id).map(x => x.item)] })).filter(c => c.items.length)
      : kinds.map(k => ({ id: k, label: TAB_NAMES[k] ?? k, items: ofKind(k) })).filter(c => c.items.length);
  const pick = item => value => onChange(item.category ? setValues(filters, item.id, value) : setChoice(filters, item, value));
  const applyOwn = () => onChange(setValues(filters, "symbols", [...new Set(own.toUpperCase().split(/[\s,;]+/).map(v => v.replace(/[^A-Z0-9&-]/g, "")).filter(Boolean))].slice(0, 60)));
  const count = list => list.filter(i => isOn(i.id)).length;
  // The tabs that fit in the row, the rest under More (31 Oct 2026): widths
  // measured from a hidden copy of the row, again whenever its room changes;
  // the tab picked always shows
  const allTabs = [
    [COMMON, "Most used", common],
    [ALL, "All", everything],
    ...kinds.map(k => [k, TAB_NAMES[k] ?? k, ofKind(k)]),
  ];
  const [fit, setFit] = useState(allTabs.length);
  const ruler = useRef(null);
  useLayoutEffect(() => {
    const row = tabsRef.current, r = ruler.current;
    if (!row || !r) return;
    const measure = () => {
      const widths = [...r.children].map(c => c.getBoundingClientRect().width + 2);
      const room = row.getBoundingClientRect().width - 8;
      if (widths.reduce((x, y) => x + y, 0) <= room) { setFit(widths.length); return; }
      let used = 0, n = 0;
      while (n < widths.length && used + widths[n] <= room) used += widths[n++];
      setFit(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [allTabs.length, open]);
  const at = allTabs.findIndex(([id]) => id === shownTab);
  let tabs = allTabs.slice(0, fit);
  if (fit < allTabs.length && at >= fit && !finding) tabs = [...allTabs.slice(0, fit - 1), allTabs[at]];
  const rest = allTabs.filter(t => !tabs.includes(t));
  const restOn = rest.filter(([id]) => id !== ALL).reduce((n, [, , list]) => n + count(list), 0) || (rest.some(([id]) => id === ALL) ? count(everything) : 0);

  return (
    <section className={`fb${open ? "" : " fb-folded"}`} aria-labelledby="fb-title">
      <div className="fb-bar">
        <h2 id="fb-title" className="sr-only">Filters</h2>
        {!open ? (
          // folded: what's on, in a line, each removable
          <div className="fb-summary" role="group" aria-label="Filters that are on">
            {active.length ? active.map(f => (
              <button key={f.id} type="button" className="fb-chip" onClick={() => onChange(filters.filter(x => x.id !== f.id))} aria-label={`Remove ${filterWords(meta.byId.get(f.id), f)}`}>
                {filterWords(meta.byId.get(f.id), f)} <span aria-hidden="true">✕</span>
              </button>
            )) : <span className="fb-none">No filters on: every company is shown.</span>}
          </div>
        ) : (
        <div className="fb-tabs" role="tablist" aria-label="Filters by kind" ref={tabsRef}>
          <div className="fb-tabs-ruler" ref={ruler} aria-hidden="true">
            {allTabs.map(([id, label, list]) => <button key={id} type="button" tabIndex={-1}>{label} <span>{count(list) ? `${count(list)} on` : list.length}</span></button>)}
          </div>
          {tabs.map(([id, label, list]) => {
            const n = count(list);
            return (
              <button key={id} type="button" role="tab" aria-selected={open && !finding && shownTab === id} onClick={() => { setFind(""); setTab(id); if (!open) setOpen(true); }}>
                {label} <span className={n ? "on" : undefined}>{n ? `${n} on` : list.length}</span>
              </button>
            );
          })}

        </div>
        )}
        {open && (<>
            {rest.length > 0 && (
            <select className={`fb-more${rest.some(([id]) => id === shownTab) && !finding ? " on" : ""}`} aria-label="More kinds of filter"
              value={rest.some(([id]) => id === shownTab) && !finding ? shownTab : ""} onChange={e => { if (e.target.value) { setFind(""); setTab(e.target.value); } }}>
              <option value="">More{restOn ? ` · ${restOn} on` : ""} ▾</option>
              {rest.map(([id, label, list]) => <option key={id} value={id}>{label} · {count(list) ? `${count(list)} on` : list.length}</option>)}
            </select>
          )}
        </>)}
        <div className="fb-tools">
          {open && (
            <button type="button" className="fb-custom" aria-haspopup="dialog" title="Choose which filters show on Most used"
              onClick={() => { setFind(""); setTab(COMMON); setEditing(true); }}>
              <Settings2 size={14} aria-hidden="true" /> <span className="fb-custom-words">Customise filters</span>
            </button>
          )}
          <button type="button" className="fb-icon" onClick={onUndo ?? undefined} disabled={!onUndo} aria-label="Undo the last filter change" title="Undo"><Undo2 size={15} aria-hidden="true" /></button>
          <button type="button" className="fb-icon" onClick={onRedo ?? undefined} disabled={!onRedo} aria-label="Redo" title="Redo"><Redo2 size={15} aria-hidden="true" /></button>
          <label htmlFor={findId} className="sr-only">Find a filter</label>
          <label className="fb-search"><Search size={14} aria-hidden="true" /><input id={findId} className="fb-find" type="search" value={find} onChange={e => { setFind(e.target.value); if (!open) setOpen(true); }}
            placeholder={`Find any of ${everything.length} filters`} autoComplete="off" spellCheck={false} /></label>
          <button type="button" className="fb-fold" aria-expanded={open} aria-controls="fb-panel" onClick={() => setOpen(!open)}>{open ? "Hide filters ▴" : "Show filters ▾"}</button>
        </div>
      </div>
      {open && (
        <div id="fb-panel" className="fb-body">
          {items.length ? (
            // Group cards (31 Oct 2026): each kind with its heading and how
            // many are on; inside, the name left and its value as a chip right
            // Balanced columns (31 Oct 2026, "space wasted… look even"): the
            // cards shared out so each column holds about as many filters,
            // stacked with no gaps; the last in each stretches so the
            // columns end level
            <div className={`fb-cards${cards.length === 1 ? " fb-cards-one" : " fb-cols"}`} style={cards.length === 1 ? undefined : { gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
              {(cards.length === 1 ? [cards] : balance(cards, colCount)).map((col, ci) => (
                <div key={ci} className="fb-col">
                  {col.map(card => {
                const n = count(card.items);
                return (
                  <section key={card.id} className="fb-card" aria-label={card.label}>
                    {card.label && (
                      <h3>
                        {card.label}
                        <em className="fb-card-tail">
                          {n > 0 && <span>{n} on</span>}
                          {shownTab === COMMON && !finding && (
                            <button type="button" className="fb-card-edit" aria-label={`Edit the ${card.label} card`} title={`Choose what ${card.label} shows`}
                              onClick={() => setEditing(card.id)}><Pencil size={12} aria-hidden="true" /></button>
                          )}
                        </em>
                      </h3>
                    )}
                    <div className="fb-rows">
                      {card.items.map(item => <div key={item.id} className={item.extra ? "fb-rule-extra" : undefined} title={item.extra ? "On for this screen (not one of your Most used); shows here while it's on" : undefined}><Pick item={item} def={meta.byId.get(item.id)} filter={filters.find(f => f.id === item.id)} onPick={pick(item)} /></div>)}
                    </div>
                  </section>
                );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="fb-none">{finding ? <>No filter matches "{find}".</> : "None of these are on yet."}</p>
          )}
          {/* Filters that are on but not on this tab (a screener's rules
              beyond Most used): named here, each removable, so every rule
              in force is in view (31 Oct 2026) */}
          {(() => {
            const shownIds = new Set(cards.flatMap(c => c.items.map(i => i.id)));
            const also = active.filter(f => !shownIds.has(f.id) && f.id !== "symbols");
            return also.length > 0 && (
              <div className="fb-also" role="group" aria-label="Also on">
                <span>Also on</span>
                {also.map(f => (
                  <button key={f.id} type="button" className="fb-chip" onClick={() => onChange(filters.filter(x => x.id !== f.id))} aria-label={`Remove ${filterWords(meta.byId.get(f.id), f)}`}>
                    {filterWords(meta.byId.get(f.id), f)} <span aria-hidden="true">✕</span>
                  </button>
                ))}
              </div>
            );
          })()}
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
      {editing && <ChooseFilters meta={meta} names={TAB_NAMES} onBoard={id => common.some(i => i.id === id)}
        card={typeof editing === "string" ? groupsNow.find(g => g.id === editing) : null}
        kinds={typeof editing === "string" ? [...kinds].sort((a, b) => (GROUP_OF_KIND[b] === editing) - (GROUP_OF_KIND[a] === editing)) : kinds} ofKind={ofKind}
        count={typeof editing === "string" ? (groupsNow.find(g => g.id === editing)?.items.length ?? 0) : common.length}
        onToggle={toggleOn} onReset={layout ? () => setLayout(null) : null} onClose={() => setEditing(false)} />}
    </section>
  );
}

// Customise (31 Oct 2026, "confusing"): one list of every filter by kind,
// each with a tick — ticked ones show on Most used, in the card for their kind
function ChooseFilters({ meta, kinds, ofKind, names, onBoard, count, onToggle, onReset, onClose, card = null }) {
  const [q, setQ] = useState("");
  const box = useRef(null);
  useEffect(() => {
    box.current?.querySelector("input")?.focus();
    const key = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const text = q.trim().toLowerCase();
  return (
    <div className="cf-scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cf" role="dialog" aria-modal="true" aria-labelledby="cf-title" ref={box}>
        <div className="cf-head">
          <div>
            <h3 id="cf-title">{card ? `Edit ${card.label}` : "Choose your filters"}</h3>
            <p>{card ? <>Tick to add to {card.label}, untick to take off the board · <b>{count}</b> in this card</> : <>Ticked ones show on Most used · <b>{count}</b> on your board</>}</p>
          </div>
          <button type="button" className="btn-primary cf-done" onClick={onClose}>Done</button>
        </div>
        <label className="cf-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" className="cf-find" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a filter: ROE, pledged, RSI…" aria-label="Find a filter" />
        </label>
        <div className="cf-list">
          {kinds.map(k => {
            const list = ofKind(k).filter(i => !text || `${i.label} ${meta.byId.get(i.id)?.short ?? ""}`.toLowerCase().includes(text));
            if (!list.length) return null;
            return (
              <section key={k}>
                <h4>{names[k] ?? k}</h4>
                {list.map(i => (
                  <label key={i.id} className="cf-row">
                    <input type="checkbox" checked={onBoard(i.id)} onChange={() => onToggle(i.id)} />
                    <span>{i.label}</span>
                  </label>
                ))}
              </section>
            );
          })}
        </div>
        <div className="cf-foot">
          {onReset ? <button type="button" className="fb-link" onClick={onReset}>Reset to the app's own</button> : <span>This is the app's own set.</span>}
        </div>
      </div>
    </div>
  );
}

// Cards into n columns of about equal height (a card's height: its rows and
// its heading), in their order — each to the shortest column so far
function balance(cards, n) {
  const cols = Array.from({ length: n }, () => ({ h: 0, cards: [] }));
  for (const c of cards) {
    const col = cols.reduce((low, x) => (x.h < low.h ? x : low), cols[0]);
    col.cards.push(c);
    col.h += c.items.length + 1.6;
  }
  return cols.map(c => c.cards).filter(c => c.length);
}
