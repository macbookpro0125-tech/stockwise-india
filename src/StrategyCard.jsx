import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import StrategyMark from "./StrategyMarks.jsx";
import { useInView, useCountUp, reducedMotion } from "./motion.js";
import { bestBy } from "./strategyAbout.js";

// One strategy on Discover's first page (PresetCards layout="grid"). Kept to
// what earns its place (15 Oct 2026, "too packed — give it breathing space"):
// its mark, its name, one line on what it looks for, its best match rolling
// through, and how many stocks match today with the way in. The tabs above
// already say each one's kind, and its rules are the filters on its own page. The first card is the
// featured one: a full row of its own, with its five best by quality score.
// Cards glide in as they come into view and the count ticks up — or, for
// anyone who asked their system for less motion, simply show.

const short = name => name.replace(/\s+(Limited|Ltd\.?)$/i, "");

// Its best matches by quality score, one after another (asked back on 16 Oct
// 2026: "that animation, between the details and the number of stocks").
// Pauses under the pointer; still for anyone who asked for less motion.
function Rolling({ top, run, by }) {
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
      <span className="sc2-roll-label">{by.label}</span>
      <span className="sc2-roll-name" key={c.symbol}>
        <span>{short(c.name)}</span>{by.figure(c) != null && <em>{by.figure(c)}</em>}
      </span>
    </span>
  );
}

export default function StrategyCard({ p, kind, count, top, newMatches = 0, featured, index, active, onSelect, hue, failed }) {
  const [ref, inView] = useInView();
  const by = bestBy(p);
  // a gain's bar is against the biggest; a score's against 100
  const bar = c => (c.value != null ? (top[0].value > 0 ? (100 * c.value) / top[0].value : 0) : c.quality ?? 0);
  const n = useCountUp(count ?? null, inView);
  const matches = count == null
    ? (failed ? null : <span className="sc-skel" aria-hidden="true" />)
    : <><b>{n.toLocaleString("en-IN")}</b> {count === 1 ? "stock matches" : "stocks match"}</>;

  return (
    <button ref={ref} type="button" onClick={() => onSelect(p)} aria-pressed={active}
      className={`sc2 glow${featured ? " sc2-featured" : ""}${inView ? " in" : ""}`}
      style={{ "--hue": hue, "--i": index % 3 }}>
      <span className="sc2-main">
        {featured && <span className="sc2-eyebrow">Featured · {kind}</span>}
        <StrategyMark preset={p} size={featured ? 44 : 36} />
        <span className="sc2-name">{p.name}</span>
        <span className="sc2-desc">{p.description}</span>
        {!featured && top?.length > 0 && <Rolling top={top.slice(0, 3)} run={inView} by={by} />}
        <span className="sc2-foot">
          <span className="sc2-count">{matches}{newMatches > 0 && <em className="strategy-new-count" title="New stocks since your last check">{newMatches} new</em>}</span>
          <span className="sc2-go">{featured ? "Open screen" : "Open"}<ChevronRight size={17} aria-hidden="true" /></span>
        </span>
      </span>
      {featured && top?.length > 0 && (
        <span className="sc2-list">
          <span className="sc2-list-head">{by.head}</span>
          {top.slice(0, 5).map((c, i) => (
            <span key={c.symbol} className="sc2-row" style={{ "--d": i }}>
              <span className="sc2-row-rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="sc2-row-name">{short(c.name)}</span>
              <span className="sc2-row-bar"><i style={{ width: inView ? `${bar(c)}%` : 0 }} /></span>
              <span className="sc2-row-q">{by.figure(c) ?? "—"}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
