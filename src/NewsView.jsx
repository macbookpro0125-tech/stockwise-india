import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Newspaper, ChevronRight, Fuel, Globe, Landmark, ChartColumn, Rocket, IndianRupee, Gem, Scale, ChartLine, Cpu, Building2, Car, Pill, Pickaxe, ShoppingBasket, House, Zap, Shield, Building, Tv, FlaskConical, ChartCandlestick, Construction, WashingMachine, HeartPulse, X } from "lucide-react";
import { api } from "./api.js";
import { explainFiling, explainHeadline } from "./filingTerms.js";
import { compareResults } from "./resultsCompare.js";
import { resultsTable } from "./resultsTable.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { niceName } from "./stockName.js";
import { useWatchlist, watchSaved } from "./watchlist.js";
import Reveal from "./Reveal.jsx";

// The News page (22 Oct 2026: "a news page — do I need to post it daily?").
// It fills itself (server/market-news.js): what listed companies told NSE over
// the last few days, sorted into kinds with paperwork left out, and the day's
// market headlines — a headline, its publisher and a link, the story staying
// on the publisher's site. An item opens in full here: the company's own
// words and its filing, its price, its other announcements and the headlines
// about it; for a headline, the companies it names. The item is its own
// history entry, so Back returns to the list where it was.

const FILTERS = [
  ["all", "All"], ["watchlist", "My watchlist"], ["results", "Results"], ["dividends", "Dividends & splits"],
  ["deals", "Orders & deals"], ["people", "Management"], ["legal", "Ratings & legal"], ["updates", "Company updates"], ["headlines", "Headlines"], ["regulators", "RBI & SEBI"],
];
export const KIND_LABEL = Object.fromEntries(FILTERS.filter(([id]) => id !== "all" && id !== "watchlist").map(([id, label]) => [id, id === "headlines" ? "Headline" : label]));

// A headline's picture (24 Oct 2026, "like others show"): never the
// publisher's photo — the company it names, or an icon for its topic
// (server/market-news.js headlineTopic), tinted by kind
const TOPIC_ICON = {
  rates: Landmark, crude: Fuel, fii: Globe, ipo: Rocket, results: ChartColumn, rupee: IndianRupee, gold: Gem, global: Globe, sebi: Scale, market: ChartLine,
  "Nifty IT": Cpu, "Nifty Bank": Building2, "Nifty PSU Bank": Building2, "Nifty Private Bank": Building2, "Nifty Financial Services": Building2,
  "Nifty Auto": Car, "Nifty Pharma": Pill, "Nifty Healthcare Index": HeartPulse, "Nifty Metal": Pickaxe, "Nifty FMCG": ShoppingBasket,
  "Nifty Realty": House, "Nifty Oil & Gas": Fuel, "Nifty Power": Zap, "Nifty Energy": Zap, "Nifty India Defence": Shield, "Nifty Cement": Building,
  "Nifty Media": Tv, "Nifty Chemicals": FlaskConical, "Nifty Capital Markets": ChartCandlestick, "Nifty Infrastructure": Construction, "Nifty Consumer Durables": WashingMachine,
};
const topicTone = t => (!t ? "" : t.index ? "sector" : t.key);
export function HeadlineThumb({ item, size = 36 }) {
  if (item.companies?.length) return <CompanyLogo symbol={item.companies[0].symbol} size={size} fallback={item.companies[0].name} />;
  if (item.type === "official") return <span className={`nw-thumb official`} style={{ width: size, height: size }}>{item.publisher}</span>;
  const Icon = TOPIC_ICON[item.topic?.index ?? item.topic?.key] ?? Newspaper;
  return <span className={`nw-thumb t-${topicTone(item.topic)}`} style={{ width: size, height: size }}><Icon size={Math.round(size * 0.5)} /></span>;
}

