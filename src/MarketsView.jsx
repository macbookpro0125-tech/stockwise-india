import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, AreaSeries, ColorType } from "lightweight-charts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { MoodBar } from "./MoodBar.jsx";
import { navigate } from "./site.jsx";

// Markets, a page of its own (5 Nov 2026, "a market page, detailed"): the
// indices in a row to pick from, the one picked charted large with its returns
// and valuation, then the sectors ranked by the day, the market's mood and
// breadth, the biggest moves, and the week's results. All from the app's own
// data (explore.js, price-setups.js); nothing here is advice.

const num = v => (v == null ? "—" : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = v => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`);
const tone = v => (v == null ? "" : v >= 0 ? "up" : "down");
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
// a short badge for an index: "NIFTY Bank" → "BANK", "Nifty 50" → "50"
const badge = name => {
  const rest = String(name).replace(/^nifty\s*/i, "").replace(/\s*index$/i, "").trim();
  if (/^\d+$/.test(rest)) return rest;
  const words = rest.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map(w => w[0]).join("") : rest.slice(0, 4)).toUpperCase().slice(0, 4);
};
const RANGES = [["1M", 21], ["3M", 63], ["6M", 126], ["1Y", Infinity]];

function IndexChart({ days, closes, label }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !(closes?.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const up = closes.at(-1) >= closes[0], line = v(up ? "--green" : "--red");
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false },
      localization: { locale: "en-IN", priceFormatter: p => Math.round(p).toLocaleString("en-IN") },
      handleScroll: false, handleScale: false,
    });
    const m = /^#([0-9a-f]{6})$/i.exec(line), n = m ? parseInt(m[1], 16) : 0x808080;
    const rgba = a => `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    const series = chart.addSeries(AreaSeries, { lineColor: line, lineWidth: 2, topColor: rgba(0.24), bottomColor: rgba(0), priceLineVisible: true });
    series.setData(days.map((time, i) => ({ time, value: closes[i] })));
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(host.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [days, closes]);
  return <div ref={host} className="mk-chart" role="img" aria-label={label} />;
}

