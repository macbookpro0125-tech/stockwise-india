import { useState, useEffect, useRef } from "react";
import CompanyLogo from "./CompanyLogo.jsx";
import { Star, X, NotebookPen, ChevronRight, CalendarDays, TrendingDown, TrendingUp, Tag, Ellipsis, Check, Plus } from "lucide-react";
import { BellIcon } from "./icons.jsx";
import { api } from "./api.js";
import { useWatchlist, toggleWatch, watchSaved, useWatchLists, primeWatchLists, setInList, createList as createWatchList, renameList as renameWatchList, deleteList as deleteWatchList } from "./watchlist.js";
import CreateAlertModal from "./CreateAlertModal.jsx";
import { pricePosition } from "../server/levels.js";
import { useMyLevels, withMyLevels } from "./myLevels.js";
import { nextEvent, todayIst } from "./watchEvents.js";
import { NewsRow } from "./NewsView.jsx";
import { markWatchNewsSeen } from "./watchNews.js";
import { ListTabs, ListNameDialog, EmptyList } from "./WatchLists.jsx";
import { cardName } from "./stockName.js";
import { summaryLine, needsALook, rowNote, sinceAdded, signedPct } from "./watchlistText.js";

// The open list (its tab) is remembered on this device
const LIST_KEY = "wl-list";
const savedList = () => { try { const v = Number(localStorage.getItem(LIST_KEY)); return v > 0 ? v : null; } catch { return null; } };
const saveList = id => { try { if (id) localStorage.setItem(LIST_KEY, String(id)); else localStorage.removeItem(LIST_KEY); } catch { /* private mode */ } };

// The Watchlist (26 Oct 2026, redone: "it is not much useful"): one line for
// the whole list, what needs a look, then a compact row per company — its
// price and the day's move, the change since it was added, and the one note
// most worth reading (watchlistText.js). A tap opens the company; holding a
// row, or its ⋯, gives the rest: an alert, its lists, a note, removing it.
// Saved to the account.

