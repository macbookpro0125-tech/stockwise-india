// The app's copy of the pages written for search engines (server/seo-lists.js,
// 24 Oct 2026): every strategy, one strategy's companies, the results
// calendar, and the sectors (25 Oct 2026) — for anyone, signed in or not. Companies open their own page.
import { lazy, Suspense, useEffect, useState } from "react";
const GoldChart = lazy(() => import("./GoldChart.jsx"));
import { ChevronRight, Share2 } from "lucide-react";
import { api } from "./api.js";
import { PublicPage } from "./LegalPages.jsx";
import { navigate, stockPath } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { AdCard } from "./ads.jsx";
import { useJoin, JoinCard, JoinBar } from "./PublicJoin.jsx";
import { withTerms } from "./jargon.jsx";
import { SCREENS_TITLE, CALENDAR_TITLE, SECTORS_TITLE, LISTS_TITLE, GOLD_TITLE, screenTitle, sectorTitle, listTitle } from "./pageTitle.js";

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
    <A to="/screens">All stock screens</A> · <A to="/lists">Stock lists</A> · <A to="/lists/penny-stocks">Penny stocks</A> · <A to="/lists/stocks-under-100">Stocks under ₹100</A> · <A to="/lists/fno-stocks">F&amp;O stocks</A> · <A to="/lists/nifty-50-stocks">Nifty 50 stocks</A> · <A to="/sectors">Sectors</A> · <A to="/gold-silver">Gold &amp; silver</A> · <A to="/results-calendar">Results calendar</A> · <A to="/results">Latest results</A> · <A to="/methodology">How the quality score works</A> · <A to="/disclaimer">Disclaimer</A>
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

