// The app's copy of the pages written for search engines (server/seo-lists.js,
// 24 Oct 2026): every strategy, one strategy's companies, the results
// calendar, and the sectors (25 Oct 2026) — for anyone, signed in or not. Companies open their own page.
import { useEffect, useState } from "react";
import { ChevronRight, Share2 } from "lucide-react";
import { api } from "./api.js";
import { PublicPage } from "./LegalPages.jsx";
import { navigate, stockPath } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { AdCard } from "./ads.jsx";
import { useJoin, JoinCard, JoinBar } from "./PublicJoin.jsx";
import { withTerms } from "./jargon.jsx";
import { SCREENS_TITLE, CALENDAR_TITLE, SECTORS_TITLE, LISTS_TITLE, screenTitle, sectorTitle, listTitle } from "./pageTitle.js";

// One ad card partway down each public page (26 Oct 2026): the pages people
// arrive at from a search, signed out. Marked "Ad", never a banner (ads.jsx);
// a list's card is a list item of its own
const PageAd = ({ slot }) => <AdCard feed="public" slot={slot} size="medium" className="pl-ad" />;
const ListAd = ({ slot }) => <li className="pl-ad-item"><PageAd slot={slot} /></li>;

const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const crore = v => (v == null ? null : v >= 100000 ? `₹${num(v / 100000, 2)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);

// When it was last refreshed (8 Nov 2026, a review: "for market data,
// freshness is what makes people trust it"): the time the evening build
// ran, in India, and the close its prices are from
const IST = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const fresh = (pricesDate, builtAt) => {
  const at = builtAt ? `${IST.format(new Date(builtAt)).replace(/ (am|pm)$/i, (_, x) => ` ${x.toLowerCase()}`)} IST` : null;
  if (!pricesDate) return at ?? "with each NSE close";
  return at ? `${at} · prices to the NSE close on ${day(pricesDate)}` : `${day(pricesDate)} (the latest NSE close)`;
};
const weekday = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : null);
const NOT_ADVICE = "These are the NSE companies that pass a set of filters on reported figures at the last close — a starting point for research, not a recommendation to buy or sell. Check each company's filings before deciding anything.";

// Share a list (6 Nov 2026: WhatsApp groups bring people more than X does):
// a phone's own share sheet where there is one, else WhatsApp with the
// message ready. The person sends it; nothing is sent for them.
function ShareButton({ text, path }) {
  if (!text) return null;
  const url = `https://jocularinsights.in${path}`;
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text, url }); return; } catch { return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  };
  return <button type="button" className="pl-share" onClick={share}><Share2 size={15} aria-hidden="true" /> Share</button>;
}

// a link that stays in the app
const go = path => e => { e.preventDefault(); navigate(path); window.scrollTo(0, 0); };
const A = ({ to, children, className }) => <a href={to} onClick={go(to)} className={className}>{children}</a>;

