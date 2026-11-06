import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createChart, createSeriesMarkers, AreaSeries, HistogramSeries, ColorType } from "lightweight-charts";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { api } from "./api.js";
import { cardName } from "./stockName.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { MoodBar } from "./MoodBar.jsx";
import { lazy, Suspense } from "react";
const PriceChartPanel = lazy(() => import("./PriceChartPanel.jsx"));
import { navigate } from "./site.jsx";
import { useWatchlist } from "./watchlist.js";
import { Star } from "lucide-react";

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
// each index its own steady colour, like a logo (not the day's red or green)
const BADGE_COLOURS = ["#c2273a", "#1f7fb5", "#2c9ad1", "#5b1a3a", "#0f8a72", "#7b4fd6", "#c06414", "#3657c9", "#8a2c7a", "#2f7d3a"];
const badgeColour = name => BADGE_COLOURS[[...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % BADGE_COLOURS.length];
const RANGES = [["1M", 21], ["3M", 63], ["6M", 126], ["1Y", Infinity]];

// The index's line in our teal (7 Nov 2026: it read as TradingView's), no
// price tag on the axis; a dot on each day its largest companies filed
// results, and a card under the pointer with the day, the level and those
// results
function IndexChart({ days, closes, label, results = [], breadth = [] }) {
  const host = useRef(null);
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!host.current || !(closes?.length > 1)) return undefined;
    const css = getComputedStyle(document.documentElement), v = n => css.getPropertyValue(n).trim();
    const raw = v("--accent"), line = /^#[0-9a-f]{6}$/i.test(raw) ? raw : "#14b8a6";
    const n = parseInt(line.slice(1), 16), rgba = a => `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "rgba(0, 0, 0, 0)" }, textColor: v("--t3"), fontFamily: getComputedStyle(document.body).fontFamily, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: v("--bdr") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false },
      crosshair: { horzLine: { visible: false, labelVisible: false }, vertLine: { labelVisible: false, style: 3, color: v("--bdr2") } },
      localization: { locale: "en-IN", priceFormatter: p => Math.round(p).toLocaleString("en-IN") },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, { lineColor: line, lineWidth: 2, topColor: rgba(0.22), bottomColor: rgba(0), priceLineVisible: false, lastValueVisible: false, crosshairMarkerBorderColor: line, crosshairMarkerBackgroundColor: /^#/.test(v("--bg")) ? v("--bg") : "#ffffff" });
    series.setData(days.map((time, i) => ({ time, value: closes[i] })));
    // breadth along the bottom, under its own day: how many more of its
    // companies rose than fell (green) or fell than rose (red)
    const brd = new Map(breadth.map(b => [b.date, b]));
    if (brd.size > 2) {
      const css2 = getComputedStyle(document.documentElement), g = css2.getPropertyValue("--green").trim() || "#16a34a", r = css2.getPropertyValue("--red").trim() || "#dc2626";
      const hist = chart.addSeries(HistogramSeries, { priceScaleId: "breadth", priceLineVisible: false, lastValueVisible: false, base: 0 });
      chart.priceScale("breadth").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 }, visible: false });
      hist.setData(days.filter(d => brd.has(d)).map(time => { const b = brd.get(time), net = b.rose - b.fell; return { time, value: Math.abs(net) || 0.2, color: net >= 0 ? g : r }; }));
      series.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.2 } });
    }
    const shown = new Set(days);
    const byDay = new Map();
    for (const r of results) if (shown.has(r.date)) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
    createSeriesMarkers(series, [...byDay.keys()].sort().map(time => ({ time, position: "inBar", shape: "circle", color: line, size: 1 })));
    chart.subscribeCrosshairMove(p => {
      if (!p?.time || !p.point || p.point.x < 0) { setTip(null); return; }
      const i = days.indexOf(p.time);
      setTip({ x: p.point.x, date: p.time, value: closes[i], results: byDay.get(p.time) ?? [], breadth: brd.get(p.time) });
    });
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(host.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [days, closes, results, breadth]);
  const w = host.current?.clientWidth ?? 0;
  return (
    <div className="mk-chart-wrap">
      <div ref={host} className="mk-chart" role="img" aria-label={label} />
      {tip && (
        <div className="mk-chart-tip" style={{ left: Math.min(Math.max(tip.x - 110, 0), Math.max(0, w - 230)) }}>
          <span className="mk-chart-tip-d">{day(tip.date)} · <b>{num(tip.value)}</b></span>
          {tip.breadth && <span className="mk-chart-tip-b"><span className="up">{tip.breadth.rose} rose</span> · <span className="down">{tip.breadth.fell} fell</span></span>}
          {tip.results.map(r => <span key={r.symbol + r.quarter} className="mk-chart-tip-r"><i />{cardName(r.name)} {r.quarter} results{r.profitYoY != null && r.profitCr > 0 ? ` · profit ${pct1(r.profitYoY)}` : r.profitCr < 0 ? " · a loss" : ""}</span>)}
        </div>
      )}
    </div>
  );
}

// The index in a sentence, from its own figures and its companies' moves
function indexSentence(d, range, rangeMove) {
  const st = d?.story;
  if (d?.changePct == null) return null;
  const n = String(d.name);
  const parts = [`${n} ${d.changePct > 0.05 ? "rose" : d.changePct < -0.05 ? "fell" : "was flat"}${Math.abs(d.changePct) > 0.05 ? ` ${Math.abs(d.changePct).toFixed(1)}%` : ""} today.`];
  if (st?.members) parts.push(st.fell > st.rose ? `${st.fell} of its ${st.members} companies fell, ${st.rose} rose.` : `${st.rose} of its ${st.members} companies rose, ${st.fell} fell.`);
  if (st?.up?.[0] && st?.down?.[0]) parts.push(`${cardName(st.up[0].name)} added the most, ${cardName(st.down[0].name)} took off the most.`);
  if (rangeMove != null) parts.push(`${rangeMove >= 0 ? "Up" : "Down"} ${Math.abs(rangeMove).toFixed(1)}% over ${range === "1Y" ? "the year" : range === "1M" ? "the month" : range === "3M" ? "three months" : "six months"}${d.pe != null ? `, it trades at ${d.pe.toFixed(1)} times its companies' earnings` : ""}.`);
  return parts.join(" ");
}

// The story, folded to one line; the arrow opens the rest (7 Nov
// 2026, "keep it minimised; when we press the arrow it should open")
function Story({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={`mk-story${open ? " open" : ""}`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
      <span className="mk-story-label">The story</span>
      <span className="mk-story-text">{text}</span>
      <ChevronDown size={18} className="mk-story-arrow" aria-hidden="true" />
    </button>
  );
}

// How many of its companies rose and fell, day by day, the last month
function Breadth({ rows }) {
  if (!(rows?.length > 2)) return null;
  const top = Math.max(...rows.map(r => r.rose + r.fell));
  return (
    <div className="mk-breadth-days" aria-label="How many of its companies rose and fell each day">
      <div className="mk-breadth-bars">
        {rows.map(r => (
          <span key={r.date} title={`${day(r.date)}: ${r.rose} rose, ${r.fell} fell`} style={{ height: `${((r.rose + r.fell) / top) * 100}%` }}>
            <i className="up" style={{ flex: r.rose }} /><i className="down" style={{ flex: r.fell }} />
          </span>
        ))}
      </div>
      <p className="mk-note">Its companies, day by day over the last month: <span className="up">rose</span> and <span className="down">fell</span>.</p>
    </div>
  );
}

// The companies that moved the index most today, in index points
function WhoMoved({ story, onOpenStock }) {
  if (!story?.up?.length && !story?.down?.length) return null;
  const row = x => (
    <li key={x.symbol}>
      <button type="button" onClick={() => onOpenStock?.(x.symbol)}>
        <CompanyLogo symbol={x.symbol} size={22} fallback={x.name} />
        <span className="mk-who"><b>{cardName(x.name)}</b></span>
        <span className={`mk-chg ${tone(x.change)}`}>{pct(x.change)}</span>
        <span className={`mk-pts ${tone(x.points)}`}>{x.points >= 0 ? "+" : "−"}{Math.abs(Math.round(x.points))} pts</span>
      </button>
    </li>
  );
  return (
    <div className="mk-whomoved">
      <h4>Who moved it today</h4>
      <div className="mk-whomoved-cols">
        <ul aria-label="Added to it">{story.up.map(row)}</ul>
        <ul aria-label="Took off it">{story.down.map(row)}</ul>
      </div>
      <p className="mk-note">Points are approximate: each company's share of the index by market value, times its move.</p>
    </div>
  );
}

// a month as a small line, for the all-indices list
function Spark({ values, up }) {
  const v = (values ?? []).filter(x => x != null);
  if (v.length < 2) return <span className="mk-spark" />;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((x, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(28 - ((x - lo) / span) * 26).toFixed(1)}`).join(" ");
  return <svg className="mk-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke={up ? "var(--green)" : "var(--red)"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>;
}

