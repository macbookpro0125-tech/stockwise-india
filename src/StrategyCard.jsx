import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import StrategyMark from "./StrategyMarks.jsx";
import { useInView, useCountUp, reducedMotion } from "./motion.js";

// One strategy on Discover's first page (PresetCards layout="grid"), set like
// an editorial card rather than a tile: its kind as a small label, the name,
// what it looks for, then how many stocks match today in large figures and
// the best of them by quality score, rolling one after another. The first
// card of the grid is the featured one: wider, with its top five listed.
// It glides in as it comes into view and its count ticks up — or, for anyone
// who asked their system for less motion, simply shows.

const short = name => name.replace(/\s+(Limited|Ltd\.?)$/i, "");

function Rolling({ top, run }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!run || paused || top.length < 2 || reducedMotion()) return;
    const t = setInterval(() => setI(x => (x + 1) % top.length), 2600);
    return () => clearInterval(t);
  }, [run, paused, top.length]);
  const c = top[i];
  return (
    <span className="sc2-roll" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <span className="sc2-roll-label">Best by quality</span>
      <span className="sc2-roll-name" key={c.symbol}>
        <span>{short(c.name)}</span>{c.quality != null && <em>{c.quality}</em>}
      </span>
    </span>
  );
}

export default function StrategyCard({ p, kind, rules, count, top, featured, index, active, onSelect, hue }) {
  const [ref, inView] = useInView();
  const n = useCountUp(count ?? null, inView);
  return (
    <button ref={ref} type="button" onClick={() => onSelect(p)} aria-pressed={active}
      className={`sc2${featured ? " sc2-featured" : ""}${inView ? " in" : ""}`}
      style={{ "--hue": hue, "--i": index % 3 }}>
      <span className="sc2-main">
        <span className="sc2-eyebrow"><StrategyMark preset={p} size={featured ? 26 : 20} /><span>{kind}</span></span>
        <span className="sc2-name">{p.name}</span>
        <span className="sc2-desc">{p.description}</span>
        <span className="sc2-stat">
          {count == null ? <span className="sc-skel" aria-hidden="true" /> : <><b>{n.toLocaleString("en-IN")}</b><span>{count === 1 ? "stock matches" : "stocks match"}</span></>}
        </span>
        {!featured && top?.length > 0 && <Rolling top={top.slice(0, 3)} run={inView} />}
        {rules.length > 0 && (
          <span className="sc2-rules">{rules.slice(0, 3).join("  ·  ")}{rules.length > 3 && <em>  +{rules.length - 3} more</em>}</span>
        )}
        <span className="sc2-go">Open screen <ArrowRight size={15} aria-hidden="true" /></span>
      </span>
      {featured && top?.length > 0 && (
        <span className="sc2-list">
          <span className="sc2-list-head">Best by quality score</span>
          {top.slice(0, 5).map((c, i) => (
            <span key={c.symbol} className="sc2-row" style={{ "--d": i }}>
              <span className="sc2-row-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="sc2-row-name">{short(c.name)}</span>
              <span className="sc2-row-bar"><i style={{ width: inView ? `${c.quality ?? 0}%` : 0 }} /></span>
              <span className="sc2-row-q">{c.quality ?? "—"}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
