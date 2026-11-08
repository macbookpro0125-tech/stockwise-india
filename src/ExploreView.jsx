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

// The index's figures in one strip: NSE's valuation, and a sector's size
function IndexStats({ d, brief }) {
  const cells = [
    d.pe && ["P/E", d.pe.toFixed(1), "NSE's, for the index"],
    d.pb && ["P/B", d.pb.toFixed(2), null],
    d.divYield && ["Dividend yield", `${d.divYield.toFixed(2)}%`, null],
    brief && ["Companies", brief.count.toLocaleString("en-IN"), d.sector],
    brief && ["Worth together", crShort(brief.marketCapCr), "market value"],
    brief?.medianPe && ["Middle company P/E", brief.medianPe.toFixed(1), "half above, half below"],
  ].filter(Boolean);
  if (!cells.length) return null;
  return (
    <section className="ix-stats" aria-label="Valuation">
      {cells.map(([l, v, sub]) => <div key={l}><span>{l}</span><b>{v}</b>{sub && <small>{sub}</small>}</div>)}
    </section>
  );
}

// Returns over each span, beside the Nifty 50's, and how far ahead or behind
function IndexReturns({ d }) {
  const b = d.benchmark;
  const scale = Math.max(1, ...RETURNS.flatMap(([k]) => [Math.abs(d.returns[k] ?? 0), Math.abs(b?.[k] ?? 0)]));
  return (
    <section className="ix-card" aria-label="Returns">
      <h3 className="ix-h">Returns{b && <span className="ix-h-sub">against the Nifty 50</span>}</h3>
      <div className={`ix-rets${b ? " vs" : ""}`}>
        <span className="ix-rets-head" aria-hidden="true"><span /><span /><span>{label(d.name)}</span>{b && <><span>Nifty 50</span><span>Ahead by</span></>}</span>
        {RETURNS.map(([k, l]) => {
          const v = d.returns[k], n = b?.[k], gap = v != null && n != null ? v - n : null;
          return (
            <div key={k} className="ix-ret">
              <span className="ex-ret-label">{l}</span>
              <span className="ex-ret-track" aria-hidden="true">{v != null && <span className={`ex-ret-bar ${tone(v)}`} style={{ "--w": `${(Math.abs(v) / scale) * 50}%` }} />}</span>
              {v != null ? <Change value={v} /> : <span className="ex-na">—</span>}
              {b && <span className="ix-muted">{n != null ? `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}%` : "—"}</span>}
              {b && <span className={`ix-gap ${gap == null ? "" : gap >= 0 ? "up" : "down"}`}>{gap == null ? "—" : `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)} pts`}</span>}
            </div>
          );
        })}
      </div>
      <p className="nw-note">Price returns from NSE's closes, without dividends; 3 and 5 years are a year on average.</p>
    </section>
  );
}

// The sector's middle P/E at each year-end, and now
function PeYears({ brief }) {
  const list = [...brief.peYears.map(y => ({ l: `Mar ${y.year.slice(2)}`, pe: y.pe })), ...(brief.medianPe ? [{ l: "Now", pe: brief.medianPe, now: true }] : [])];
  const max = Math.max(...list.map(y => y.pe));
  const past = brief.peYears.map(y => y.pe);
  const avg = past.reduce((t, v) => t + v, 0) / past.length;
  const vs = brief.medianPe ? (brief.medianPe / avg - 1) * 100 : null;
  return (
    <section className="ix-card" aria-label="P/E over the years">
      <h3 className="ix-h">Middle P/E over the years</h3>
      <div className="ix-pe" role="img" aria-label={list.map(y => `${y.l} ${y.pe.toFixed(1)}`).join(", ")}>
        {list.map(y => (
          <span key={y.l} className={`ix-pe-col${y.now ? " now" : ""}`}>
            <span className="ix-pe-v">{y.pe.toFixed(0)}</span>
            <span className="ix-pe-bar" style={{ height: `${Math.max(8, (y.pe / max) * 120)}px` }} />
            <span className="ix-pe-l">{y.l}</span>
          </span>
        ))}
      </div>
      {vs != null && <p className="ix-pe-say">Now <b>{Math.abs(vs).toFixed(0)}% {vs >= 0 ? "above" : "below"}</b> its average of {avg.toFixed(1)} over these year-ends.</p>}
      <p className="nw-note">Each year the middle of its companies' own P/Es at the year-end price. A figure, not a call on the shares.</p>
    </section>
  );
}

