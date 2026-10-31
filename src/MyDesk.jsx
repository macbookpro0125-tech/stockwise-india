import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, X, Pencil, Check } from "lucide-react";
import { api } from "./api.js";
import PriceChartPanel from "./PriceChartPanel.jsx";
import PeersPanel from "./PeersPanel.jsx";
import { cardName } from "./stockName.js";
import { v, quality, pct, tone, price, Score, STAGE_WORDS, Business, PriceFacts } from "./ScreenDesk.jsx";

// My desk (31 Oct 2026, step 3): the Desk's pieces as cards you choose and
// arrange — one, two or three columns wide — kept with your account
// (server/desk-layout.js). Every card follows one picked company: pick it in
// the list, your watchlist, the results or the patterns, and the chart, the
// business, the price and the peers all turn to it.

export const CARDS = [
  { kind: "list", label: "Company list", about: "The list picked at the top; a click picks a company", w: 1 },
  { kind: "chart", label: "Chart", about: "The picked company's price chart", w: 2 },
  { kind: "business", label: "Business", about: "Quality, fair value, returns on capital, debt, growth", w: 1 },
  { kind: "price", label: "Price", about: "Trend stage, 52-week range, averages, RSI, trend checks", w: 1 },
  { kind: "peers", label: "Peers", about: "Companies like the picked one", w: 1 },
  { kind: "mood", label: "Market mood", about: "How many companies are in each stage of their trend", w: 3 },
  { kind: "patterns", label: "Patterns in the list", about: "Which companies in the list show each price pattern", w: 1 },
  { kind: "watchlist", label: "Watchlist", about: "Your starred companies", w: 1 },
  { kind: "results", label: "Results this week", about: "Who reports in the next days", w: 1 },
  { kind: "notes", label: "Notes", about: "Your own words, kept with the layout", w: 1 },
];
const SUGGESTED = [
  { kind: "mood", w: 3 }, { kind: "list", w: 1 }, { kind: "chart", w: 2 },
  { kind: "business", w: 1 }, { kind: "price", w: 1 }, { kind: "peers", w: 1 },
];
const label = kind => CARDS.find(c => c.kind === kind)?.label ?? kind;
const newId = kind => `${kind}-${Math.random().toString(36).slice(2, 8)}`;

export default function MyDesk({ rows = [], market, onOpenStock, MoodBar }) {
  const [layout, setLayout] = useState(null); // null: loading; { cards }
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [picked, setPicked] = useState(null);
  const [watch, setWatch] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => { api.deskLayout().then(d => setLayout(d.layout ?? { cards: [] })).catch(() => setLayout({ cards: [] })); }, []);
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
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= cards.length) return; const l = [...cards]; [l[i], l[j]] = [l[j], l[i]]; setCards(l); };
  const add = (kind, w) => { setCards([...cards, { id: newId(kind), kind, w: w ?? CARDS.find(c => c.kind === kind)?.w ?? 1 }]); setAdding(false); };

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

  return (
    <div className="md">
      <div className="md-bar">
        {r && <span className="md-picked">Following <b>{cardName(r.name)}</b>{stage ? <span className={`desk-stage ${stage}`}>{STAGE_WORDS[stage]}</span> : null}</span>}
        <span className="md-save" aria-live="polite">{saveState}</span>
        {cards.length > 0 && <button type="button" className="btn-ghost md-btn" onClick={() => setAdding(true)}><Plus size={14} /> Add card</button>}
        {cards.length > 0 && <button type="button" className={editing ? "btn-primary md-btn" : "btn-ghost md-btn"} aria-pressed={editing} onClick={() => setEditing(e => !e)}>
          {editing ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Arrange</>}
        </button>}
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

      <div className={`md-grid${editing ? " editing" : ""}`}>
        {cards.map((c, i) => (
          <section key={c.id} className="md-card" style={{ "--w": c.w }} aria-label={label(c.kind)}>
            <header className="md-card-head">
              <h3>{label(c.kind)}</h3>
              {editing && <div className="md-tools">
                <button type="button" className="md-icon" aria-label={`Move ${label(c.kind)} earlier`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft size={14} /></button>
                <button type="button" className="md-icon" aria-label={`Move ${label(c.kind)} later`} disabled={i === cards.length - 1} onClick={() => move(i, 1)}><ArrowRight size={14} /></button>
                <span className="md-width" role="group" aria-label={`${label(c.kind)} width`}>
                  {[1, 2, 3].map(w => <button key={w} type="button" aria-pressed={c.w === w} onClick={() => setCards(cards.map(x => (x.id === c.id ? { ...x, w } : x)))}>{w}</button>)}
                </span>
                <button type="button" className="md-icon" aria-label={`Remove ${label(c.kind)}`} onClick={() => setCards(cards.filter(x => x.id !== c.id))}><X size={14} /></button>
              </div>}
            </header>
            <div className="md-card-body">{body(c)}</div>
          </section>
        ))}
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
