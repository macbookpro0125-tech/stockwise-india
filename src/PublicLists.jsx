// The app's copy of the pages written for search engines (server/seo-lists.js,
// 24 Oct 2026): every strategy, one strategy's companies, the results
// calendar, and the sectors (25 Oct 2026) — for anyone, signed in or not. Companies open their own page.
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { api } from "./api.js";
import { PublicPage } from "./LegalPages.jsx";
import { navigate, stockPath } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { AdCard } from "./ads.jsx";
import { useJoin, JoinCard, JoinBar } from "./PublicJoin.jsx";

// One ad card partway down each public page (26 Oct 2026): the pages people
// arrive at from a search, signed out. Marked "Ad", never a banner (ads.jsx);
// a list's card is a list item of its own
const PageAd = ({ slot }) => <AdCard feed="public" slot={slot} size="medium" className="pl-ad" />;
const ListAd = ({ slot }) => <li className="pl-ad-item"><PageAd slot={slot} /></li>;

const num = (v, d = 1) => (v == null || !isFinite(v) ? null : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
const crore = v => (v == null ? null : v >= 100000 ? `₹${num(v / 100000, 2)} lakh cr` : `₹${Math.round(v).toLocaleString("en-IN")} cr`);
const day = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const weekday = iso => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : null);
const NOT_ADVICE = "These are the NSE companies that pass a set of filters on reported figures at the last close — a starting point for research, not a recommendation to buy or sell. Check each company's filings before deciding anything.";

// a link that stays in the app
const go = path => e => { e.preventDefault(); navigate(path); window.scrollTo(0, 0); };
const A = ({ to, children, className }) => <a href={to} onClick={go(to)} className={className}>{children}</a>;

function useLoad(load, key) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { setD(null); setError(""); load().then(setD).catch(e => setError(e.message)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [d, error];
}
const Wait = () => <div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div>;
const More = () => (
  <p className="pl-more">
    <A to="/screens">All stock screens</A> · <A to="/sectors">Sectors</A> · <A to="/results-calendar">Results calendar</A> · <A to="/methodology">How the quality score works</A> · <A to="/disclaimer">Disclaimer</A>
  </p>
);

export function ScreensIndexPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicScreens(), "all");
  useEffect(() => { document.title = "Indian stock screens: NSE companies by quality, value, dividends and growth | Jocular Insights"; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="Indian stock screens" signedIn={signedIn} updated={d?.pricesDate ? `${day(d.pricesDate)} (the latest NSE close)` : "with each NSE close"} onSignIn={() => join(null, "signin")}>
      <p className="pl-lede">Ready-made screens of NSE companies, each a set of filters on reported figures, with the companies that pass them today.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      {d && (
        <ul className="pl-screens">
          {d.screens.map((s, i) => [i === 3 && <ListAd key="ad" slot="screens" />,
            <li key={s.slug}>
              <A to={`/screens/${s.slug}`} className="pl-screen">
                <span className="pl-screen-name">{s.name}<ChevronRight size={16} aria-hidden="true" /></span>
                {s.description && <span className="pl-screen-desc">{s.description}</span>}
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
  const [s, error] = useLoad(() => api.publicScreen(slug), slug);
  useEffect(() => { if (s) document.title = s.guide ? `${s.guide.search}: ${s.matched} today | Jocular Insights` : `${s.name}: ${s.matched} NSE stocks that match today | Jocular Insights`; }, [s]);
  const [join, box] = useJoin();
  return (
    <PublicPage title={s ? `${s.name}: NSE companies that match today` : "Stock screen"} signedIn={signedIn} updated={s?.pricesDate ? `${day(s.pricesDate)} (the latest NSE close)` : "with each NSE close"} onSignIn={() => join(null, "signin")}>
      <p className="pl-crumb"><A to="/screens">Stock screens</A> › {s?.name ?? "…"}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">{s.description}{s.description && !/[.!?]$/.test(s.description) ? "." : ""} <b>{s.matched}</b> of {s.total.toLocaleString("en-IN")} companies pass.</p>
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
                    <span className="pl-co-figs">{[c.price != null && `₹${num(c.price, 2)}`, crore(c.marketCapCr), c.pe > 0 && `P/E ${num(c.pe)}`, c.roe != null && `ROE ${num(c.roe)}%`].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.quality != null && <span className="pl-co-q" title="Quality score, from the company's filings">{c.quality}<small>/100</small></span>}
                </A>
              </li>
            ))}
          </ol>
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
  const [c, error] = useLoad(() => api.publicResultsCalendar(), "cal");
  const [open, setOpen] = useState({});
  useEffect(() => { document.title = "Quarterly results calendar: NSE companies announcing results this week | Jocular Insights"; }, []);
  const total = c?.days.reduce((n, d) => n + d.count, 0) ?? 0;
  const [join, box] = useJoin();
  return (
    <PublicPage title="Quarterly results calendar" signedIn={signedIn} updated={c ? `${day(c.today)}` : "daily"} onSignIn={() => join(null, "signin")}>
      <p className="pl-lede">{c ? `${total} NSE companies have board meetings for results in the next two weeks, the largest companies first.` : "NSE companies' board meetings for results, the next two weeks."}</p>
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
  const [d, error] = useLoad(() => api.publicSectors(), "sectors");
  useEffect(() => { document.title = "NSE stocks by sector: every listed company, sector by sector | Jocular Insights"; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="NSE stocks by sector" signedIn={signedIn} updated={d?.pricesDate ? `${day(d.pricesDate)} (the latest NSE close)` : "with each NSE close"} onSignIn={() => join(null, "signin")}>
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
  const [s, error] = useLoad(() => api.publicSector(slug), slug);
  useEffect(() => { if (s) document.title = `${s.name} stocks on NSE: ${s.count} companies by P/E, ROE and quality | Jocular Insights`; }, [s]);
  const [join, box] = useJoin();
  return (
    <PublicPage title={s ? `${s.name} stocks on NSE` : "Sector"} signedIn={signedIn} updated={s?.pricesDate ? `${day(s.pricesDate)} (the latest NSE close)` : "with each NSE close"} onSignIn={() => join(null, "signin")}>
      <p className="pl-crumb"><A to="/sectors">Sectors</A> › {s?.name ?? "…"}</p>
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
          <p className="pl-note">Sectors are NSE's own, from its index lists; a company NSE doesn't classify is placed by its industry or its filings. {NOT_ADVICE}</p>
        </>
      )}
      <More />
      {!signedIn && <JoinBar label={s?.name ?? "This sector"} why="Create a free account to see every check behind these scores." onJoin={join} />}
      {box}
    </PublicPage>
  );
}
