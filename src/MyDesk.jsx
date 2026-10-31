import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { COLS, SIZES, compact, placeNew, clampCard, fromOld } from "./deskGrid.js";
import { api } from "./api.js";
import PriceChartPanel from "./PriceChartPanel.jsx";
import PeersPanel from "./PeersPanel.jsx";
import { cardName } from "./stockName.js";
import { v, quality, pct, tone, price, Score, STAGE_WORDS, Business, PriceFacts } from "./ScreenDesk.jsx";

// My desk (31 Oct 2026, step 3): the Desk's pieces as cards you choose and
// arrange anywhere, at any size (deskGrid.js) — kept with your account
// (server/desk-layout.js). Every card follows one picked company: pick it in
// the list, your watchlist, the results or the patterns, and the chart, the
// business, the price and the peers all turn to it.

export const CARDS = [
  { kind: "list", label: "Company list", about: "The list picked at the top; a click picks a company" },
  { kind: "chart", label: "Chart", about: "The picked company's price chart" },
  { kind: "business", label: "Business", about: "Quality, fair value, returns on capital, debt, growth" },
  { kind: "price", label: "Price", about: "Trend stage, 52-week range, averages, RSI, trend checks" },
  { kind: "peers", label: "Peers", about: "Companies like the picked one" },
  { kind: "mood", label: "Market mood", about: "How many companies are in each stage of their trend" },
  { kind: "patterns", label: "Patterns in the list", about: "Which companies in the list show each price pattern" },
  { kind: "watchlist", label: "Watchlist", about: "Your starred companies" },
  { kind: "results", label: "Results this week", about: "Who reports in the next days" },
  { kind: "notes", label: "Notes", about: "Your own words, kept with the layout" },
];
const SUGGESTED = [
  { kind: "mood", x: 0, y: 0, w: 12, h: 4 }, { kind: "list", x: 0, y: 4, w: 3, h: 20 }, { kind: "chart", x: 3, y: 4, w: 6, h: 20 },
  { kind: "business", x: 9, y: 4, w: 3, h: 20 }, { kind: "price", x: 0, y: 24, w: 6, h: 14 }, { kind: "peers", x: 6, y: 24, w: 6, h: 14 },
];
const label = kind => CARDS.find(c => c.kind === kind)?.label ?? kind;
const newId = kind => `${kind}-${Math.random().toString(36).slice(2, 8)}`;
const ROW = 30, GAP = 12;