// The page's own data, when the server wrote it into the page (server/seo.js
// listData, read by main.jsx): used by the page it was written for — the
// kind and key must match — so the page draws at once and the same as the
// server's, and Google's renderer, which doesn't load /api/, sees the
// companies too (9 Nov 2026, the SEO audit). Left in place, not taken once:
// the app may draw a page twice as it starts (around the sign-in check), and
// a second drawing that found it gone fell back to the API. Any other page
// asks /api/public.
function written(kind, key) {
  const w = window.__PUBLIC_LIST__;
  return w && w.kind === kind && w.key === key && w.data != null ? w.data : null;
}
function useLoad(load, key, kind) {
  const [state, setState] = useState(() => ({ key, d: written(kind, key), error: "" }));
  useEffect(() => {
    if (state.key === key && state.d) return; // written into the page
    let live = true;
    setState({ key, d: null, error: "" });
    load().then(d => { if (live) setState({ key, d, error: "" }); }).catch(e => { if (live) setState({ key, d: null, error: e.message }); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state.key === key ? state.d : null, state.key === key ? state.error : ""];
}
const Wait = () => <div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div>;
const More = () => (
  <p className="pl-more">
    <A to="/screens">All stock screens</A> · <A to="/lists">Stock lists</A> · <A to="/sectors">Sectors</A> · <A to="/results-calendar">Results calendar</A> · <A to="/results">Latest results</A> · <A to="/methodology">How the quality score works</A> · <A to="/disclaimer">Disclaimer</A>
  </p>
);

export function ScreensIndexPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicScreens(), "all", "screens");
  useEffect(() => { document.title = SCREENS_TITLE; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="Indian stock screens" signedIn={signedIn} updated={fresh(d?.pricesDate, d?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to run every screen and save your own.")}>
      <p className="pl-lede">Ready-made screens of NSE companies, each a set of filters on reported figures, with the companies that pass them today.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      {d && (
        <ul className="pl-screens">
          {d.screens.map((s, i) => [i === 3 && <ListAd key="ad" slot="screens" />,
            <li key={s.slug}>
              <A to={`/screens/${s.slug}`} className="pl-screen">
                <span className="pl-screen-name"><span>{withTerms(s.name)}</span><ChevronRight size={16} aria-hidden="true" /></span>
                {s.description && <span className="pl-screen-desc">{withTerms(s.description)}</span>}
                <span className="pl-screen-count">{s.matched} {s.matched === 1 ? "company matches" : "companies match"}{s.first.length ? `: ${s.first.slice(0, 3).map(c => c.name).join(", ")}…` : ""}</span>
              </A>
            </li>]
          )}
        </ul>
      )}
      <p className="pl-note">{NOT_ADVICE}</p>
      <More />
      {!signedIn && <JoinBar label={"Stock screens"} why="Create a free account to run every screen and save your own." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

export function ScreenPage({ slug, signedIn }) {
  const [s, error] = useLoad(() => api.publicScreen(slug), slug, "screen");
  useEffect(() => { if (s) document.title = screenTitle(s); }, [s]);
  const [join, box] = useJoin();
  return (
    <PublicPage title={s ? `${s.name}: NSE companies that match today` : "Stock screen"} signedIn={signedIn} updated={fresh(s?.pricesDate, s?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to save this screen and see each company's full analysis.")}>
      <p className="pl-crumb"><A to="/screens">Stock screens</A> › {s?.name ?? "…"}{s && <ShareButton path={`/screens/${slug}`} text={`${s.name}: the NSE companies that pass it today, with their quality scores`} />}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">{withTerms(s.description)}{s.description && !/[.!?]$/.test(s.description) ? "." : ""} <b>{s.matched}</b> of {s.total.toLocaleString("en-IN")} companies pass.</p>
          {s.guide && <>
            <h2 className="pl-h">What this screen looks for</h2>
            <p className="pl-lede">{s.guide.lookFor}</p>
            <h2 className="pl-h">Who it may suit</h2>
            <p className="pl-lede">{s.guide.suits} It is a starting point for research, not a list of recommendations.</p>
          </>}
          <h2 className="pl-h">The filters</h2>
          <ul className="pl-rules">{s.rules.map(r => <li key={r}>{r}</li>)}</ul>
          {s.guide && <>
            <h2 className="pl-h">Limitations</h2>
            <p className="pl-lede">{s.guide.limits}</p>
          </>}
          {s.changes && <>
            <h2 className="pl-h">What changed since {day(s.changes.since)}</h2>
            <p className="pl-lede">
              {s.changes.joinedCount} {s.changes.joinedCount === 1 ? "company" : "companies"} joined and {s.changes.leftCount} left.
              {s.changes.joined.length > 0 && <> Joined: {s.changes.joined.map((c, i) => <span key={c.symbol}>{i ? ", " : ""}<A to={stockPath(c.symbol)}>{c.name}</A></span>)}{s.changes.joinedCount > s.changes.joined.length ? " and more" : ""}.</>}
              {s.changes.left.length > 0 && <> Left: {s.changes.left.map((c, i) => <span key={c.symbol}>{i ? ", " : ""}<A to={stockPath(c.symbol)}>{c.name}</A></span>)}{s.changes.leftCount > s.changes.left.length ? " and more" : ""}.</>}
            </p>
          </>}
          <PageAd slot="screen" />
          {!signedIn && <JoinCard title="Make this screen yours" onJoin={join} why="Create a free account to save this screen and see each company's full analysis."
            points={["Save it, and see which companies join or leave it", "Every company's checks: growth, safety, owners, value", "Change the filters, or build your own screen"]} />}
          <h2 className="pl-h">Companies that match{s.matched > s.companies.length ? ` (the first ${s.companies.length})` : ""}</h2>
          <ol className="pl-cos">
            {s.companies.map(c => (
              <li key={c.symbol}>
                <A to={stockPath(c.symbol)} className="pl-co">
                  <CompanyLogo symbol={c.symbol} size={32} fallback={c.name} />
                  <span className="pl-co-main">
                    <span className="pl-co-name">{c.name}</span>
                    <span className="pl-co-figs">{[c.price != null && `₹${num(c.price, 2)}`, crore(c.marketCapCr), c.pe > 0 && `P/E ${num(c.pe)}`, c.roe != null && `ROE ${num(c.roe)}%`, c.overall != null && c.quality != null && `Quality ${c.quality}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.overall != null
                    ? <span className="pl-co-q" title="Overall score: quality and valuation, from the company's filings">{c.overall}<small>/100</small></span>
                    : c.quality != null && <span className="pl-co-q" title="Quality score, from the company's filings">{c.quality}<small>/100</small></span>}
                </A>
              </li>
            ))}
          </ol>
          {/* a long list: the way in again at its end (9 Nov 2026, the SEO audit) */}
          {!signedIn && s.companies.length > 20 && <JoinCard title="Keep track of these companies" onJoin={join} why="Create a free account to keep track of these companies."
            points={["A watchlist and price alerts for the ones you pick", "Each company's fair value and 7 questions, from its filings", "Your own screens, kept, with word when a company joins"]} />}
        </>
      )}
      <p className="pl-note">{NOT_ADVICE}</p>
      <More />
      {!signedIn && <JoinBar label={s?.name ?? "This screen"} why="Create a free account to save this screen and see each company's full analysis." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

export function ResultsCalendarPage({ signedIn }) {
  const [c, error] = useLoad(() => api.publicResultsCalendar(), "cal", "calendar");
  const [open, setOpen] = useState({});
  useEffect(() => { document.title = CALENDAR_TITLE; }, []);
  const total = c?.days.reduce((n, d) => n + d.count, 0) ?? 0;
  const [join, box] = useJoin();
  return (
    <PublicPage title="Quarterly results calendar" signedIn={signedIn} updated={c ? (c.builtAt ? fresh(null, c.builtAt) : day(c.today)) : "daily"} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to follow your companies' results.")}>
      <p className="pl-lede">{c ? `${total} NSE companies have board meetings for results in the next two weeks, the largest companies first.` : "NSE companies' board meetings for results, the next two weeks."} Already reported? <A to="/results">See the latest results</A>, newest first.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!c && !error && <Wait />}
      {c?.days.map((d, i) => {
        const all = open[d.date], list = all ? d.companies : d.companies.slice(0, 12);
        return [i === 1 && <PageAd key="ad" slot="calendar" />,
          <section key={d.date} className="pl-day" aria-label={weekday(d.date)}>
            <h2 className="pl-h">{d.date === c.today ? "Today" : weekday(d.date)} <span>{d.count} {d.count === 1 ? "company" : "companies"}</span></h2>
            <div className="ex-day-list">
              {list.map(x => (
                <A key={x.symbol} to={stockPath(x.symbol)} className="ex-co"><CompanyLogo symbol={x.symbol} size={22} fallback={x.name} /><span>{x.name}</span></A>
              ))}
              {d.count > 12 && <button type="button" className="ex-more" onClick={() => (signedIn ? setOpen(o => ({ ...o, [d.date]: !all })) : join(`Create a free account to see all ${d.count} companies reporting ${d.date === c.today ? "today" : `on ${weekday(d.date)}`}.`))}>{all ? "Fewer" : `+${d.count - 12} more`}</button>}
            </div>
          </section>,
          i === 0 && !signedIn && <JoinCard key="join" title="Know when your companies report" onJoin={join}
            why="Create a free account to follow your companies' results."
            points={["Add companies to a watchlist; see their results dates first", "Every company's results, quarter by quarter, with its quality score", "Price alerts, and a note on what changed in each filing"]} />];
      })}
      {c && !c.days.length && <p className="nw-empty">No results dates in the next two weeks on NSE's calendar.</p>}
      <p className="pl-note">Dates are board meetings companies have told NSE about; they can change.</p>
      <More />
      {!signedIn && <JoinBar label="Results this season" why="Create a free account to follow your companies' results." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

// /sectors and /sector/<slug> (server/seo-story.js): every listed company in a
// sector, the sector's middle P/E and ROE, its highest quality names
export function SectorsIndexPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicSectors(), "sectors", "sectors");
  useEffect(() => { document.title = SECTORS_TITLE; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="NSE stocks by sector" signedIn={signedIn} updated={fresh(d?.pricesDate, d?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see every company's full analysis.")}>
      <p className="pl-lede">Every NSE-listed company NSE classifies, sector by sector, with each sector's companies and figures.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      {d && (
        <ul className="pl-screens">
          {d.sectors.map((s, i) => [i === 4 && <ListAd key="ad" slot="sectors" />,
            <li key={s.slug}>
              <A to={`/sector/${s.slug}`} className="pl-screen">
                <span className="pl-screen-name">{s.name}<ChevronRight size={16} aria-hidden="true" /></span>
                <span className="pl-screen-count">{s.count} {s.count === 1 ? "company" : "companies"}{s.largest.length ? `: ${s.largest.map(c => c.name).join(", ")}${s.count > 3 ? "…" : ""}` : ""}</span>
              </A>
            </li>]
          )}
        </ul>
      )}
      <More />
      {!signedIn && <JoinBar label={"NSE sectors"} why="Create a free account to see every company's full analysis." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

export function SectorPage({ slug, signedIn }) {
  const [s, error] = useLoad(() => api.publicSector(slug), slug, "sector");
  useEffect(() => { if (s) document.title = sectorTitle(s); }, [s]);
  const [join, box] = useJoin();
  return (
    <PublicPage title={s ? `${s.name} stocks on NSE` : "Sector"} signedIn={signedIn} updated={fresh(s?.pricesDate, s?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see every check behind these scores.")}>
      <p className="pl-crumb"><A to="/sectors">Sectors</A> › {s?.name ?? "…"}{s && <ShareButton path={`/sector/${slug}`} text={`${s.name} stocks on NSE: all ${s.count}, with their P/E and quality scores`} />}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">
            {s.count} companies listed on NSE are in {s.name}, together worth {crore(s.totalMarketCapCr)}.
            {s.medianPe ? ` The middle P/E among them is ${num(s.medianPe)}${s.medianRoe != null ? ` and the middle return on equity ${num(s.medianRoe)}%` : ""}.` : ""}
            {s.best.length ? ` By quality score from their own filings, the highest are ${s.best.map(b => `${b.name} (${Math.round(b.quality)})`).join(", ")}.` : ""}
          </p>
          {s.screens.length > 0 && <>
            <h2 className="pl-h">Screens its companies pass most</h2>
            <ul className="pl-rules">{s.screens.map(x => <li key={x.slug}><A to={`/screens/${x.slug}`}>{x.name}</A> — {x.count} {x.count === 1 ? "company" : "companies"}</li>)}</ul>
          </>}
          <PageAd slot="sector" />
          {!signedIn && <JoinCard title="See every check behind these scores" onJoin={join} why="Create a free account to see every check behind these scores."
            points={["Each company's 7 questions, answered from its filings", "Its fair value, results and who owns it", "A watchlist and price alerts for the ones you follow"]} />}
          <h2 className="pl-h">Every listed {s.name} company</h2>
          <ol className="pl-cos">
            {s.companies.map(c => (
              <li key={c.symbol}>
                <A to={stockPath(c.symbol)} className="pl-co">
                  <CompanyLogo symbol={c.symbol} size={32} fallback={c.name} />
                  <span className="pl-co-main">
                    <span className="pl-co-name">{c.name}</span>
                    <span className="pl-co-figs">{[c.price != null && `₹${num(c.price, 2)}`, crore(c.marketCapCr), c.pe > 0 && `P/E ${num(c.pe)}`, c.roe != null && `ROE ${num(c.roe)}%`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.quality != null && <span className="pl-co-q" title="Quality score, from the company's filings">{Math.round(c.quality)}<small>/100</small></span>}
                </A>
              </li>
            ))}
          </ol>
          {/* a long list: the way in again at its end (9 Nov 2026, the SEO audit) */}
          {!signedIn && s.companies.length > 20 && <JoinCard title="Keep track of these companies" onJoin={join} why="Create a free account to keep track of these companies."
            points={["A watchlist and price alerts for the ones you pick", "Each company's fair value and 7 questions, from its filings", "Your own screens, kept, with word when a company joins"]} />}
          <p className="pl-note">Sectors are NSE's own, from its index lists; a company NSE doesn't classify is placed by its industry or its filings. {NOT_ADVICE}</p>
        </>
      )}
      <More />
      {!signedIn && <JoinBar label={s?.name ?? "This sector"} why="Create a free account to see every check behind these scores." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

// Lists people search for (6 Nov 2026, server/seo-collections.js): each
// NSE index's companies, NSE's themes, price bands and a few plain filters
export function ListsIndexPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicLists(), "lists", "lists");
  useEffect(() => { document.title = LISTS_TITLE; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="NSE stock lists" signedIn={signedIn} updated={fresh(d?.pricesDate, d?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see every company's full analysis.")}>
      <p className="pl-lede">Each NSE index's companies, NSE's themes such as defence and railway PSUs, stocks by price, and a few plain filters, at the last close.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      {d && d.groups.map((g, gi) => (
        <section key={g.kind}>
          <h2 className="pl-h">{g.label}</h2>
          <ul className="pl-screens">
            {g.lists.map(l => (
              <li key={l.slug}>
                <A to={`/lists/${l.slug}`} className="pl-screen">
                  <span className="pl-screen-name">{l.name}<ChevronRight size={16} aria-hidden="true" /></span>
                  <span className="pl-screen-count">{l.count} companies</span>
                </A>
              </li>
            ))}
          </ul>
          {gi === 0 && <PageAd slot="lists" />}
        </section>
      ))}
      <More />
      {!signedIn && <JoinBar label="NSE stock lists" why="Create a free account to see every company's full analysis." onJoin={join} />}
      {box}
    </PublicPage>
  );
}

export function ListPage({ slug, signedIn }) {
  const [s, error] = useLoad(() => api.publicList(slug), slug, "list");
  useEffect(() => { if (s) document.title = listTitle(s); }, [s]);
  const [join, box] = useJoin();
  return (
    <PublicPage title={s?.name ?? "Stock list"} signedIn={signedIn} updated={fresh(s?.pricesDate, s?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see every check behind these scores.")}>
      <p className="pl-crumb"><A to="/lists">Lists</A> › {s?.name ?? "…"}{s && <ShareButton path={`/lists/${slug}`} text={`${s.name}: all ${s.count}, with their P/E and quality scores`} />}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">
            {s.count} companies: {s.about}. Together they're worth {crore(s.totalMarketCapCr)}.
            {s.medianPe ? ` The middle P/E among them is ${num(s.medianPe)}${s.medianRoe != null ? ` and the middle return on equity ${num(s.medianRoe)}%` : ""}.` : ""}
            {s.best.length && !s.method ? ` By quality score from their own filings, the highest are ${s.best.map(b => `${b.name} (${Math.round(b.quality)})`).join(", ")}.` : ""}
          </p>
          {s.method && <p className="pl-note">{s.method} <A to="/methodology">How the scores work</A>.</p>}
          <PageAd slot="list" />
          {!signedIn && <JoinCard title="See every check behind these scores" onJoin={join} why="Create a free account to see every check behind these scores."
            points={["Each company's 7 questions, answered from its filings", "Its fair value, results and who owns it", "A watchlist and price alerts for the ones you follow"]} />}
          <h2 className="pl-h">{s.count > s.companies.length ? `${s.companies.length} of ${s.count}` : `All ${s.count}`}</h2>
          <ol className="pl-cos">
            {s.companies.map(c => (
              <li key={c.symbol}>
                <A to={stockPath(c.symbol)} className="pl-co">
                  <CompanyLogo symbol={c.symbol} size={32} fallback={c.name} />
                  <span className="pl-co-main">
                    <span className="pl-co-name">{c.name}</span>
                    <span className="pl-co-figs">{[c.price != null && `₹${num(c.price, 2)}`, crore(c.marketCapCr), !s.method && c.extra && s.extraLabel && `${s.extraLabel} ${c.extra}`, c.pe > 0 && `P/E ${num(c.pe)}`, c.roe != null && `ROE ${num(c.roe)}%`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {s.method
                    ? c.overall != null && <span className="pl-co-q" title="Overall score: quality and valuation, from the company's filings">{Math.round(c.overall)}<small>/100</small></span>
                    : c.quality != null && <span className="pl-co-q" title="Quality score, from the company's filings">{Math.round(c.quality)}<small>/100</small></span>}
                </A>
              </li>
            ))}
          </ol>
          {/* a long list: the way in again at its end (9 Nov 2026, the SEO audit) */}
          {!signedIn && s.companies.length > 20 && <JoinCard title="Keep track of these companies" onJoin={join} why="Create a free account to keep track of these companies."
            points={["A watchlist and price alerts for the ones you pick", "Each company's fair value and 7 questions, from its filings", "Your own screens, kept, with word when a company joins"]} />}
          {s.missing?.length > 0 && <p className="pl-note">Also in this index, but not covered here yet: {s.missing.join(", ")}.</p>}
          <p className="pl-note">{s.kind === "rule" ? `A plain rule on reported figures at the last close: ${s.about}. It changes with every close.` : "The companies are NSE's own list for this index; NSE reviews its indices twice a year."} {NOT_ADVICE}</p>
          {s.others.length > 0 && <>
            <h2 className="pl-h">More lists</h2>
            <ul className="pl-rules">{s.others.map(x => <li key={x.slug}><A to={`/lists/${x.slug}`}>{x.name}</A> — {x.count} companies</li>)}</ul>
          </>}
        </>
      )}
      <More />
      {!signedIn && <JoinBar label={s?.name ?? "This list"} why="Create a free account to see every check behind these scores." onJoin={join} />}
      {box}
    </PublicPage>
  );
}
