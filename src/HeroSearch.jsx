import { useEffect, useRef, useState } from "react";
import { navigate } from "./site.jsx";

// The front page's first screen (30 Oct 2026: 0 sign-ups from a week of
// visitors who met only a sky and a slogan): search any NSE company and
// open its public page, no account needed, or try one of the biggest.
// Suggestions come from /api/public/search (symbols and names only).
const TRY = [["RELIANCE", "Reliance"], ["TCS", "TCS"], ["HDFCBANK", "HDFC Bank"], ["INFY", "Infosys"]];
const open = symbol => navigate(`/stock/${encodeURIComponent(symbol)}`);

export default function HeroSearch({ className = "" }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  useEffect(() => {
    const text = q.trim();
    if (!text) { setList([]); return; }
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/public/search?q=${encodeURIComponent(text)}`).then(r => (r.ok ? r.json() : [])).then(r => { if (live) { setList(r); setActive(-1); } }).catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  // a tap outside closes the list
  useEffect(() => {
    const away = e => { if (!box.current?.contains(e.target)) setList([]); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  const submit = e => {
    e.preventDefault();
    const pick = list[active] ?? list[0];
    if (pick) open(pick.ticker);
  };
  const onKey = e => {
    if (!list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (a + 1) % list.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a <= 0 ? list.length - 1 : a - 1)); }
    if (e.key === "Escape") setList([]);
  };
  return (
    <div className={`hs ${className}`} ref={box}>
      <form role="search" onSubmit={submit} className="hs-form">
        <svg className="hs-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search any NSE company" aria-label="Search any NSE company"
          role="combobox" aria-expanded={list.length > 0} aria-controls="hs-list" aria-autocomplete="list" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" />
      </form>
      {list.length > 0 && (
        <ul id="hs-list" role="listbox" className="hs-list">
          {list.map((s, i) => (
            <li key={s.ticker} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => open(s.ticker)}><b>{s.ticker}</b><span>{s.name}</span></button>
            </li>
          ))}
        </ul>
      )}
      <p className="hs-try">Try{TRY.map(([s, name], i) => <span key={s}>{i ? " · " : " "}<a href={`/stock/${s}`} onClick={e => { e.preventDefault(); open(s); }}>{name}</a></span>)}</p>
    </div>
  );
}
