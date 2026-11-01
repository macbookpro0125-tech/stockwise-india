import { useEffect, useRef, useState } from "react";
import { createChart, AreaSeries, ColorType } from "lightweight-charts";
import { ChevronRight, Plus } from "lucide-react";
import { api } from "./api.js";
import HowItWorks from "./HowItWorks.jsx";
import { ScreenIcon } from "./PhoneScreens.jsx";
import { navigate } from "./site.jsx";

// A computer's home once signed in (1 Nov 2026, the owner: "I want something
// good" of the hero and its bright cards): what's happened to the market and to
// your companies, then the screens. The same calm grouped boxes as a phone's
// Screeners; the whole list of screens, with their tools, stays underneath.
const num = n => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = n => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`);
const tone = n => (n == null ? "var(--t3)" : n >= 0 ? "var(--green)" : "var(--red)");
const day = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const short = s => String(s ?? "").replace(/ (Limited|Ltd\.?)$/i, "");
const WATCH_ROWS = 8, QUICK_SCREENS = 6;

// The market's last year, large, as the first thing in the summary. Our own
// index history: the Nifty 500's closes, kept with any company's prices.
function MarketChart({ closes }) {
  const host = useRef(null);
  useEffect(() => {
    if (!host.current || !(closes?.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const up = closes.at(-1)[1] >= closes[0][1], line = v(up ? "--green" : "--red");
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false }, localization: { locale: "en-IN" },
      handleScroll: false, handleScale: false,
    });
    const fill = `color-mix(in srgb, ${line} 22%, transparent)`;
    const series = chart.addSeries(AreaSeries, { lineColor: line, lineWidth: 2, topColor: fill, bottomColor: "transparent", priceLineVisible: false });
    series.setData(closes.map(([time, value]) => ({ time, value })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [closes]);
  return <div ref={host} className="td-chart" role="img" aria-label="The Nifty 500 over the last year" />;
}

export default function TodayHome({ visible = true, onOpenStock, onOpenTab, onPickScreen, onCreate, continueCard = null, newsTile = null, children }) {
  const [strip, setStrip] = useState(null);
  const [watch, setWatch] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [presets, setPresets] = useState([]);
  const [market, setMarket] = useState(null);
  useEffect(() => {
    api.marketStrip().then(setStrip).catch(() => {});
    api.publicResultsCalendar().then(setCalendar).catch(() => {});
    api.presets().then(p => setPresets(p ?? [])).catch(() => {});
    api.prices("RELIANCE", "1y").then(d => setMarket(d?.benchmark?.closes ?? null)).catch(() => {});
  }, []);
  // again on coming back: a company may have been starred on its page
  useEffect(() => {
    if (visible) api.watchlist().then(setWatch).catch(() => setWatch({ results: [] }));
  }, [visible]);

  const rows = watch?.results ?? [];
  const mine = new Set(rows.map(r => r.symbol));
  const moved = [...rows].sort((a, b) => Math.abs(b.ret1d ?? 0) - Math.abs(a.ret1d ?? 0)).slice(0, WATCH_ROWS);
  const under = rows.filter(r => r.fv25 > 0 && r.cmp > 0 && r.cmp < r.fv25).map(r => ({ r, by: (1 - r.cmp / r.fv25) * 100 })).sort((a, b) => b.by - a.by).slice(0, 3);
  const coming = (calendar?.days ?? []).slice(0, 3).map(d => {
    const yours = (d.companies ?? []).filter(c => mine.has(c.symbol));
    return { date: d.date, yours, count: d.count };
  });
  const seeAll = () => document.getElementById("all-screeners")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <div className="td-page">
      {/* The opening, on black whichever the theme: one line, one button, and a
          horizon of light, drawn here. Then the product, fading into the page. */}
      <section className="td-hero" aria-labelledby="td-hero-title">
        <div className="td-stars" aria-hidden="true" />
        <h2 id="td-hero-title">India's markets, read from the source.</h2>
        <p>Every NSE company, scored on what it files. Find the few worth your time.</p>
        <button type="button" className="td-cta" onClick={onCreate}>Start screening</button>
        <div className="td-horizon" aria-hidden="true" />
        <div className="td-shot">
          <img src="/screens/home-shot.jpg" alt="Jocular Insights listing companies that match a screen, with their quality scores" width="1280" height="800" />
          <button type="button" className="td-shot-pill" onClick={seeAll}>See every screener<ChevronRight size={15} aria-hidden="true" /></button>
        </div>
      </section>

      <div className="td-sheet">
    <div className="td">
      <div className="td-top">
        <div>
          <h2 className="td-title">Market summary</h2>
          <p className="td-sub">
            {strip?.asOf ? `Prices at NSE's close on ${day(strip.asOf)}` : "The market at its last close"}
            {rows.length > 0 && ` · ${rows.length} ${rows.length === 1 ? "company" : "companies"} on your watchlist`}
          </p>
        </div>
        <HowItWorks plain label="See how it works" />
      </div>

      <div className="td-grid td-summary">
        {market?.length > 1 && (
          <section className="td-box td-big" aria-label="Nifty 500">
            <div className="td-big-head">
              <span className="td-badge" aria-hidden="true">500</span>
              <div><h3>Nifty 500</h3><b>{num(market.at(-1)[1])}</b> <i style={{ color: tone(market.at(-1)[1] - market[0][1]) }}>{pct(((market.at(-1)[1] - market[0][1]) / market[0][1]) * 100)}</i> <small>over the year</small></div>
            </div>
            <MarketChart closes={market} />
          </section>
        )}
        {strip?.indices?.length > 0 && (
          <section className="td-box" aria-label="The market">
            <div className="td-head"><h3>Major indices</h3><button type="button" onClick={() => onOpenTab?.("explore")}>Explore</button></div>
            {strip.indices.slice(0, 6).map(m => (
              <div key={m.name} className="td-index">
                <span className="td-badge" aria-hidden="true">{m.name.replace(/^NIFTY\s*/i, "").slice(0, 3)}</span>
                <span className="td-name">{m.name}</span>
                <span className="td-index-nums"><b>{num(m.close)}</b><i style={{ color: tone(m.changePct) }}>{pct(m.changePct)}</i></span>
              </div>
            ))}
          </section>
        )}
      </div>

      <div className="td-grid">
        <section className="td-box" aria-label="Your watchlist">
          <div className="td-head"><h3>Your watchlist</h3>{rows.length > 0 && <button type="button" onClick={() => onOpenTab?.("watchlist")}>Open all</button>}</div>
          {watch && rows.length === 0 && (
            <p className="td-empty">Nothing here yet. Search for a company above and star it, and its moves, fair value and results dates show here each day.</p>
          )}
          {moved.map(r => (
            <button key={r.symbol} type="button" className="td-row" onClick={() => onOpenStock?.(r.symbol)}>
              <span className="td-name">{short(r.name)}<small>{r.sector ?? r.symbol}</small></span>
              <span>₹{num(r.cmp)}</span>
              <span style={{ color: tone(r.ret1d) }}>{pct(r.ret1d)}</span>
            </button>
          ))}
        </section>

        <div className="td-side">
          {under.length > 0 && (
            <section className="td-box" aria-label="Needs a look">
              <div className="td-head"><h3>Needs a look</h3></div>
              {under.map(({ r, by }) => (
                <button key={r.symbol} type="button" className="td-line" onClick={() => onOpenStock?.(r.symbol)}>
                  <span>{short(r.name)}</span><em>{by.toFixed(0)}% under fair value</em>
                </button>
              ))}
            </section>
          )}
          {coming.length > 0 && (
            <section className="td-box" aria-label="Results coming">
              <div className="td-head"><h3>Results coming</h3><button type="button" onClick={() => navigate("/results-calendar")}>Calendar</button></div>
              {coming.map(c => (
                <div key={c.date} className="td-line">
                  <span className={c.yours.length ? undefined : "td-quiet"}>{c.yours.length ? c.yours.map(y => short(y.name)).join(", ") : `${c.count} ${c.count === 1 ? "company" : "companies"}`}</span>
                  <em>{day(c.date)}</em>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      <section className="td-box td-screens" aria-label="Screeners">
        <div className="td-head">
          <h3>Screeners</h3>
          <span className="td-head-acts">
            <button type="button" onClick={seeAll}>See all{presets.length ? ` ${presets.length}` : ""}</button>
            <button type="button" onClick={onCreate}><Plus size={13} aria-hidden="true" />Create new screen</button>
          </span>
        </div>
        {presets.slice(0, QUICK_SCREENS).map(p => (
          <button key={p.id} type="button" className="td-screen" onClick={() => onPickScreen?.(p)}>
            <span className="td-screen-icon"><ScreenIcon p={p} size={18} /></span>
            <span>{p.name}<small>{p.description}</small></span>
          </button>
        ))}
      </section>

      {continueCard}
      {newsTile && <div className="td-news">{newsTile}</div>}

      <section id="all-screeners" className="td-all" aria-labelledby="sh-popular">
        <h2 id="sh-popular" className="td-all-title">All screeners</h2>
        {children}
      </section>
    </div>
      </div>
    </div>
  );
}