export default function MyDesk({ rows = [], market, onOpenStock, MoodBar }) {
  const [layout, setLayout] = useState(null); // null: loading; { cards }
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [picked, setPicked] = useState(null);
  const [watch, setWatch] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => { api.deskLayout().then(d => setLayout({ cards: fromOld(d.layout?.cards ?? []) })).catch(() => setLayout({ cards: [] })); }, []);
  const kinds = new Set((layout?.cards ?? []).map(c => c.kind));
  useEffect(() => { if (kinds.has("watchlist") && !watch) api.watchlist().then(d => setWatch(d.results ?? [])).catch(() => setWatch([])); }, [kinds.has("watchlist")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (kinds.has("results") && !results) api.resultsWeek().then(setResults).catch(() => setResults({ days: [] })); }, [kinds.has("results")]); // eslint-disable-line react-hooks/exhaustive-deps

  // kept a moment after the last change, so a run of moves is one save
  const timer = useRef(null);
  const change = next => {
    setLayout(next);
    setSaveState("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => api.saveDeskLayout(next).then(() => setSaveState("Saved")).catch(e => setSaveState(e?.message || "Not saved")), 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const cards = layout?.cards ?? [];
  const setCards = list => change({ cards: list });
  const add = kind => { setCards(compact([...cards, placeNew(cards, { id: newId(kind), kind, ...SIZES[kind] })])); setAdding(false); };

  // ── the grid: its width in pixels, and a card's box from its cells ──
  const gridRef = useRef(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout != null]); // eslint-disable-line react-hooks/exhaustive-deps
  const colW = (width - GAP * (COLS - 1)) / COLS;
  // too narrow for columns: the cards one under another, in their order, at full width
  const narrow = width < 640;
  const box = c => ({ left: c.x * (colW + GAP), top: c.y * (ROW + GAP), width: c.w * colW + (c.w - 1) * GAP, height: c.h * ROW + (c.h - 1) * GAP });

  // ── dragging: the card follows the pointer exactly; where it would land
  // shows as a shape behind it, and the others make room as it goes ──
  const [drag, setDrag] = useState(null); // { id, mode, dx, dy, preview }
  const startDrag = (e, c, mode) => {
    if (e.button !== 0 || drag || narrow) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, orig = { ...c }, before = cards;
    let preview = before, started = false, ended = false;
    // the move and the release are heard on the window, so a fast drag, a
    // release outside the card or a lost capture still ends it
    const onMove = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      // a few pixels before it lifts, so a click stays a click
      if (!started && Math.hypot(dx, dy) < 4) return;
      started = true;
      const cell = mode === "move"
        ? { ...orig, x: orig.x + Math.round(dx / (colW + GAP)), y: orig.y + Math.round(dy / (ROW + GAP)) }
        : { ...orig, w: orig.w + Math.round(dx / (colW + GAP)), h: orig.h + Math.round(dy / (ROW + GAP)) };
      preview = compact(before.map(x => (x.id === c.id ? clampCard(cell) : x)), c.id);
      setDrag({ id: c.id, mode, dx, dy, preview });
    };
    const end = cancel => {
      if (ended) return;
      ended = true;
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      window.removeEventListener("blur", onCancel);
      window.removeEventListener("keydown", onEsc, true);
      setDrag(null);
      if (!cancel && started && preview !== before) setCards(compact(preview));
    };
    const onUp = () => end(false);
    const onCancel = () => end(true);
    const onEsc = ev => { if (ev.key === "Escape") end(true); };
    // in the capture phase, before anything inside a card (the chart stops
    // the release on its way up) can keep it from us; mouseup as well, in
    // case a pointerup never comes
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    window.addEventListener("blur", onCancel);
    window.addEventListener("keydown", onEsc, true);
  };
  // the keyboard: arrows move the card a cell, with Shift they resize it
  const onKey = (e, c) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || narrow) return;
    e.preventDefault();
    const at = clampCard(e.shiftKey ? { ...c, w: c.w + d[0], h: c.h + d[1] } : { ...c, x: c.x + d[0], y: c.y + d[1] });
    setCards(compact(cards.map(x => (x.id === c.id ? at : x)), c.id));
  };

  // the picked company's figures, from the list or the watchlist
  const known = useMemo(() => new Map([...(watch ?? []), ...rows].map(r => [r.symbol, r])), [rows, watch]);
  const sym = picked ?? rows[0]?.symbol ?? null;
  const r = sym ? known.get(sym) : null;
  const stage = sym ? market?.bySymbol?.[sym]?.stage ?? null : null;

  if (!layout) return <div className="desk-empty" role="status">Loading your desk…</div>;

  const body = c => {
    switch (c.kind) {
      case "list": return <Companies rows={rows} market={market} picked={sym} onPick={setPicked} onOpenStock={onOpenStock} />;
      case "watchlist": return watch == null ? <p className="md-quiet">Loading…</p> : <Companies rows={watch} market={market} picked={sym} onPick={setPicked} onOpenStock={onOpenStock} empty="Star a company to see it here." />;
      case "chart": return sym ? <PriceChartPanel key={sym} symbol={sym} name={r?.name ?? sym} levels={r?.fv25 ? { fv25: r.fv25 } : null} /> : <Pick />;
      case "business": return r ? <Business r={r} /> : <Pick />;
      case "price": return r ? <PriceFacts r={r} stage={stage} stageInfo={market?.stageInfo} /> : <Pick />;
      case "peers": return sym ? <PeersPanel symbol={sym} onAnalyze={onOpenStock} /> : <Pick />;
      case "mood": return <MoodBar market={market} />;
      case "patterns": return <Patterns rows={rows} market={market} onPick={setPicked} />;
      case "results": return <Results data={results} onPick={setPicked} />;
      case "notes": return <textarea className="md-notes" aria-label="Notes" maxLength={2000} placeholder="Your notes: what you're watching, and why" value={c.text ?? ""}
        onChange={e => setCards(cards.map(x => (x.id === c.id ? { ...x, text: e.target.value } : x)))} />;
      default: return null;
    }
  };

  const stacked = cs => { let y = 0; return [...cs].sort((a, b) => a.y - b.y || a.x - b.x).map(c => { const at = { ...c, x: 0, w: COLS, y }; y += c.h; return at; }); };
  const shown = narrow ? stacked(cards) : drag?.preview ?? cards;
  const rowsUsed = Math.max(0, ...shown.map(c => c.y + c.h));
  const ghost = drag && shown.find(c => c.id === drag.id);
  return (
    <div className="md">
      <div className="md-bar">
        {r && <span className="md-picked">Following <b>{cardName(r.name)}</b>{stage ? <span className={`desk-stage ${stage}`}>{STAGE_WORDS[stage]}</span> : null}</span>}
        <span className="md-save" aria-live="polite">{saveState}</span>
        {cards.length > 0 && !narrow && <span className="md-tip">Drag a card by its title to move it, by its corner to resize</span>}
        {cards.length > 0 && <button type="button" className="desk-open md-btn" onClick={() => setAdding(true)}><Plus size={14} /> Add card</button>}
      </div>

      {!cards.length && (
        <div className="md-start">
          <h2>Your desk is empty</h2>
          <p>Pick the cards you want, or <button type="button" className="desk-link" onClick={() => setCards(SUGGESTED.map(c => ({ ...c, id: newId(c.kind) })))}>start with a suggested layout</button> (market mood, list, chart, business, price and peers).</p>
          <Palette onAdd={add} />
        </div>
      )}

      {adding && (
        <div className="md-add" role="dialog" aria-label="Add a card">
          <div className="md-add-head"><b>Add a card</b><button type="button" className="md-icon" aria-label="Close" onClick={() => setAdding(false)}><X size={16} /></button></div>
          <Palette onAdd={add} />
        </div>
      )}

      <div ref={gridRef} className={`md-grid${drag ? " dragging" : ""}`} style={{ height: rowsUsed ? rowsUsed * (ROW + GAP) - GAP : 0 }}>
        {ghost && <div className="md-ghost" style={box(ghost)} aria-hidden="true" />}
        {shown.map(c => {
          const lifted = drag?.id === c.id;
          const orig = lifted ? cards.find(x => x.id === c.id) : c;
          const b = box(orig);
          const style = lifted
            ? (drag.mode === "move"
              ? { ...b, transform: `translate(${drag.dx}px, ${drag.dy}px)` }
              : { ...b, width: Math.max(colW * 2, b.width + drag.dx), height: Math.max(ROW * 3, b.height + drag.dy) })
            : box(c);
          return (
            <section key={c.id} className={`md-card${lifted ? " lifted" : ""}${narrow ? " fixed" : ""}`} style={style} aria-label={label(c.kind)}>
              <header className="md-card-head" onPointerDown={e => { if (!e.target.closest("button")) startDrag(e, c, "move"); }}>
                <span className="md-grip" role="button" tabIndex={0} aria-label={`Move or resize ${label(c.kind)}: arrow keys move it, Shift with arrow keys resizes it`} onKeyDown={e => onKey(e, c)}><GripVertical size={14} /></span>
                <h3>{label(c.kind)}</h3>
                <button type="button" className="md-icon md-remove" aria-label={`Remove ${label(c.kind)}`} onClick={() => setCards(compact(cards.filter(x => x.id !== c.id)))}><X size={14} /></button>
              </header>
              <div className="md-card-body">{body(c)}</div>
              <span className="md-resize" aria-hidden="true" onPointerDown={e => startDrag(e, c, "resize")} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Palette({ onAdd }) {
  return (
    <div className="md-palette">
      {CARDS.map(c => (
        <button key={c.kind} type="button" className="md-option" onClick={() => onAdd(c.kind)}>
          <b>{c.label}</b><span>{c.about}</span>
        </button>
      ))}
    </div>
  );
}

const Pick = () => <p className="md-quiet">Pick a company in a list card.</p>;

function Companies({ rows, market, picked, onPick, onOpenStock, empty = "No companies in this list." }) {
  if (!rows.length) return <p className="md-quiet">{empty}</p>;
  return (
    <ul className="md-list">
      {rows.slice(0, 300).map(x => {
        const st = market?.bySymbol?.[x.symbol]?.stage;
        return (
          <li key={x.symbol} aria-selected={x.symbol === picked}>
            <button type="button" onClick={() => onPick(x.symbol)} onDoubleClick={() => onOpenStock?.(x.symbol)}>
              <span className="desk-name"><b>{st && <i className={`desk-stage-dot ${st}`} title={STAGE_WORDS[st]} />}{x.symbol}</b><small>{cardName(x.name)}</small></span>
              <span className="desk-price">{price(x.cmp)}<small className={tone(x.ret1d)}>{pct(x.ret1d, 2)}</small></span>
              <Score value={v(x, "priceStrength")} title="Price strength, 1–99" />
              <Score value={quality(x)} title="Quality score, out of 100" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Patterns({ rows, market, onPick }) {
  if (!market?.setupInfo) return <p className="md-quiet">Loading…</p>;
  const inList = new Set(rows.map(r => r.symbol));
  return (
    <dl className="md-patterns">
      {market.setupInfo.map(p => {
        const syms = Object.entries(market.bySymbol).filter(([s, x]) => inList.has(s) && x.setups.includes(p.id)).map(([s]) => s);
        return (
          <div key={p.id}>
            <dt title={p.about}>{p.label} <span>{syms.length}</span></dt>
            <dd>{syms.length ? syms.slice(0, 12).map(s => <button key={s} type="button" className="desk-tag" onClick={() => onPick(s)}>{s}</button>) : <span className="md-quiet">None today</span>}{syms.length > 12 ? <span className="md-quiet"> +{syms.length - 12}</span> : null}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Results({ data, onPick }) {
  if (!data) return <p className="md-quiet">Loading…</p>;
  const days = (data.days ?? []).filter(d => d.count > 0);
  if (!days.length) return <p className="md-quiet">No results dates this week.</p>;
  return (
    <div className="md-results">
      {days.map(d => (
        <div key={d.date}>
          <h4>{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} <span>{d.count}</span></h4>
          <div>{d.companies.slice(0, 10).map(c => <button key={c.symbol} type="button" className="desk-tag" title={c.name} onClick={() => onPick(c.symbol)}>{c.symbol}</button>)}{d.count > 10 ? <span className="md-quiet"> +{d.count - 10}</span> : null}</div>
        </div>
      ))}
    </div>
  );
}
