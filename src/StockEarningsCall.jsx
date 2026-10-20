import { useEffect, useState } from "react";
import { api } from "./api.js";
import { latestCall } from "./earningsCall.js";

// "Latest earnings call", in News & filings: the transcript companies must
// file with NSE after the call (earningsCall.js), which quarter's results it
// was about (the results themselves are in What changed recently), and on
// request the passages the attachment reader picks out, quoted with their
// pages. The transcript itself is the source.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function StockEarningsCall({ symbol, m }) {
  const [call, setCall] = useState(undefined); // undefined loading, null failed
  const [passages, setPassages] = useState(null);
  useEffect(() => {
    let stop = false;
    setCall(undefined); setPassages(null);
    api.panel(symbol, "filings").then(f => { if (!stop) setCall(latestCall(f.announcements)); }).catch(() => { if (!stop) setCall(null); });
    return () => { stop = true; };
  }, [symbol]);

  const read = async () => {
    setPassages({ loading: true });
    try { setPassages(await api.filingSummary(symbol, call.transcript.index)); }
    catch (e) { setPassages({ error: e.message }); }
  };

  const q = m?.quarters?.[0];
  const t = call?.transcript;
  // the results a call discusses: the latest quarter, filed within a month before the transcript
  const results = t && q?.filed && q.filed <= t.date && Date.parse(t.date) - Date.parse(q.filed) <= 31 * 86400000 ? q : null;

  return (
    <section className="sd-card sd-call" aria-labelledby="call-title">
      <h3 id="call-title" className="sd-card-title">Latest earnings call</h3>
      {call === undefined && <p className="sd-muted">Looking through its NSE announcements…</p>}
      {call === null && <p className="sd-muted">NSE's announcements couldn't be read just now.</p>}
      {call && !t && <p className="sd-muted">No call transcript among its latest 40 NSE announcements. Some companies don't hold calls, or file the transcript late.</p>}
      {t && (
        <>
          <p className="sd-div-line">
            {results ? <>The call on the {MONTHS[Number(results.fyEnd.slice(5, 7)) - 1]} {results.fyEnd.slice(0, 4)} quarter's results: transcript</> : "Transcript"} filed on <b>{day(t.date)}</b>.{" "}
            <a href={t.url} target="_blank" rel="noopener noreferrer">Read it on NSE (PDF)</a>
            {call.recording && <> · <a href={call.recording.url} target="_blank" rel="noopener noreferrer">the recording's link</a></>}
          </p>
          {!passages && <button type="button" className="sd-call-read" onClick={read}>Show key passages from the transcript</button>}
          {passages?.loading && <p className="sd-muted">Reading the transcript…</p>}
          {passages?.error && <p className="sd-muted">{passages.error}</p>}
          {passages?.evidence && (
            <>
              <ul className="sd-call-quotes">{passages.evidence.map((p, i) => <li key={i}><span>{p.page ? `Page ${p.page}` : "Extract"}</span>“{p.text}”</li>)}</ul>
              <p className="sd-foot">Picked automatically from {passages.pagesRead ?? "the"} pages read; they can miss context. Read the transcript for the whole conversation.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