const IST = "Asia/Kolkata";
const istDay = iso => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(iso));
export function dayLabel(iso, now = Date.now()) {
  const day = istDay(iso), today = istDay(now), yesterday = istDay(now - 86_400_000);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST }).format(new Date(iso));
}
export const clock = iso => new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST }).format(new Date(iso));
const fullTime = iso => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: IST }).format(new Date(iso));
const shortDate = d => (d ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`)) : null);

// A quarter ending in September 2026 is Q2 of FY27 (April to March)
export function fyQuarter(fyEnd) {
  const [y, m] = String(fyEnd).split("-").map(Number);
  if (!y || !m) return null;
  return `Q${m >= 4 ? Math.ceil((m - 3) / 3) : 4} FY${String(m >= 4 ? y + 1 : y).slice(2)}`;
}
const crore = v => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 })} cr`;

// A result's figures: the quarter, sales and profit, each against a year earlier
function Figures({ n, wide = false, quarter = true }) {
  if (!n) return null;
  return (
    <span className={`nw-figs${wide ? " wide" : ""}`}>
      {quarter && <span className="nw-fig-q">{fyQuarter(n.quarter)}</span>}
      {n.salesCr != null && <span>Sales {crore(n.salesCr)} <Change value={n.salesYoY} title="On the same quarter a year earlier" /></span>}
      {n.profitCr != null && <span>{n.profitCr < 0 ? "Loss" : "Profit"} {crore(n.profitCr)} <Change value={n.profitYoY} title="On the same quarter a year earlier" /></span>}
    </span>
  );
}

export function Change({ value, title }) {
  if (value == null || !isFinite(value)) return null;
  const up = value > 0.05, down = value < -0.05;
  return <span className={`nw-chg${up ? " up" : down ? " down" : ""}`} title={title}>{up ? "▲" : down ? "▼" : ""}{Math.abs(value).toFixed(1)}%</span>;
}

// One row of the list, a filing or a headline
// The list groups rows under their day; elsewhere (Discover's card, an
// item's page) a row says its day itself
// (on the narrow card, the day alone)
const when = (iso, dated, compact) => { const day = dated ? dayLabel(iso) : "Today"; return day === "Today" ? clock(iso) : compact ? day : `${day}, ${clock(iso)}`; };

export function NewsRow({ item, onOpen, asOf, compact = false, dated = true }) {
  const filing = item.type === "filing";
  return (
    <button type="button" className={`nw-row${compact ? " compact" : ""}`} onClick={() => onOpen(item.id)} aria-label={filing ? `${niceName(item.company)}: ${item.title}` : `${item.publisher ?? "Headline"}: ${item.title}`}>
      <span className="nw-mark" aria-hidden="true">
        {filing ? <CompanyLogo symbol={item.symbol} size={36} fallback={item.company} /> : <HeadlineThumb item={item} />}
      </span>
      <span className="nw-main">
        <span className="nw-top">
          <span className="nw-who">{filing ? niceName(item.company) : item.publisher ?? "News"}</span>
          <span className="nw-time">{when(item.time, dated, compact)}</span>
          <span className="nw-spacer" />
          {filing && <Change value={item.quote?.change1d} title={asOf ? `Change on ${shortDate(asOf)}` : undefined} />}
        </span>
        {filing
          ? <>
            <span className="nw-kind-line"><span className={`nw-kind k-${item.kind}`}>{KIND_LABEL[item.kind]}</span><span className="nw-subject">{item.numbers ? `${fyQuarter(item.numbers.quarter)} results` : compact && item.summary ? item.summary : item.title}</span></span>
            {item.numbers ? <Figures n={item.numbers} quarter={false} /> : item.summary && !compact && <span className="nw-text">{item.summary}</span>}
            {/* the same news filed again that day (its record date, its press release) */}
            {item.also?.length > 0 && !compact && !item.numbers && item.also.map(a => <span key={a.id} className="nw-also">{a.summary ?? a.title}</span>)}
          </>
          : <>
            <span className="nw-headline">{item.title}</span>
            {item.topic && !compact && !item.companies?.length && <span className="nw-topic">{item.topic.label}</span>}
            {item.companies?.length > 0 && !compact && (
              <span className="nw-tags">{item.companies.map(c => <span key={c.symbol} className="nw-tag">{c.symbol}<Change value={c.change1d} /></span>)}</span>
            )}
          </>}
      </span>
    </button>
  );
}

// What the headlines are about today, with how many and the market's move
// for it ("6 stories · IT ▲0.3%"); one narrows the list, again shows all
function TalkedAbout({ topics, topic, onPick }) {
  return (
    <div className="nw-talk" role="group" aria-label="Talked about today">
      <span className="nw-talk-h">Talked about today</span>
      <div className="nw-talk-row">
        {topics.map(t => {
          const Icon = TOPIC_ICON[t.index ?? t.key] ?? Newspaper;
          return (
            <button key={t.key} type="button" className={`nw-talk-chip t-${topicTone(t)}`} aria-pressed={topic === t.key} onClick={() => onPick(topic === t.key ? null : t.key)}>
              <span className="nw-talk-icon" aria-hidden="true"><Icon size={15} /></span>
              <span className="nw-talk-main">
                <span className="nw-talk-label">{t.label}</span>
                <span className="nw-talk-sub">{t.count} {t.count === 1 ? "story" : "stories"}{t.move && <> · <Change value={t.move.changePct} /></>}</span>
              </span>
              {topic === t.key && <X size={14} aria-label="Show all" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// limit: the first few only (a phone's Explore page, whose arrow by the title opens the rest)
function List({ kind, size, onOpen, onCounts, refresh = 0, limit = 0 }) {
  // the starred companies: a star or unstar anywhere reloads the list (its
  // My watchlist, and every kind's count of it), once the change is saved
  const watched = useWatchlist();
  const watchKey = [...watched].sort().join(",");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // a topic from the "Talked about" row narrows the list to it
  const [topic, setTopic] = useState(null);
  const load = useCallback(async before => {
    setBusy(true);
    try {
      await watchSaved();
      const r = await api.news({ kind, before, size, topic });
      setData(d => (before && d ? { ...r, items: [...d.items, ...r.items] } : r));
      if (r.counts) onCounts?.(r.counts);
      setError("");
    } catch (e) { setError(e.message); setData(d => d ?? { items: [], unread: [] }); }
    finally { setBusy(false); }
  }, [kind, size, topic]);
  useEffect(() => { setData(null); load(null); }, [load]);
  useEffect(() => { setTopic(null); }, [kind]);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } load(null); }, [watchKey, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div className="nw-skel" role="status" aria-label="Loading the news">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div>;
  const groups = [];
  for (const item of limit ? data.items.slice(0, limit) : data.items) {
    const label = dayLabel(item.time);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(item);
  }
  return (
    <>
      {error && <p className="nw-note nw-error">{error}</p>}
      {data.unread?.length > 0 && <p className="nw-note">{`Couldn't reach ${data.unread.join(" or ")} just now; showing the rest.`}</p>}
      {!limit && data.topics?.length > 0 && <TalkedAbout topics={data.topics} topic={topic} onPick={setTopic} />}
      {!data.items.length && !error && (
        <p className="nw-empty">{kind === "watchlist" ? "Nothing from your watchlist's companies in the last few days. Star companies to follow their news here." : "Nothing of this kind in the last few days."}</p>
      )}
      {groups.map(g => (
        <section key={g.label} className="nw-day" aria-label={g.label}>
          <h3 className="nw-day-head">{g.label}</h3>
          <div className="nw-list">{g.items.map(item => <NewsRow key={item.id} item={item} onOpen={onOpen} asOf={data.asOf} dated={false} />)}</div>
        </section>
      ))}
      {!limit && data.next && <button type="button" className="btn-ghost nw-more" disabled={busy} onClick={() => load(data.next)}>{busy ? "Loading…" : "Show more"}</button>}
    </>
  );
}

function Quote({ quote, asOf, onOpenStock }) {
  if (!quote) return null;
  return (
    <button type="button" className="nw-quote" onClick={() => onOpenStock(quote.symbol)}>
      <CompanyLogo symbol={quote.symbol} size={40} fallback={quote.name} />
      <span className="nw-quote-main">
        <span className="nw-quote-name">{niceName(quote.name)}</span>
        <span className="nw-quote-sub">
          {quote.price != null && <span>₹{quote.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>}
          {quote.change1d != null && <span>{asOf ? `${shortDate(asOf)} ` : "Day "}<Change value={quote.change1d} /></span>}
          {quote.change1w != null && <span>Week <Change value={quote.change1w} /></span>}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

// The filing's key lines, quoted with their page (server/filing-summary.js):
// read when asked, or straight away when NSE's notice says nothing itself
function FilingLines({ id, auto }) {
  const [state, setState] = useState(null);
  const read = () => {
    setState({ loading: true });
    api.newsFilingLines(id).then(r => setState(r)).catch(e => setState({ error: e.message }));
  };
  useEffect(() => { setState(null); if (auto) read(); }, [id, auto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="nw-section" aria-label="From the filing">
      <h3 className="nw-section-head">From the filing</h3>
      {!state && <button type="button" className="btn-ghost nw-read" onClick={read}><FileText size={15} aria-hidden="true" /> Read its key lines</button>}
      {state?.loading && <p className="nw-note" role="status">Reading the filing…</p>}
      {(state?.error) && <p className="nw-note">{state.error}</p>}
      {state?.evidence?.length > 0 && (
        <>
          <ul className="nw-lines">
            {state.evidence.map((e, i) => <li key={i}><q>{e.text}</q>{e.page && <span className="nw-page">page {e.page}</span>}</li>)}
          </ul>
          <p className="nw-note">Quoted from the filing as read by the app, not summarised. {state.limitation}</p>
        </>
      )}
      {state && !state.loading && !state.error && !state.evidence?.length && <p className="nw-note">No lines stood out; open the filing to read it.</p>}
    </section>
  );
}

// A results announcement: the quarter's figures in sentences, against a year
// earlier and the quarter before, and the last eight quarters as bars
// (resultsCompare.js)

// ---- The results table (24 Oct 2026, after Tijori's, improved) ---------------
// The latest quarter leads, highlighted, with its change on a year earlier and
// on the quarter before beside it; then the two quarters it's measured
// against; and each figure's last eight quarters as a small trend. A phone
// has a card a figure instead of the columns.
const monthYear = end => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${end}T00:00:00Z`));
const fig = (v, unit) => {
  if (v == null) return "—";
  if (unit === "pct") return `${v.toFixed(1)}%`;
  if (unit === "eps") return `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
  return `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 1 })}`;
};
const capText = v => (v == null ? null : v >= 100000 ? `₹${(v / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
function Delta({ value, words, unit }) {
  if (words) return <span className={`rt-delta ${words === "to profit" || words === "smaller loss" ? "up" : "down"}`}>{words === "to profit" ? "Turned to profit" : words === "to loss" ? "Turned to loss" : words === "smaller loss" ? "Smaller loss" : "Larger loss"}</span>;
  if (value == null || !isFinite(value)) return <span className="rt-delta">—</span>;
  const dir = Math.abs(value) < (unit === "pct" ? 1 : 0.05) ? "" : value > 0 ? "up" : "down";
  return <span className={`rt-delta ${dir}`}>{value > 0 ? "+" : value < 0 ? "−" : ""}{unit === "pct" ? `${Math.round(Math.abs(value))} bps` : `${Math.abs(value).toFixed(1)}%`}</span>;
}
function Trend({ points, label }) {
  const vals = points.map(p => p.value);
  if (vals.filter(v => v != null).length < 2) return <span className="rt-trend" />;
  const max = Math.max(...vals.map(v => Math.abs(v ?? 0)), 1e-9), neg = vals.some(v => v < 0);
  // all positive: between the lowest and highest quarter, so the shape shows (the lowest a quarter high)
  const lo = Math.min(...vals.filter(v => v != null)), hi = Math.max(...vals.filter(v => v != null));
  const h = v => (neg ? Math.max(6, (Math.abs(v) / max) * 50) : hi === lo ? 60 : 25 + ((v - lo) / (hi - lo)) * 75);
  return (
    <span className={`rt-trend${neg ? " neg" : ""}`} role="img" aria-label={`${label}, last ${points.length} quarters: ${points.map(p => `${fyQuarter(p.end)} ${p.value == null ? "not reported" : p.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`).join(", ")}`}>
      {points.map((p, i) => (
        <span key={p.end} className={`rt-bar${i === points.length - 1 ? " now" : ""}${p.value < 0 ? " loss" : ""}`} title={`${fyQuarter(p.end)}: ${p.value == null ? "—" : p.value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          style={{ height: `${p.value == null ? 0 : h(p.value)}%` }} />
      ))}
    </span>
  );
}
function ResultsTable({ quarters, valuation }) {
  const t = resultsTable(quarters);
  if (!t?.rows.length) return null;
  const v = valuation ?? {};
  const stats = [["Market cap", capText(v.marketCapCr)], ["P/E", v.pe > 0 ? v.pe.toFixed(1) : null], ["PEG", v.peg != null ? v.peg.toFixed(2) : null]].filter(([, x]) => x);
  return (
    <section className="rt" aria-label="Results table">
      <div className="rt-head">
        <div>
          <span className="nw-said-label">{fyQuarter(t.latest)} results</span>
          <p className="rt-sub">Quarter ended {monthYear(t.latest)} · ₹ crore, EPS in ₹</p>
        </div>
        {stats.length > 0 && (
          <dl className="rt-stats">
            {stats.map(([k, x]) => <div key={k} title={k === "PEG" ? "The P/E divided by three years' yearly profit growth" : undefined}><dt>{k}</dt><dd>{x}</dd></div>)}
          </dl>
        )}
      </div>
      <div className="rt-wide">
        <table className="rt-table">
          <thead>
            <tr>
              <th scope="col" className="rt-name">Figure</th>
              <th scope="col" className="rt-now">{monthYear(t.latest)}</th>
              <th scope="col">YoY</th>
              <th scope="col">QoQ</th>
              <th scope="col" className="rt-then">{t.prev ? monthYear(t.prev) : "Quarter before"}</th>
              <th scope="col" className="rt-then">{t.yago ? monthYear(t.yago) : "Year earlier"}</th>
              <th scope="col" className="rt-tr">Last 8 quarters</th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map(r => (
              <tr key={r.key}>
                <th scope="row" className="rt-name">{r.label}</th>
                <td className="rt-now">{fig(r.latest, r.unit)}</td>
                <td><Delta value={r.yoy} words={r.yoyTurn} unit={r.unit} /></td>
                <td><Delta value={r.qoq} words={r.qoqTurn} unit={r.unit} /></td>
                <td className="rt-then">{fig(r.prev, r.unit)}</td>
                <td className="rt-then">{fig(r.yago, r.unit)}</td>
                <td className="rt-tr"><Trend points={r.trend} label={r.label} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rt-cards">
        {t.rows.map(r => (
          <div key={r.key} className="rt-card">
            <div className="rt-card-top">
              <span className="rt-card-name">{r.label}</span>
              <Trend points={r.trend} label={r.label} />
            </div>
            <div className="rt-card-val">{fig(r.latest, r.unit)}</div>
            <div className="rt-card-ch"><span>YoY <Delta value={r.yoy} words={r.yoyTurn} unit={r.unit} /></span><span>QoQ <Delta value={r.qoq} words={r.qoqTurn} unit={r.unit} /></span></div>
            <div className="rt-card-then">{t.prev && <span>{monthYear(t.prev)} {fig(r.prev, r.unit)}</span>}{t.yago && <span>{monthYear(t.yago)} {fig(r.yago, r.unit)}</span>}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultsCompare({ numbers, quarters, bars = true }) {
  const c = quarters?.[0]?.end === numbers.quarter ? compareResults(quarters) : null;
  return (
    <section className="nw-numbers" aria-label="How the results compare">
      <span className="nw-said-label">How the {fyQuarter(numbers.quarter)} results compare</span>
      {c
        ? <ul className="nw-compare">{c.lines.map(l => <li key={l}>{l}</li>)}</ul>
        : <Figures n={numbers} wide />}
      {bars && c?.bars.length > 1 && <QuarterBars bars={c.bars} />}
      <span className="nw-numbers-note">As the app reads them from the company's results filings; the filing has the full statement. Figures, not a view on the shares.</span>
    </section>
  );
}

// Sales and profit, quarter by quarter, oldest on the left; the latest marked
function QuarterBars({ bars }) {
  const rows = [["Sales", "salesCr"], ["Profit", "profitCr"]].filter(([, k]) => bars.some(b => b[k] != null));
  return (
    <div className="nw-qbars">
      {rows.map(([label, k]) => {
        const max = Math.max(...bars.map(b => Math.abs(b[k] ?? 0)), 1);
        const neg = bars.some(b => (b[k] ?? 0) < 0);
        return (
          <div key={k} className="nw-qbar-row">
            <span className="nw-qbar-label">{label}</span>
            <div className={`nw-qbar-plot${neg ? " neg" : ""}`} role="img"
              aria-label={`${label} by quarter: ${bars.map(b => `${fyQuarter(b.end)} ${b[k] == null ? "not reported" : `₹${Math.round(b[k]).toLocaleString("en-IN")} crore`}`).join(", ")}`}>
              {bars.map((b, i) => {
                const v = b[k];
                const h = v == null ? 0 : Math.max(3, (Math.abs(v) / max) * 100);
                const bar = <span className={`nw-qbar${i === bars.length - 1 ? " now" : ""}${v < 0 ? " loss" : ""}`} style={{ height: `${h}%` }} />;
                // with a loss among them: profits above a middle line, losses below it
                return (
                  <span key={b.end} className="nw-qcol" title={`${fyQuarter(b.end)}: ${v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")} cr`}`}>
                    {neg ? <><span className="nw-qhalf up">{v > 0 && bar}</span><span className="nw-qhalf down">{v < 0 && bar}</span></> : bar}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="nw-qbar-ends" aria-hidden="true"><span>{fyQuarter(bars[0].end)}</span><span>{fyQuarter(bars[bars.length - 1].end)}</span></div>
    </div>
  );
}

// What the announcement is, in plain words: its kind, and the market terms it
// uses (filingTerms.js) — what the words mean, not a view on the company
function Plain({ item }) {
  const { kind, terms } = explainFiling({ title: [item.title, ...(item.also ?? []).map(a => a.title)].join(" "), summary: [item.summary, ...(item.also ?? []).map(a => a.summary)].filter(Boolean).join(" "), kind: item.kind });
  if (!kind && !terms.length) return null;
  return (
    <section className="nw-plain" aria-label="What this means">
      <span className="nw-said-label">What this means</span>
      {kind && <p className="nw-plain-kind">{kind}</p>}
      {terms.length > 0 && (
        <dl className="nw-terms">
          {terms.map(t => <div key={t.term}><dt>{t.term}</dt><dd>{t.means}</dd></div>)}
        </dl>
      )}
      <p className="nw-plain-note">What these words mean in general, not a view on this company.</p>
    </section>
  );
}

function Detail({ id, onBack, onOpen, onOpenStock }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null); setError("");
    api.newsItem(id).then(setData).catch(e => setError(e.message));
    window.scrollTo(0, 0);
  }, [id]);
  const back = <button type="button" className="nw-back" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" /> News</button>;
  if (error) return <div className="nw-detail">{back}<p className="nw-empty">{error}</p></div>;
  if (!data) return <div className="nw-detail">{back}<div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div></div>;
  const { item } = data;
  if (item.type === "filing") return (
    <article className="nw-detail" aria-label={`${niceName(item.company)}: ${item.title}`}>
      {back}
      <p className="nw-eyebrow"><span className={`nw-kind k-${item.kind}`}>{KIND_LABEL[item.kind]}</span><span>{fullTime(item.time)}</span></p>
      <h2 className="nw-title">{niceName(item.company)}</h2>
      <p className="nw-byline">{item.title} · announced to NSE</p>
      {/* results: the table across the page when the quarter on file is this one */}
      {item.kind === "results" && item.numbers && data.quarters?.[0]?.end === item.numbers.quarter && <ResultsTable quarters={data.quarters} valuation={data.valuation} />}
      {/* a wide screen: the announcement on the left, the company and more beside it */}
      <div className="dt-cols">
      <div className="dt-main">
      {item.summary
        ? <blockquote className="nw-said"><span className="nw-said-label">In the company's words</span>{item.summary}</blockquote>
        : <p className="nw-note">NSE's notice has no summary; the details are in the filing.</p>}
      <Plain item={item} />
      {item.also?.length > 0 && item.also.map(a => (
        <blockquote key={a.id} className="nw-said nw-said-also"><span className="nw-said-label">Also that day · {a.title} · {clock(a.time)}</span>{a.summary ?? a.title}</blockquote>
      ))}
      {item.kind === "results" && (item.numbers
        ? <>
          <ResultsCompare numbers={item.numbers} quarters={data.quarters} bars={data.quarters?.[0]?.end !== item.numbers.quarter} />
        </>
        : <p className="nw-note">The figures reach the app with the evening data update.</p>)}
      <div className="nw-actions">
        {item.url && <a className="btn-primary nw-btn" href={item.url} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden="true" /> Open the filing{item.fileSize ? ` · ${item.fileSize}` : ""}</a>}
      </div>
      {item.url && <FilingLines id={item.id} auto={!item.summary} />}
      </div>
      <div className="dt-side">
      <Quote quote={item.quote} asOf={data.asOf} onOpenStock={onOpenStock} />
      {data.more?.length > 0 && (
        <section className="nw-section" aria-label={`More from ${niceName(item.company)}`}>
          <h3 className="nw-section-head">More from {niceName(item.company)}</h3>
          <div className="nw-list">{data.more.map(m => <NewsRow key={m.id} item={m} onOpen={onOpen} />)}</div>
        </section>
      )}
      {data.news?.length > 0 && (
        <section className="nw-section" aria-label="In the news">
          <h3 className="nw-section-head">In the news</h3>
          <ul className="nw-links">
            {data.news.map(n => (
              <li key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}<span>{[n.publisher, n.date && dayLabel(n.date)].filter(Boolean).join(" · ")}</span></a></li>
            ))}
          </ul>
        </section>
      )}
      </div>
      </div>
      <p className="nw-foot">From NSE's announcements, as the company filed them. Not investment advice.</p>
    </article>
  );
  const terms = explainHeadline(item.title);
  const official = item.type === "official";
  return (
    <article className="nw-detail" aria-label={item.title}>
      {back}
      <p className="nw-eyebrow"><span className={`nw-kind k-${item.kind}`}>{official ? `${item.publisher} announcement` : "Headline"}</span><span>{fullTime(item.time)}</span>{item.topic && <span className="nw-topic">{item.topic.label}</span>}</p>
      <div className="nw-head-row">
        <HeadlineThumb item={item} size={52} />
        <div>
          <h2 className="nw-title">{item.title}</h2>
          <p className="nw-byline">{official ? (item.publisher === "RBI" ? "Reserve Bank of India" : "Securities and Exchange Board of India") : item.publisher ?? "A news site"}{data.others?.length > 0 ? ` and ${data.others.length} more` : ""}</p>
        </div>
      </div>
      {/* a wide screen: the story's context on the left, the market and related headlines beside it */}
      <div className="dt-cols">
      <div className="dt-main">
      <div className="nw-actions">
        <a className="btn-primary nw-btn" href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" /> {official ? `Read it on ${item.publisher}'s website` : `Read the story${item.publisher ? ` on ${item.publisher}` : ""}`}</a>
      </div>
      <p className="nw-note">{official ? `The full text is on ${item.publisher}'s website.` : "The story is on the publisher's site."} Around it here: the app's own figures for what it's about.</p>
      {data.others?.length > 0 && (
        <section className="nw-section" aria-label="Also reported by">
          <h3 className="nw-section-head">Also reported by</h3>
          <ul className="nw-links">
            {data.others.map(o => <li key={o.url}><a href={o.url} target="_blank" rel="noopener noreferrer">{o.title}<span>{o.publisher} · {clock(o.time)}</span></a></li>)}
          </ul>
        </section>
      )}
      {terms.length > 0 && (
        <section className="nw-plain" aria-label="What the words mean">
          <span className="nw-said-label">What the words mean</span>
          <dl className="nw-terms">{terms.map(t => <div key={t.term}><dt>{t.term}</dt><dd>{t.means}</dd></div>)}</dl>
          <p className="nw-plain-note">What these words mean in general, not what this story says.</p>
        </section>
      )}
      {data.sectors?.map(sec => <SectorPanel key={sec.name} sector={sec} asOf={data.boardAsOf ?? data.asOf} onOpenStock={onOpenStock} />)}
      {data.companies?.length > 0 && (
        <section className="nw-section" aria-label="Companies it names">
          <h3 className="nw-section-head">Companies it names</h3>
          {data.companies.map(c => (
            <div key={c.symbol} className="nw-company">
              <Quote quote={c} asOf={data.asOf} onOpenStock={onOpenStock} />
              {c.announced?.length > 0 && <div className="nw-list">{c.announced.map(m => <NewsRow key={m.id} item={m} onOpen={onOpen} />)}</div>}
            </div>
          ))}
        </section>
      )}
      </div>
      <div className="dt-side">
      {data.market?.length > 0 && (
        <section className="nw-section" aria-label="The market">
          <h3 className="nw-section-head">The market{data.boardAsOf ? ` at the close on ${shortDate(data.boardAsOf)}` : ""}</h3>
          <div className="nw-list nw-idx-list">{data.market.map(i => <IndexLine key={i.name} index={i} />)}</div>
        </section>
      )}
      {data.related?.length > 0 && (
        <section className="nw-section" aria-label="Related headlines">
          <h3 className="nw-section-head">Related headlines</h3>
          <div className="nw-list">{data.related.map(r => <NewsRow key={r.id} item={r} onOpen={onOpen} compact />)}</div>
        </section>
      )}
      </div>
      </div>
      <p className="nw-foot">The headline as published; the figures are the app's own, from NSE. Not investment advice.</p>
    </article>
  );
}

// An index in a line: its name, a month of closes, the close and the day's move
const idxName = n => n.replace(/^nifty/i, "NIFTY").replace(/ index$/i, "");
function MiniSpark({ closes, up }) {
  const v = (closes ?? []).filter(c => c != null);
  if (v.length < 2) return <span className="nw-mini" />;
  const min = Math.min(...v), max = Math.max(...v);
  const pts = v.map((c, i) => `${((i / (v.length - 1)) * 100).toFixed(1)},${(max === min ? 12 : 22 - ((c - min) / (max - min)) * 20).toFixed(1)}`).join(" ");
  return <svg className={`nw-mini ${up ? "up" : "down"}`} viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /></svg>;
}
function IndexLine({ index: i }) {
  return (
    <div className="nw-idx">
      <span className="nw-idx-name">{idxName(i.name)}</span>
      <MiniSpark closes={i.spark} up={i.changePct >= 0} />
      <span className="nw-idx-val">{i.close.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<Change value={i.changePct} /></span>
    </div>
  );
}

// A sector the headline is about: its index, and its companies that moved most that day
function SectorPanel({ sector: s, asOf, onOpenStock }) {
  const lists = [["Rose most", "up", s.gainers], ["Fell most", "down", s.losers]].filter(([, , l]) => l?.length);
  return (
    <section className="nw-section" aria-label={idxName(s.name)}>
      <h3 className="nw-section-head">The sector it's about{asOf ? `, on ${shortDate(asOf)}` : ""}</h3>
      {s.index && <div className="nw-list nw-idx-list"><IndexLine index={s.index} /></div>}
      {lists.length > 0 && (
        <div className="nw-sec-movers">
          {lists.map(([t, cls, list]) => (
            <div key={t}>
              <p className={`nw-sec-h ${cls}`}>{t}</p>
              <div className="nw-list">
                {list.map(q => (
                  <button key={q.symbol} type="button" className="nw-row compact" onClick={() => onOpenStock(q.symbol)}>
                    <span className="nw-mark"><CompanyLogo symbol={q.symbol} size={32} fallback={q.name} /></span>
                    <span className="nw-main"><span className="nw-top"><span className="nw-who">{niceName(q.name)}</span><span className="nw-spacer" /><Change value={q.change1d} /></span>
                      {q.price != null && <span className="nw-subject">₹{q.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {s.companies > 0 && <p className="nw-note">Its companies over ₹1,000 crore ({s.companies}), by their move on the day.</p>}
    </section>
  );
}

// Discover's fourth way in on a computer (23 Oct 2026: "news should be
// somewhat different, it is mixed in"): not a slogan like the other three
// but the news itself — the latest three, live — set apart by its look
function tileLine(item) {
  if (item.type === "headline") return item.title;
  if (item.numbers) {
    const n = item.numbers;
    return <>{fyQuarter(n.quarter)} results · {n.profitCr < 0 ? "Loss" : "Profit"} {crore(n.profitCr ?? 0)} <Change value={n.profitYoY} /></>;
  }
  return item.summary ?? item.title;
}
// It moves, as the price strip does: nine items, three at a time, the next
// three every 6 s; still while a pointer or focus is on it, or with reduced
// motion; the dots choose a set
const TILE_SHOWN = 3, TILE_EVERY = 6000;
export function NewsTile({ onOpen, onSeeAll }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => { api.newsTop(9).then(setData).catch(() => setData({ items: [] })); }, []);
  const pages = Math.max(1, Math.ceil((data?.items?.length ?? 0) / TILE_SHOWN));
  useEffect(() => {
    if (pages < 2 || held || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setPage(p => (p + 1) % pages), TILE_EVERY);
    return () => clearInterval(t);
  }, [pages, held]);
  const shown = data?.items?.slice(page * TILE_SHOWN, page * TILE_SHOWN + TILE_SHOWN) ?? [];
  return (
    <Reveal as="section" delay={3} className="ap-tile ap-tile-news" aria-labelledby="ap-news-title"
      onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
      <span className="ap-news-eyebrow"><span className="ap-live" aria-hidden="true" />Live from NSE</span>
      <h3 id="ap-news-title" className="ap-news-title">What's new today</h3>
      <div className="ap-news-items" key={page} aria-live="off">
        {data == null
          ? [0, 1, 2].map(i => <span key={i} className="ap-news-skel" />)
          : shown.length
            ? shown.map(item => (
              <button key={item.id} type="button" className="ap-news-item" onClick={() => onOpen(item.id)}>
                <span className="ap-news-mark" aria-hidden="true">{item.type === "filing" ? <CompanyLogo symbol={item.symbol} size={40} fallback={item.company} /> : <HeadlineThumb item={item} size={40} />}</span>
                <span className="ap-news-top">
                  <span className="ap-news-who">{item.type === "filing" ? niceName(item.company) : item.publisher ?? "News"}</span>
                  <span className="ap-news-when">{when(item.time, true, true)}</span>
                </span>
                {item.type === "filing" && <span className={`nw-kind k-${item.kind}`}>{KIND_LABEL[item.kind]}</span>}
                <span className="ap-news-what">{tileLine(item)}</span>
              </button>
            ))
            : <p className="ap-news-empty">Nothing new from NSE just now.</p>}
      </div>
      <div className="ap-news-foot">
        <button type="button" className="ap-tile-link ap-news-link" onClick={onSeeAll}>Read the news<ChevronRight size={17} aria-hidden="true" /></button>
        {pages > 1 && (
          <span className="ap-news-dots" role="group" aria-label="More news">
            {Array.from({ length: pages }, (_, i) => <button key={i} type="button" aria-label={`News ${i * TILE_SHOWN + 1} to ${Math.min((i + 1) * TILE_SHOWN, data.items.length)}`} aria-pressed={page === i} onClick={() => setPage(i)} />)}
          </span>
        )}
      </div>
    </Reveal>
  );
}

// Discover's card: the three latest from large companies, and the way in
export function MarketNewsCard({ onOpen, onSeeAll }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.newsTop().then(setData).catch(() => setData({ items: [] })); }, []);
  if (data && !data.items.length) return null;
  return (
    <section className="nw-card" aria-labelledby="nw-card-title">
      <div className="nw-card-head">
        <h3 id="nw-card-title">Market news</h3>
        <button type="button" className="nw-see-all" onClick={onSeeAll}>See all <ChevronRight size={16} aria-hidden="true" /></button>
      </div>
      {data
        ? <div className="nw-list">{data.items.map(item => <NewsRow key={item.id} item={item} onOpen={onOpen} asOf={data.asOf} compact />)}</div>
        : <div className="nw-skel" role="status" aria-label="Loading the news">{[0, 1, 2].map(i => <span key={i} />)}</div>}
    </section>
  );
}

export default function NewsView({ onOpenStock, openId = null, onOpened, embedded = false, onItemChange, preview = false, onSeeAll }) {
  const [kind, setKind] = useState("all");
  const [counts, setCounts] = useState(null);
  // pressing the kind already shown loads it again
  const [refresh, setRefresh] = useState(0);
  const pickKind = id => { if (id === kind) setRefresh(n => n + 1); else setKind(id); };
  // Companies over ₹1,000 crore only, unless switched off; kept for the visit
  const [size, setSize] = useState(() => { try { return sessionStorage.getItem("news-size") === "all" ? "all" : "large"; } catch { return "large"; } });
  const pickSize = next => { setSize(next); try { sessionStorage.setItem("news-size", next); } catch {} };
  const [item, setItem] = useState(null);
  const itemRef = useRef(null);
  itemRef.current = item;
  const listScroll = useRef(0);
  // An item is a history entry of its own: Back (the browser's, Android's,
  // or the page's) returns to the list where it was
  const open = id => {
    if (!item) listScroll.current = window.scrollY;
    window.history.pushState({ ...(window.history.state ?? {}), newsItem: id }, "");
    setItem(id);
  };
  useEffect(() => {
    // (only when an item was open: Back from a company page is the app's to place)
    const onPop = () => {
      const id = window.history.state?.newsItem ?? null;
      const wasOpen = itemRef.current;
      setItem(id);
      if (!id && wasOpen) requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // The Explore page shows its indices only while no item is open
  useEffect(() => { onItemChange?.(item); }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  // From Discover's card: straight to its item
  useEffect(() => { if (openId) { open(openId); onOpened?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`nw-page${embedded ? " embedded" : ""}`}>
      {item
        ? <Detail id={item} onBack={() => window.history.back()} onOpen={open} onOpenStock={onOpenStock} />
        : <>
          <div className="nw-head">
            {/* on the Explore page, a section under the indices */}
            {embedded
              ? <div className="ex-h-row">
                <h3 className="ex-h" id="ex-news">News</h3>
                {preview && <button type="button" className="ex-h-more" aria-label="See all the news" title="See all the news" onClick={onSeeAll}><ChevronRight size={20} aria-hidden="true" /></button>}
              </div>
              : <h2 className="nw-page-title hide-phone">News</h2>}
            <p className="nw-lede">{preview ? "The latest from listed companies and the market's headlines." : "What listed companies told NSE over the last few days, and the market's headlines. Updated through the day."}</p>
            {!preview && <button type="button" role="switch" aria-checked={size === "large"} className="nw-size" onClick={() => pickSize(size === "large" ? "all" : "large")}>
              <span className="st-switch nw-switch" data-on={size === "large"} aria-hidden="true"><span /></span>
              Only companies over ₹1,000 crore
            </button>}
          </div>
          <div className="nw-layout">
            {/* a computer: the kinds down the side with how many of each; a
                phone: one row of chips to swipe */}
            <div className="nw-rail" role="group" aria-label="Kinds of news">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" className="nw-rail-item" aria-pressed={kind === id} onClick={() => pickKind(id)}>
                  <span>{label}</span>{counts?.[id] != null && <span className="nw-count">{counts[id]}</span>}
                </button>
              ))}
            </div>
            <div className="nw-feed">
              <div className="ph-chips nw-filters" role="group" aria-label="Kinds of news">
                {FILTERS.map(([id, label]) => <button key={id} type="button" className="ph-chip" aria-pressed={kind === id} onClick={() => pickKind(id)}>{label}</button>)}
              </div>
              <List kind={kind} size={size} onOpen={open} onCounts={setCounts} refresh={refresh} limit={preview ? 4 : 0} />
            </div>
          </div>
        </>}
    </div>
  );
}
