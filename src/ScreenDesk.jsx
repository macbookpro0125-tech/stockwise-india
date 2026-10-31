import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import PriceChartPanel from "./PriceChartPanel.jsx";
import PeersPanel from "./PeersPanel.jsx";
import { QualityBadge } from "./ResearchBadges.jsx";
import { cardName } from "./stockName.js";

// The Desk (DeskView.jsx, 31 Oct 2026, asked for "this kind of work,
// better"): the screen's companies down the left, the one picked charted in
// the middle, its business, price and peers on the right — one click or ↑/↓
// moves all three. Each row carries both scores, the price's strength and the
// business's quality, so a strong price on a weak business shows at a glance.

export const v = (r, id) => r?.values?.[id] ?? r?.[id] ?? null;
export const quality = r => r?.research?.quality ?? null;
const fromFair = r => (r?.fv25 > 0 && r?.cmp > 0 ? (r.cmp / r.fv25 - 1) * 100 : null);

// Quick views over the list (near highs and pullbacks are patterns, below)
const VIEWS = [
  { id: "all", label: "All", test: () => true },
  { id: "both", label: "Strong price + business", test: r => v(r, "priceStrength") >= 70 && quality(r) >= 70 },
  { id: "strong", label: "Strongest prices", test: r => v(r, "priceStrength") >= 80 },
  { id: "weak", label: "Under its 200-day average", test: r => v(r, "vsSma200") < 0 },
  { id: "value", label: "Below fair value", test: r => fromFair(r) != null && fromFair(r) < 0 },
];
const SORTS = [
  { id: "screen", label: "Screen order", key: null },
  { id: "strength", label: "Price strength", key: r => v(r, "priceStrength") },
  { id: "quality", label: "Quality", key: quality },
  { id: "day", label: "Today's move", key: r => r.ret1d },
  { id: "m3", label: "3-month return", key: r => v(r, "ret3m") },
];

