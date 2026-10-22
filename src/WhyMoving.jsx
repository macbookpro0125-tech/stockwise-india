import { useEffect, useState } from "react";
import { Activity, FileText, CalendarDays, Megaphone, Newspaper, Mountain, CalendarClock, CircleHelp, Sparkles } from "lucide-react";
import { api } from "./api.js";

// "Why is it moving?" (22 Oct 2026, "a description of why this stock is
// going up or down"): what can be seen around the latest move — against the
// market and its sector, trading, results, dividends, filings and news —
// put together by the server from the record (server/moves.js). The title
// stays a question: the card shows what happened around the move, and says
// so when nothing on record goes with it. Above them, when the server has
// an AI key: Claude's two or three sentences on those same facts, checked
// before they're sent (server/ai-moves.js) and labelled as AI.

const ICONS = { results: FileText, action: CalendarDays, filing: Megaphone, volume: Activity, range: Mountain, news: Newspaper, ahead: CalendarClock, quiet: CircleHelp };
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function WhyMoving({ symbol }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [ai, setAi] = useState(null);
  useEffect(() => {
    let off = false;
    setData(null); setFailed(false); setAi(null);
    api.panel(symbol, "moves").then(d => {
      if (off) return;
      setData(d);
      // the summary after the facts, so they never wait on it; nothing shows when it's off or unavailable
      if (d?.moves?.length) api.panel(symbol, "moves-summary").then(s => { if (!off && s?.summary) setAi(s); }).catch(() => {});
    }).catch(() => { if (!off) setFailed(true); });
    return () => { off = true; };
  }, [symbol]);
  if (failed || (data && !data.moves?.length)) return null;

  return (
    <section className="sd-card sd-moves" aria-labelledby="moves-title" aria-busy={!data}>
      <h3 id="moves-title" className="sd-card-title">Why is it moving?</h3>
      {!data ? (
        <div aria-hidden="true"><span className="sc-skel" style={{ display: "block", width: "80%", height: 14, margin: "6px 0" }} /><span className="sc-skel" style={{ display: "block", width: "55%", height: 14 }} /></div>
      ) : (
        <>
          {ai && (
            <div className="sd-moves-ai">
              <span className="sd-moves-ai-label"><Sparkles size={13} strokeWidth={2.2} aria-hidden="true" /> AI summary of the points below · it can make mistakes</span>
              <p>{ai.summary}</p>
            </div>
          )}
          {data.moves.map(m => <p key={m.period} className="sd-moves-line" data-dir={Math.abs(m.ret) < 0.5 ? "flat" : m.ret > 0 ? "up" : "down"}>{m.text}</p>)}
          {data.points.length > 0 && (
            <ul className="sd-moves-list">
              {data.points.map((p, i) => {
                const Icon = ICONS[p.kind] ?? FileText;
                const meta = [p.label, p.source, p.kind === "news" && p.date ? shortDay(p.date) : null].filter(Boolean).join(" · ");
                return (
                  <li key={i} className="sd-moves-point" data-kind={p.kind}>
                    <span className="sd-moves-icon" aria-hidden="true"><Icon size={14} strokeWidth={2.2} /></span>
                    <span className="sd-moves-text">
                      {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.text}</a> : p.text}
                      {meta && <b>{meta}</b>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {data.unread?.length > 0 && <p className="sd-muted" style={{ margin: "var(--sp-2) 0 0" }}>{data.unread.join(" and ")} couldn't be read just now.</p>}
          <p className="sd-moves-foot">What happened around the move, from NSE's records and the news — not a forecast or advice. A price can move for reasons no record shows.</p>
        </>
      )}
    </section>
  );
}
