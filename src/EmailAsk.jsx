// The results email's one offer (12 Nov 2026: of 22 Google sign-ups only 2
// came back on a later day). On the website — the Android app offers its own
// notifications instead (PushAsk.jsx) — after a company is first starred, a
// card asks whether to email the evening before it reports. Shown once in
// this browser, only when the site can send email, the account has an
// address and the email isn't on yet. Settings has the switch either way.
import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { api } from "./api.js";
import { WATCH_ADDED } from "./watchlist.js";
import { canPush } from "./push.js";

const KEY = "results-email-asked";
const asked = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
const markAsked = () => { try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* asked again next time; no harm */ } };
// the switch's state, read once the app opens, so "will it ask?" is known at
// once — the "saved to your watchlist" panel steps aside for it (SaveToList.jsx)
let state = null;
export const willAskEmail = () => !canPush() && !asked() && !!state?.available && !state.on;

export default function EmailAsk() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => {
    if (!canPush() && !asked()) api.resultsEmail().then(x => { state = x; }).catch(() => {});
    const onAdded = () => { if (willAskEmail()) setOpen(true); };
    window.addEventListener(WATCH_ADDED, onAdded);
    return () => window.removeEventListener(WATCH_ADDED, onAdded);
  }, []);
  if (!open) return null;
  const close = () => { markAsked(); setOpen(false); };
  const yes = async () => {
    setBusy(true);
    try {
      state = await api.setResultsEmail(true);
      markAsked();
      setNote("Done. You'll get an email the evening before a company on your watchlist reports. Settings has the switch.");
    } catch (e) {
      markAsked();
      setNote(e.message || "Couldn't turn it on just now. Settings has the switch.");
    } finally { setBusy(false); }
  };
  return (
    <div className="push-ask" role="dialog" aria-labelledby="email-ask-h" aria-describedby="email-ask-p">
      <button type="button" className="push-ask-x" aria-label="Not now" onClick={close}><X size={16} aria-hidden="true" /></button>
      <span className="push-ask-icon" aria-hidden="true"><Mail size={18} /></span>
      <div className="push-ask-body">
        <h3 id="email-ask-h">Get an email before results?</h3>
        <p id="email-ask-p">{note ?? "The evening before a company on your watchlist reports its quarterly results. One email, only on those days."}</p>
        {note
          ? <div className="push-ask-actions"><button type="button" className="btn-primary" onClick={() => setOpen(false)}>OK</button></div>
          : <div className="push-ask-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={yes}>{busy ? "Turning on…" : "Email me"}</button>
            <button type="button" className="btn-ghost" onClick={close}>Not now</button>
          </div>}
      </div>
    </div>
  );
}
