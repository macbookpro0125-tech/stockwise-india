import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { api } from "./api.js";

// The top of a phone's full-screen chart (1 Nov 2026, the owner: the first screen
// of a broker app's chart): close, a search for another company, and the arrows
// that walk the watchlist. Signed out, search and the arrows aren't there.
export default function ChartTopBar({ symbol, onSymbol, onClose }) {
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const latest = useRef("");
  useEffect(() => {
    let live = true;
    api.watchlist().then(d => { if (live) setList((d?.items ?? []).map(i => i.ticker)); }).catch(() => { if (live) setList(null); });
    return () => { live = false; };
  }, []);
  const type = async v => {
    setQ(v);
    const t = v.trim();
    latest.current = t;
    if (!t) { setFound([]); return; }
    try { const d = await api.search(t); if (latest.current === t) setFound(d ?? []); } catch { setFound([]); }
  };
  const go = t => { setQ(""); setFound([]); latest.current = ""; onSymbol(t); };
  const at = list ? list.indexOf(symbol) : -1;
  const step = by => { if (list?.length) go(list[at < 0 ? 0 : (at + by + list.length) % list.length]); };
  return (
    <div className="chart-topbar">
      <button type="button" className="chart-topbar-x" onClick={onClose} aria-label="Close the full-screen chart"><X size={20} aria-hidden="true" /></button>
      {list && (
        <div className="chart-topbar-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={q} onChange={e => type(e.target.value)} placeholder="Search" aria-label="Search for another company" />
          {found.length > 0 && (
            <div className="chart-topbar-found">
              {found.slice(0, 8).map(s => <button key={s.ticker} type="button" onClick={() => go(s.ticker)}><b>{s.ticker}</b> <span>{s.name}</span></button>)}
            </div>
          )}
        </div>
      )}
      {list?.length > 0 ? (
        <div className="chart-topbar-walk" role="group" aria-label="Walk your watchlist">
          <button type="button" onClick={() => step(-1)} aria-label="Previous company in your watchlist"><ArrowLeft size={18} aria-hidden="true" /></button>
          <span>Watchlist</span>
          <button type="button" onClick={() => step(1)} aria-label="Next company in your watchlist"><ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      ) : !list && <h2 className="chart-topbar-name">{symbol}</h2>}
    </div>
  );
}
