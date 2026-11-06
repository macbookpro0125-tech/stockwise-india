import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
// each index its own steady colour, like a logo (not the day's red or green)
const BADGE_COLOURS = ["#c2273a", "#1f7fb5", "#2c9ad1", "#5b1a3a", "#0f8a72", "#7b4fd6", "#c06414", "#3657c9", "#8a2c7a", "#2f7d3a"];
const badgeColour = name => BADGE_COLOURS[[...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % BADGE_COLOURS.length];
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

function ResultsDay({ results, date, onDate, onBack, onOpenStock }) {
  const [q, setQ] = useState("");
  // the week before (results already out) and the days ahead, in order
  const past = (results?.past ?? []).map(x => ({ ...x, past: true }));
  const days = [...past, ...(results?.days ?? []).filter(x => x.count > 0)];
  const d = days.find(x => x.date === date) ?? (results?.days ?? []).find(x => x.count > 0) ?? days[days.length - 1];
  if (!d) return <div className="mk"><button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button><p className="mk-note">No results dates this week.</p></div>;
  const match = c => !q.trim() || `${c.name} ${c.symbol} ${c.sector ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const list = d.companies.filter(match);
  const done = d.companies.filter(c => reported(c, d.date)).length;
  return (
    <div className="mk">
      <button type="button" className="mk-back" onClick={onBack}><ChevronLeft size={18} /> Markets</button>
      <header className="mk-head">
        <h1>Results on {weekday(d.date)}</h1>
        <p>{d.past
          ? `${d.count} ${d.count === 1 ? "company" : "companies"} filed ${d.count === 1 ? "its" : "their"} quarterly results with NSE that day, the largest first, with sales and profit against a year earlier.`
          : `${d.count} ${d.count === 1 ? "company meets" : "companies meet"} to approve ${d.count === 1 ? "its" : "their"} quarterly results${done ? `; ${done} ${done === 1 ? "has" : "have"} filed` : ""}. The largest first. Dates are the ones companies told NSE; they can change.`}</p>
      </header>
      <div className="mk-seg mk-res-days" role="group" aria-label="Day">
        {days.map((x, i) => <Fragment key={x.date}>
          {i === past.length && past.length > 0 && <span className="mk-res-split" aria-hidden="true" />}
          <button type="button" className={x.past ? "past" : ""} aria-pressed={x.date === d.date} onClick={() => onDate(x.date)} title={x.past ? "Results already out" : "Results due"}>{shortDay(x.date)} <span>{x.count}</span></button>
        </Fragment>)}
      </div>
      {d.count > 12 && <input className="mk-search" type="search" placeholder="Find a company" aria-label="Find a company" value={q} onChange={e => setQ(e.target.value)} />}
      <section className="mk-card" aria-label={`Results on ${weekday(d.date)}`}>
        <ul className="mk-resday">
          <li className="mk-resday-head" aria-hidden="true"><span>Company</span><span>Market cap</span><span>Quarter</span><span>Sales</span><span>Net profit</span><span /></li>
          {list.map(c => {
            const qq = c.quarter, done = reported(c, d.date), label = qq ? fyQ(qq.end) : null;
            const slug = label?.toLowerCase().replace(" ", "-");
            return (
              <li key={c.symbol} className={done ? "done" : ""}>
                <button type="button" className="mk-resday-co" onClick={() => onOpenStock?.(c.symbol)} aria-label={`${cardName(c.name)}: open its page`}>
                  <CompanyLogo symbol={c.symbol} size={30} fallback={c.name} />
                  <span><b>{cardName(c.name)}</b><small>{[c.symbol, c.sector].filter(Boolean).join(" · ")}</small></span>
                </button>
                <span className="mk-resday-cap">{mcap(c.marketCapCr)}</span>
                <span className="mk-resday-q">{label ? <>{done ? <em className="mk-res-tag new">New</em> : <em className="mk-res-tag">Last</em>}{label}</> : "—"}</span>
                <span className="mk-resday-n">{crore(qq?.salesCr)}{qq?.salesYoY != null && <small className={tone(qq.salesYoY)}>{pct1(qq.salesYoY)}</small>}</span>
                <span className="mk-resday-n">{qq?.profitCr != null && qq.profitCr < 0 ? `Loss ${crore(qq.profitCr)}` : crore(qq?.profitCr)}{qq?.profitYoY != null && qq?.profitCr > 0 && qq.profitCr / (1 + qq.profitYoY / 100) > 0 && <small className={tone(qq.profitYoY)}>{pct1(qq.profitYoY)}</small>}</span>
                <span className="mk-resday-go">{slug && <button type="button" className="mk-link" onClick={() => navigate(`/stock/${encodeURIComponent(c.symbol)}/results/${slug}`)}>{done ? "See results" : "Last results"} <ChevronRight size={14} aria-hidden="true" /></button>}</span>
              </li>
            );
          })}
          {!list.length && <li className="mk-note">No company by that name reports that day.</li>}
        </ul>
      </section>
      <p className="mk-note">"Last" is the quarter before, to compare with until the new results are filed; changes are against the same quarter a year earlier. From the companies' filings with NSE. Not investment advice.</p>
    </div>
  );
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
      {(results?.days?.length > 0 || results?.past?.length > 0) && (
        <section className="mk-card" aria-labelledby="mk-res">
          <div className="mk-card-h"><h2 id="mk-res">Results this week</h2><span className="mk-card-links">{results.past?.length > 0 && <button type="button" className="mk-link" onClick={() => openDay(results.past[results.past.length - 1].date)}>Already out</button>}<button type="button" className="mk-link" onClick={() => navigate("/results-calendar")}>Calendar</button></span></div>
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
