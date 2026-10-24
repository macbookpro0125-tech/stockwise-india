// A stock starred anywhere in the app — the screener's star, a company page's
// "Add to watchlist" — can go straight into one of the user's lists (24 Oct
// 2026: "add the stock to my watchlist from anywhere, and to any list I've
// made"): a panel over the bottom of the page says it's saved, with a chip for
// each list (a tap puts it in or out) and New list. It goes after a few
// seconds untouched, waits while the pointer or focus is on it, and steps
// aside the once the Android app offers its notifications (PushAsk.jsx).
import { useEffect, useRef, useState } from "react";
import { Star, Plus, Check, X } from "lucide-react";
import { WATCH_ADDED, useWatchLists, setInList, createList } from "./watchlist.js";
import { ListNameDialog } from "./WatchLists.jsx";
import { canPush, pushOn } from "./push.js";
import { shouldAskPush, pushAsked } from "./pushAsk.js";

const STAY = 7000;

export default function SaveToList() {
  const lists = useWatchLists();
  const [symbol, setSymbol] = useState(null);
  const [naming, setNaming] = useState(false);
  const [held, setHeld] = useState(false);
  const timer = useRef(null);
  const close = () => { setSymbol(null); setNaming(false); };
  // a fresh few seconds from now (each tap starts them again)
  const restart = () => { clearTimeout(timer.current); timer.current = setTimeout(close, STAY); };
  useEffect(() => {
    const onAdded = e => {
      if (shouldAskPush({ canPush: canPush(), on: pushOn(), asked: pushAsked() })) return;
      setSymbol(e.detail?.symbol ?? null);
      restart();
    };
    window.addEventListener(WATCH_ADDED, onAdded);
    return () => { window.removeEventListener(WATCH_ADDED, onAdded); clearTimeout(timer.current); };
  }, []);
  useEffect(() => { if (held || naming) clearTimeout(timer.current); else if (symbol) restart(); }, [held, naming]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!symbol) return null;
  return (
    <>
      <div className="stl" role="dialog" aria-label={`${symbol} saved to your watchlist`}
        onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
        <div className="stl-top">
          <span className="stl-star" aria-hidden="true"><Star size={15} fill="currentColor" /></span>
          <span className="stl-text"><b>{symbol}</b> saved to your watchlist</span>
          <button type="button" className="stl-x" aria-label="Close" onClick={close}><X size={16} /></button>
        </div>
        <div className="stl-row" role="group" aria-label="Add it to a list">
          <span className="stl-label">{lists.length ? "Add to" : "Group it"}</span>
          {lists.map(l => {
            const on = l.tickers.includes(symbol);
            return (
              <button key={l.id} type="button" className="stl-chip" aria-pressed={on} onClick={() => { setInList(l.id, symbol, !on); restart(); }}>
                {on && <Check size={13} strokeWidth={3} aria-hidden="true" />}{l.name}
              </button>
            );
          })}
          <button type="button" className="stl-chip stl-new" onClick={() => setNaming(true)}><Plus size={14} aria-hidden="true" />New list</button>
        </div>
      </div>
      {naming && (
        <ListNameDialog title={`New list with ${symbol}`} lists={lists}
          onSave={async name => { const list = await createList(name); await setInList(list.id, symbol, true); }}
          onClose={() => { setNaming(false); restart(); }} />
      )}
    </>
  );
}
