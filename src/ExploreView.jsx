import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { niceName } from "./stockName.js";
import NewsView, { Change, NewsRow } from "./NewsView.jsx";
import { usePhone } from "./phoneTabs.js";

// The Explore page (23 Oct 2026: "the Nifty 50, bank, small, large and all
// the others on this page, and we also have news in it"): the indices at
// their last close — end of day, from NSE's daily index file, not live — each
// with its month as a small chart; an index opens in full (its year, its
// returns, NSE's valuation of it, a sector's biggest moves and news); the
// news below (NewsView). An open index is a history entry of its own, as a
// news item is.

const SHORT = {
  "Nifty 50": ["NIFTY 50", "50"], "Nifty Bank": ["Bank Nifty", "BK"], "Nifty Next 50": ["Next 50", "N50"], "Nifty 500": ["NIFTY 500", "500"],
  "NIFTY Midcap 100": ["Midcap 100", "MID"], "NIFTY Smallcap 100": ["Smallcap 100", "SML"], "Nifty Smallcap 250": ["Smallcap 250", "250"], "Nifty Microcap 250": ["Microcap 250", "MIC"],
  "India VIX": ["India VIX", "VIX"], "Nifty IT": ["IT", "IT"], "Nifty Auto": ["Auto", "AU"], "Nifty FMCG": ["FMCG", "FM"], "Nifty Pharma": ["Pharma", "PH"],
  "Nifty Metal": ["Metal", "ME"], "Nifty Realty": ["Realty", "RE"], "Nifty Energy": ["Energy", "EN"], "Nifty Financial Services": ["Financial Services", "FS"],
  "Nifty PSU Bank": ["PSU Bank", "PSB"], "Nifty Private Bank": ["Private Bank", "PVB"], "Nifty Oil & Gas": ["Oil & Gas", "OG"], "Nifty Healthcare Index": ["Healthcare", "HC"],
  "Nifty Consumer Durables": ["Consumer Durables", "CD"], "Nifty Media": ["Media", "MD"], "Nifty Infrastructure": ["Infrastructure", "INF"], "Nifty India Defence": ["Defence", "DEF"],
  "Nifty Capital Markets": ["Capital Markets", "CM"], "Nifty Power": ["Power", "PW"], "Nifty Cement": ["Cement", "CE"], "Nifty Chemicals": ["Chemicals", "CH"],
};
export const label = name => SHORT[name]?.[0] ?? name.replace(/^nifty\s+/i, "");
const badge = name => SHORT[name]?.[1] ?? label(name).slice(0, 2).toUpperCase();
const points = v => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const shortDate = d => (d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "");
const tone = v => (v > 0.05 ? "up" : v < -0.05 ? "down" : "flat");