export const pct = (x, dp = 1) => (x == null ? "—" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(dp)}%`);
export const tone = x => (x == null ? "" : x > 0 ? "up" : x < 0 ? "down" : "");
export const price = x => (x == null ? "—" : `₹${x.toLocaleString("en-IN", { maximumFractionDigits: x < 100 ? 2 : 1 })}`);
const fairWords = d => (d == null ? "—" : Math.abs(d) < 3 ? "Close to it" : `${Math.round(Math.abs(d))}% ${d < 0 ? "below" : "above"}`);
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const keep = (k, x) => { try { localStorage.setItem(k, x); } catch {} };

// A score as a small coloured box: green from 70, amber from 40
export function Score({ value, title }) {
  if (value == null) return <span className="desk-score none" title={title}>—</span>;
  const n = Math.round(value);
  return <span className={`desk-score ${n >= 70 ? "hi" : n >= 40 ? "mid" : "lo"}`} title={title}>{n}</span>;
}

export const STAGE_WORDS = { advancing: "Advancing", topping: "Topping", declining: "Declining", basing: "Basing" };

// market: the day's stages and patterns (api.deskMarket), or null while it loads
export default function ScreenDesk({ rows = [], loading, onOpenStock, empty = "No companies in this list.", market = null }) {
  const [view, setView] = useState(() => read("deskView", "all"));
  const [sort, setSort] = useState(() => read("deskSort", "screen"));
  const [side, setSide] = useState(() => read("deskSide", "business"));
  const [pattern, setPattern] = useState(null);
  const stageOf = sym => market?.bySymbol?.[sym]?.stage ?? null;
  const has = (sym, id) => !!market?.bySymbol?.[sym]?.setups?.includes(id);
  useEffect(() => keep("deskView", view), [view]);
  useEffect(() => keep("deskSort", sort), [sort]);
  useEffect(() => keep("deskSide", side), [side]);

  const counts = useMemo(() => Object.fromEntries(VIEWS.map(x => [x.id, rows.filter(x.test).length])), [rows]);
  const inView = useMemo(() => rows.filter((VIEWS.find(x => x.id === view) ?? VIEWS[0]).test), [rows, view]);
  const patternCounts = useMemo(() => Object.fromEntries((market?.setupInfo ?? []).map(p => [p.id, inView.filter(r => has(r.symbol, p.id)).length])), [inView, market]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    const shown = pattern ? inView.filter(r => has(r.symbol, pattern)) : inView;
    const key = SORTS.find(s => s.id === sort)?.key;
    return key ? [...shown].sort((a, b) => (key(b) ?? -Infinity) - (key(a) ?? -Infinity)) : shown;
  }, [inView, pattern, sort, market]); // eslint-disable-line react-hooks/exhaustive-deps

  const [picked, setPicked] = useState(null);
  const current = list.find(r => r.symbol === picked) ?? list[0] ?? null;
  const at = current ? list.indexOf(current) : -1;

  // ↑/↓ walk the list, Enter opens the company's full page
  const listRef = useRef(null);
  const onKey = e => {
    if (!list.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setPicked(list[Math.min(list.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))].symbol);
    } else if (e.key === "Enter" && current) onOpenStock?.(current.symbol);
  };
  useEffect(() => {
    if (!current) return;
    listRef.current?.querySelector(`[data-sym="${CSS.escape(current.symbol)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current?.symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !rows.length) return <div className="desk-empty" role="status">Loading the screen…</div>;
  if (!rows.length) return <div className="desk-empty">{empty}</div>;

  const r = current;
  const fv = fromFair(r);
  return (
    <div className="desk">
      <div className="desk-views" role="group" aria-label="Quick views">
        <span className="desk-row-label">View</span>
        {VIEWS.map(x => (
          <button key={x.id} type="button" className="desk-chip" aria-pressed={view === x.id} disabled={!counts[x.id] && view !== x.id} onClick={() => setView(x.id)}>
            {x.label} <span>{counts[x.id].toLocaleString("en-IN")}</span>
          </button>
        ))}
      </div>
      {market?.setupInfo && <div className="desk-views" role="group" aria-label="Price patterns">
        <span className="desk-row-label">Pattern</span>
        {market.setupInfo.map(p => (
          <button key={p.id} type="button" className="desk-chip" title={p.about} aria-pressed={pattern === p.id} disabled={!patternCounts[p.id] && pattern !== p.id} onClick={() => setPattern(v => (v === p.id ? null : p.id))}>
            {p.label} <span>{patternCounts[p.id] ?? 0}</span>
          </button>
        ))}
      </div>}

      <div className="desk-grid">
        <section className="desk-list" aria-label="Companies">
          <div className="desk-list-head">
            <span>{list.length.toLocaleString("en-IN")} {list.length === 1 ? "company" : "companies"}</span>
            <label>Sort <select value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          </div>
          <div className="desk-cols" aria-hidden="true"><span>Company</span><span>Price</span><span title="Price strength, 1–99">Str</span><span title="Quality score, out of 100">Qual</span></div>
          <ul ref={listRef} role="listbox" tabIndex={0} aria-label="Companies: up and down arrows move, Enter opens" aria-activedescendant={r ? `desk-${r.symbol}` : undefined} onKeyDown={onKey}>
            {list.map(x => (
              <li key={x.symbol} id={`desk-${x.symbol}`} data-sym={x.symbol} role="option" aria-selected={x === r} onClick={() => setPicked(x.symbol)} onDoubleClick={() => onOpenStock?.(x.symbol)}>
                <span className="desk-name"><b>{stageOf(x.symbol) && <i className={`desk-stage-dot ${stageOf(x.symbol)}`} title={STAGE_WORDS[stageOf(x.symbol)]} />}{x.symbol}</b><small>{cardName(x.name)}</small></span>
                <span className="desk-price">{price(x.cmp)}<small className={tone(x.ret1d)}>{pct(x.ret1d, 2)}</small></span>
                <Score value={v(x, "priceStrength")} title="Price strength, 1–99" />
                <Score value={quality(x)} title="Quality score, out of 100" />
              </li>
            ))}
            {!list.length && <li className="desk-none">None in this view.</li>}
          </ul>
          <p className="desk-hint">↑ ↓ to move · Enter for the full page{pattern ? <> · <button type="button" className="desk-link" onClick={() => setPattern(null)}>Clear pattern</button></> : null}</p>
        </section>

        <section className="desk-main" aria-label="Chart">
          {r && <>
            <header className="desk-head">
              <div className="desk-title">
                <h2>{cardName(r.name)}</h2>
                <span>NSE: {r.symbol}{r.sector ? ` · ${r.sector}` : ""}</span>
                {stageOf(r.symbol) && <div className="desk-tags">
                  <span className={`desk-stage ${stageOf(r.symbol)}`} title={market.stageInfo?.find(s => s.id === stageOf(r.symbol))?.about}>{STAGE_WORDS[stageOf(r.symbol)]}</span>
                  {(market.bySymbol[r.symbol].setups ?? []).map(id => { const p = market.setupInfo?.find(x => x.id === id); return p ? <span key={id} className="desk-tag" title={p.about}>{p.label}</span> : null; })}
                </div>}
              </div>
              <div className="desk-quote">
                <b>{price(r.cmp)}</b> <span className={tone(r.ret1d)}>{pct(r.ret1d, 2)}</span>
                {v(r, "downFrom52wHigh") != null && <small>{v(r, "downFrom52wHigh") < 0.5 ? "at its 52-week high" : `${v(r, "downFrom52wHigh").toFixed(1)}% under its 52-week high`}</small>}
              </div>
              <button type="button" className="btn-ghost desk-open" onClick={() => onOpenStock?.(r.symbol)}>Full page <ArrowUpRight size={14} /></button>
            </header>
            <PriceChartPanel key={r.symbol} symbol={r.symbol} name={r.name} levels={r.fv25 ? { fv25: r.fv25 } : null} />
            <dl className="desk-strip">
              <div><dt>1 month</dt><dd className={tone(v(r, "ret1m"))}>{pct(v(r, "ret1m"))}</dd></div>
              <div><dt>3 months</dt><dd className={tone(v(r, "ret3m"))}>{pct(v(r, "ret3m"))}</dd></div>
              <div><dt>1 year</dt><dd className={tone(v(r, "ret1y"))}>{pct(v(r, "ret1y"))}</dd></div>
              <div><dt>Price strength</dt><dd>{v(r, "priceStrength") ?? "—"}</dd></div>
              <div><dt>Quality</dt><dd>{quality(r) != null ? Math.round(quality(r)) : "—"}</dd></div>
              <div><dt>Against fair value</dt><dd className={fv == null ? "" : fv < 0 ? "up" : "down"}>{fairWords(fv)}</dd></div>
            </dl>
          </>}
        </section>

        <aside className="desk-side" aria-label="About this company">
          <div className="desk-tabs" role="tablist">
            {[["business", "Business"], ["price", "Price"], ["peers", "Peers"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={side === id} onClick={() => setSide(id)}>{label}</button>
            ))}
          </div>
          {r && side === "business" && <Business r={r} />}
          {r && side === "price" && <PriceFacts r={r} stage={stageOf(r.symbol)} stageInfo={market?.stageInfo} />}
          {r && side === "peers" && <div className="desk-peers"><PeersPanel symbol={r.symbol} onAnalyze={onOpenStock} /></div>}
        </aside>
      </div>
    </div>
  );
}

