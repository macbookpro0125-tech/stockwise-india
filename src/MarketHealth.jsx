import { useEffect, useState } from "react";
import { api } from "./api.js";

// Market health, 0–100 (server/explore.js healthOf): how broad the market's
// strength is, as the average of four shares of companies, each shown beside
// it. Describes the market at the last close; not a call to buy or sell.
const tone = s => (s >= 55 ? "good" : s >= 45 ? "mid" : "bad");

export default function MarketHealth() {
  const [h, setH] = useState(null);
  useEffect(() => { api.marketHealth().then(setH).catch(() => setH({ score: null })); }, []);
  if (!h) return <div className="mh mk-skel" style={{ height: 120 }} />;
  if (h.score == null) return null;
  return (
    <div className={`mh mh-${tone(h.score)}`}>
      <div className="mh-top">
        <b className="mk-num">{h.score}</b>
        <span><strong>{h.word}</strong><small>Market health, 0–100, across the {h.companies.toLocaleString("en-IN")} companies trading ₹1 crore a day or more</small></span>
      </div>
      <span className="mh-bar" aria-hidden="true"><i style={{ width: `${h.score}%` }} /></span>
      <dl className="mh-parts">
        {h.parts.map(p => (
          <div key={p.id}>
            <dt>{p.label}</dt>
            <dd className="mk-num">{Math.round(p.pct)}%{p.id === "highsLows" && <small> {p.highs} near a high, {p.lows} near a low</small>}</dd>
          </div>
        ))}
      </dl>
      <p className="mk-note">The average of these four. It describes how many companies are rising at the last close; it isn't a forecast or advice.</p>
    </div>
  );
}
