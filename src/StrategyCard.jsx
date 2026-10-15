import { ChevronRight } from "lucide-react";
import StrategyMark from "./StrategyMarks.jsx";
import { useInView, useCountUp } from "./motion.js";

// One strategy on Discover's first page (PresetCards layout="grid"). Kept to
// what earns its place (15 Oct 2026, "too packed — give it breathing space"):
// its mark, its name, one line on what it looks for, and how many stocks
// match today with the way in. The tabs above already say each one's kind,
// and its rules are the filters on its own page. The first card is the
// featured one: a full row of its own, with its five best by quality score.
// Cards glide in as they come into view and the count ticks up — or, for
// anyone who asked their system for less motion, simply show.

const short = name => name.replace(/\s+(Limited|Ltd\.?)$/i, "");

export default function StrategyCard({ p, kind, count, top, featured, index, active, onSelect, hue }) {
  const [ref, inView] = useInView();
  const n = useCountUp(count ?? null, inView);
  const matches = count == null
    ? <span className="sc-skel" aria-hidden="true" />
    : <><b>{n.toLocaleString("en-IN")}</b> {count === 1 ? "stock matches" : "stocks match"}</>;

  return (
    <button ref={ref} type="button" onClick={() => onSelect(p)} aria-pressed={active}
      className={`sc2${featured ? " sc2-featured" : ""}${inView ? " in" : ""}`}
      style={{ "--hue": hue, "--i": index % 3 }}>
      <span className="sc2-main">
        {featured && <span className="sc2-eyebrow">Featured · {kind}</span>}
        <StrategyMark preset={p} size={featured ? 44 : 36} />
        <span className="sc2-name">{p.name}</span>
        <span className="sc2-desc">{p.description}</span>
        <span className="sc2-foot">
          <span className="sc2-count">{matches}</span>
          <span className="sc2-go">{featured ? "Open screen" : "Open"}<ChevronRight size={17} aria-hidden="true" /></span>
        </span>
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
