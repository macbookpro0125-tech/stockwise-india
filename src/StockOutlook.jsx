import { useEffect, useState } from "react";
import { Sparkles, Eye } from "lucide-react";
import { api } from "./api.js";
import { callHistory } from "./earningsCall.js";
import { historyLines } from "./historySuggests.js";
import { watchFor } from "./chapterText.js";

// Outlook (17 Nov 2026, the owner: "can we show a forecast like Tickertape?").
// We don't make forecasts or targets — that needs SEBI registration as a
// research analyst — so the forward view here is never ours:
//   1. what management itself expects, from its latest earnings call
//      (server/call-summary.js, every point with its transcript page)
//   2. where the company's own five-year pace points, as arithmetic
//      (historySuggests.js), and when its next results are due
//   3. what would change the picture: the questions its checks raise
// Labelled throughout as the company's words and its history, not advice.

// a point that looks ahead: what management expects, plans or guides to
const AHEAD = /\b(expect|expects|expected|guid|outlook|target|plan|plans|planned|will|next (year|quarter|fiscal)|H2|second half|FY ?2[7-9]|aim|pipeline|going forward|confident|anticipat|intend|forecast|project(ed|s)?|capex of|to (grow|reach|add|launch|commission))/i;

export const lookingAhead = points => (points ?? []).filter(p => AHEAD.test(p.text));

function ManagementView({ symbol }) {
  const [hist, setHist] = useState(undefined);
  const [state, setState] = useState(null);
  useEffect(() => {
    let stop = false;
    setHist(undefined); setState(null);
    api.panel(symbol, "filings").then(f => { if (!stop) setHist(callHistory(f.announcements)); }).catch(() => { if (!stop) setHist(null); });
    return () => { stop = true; };
  }, [symbol]);
  const t = hist?.calls?.[0]?.transcript;
  if (hist === undefined) return <p className="sd-muted">Looking for its latest earnings call…</p>;
  if (!t) return <p className="sd-muted">It hasn't filed an earnings call transcript with NSE recently, so there's no outlook from management to show.</p>;
  const run = async () => {
    setState({ loading: true });
    try { setState(await api.callSummary(symbol, t.index)); } catch (e) { setState({ error: e.message }); }
  };
  if (!state) {
    return (
      <button type="button" className="sd-call-read sd-call-ai" onClick={run}>
        <Sparkles size={15} aria-hidden="true" />Read what management expects
      </button>
    );
  }
  if (state.loading) return <p className="sd-muted" role="status">Reading the latest call transcript…</p>;
  if (state.error || !state.points) {
    const why = { off: "Reading calls isn't switched on for this app yet.", limit: "That's the hour's call readings; try again later.", unreadable: "The latest call's transcript has no readable text (it may be scanned)." }[state.reason] ?? "The latest call couldn't be read just now.";
    return <p className="sd-muted">{why} The transcript is in the News tab.</p>;
  }
  const ahead = lookingAhead(state.points);
  return ahead.length
    ? <ul className="ol-points">{ahead.map((p, i) => <li key={i}>{p.text}<span className="sd-call-page">p. {p.page}</span></li>)}</ul>
    : <p className="sd-muted">Management didn't give a clear outlook on its latest call ({t.date}). What they said about the quarter is in the News tab.</p>;
}

export default function StockOutlook({ symbol, m }) {
  const lines = historyLines(m).filter(l => l.k === "If its pace continued" || l.k === "Next results");
  const watch = ["growth", "business", "safety", "owners"].flatMap(id => watchFor(id, m)).slice(0, 4);
  return (
    <div className="ol">
      <div className="ol-part">
        <h4>What management expects</h4>
        <ManagementView symbol={symbol} />
      </div>
      {lines.length > 0 && (
        <div className="ol-part">
          <h4>Where its own pace points</h4>
          <dl className="ol-dl">{lines.map(l => <div key={l.k}><dt>{l.k}</dt><dd>{l.text}</dd></div>)}</dl>
        </div>
      )}
      {watch.length > 0 && (
        <div className="ol-part">
          <h4>What would change the picture</h4>
          <ul className="ol-watch">{watch.map(([title, q]) => <li key={title}><Eye size={15} aria-hidden="true" /><span><b>{title}</b> {q}</span></li>)}</ul>
        </div>
      )}
      <p className="ol-foot">Management's own words from its call transcript, and arithmetic on its past filings. Not our forecast, not a price target and not advice.</p>
    </div>
  );
}
