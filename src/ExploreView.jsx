import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "./api.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { niceName } from "./stockName.js";
import NewsView, { Change, NewsRow } from "./NewsView.jsx";

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
const label = name => SHORT[name]?.[0] ?? name.replace(/^nifty\s+/i, "");
const badge = name => SHORT[name]?.[1] ?? label(name).slice(0, 2).toUpperCase();
const points = v => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = d => (d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : "");
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
  const rangeChange = closes.length > 1 ? (closes[closes.length - 1] / closes[0] - 1) * 100 : null;
  const dir = tone(rangeChange);
  const vix = name === "India VIX";
  return (
    <article className="ex-detail" aria-label={label(name)}>
      {back}
      <p className="nw-eyebrow"><span className={`ex-badge ${d.group}`}>{badge(name)}</span><span>{d.group === "sector" ? "Sector index" : "Market index"} · close on {shortDate(d.asOf)}</span></p>
      <h2 className="nw-title">{name.replace(/^nifty/i, "NIFTY")}</h2>
      <p className="ex-big">{points(d.close)} <span className={`ex-chg ${tone(d.changePct)}`}>{d.change > 0 ? "+" : d.change < 0 ? "−" : ""}{points(Math.abs(d.change))} ({Math.abs(d.changePct).toFixed(2)}%)</span></p>
      {vix && <p className="nw-note">India VIX is how much the market expects prices to swing over the next 30 days, from NIFTY options: higher means more nervous. It isn't a price.</p>}
      <div className="ex-chart">
        <div className="ex-ranges" role="group" aria-label="Chart period">
          {RANGES.map(([r]) => <button key={r} type="button" className="ex-range" aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}
          {rangeChange != null && <span className={`ex-chg ${dir}`}>{rangeChange > 0 ? "+" : rangeChange < 0 ? "−" : ""}{Math.abs(rangeChange).toFixed(2)}%</span>}
        </div>
        <Spark closes={closes} dir={dir} height={180} dot={false} />
        <div className="ex-axis"><span>{shortDate(days[0])}</span><span>High {points(Math.max(...closes))} · Low {points(Math.min(...closes))}</span><span>{shortDate(days[days.length - 1])}</span></div>
      </div>
      {!vix && (
        <section className="nw-section" aria-label="Returns">
          <h3 className="nw-section-head">Returns</h3>
          <div className="ex-returns">
            {RETURNS.map(([k, l]) => <div key={k}><span>{l}</span>{d.returns[k] != null ? <Change value={d.returns[k]} /> : <span className="ex-na">—</span>}</div>)}
          </div>
          <p className="nw-note">Price returns from NSE's closes, without dividends; 3 and 5 years are a year on average.</p>
        </section>
      )}
      {(d.pe || d.pb || d.divYield) && (
        <section className="nw-section" aria-label="Valuation">
          <h3 className="nw-section-head">Valuation</h3>
          <div className="ex-returns">
            {d.pe && <div><span>P/E</span><b>{d.pe.toFixed(1)}</b></div>}
            {d.pb && <div><span>P/B</span><b>{d.pb.toFixed(2)}</b></div>}
            {d.divYield && <div><span>Dividend yield</span><b>{d.divYield.toFixed(2)}%</b></div>}
          </div>
          <p className="nw-note">NSE's figures for the index on {shortDate(d.asOf)}.</p>
        </section>
      )}
      {(d.gainers.length > 0 || d.losers.length > 0) && (
        <section className="nw-section" aria-label="Biggest moves">
          <h3 className="nw-section-head">Biggest moves on {shortDate(d.asOf)}</h3>
          <p className="nw-note">{d.sector} companies over ₹1,000 crore ({d.companies}).</p>
          <div className="ex-movers">
            {[["Up", d.gainers], ["Down", d.losers]].map(([t, list]) => list.length > 0 && (
              <div key={t} className="nw-list">
                {list.map(m => (
                  <button key={m.symbol} type="button" className="nw-row compact" onClick={() => onOpenStock(m.symbol)}>
                    <span className="nw-mark"><CompanyLogo symbol={m.symbol} size={36} fallback={m.name} /></span>
                    <span className="nw-main"><span className="nw-top"><span className="nw-who">{niceName(m.name)}</span><span className="nw-spacer" /><Change value={m.change1d} /></span>
                      <span className="nw-subject">₹{m.close?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></span>
                  </button>
                ))}
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
    </article>
  );
}

// ---- The heat map ------------------------------------------------------------

// Squarified treemap: boxes in proportion to their weight, as near square as
// the space allows (Bruls, Huizing & van Wijk), biggest first
export function squarify(items, width, height) {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (!total || width <= 0 || height <= 0) return [];
  const nodes = items.map(i => ({ ...i, area: (i.weight / total) * width * height }));
  const out = [];
  let r = { x: 0, y: 0, w: width, h: height }, row = [];
  const worst = (list, side) => {
    const sum = list.reduce((a, n) => a + n.area, 0), max = Math.max(...list.map(n => n.area)), min = Math.min(...list.map(n => n.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  const place = list => {
    const sum = list.reduce((a, n) => a + n.area, 0);
    if (r.w >= r.h) {
      const w = sum / r.h; let y = r.y;
      for (const n of list) { out.push({ ...n, x: r.x, y, w, h: n.area / w }); y += n.area / w; }
      r = { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    } else {
      const h = sum / r.w; let x = r.x;
      for (const n of list) { out.push({ ...n, x, y: r.y, w: n.area / h, h }); x += n.area / h; }
      r = { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
    }
  };
  for (const n of nodes) {
    const side = Math.min(r.w, r.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { place(row); row = [n]; }
  }
  if (row.length) place(row);
  return out;
}

const HEAT_SETS = [["Nifty 50", "NIFTY 50"], ["Nifty Bank", "Bank Nifty"], ["Nifty Next 50", "Next 50"], ["NIFTY Midcap 100", "Midcap 100"], ["NIFTY Smallcap 100", "Smallcap 100"], ["sectors", "Sectors"]];
const HEAT_PERIODS = [["1d", "1D", 3, "the day"], ["1w", "1W", 6, "the week"], ["1m", "1M", 10, "the month"]];
// Deeper green or red the bigger the move, full at ±3% a day (±6% a week, ±10% a month)
const heatColor = (c, limit) => {
  const t = Math.min(1, Math.abs(c) / limit);
  if (Math.abs(c) < 0.05) return "var(--s3)";
  return `color-mix(in srgb, ${c > 0 ? "#1f9d55" : "#d64545"} ${Math.round(28 + 62 * t)}%, var(--s2))`;
};

function Heatmap({ onOpenStock, onOpenIndex }) {
  const [set, setSet] = useState("Nifty 50");
  const [period, setPeriod] = useState("1d");
  const [data, setData] = useState(null);
  const [width, setWidth] = useState(0);
  const box = useRef(null);
  useEffect(() => { setData(null); api.heatmap(set, period).then(setData).catch(() => setData({ items: [], pending: true })); }, [set, period]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // a phone's is taller than wide, so its smaller tiles have room for a name
  const height = width < 640 ? Math.round(width * 1.4) : Math.round(Math.min(520, width * 0.5));
  const [, , limit, words] = HEAT_PERIODS.find(([p]) => p === period);
  const tiles = useMemo(() => (data?.items?.length ? squarify(data.items, width, height) : []), [data, width, height]);
  // Each tile's label: the name as large as the box allows, whole (a bold capital is about 0.76
  // of its size wide), on one line where it reads well, else on two or three lines, or running
  // up a tall thin tile. Down to 5.5 px, so even a phone's
  // smallest tiles say whose they are, in the tile ("I can't see the names of the companies",
  // "write something in the tiles itself", 23 Oct 2026). The move only where there's room too.
  const laid = tiles.map(t => {
    const name = t.symbol ?? label(t.index);
    const best = [];
    for (const up of t.h > t.w * 1.4 ? [false, true] : [false]) {
      const along = up ? t.h : t.w, across = up ? t.w : t.h;
      for (const n of [1, 2, 3]) {
        if (n > 1 && name.length < n * 2) continue;
        const per = Math.ceil(name.length / n);
        const size = Math.min(n === 1 ? 22 : 16, Math.max(9, Math.sqrt(t.w * t.h) / 4.6), (along - 6) / (per * 0.76), (across - 4) / (n * 1.15));
        best.push({ up, n, per, size });
      }
    }
    // The first that reads well: one line at 8.5 px or more, two lines, running up the tile,
    // two lines up it, three lines (7.5 px); failing all, the largest
    const rank = o => (o.up ? [2, 3, 5][o.n - 1] : [0, 1, 4][o.n - 1]);
    const order = [...best].sort((a, b) => rank(a) - rank(b));
    const pick = order.find(o => o.size >= (o.n === 1 && !o.up ? 8.5 : 7.5)) ?? best.reduce((a, b) => (b.size > a.size ? b : a));
    // split evenly (DRREDDY: DRR / ED / DY, not DRR / EDD / Y)
    const lines = [];
    for (let i = 0, at = 0; i < pick.n; i++) { const len = Math.ceil((name.length - at) / (pick.n - i)); lines.push(name.slice(at, at + len)); at += len; }
    const named = pick.size >= 5.5;
    const room = (pick.up ? t.w : t.h) - pick.n * pick.size * 1.15;
    const moved = named && !pick.up && pick.size >= 8 && room >= pick.size * 1.1 + 6;
    // a small move is a pale tile: dark letters on it in the light theme
    return { t, name, lines, up: pick.up, size: pick.size, named, moved, pale: Math.abs(t.change) / limit < 0.5 };
  });
  return (
    <section className="ex-section" aria-labelledby="ex-heat">
      <h3 className="ex-h" id="ex-heat">Heat map</h3>
      <div className="ex-heat-bar">
        <div className="ph-chips ex-heat-sets" role="group" aria-label="Which companies">
          {HEAT_SETS.map(([id, l]) => <button key={id} type="button" className="ph-chip" aria-pressed={set === id} onClick={() => setSet(id)}>{l}</button>)}
        </div>
        <div className="ex-ranges ex-heat-periods" role="group" aria-label="Over">
          {HEAT_PERIODS.map(([p, l]) => <button key={p} type="button" className="ex-range" aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>)}
        </div>
      </div>
      <div ref={box} className="ex-heat" style={{ height }}>
        {data == null && <div className="ex-heat-wait" role="status">Drawing the heat map…</div>}
        {data?.pending && <div className="ex-heat-wait">The heat map arrives with the evening data update.</div>}
        {laid.map(({ t, name, lines, up, named, moved, size, pale }) => (
          <button key={t.symbol ?? t.index} type="button" className={`ex-tile${pale ? " pale" : ""}`} title={`${t.name ? niceName(t.name) : name}: ${t.change > 0 ? "+" : ""}${t.change.toFixed(2)}%`}
            aria-label={`${t.name ? niceName(t.name) : name}, ${t.change >= 0 ? "up" : "down"} ${Math.abs(t.change).toFixed(2)}% over ${words}`}
            onClick={() => (t.symbol ? onOpenStock(t.symbol) : onOpenIndex(t.index))}
            style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: heatColor(t.change, limit) }}>
            {named && <span className={`ex-tile-name${up ? " up" : ""}`} style={{ fontSize: size }}>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}</span>}
            {moved && <span className="ex-tile-chg" style={{ fontSize: Math.max(8, Math.min(size * 0.8, 15)) }}>{t.change > 0 ? "+" : ""}{t.change.toFixed(2)}%</span>}
          </button>
        ))}
      </div>
      <div className="ex-heat-key">
        <span>{set === "sectors" ? "Each sector's index" : `Size: market value${data?.members && data.items.length < data.members ? ` · ${data.items.length} of ${data.members} companies` : ""}`} · colour: the move over {words}{data?.asOf ? ` to the close on ${shortDate(data.asOf)}` : ""}</span>
        <span className="ex-heat-scale" aria-hidden="true"><i style={{ background: heatColor(-limit, limit) }} />−{limit}%<i style={{ background: "var(--s3)" }} />0<i style={{ background: heatColor(limit, limit) }} />+{limit}%</span>
      </div>
    </section>
  );
}

// ---- Top movers and the week's results ------------------------------------------

const crShort = v => (v >= 100000 ? `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);

function TopMovers({ onOpenStock }) {
  const [period, setPeriod] = useState("1d");
  const [side, setSide] = useState("gainers");
  const [data, setData] = useState(null);
  useEffect(() => { setData(null); api.movers(period).then(setData).catch(() => setData({ gainers: [], losers: [] })); }, [period]);
  const list = data?.[side] ?? [];
  const [, , , words] = HEAT_PERIODS.find(([p]) => p === period);
  return (
    <section className="ex-section" aria-labelledby="ex-movers">
      <h3 className="ex-h" id="ex-movers">Top movers</h3>
      <div className="ex-heat-bar">
        <div className="ex-ranges ex-heat-periods" role="group" aria-label="Rises or falls">
          {[["gainers", "Gainers"], ["losers", "Losers"]].map(([id, l]) => <button key={id} type="button" className="ex-range" aria-pressed={side === id} onClick={() => setSide(id)}>{l}</button>)}
        </div>
        <div className="ex-ranges ex-heat-periods" role="group" aria-label="Movers over">
          {HEAT_PERIODS.map(([p, l]) => <button key={p} type="button" className="ex-range" aria-pressed={period === p} onClick={() => setPeriod(p)}>{l}</button>)}
        </div>
      </div>
      {data == null
        ? <div className="nw-skel" role="status" aria-label="Loading the movers">{[0, 1, 2].map(i => <span key={i} />)}</div>
        : list.length
          ? <ol className="nw-list ex-movers-list">
            {list.map((m, k) => (
              <li key={m.symbol}>
                <button type="button" className="nw-row compact" onClick={() => onOpenStock(m.symbol)}>
                  <span className="ex-rank">{k + 1}</span>
                  <span className="nw-mark"><CompanyLogo symbol={m.symbol} size={36} fallback={m.name} /></span>
                  <span className="nw-main">
                    <span className="nw-top"><span className="nw-who">{niceName(m.name)}</span><span className="nw-spacer" /><span className={`ex-pill ${m.change >= 0 ? "up" : "down"}`}>{m.change > 0 ? "+" : "−"}{Math.abs(m.change).toFixed(2)}%</span></span>
                    <span className="nw-subject">₹{m.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })} · {crShort(m.marketCapCr)}</span>
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

const weekday = d => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
function ResultsWeek({ onOpenStock }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});
  useEffect(() => { api.resultsWeek().then(setData).catch(() => setData({ days: [] })); }, []);
  if (!data?.days?.length) return null;
  const SHOWN = 6;
  return (
    <section className="ex-section" aria-labelledby="ex-results">
      <h3 className="ex-h" id="ex-results">Results this week</h3>
      <div className="ex-days">
        {data.days.map(day => {
          const all = open[day.date], list = all ? day.companies : day.companies.slice(0, SHOWN);
          const tomorrow = new Date(Date.parse(`${data.today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
          return (
            <div key={day.date} className="ex-day">
              <div className="ex-day-head"><b>{day.date === data.today ? "Today" : day.date === tomorrow ? "Tomorrow" : weekday(day.date)}</b><span>{day.count} {day.count === 1 ? "company" : "companies"}</span></div>
              <div className="ex-day-list">
                {list.map(c => (
                  <button key={c.symbol} type="button" className="ex-co" onClick={() => onOpenStock(c.symbol)} title={niceName(c.name)}>
                    <CompanyLogo symbol={c.symbol} size={22} fallback={c.name} />
                    <span>{niceName(c.name)}</span>
                  </button>
                ))}
                {day.count > SHOWN && <button type="button" className="ex-more" onClick={() => setOpen(o => ({ ...o, [day.date]: !all }))}>{all ? "Fewer" : `+${day.count - SHOWN} more`}</button>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="nw-note">Board meetings for results on NSE's calendar, the largest companies first.</p>
    </section>
  );
}

export default function ExploreView({ onOpenStock, openId = null, onOpened, openIndexName = null, onIndexOpened }) {
  const [board, setBoard] = useState(null);
  const [index, setIndex] = useState(() => window.history.state?.newsItem ? null : window.history.state?.exploreIndex ?? null);
  const indexRef = useRef(null);
  indexRef.current = index;
  const [newsItem, setNewsItem] = useState(null);
  const [newsOpen, setNewsOpen] = useState(null);
  const listScroll = useRef(0);
  useEffect(() => { api.explore().then(setBoard).catch(() => setBoard({ market: [], sectors: [] })); }, []);
  useEffect(() => {
    // (only when an index was open: Back from a company page is the app's to place)
    const onPop = () => {
      const s = window.history.state ?? {};
      const next = s.newsItem ? null : s.exploreIndex ?? null;
      const wasOpen = indexRef.current;
      setIndex(next);
      if (!next && !s.newsItem && wasOpen) requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
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
      <div hidden={!!index}>
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
                  <Heatmap onOpenStock={onOpenStock} onOpenIndex={openIndex} />
                </>}
            {/* from the companies' own figures: there even before the indices are */}
            <TopMovers onOpenStock={onOpenStock} />
            <ResultsWeek onOpenStock={onOpenStock} />
          </>
        )}
        <NewsView embedded onOpenStock={onOpenStock} openId={newsOpen ?? openId} onOpened={() => { setNewsOpen(null); onOpened?.(); }} onItemChange={setNewsItem} />
      </div>
    </div>
  );
}