const Row = ({ label, children, hint }) => <div className="desk-row"><dt title={hint}>{label}</dt><dd>{children}</dd></div>;
const num = (x, dp = 1) => (x == null ? "—" : x.toLocaleString("en-IN", { maximumFractionDigits: dp }));

export function Business({ r }) {
  const fv = fromFair(r);
  return (
    <dl className="desk-facts">
      <div className="desk-big"><QualityBadge research={r.research} size={13} /><span>{quality(r) != null ? "Quality score, from its own filings" : "Not scored yet"}</span></div>
      <Row label="Against fair value" hint="Today's fair value: normalized earnings at the company's own usual P/E">{fv == null ? "—" : <span className={fv < 0 ? "up" : "down"}>{fairWords(fv)}</span>}</Row>
      <Row label="Fair value">{price(r.fv25)}</Row>
      <Row label="P/E">{r.pe > 0 ? num(r.pe) : "—"}</Row>
      <Row label="ROCE">{r.roce != null ? `${num(r.roce)}%` : "—"}</Row>
      <Row label="ROE">{r.roe != null ? `${num(r.roe)}%` : "—"}</Row>
      <Row label="Debt to equity">{num(r.debtToEquity, 2)}</Row>
      <Row label="Sales growth, 3 years">{pct(r.salesGrowth3y)}</Row>
      <Row label="Profit growth, 5 years">{pct(r.profitGrowth5y)}</Row>
      <Row label="Promoters hold">{r.promoterPct != null ? `${num(r.promoterPct)}%` : "—"}</Row>
      <Row label="Pledged">{r.pledgedPct != null ? `${num(r.pledgedPct)}%` : "—"}</Row>
      <Row label="Market cap">{r.marketCapCr != null ? `₹${num(r.marketCapCr, 0)} cr` : "—"}</Row>
      {r.nextResults && <Row label="Next results">{new Date(`${r.nextResults}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}</Row>}
    </dl>
  );
}

export function PriceFacts({ r, stage, stageInfo }) {
  const lo = r.low52w, hi = r.high52w;
  const at = lo > 0 && hi > lo && r.cmp ? Math.min(1, Math.max(0, (r.cmp - lo) / (hi - lo))) : null;
  const checks = [
    ["Above its 50-day average", v(r, "vsSma50") > 0],
    ["Above its 200-day average", v(r, "vsSma200") > 0],
    ["Within 25% of its 52-week high", v(r, "downFrom52wHigh") != null && v(r, "downFrom52wHigh") <= 25],
    ["Price strength 70 or more", v(r, "priceStrength") >= 70],
  ];
  return (
    <dl className="desk-facts">
      <div className="desk-big"><Score value={v(r, "priceStrength")} title="Price strength, 1–99" /><span>Price strength: the last year's return, recent months counted most, ranked against every NSE company</span></div>
      {at != null && <div className="desk-range" aria-label={`52-week range ${price(lo)} to ${price(hi)}`}>
        <div className="desk-range-bar"><i style={{ left: `${at * 100}%` }} /></div>
        <div className="desk-range-ends"><span>{price(lo)}</span><span>52-week range</span><span>{price(hi)}</span></div>
      </div>}
      {stage && <Row label="Trend stage" hint={stageInfo?.find(s => s.id === stage)?.about}><span className={`desk-stage ${stage}`}>{STAGE_WORDS[stage]}</span></Row>}
      <Row label="RSI, 14 days">{v(r, "rsi14") != null ? v(r, "rsi14").toFixed(0) : "—"}</Row>
      <Row label="Against 50-day average"><span className={tone(v(r, "vsSma50"))}>{pct(v(r, "vsSma50"))}</span></Row>
      <Row label="Against 200-day average"><span className={tone(v(r, "vsSma200"))}>{pct(v(r, "vsSma200"))}</span></Row>
      <Row label="Volatility, 1 year">{v(r, "volatility1y") != null ? `${v(r, "volatility1y").toFixed(0)}%` : "—"}</Row>
      <div className="desk-checks">
        {checks.map(([label, ok]) => <div key={label} className={ok ? "ok" : "no"}><span aria-hidden="true">{ok ? "✓" : "–"}</span>{label}</div>)}
      </div>
    </dl>
  );
}
