// The Android app's one offer of its notifications (pushAsk.js): after a
// company is first starred, a card over the tab bar asks whether to send its
// news to the phone. "Turn on" asks Android and registers (push.js); either
// answer is the last time it asks. Settings → Notifications has the switch.
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { WATCH_ADDED } from "./watchlist.js";
import { canPush, pushOn, turnPushOn } from "./push.js";
import { shouldAskPush, pushAsked, markPushAsked } from "./pushAsk.js";

export default function PushAsk() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  useEffect(() => {
    const onAdded = () => { if (shouldAskPush({ canPush: canPush(), on: pushOn(), asked: pushAsked() })) setOpen(true); };
    window.addEventListener(WATCH_ADDED, onAdded);
    return () => window.removeEventListener(WATCH_ADDED, onAdded);
  }, []);
  if (!open) return null;
  const close = () => { markPushAsked(); setOpen(false); };
  const yes = async () => {
    setBusy(true);
    try {
      if (await turnPushOn()) close();
      else { markPushAsked(); setNote("Notifications are off for this app in Android's settings. You can turn them on there, then in Settings here."); }
    } catch (e) {
      markPushAsked();
      setNote(e.message || "Couldn't turn them on just now. Settings → Notifications has the switch.");
    } finally { setBusy(false); }
  };
  return (
    <div className="push-ask" role="dialog" aria-labelledby="push-ask-h" aria-describedby="push-ask-p">
      <button type="button" className="push-ask-x" aria-label="Not now" onClick={close}><X size={16} aria-hidden="true" /></button>
      <span className="push-ask-icon" aria-hidden="true"><Bell size={18} /></span>
      <div className="push-ask-body">
        <h3 id="push-ask-h">Get news about your companies?</h3>
        <p id="push-ask-p">{note ?? "A notification when a company you've starred files results or news, or an alert's price is reached."}</p>
        {note
          ? <div className="push-ask-actions"><button type="button" className="btn-primary" onClick={() => setOpen(false)}>OK</button></div>
          : <div className="push-ask-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={yes}>{busy ? "Turning on…" : "Turn on"}</button>
            <button type="button" className="btn-ghost" onClick={close}>Not now</button>
          </div>}
      </div>
    </div>
  );
}
