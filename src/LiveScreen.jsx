import { useState, useEffect } from "react";
import { api } from "./api.js";
import { presetRules } from "./PresetCards.jsx";
import { reducedMotion } from "./motion.js";

// The banner's picture on Discover's first page: one real strategy narrowing
// the market a filter at a time, with the count after each step worked out by
// the server on today's data. It plays through, rests, and plays again.

const STEPS = 4; // the first three filters, then all of them

export default function LiveScreen({ meta, total }) {
  const [screen, setScreen] = useState(null); // { name, steps: [{ label, count }] }
  const [shown, setShown] = useState(0);      // how many steps are lit
  const [round, setRound] = useState(0);

  // The steps' counts: each request adds the next filter
  useEffect(() => {
    if (!meta) return;
    let stop = false;
    (async () => {
      try {
        const presets = await api.presets();
        const p = presets.find(x => x.id === "high_quality_compounders") ?? presets.find(x => x.filters?.length >= 3);
        if (!p) return;
        const f = p.filters;
        const cuts = [1, 2, 3, f.length].slice(0, STEPS);
        const steps = [];
        for (const n of cuts) {
          const res = await api.screen({ filters: f.slice(0, n), countOnly: true });
          const added = f.slice(steps.length ? cuts[steps.length - 1] : 0, n);
          const label = added.length === 1 ? presetRules({ filters: added }, meta)[0] : `${added.length} more filters`;
          steps.push({ label, count: res.matched });
        }
        if (!stop) setScreen({ name: p.name, steps });
      } catch { /* the banner just goes without its picture */ }
    })();
    return () => { stop = true; };
  }, [meta]);

  // Light one step after another; rest; start again
  useEffect(() => {
    if (!screen) return;
    if (reducedMotion()) { setShown(screen.steps.length); return; }
    setShown(0);
    const timers = screen.steps.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * 900));
    timers.push(setTimeout(() => setRound(r => r + 1), 500 + screen.steps.length * 900 + 4200));
    return () => timers.forEach(clearTimeout);
  }, [screen, round]);

  if (!screen || !total) return <div className="ls ls-empty" aria-hidden="true" />;
  const last = screen.steps[screen.steps.length - 1];
  return (
    <figure className="ls" aria-label={`${screen.name}: ${total.toLocaleString("en-IN")} companies narrowed to ${last.count} by its filters`}>
      <figcaption className="ls-head"><span className="ls-live" aria-hidden="true" />Live screen · {screen.name}</figcaption>
      <ol className="ls-steps" aria-hidden="true">
        <li className="ls-step on">
          <span className="ls-label">All NSE companies screened</span>
          <span className="ls-count">{total.toLocaleString("en-IN")}</span>
          <span className="ls-bar"><i style={{ width: "100%" }} /></span>
        </li>
        {screen.steps.map((s, i) => {
          const on = i < shown;
          return (
            <li key={`${round}-${i}`} className={`ls-step${on ? " on" : ""}`}>
              <span className="ls-label"><b>+</b> {s.label}</span>
              <span className="ls-count">{on ? s.count.toLocaleString("en-IN") : "…"}</span>
              <span className="ls-bar"><i style={{ width: on ? `${Math.max(1.5, (s.count / total) * 100)}%` : "100%" }} /></span>
            </li>
          );
        })}
      </ol>
      <div className={`ls-result${shown >= screen.steps.length ? " on" : ""}`}>
        <strong>{last.count}</strong> companies to study, from {total.toLocaleString("en-IN")}
      </div>
    </figure>
  );
}
