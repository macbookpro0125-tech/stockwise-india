import { useEffect, useRef, useState } from "react";
import PriceChartPanel from "./PriceChartPanel.jsx";
import { api } from "./api.js";

// The Workspace's "List and chart" view on a computer (31 Oct 2026): the
// companies that match in a slim list, the one picked charted beside it, and
// its figures in plain words on the right — returns, where the price sits,
// how it's trading, the business. ↑ and ↓ move through the list.
const pct = (v, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);
const pts = v => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} pts`);
const times = v => (v == null ? "—" : `${v.toFixed(1)}×`);
const plain = (v, d = 1, unit = "") => (v == null ? "—" : `${v.toLocaleString("en-IN", { maximumFractionDigits: d })}${unit}`);
const tone = v => (v == null ? undefined : v > 0 ? "up" : v < 0 ? "down" : undefined);

function Fact({ label, value, signed, title }) {
  return (
    <div className="ws-fact" title={title}>
      <span>{label}</span>
      <b className={signed ? tone(signed) : undefined}>{value}</b>
    </div>
  );
}

function Facts({ symbol }) {
  const [state, setState] = useState({ symbol: null, m: null, error: null });
  useEffect(() => {
    let gone = false;
    setState(s => ({ ...s, error: null }));
    api.stock(symbol)
      .then(j => { if (!gone) setState({ symbol, m: j.metrics ?? null, date: j.close?.date ?? null, error: null }); })
      .catch(e => { if (!gone) setState({ symbol, m: null, error: e.message }); });
    return () => { gone = true; };
  }, [symbol]);
  const m = state.symbol === symbol ? state.m : null;
  if (state.error && state.symbol === symbol) return <p className="ws-note">Couldn't load this company's figures: {state.error}</p>;
  if (!m) return <div className="ws-facts-loading" aria-busy="true">Loading figures…</div>;
  return (
    <>
      <section className="ws-box" aria-label="Returns">
        <h3>Returns</h3>
        <div className="ws-grid">
          <Fact label="1 week" value={pct(m.ret1w)} signed={m.ret1w} />
          <Fact label="1 month" value={pct(m.ret1m)} signed={m.ret1m} />
          <Fact label="3 months" value={pct(m.ret3m)} signed={m.ret3m} />
          <Fact label="6 months" value={pct(m.ret6m)} signed={m.ret6m} />
          <Fact label="1 year" value={pct(m.ret1y)} signed={m.ret1y} />
          <Fact label="vs NIFTY, 3M" value={pts(m.ret3mVsNifty)} signed={m.ret3mVsNifty} title="The 3-month return minus NIFTY 50's" />
        </div>
      </section>
      <section className="ws-box" aria-label="Where the price is">
        <h3>Where the price is</h3>
        <div className="ws-grid">
          <Fact label="Price strength" value={m.priceStrength == null ? "—" : `${m.priceStrength}/99`}
            title="How the share price has done against every other company's over 3 (counted double), 6, 9 and 12 months, ranked 1–99. A ranking of the past, not a forecast." />
          <Fact label="From 52w high" value={m.downFrom52wHigh == null ? "—" : `−${m.downFrom52wHigh.toFixed(1)}%`} />
          <Fact label="vs 50-day" value={pct(m.vsSma50)} signed={m.vsSma50} title="Price against its 50-day average" />
          <Fact label="vs 200-day" value={pct(m.vsSma200)} signed={m.vsSma200} title="Price against its 200-day average" />
        </div>
      </section>
      <section className="ws-box" aria-label="Trading">
        <h3>Trading</h3>
        <div className="ws-grid">
          <Fact label="Volume ×avg" value={times(m.volVsAvg50)} title="The last day's volume against the 50 days before it" />
          <Fact label="Delivery" value={plain(m.delivery1d ?? m.delivery1m, 1, "%")} title={m.delivery1d != null ? "Share of the last day's trades taken as delivery" : "Delivery, 1-month average"} />
          <Fact label="Volatility" value={plain(m.volatility1y, 1, "%")} title="The yearly swing of daily moves" />
        </div>
      </section>
      <section className="ws-box" aria-label="The business">
        <h3>The business</h3>
        <div className="ws-grid">
          <Fact label="Quality" value={m.research?.quality == null ? "—" : `${Math.round(m.research.quality)}/100`} title="The quality score: the business, from its filings" />
          <Fact label="P/E" value={times(m.pe)} />
          <Fact label="ROCE" value={plain(m.roce, 1, "%")} />
        </div>
      </section>
      <p className="ws-note">{state.date ? `NSE prices as of ${new Date(`${state.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}. ` : ""}Figures from company filings. To research from, not advice.</p>
    </>
  );
}

export default function WorkspaceSplit({ matches, onOpenStock }) {
  const rows = matches ?? [];
  const [picked, setPicked] = useState(null);
  const listRef = useRef(null);
  // the first company until you pick one; a pick that leaves the list falls back to it
  const symbol = rows.some(r => r.symbol === picked) ? picked : rows[0]?.symbol ?? null;
  const at = rows.findIndex(r => r.symbol === symbol);
  const current = rows[at];
  const move = step => {
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + step))];
    if (!next) return;
    setPicked(next.symbol);
    listRef.current?.querySelector(`[data-sym="${CSS.escape(next.symbol)}"]`)?.scrollIntoView({ block: "nearest" });
  };
  if (!rows.length) return <p className="ws-note ws-empty">No companies match these filters.</p>;
  return (
    <div className="ws-split">
      <div className="ws-list" ref={listRef} role="listbox" aria-label="Companies that match" tabIndex={0}
        aria-activedescendant={symbol ? `ws-${symbol}` : undefined}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
          else if (e.key === "Enter" && symbol) onOpenStock?.(symbol);
        }}>
        <div className="ws-list-head" aria-hidden="true"><span>Company</span><span>Price</span><span>Day</span></div>
        {rows.map(r => (
          <div key={r.symbol} id={`ws-${r.symbol}`} data-sym={r.symbol} role="option" aria-selected={r.symbol === symbol} className="ws-row" onClick={() => setPicked(r.symbol)} title={r.name}>
            <span className="ws-sym">{r.symbol}</span>
            <span className="ws-num">{r.cmp == null ? "—" : r.cmp.toLocaleString("en-IN", { maximumFractionDigits: r.cmp >= 1000 ? 0 : 2 })}</span>
            <span className={`ws-num ${tone(r.ret1d) ?? ""}`}>{r.ret1d == null ? "—" : `${r.ret1d > 0 ? "+" : ""}${r.ret1d.toFixed(1)}%`}</span>
          </div>
        ))}
        <p className="ws-hint">↑ ↓ to move · Enter opens the company</p>
      </div>
      {current && (
        <div className="ws-chart">
          <div className="ws-chart-head">
            <h3>{current.name}</h3>
            <span className="ws-chart-sym">NSE: {current.symbol}{current.sector ? ` · ${current.sector}` : ""}</span>
            <button type="button" className="btn-ghost ws-open" onClick={() => onOpenStock?.(current.symbol)}>Open company page →</button>
          </div>
          <PriceChartPanel key={current.symbol} symbol={current.symbol} name={current.name} />
        </div>
      )}
      {current && <aside className="ws-facts" aria-label={`${current.name} in figures`}><Facts symbol={current.symbol} /></aside>}
    </div>
  );
}
