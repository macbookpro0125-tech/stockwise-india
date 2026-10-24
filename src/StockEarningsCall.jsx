import { useEffect, useState } from "react";
import { Sparkles, FileText, Mic, CalendarClock, Presentation } from "lucide-react";
import { api } from "./api.js";
import { callHistory } from "./earningsCall.js";

// "Earnings calls", in News & filings: the transcripts companies must file
// with NSE after each call (earningsCall.js). The latest leads — which
// quarter's results it was about, its transcript and recording, what
// management said in a few points (server/call-summary.js, checked against
// the transcript, with its pages) and, on request, the passages the
// attachment reader picks out, quoted with their pages. Then a call announced
// since, the earlier calls, and the investor presentations. The transcript
// itself is the source. (24 Oct 2026: past calls, presentations, a call
// announced, and the summary added.)

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function CallSummary({ symbol, index }) {
  const [state, setState] = useState(null);
  const run = async () => {
    setState({ loading: true });
    try { setState(await api.callSummary(symbol, index)); } catch (e) { setState({ error: e.message }); }
  };
  if (!state) return <button type="button" className="sd-call-read sd-call-ai" onClick={run}><Sparkles size={15} aria-hidden="true" />What management said</button>;
  if (state.loading) return <p className="sd-muted" role="status">Reading the transcript and summarising it…</p>;
  if (state.error) return <p className="sd-muted">{state.error}</p>;
  if (!state.points) {
    const why = { off: "Summaries aren't switched on for this app yet.", limit: "That's the hour's summaries; try again later.", unreadable: "The transcript has no readable text (it may be scanned), so it can't be summarised. Open it on NSE." }[state.reason] ?? "A summary couldn't be made just now; the transcript and key passages are still here.";
    return <p className="sd-muted">{why}</p>;
  }
  return (
    <div className="sd-call-summary">
      <span className="sd-call-label"><Sparkles size={13} aria-hidden="true" />What management said</span>
      <ul>{state.points.map((p, i) => <li key={i}>{p.text}<span className="sd-call-page">p. {p.page}</span></li>)}</ul>
      <p className="sd-foot">Summarised by AI from the transcript{state.truncated ? "'s first part" : ""}, every figure checked against it; the page is where each point is said. Management's own words, not a view on the shares. Read the transcript for the whole conversation.</p>
    </div>
  );
}

export default function StockEarningsCall({ symbol, m }) {
  const [hist, setHist] = useState(undefined); // undefined loading, null failed
  const [passages, setPassages] = useState(null);
  useEffect(() => {
    let stop = false;
    setHist(undefined); setPassages(null);
    api.panel(symbol, "filings").then(f => { if (!stop) setHist(callHistory(f.announcements)); }).catch(() => { if (!stop) setHist(null); });
    return () => { stop = true; };
  }, [symbol]);

  const latest = hist?.calls?.[0] ?? null;
  const t = latest?.transcript;
  const read = async () => {
    setPassages({ loading: true });
    try { setPassages(await api.filingSummary(symbol, t.index)); }
    catch (e) { setPassages({ error: e.message }); }
  };

  const q = m?.quarters?.[0];
  // the results a call discusses: the latest quarter, filed within a month before the transcript
  const results = t && q?.filed && q.filed <= t.date && Date.parse(t.date) - Date.parse(q.filed) <= 31 * 86400000 ? q : null;
  // results due, from NSE's board-meeting calendar: a call usually follows them
  const due = m?.nextResults && m.nextResults >= todayIso() ? m.nextResults : null;

  return (
    <section className="sd-card sd-call" aria-labelledby="call-title">
      <h3 id="call-title" className="sd-card-title">Earnings calls</h3>
      {hist === undefined && <p className="sd-muted">Looking through its NSE announcements…</p>}
      {hist === null && <p className="sd-muted">NSE's announcements couldn't be read just now.</p>}

      {(hist?.scheduled || due) && (
        <p className="sd-call-next">
          <CalendarClock size={15} aria-hidden="true" />
          {hist?.scheduled
            ? <span>A call was announced on <b>{day(hist.scheduled.date)}</b>. <a href={hist.scheduled.url} target="_blank" rel="noopener noreferrer">Its notice on NSE</a> has the date and dial-in.</span>
            : <span>Results are due on <b>{day(due)}</b>; the call usually follows within a day or two.</span>}
        </p>
      )}

      {hist && !t && <p className="sd-muted">No call transcript among its latest 40 NSE announcements. Some companies don't hold calls, or file the transcript late.</p>}
      {t && (
        <div className="sd-call-latest">
          <p className="sd-div-line">
            {results ? <>The call on the {MONTHS[Number(results.fyEnd.slice(5, 7)) - 1]} {results.fyEnd.slice(0, 4)} quarter's results: transcript</> : "Latest transcript"} filed on <b>{day(t.date)}</b>.
          </p>
          <div className="sd-call-links">
            <a href={t.url} target="_blank" rel="noopener noreferrer"><FileText size={14} aria-hidden="true" />Transcript (PDF)</a>
            {latest.recording && <a href={latest.recording.url} target="_blank" rel="noopener noreferrer"><Mic size={14} aria-hidden="true" />Recording</a>}
          </div>
          <CallSummary key={t.url} symbol={symbol} index={t.index} />
          {!passages && <button type="button" className="sd-call-read" onClick={read}>Show key passages from the transcript</button>}
          {passages?.loading && <p className="sd-muted">Reading the transcript…</p>}
          {passages?.error && <p className="sd-muted">{passages.error}</p>}
          {passages?.evidence && (
            <>
              <ul className="sd-call-quotes">{passages.evidence.map((p, i) => <li key={i}><span>{p.page ? `Page ${p.page}` : "Extract"}</span>“{p.text}”</li>)}</ul>
              <p className="sd-foot">Picked automatically from {passages.pagesRead ?? "the"} pages read; they can miss context. Read the transcript for the whole conversation.</p>
            </>
          )}
        </div>
      )}

      {hist?.calls?.length > 1 && (
        <div className="sd-call-more">
          <h4>Earlier calls</h4>
          <ul>
            {hist.calls.slice(1, 6).map(c => (
              <li key={c.transcript.url}>
                <span>{day(c.transcript.date)}</span>
                <a href={c.transcript.url} target="_blank" rel="noopener noreferrer">Transcript</a>
                {c.recording && <a href={c.recording.url} target="_blank" rel="noopener noreferrer">Recording</a>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {hist?.presentations?.length > 0 && (
        <div className="sd-call-more">
          <h4><Presentation size={14} aria-hidden="true" />Investor presentations</h4>
          <ul>
            {hist.presentations.slice(0, 4).map(p => (
              <li key={p.url}><span>{day(p.date)}</span><a href={p.url} target="_blank" rel="noopener noreferrer">Slides (PDF)</a></li>
            ))}
          </ul>
        </div>
      )}
      {hist && (hist.calls.length > 0 || hist.presentations.length > 0) && <p className="sd-foot">From its latest 40 NSE announcements; older calls are on NSE.</p>}
    </section>
  );
}
