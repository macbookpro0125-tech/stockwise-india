import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Newspaper, ChevronRight } from "lucide-react";
import { api } from "./api.js";
import CompanyLogo from "./CompanyLogo.jsx";
import { niceName } from "./stockName.js";

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
  ["deals", "Orders & deals"], ["people", "Management"], ["legal", "Ratings & legal"], ["updates", "Company updates"], ["headlines", "Headlines"],
];
export const KIND_LABEL = Object.fromEntries(FILTERS.filter(([id]) => id !== "all" && id !== "watchlist").map(([id, label]) => [id, id === "headlines" ? "Headline" : label]));

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
        {filing ? <CompanyLogo symbol={item.symbol} size={36} fallback={item.company} /> : <span className="nw-paper"><Newspaper size={18} /></span>}
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
            {item.companies?.length > 0 && !compact && (
              <span className="nw-tags">{item.companies.map(c => <span key={c.symbol} className="nw-tag">{c.symbol}<Change value={c.change1d} /></span>)}</span>
            )}
          </>}
      </span>
    </button>
  );
}

function List({ kind, size, onOpen, onCounts }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async before => {
    setBusy(true);
    try {
      const r = await api.news({ kind, before, size });
      setData(d => (before && d ? { ...r, items: [...d.items, ...r.items] } : r));
      if (r.counts) onCounts?.(r.counts);
      setError("");
    } catch (e) { setError(e.message); setData(d => d ?? { items: [], unread: [] }); }
    finally { setBusy(false); }
  }, [kind, size]);
  useEffect(() => { setData(null); load(null); }, [load]);

  if (!data) return <div className="nw-skel" role="status" aria-label="Loading the news">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div>;
  const groups = [];
  for (const item of data.items) {
    const label = dayLabel(item.time);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(item);
  }
  return (
    <>
      {error && <p className="nw-note nw-error">{error}</p>}
      {data.unread?.length > 0 && <p className="nw-note">{`Couldn't reach ${data.unread.join(" or ")} just now; showing the rest.`}</p>}
      {!data.items.length && !error && (
        <p className="nw-empty">{kind === "watchlist" ? "Nothing from your watchlist's companies in the last few days. Star companies to follow their news here." : "Nothing of this kind in the last few days."}</p>
      )}
      {groups.map(g => (
        <section key={g.label} className="nw-day" aria-label={g.label}>
          <h3 className="nw-day-head">{g.label}</h3>
          <div className="nw-list">{g.items.map(item => <NewsRow key={item.id} item={item} onOpen={onOpen} asOf={data.asOf} dated={false} />)}</div>
        </section>
      ))}
      {data.next && <button type="button" className="btn-ghost nw-more" disabled={busy} onClick={() => load(data.next)}>{busy ? "Loading…" : "Show more"}</button>}
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
      {item.summary
        ? <blockquote className="nw-said"><span className="nw-said-label">In the company's words</span>{item.summary}</blockquote>
        : <p className="nw-note">NSE's notice has no summary; the details are in the filing.</p>}
      {item.also?.length > 0 && item.also.map(a => (
        <blockquote key={a.id} className="nw-said nw-said-also"><span className="nw-said-label">Also that day · {a.title} · {clock(a.time)}</span>{a.summary ?? a.title}</blockquote>
      ))}
      {item.kind === "results" && (item.numbers
        ? <div className="nw-numbers"><span className="nw-said-label">The numbers, against the same quarter a year earlier</span><Figures n={item.numbers} wide /><span className="nw-numbers-note">As the app reads them from the company's results filing; the filing has the full statement.</span></div>
        : <p className="nw-note">The figures reach the app with the evening data update.</p>)}
      <div className="nw-actions">
        {item.url && <a className="btn-primary nw-btn" href={item.url} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden="true" /> Open the filing{item.fileSize ? ` · ${item.fileSize}` : ""}</a>}
      </div>
      {item.url && <FilingLines id={item.id} auto={!item.summary} />}
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
      <p className="nw-foot">From NSE's announcements, as the company filed them. Not investment advice.</p>
    </article>
  );
  return (
    <article className="nw-detail" aria-label={item.title}>
      {back}
      <p className="nw-eyebrow"><span className="nw-kind k-headlines">Headline</span><span>{fullTime(item.time)}</span></p>
      <h2 className="nw-title">{item.title}</h2>
      <p className="nw-byline">{item.publisher ?? "A news site"}</p>
      <div className="nw-actions">
        <a className="btn-primary nw-btn" href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden="true" /> Read the story{item.publisher ? ` on ${item.publisher}` : ""}</a>
      </div>
      <p className="nw-note">The story is on the publisher's site; this page shows its headline only.</p>
      {data.companies?.length > 0 ? (
        <section className="nw-section" aria-label="Companies it names">
          <h3 className="nw-section-head">Companies it names</h3>
          {data.companies.map(c => (
            <div key={c.symbol} className="nw-company">
              <Quote quote={c} asOf={data.asOf} onOpenStock={onOpenStock} />
              {c.announced?.length > 0 && <div className="nw-list">{c.announced.map(m => <NewsRow key={m.id} item={m} onOpen={onOpen} />)}</div>}
            </div>
          ))}
        </section>
      ) : <p className="nw-note">It doesn't name a company over ₹5,000 crore by name.</p>}
    </article>
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

export default function NewsView({ onOpenStock, openId = null, onOpened }) {
  const [kind, setKind] = useState("all");
  const [counts, setCounts] = useState(null);
  // Companies over ₹1,000 crore only, unless switched off; kept for the visit
  const [size, setSize] = useState(() => { try { return sessionStorage.getItem("news-size") === "all" ? "all" : "large"; } catch { return "large"; } });
  const pickSize = next => { setSize(next); try { sessionStorage.setItem("news-size", next); } catch {} };
  const [item, setItem] = useState(null);
  const listScroll = useRef(0);
  // An item is a history entry of its own: Back (the browser's, Android's,
  // or the page's) returns to the list where it was
  const open = id => {
    if (!item) listScroll.current = window.scrollY;
    window.history.pushState({ ...(window.history.state ?? {}), newsItem: id }, "");
    setItem(id);
  };
  useEffect(() => {
    const onPop = () => {
      const id = window.history.state?.newsItem ?? null;
      setItem(id);
      if (!id) requestAnimationFrame(() => window.scrollTo(0, listScroll.current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // From Discover's card: straight to its item
  useEffect(() => { if (openId) { open(openId); onOpened?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="nw-page">
      {item
        ? <Detail id={item} onBack={() => window.history.back()} onOpen={open} onOpenStock={onOpenStock} />
        : <>
          <div className="nw-head">
            <h2 className="nw-page-title hide-phone">News</h2>
            <p className="nw-lede">What listed companies told NSE over the last few days, and the market's headlines. Updated through the day.</p>
            <button type="button" role="switch" aria-checked={size === "large"} className="nw-size" onClick={() => pickSize(size === "large" ? "all" : "large")}>
              <span className="st-switch nw-switch" data-on={size === "large"} aria-hidden="true"><span /></span>
              Only companies over ₹1,000 crore
            </button>
          </div>
          <div className="nw-layout">
            {/* a computer: the kinds down the side with how many of each; a
                phone: one row of chips to swipe */}
            <div className="nw-rail" role="group" aria-label="Kinds of news">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" className="nw-rail-item" aria-pressed={kind === id} onClick={() => setKind(id)}>
                  <span>{label}</span>{counts?.[id] != null && <span className="nw-count">{counts[id]}</span>}
                </button>
              ))}
            </div>
            <div className="nw-feed">
              <div className="ph-chips nw-filters" role="group" aria-label="Kinds of news">
                {FILTERS.map(([id, label]) => <button key={id} type="button" className="ph-chip" aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>)}
              </div>
              <List kind={kind} size={size} onOpen={open} onCounts={setCounts} />
            </div>
          </div>
        </>}
    </div>
  );
}