// A screen someone built in the Screen builder and shared (17 Nov 2026):
// its filters ride in the link (?f=), and the server runs them on today's
// market for anyone (seo-lists.js sharedScreen). Signed in, it opens in the
// Screen builder to change or save.
export function SharedScreenPage({ signedIn }) {
  const code = new URLSearchParams(window.location.search).get("f") ?? "";
  const [s, error] = useLoad(() => api.sharedScreen(code), code, "shared");
  useEffect(() => { document.title = "A shared stock screen · Jocular Insights"; }, []);
  const [join, box] = useJoin();
  return (
    <PublicPage title="A stock screen shared with you" signedIn={signedIn} updated={fresh(s?.pricesDate, s?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to save this screen and change its filters.")}>
      <p className="pl-crumb"><A to="/screens">Stock screens</A> › Shared screen{s && <ShareButton path={`/shared?f=${code}`} text={`A stock screen: ${s.matched} NSE companies pass it today`} />}</p>
      {error && <p className="nw-empty">{error === "That link doesn't hold a screen." ? "This link doesn't hold a screen. It may have been cut short when it was copied." : error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">Someone built this screen in Jocular Insights and shared it. Run on the latest NSE close, <b>{s.matched}</b> of {s.total.toLocaleString("en-IN")} companies pass.</p>
          <h2 className="pl-h">The filters</h2>
          <ul className="pl-rules">{s.rules.map(r => <li key={r}>{r}</li>)}</ul>
          {signedIn
            ? <p><a className="pl-share" href={`/?screen=${code}`}>Open it in the Screen builder</a></p>
            : <JoinCard title="Make this screen yours" onJoin={join} why="Create a free account to save this screen and change its filters."
                points={["Save it, and see which companies join or leave it", "Change the filters, or build your own", "Every company's checks: growth, safety, owners, value"]} />}
          <h2 className="pl-h">Companies that match{s.matched > s.companies.length ? ` (the first ${s.companies.length})` : ""}</h2>
          {s.companies.length ? (
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
          ) : <p className="pl-lede">No company passes every filter at the latest close.</p>}
        </>
      )}
      <p className="pl-note">{NOT_ADVICE}</p>
      <More />
      {!signedIn && <JoinBar label="This screen" why="Create a free account to save this screen and change its filters." onJoin={join} />}
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
          {s.lists?.length > 0 && <>
            <h2 className="pl-h">Categories its companies are in</h2>
            <ul className="pl-rules">{s.lists.map(x => <li key={x.slug}><A to={`/lists/${x.slug}`}>{x.name}</A> — {x.count} {x.count === 1 ? "company" : "companies"}</li>)}</ul>
          </>}
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
    <PublicPage title="Explore by category" signedIn={signedIn} updated={fresh(d?.pricesDate, d?.builtAt)} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to see every company's full analysis.")}>
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
      {!signedIn && <JoinBar label="Explore by category" why="Create a free account to see every company's full analysis." onJoin={join} />}
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

// Gold, silver and every ETF on NSE, and the Sovereign Gold Bonds (20 Nov
// 2026, server/gold-silver.js): one tab for each kind; prices from NSE.
const signed = (v, d = 1) => (v == null || !isFinite(v) ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}%`);
const tone = v => (v == null ? "" : v >= 0 ? "up" : "down");
const rupees = (v, d = 2) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })}`);
const traded = cr => (cr == null ? null : cr >= 1 ? `₹${Math.round(cr).toLocaleString("en-IN")} cr traded` : `₹${Math.round(cr * 100).toLocaleString("en-IN")} lakh traded`);

function EtfRows({ list, metal }) {
  return (
    <ul className="gs-list">
      {list.map(e => (
        <li key={e.symbol}>
          <div className="gs-top">
            <span className="gs-who"><b>{e.symbol}</b><small>{[e.amc, metal ? null : e.tracks].filter(Boolean).join(" · ") || e.tracks}</small></span>
            <span className="gs-px"><b>{rupees(e.price)}</b><small className={tone(e.changePct)}>{signed(e.changePct, 2)}</small></span>
          </div>
          <div className="gs-meta">
            {e.premiumPct != null && <span title={`Its close on ${e.navDate} against its NAV that day`}>{Math.abs(e.premiumPct) < 0.05 ? "At its NAV" : `${Math.abs(e.premiumPct).toFixed(2)}% ${e.premiumPct > 0 ? "over" : "under"} NAV`}</span>}
            {e.ret1y != null && <span>1 year <i className={tone(e.ret1y)}>{signed(e.ret1y)}</i></span>}
            {e.ret3y != null && <span>3 years <i className={tone(e.ret3y)}>{signed(e.ret3y)} a year</i></span>}
            {traded(e.valueCr) && <span>{traded(e.valueCr)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SgbRows({ list }) {
  const low = Math.min(...list.filter(s => s.valueCr >= 0.1).map(s => s.price));
  return (
    <ul className="gs-list">
      {list.map(s => (
        <li key={s.symbol}>
          <div className="gs-top">
            <span className="gs-who"><b>{s.symbol}</b><small>Matures {s.matures}{s.yearsLeft != null ? ` · ${s.yearsLeft < 1 ? (m => `${m} month${m === 1 ? "" : "s"}`)(Math.max(1, Math.round(s.yearsLeft * 12))) : `${s.yearsLeft.toFixed(1)} years`} left` : ""}</small></span>
            <span className="gs-px"><b>{rupees(s.price)}</b><small className={tone(s.changePct)}>{signed(s.changePct, 2)}</small></span>
          </div>
          <div className="gs-meta">
            <span>Issued at {rupees(s.issuePrice, 0)}{s.sinceIssuePct != null && <> · <i className={tone(s.sinceIssuePct)}>{signed(s.sinceIssuePct, 0)}</i></>}</span>
            {s.interestYear != null && <span>Interest {rupees(s.interestYear, 0)} a year</span>}
            {traded(s.valueCr) && <span>{traded(s.valueCr)}</span>}
            {s.price === low && <span className="gs-flag">Lowest price per gram among the series trading ₹10 lakh+</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function GoldSilverPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicGoldSilver(), "gold", "gold");
  const [tab, setTab] = useState("gold");
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  useEffect(() => { document.title = GOLD_TITLE; }, []);
  useEffect(() => { setAll(false); setQ(""); }, [tab]);
  const [join, box] = useJoin();
  const count = id => (id === "sgb" ? d?.sgb?.length : d?.groups?.[id]?.length) ?? 0;
  const list = tab === "sgb" ? null : (d?.groups?.[tab] ?? []).filter(e => !q || `${e.symbol} ${e.amc ?? ""} ${e.tracks ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const shown = list && !all ? list.slice(0, 30) : list;
  // "20-Nov-2026 12:55:45" → "20 Nov 2026, 12:55 pm IST"
  const nseTime = t => { const m = /^(\d{1,2})-(\w{3})-(\d{4}) (\d{1,2}):(\d{2})/.exec(t ?? ""); if (!m) return t; const h = Number(m[4]); return `${Number(m[1])} ${m[2]} ${m[3]}, ${h % 12 || 12}:${m[5]} ${h < 12 ? "am" : "pm"} IST`; };
  const updated = d?.asOf ? `NSE prices, ${nseTime(d.asOf)}${d.stale ? " (NSE couldn't be reached since)" : ""}` : null;
  return (
    <PublicPage title="Gold, silver and ETF prices" signedIn={signedIn} updated={updated} onSignIn={() => join(null, "signin")} onJoin={() => join("Create a free account to research every NSE company.")}>
      <p className="pl-lede">Every gold and silver ETF on NSE with its price, NAV and returns, every Sovereign Gold Bond series, and every other ETF: international, government bond, liquid and share-index funds.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      <Suspense fallback={<div className="gc-chart gc-wait" />}><GoldChart /></Suspense>
      {d && <>
        <section className="gs-card">
          <h2>Gold, silver and the Nifty 50</h2>
          <div className="gs-cmp-wrap">
            <table className="gs-cmp">
              <thead><tr><th />{["1M", "1Y", "3Y", "5Y", "10Y"].map(p => <th key={p}>{p}</th>)}</tr></thead>
              <tbody>{d.compare.map(c => <tr key={c.label}><th>{c.label}</th>{["1M", "1Y", "3Y", "5Y", "10Y"].map(p => <td key={p} className={tone(c.returns[p])}>{signed(c.returns[p], Math.abs(c.returns[p] ?? 0) >= 10 ? 0 : 1)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="gs-note">Through the ETFs that track them ({d.compare.map(c => c.symbol).join(", ")}), so after the funds' costs, to the last NSE close. 3 years and more: a year, on average. A dash: the ETF's history here doesn't reach that far yet.</p>
        </section>
        <div className="cs-chips gs-tabs" role="tablist" aria-label="Kind">
          {d.groupInfo.map(g => <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} className={tab === g.id ? "on" : ""} onClick={() => setTab(g.id)}>{g.label}<span>{count(g.id)}</span></button>)}
        </div>
        {tab === "sgb" ? <>
          <p className="gs-note gs-about">One bond is one gram of gold. Each pays <b>2.5% a year on its issue price</b>, every six months, and is repaid at the price of gold when it matures, eight years after issue; RBI also buys them back on interest dates after five years. For individuals, the gain is tax-free when a bond is held to maturity; the interest is taxed. Bonds trading little can be hard to buy or sell at the price shown.</p>
          <SgbRows list={d.sgb} />
        </> : <>
          {tab === "shares" && <input className="gs-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search: Nifty 50, Bank, Midcap, a fund house…" aria-label="Search the ETFs" />}
          {(tab === "gold" || tab === "silver") && <p className="gs-note gs-about">"Over NAV" or "under NAV": how far the ETF closed from the value of the {tab} it holds, both on {d.navDate}. A big gap means paying more, or getting less, than the {tab} is worth.</p>}
          <EtfRows list={shown} metal={tab === "gold" || tab === "silver"} />
          {list.length > shown.length && <button type="button" className="mk-link cs-more" onClick={() => setAll(true)}>Show all {list.length}</button>}
        </>}
        <p className="gs-note">Source: NSE — its list of ETFs, ETF prices and NAV ({d.navDate}), and Sovereign Gold Bond prices with RBI's issue price. Longer returns from NSE's daily closes. Prices, not advice: nothing here suggests buying or selling.</p>
      </>}
      <More />
      {!signedIn && <JoinBar label="gold and silver" why="Create a free account to research every NSE company." onJoin={join} />}
      {box}
    </PublicPage>
  );
}