// The sector's companies, largest first; a column's title sorts by it
const CO_COLS = [["name", "Company"], ["close", "Price"], ["d1", "1D"], ["m1", "1M"], ["y1", "1Y"], ["down52", "Off 52w high"], ["pe", "P/E"], ["roe", "ROE"], ["quality", "Quality"], ["marketCapCr", "Market value"]];
function IndexCompanies({ rows, onOpenStock, sector }) {
  const [sort, setSort] = useState(["marketCapCr", -1]);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const [k, dir] = sort;
    return [...rows].sort((a, b) => k === "name" ? dir * niceName(a.name).localeCompare(niceName(b.name)) : (a[k] == null) - (b[k] == null) || dir * ((a[k] ?? 0) - (b[k] ?? 0)));
  }, [rows, sort]);
  const shown = all ? sorted : sorted.slice(0, 15);
  const pctCell = v => (v == null ? <span className="ex-na">—</span> : <Change value={v} />);
  const cell = (r, k) => {
    if (k === "close") return r.close != null ? `₹${r.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
    if (k === "d1" || k === "m1" || k === "y1") return pctCell(r[k]);
    if (k === "down52") return r.down52 != null ? `${r.down52.toFixed(1)}%` : "—";
    if (k === "pe") return r.pe != null ? r.pe.toFixed(1) : "—";
    if (k === "roe") return r.roe != null ? `${r.roe.toFixed(1)}%` : "—";
    if (k === "quality") return r.quality != null ? Math.round(r.quality) : "—";
    if (k === "marketCapCr") return crShort(r.marketCapCr);
    return null;
  };
  return (
    <section className="ix-card ix-cos" aria-label={`${sector} companies`}>
      <h3 className="ix-h">Its companies<span className="ix-h-sub">{rows.length} measured against this index · tap a title to sort</span></h3>
      <div className="ix-table-wrap">
        <table className="ix-table">
          <thead><tr>{CO_COLS.map(([k, l]) => (
            <th key={k} scope="col" aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : undefined}>
              <button type="button" onClick={() => setSort(([sk, sd]) => [k, sk === k ? -sd : k === "name" || k === "pe" || k === "down52" ? 1 : -1])}>{l}{sort[0] === k && <span aria-hidden="true">{sort[1] > 0 ? " ↑" : " ↓"}</span>}</button>
            </th>
          ))}</tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.symbol} onClick={() => onOpenStock(r.symbol)}>
              <th scope="row"><button type="button" onClick={e => { e.stopPropagation(); onOpenStock(r.symbol); }}><CompanyLogo symbol={r.symbol} size={22} fallback={r.name} /><span><b>{niceName(r.name)}</b><small>{r.industry ?? r.symbol}</small></span></button></th>
              {CO_COLS.slice(1).map(([k]) => <td key={k}>{cell(r, k)}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {rows.length > 15 && <button type="button" className="ix-more" onClick={() => setAll(a => !a)}>{all ? "Show the first 15" : `Show all ${rows.length}`}</button>}
    </section>
  );
}

// An index in full
function IndexDetail({ name, onBack, onOpenStock, onOpenNews }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState("1Y");
  useEffect(() => { setD(null); api.exploreIndex(name).then(setD).catch(e => setError(e.message)); window.scrollTo(0, 0); }, [name]);
  // a sector's brief: its value, middle P/E over the years, industries, results due
  const [brief, setBrief] = useState(null);
  useEffect(() => { setBrief(null); if (d?.sector) api.sectorBrief(d.sector, "1m").then(setBrief).catch(() => {}); }, [d?.sector]);
  const back = <button type="button" className="nw-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> Back</button>;
  if (error) return <div className="ex-detail">{back}<p className="nw-empty">{error}</p></div>;
  if (!d) return <div className="ex-detail">{back}<div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div></div>;
  const n = RANGES.find(([r]) => r === range)[1];
  const closes = n === Infinity ? d.closes : d.closes.slice(-(n + 1));
  const days = n === Infinity ? d.days : d.days.slice(-(n + 1));
  const vix = name === "India VIX";
  const dayDir = tone(d.changePct);
  return (
    <article className="ex-detail" aria-label={label(name)}>
      {back}
      <header className="ex-hero">
        <p className="nw-eyebrow"><span className={`ex-badge ${d.group}`}>{badge(name)}</span><span>{d.group === "sector" ? "Sector index" : "Market index"} · close on {shortDate(d.asOf)}</span></p>
        <h2 className="nw-title ex-title">{name.replace(/^nifty/i, "NIFTY")}</h2>
        <p className="ex-big">{points(d.close)} <span className={`ex-daychg ${dayDir}`}>{signed(d.change)}{points(Math.abs(d.change))} ({signed(d.changePct)}{Math.abs(d.changePct).toFixed(2)}%)</span><span className="ex-big-on">on the day</span></p>
      </header>
      {vix && <p className="nw-note">India VIX is how much the market expects prices to swing over the next 30 days, from NIFTY options: higher means more nervous. It isn't a price.</p>}
      {/* 8 Nov 2026 ("charts are not full width … go deep and add useful
          things"): the chart across the page, its figures in a strip, then
          returns against the Nifty 50, the P/E over the years, the companies
          to sort, and what's moving, by industry and coming up */}
      <IndexChart days={days} closes={closes} range={range} onRange={setRange} />
      <IndexStats d={d} brief={brief} />
      <div className="ix-grid">
        {!vix && <IndexReturns d={d} />}
        {brief?.peYears?.length > 1 && <PeYears brief={brief} />}
      </div>
      {d.table?.length > 0 && <IndexCompanies rows={d.table} onOpenStock={onOpenStock} sector={d.sector} />}
      <div className="ix-grid three">
        {(d.gainers.length > 0 || d.losers.length > 0) && (
          <section className="ix-card" aria-label="Biggest moves">
            <h3 className="ix-h">Biggest moves on {shortDate(d.asOf)}</h3>
            <p className="nw-note">{d.sector} companies over ₹1,000 crore ({d.companies}).</p>
            {[["Up", d.gainers], ["Down", d.losers]].map(([t, list]) => list.length > 0 && (
              <div key={t}>
                <p className={`ex-movers-h ${t === "Up" ? "up" : "down"}`}>{t === "Up" ? "Rose most" : "Fell most"}</p>
                <ul className="ix-list">
                  {list.map(m => (
                    <li key={m.symbol}><button type="button" onClick={() => onOpenStock(m.symbol)}>
                      <CompanyLogo symbol={m.symbol} size={24} fallback={m.name} /><span className="ix-list-name">{niceName(m.name)}</span><Change value={m.change1d} />
                    </button></li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
        {brief?.industries?.length > 1 && (
          <section className="ix-card" aria-label="Its industries">
            <h3 className="ix-h">Its industries, over the month</h3>
            <ul className="ix-list">
              {brief.industries.slice(0, 10).map(i => (
                <li key={i.name}><span className="ix-list-row"><span className="ix-list-name">{i.name}</span><small>{i.count}</small>{i.change != null ? <Change value={i.change} /> : <span className="ex-na">—</span>}</span></li>
              ))}
            </ul>
            <p className="nw-note">Each industry's move weighted by market value; the number is how many companies.</p>
          </section>
        )}
        {brief && (
          <section className="ix-card" aria-label="Results coming up">
            <h3 className="ix-h">Results in the next two weeks</h3>
            {brief.results.length ? <ul className="ix-list">{brief.results.map(r => (
              <li key={r.symbol}><button type="button" onClick={() => onOpenStock(r.symbol)}>
                <span className="ix-date">{shortDate(r.date)}</span><span className="ix-list-name">{niceName(r.name)}</span><ChevronRight size={14} aria-hidden="true" />
              </button></li>
            ))}</ul> : <p className="nw-note">None on NSE's calendar.</p>}
          </section>
        )}
      </div>
      {d.news?.length > 0 && (
        <section className="nw-section" aria-label={`${label(name)} news`}>
          <h3 className="nw-section-head">{label(name)} news</h3>
          <div className="nw-list">{d.news.map(item => <NewsRow key={item.id} item={item} onOpen={onOpenNews} />)}</div>
        </section>
      )}
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

// 6 Nov 2026: the Markets tab shows the indices, sectors, biggest moves and
// the week's results in full, so a computer's Explore is the news alone (its
// tab is called News there). A phone has no Markets tab: it keeps the
// market's indices in one row, the map, and the way to Markets, above the news.
export default function ExploreView({ onOpenStock, openId = null, onOpened, openIndexName = null, onIndexOpened, onOpenMap, onOpenMarkets }) {
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
      {/* a section's See all is a phone's: a computer shows the news whole */}
      {full && phone && !index && (
        <div className="ex-full">
          {!newsItem && <button type="button" className="nw-back" onClick={() => window.history.back()}><ArrowLeft size={17} aria-hidden="true" /> Explore</button>}
          {full.kind === "movers" && <TopMovers onOpenStock={onOpenStock} start={full} />}
          {full.kind === "results" && <ResultsWeek onOpenStock={onOpenStock} />}
          {full.kind === "news" && <NewsView embedded onOpenStock={onOpenStock} onItemChange={setNewsItem} />}
        </div>
      )}
      <div hidden={!!index || (!!full && phone)}>
        {!newsItem && phone && (
          <>
            <div className="nw-head">
              <p className="nw-lede">{board?.asOf ? `The market's indices at their close on ${shortDate(board.asOf)}, and the news.` : "The market's indices and the news."}</p>
            </div>
            {board == null
              ? <div className="ex-row ex-skel" role="status" aria-label="Loading the indices">{[0, 1, 2, 3].map(i => <span key={i} />)}</div>
              : board.pending
                ? <p className="nw-note">The indices arrive with the evening data update.</p>
                : <Row id="ex-market" title="Market" items={board.market} asOf={board.asOf} onOpen={openIndex} />}
            {onOpenMap && <MapLink onOpen={onOpenMap} />}
            {onOpenMarkets && (
              <section className="ex-section" aria-labelledby="ex-markets-link">
                <button type="button" className="ex-map-link ex-markets-link" onClick={onOpenMarkets}>
                  <span className="ex-map-link-text">
                    <span className="ex-map-link-title" id="ex-markets-link">Markets</span>
                    <span className="ex-map-link-sub">Sectors, the biggest moves and this week's results</span>
                  </span>
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </section>
            )}
          </>
        )}
        {!(full && phone) && <NewsView embedded={phone} preview={phone} onSeeAll={() => openFull({ kind: "news" })} onOpenStock={onOpenStock} openId={newsOpen ?? openId} onOpened={() => { setNewsOpen(null); onOpened?.(); }} onItemChange={setNewsItem} />}
      </div>
    </div>
  );
}

