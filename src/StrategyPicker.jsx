import { useEffect, useRef, useState } from "react";
import { Check, Globe, Info, List } from "lucide-react";
import WheelPicker from "./WheelPicker.jsx";
import StrategyMark from "./StrategyMarks.jsx";
import { groupStrategies, describeRules } from "./strategyAbout.js";

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
const ALL = "__all", YOURS = "__yours";

export default function StrategyPicker({ presets, items, value, onPick, meta, filters, onEditRules }) {
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

  return (
    <div ref={wrap} className="screen-wheel-wrap">
      <WheelPicker label="Strategy" items={items} value={value} onChange={onPick} rowHeight={42} className="wheel-title"
        onDoubleClick={() => setPanel("list")} />
      <div className="sp-buttons">
        <button ref={listBtn} type="button" className="sp-btn" aria-label="Every strategy" title="Every strategy (or double-click the name)"
          aria-expanded={panel === "list"} aria-haspopup="dialog" onClick={() => toggle("list")}>
          <List size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button ref={aboutBtn} type="button" className="sp-btn" aria-label="About this strategy" title="What this strategy looks for"
          aria-expanded={panel === "about"} aria-haspopup="dialog" onClick={() => toggle("about")}>
          <Info size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {panel === "list" && <StrategyList presets={presets} value={value} onPick={pick} hasYours={items.some(i => i.id === YOURS)} />}
      {panel === "about" && (
        <StrategyAbout preset={current} value={value} meta={meta} filters={filters}
          onEditRules={() => { setPanel(null); onEditRules?.(); }} />
      )}
    </div>
  );
}

function StrategyList({ presets, value, onPick, hasYours }) {
  const ref = useRef(null);
  // Open on the current one
  useEffect(() => { (ref.current?.querySelector('[aria-current="true"]') ?? ref.current?.querySelector("button"))?.focus(); }, []);
  const row = (id, name, description, icon) => (
    <button key={id} type="button" className="sp-row" aria-current={id === value ? "true" : undefined} onClick={() => onPick(id)}>
      {icon}
      <span className="sp-row-text"><b>{name}</b>{description && <em>{description}</em>}</span>
      {id === value && <Check className="sp-check" size={17} strokeWidth={2.4} aria-hidden="true" />}
    </button>
  );
  return (
    <div ref={ref} className="sp-pop sp-list" role="dialog" aria-label="Every strategy">
      {hasYours && row(YOURS, "Your filters", "The filters you've set yourself", <span className="sp-icon"><List size={16} aria-hidden="true" /></span>)}
      {row(ALL, "Whole market", "Every NSE company screened here, no rules", <span className="sp-icon"><Globe size={16} aria-hidden="true" /></span>)}
      {groupStrategies(presets).map(g => (
        <section key={g.id} aria-label={g.label}>
          <h4 className="sp-kind">{g.label}</h4>
          {g.items.map(p => row(p.id, p.name, p.description, <StrategyMark preset={p} size={30} />))}
        </section>
      ))}
    </div>
  );
}

function StrategyAbout({ preset, value, meta, filters, onEditRules }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const name = preset?.name ?? (value === YOURS ? "Your filters" : "Whole market");
  const description = preset?.description ?? (value === YOURS ? "The filters you've set yourself." : "Every NSE company screened here — no rules yet. Pick a strategy, or add filters of your own.");
  const rules = describeRules(preset ? preset.filters : value === YOURS ? filters : [], meta);
  return (
    <div className="sp-pop sp-about" role="dialog" aria-labelledby="sp-about-title">
      <div className="sp-about-head">
        {preset ? <StrategyMark preset={preset} size={36} /> : <span className="sp-icon sp-icon-lg"><Globe size={18} aria-hidden="true" /></span>}
        <h3 id="sp-about-title" ref={ref} tabIndex={-1}>{name}</h3>
      </div>
      <p className="sp-about-desc">{description}</p>
      {rules.length > 0 && (
        <>
          <h4 className="sp-kind">What it looks for</h4>
          <ul className="sp-rules">
            {rules.map(r => (
              <li key={`${r.id}-${r.text}`}>
                <b>{r.text}</b>
                {r.about && <span>{r.about}</span>}
              </li>
            ))}
          </ul>
          <p className="sp-note">A company missing a figure a rule needs is left out. A screen to research from, not advice.</p>
        </>
      )}
      <button type="button" className="btn-ghost sp-edit" onClick={onEditRules}>{rules.length ? "Change the rules" : "Add a filter"}</button>
    </div>
  );
}