export default function MarketsView({ onOpenStock, onOpenTab }) {
  const [board, setBoard] = useState(null);
  const [pick, setPick] = useState("Nifty 50");
  const [detail, setDetail] = useState(null);
  const [range, setRange] = useState("1Y");
  const [period, setPeriod] = useState("1d");
  const [movers, setMovers] = useState(null);
  const [mood, setMood] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    api.explore().then(setBoard).catch(() => setBoard({ market: [], sectors: [] }));
    api.deskMarket().then(setMood).catch(() => {});
    api.resultsWeek().then(setResults).catch(() => {});
  }, []);
  useEffect(() => { setDetail(null); api.exploreIndex(pick).then(setDetail).catch(() => setDetail({ error: true })); }, [pick]);
  useEffect(() => { setMovers(null); api.movers(period).then(setMovers).catch(() => setMovers({ gainers: [], losers: [] })); }, [period]);

  const strip = useRef(null);
  const scroll = d => strip.current?.scrollBy({ left: d * strip.current.clientWidth * 0.8, behavior: "smooth" });
  const indices = board?.market ?? [];
  const sectors = useMemo(() => [...(board?.sectors ?? [])].filter(s => s.changePct != null).sort((a, b) => b.changePct - a.changePct), [board]);
  const widest = Math.max(1, ...sectors.map(s => Math.abs(s.changePct)));

  // the picked index's days for the range shown
  const shownDays = useMemo(() => {
    if (!detail?.days?.length) return null;
    const n = RANGES.find(r => r[0] === range)?.[1] ?? Infinity;
    const from = Math.max(0, detail.days.length - 1 - (n === Infinity ? detail.days.length : n));
    return { days: detail.days.slice(from), closes: detail.closes.slice(from) };
  }, [detail, range]);
  const rangeMove = shownDays && shownDays.closes.length > 1 ? (shownDays.closes.at(-1) / shownDays.closes[0] - 1) * 100 : null;
  const R = detail?.returns ?? {};

  return (
    <div className="mk">
      <header className="mk-head">
        <h1>Markets</h1>
        <p>{board?.asOf ? `NSE's indices, sectors and biggest moves at the close on ${day(board.asOf)}` : "NSE's indices, sectors and biggest moves"}</p>
      </header>

      {/* the indices: pick one, and it's charted below */}
      <section className="mk-section" aria-labelledby="mk-idx">
        <div className="mk-section-h">
          <h2 id="mk-idx">Indices</h2>
          <div className="mk-arrows">
            <button type="button" aria-label="Earlier indices" onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
            <button type="button" aria-label="More indices" onClick={() => scroll(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="mk-strip" ref={strip} role="tablist" aria-label="Pick an index">
          {!board && [0, 1, 2, 3].map(i => <span key={i} className="mk-pill mk-skel" />)}
          {indices.map(i => (
            <button key={i.name} type="button" role="tab" aria-selected={pick === i.name} className="mk-pill" onClick={() => setPick(i.name)}>
              <span className={`mk-badge ${tone(i.changePct)}`}>{badge(i.name)}</span>
              <span className="mk-pill-text">
                <b>{i.name}</b>
                <span><span className="mk-num">{num(i.close)}</span> <span className={`mk-chg ${tone(i.changePct)}`}>{pct(i.changePct)}</span></span>
              </span>
            </button>
          ))}
        </div>

        <div className="mk-card mk-index">
          <div className="mk-index-top">
            <div>
              <h3>{detail?.name ?? pick}</h3>
              <div className="mk-index-price">
                <b className="mk-num">{num(detail?.close)}</b>
                <span className={`mk-chg ${tone(detail?.changePct)}`}>{pct(detail?.changePct)} today</span>
                {rangeMove != null && <span className={`mk-chg ${tone(rangeMove)}`}>{pct(rangeMove)} over {range === "1Y" ? "the year" : range}</span>}
              </div>
            </div>
            <div className="mk-seg" role="group" aria-label="Range">
              {RANGES.map(([id]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{id}</button>)}
            </div>
          </div>
          {shownDays ? <IndexChart days={shownDays.days} closes={shownDays.closes} label={`${detail.name} over ${range}`} /> : <div className="mk-chart mk-skel" />}
          <dl className="mk-stats">
            {[["1 week", R.w1], ["1 month", R.m1], ["3 months", R.m3], ["6 months", R.m6], ["1 year", R.y1], ["3 years", R.y3], ["5 years", R.y5]].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd className={`mk-num ${tone(v)}`}>{pct(v)}</dd></div>
            ))}
            {detail?.pe != null && <div><dt>P/E</dt><dd className="mk-num">{num(detail.pe)}</dd></div>}
            {detail?.pb != null && <div><dt>P/B</dt><dd className="mk-num">{num(detail.pb)}</dd></div>}
            {detail?.divYield != null && <div><dt>Dividend yield</dt><dd className="mk-num">{num(detail.divYield)}%</dd></div>}
          </dl>
        </div>
      </section>

      <div className="mk-grid">
        {/* the sectors, best to worst on the day */}
        <section className="mk-card" aria-labelledby="mk-sec">
          <div className="mk-card-h"><h2 id="mk-sec">Sectors today</h2><button type="button" className="mk-link" onClick={() => onOpenTab?.("map")}>Market map</button></div>
          <ul className="mk-sectors">
            {sectors.map(s => (
              <li key={s.name}>
                <button type="button" onClick={() => setPick(s.name)} aria-label={`${s.name}, ${pct(s.changePct)}; chart it above`}>
                  <span className="mk-sec-name">{s.name.replace(/^Nifty\s*/i, "")}</span>
                  <span className="mk-sec-bar"><i className={tone(s.changePct)} style={{ width: `${(Math.abs(s.changePct) / widest) * 50}%`, [s.changePct >= 0 ? "left" : "right"]: "50%" }} /></span>
                  <span className={`mk-chg ${tone(s.changePct)}`}>{pct(s.changePct)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* the market's mood: how many are in each stage of their trend */}
        <section className="mk-card" aria-labelledby="mk-mood">
          <div className="mk-card-h"><h2 id="mk-mood">The market's trend</h2><button type="button" className="mk-link" onClick={() => onOpenTab?.("desk")}>Desk</button></div>
          <MoodBar market={mood} />
          {mood?.liquid > 0 && (
            <dl className="mk-breadth">
              <div><dt>Over their 50-day average</dt><dd className="mk-num">{Math.round(mood.above50)}%</dd></div>
              <div><dt>Over their 200-day average</dt><dd className="mk-num">{Math.round(mood.above200)}%</dd></div>
              {(mood.setupInfo ?? []).slice(0, 4).map(s => <div key={s.id}><dt title={s.about}>{s.label}</dt><dd className="mk-num">{mood.setups?.[s.id] ?? 0}</dd></div>)}
            </dl>
          )}
        </section>
      </div>

      {/* the biggest moves */}
      <section className="mk-card" aria-labelledby="mk-mov">
        <div className="mk-card-h">
          <h2 id="mk-mov">Biggest moves</h2>
          <div className="mk-seg" role="group" aria-label="Over">
            {[["1d", "Day"], ["1w", "Week"], ["1m", "Month"]].map(([id, l]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{l}</button>)}
          </div>
        </div>
        <div className="mk-movers">
          {[["Gainers", movers?.gainers], ["Losers", movers?.losers]].map(([title, list]) => (
            <div key={title}>
              <h3>{title}</h3>
              <ul>
                {!list && [0, 1, 2, 3, 4].map(i => <li key={i}><span className="mk-skel mk-row-skel" /></li>)}
                {(list ?? []).slice(0, 8).map(r => (
                  <li key={r.symbol}>
                    <button type="button" onClick={() => onOpenStock?.(r.symbol)}>
                      <CompanyLogo symbol={r.symbol} size={26} fallback={r.name} />
                      <span className="mk-who"><b>{cardName(r.name)}</b><small>{r.symbol}{r.sector ? ` · ${r.sector}` : ""}</small></span>
                      <span className="mk-num">₹{num(r.close)}</span>
                      <span className={`mk-chg ${tone(r.change)}`}>{pct(r.change)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {movers?.floorCr && <p className="mk-note">Companies worth ₹{movers.floorCr.toLocaleString("en-IN")} crore or more.</p>}
      </section>

      {/* the week's results */}
      {results?.days?.length > 0 && (
        <section className="mk-card" aria-labelledby="mk-res">
          <div className="mk-card-h"><h2 id="mk-res">Results this week</h2><button type="button" className="mk-link" onClick={() => navigate("/results-calendar")}>Calendar</button></div>
          <div className="mk-results">
            {results.days.filter(d => d.count > 0).slice(0, 5).map(d => (
              <div key={d.date}>
                <h3>{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} <span>{d.count}</span></h3>
                <ul>
                  {d.companies.slice(0, 6).map(c => <li key={c.symbol}><button type="button" onClick={() => onOpenStock?.(c.symbol)}>{cardName(c.name)}</button></li>)}
                </ul>
                {d.count > 6 && <small>+{d.count - 6} more</small>}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mk-note">NSE closing prices and the indices' own figures. A reading of the past, not advice.</p>
    </div>
  );
}