// A small area chart of the closes; its colour is the card's
function Spark({ closes, dir, height = 56, dot = true }) {
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, []);
  const vals = (closes ?? []).filter(v => v != null);
  if (vals.length < 2) return <div style={{ height }} />;
  const min = Math.min(...vals), max = Math.max(...vals), w = 100, h = 40, pad = 3;
  const y = v => (max === min ? h / 2 : pad + (1 - (v - min) / (max - min)) * (h - 2 * pad));
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, y(v)]);
  const line = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(2)},${yy.toFixed(2)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className={`ex-spark ${dir}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0.32" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {dot && <circle cx={lx} cy={ly} r="2.4" fill="currentColor" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

function IndexCard({ i, asOf, onOpen }) {
  const dir = tone(i.changePct);
  return (
    <button type="button" className="ex-card" onClick={() => onOpen(i.name)} aria-label={`${label(i.name)}: ${points(i.close)}, ${i.changePct >= 0 ? "up" : "down"} ${Math.abs(i.changePct).toFixed(2)}% on ${shortDate(asOf)}`}>
      <span className="ex-card-top"><span className={`ex-badge ${i.group}`}>{badge(i.name)}</span><span className="ex-name">{label(i.name)}</span></span>
      <span className="ex-value">{points(i.close)}</span>
      <span className={`ex-chg ${dir}`}>{i.changePct > 0 ? "+" : i.changePct < 0 ? "−" : ""}{Math.abs(i.changePct).toFixed(2)}%<span className="ex-on">{shortDate(asOf)}</span></span>
      <Spark closes={i.spark} dir={dir} />
    </button>
  );
}

function Row({ title, items, asOf, onOpen, id }) {
  if (!items?.length) return null;
  return (
    <section className="ex-section" aria-labelledby={id}>
      <h3 className="ex-h" id={id}>{title}</h3>
      <div className="ex-row">{items.map(i => <IndexCard key={i.name} i={i} asOf={asOf} onOpen={onOpen} />)}</div>
    </section>
  );
}

const RANGES = [["1M", 21], ["3M", 63], ["6M", 126], ["1Y", Infinity]];
const RETURNS = [["w1", "1 week"], ["m1", "1 month"], ["m3", "3 months"], ["m6", "6 months"], ["y1", "1 year"], ["y3", "3 years, yearly"], ["y5", "5 years, yearly"]];

const signed = v => `${v > 0 ? "+" : v < 0 ? "−" : ""}`;
const longDate = d => (d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "");

// The index's chart: its period as a segmented control, and a finger or the
// pointer on it reads off that day's close (24 Oct 2026 redesign)
function IndexChart({ days, closes, range, onRange }) {
  const [at, setAt] = useState(null);
  const box = useRef(null);
  const n = closes.length;
  const first = closes[0], last = closes[n - 1];
  const min = Math.min(...closes), max = Math.max(...closes);
  const rangeChange = n > 1 ? (last / first - 1) * 100 : null;
  const dir = tone(rangeChange);
  // the line's top and bottom are 3 of the 40 units in, as Spark draws it
  const yPct = v => (max === min ? 50 : (3 + (1 - (v - min) / (max - min)) * 34) / 40 * 100);
  const read = e => {
    const r = box.current?.getBoundingClientRect();
    if (!r?.width || n < 2) return;
    setAt(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const shown = at ?? n - 1;
  const since = n > 1 ? (closes[shown] / first - 1) * 100 : null;
  return (
    <div className="ex-chart">
      <div className="ex-chart-head">
        <div className="ex-readout" aria-live="off">
          {at == null
            ? <><span className={`ex-chg ${dir}`}>{rangeChange != null ? `${signed(rangeChange)}${Math.abs(rangeChange).toFixed(2)}%` : "—"}</span><span className="ex-readout-sub">over {range === "1Y" ? "the year" : range.replace("M", range === "1M" ? " month" : " months")}</span></>
            : <><span className="ex-readout-val">{points(closes[at])}</span><span className={`ex-chg ${tone(since)}`}>{signed(since)}{Math.abs(since).toFixed(2)}%</span><span className="ex-readout-sub">{longDate(days[at])}</span></>}
        </div>
        <div className="ex-seg" role="group" aria-label="Chart period" style={{ "--i": RANGES.findIndex(([r]) => r === range), "--n": RANGES.length }}>
          <span className="ex-seg-thumb" aria-hidden="true" />
          {RANGES.map(([r]) => <button key={r} type="button" className="ex-range" aria-pressed={range === r} onClick={() => { setAt(null); onRange(r); }}>{r}</button>)}
        </div>
      </div>
      <div ref={box} className="ex-plot" onPointerDown={read} onPointerMove={read} onPointerLeave={() => setAt(null)} onPointerCancel={() => setAt(null)}>
        <Spark closes={closes} dir={dir} height={220} dot={false} />
        <span className="ex-base" style={{ top: `${yPct(first)}%` }} aria-hidden="true" />
        {n > 1 && (
          <span className={`ex-cursor ${tone(since)}${at == null ? " idle" : ""}`} style={{ left: `${(shown / (n - 1)) * 100}%` }} aria-hidden="true">
            <span className="ex-cursor-dot" style={{ top: `${yPct(closes[shown])}%` }} />
          </span>
        )}
      </div>
      <div className="ex-axis"><span>{shortDate(days[0])}</span><span>High {points(max)} · Low {points(min)}</span><span>{shortDate(days[days.length - 1])}</span></div>
    </div>
  );
}

// An index in full
function IndexDetail({ name, onBack, onOpenStock, onOpenNews }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState("1Y");
  useEffect(() => { setD(null); api.exploreIndex(name).then(setD).catch(e => setError(e.message)); window.scrollTo(0, 0); }, [name]);
  const back = <button type="button" className="nw-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Explore</button>;
  if (error) return <div className="ex-detail">{back}<p className="nw-empty">{error}</p></div>;
  if (!d) return <div className="ex-detail">{back}<div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div></div>;
  const n = RANGES.find(([r]) => r === range)[1];
  const closes = n === Infinity ? d.closes : d.closes.slice(-(n + 1));
  const days = n === Infinity ? d.days : d.days.slice(-(n + 1));
  const vix = name === "India VIX";
  const dayDir = tone(d.changePct);
  // the returns' bars share one scale, so the longest is the biggest move
  const scale = Math.max(1, ...RETURNS.map(([k]) => Math.abs(d.returns[k] ?? 0)));
  return (
    <article className="ex-detail" aria-label={label(name)}>
      {back}
      <header className="ex-hero">
        <p className="nw-eyebrow"><span className={`ex-badge ${d.group}`}>{badge(name)}</span><span>{d.group === "sector" ? "Sector index" : "Market index"} · close on {shortDate(d.asOf)}</span></p>
        <h2 className="nw-title ex-title">{name.replace(/^nifty/i, "NIFTY")}</h2>
        <p className="ex-big">{points(d.close)} <span className={`ex-daychg ${dayDir}`}>{signed(d.change)}{points(Math.abs(d.change))} ({signed(d.changePct)}{Math.abs(d.changePct).toFixed(2)}%)</span><span className="ex-big-on">on the day</span></p>
      </header>
      {vix && <p className="nw-note">India VIX is how much the market expects prices to swing over the next 30 days, from NIFTY options: higher means more nervous. It isn't a price.</p>}
      {/* a wide screen: the chart on the left, its returns and valuation beside it */}
      <div className="dt-cols">
      <div className="dt-main">
      <IndexChart days={days} closes={closes} range={range} onRange={setRange} />
      {(d.pe || d.pb || d.divYield) && (
        <section className="nw-section" aria-label="Valuation">
          <h3 className="nw-section-head">Valuation</h3>
          <div className="ex-stats">
            {d.pe && <div><span>P/E</span><b>{d.pe.toFixed(1)}</b></div>}
            {d.pb && <div><span>P/B</span><b>{d.pb.toFixed(2)}</b></div>}
            {d.divYield && <div><span>Dividend yield</span><b>{d.divYield.toFixed(2)}%</b></div>}
          </div>
          <p className="nw-note">NSE's figures for the index on {shortDate(d.asOf)}.</p>
        </section>
      )}
      </div>
      <div className="dt-side">
      {!vix && (
        <section className="nw-section" aria-label="Returns">
          <h3 className="nw-section-head">Returns</h3>
          <div className="ex-returns">
            {RETURNS.map(([k, l]) => {
              const v = d.returns[k];
              return (
                <div key={k} className="ex-ret">
                  <span className="ex-ret-label">{l}</span>
                  <span className="ex-ret-track" aria-hidden="true">{v != null && <span className={`ex-ret-bar ${tone(v)}`} style={{ "--w": `${(Math.abs(v) / scale) * 50}%` }} />}</span>
                  {v != null ? <Change value={v} /> : <span className="ex-na">—</span>}
                </div>
              );
            })}
          </div>
          <p className="nw-note">Price returns from NSE's closes, without dividends; 3 and 5 years are a year on average.</p>
        </section>
      )}
      </div>
      </div>
      {/* a wide screen: the movers and the news side by side under them */}
      <div className="dt-below">
      {(d.gainers.length > 0 || d.losers.length > 0) && (
        <section className="nw-section" aria-label="Biggest moves">
          <h3 className="nw-section-head">Biggest moves on {shortDate(d.asOf)}</h3>
          <p className="nw-note">{d.sector} companies over ₹1,000 crore ({d.companies}).</p>
          <div className="ex-movers">
            {[["Up", d.gainers], ["Down", d.losers]].map(([t, list]) => list.length > 0 && (
              <div key={t} className="ex-movers-col">
                <p className={`ex-movers-h ${t === "Up" ? "up" : "down"}`}>{t === "Up" ? "Rose most" : "Fell most"}</p>
                <div className="nw-list">
                {list.map(m => (
                  <button key={m.symbol} type="button" className="nw-row compact" onClick={() => onOpenStock(m.symbol)}>
                    <span className="nw-mark"><CompanyLogo symbol={m.symbol} size={36} fallback={m.name} /></span>
                    <span className="nw-main"><span className="nw-top"><span className="nw-who">{niceName(m.name)}</span><span className="nw-spacer" /><Change value={m.change1d} /></span>
                      <span className="nw-subject">₹{m.close?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></span>
                  </button>
                ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {d.news?.length > 0 && (
        <section className="nw-section" aria-label={`${label(name)} news`}>
          <h3 className="nw-section-head">{label(name)} news</h3>
          <div className="nw-list">{d.news.map(item => <NewsRow key={item.id} item={item} onOpen={onOpenNews} />)}</div>
        </section>
      )}
      </div>
    </article>
  );
}

// ---- The market map: a page of its own (MarketMapView.jsx, 31 Oct 2026) ----------

// Explore's way to it
function MapLink({ onOpen }) {
  return (
    <section className="ex-section" aria-labelledby="ex-map-link">
      <button type="button" className="ex-map-link" onClick={onOpen}>
        <span className="ex-map-link-art" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <span className="ex-map-link-text">
          <span className="ex-map-link-title" id="ex-map-link">Market map</span>
          <span className="ex-map-link-sub">Every sector and company, coloured by its move</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </section>
  );
}

// ---- Top movers and the week's results ------------------------------------------

const MOVER_PERIODS = [["1d", "1D", "the day"], ["1w", "1W", "the week"], ["1m", "1M", "the month"]];

export const crShort = v => (v >= 100000 ? `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);

// A phone shows each section's first few (preview), and "See all" opens the
// whole of it as a page of its own (23 Oct 2026: "on the phone show only three
// or four; open it to show the details on another page")
const PREVIEW = 4;
// the title, and in a preview an arrow beside it to the rest ("give the arrow beside the
// title itself, so we save the space below")
export const SectionHead = ({ id, title, more, onMore }) => (
  <div className="ex-h-row">
    <h3 className="ex-h" id={id}>{title}</h3>
    {onMore && <button type="button" className="ex-h-more" aria-label={more} title={more} onClick={onMore}><ChevronRight size={20} aria-hidden="true" /></button>}
  </div>
);

// A segmented control: one track, its thumb sliding under the chosen option
function Segmented({ label: groupLabel, value, onChange, options, tint = "" }) {
  const i = Math.max(0, options.findIndex(([v]) => v === value));
  return (
    <div className={`ex-seg ${tint}`} role="group" aria-label={groupLabel} style={{ "--i": i, "--n": options.length }}>
      <span className="ex-seg-thumb" aria-hidden="true" />
      {options.map(([v, l]) => <button key={v} type="button" className="ex-range" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function TopMovers({ onOpenStock, preview = false, onSeeAll, start = {} }) {
  const [period, setPeriod] = useState(start.period ?? "1d");
  const [side, setSide] = useState(start.side ?? "gainers");
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.movers(period).then(setData).catch(() => setData({ gainers: [], losers: [] })); }, [period]);
  const all = data?.[side] ?? [];
  const list = preview ? all.slice(0, PREVIEW) : all;
  const [, , words] = MOVER_PERIODS.find(([p]) => p === period);
  return (
    <section className="ex-section" aria-labelledby="ex-movers">
      <div className="ex-sec-bar">
        <SectionHead id="ex-movers" title="Top movers" more={`See all ${all.length} ${side}`} onMore={preview && all.length > PREVIEW ? () => onSeeAll({ side, period }) : null} />
        <div className="ex-sec-controls">
          <Segmented label="Rises or falls" value={side} onChange={setSide} tint={side === "gainers" ? "up" : "down"} options={[["gainers", "Gainers"], ["losers", "Losers"]]} />
          <Segmented label="Movers over" value={period} onChange={setPeriod} options={MOVER_PERIODS.map(([p, l]) => [p, l])} />
        </div>
      </div>
      {data == null
        ? <div className="nw-skel" role="status" aria-label="Loading the movers">{[0, 1, 2].map(i => <span key={i} />)}</div>
        : list.length
          ? <ol className="nw-list ex-movers-list" style={{ "--rows": Math.ceil(list.length / 2) }}>
            {list.map((m, k) => (
              <li key={m.symbol}>
                <button type="button" className="nw-row compact" onClick={() => onOpenStock(m.symbol)}>
                  <span className="ex-rank">{k + 1}</span>
                  <span className="nw-mark"><CompanyLogo symbol={m.symbol} size={36} fallback={m.name} /></span>
                  <span className="nw-main">
                    <span className="nw-top"><span className="nw-who">{niceName(m.name)}</span><span className="nw-spacer" /><span className={`ex-pill ${m.change >= 0 ? "up" : "down"}`}>{m.change > 0 ? "+" : "−"}{Math.abs(m.change).toFixed(2)}%</span></span>
                    <span className="nw-subject">₹{m.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}<span className="ex-mcap"> · {crShort(m.marketCapCr)} m-cap</span></span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          : <p className="nw-empty">No {side === "gainers" ? "rises" : "falls"} over {words}.</p>}
      <p className="nw-note">Companies over ₹{(data?.floorCr ?? 1000).toLocaleString("en-IN")} crore, over {words}{data?.asOf ? ` to the close on ${shortDate(data.asOf)}` : ""}.</p>
    </section>
  );
}

const dateBit = (d, o) => new Intl.DateTimeFormat("en-IN", { ...o, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const dayName = d => dateBit(d, { weekday: "long" });
const dayNum = d => dateBit(d, { day: "numeric" });
const monthName = d => dateBit(d, { month: "short" });
function ResultsWeek({ onOpenStock, preview = false, onSeeAll }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});
  useEffect(() => { api.resultsWeek().then(setData).catch(() => setData({ days: [] })); }, []);
  if (!data?.days?.length) return null;
  // a phone's preview: the next three days, three companies each; the page of its own: every one
  // (5 and "more" fill a wide screen's row of 6)
  const SHOWN = preview ? 3 : onSeeAll ? 5 : Infinity;
  const days = preview ? data.days.slice(0, 3) : data.days;
  return (
    <section className="ex-section" aria-labelledby="ex-results">
      <SectionHead id="ex-results" title="Results this week" more={`See all ${data.days.reduce((n, d) => n + d.count, 0)} companies`} onMore={preview ? () => onSeeAll() : null} />
      <div className="ex-days">
        {days.map(day => {
          const all = open[day.date], list = all ? day.companies : day.companies.slice(0, SHOWN);
          const tomorrow = new Date(Date.parse(`${data.today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
          return (
            <div key={day.date} className="ex-day">
              <div className="ex-date">
                <span className={`ex-date-wd${day.date === data.today || day.date === tomorrow ? " soon" : ""}`}>{day.date === data.today ? "Today" : day.date === tomorrow ? "Tomorrow" : dayName(day.date)}</span>
                <span className="ex-date-d">{dayNum(day.date)}<small>{monthName(day.date)}</small></span>
                <span className="ex-date-n">{day.count} {day.count === 1 ? "company" : "companies"}</span>
              </div>
              <div className="ex-day-list">
                {list.map(c => (
                  <button key={c.symbol} type="button" className="ex-co" onClick={() => onOpenStock(c.symbol)} title={niceName(c.name)}>
                    <CompanyLogo symbol={c.symbol} size={24} fallback={c.name} />
                    <span>{niceName(c.name)}</span>
                  </button>
                ))}
                {day.count > SHOWN && <button type="button" className="ex-more" onClick={() => (preview ? onSeeAll() : setOpen(o => ({ ...o, [day.date]: !all })))}>{all ? "Show fewer" : `+${day.count - SHOWN} more`}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="nw-note">Board meetings for results on NSE's calendar, the largest companies first.</p>
    </section>
  );
}

export default function ExploreView({ onOpenStock, openId = null, onOpened, openIndexName = null, onIndexOpened, onOpenMap }) {
  const [board, setBoard] = useState(null);
  const [index, setIndex] = useState(() => window.history.state?.newsItem ? null : window.history.state?.exploreIndex ?? null);
  const indexRef = useRef(null);
  indexRef.current = index;
  const fullRef = useRef(null);
  const [newsItem, setNewsItem] = useState(null);
  const [newsOpen, setNewsOpen] = useState(null);
  const listScroll = useRef(0);
  const phone = usePhone();
  // A section as a page of its own ({ kind: "movers" | "results" | "news", … }): a history
  // entry, so Back (the page's, the browser's, Android's) returns to Explore where it was
  const [full, setFull] = useState(() => window.history.state?.exploreFull ?? null);
  fullRef.current = full;
  const openFull = f => {
    listScroll.current = window.scrollY;
    window.history.pushState({ ...(window.history.state ?? {}), exploreFull: f }, "");
    setFull(f);
    window.scrollTo(0, 0);
  };
  useEffect(() => { api.explore().then(setBoard).catch(() => setBoard({ market: [], sectors: [] })); }, []);
  useEffect(() => {
    // (only when an index was open: Back from a company page is the app's to place)
    const onPop = () => {
      const s = window.history.state ?? {};
      const next = s.newsItem ? null : s.exploreIndex ?? null;
      const wasOpen = indexRef.current || fullRef.current;
      setIndex(next);
      setFull(s.exploreFull ?? null);
      if (!next && !s.newsItem && !s.exploreFull && wasOpen) requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openIndex = name => {
    listScroll.current = window.scrollY;
    window.history.pushState({ ...(window.history.state ?? {}), exploreIndex: name, newsItem: undefined }, "");
    setIndex(name);
  };
  // From the price strip: straight to its index, by the board's own name
  // ("NIFTY Bank" there is "Nifty Bank" here) once the board is in
  useEffect(() => {
    if (!openIndexName || !board) return;
    const all = [...(board.market ?? []), ...(board.sectors ?? [])];
    const hit = all.find(i => i.name.toLowerCase() === openIndexName.toLowerCase());
    openIndex(hit?.name ?? openIndexName);
    onIndexOpened?.();
  }, [openIndexName, board]); // eslint-disable-line react-hooks/exhaustive-deps

  // A news item from an index's page: the item over it, Back returns to the index
  const openNewsFromIndex = id => { setIndex(null); setNewsOpen(id); };

  return (
    <div className="ex-page">
      {index && <IndexDetail name={index} onBack={() => window.history.back()} onOpenStock={onOpenStock} onOpenNews={openNewsFromIndex} />}
      {full && !index && (
        <div className="ex-full">
          {!newsItem && <button type="button" className="nw-back" onClick={() => window.history.back()}><ArrowLeft size={17} aria-hidden="true" /> Explore</button>}
          {full.kind === "movers" && <TopMovers onOpenStock={onOpenStock} start={full} />}
          {full.kind === "results" && <ResultsWeek onOpenStock={onOpenStock} />}
          {full.kind === "news" && <NewsView embedded onOpenStock={onOpenStock} onItemChange={setNewsItem} />}
        </div>
      )}
      <div hidden={!!index || !!full}>
        {!newsItem && (
          <>
            <div className="nw-head">
              <h2 className="nw-page-title hide-phone">Explore</h2>
              <p className="nw-lede">{board?.asOf ? `The market's indices at their close on ${shortDate(board.asOf)}, and the news.` : "The market's indices and the news."}</p>
            </div>
            {board == null
              ? <div className="ex-row ex-skel" role="status" aria-label="Loading the indices">{[0, 1, 2, 3].map(i => <span key={i} />)}</div>
              : board.pending
                ? <p className="nw-note">The indices arrive with the evening data update.</p>
                : <>
                  <Row id="ex-market" title="Market" items={board.market} asOf={board.asOf} onOpen={openIndex} />
                  <Row id="ex-sectors" title="Sectors" items={board.sectors} asOf={board.asOf} onOpen={openIndex} />
                  {onOpenMap && <MapLink onOpen={onOpenMap} />}
                </>}
            {/* from the companies' own figures: there even before the indices are */}
            <TopMovers onOpenStock={onOpenStock} preview={phone} onSeeAll={f => openFull({ kind: "movers", ...f })} />
            <ResultsWeek onOpenStock={onOpenStock} preview={phone} onSeeAll={() => openFull({ kind: "results" })} />
          </>
        )}
        {!full && <NewsView embedded preview={phone} onSeeAll={() => openFull({ kind: "news" })} onOpenStock={onOpenStock} openId={newsOpen ?? openId} onOpened={() => { setNewsOpen(null); onOpened?.(); }} onItemChange={setNewsItem} />}
      </div>
    </div>
  );
}