// Every index on one page (5 Nov 2026, "see all … a page where you can see all
// the indices"): the market's and the sectors', each with its day and its month;
// a click charts it on Markets
function AllIndices({ board, onPick, onBack }) {
  const [q, setQ] = useState("");
  const groups = [["Market", board?.market ?? []], ["Sectors", board?.sectors ?? []]];
  const match = i => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <div className="mk">
      <button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button>
      <header className="mk-head">
        <h1>All indices</h1>
        <p>{board?.asOf ? `NSE's indices at the close on ${day(board.asOf)}. Pick one to chart it.` : "NSE's indices. Pick one to chart it."}</p>
      </header>
      <input className="mk-search" type="search" placeholder="Find an index" aria-label="Find an index" value={q} onChange={e => setQ(e.target.value)} />
      {groups.map(([title, list]) => list.filter(match).length > 0 && (
        <section key={title} className="mk-card" aria-labelledby={`mk-all-${title}`}>
          <div className="mk-card-h"><h2 id={`mk-all-${title}`}>{title}</h2><span className="mk-note">{list.filter(match).length}</span></div>
          <ul className="mk-all">
            <li className="mk-all-head" aria-hidden="true"><span>Index</span><span>Last</span><span>Today</span><span>Last month</span><span>1 month</span></li>
            {list.filter(match).map(i => (
              <li key={i.name}>
                <button type="button" onClick={() => onPick(i.name)}>
                  <span className="mk-all-name"><span className="mk-badge" style={{ background: badgeColour(i.name) }}>{badge(i.name)}</span><b>{i.name}</b></span>
                  <span className="mk-num">{num(i.close)}</span>
                  <span className={`mk-chg ${tone(i.changePct)}`}>{pct(i.changePct)}</span>
                  <Spark values={i.spark} up={(i.month ?? 0) >= 0} />
                  <span className={`mk-chg ${tone(i.month)}`}>{pct(i.month)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// A results day in full (6 Nov 2026: "when I press, I should see the details
// on the next page"): every company with a board meeting for its results that
// day, the largest first. Once it has filed, its new quarter's figures and a
// link to them; until then, the quarter before, to compare with.
const fyQ = end => { const [y, m] = String(end).split("-").map(Number); return y && m ? `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}` : null; };
const crore = v => (v == null ? "—" : `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 })} cr`);
const mcap = v => (v == null ? "" : v >= 100000 ? `₹${(v / 100000).toFixed(1)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
const weekday = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
// filed on the meeting day or after it (or the day before, for an evening filing read late)
const pct1 = v => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`;
const reported = (c, date) => !!c.reported || (!!c.quarter?.filed && Date.parse(c.quarter.filed) >= Date.parse(date) - 86_400_000);

// One company's row on a results page: its latest quarter's figures against a
// year earlier, today's share move, and the way to its results. when: the
// results date shown in place of market cap on the watchlist's page
// Between two dates in a strip: a new week starts (a divider), and any
// weekdays with no trading between them (market holidays, shown as closed)
const DAY_MS = 86_400_000;
const mondayOf = iso => { const t = Date.parse(`${iso}T00:00:00Z`); const wd = (new Date(t).getUTCDay() + 6) % 7; return t - wd * DAY_MS; };
function between(prev, cur) {
  if (!prev) return { week: false, closed: [] };
  const a = Date.parse(`${prev}T00:00:00Z`), b = Date.parse(`${cur}T00:00:00Z`), closed = [];
  for (let t = a + DAY_MS; t < b; t += DAY_MS) { const wd = new Date(t).getUTCDay(); if (wd >= 1 && wd <= 5) closed.push(new Date(t).toISOString().slice(0, 10)); }
  return { week: mondayOf(prev) !== mondayOf(cur), closed };
}
function ClosedDay({ date }) {
  const t = new Date(`${date}T00:00:00Z`);
  return (
    <span className="mk-date mk-date-closed" title="NSE was closed" aria-label={`${weekday(date)}: market closed`}>
      <span className="mk-date-wd">{t.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
      <span className="mk-date-d">{t.getUTCDate()}</span>
      <span className="mk-date-m">Closed</span>
    </span>
  );
}

// A date strip: the picked date slid to its middle by moving the strip alone
// (7 Nov 2026: scrollIntoView moved the whole page too, a jump on each press),
// and its edges faded only where there's more to scroll to (a fade over the
// last date read as a blur)
function useDateStrip(dep) {
  const strip = useRef(null);
  const edges = () => {
    const el = strip.current;
    if (!el) return;
    const start = el.scrollLeft <= 2 ? "1" : "0", end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 ? "1" : "0";
    for (const n of [el, el.parentElement]) if (n) { n.dataset.start = start; n.dataset.end = end; }
  };
  // a mouse (7 Nov 2026, "if I use a mouse, how do I scroll left and right"):
  // its wheel turns the strip, and a press-and-drag pulls it; a drag isn't a click
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const wheel = e => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    let drag = null;
    const down = e => { if (e.pointerType !== "mouse" || e.button !== 0) return; drag = { x: e.clientX, left: el.scrollLeft, moved: false }; };
    const move = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 5) return;
      drag.moved = true; el.classList.add("dragging");
      el.scrollLeft = drag.left - dx;
    };
    const up = () => { if (drag?.moved) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener("click", stop, { capture: true }), 0); } drag = null; el.classList.remove("dragging"); };
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("wheel", wheel); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  useEffect(() => {
    const el = strip.current, pick = el?.querySelector("[aria-pressed=true]");
    if (el && pick) {
      const target = pick.offsetLeft - el.offsetLeft - (el.clientWidth - pick.offsetWidth) / 2;
      const first = !el.dataset.placed;
      el.scrollTo({ left: Math.max(0, target), behavior: first || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el.dataset.placed = "1";
    }
    requestAnimationFrame(edges);
  }, dep); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener("resize", edges); return () => window.removeEventListener("resize", edges); }, []);
  const nudge = dir => strip.current?.scrollBy({ left: dir * (strip.current.clientWidth * 0.7), behavior: "smooth" });
  return [strip, edges, nudge];
}
// the strip's arrows, for a mouse: glass, shown only towards more dates
function StripArrows({ nudge }) {
  return <>
    <button type="button" className="mk-end back mk-strip-end" aria-label="Earlier dates" onClick={() => nudge(-1)}><ChevronLeft size={20} /></button>
    <button type="button" className="mk-end next mk-strip-end" aria-label="Later dates" onClick={() => nudge(1)}><ChevronRight size={20} /></button>
  </>;
}

function ResRow({ c, done, starred, onOpenStock, when }) {
  const qq = c.quarter, label = qq ? fyQ(qq.end) : null;
  const slug = label?.toLowerCase().replace(" ", "-");
  return (
    <li className={done ? "done" : ""}>
      <button type="button" className="mk-resday-co" onClick={() => onOpenStock?.(c.symbol)} aria-label={`${cardName(c.name)}: open its page`}>
        <CompanyLogo symbol={c.symbol} size={30} fallback={c.name} />
        <span><b>{cardName(c.name)}{starred && <Star size={12} className="mk-res-star" aria-label="on your watchlist" />}</b><small>{[c.symbol, c.sector].filter(Boolean).join(" · ")}</small></span>
      </button>
      <span className="mk-resday-cap">{when ?? mcap(c.marketCapCr)}</span>
      <span className="mk-resday-q">{label ? <>{done ? <em className="mk-res-tag new">New</em> : <em className="mk-res-tag">Last</em>}{label}</> : "—"}</span>
      <span className="mk-resday-n">{crore(qq?.salesCr)}{qq?.salesYoY != null && <small className={tone(qq.salesYoY)}>{pct1(qq.salesYoY)}</small>}</span>
      <span className="mk-resday-n">{qq?.profitCr != null && qq.profitCr < 0 ? `Loss ${crore(qq.profitCr)}` : crore(qq?.profitCr)}{qq?.profitYoY != null && qq?.profitCr > 0 && qq.profitCr / (1 + qq.profitYoY / 100) > 0 && <small className={tone(qq.profitYoY)}>{pct1(qq.profitYoY)}</small>}</span>
      <span className={`mk-resday-move ${tone(c.ret1d)}`}>{c.ret1d == null ? "—" : pct1(c.ret1d)}</span>
      <span className="mk-resday-go">{slug && <button type="button" className="mk-link" onClick={() => navigate(`/stock/${encodeURIComponent(c.symbol)}/results/${slug}`)}>{done ? "See results" : "Last results"} <ChevronRight size={14} aria-hidden="true" /></button>}</span>
    </li>
  );
}

// The watchlist's results, whatever the day: the ones coming, by date, then
// the ones already out, the newest first
function WatchResults({ onOpenStock }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.resultsWatchlist().then(setData).catch(() => setData({ companies: [] })); }, []);
  if (!data) return <div className="mk-card"><p className="mk-note">Loading your watchlist's results…</p></div>;
  if (!data.companies.length) return <div className="mk-card"><p className="mk-note">Your watchlist is empty. Star companies to follow their results here, past and coming.</p></div>;
  const coming = data.companies.filter(c => c.next).sort((a, b) => a.next.localeCompare(b.next));
  const out = data.companies.filter(c => !c.next).sort((a, b) => String(b.quarter?.filed ?? "").localeCompare(String(a.quarter?.filed ?? "")));
  // filed within the last 45 days: this season's results
  const fresh = c => c.quarter?.filed && Date.parse(data.today) - Date.parse(c.quarter.filed) <= 45 * 86_400_000;
  const head = first => <li className="mk-resday-head" aria-hidden="true"><span>Company</span><span>{first}</span><span>Quarter</span><span>Sales</span><span>Net profit</span><span>Share today</span><span /></li>;
  return (
    <>
      {coming.length > 0 && (
        <section className="mk-card" aria-label="Your watchlist: results coming">
          <div className="mk-card-h"><h2>Coming</h2><span className="mk-note">{coming.length}</span></div>
          <ul className="mk-resday mine">{head("Results on")}{coming.map(c => <ResRow key={c.symbol} c={c} done={false} onOpenStock={onOpenStock} when={shortDay(c.next)} />)}</ul>
        </section>
      )}
      {out.length > 0 && (
        <section className="mk-card" aria-label="Your watchlist: results already out">
          <div className="mk-card-h"><h2>Already out</h2><span className="mk-note">{out.length}</span></div>
          <ul className="mk-resday mine">{head("Filed")}{out.map(c => <ResRow key={c.symbol} c={c} done={fresh(c)} onOpenStock={onOpenStock} when={c.quarter?.filed ? shortDay(String(c.quarter.filed).slice(0, 10)) : "—"} />)}</ul>
        </section>
      )}
      <p className="mk-note">"Coming": a results date the company has told NSE, with its last quarter to compare with. "Already out": its latest quarter on file ("New" when filed in the last 45 days). Figures against the same quarter a year earlier.</p>
    </>
  );
}

function ResultsDay({ results, date, onDate, onBack, onOpenStock }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("size");
  const [show, setShow] = useState("all");
  const watched = useWatchlist();
  // the picked day slides to the strip's middle
  const [strip, stripEdges, nudge] = useDateStrip([date, results]);
  // the week before (results already out) and the days ahead, in order
  const past = (results?.past ?? []).map(x => ({ ...x, past: true }));
  const days = [...past, ...(results?.days ?? []).filter(x => x.count > 0)];
  const mineMode = date === "mine";
  const d = mineMode ? { date: "mine", count: 0, companies: [] } : days.find(x => x.date === date) ?? (results?.days ?? []).find(x => x.count > 0) ?? days[days.length - 1];
  if (!d) return <div className="mk"><button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button><p className="mk-note">No results dates this week.</p></div>;
  const match = c => !q.trim() || `${c.name} ${c.symbol} ${c.sector ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const keep = c => (show === "large" ? (c.marketCapCr ?? 0) >= 1000 : show === "mine" ? watched.has(c.symbol) : true);
  const val = (c, k) => (k === "profit" ? c.quarter?.profitYoY : k === "sales" ? c.quarter?.salesYoY : k === "move" ? c.ret1d : c.marketCapCr);
  const list = d.companies.filter(c => match(c) && keep(c))
    .map((c, i) => [c, i]).sort((a, b) => { if (sort === "size") return a[1] - b[1]; const x = val(a[0], sort), y = val(b[0], sort); return (x == null) - (y == null) || (y ?? 0) - (x ?? 0) || a[1] - b[1]; }).map(([c]) => c);
  const done = d.companies.filter(c => reported(c, d.date)).length;
  // the day at a glance, from the results filed (its own quarter, against a year earlier)
  const filed = d.companies.filter(c => reported(c, d.date) && c.quarter);
  const tally = filed.length >= 3 ? {
    up: filed.filter(c => c.quarter.profitCr > 0 && c.quarter.profitYoY > 0).length,
    down: filed.filter(c => c.quarter.profitCr > 0 && c.quarter.profitYoY != null && c.quarter.profitYoY <= 0).length,
    loss: filed.filter(c => c.quarter.profitCr != null && c.quarter.profitCr < 0).length,
    salesUp: filed.filter(c => c.quarter.salesYoY > 0).length,
    n: filed.length,
  } : null;
  return (
    <div className="mk">
      <button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button>
      <header className="mk-head">
        <h1>{mineMode ? "Your watchlist's results" : `Results on ${weekday(d.date)}`}</h1>
        <p>{mineMode ? "Every company you follow: the results coming, by date, and the ones already out." : d.past
          ? `${d.count} ${d.count === 1 ? "company" : "companies"} filed ${d.count === 1 ? "its" : "their"} quarterly results with NSE that day, the largest first, with sales and profit against a year earlier.`
          : `${d.count} ${d.count === 1 ? "company meets" : "companies meet"} to approve ${d.count === 1 ? "its" : "their"} quarterly results${done ? `; ${done} ${done === 1 ? "has" : "have"} filed` : ""}. The largest first. Dates are the ones companies told NSE; they can change.`}</p>
      </header>
      {/* the days as one sliding strip: the week before, then the days ahead */}
      {/* the watchlist's card stays put beside the sliding days */}
      <div className="mk-strip-row">
      <div className="mk-dates-group mk-mine-fixed">
        <span className="mk-dates-label">Yours</span>
        <button type="button" className="mk-date mk-date-mine" aria-pressed={mineMode} onClick={() => onDate("mine")} aria-label="My watchlist: its results, past and coming">
          <Star size={18} aria-hidden="true" /><span className="mk-date-m">Watchlist</span>
        </button>
      </div>
      <div className="mk-dates-wrap">
      <StripArrows nudge={nudge} />
      <div className="mk-dates" role="group" aria-label="Day" ref={strip} onScroll={stripEdges}>
        {[["Already out", days.filter(x => x.past)], ["Coming", days.filter(x => !x.past)]].map(([label, list]) => list.length > 0 && (
          <div key={label} className="mk-dates-group">
            <span className="mk-dates-label">{label}</span>
            <div className="mk-dates-row">
              {list.map((x, i) => {
                const t = new Date(`${x.date}T00:00:00Z`), gap = between(list[i - 1]?.date, x.date);
                return (
                  <Fragment key={x.date}>
                  {gap.week && <span className="mk-week-break" aria-hidden="true" />}
                  <button type="button" className={`mk-date${x.past ? " past" : ""}`} aria-pressed={x.date === d.date} onClick={() => onDate(x.date)}
                    aria-label={`${weekday(x.date)}: ${x.count} ${x.count === 1 ? "company" : "companies"}`}>
                    <span className="mk-date-wd">{t.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
                    <span className="mk-date-d">{t.getUTCDate()}</span>
                    <span className="mk-date-m">{t.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span>
                    <span className="mk-date-n">{x.count}</span>
                  </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      </div>
      </div>
      {mineMode && <WatchResults onOpenStock={onOpenStock} />}
      {!mineMode && tally && (
        <div className="mk-tally" aria-label="The day at a glance">
          <div className="mk-tally-bar" aria-hidden="true">
            <i className="up" style={{ flex: tally.up }} /><i className="down" style={{ flex: tally.down }} /><i className="loss" style={{ flex: tally.loss }} />
          </div>
          <p><b className="up">{tally.up}</b> grew profit · <b className="down">{tally.down}</b> saw it fall · <b className="loss">{tally.loss}</b> made a loss <span>· sales up at {tally.salesUp} of {tally.n}, against a year earlier</span></p>
        </div>
      )}
      {!mineMode && <><div className="mk-res-tools">
        <div className="mk-seg" role="group" aria-label="Show">
          {[["all", "All"], ["large", "₹1,000 cr+"], ["mine", "My watchlist"]].map(([id, label]) => <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>)}
        </div>
        <label className="mk-res-sort">Sort
          <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort by">
            <option value="size">Largest first</option>
            <option value="profit">Profit growth</option>
            <option value="sales">Sales growth</option>
            <option value="move">Share move today</option>
          </select>
        </label>
        {d.count > 12 && <input className="mk-search mk-res-find" type="search" placeholder="Find a company" aria-label="Find a company" value={q} onChange={e => setQ(e.target.value)} />}
      </div>
      <section className="mk-card" aria-label={`Results on ${weekday(d.date)}`}>
        <ul className="mk-resday">
          <li className="mk-resday-head" aria-hidden="true"><span>Company</span><span>Market cap</span><span>Quarter</span><span>Sales</span><span>Net profit</span><span>Share today</span><span /></li>
          {list.map(c => <ResRow key={c.symbol} c={c} done={reported(c, d.date)} starred={watched.has(c.symbol)} onOpenStock={onOpenStock} />)}
          {!list.length && <li className="mk-note">{show === "mine" ? "None of your watchlist's companies report that day." : "No company by that name reports that day."}</li>}
        </ul>
      </section>
      <p className="mk-note">"Last" is the quarter before, to compare with until the new results are filed; changes are against the same quarter a year earlier. From the companies' filings with NSE. Not investment advice.</p></>}
    </div>
  );
}

// The biggest moves as a page of their own (6 Nov 2026, "the same for this,
// and the previous ones"): any of the last ten trading days, over a day, a
// week or a month; how many rose and fell and which sectors led; every
// company worth ₹1,000 crore or more, not ten
const OVER = { "1d": "on the day", "1w": "over the week", "1m": "over the month" };
const MOVES_SHOWN = 25;
function MoversDay({ date, period, onDate, onPeriod, onBack, onOpenStock }) {
  const [data, setData] = useState(null);
  const [show, setShow] = useState("all");
  const [q, setQ] = useState("");
  const [more, setMore] = useState({});
  const watched = useWatchlist();
  const [strip, stripEdges, nudge] = useDateStrip([data?.date, data?.days?.length]);
  useEffect(() => { setMore({}); api.moversDay(date, period).then(setData).catch(() => setData({ rows: [], days: [] })); }, [date, period]);
  const match = r => (!q.trim() || `${r.name} ${r.symbol} ${r.sector ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    && (show === "large" ? (r.marketCapCr ?? 0) >= 20000 : show === "mine" ? watched.has(r.symbol) : true);
  const rows = (data?.rows ?? []).filter(match);
  const up = rows.filter(r => r.change > 0.05).sort((a, b) => b.change - a.change);
  const down = rows.filter(r => r.change < -0.05).sort((a, b) => a.change - b.change);
  const flat = rows.length - up.length - down.length;
  // sectors by their companies' average move (five companies or more)
  const sectors = useMemo(() => {
    const m = new Map();
    for (const r of data?.rows ?? []) if (r.sector) { const x = m.get(r.sector) ?? { n: 0, sum: 0 }; x.n++; x.sum += r.change; m.set(r.sector, x); }
    const list = [...m].filter(([, x]) => x.n >= 5).map(([name, x]) => ({ name, avg: x.sum / x.n, n: x.n })).sort((a, b) => b.avg - a.avg);
    return { best: list.slice(0, 3), worst: list.slice(-3).reverse() };
  }, [data]);
  const day = data?.date;
  const list = (title, items, key) => (
    <div>
      <h3>{title} <span className="mk-note">{items.length}</span></h3>
      <ul>
        {items.slice(0, more[key] ? undefined : MOVES_SHOWN).map(r => (
          <li key={r.symbol}>
            <button type="button" onClick={() => onOpenStock?.(r.symbol)}>
              <CompanyLogo symbol={r.symbol} size={26} fallback={r.name} />
              <span className="mk-who"><b>{cardName(r.name)}{watched.has(r.symbol) && <Star size={12} className="mk-res-star" aria-label="on your watchlist" />}</b><small>{r.symbol}{r.sector ? ` · ${r.sector}` : ""}</small></span>
              <span className="mk-num">₹{num(r.close)}</span>
              <span className={`mk-chg ${tone(r.change)}`}>{pct(r.change)}</span>
            </button>
          </li>
        ))}
        {!items.length && <li className="mk-note">{show === "mine" ? "None of your watchlist's companies." : "None."}</li>}
      </ul>
      {items.length > MOVES_SHOWN && !more[key] && <button type="button" className="mk-res-more" onClick={() => setMore(m => ({ ...m, [key]: true }))}>Show all {items.length} <ChevronRight size={13} aria-hidden="true" /></button>}
    </div>
  );
  return (
    <div className="mk">
      <button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button>
      <header className="mk-head">
        <h1>{day ? `Biggest moves ${period === "1d" ? "on" : "to"} ${weekday(day)}` : "Biggest moves"}</h1>
        <p>{data ? `${(data.rows ?? []).length.toLocaleString("en-IN")} NSE companies worth ₹${(data.floorCr ?? 1000).toLocaleString("en-IN")} crore or more, by their move ${OVER[period]}${data.from && period !== "1d" ? ` (from the close on ${day ? shortDay(data.from) : ""})` : ""}.` : "Reading the closing prices…"}</p>
      </header>
      <div className="mk-moves-bar">
        <div className="mk-dates-wrap">
        <StripArrows nudge={nudge} />
        <div className="mk-dates" role="group" aria-label="Trading day" ref={strip} onScroll={stripEdges}>
          <div className="mk-dates-group">
            <span className="mk-dates-label">Trading days</span>
            <div className="mk-dates-row">
              {[...(data?.days ?? [])].reverse().map((x, i, all) => {
                const t = new Date(`${x}T00:00:00Z`), gap = between(all[i - 1], x);
                return (
                  <Fragment key={x}>
                  {gap.week && <span className="mk-week-break" aria-hidden="true" />}
                  {gap.closed.map(c => <ClosedDay key={c} date={c} />)}
                  <button type="button" className="mk-date" aria-pressed={x === day} onClick={() => onDate(x)} aria-label={weekday(x)}>
                    <span className="mk-date-wd">{t.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}</span>
                    <span className="mk-date-d">{t.getUTCDate()}</span>
                    <span className="mk-date-m">{t.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}</span>
                  </button>
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
        </div>
        <div className="mk-seg" role="group" aria-label="Over">
          {[["1d", "Day"], ["1w", "Week"], ["1m", "Month"]].map(([id, l]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => onPeriod(id)}>{l}</button>)}
        </div>
      </div>
      {!data && <div className="mk-card"><span className="mk-skel mk-row-skel" /></div>}
      {data && rows.length > 0 && (
        <div className="mk-tally" aria-label="The day at a glance">
          <div className="mk-tally-bar" aria-hidden="true"><i className="up" style={{ flex: up.length }} /><i className="flat" style={{ flex: flat }} /><i className="loss" style={{ flex: down.length }} /></div>
          <p><b className="up">{up.length}</b> rose · <b className="loss">{down.length}</b> fell{flat > 0 ? ` · ${flat} unchanged` : ""}
            {sectors.best.length > 0 && show === "all" && !q && <span> · best sectors {sectors.best.map(x => `${x.name} ${pct1(x.avg)}`).join(", ")} · weakest {sectors.worst.map(x => `${x.name} ${pct1(x.avg)}`).join(", ")} (their companies' average)</span>}
          </p>
        </div>
      )}
      {data && (
        <div className="mk-res-tools">
          <div className="mk-seg" role="group" aria-label="Show">
            {[["all", "All"], ["large", "₹20,000 cr+"], ["mine", "My watchlist"]].map(([id, label]) => <button key={id} type="button" aria-pressed={show === id} onClick={() => setShow(id)}>{label}</button>)}
          </div>
          <input className="mk-search mk-res-find" type="search" placeholder="Find a company" aria-label="Find a company" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      )}
      {data && (
        <section className="mk-card" aria-label="Rises and falls">
          <div className="mk-movers">{list("Gainers", up, "up")}{list("Losers", down, "down")}</div>
        </section>
      )}
      <p className="mk-note">NSE closing prices, adjusted for splits and bonuses. A reading of the past, not advice.</p>
    </div>
  );
}

export default function MarketsView({ onOpenStock, onOpenTab }) {
  const [board, setBoard] = useState(null);
  const [pick, setPick] = useState("Nifty 50");
  const [detail, setDetail] = useState(null);
  const [range, setRange] = useState("1Y");
  // the index's chart: ours (the story's dots and breadth) or the full stock chart, remembered
  const [chartMode, setChartMode] = useState(() => { try { return localStorage.getItem("mk-chart") === "full" ? "full" : "simple"; } catch { return "simple"; } });
  const pickMode = m => { setChartMode(m); try { localStorage.setItem("mk-chart", m); } catch {} };
  const [period, setPeriod] = useState("1d");
  const [movers, setMovers] = useState(null);
  const [mood, setMood] = useState(null);
  const [results, setResults] = useState(null);
  // the all-indices page, as its own step in the browser's history so Back returns here
  const [all, setAll] = useState(false);
  useEffect(() => {
    const back = () => setAll(!!window.history.state?.allIndices);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const showAll = () => { window.history.pushState({ ...(window.history.state ?? {}), allIndices: true }, ""); setAll(true); window.scrollTo(0, 0); };
  // a results day as its own page, the same way
  const [resDay, setResDay] = useState(() => window.history.state?.resultsDay ?? null);
  useEffect(() => {
    const back = () => setResDay(window.history.state?.resultsDay ?? null);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const openDay = date => { window.history.pushState({ ...(window.history.state ?? {}), resultsDay: date }, ""); setResDay(date); window.scrollTo(0, 0); };
  const pickDay = date => { window.history.replaceState({ ...(window.history.state ?? {}), resultsDay: date }, ""); setResDay(date); };
  const closeDay = () => { if (window.history.state?.resultsDay) window.history.back(); else setResDay(null); };
  // the biggest moves as a page, the same way: { date, period }
  const [movesPage, setMovesPage] = useState(() => window.history.state?.movesPage ?? null);
  useEffect(() => {
    const back = () => setMovesPage(window.history.state?.movesPage ?? null);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const openMoves = m => { window.history.pushState({ ...(window.history.state ?? {}), movesPage: m }, ""); setMovesPage(m); window.scrollTo(0, 0); };
  const setMoves = m => { window.history.replaceState({ ...(window.history.state ?? {}), movesPage: m }, ""); setMovesPage(m); };
  const closeMoves = () => { if (window.history.state?.movesPage) window.history.back(); else setMovesPage(null); };
  const closeAll = () => { if (window.history.state?.allIndices) window.history.back(); else setAll(false); };

  useEffect(() => {
    api.explore().then(setBoard).catch(() => setBoard({ market: [], sectors: [] }));
    api.deskMarket().then(setMood).catch(() => {});
    api.resultsWeek().then(setResults).catch(() => {});
  }, []);
  useEffect(() => { setDetail(null); api.exploreIndex(pick).then(setDetail).catch(() => setDetail({ error: true })); }, [pick]);
  useEffect(() => { setMovers(null); api.movers(period).then(setMovers).catch(() => setMovers({ gainers: [], losers: [] })); }, [period]);

  const strip = useRef(null);
  const scroll = d => strip.current?.scrollBy({ left: d * strip.current.clientWidth * 0.75, behavior: "smooth" });
  // whether there's more to either side, for the round arrows over the row's ends
  const [ends, setEnds] = useState({ back: false, next: false });
  const look = () => { const el = strip.current; if (el) setEnds({ back: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => {
    look();
    const el = strip.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(look);
    ro.observe(el);
    return () => ro.disconnect();
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (movesPage) return <MoversDay date={movesPage.date ?? null} period={movesPage.period ?? "1d"} onDate={d => setMoves({ ...movesPage, date: d })} onPeriod={p => setMoves({ ...movesPage, period: p })} onBack={closeMoves} onOpenStock={onOpenStock} />;
  if (resDay) return <ResultsDay results={results} date={resDay} onDate={pickDay} onBack={closeDay} onOpenStock={onOpenStock} />;
  if (all) return <AllIndices board={board} onBack={closeAll} onPick={name => { setPick(name); closeAll(); window.scrollTo(0, 0); }} />;

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
          {indices.length > 0 && <button type="button" className="mk-link" onClick={showAll}>See all {indices.length + (board?.sectors?.length ?? 0)}</button>}
        </div>
        <div className="mk-strip-wrap">
        {ends.back && <button type="button" className="mk-end back" aria-label="Earlier indices" onClick={() => scroll(-1)}><ChevronLeft size={20} /></button>}
        {ends.next && <button type="button" className="mk-end next" aria-label="More indices" onClick={() => scroll(1)}><ChevronRight size={20} /></button>}
        <div className="mk-strip" ref={strip} role="tablist" aria-label="Pick an index" onScroll={look}>
          {!board && [0, 1, 2, 3].map(i => <span key={i} className="mk-pill mk-skel" />)}
          {indices.map(i => (
            <button key={i.name} type="button" role="tab" aria-selected={pick === i.name} className="mk-pill" onClick={() => setPick(i.name)}>
              <span className="mk-badge" style={{ background: badgeColour(i.name) }}>{badge(i.name)}</span>
              <span className="mk-pill-text">
                <b>{i.name}</b>
                <span><span className="mk-num">{num(i.close)}</span> <span className={`mk-chg ${tone(i.changePct)}`}>{pct(i.changePct)}</span></span>
              </span>
            </button>
          ))}
          {indices.length > 0 && (
            <button type="button" className="mk-pill mk-pill-all" onClick={showAll}>
              <span className="mk-badge mk-badge-all" aria-hidden="true"><ChevronRight size={20} /></span>
              <span className="mk-pill-text"><b>See all</b><span>{indices.length + (board?.sectors?.length ?? 0)} indices</span></span>
            </button>
          )}
        </div>
        </div>

        <div className="mk-card mk-index">
          <div className="mk-chart-mode mk-seg" role="group" aria-label="Chart">
            {[["simple", "Simple"], ["full", "Full chart"]].map(([id, l]) => <button key={id} type="button" aria-pressed={chartMode === id} onClick={() => pickMode(id)}>{l}</button>)}
          </div>
          <div className="mk-index-top">
            <div>
              <h3>{detail?.name ?? pick}</h3>
              <div className="mk-index-price">
                <b className="mk-num">{num(detail?.close)}</b>
                <span className={`mk-chg ${tone(detail?.changePct)}`}>{pct(detail?.changePct)} today</span>
                {rangeMove != null && <span className={`mk-chg ${tone(rangeMove)}`}>{pct(rangeMove)} over {range === "1Y" ? "the year" : range}</span>}
              </div>
            </div>
            {chartMode !== "full" && (
              <div className="mk-seg" role="group" aria-label="Range">
                {RANGES.map(([id]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => setRange(id)}>{id}</button>)}
              </div>
            )}
          </div>
          {detail && indexSentence(detail, range, rangeMove) && <Story text={indexSentence(detail, range, rangeMove)} />}
          {chartMode === "full" && detail?.name && (
            <div className="mk-full-chart">
              <Suspense fallback={<div className="mk-chart mk-skel" />}>
                <PriceChartPanel key={detail.name} symbol={`INDEX ${detail.name}`} name={detail.name} index={detail.name} />
              </Suspense>
            </div>
          )}
          {chartMode !== "full" && (shownDays ? <IndexChart days={shownDays.days} closes={shownDays.closes} results={detail?.story?.results ?? []} breadth={detail?.story?.breadth ?? []} label={`${detail.name} over ${range}`} /> : <div className="mk-chart mk-skel" />)}
          {chartMode !== "full" && detail?.story?.breadth?.length > 2 && <p className="mk-note mk-chart-key"><i className="dot" />results of its five largest companies <i className="bar up" /><i className="bar down" />along the bottom: whether more of its companies rose or fell that day</p>}
          <WhoMoved story={detail?.story} onOpenStock={onOpenStock} />
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
          <span className="mk-card-links">
            <div className="mk-seg" role="group" aria-label="Over">
              {[["1d", "Day"], ["1w", "Week"], ["1m", "Month"]].map(([id, l]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{l}</button>)}
            </div>
            <button type="button" className="mk-link" onClick={() => openMoves({ date: null, period })}>See all · earlier days</button>
          </span>
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
        {movers?.floorCr && <p className="mk-note">Companies worth ₹{movers.floorCr.toLocaleString("en-IN")} crore or more. <button type="button" className="mk-link" onClick={() => openMoves({ date: null, period })}>Every company, and earlier days ›</button></p>}
      </section>

      {/* the week's results */}
      {(results?.days?.length > 0 || results?.past?.length > 0) && (
        <section className="mk-card" aria-labelledby="mk-res">
          <div className="mk-card-h"><h2 id="mk-res">Results this week</h2><span className="mk-card-links"><button type="button" className="mk-link" onClick={() => openDay("mine")}>My watchlist</button>{results.past?.length > 0 && <button type="button" className="mk-link" onClick={() => openDay(results.past[results.past.length - 1].date)}>Already out</button>}<button type="button" className="mk-link" onClick={() => navigate("/results-calendar")}>Calendar</button></span></div>
          <div className="mk-results">
            {results.days.filter(d => d.count > 0).slice(0, 5).map(d => (
              <div key={d.date}>
                <h3><button type="button" className="mk-res-day" onClick={() => openDay(d.date)} aria-label={`Results on ${weekday(d.date)}: all ${d.count}`}>{shortDay(d.date)} <span>{d.count}</span><ChevronRight size={14} aria-hidden="true" /></button></h3>
                <ul>
                  {d.companies.slice(0, 6).map(c => <li key={c.symbol}><button type="button" onClick={() => onOpenStock?.(c.symbol)}>{cardName(c.name)}{reported(c, d.date) && <em className="mk-res-dot" title="Results filed" aria-label="results filed" />}</button></li>)}
                </ul>
                <button type="button" className="mk-res-more" onClick={() => openDay(d.date)}>{d.count > 6 ? `+${d.count - 6} more · ` : ""}See the figures <ChevronRight size={13} aria-hidden="true" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mk-note">NSE closing prices and the indices' own figures. A reading of the past, not advice.</p>
    </div>
  );
}
