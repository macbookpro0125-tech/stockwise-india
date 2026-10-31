import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, Globe, Info, List } from "lucide-react";
import WheelPicker from "./WheelPicker.jsx";
import StrategyMark from "./StrategyMarks.jsx";
import { groupStrategies, describeRules } from "./strategyAbout.js";
import { recentScreenIds } from "./screensHome.js";

// The screen's name on Discover's stock list (a computer): the strategy
// wheel, and on its pill two buttons — every strategy as a list (also a
// double-click on the wheel), and what the current one is: what it looks
// for, rule by rule, and what each measure means (asked for 20 Oct 2026).
//
//   presets   the strategies, ready-made then yours ({ id, name, description, filters, custom })
//   items     the wheel's rows ({ id, label }), with "Whole market" / "Your filters"
//   value     the current row's id; onPick(id) opens another
//   meta      the metric catalogue (labels and notes); filters: the current ones
//   onEditRules  opens the filters, to change this screen's rules
//   phone     a phone: the wheel and ⓘ only; ⓘ opens a page of its own with
//             everything about the strategy — what it is, each rule, how many
//             companies pass, the prices' date — so the list stays clean
//   stats     { matched, universe, pricesDate, notes } for that page
const ALL = "__all", YOURS = "__yours";

export default function StrategyPicker({ presets, items, value, onPick, meta, filters, onEditRules, phone = false, stats = null }) {
  const [panel, setPanel] = useState(null); // "list" | "about" | null
  const wrap = useRef(null);
  const listBtn = useRef(null), aboutBtn = useRef(null);
  const close = (returnFocus = true) => {
    const from = panel;
    setPanel(null);
    if (returnFocus) (from === "about" ? aboutBtn : listBtn).current?.focus();
  };
  // Escape, or a click anywhere else, puts it away
  useEffect(() => {
    if (!panel) return;
    const key = e => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    const down = e => { if (!wrap.current?.contains(e.target)) close(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", down); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);
  // A strategy chosen any other way closes it too
  useEffect(() => { setPanel(null); }, [value]);

  const pick = id => { setPanel(null); if (id !== value) onPick(id); listBtn.current?.focus(); };
  const toggle = which => setPanel(p => (p === which ? null : which));
  const current = presets.find(p => p.id === value);

  if (phone) return (
    <div ref={wrap} className="screen-wheel-wrap screen-wheel-phone">
      <WheelPicker label="Strategy" items={items} value={value} onChange={onPick} rowHeight={36} className="wheel-title" />
      <div className="sp-buttons">
        <button ref={aboutBtn} type="button" className="sp-btn" aria-label="About this strategy" aria-haspopup="dialog"
          aria-expanded={panel === "about"} onClick={() => setPanel("about")}>
          <Info size={19} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      {panel === "about" && (
        <StrategyInfoPage preset={current} value={value} meta={meta} filters={filters} stats={stats}
          onClose={() => { setPanel(null); aboutBtn.current?.focus(); }}
          onEditRules={() => { setPanel(null); onEditRules?.(); }} />
      )}
    </div>
  );

  // A computer (31 Oct 2026, "why it looks so messy"): the name alone, with
  // ▾ for every strategy — the wheel's faded rows above and below are gone
  // What the screen is, in words (31 Oct 2026, "Your filters ▾ ⓘ doesn't
  // make sense"): its name, a line saying what it is, and a labelled button
  // to switch — the rules are on the board, so no ⓘ here
  const own = (filters ?? []).filter(f => (f.values?.length ?? 0) > 0 || f.min != null || f.max != null).length;
  const name = current?.name ?? (value === ALL || !own ? "Whole market" : "Untitled screen");
  const line = current?.description
    ?? (value === ALL || !own ? "Every NSE company, no filters" : `${own} filter${own === 1 ? "" : "s"} you've set · not saved yet`);
  return (
    <div ref={wrap} className="screen-wheel-wrap sp-plain">
      <div className="sp-name-row">
        <h2 className="sp-name-big">{name}</h2>
        <button ref={listBtn} type="button" className="sp-switch" aria-expanded={panel === "list"} aria-haspopup="dialog" onClick={() => toggle("list")}>
          Switch screener <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
      <p className="sp-line">{line}</p>

      {panel === "list" && <StrategyList presets={presets} value={value} onPick={pick} hasYours={items.some(i => i.id === YOURS)} />}
    </div>
  );
}

// Every strategy on one panel (31 Oct 2026): a search, the recent ones, and
// all of them in columns by kind — one click to any of them
function StrategyList({ presets, value, onPick, hasYours }) {
  const ref = useRef(null), findRef = useRef(null);
  const [find, setFind] = useState("");
  useEffect(() => { findRef.current?.focus(); }, []);
  const q = find.trim().toLowerCase();
  const hit = p => !q || `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q);
  const byId = new Map(presets.map(p => [p.id, p]));
  // the strategies opened lately on this device (screensHome.js), the open one first
  const recent = recentScreenIds().map(id => byId.get(id)).filter(Boolean).slice(0, 5);
  const groups = groupStrategies(presets).map(g => ({ ...g, items: g.items.filter(hit) })).filter(g => g.items.length);
  const name = (id, label, title) => (
    <button key={id} type="button" className="sp-name" title={title} aria-current={id === value ? "true" : undefined} onClick={() => onPick(id)}>
      {label}{id === value && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
    </button>
  );
  const chip = p => (
    <button key={p.id} type="button" className="ph-chip" aria-pressed={p.id === value} onClick={() => onPick(p.id)}>{p.name}</button>
  );
  // Enter opens the first one found
  const first = groups[0]?.items[0];
  return (
    <div ref={ref} className="sp-pop sp-list sp-board" role="dialog" aria-label="Every strategy">
      <input ref={findRef} type="search" className="sp-find" value={find} onChange={e => setFind(e.target.value)} aria-label="Find a strategy"
        placeholder="Find a strategy: volume, dividend, banks…" autoComplete="off" spellCheck={false}
        onKeyDown={e => { if (e.key === "Enter" && first) { e.preventDefault(); onPick(first.id); } }} />
      {!q && (
        <div className="sp-quick">
          <span className="sp-quick-label">Start from</span>
          <div className="sp-chips">
            <button type="button" className="ph-chip" aria-pressed={value === ALL} onClick={() => onPick(ALL)}>Whole market</button>
            {hasYours && <button type="button" className="ph-chip" aria-pressed={value === YOURS} onClick={() => onPick(YOURS)}>Your filters</button>}
          </div>
        </div>
      )}
      {!q && recent.length > 0 && (
        <div className="sp-quick">
          <span className="sp-quick-label">Recent</span>
          <div className="sp-chips">{recent.map(chip)}</div>
        </div>
      )}
      <div className="sp-cols">
        {groups.map(g => (
          <section key={g.id} aria-label={g.label}>
            <h4 className="sp-kind">{g.label}</h4>
            {g.items.map(p => name(p.id, p.name, p.description))}
          </section>
        ))}
      </div>
      {q && !groups.length && <p className="sp-none">No strategy matches "{find}".</p>}
      {q && first && <p className="sp-hint">{first.description} <span>· Enter opens {first.name}</span></p>}
    </div>
  );
}

// A phone: everything about the strategy on a page of its own, sliding in
// from the right like a pushed screen, with its own history entry — Back
// (the button, the browser's, Android's) closes it
const dateOf = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function StrategyInfoPage({ preset, value, meta, filters, stats, onClose, onEditRules }) {
  const heading = useRef(null);
  useEffect(() => {
    window.history.pushState({ ...(window.history.state ?? {}), strategyInfo: true }, "");
    const onPop = () => { if (!window.history.state?.strategyInfo) onClose(); };
    window.addEventListener("popstate", onPop);
    heading.current?.focus();
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("popstate", onPop); document.body.style.overflow = ""; window.scrollTo(0, scrollY); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const back = () => { if (window.history.state?.strategyInfo) window.history.back(); else onClose(); };
  const name = preset?.name ?? (value === YOURS ? "Your filters" : "Whole market");
  const description = preset?.description ?? (value === YOURS ? "The filters you've set yourself." : "Every NSE company screened here — no rules yet. Pick a strategy, or add filters of your own.");
  const rules = describeRules(preset ? preset.filters : value === YOURS ? filters : [], meta);
  return createPortal(
    <div className="sip" role="dialog" aria-modal="true" aria-labelledby="sip-title">
      <div className="sip-bar">
        <button type="button" className="sip-back" onClick={back}><ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" /> Back</button>
      </div>
      <div className="sip-body">
        <div className="sip-mark">{preset ? <StrategyMark preset={preset} size={52} /> : <span className="sp-icon sip-icon"><Globe size={24} aria-hidden="true" /></span>}</div>
        <h1 id="sip-title" ref={heading} tabIndex={-1}>{name}</h1>
        {stats?.matched != null && (
          <p className="sip-meta">
            <strong>{stats.matched.toLocaleString("en-IN")}</strong>
            {" "}{stats.matched === 1 ? "company passes" : "companies pass"} today
            {stats.pricesDate && <> · prices as of {dateOf(stats.pricesDate)}</>}
          </p>
        )}
        <p className="sip-lead">{description}</p>
        {rules.length > 0 && (
          <section>
            <h2>What it looks for</h2>
            {rules.map(r => (
              <div key={`${r.id}-${r.text}`} className="sip-rule">
                <h3>{r.text}</h3>
                {r.about && <p>{r.about}</p>}
              </div>
            ))}
          </section>
        )}
        <section>
          <h2>Good to know</h2>
          <p>{rules.length > 0 ? "A company missing a figure that a rule needs is left out, so the count can be lower than you'd expect. " : ""}Figures come from companies' filings with NSE and its daily closing prices. A screen to research from — not advice to buy or sell.</p>
        </section>
        <button type="button" className="btn-primary sip-edit" onClick={onEditRules}>{rules.length ? "Change the rules" : "Add a filter"}</button>
      </div>
    </div>,
    document.body,
  );
}
