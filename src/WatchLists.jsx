import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, MoreHorizontal, Check, ListPlus, Sparkles } from "lucide-react";
import CompanyLogo from "./CompanyLogo.jsx";
import { suggestListNames } from "./watchListNames.js";

// The Watchlist page's tabs (24 Oct 2026, "add watchlist tabs; suggest names,
// or we can name it anything"): All — every starred stock — and the user's
// own named lists, a new one from a suggested name or any name typed; a list's
// menu renames or deletes it; each card's Lists button puts the stock in or
// out of them (server/user-watchlist.js).

export function ListTabs({ lists, active, onPick, allCount, onNew, onRename, onDelete }) {
  const [menu, setMenu] = useState(false);
  const current = lists.find(l => l.id === active);
  useEffect(() => { setMenu(false); }, [active]);
  return (
    <div className="wl-tabs-bar">
      <div className="wl-tabs" role="tablist" aria-label="Watchlist lists">
        <button type="button" role="tab" className="wl-tab" aria-selected={active == null} onClick={() => onPick(null)}>
          All<span className="wl-tab-n">{allCount}</span>
        </button>
        {lists.map(l => (
          <button key={l.id} type="button" role="tab" className="wl-tab" aria-selected={active === l.id} onClick={() => onPick(l.id)}>
            {l.name}<span className="wl-tab-n">{l.count}</span>
          </button>
        ))}
        <button type="button" className="wl-tab wl-tab-new" onClick={onNew}><Plus size={15} aria-hidden="true" />New list</button>
      </div>
      {current && (
        <div className="wl-tab-menu">
          <button type="button" className="wl-icon-btn" aria-label={`${current.name}: rename or delete`} aria-expanded={menu} onClick={() => setMenu(m => !m)}><MoreHorizontal size={17} /></button>
          {menu && (
            <div className="wl-pop" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onRename(current); }}>Rename list</button>
              <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); onDelete(current); }}>Delete list</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A new list's name (or a list's new name): typed, or one of the suggestions —
// a sector's comes with its starred stocks in it
export function ListNameDialog({ title, initial = "", lists, starred, onSave, onClose, suggest = true }) {
  const [name, setName] = useState(initial);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  const ideas = suggest ? suggestListNames({ starred, existing: lists.map(l => l.name) }) : [];
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const save = async (n = name, tickers = picked?.name === n ? picked.tickers : []) => {
    if (!n.trim() || busy) return;
    setBusy(true); setError("");
    try { await onSave(n.trim(), tickers); onClose(); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div className="wl-dialog-scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wl-dialog" role="dialog" aria-modal="true" aria-labelledby="wl-dialog-title">
        <h2 id="wl-dialog-title" className="wl-dialog-title">{title}</h2>
        <input ref={input} className="input-base wl-dialog-input" aria-label="List name" maxLength={40} placeholder="Name it anything" value={name}
          onChange={e => { setName(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter") save(); }} />
        {error && <p className="wl-dialog-error" role="alert">{error}</p>}
        {ideas.length > 0 && (
          <>
            <p className="wl-dialog-h"><Sparkles size={13} aria-hidden="true" />Suggestions</p>
            <div className="wl-ideas">
              {ideas.map(i => (
                <button key={i.name} type="button" className="wl-idea" aria-pressed={picked?.name === i.name && name === i.name}
                  onClick={() => { setName(i.name); setPicked(i); setError(""); }}>
                  {i.name}{i.tickers.length > 0 && <span className="wl-idea-n">{i.tickers.length} starred</span>}
                </button>
              ))}
            </div>
            {picked?.tickers.length > 0 && name === picked.name && <p className="wl-dialog-note">Made with your {picked.tickers.length} starred {picked.name} in it.</p>}
          </>
        )}
        <div className="wl-dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!name.trim() || busy} onClick={() => save()}>{busy ? "Saving…" : initial ? "Rename" : "Create list"}</button>
        </div>
      </div>
    </div>
  );
}

// A card's Lists button: which lists the stock is in, ticked; a tap puts it in or out
export function ListPicker({ ticker, name, lists, onToggle, onNew }) {
  // open: where the menu goes, under the button against the window (a card clips what overflows it)
  const [open, setOpen] = useState(null);
  const box = useRef(null);
  const pop = useRef(null);
  const toggle = e => {
    if (open) { setOpen(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 260;
    setOpen({ right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
  };
  useEffect(() => {
    if (!open) return;
    const away = e => { if (!box.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(null); };
    const esc = e => { if (e.key === "Escape") setOpen(null); };
    const gone = () => setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", gone, { passive: true });
    window.addEventListener("resize", gone);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", gone); window.removeEventListener("resize", gone); };
  }, [open]);
  const inCount = lists.filter(l => l.tickers.includes(ticker)).length;
  return (
    <div className="wl-picker" ref={box}>
      <button type="button" className={`wl-icon-btn${inCount ? " on" : ""}`} aria-label={`Lists for ${name}`} title="Add to a list" aria-expanded={!!open} onClick={toggle}>
        <ListPlus size={15} />{inCount > 0 && <span className="wl-picker-n">{inCount}</span>}
      </button>
      {/* (on the page itself: a card's effects would clip it, even fixed) */}
      {open && createPortal(
        <div ref={pop} className="wl-pop wl-pop-fixed" style={open} role="menu" aria-label={`Lists for ${name}`}>
          {lists.length === 0 && <p className="wl-pop-empty">No lists yet</p>}
          {lists.map(l => {
            const on = l.tickers.includes(ticker);
            return (
              <button key={l.id} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => onToggle(l.id, ticker, !on)}>
                <span className={`wl-check${on ? " on" : ""}`} aria-hidden="true">{on && <Check size={12} strokeWidth={3} />}</span>{l.name}
              </button>
            );
          })}
          <button type="button" role="menuitem" className="wl-pop-new" onClick={() => { setOpen(null); onNew(ticker); }}><Plus size={14} aria-hidden="true" />New list…</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// An empty list: its name, and the starred stocks to put in it with a tap
export function EmptyList({ list, starred, onAdd }) {
  const rest = starred.filter(s => !list.tickers.includes(s.ticker));
  return (
    <div className="wl-empty-list">
      <p className="wl-empty-title">{list.name} is empty</p>
      <p className="wl-empty-sub">{rest.length ? "Tap a starred stock to add it, or use the list button on any card." : "Star stocks, then add them here."}</p>
      {rest.length > 0 && (
        <div className="wl-quick">
          {rest.slice(0, 24).map(s => (
            <button key={s.ticker} type="button" className="wl-quick-chip" onClick={() => onAdd(list.id, s.ticker)}>
              <CompanyLogo symbol={s.ticker} size={20} fallback={s.name} /><span>{s.name}</span><Plus size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