function fmtRs(n) {
  if (n == null || isNaN(n)) return "—";
  // paise under ₹100, where a whole rupee is a big step (₹8.23, not ₹8)
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

// Where the price sits against the user's own levels (myLevels.js), in a few
// words — the zone from pricePosition (server/levels.js), which never says
// buy or sell; none while their levels are off
const TONE = { red: "var(--red)", yellow: "var(--yellow)", green: "var(--green)" };
function levelStatus(cmp, r) {
  if (!cmp || !r?.safeBuyPrice) return null;
  const pos = pricePosition(cmp, { fv25: r.fv25, p1: r.safeBuyPrice, p2: r.p2, p3: r.p3, stopLoss: r.stopLoss, target: r.target });
  if (!pos) return null;
  if (pos.zone === "above-phase1") {
    const prem = ((cmp - r.safeBuyPrice) / r.safeBuyPrice) * 100;
    return { label: `${prem.toFixed(0)}% above your L1`, color: prem <= 10 ? "var(--yellow)" : "var(--t3)" };
  }
  const short = { "below-stop": "Below your stop", phase3: "At/below your L3", phase2: "At/below your L2", phase1: "At/below your L1", "above-upper": "Above your upper", "far-above": "Far above your upper" };
  return { label: short[pos.zone] ?? pos.label, color: TONE[pos.tone] ?? "var(--t3)" };
}


// What the starred companies told NSE, and headlines naming them, newest
// first (23 Oct 2026): five here, the rest on Explore's My watchlist. Opening
// the page clears the tab's dot (watchNews.js).
function WatchNews({ data, onOpenNews }) {
  const [all, setAll] = useState(false);
  if (!data?.items?.length) return null;
  const shown = all ? data.items.slice(0, 20) : data.items.slice(0, 5);
  return (
    <section className="wl-news" aria-labelledby="wl-news-h">
      <div className="wl-news-head">
        <h3 id="wl-news-h">News from your companies</h3>
        {data.items.length > 5 && <button type="button" className="nw-see-all" onClick={() => setAll(a => !a)}>{all ? "Fewer" : `All ${Math.min(20, data.items.length)}`}</button>}
      </div>
      <div className="nw-list">{shown.map(item => <NewsRow key={item.id} item={item} onOpen={onOpenNews} asOf={data.asOf} />)}</div>
    </section>
  );
}

// The news about the starred companies, loaded once for the page (the section
// above the cards, and each card's latest line); again when a company is
// starred or unstarred, once that's saved
function useWatchNews() {
  const [data, setData] = useState(null);
  const watched = useWatchlist();
  const watchKey = [...watched].sort().join(",");
  useEffect(() => { watchSaved().then(() => api.news({ kind: "watchlist" })).then(setData).catch(() => setData({ items: [] })); markWatchNewsSeen(); }, [watchKey]);
  return data;
}

// Each company's newest item: its own announcement, or a headline naming it
function latestBySymbol(items = []) {
  const m = new Map();
  for (const i of items) for (const s of [i.symbol, ...(i.companies ?? []).map(c => c.symbol)]) if (s && !m.has(s)) m.set(s, i);
  return m;
}

const LOOK_ICON = { results: CalendarDays, down: TrendingDown, up: TrendingUp, value: Tag };

// "Needs a look": results this week, a big move, a price far under its fair
// value — each opening the company
function NeedsALook({ items, onOpen }) {
  if (!items.length) return null;
  return (
    <section className="wl-look" aria-labelledby="wl-look-h">
      <h3 id="wl-look-h" className="wl-look-h">Needs a look</h3>
      <ul>
        {items.map(x => {
          const Icon = LOOK_ICON[x.kind];
          return (
            <li key={`${x.kind}-${x.symbol}`}>
              <button type="button" className={`wl-look-row k-${x.kind}`} onClick={() => onOpen(x.symbol)}>
                <Icon size={17} aria-hidden="true" /><span><b>{x.name}</b> {x.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A company's row: tap to open it; hold it (or its ⋯) for the rest
function WatchRow({ item, r, price, note, leaving, onOpen, onMore }) {
  const name = cardName(r?.name ?? item.ticker);
  const since = sinceAdded(item, price);
  const day = r?.ret1d;
  const hold = useRef(null);
  const held = useRef(false);
  const start = e => {
    held.current = false;
    const { clientX: x, clientY: y } = e;
    hold.current = { x, y, t: setTimeout(() => { held.current = true; navigator.vibrate?.(8); onMore(); }, 480) };
  };
  const move = e => { const h = hold.current; if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) { clearTimeout(h.t); hold.current = null; } };
  const end = () => { if (hold.current) clearTimeout(hold.current.t); hold.current = null; };
  return (
    <li className={`wl-row${leaving ? " leaving" : ""}`}>
      <div className="wl-item">
        <button type="button" className="wl-main" aria-label={`Open ${name}`}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
          onContextMenu={e => { e.preventDefault(); end(); onMore(); }}
          onClick={e => { if (held.current) { e.preventDefault(); held.current = false; return; } onOpen(item.ticker); }}>
          <CompanyLogo symbol={item.ticker} size={36} fallback={name} />
          <span className="wl-who">
            <span className="wl-name">{name}</span>
            <span className="wl-sub">
              {since != null && <>Since added <em className={since >= 0 ? "up" : "down"}>{signedPct(since)}</em></>}
              {note && (note.tag ? <span className="wl-tag">{note.tag}</span> : <span className="wl-note" style={note.tone ? { color: note.tone } : undefined}>{since != null ? " · " : ""}{note.text}</span>)}
            </span>
          </span>
          <span className="wl-price">
            {price ? fmtRs(price) : "…"}
            {day != null && <em className={day >= 0 ? "up" : "down"}>{signedPct(day)}</em>}
          </span>
        </button>
        <button type="button" className="wl-more" aria-label={`More for ${name}`} onClick={onMore}><Ellipsis size={18} /></button>
      </div>
    </li>
  );
}

// What a held row offers: an alert, its lists, a note, removing it
function RowSheet({ name, item, lists, current, onClose, onAlert, onToggleList, onNewList, onSaveNote, onRemove, onOpen }) {
  const [note, setNote] = useState(item.note ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const esc = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="wl-sheet-wrap" role="presentation">
      <div className="wl-sheet-scrim" onClick={onClose} />
      <div className="wl-sheet" role="dialog" aria-modal="true" aria-label={name}>
        <div className="wl-sheet-head">
          <CompanyLogo symbol={item.ticker} size={30} fallback={name} />
          <span><b>{name}</b><small>{item.addedAt ? `Added ${fmtDate(item.addedAt)}${item.addedPrice > 0 ? ` at ${fmtRs(item.addedPrice)}` : ""}` : item.ticker}</small></span>
          <button type="button" className="wl-sheet-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onOpen(); }}>Open {name}<ChevronRight size={16} aria-hidden="true" /></button>
        <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onAlert(); }}><BellIcon /> Set a price alert</button>
        <div className="wl-sheet-group">
          <span className="wl-sheet-label">Lists</span>
          {lists.map(l => {
            const on = l.tickers.includes(item.ticker);
            return (
              <button key={l.id} type="button" className="wl-sheet-row" aria-pressed={on} onClick={() => onToggleList(l.id, item.ticker, !on)}>
                <span className={`wl-check${on ? " on" : ""}`} aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span>{l.name}
              </button>
            );
          })}
          <button type="button" className="wl-sheet-row" onClick={() => { onClose(); onNewList(); }}><Plus size={16} aria-hidden="true" /> New list…</button>
        </div>
        <div className="wl-sheet-group">
          <span className="wl-sheet-label">Your note</span>
          {editing ? (
            <form className="wl-sheet-note" onSubmit={e => { e.preventDefault(); onSaveNote(note.trim()); setEditing(false); }}>
              <input autoFocus aria-label="Note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Wait for Q3 results" className="input-base" />
              <button type="submit" className="btn-primary">Save</button>
            </form>
          ) : (
            <button type="button" className="wl-sheet-row" aria-label={item.note ? `Edit note for ${name}` : `Add a note for ${name}`} onClick={() => setEditing(true)}><NotebookPen size={16} aria-hidden="true" /> {item.note ? item.note : "Add a note"}</button>
          )}
        </div>
        <button type="button" className="wl-sheet-row danger" onClick={() => { onClose(); onRemove(); }}><X size={16} aria-hidden="true" /> {current ? `Remove from ${current.name}` : "Remove from watchlist"}</button>
      </div>
    </div>
  );
}

export default function WatchlistView({ onOpenStock, onOpenNews }) {
  const today = todayIst();
  const watched = useWatchlist();
  const [data, setData] = useState(null);
  const [live, setLive] = useState({});
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("today");
  const [sortDir, setSortDir] = useState("desc");
  const [alertTarget, setAlertTarget] = useState(null);
  const [sheet, setSheet] = useState(null); // the ticker whose ⋯ is open
  const [leaving, setLeaving] = useState(() => new Set());
  // the named lists (tabs); null is All
  const lists = useWatchLists();
  const myLevels = useMyLevels();
  const [activeList, setActiveList] = useState(savedList);
  const [dialog, setDialog] = useState(null); // { kind: "new", ticker? } | { kind: "rename", list }
  const pickList = id => { setActiveList(id); saveList(id); };
  const news = useWatchNews();
  const latest = latestBySymbol(news?.items);
  // Folds the card away, then removes it (index.css .wl-row.leaving)
  // (in a list's tab, out of that list only; in All, unstarred)
  const removeCard = ticker => {
    setLeaving(s => new Set(s).add(ticker));
    const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 150 : 200;
    const fromList = activeList;
    setTimeout(() => { if (fromList) toggleInList(fromList, ticker, false); else toggleWatch(ticker); setLeaving(s => { const n = new Set(s); n.delete(ticker); return n; }); }, ms);
  };

  const toggleInList = (id, ticker, on) => setInList(id, ticker, on);
  const createList = async (name, tickers) => {
    const list = await createWatchList(name, tickers);
    // from a card's "New list…": that stock goes in it too
    if (dialog?.ticker && !list.tickers.includes(dialog.ticker)) await setInList(list.id, dialog.ticker, true);
    pickList(list.id);
  };
  const renameList = (list, name) => renameWatchList(list.id, name);
  const deleteList = async list => {
    if (!window.confirm(`Delete the list "${list.name}"? Its stocks stay in your watchlist.`)) return;
    await deleteWatchList(list.id);
    pickList(null);
  };

  useEffect(() => {
    api.watchlist().then(d => {
      setData(d);
      primeWatchLists(d.lists ?? []);
      if (d.items.length) api.currentPrices(d.items.map(i => i.ticker)).then(setLive).catch(() => {});
    }).catch(e => setError(e.message));
  }, []);

  const saveNote = async (ticker, text) => {
    await api.setWatchNote(ticker, text);
    setData(d => ({ ...d, items: d.items.map(i => (i.ticker === ticker ? { ...i, note: text || null } : i)) }));
  };

  // Unstarring anywhere removes the card straight away
  const rows = new Map((data?.results ?? []).map(r => [r.symbol, withMyLevels(r, myLevels)]));
  const starredItems = (data?.items ?? []).filter(i => watched.has(i.ticker));
  // a list holds only starred stocks (unstarring anywhere takes it out of all)
  const shownLists = lists.map(l => ({ ...l, tickers: l.tickers.filter(t => watched.has(t)), count: l.tickers.filter(t => watched.has(t)).length }));
  const current = shownLists.find(l => l.id === activeList) ?? null;
  const items = current ? starredItems.filter(i => current.tickers.includes(i.ticker)) : starredItems;
  const quality = t => rows.get(t)?.research?.quality ?? -1;
  // the price shown: the live quote when there's one, else the last close
  const priceOf = t => live[t]?.price ?? rows.get(t)?.cmp ?? null;
  const rowOf = t => rows.get(t);
  const byNum = (f, a, b) => (f(a) ?? -Infinity) - (f(b) ?? -Infinity);
  const sorted = [...items].sort((a, b) => {
    let c = 0;
    if (sortBy === "today") c = byNum(i => rows.get(i.ticker)?.ret1d, a, b);
    else if (sortBy === "since") c = byNum(i => sinceAdded(i, priceOf(i.ticker)), a, b);
    else if (sortBy === "addedAt") c = String(a.addedAt).localeCompare(String(b.addedAt));
    else if (sortBy === "name") c = (rows.get(a.ticker)?.name || a.ticker).localeCompare(rows.get(b.ticker)?.name || b.ticker);
    else if (sortBy === "quality") c = quality(a.ticker) - quality(b.ticker);
    return sortDir === "desc" ? -c : c;
  });

  const SortPill = ({ id, label: text }) => {
    const active = sortBy === id;
    return (
      <button type="button" className={`wl-sort${active ? " on" : ""}`} aria-pressed={active}
        onClick={() => { if (active) setSortDir(d => (d === "desc" ? "asc" : "desc")); else { setSortBy(id); setSortDir("desc"); } }}>
        {text}{active && (sortDir === "desc" ? " ↓" : " ↑")}
      </button>
    );
  };

  const wrap = children => <div className="wl-page" style={{ padding: "8px var(--page-x) 16px", animation: "fadeUp 280ms cubic-bezier(0,0,0.2,1) backwards" }}>{children}</div>;

  if (error) return wrap(<div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--red-dim)", border: "1px solid var(--red-bdr)", color: "var(--red)", fontSize: 13 }}>Couldn't load your watchlist: {error}</div>);
  if (!data) return wrap(<div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--t3)" }}>Loading watchlist…</div>);
  if (starredItems.length === 0) {
    return wrap(
      <div style={{ textAlign: "center", padding: "56px 0", color: "var(--t3)", border: "1px dashed var(--bdr2)", borderRadius: 14, background: "var(--s1)" }}>
        <Star size={36} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14, color: "var(--t2)", fontWeight: 500, marginBottom: 4 }}>Watchlist is empty</p>
        <p style={{ fontSize: 12 }}>Star any stock in results or on its page to save it here</p>
      </div>
    );
  }

  const pricesDate = data.snapshot?.pricesDate ?? null;
  const sum = summaryLine(items, rowOf, priceOf);
  const look = needsALook(items, rowOf, priceOf, { today, pricesDate, news: news?.items });
  const open = sheet ? items.find(i => i.ticker === sheet) ?? starredItems.find(i => i.ticker === sheet) : null;
  const openRow = open ? rows.get(open.ticker) : null;

  return wrap(
    <>
      {sum && (
        <p className="wl-sum">
          <b>{sum.count}</b>
          {sum.today != null && <> · today <em className={sum.today >= 0 ? "up" : "down"}>{signedPct(sum.today)}</em> on average</>}
          {sum.since != null && <> · since added <em className={sum.since >= 0 ? "up" : "down"}>{signedPct(sum.since)}</em></>}
          {pricesDate && <> · NSE close {fmtDate(pricesDate)}</>}
        </p>
      )}
      <NeedsALook items={look} onOpen={onOpenStock} />
      <ListTabs lists={shownLists} active={current?.id ?? null} onPick={pickList} allCount={starredItems.length}
        onNew={() => setDialog({ kind: "new" })} onRename={list => setDialog({ kind: "rename", list })} onDelete={deleteList} />
      {current && items.length === 0 && <EmptyList list={current} starred={starredItems.map(i => ({ ticker: i.ticker, name: rows.get(i.ticker)?.name ?? i.ticker }))} onAdd={(id, t) => toggleInList(id, t, true)} />}
      {items.length > 0 && (
        <div className="wl-sorts" role="group" aria-label="Sort">
          <SortPill id="today" label="Today" />
          <SortPill id="since" label="Since added" />
          <SortPill id="name" label="Name" />
          <SortPill id="quality" label="Quality" />
          <SortPill id="addedAt" label="Added" />
        </div>
      )}

      {items.length > 0 && (
        <ul className="wl-list">
          {sorted.map(item => {
            const r = rows.get(item.ticker);
            const price = priceOf(item.ticker);
            const note = rowNote(item, r, price, { today, level: levelStatus(price, r), nextEvent: nextEvent(r, today) });
            return (
              <WatchRow key={item.ticker} item={item} r={r} price={price} note={note} leaving={leaving.has(item.ticker)}
                onOpen={onOpenStock} onMore={() => setSheet(item.ticker)} />
            );
          })}
        </ul>
      )}
      {items.length > 0 && <p className="wl-hint">Tap a company to open it · hold it, or ⋯, for an alert, lists, a note, or to remove it</p>}

      {onOpenNews && <WatchNews data={news} onOpenNews={onOpenNews} />}

      {open && (
        <RowSheet name={cardName(openRow?.name ?? open.ticker)} item={open} lists={shownLists} current={current}
          onClose={() => setSheet(null)} onOpen={() => onOpenStock(open.ticker)}
          onAlert={() => setAlertTarget({ symbol: open.ticker, name: openRow?.name ?? open.ticker, cmp: priceOf(open.ticker), p1: openRow?.safeBuyPrice, p2: openRow?.p2, p3: openRow?.p3 })}
          onToggleList={toggleInList} onNewList={() => setDialog({ kind: "new", ticker: open.ticker })}
          onSaveNote={text => saveNote(open.ticker, text)} onRemove={() => removeCard(open.ticker)} />
      )}
      {alertTarget && <CreateAlertModal stock={alertTarget} onClose={() => setAlertTarget(null)} />}
      {dialog && (
        <ListNameDialog title={dialog.kind === "rename" ? "Rename list" : "New list"} initial={dialog.kind === "rename" ? dialog.list.name : ""} suggest={dialog.kind === "new"}
          lists={dialog.kind === "rename" ? shownLists.filter(l => l.id !== dialog.list.id) : shownLists}
          starred={starredItems.map(i => ({ ticker: i.ticker, sector: rows.get(i.ticker)?.sector ?? null }))}
          onSave={(n, tickers) => (dialog.kind === "rename" ? renameList(dialog.list, n) : createList(n, tickers))}
          onClose={() => setDialog(null)} />
      )}
    </>
  );
}
