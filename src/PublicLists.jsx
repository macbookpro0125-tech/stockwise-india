// The app's copy of the pages written for search engines (server/seo-lists.js,
// 24 Oct 2026): every strategy, one strategy's companies, and the results
// calendar — for anyone, signed in or not. Companies open their own page.
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { api } from "./api.js";
import { PublicPage } from "./LegalPages.jsx";
import { navigate, stockPath } from "./site.jsx";
import CompanyLogo from "./CompanyLogo.jsx";

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
    <A to="/screens">All stock screens</A> · <A to="/results-calendar">Results calendar</A> · <A to="/methodology">How the quality score works</A> · <A to="/disclaimer">Disclaimer</A>
  </p>
);

export function ScreensIndexPage({ signedIn }) {
  const [d, error] = useLoad(() => api.publicScreens(), "all");
  useEffect(() => { document.title = "Indian stock screens: NSE companies by quality, value, dividends and growth | Jocular Insights"; }, []);
  return (
    <PublicPage title="Indian stock screens" signedIn={signedIn} updated={d?.pricesDate ? `${day(d.pricesDate)} (the latest NSE close)` : "with each NSE close"}>
      <p className="pl-lede">Ready-made screens of NSE companies, each a set of filters on reported figures, with the companies that pass them today.</p>
      {error && <p className="nw-empty">{error}</p>}
      {!d && !error && <Wait />}
      {d && (
        <ul className="pl-screens">
          {d.screens.map(s => (
            <li key={s.slug}>
              <A to={`/screens/${s.slug}`} className="pl-screen">
                <span className="pl-screen-name">{s.name}<ChevronRight size={16} aria-hidden="true" /></span>
                {s.description && <span className="pl-screen-desc">{s.description}</span>}
                <span className="pl-screen-count">{s.matched} {s.matched === 1 ? "company matches" : "companies match"}{s.first.length ? `: ${s.first.slice(0, 3).map(c => c.name).join(", ")}…` : ""}</span>
              </A>
            </li>
          ))}
        </ul>
      )}
      <p className="pl-note">{NOT_ADVICE}</p>
      <More />
    </PublicPage>
  );
}

export function ScreenPage({ slug, signedIn }) {
  const [s, error] = useLoad(() => api.publicScreen(slug), slug);
  useEffect(() => { if (s) document.title = `${s.name}: ${s.matched} NSE stocks that match today | Jocular Insights`; }, [s]);
  return (
    <PublicPage title={s ? `${s.name}: NSE companies that match today` : "Stock screen"} signedIn={signedIn} updated={s?.pricesDate ? `${day(s.pricesDate)} (the latest NSE close)` : "with each NSE close"}>
      <p className="pl-crumb"><A to="/screens">Stock screens</A> › {s?.name ?? "…"}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!s && !error && <Wait />}
      {s && (
        <>
          <p className="pl-lede">{s.description}{s.description && !/[.!?]$/.test(s.description) ? "." : ""} <b>{s.matched}</b> of {s.total.toLocaleString("en-IN")} companies pass.</p>
          <h2 className="pl-h">The filters</h2>
          <ul className="pl-rules">{s.rules.map(r => <li key={r}>{r}</li>)}</ul>
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
    </PublicPage>
  );
}

export function ResultsCalendarPage({ signedIn }) {
  const [c, error] = useLoad(() => api.publicResultsCalendar(), "cal");
  const [open, setOpen] = useState({});
  useEffect(() => { document.title = "Quarterly results calendar: NSE companies announcing results this week | Jocular Insights"; }, []);
  const total = c?.days.reduce((n, d) => n + d.count, 0) ?? 0;
  return (
    <PublicPage title="Quarterly results calendar" signedIn={signedIn} updated={c ? `${day(c.today)}` : "daily"}>
      <p className="pl-lede">{c ? `${total} NSE companies have board meetings for results in the next two weeks, the largest companies first.` : "NSE companies' board meetings for results, the next two weeks."}</p>
      {error && <p className="nw-empty">{error}</p>}
      {!c && !error && <Wait />}
      {c?.days.map(d => {
        const all = open[d.date], list = all ? d.companies : d.companies.slice(0, 12);
        return (
          <section key={d.date} className="pl-day" aria-label={weekday(d.date)}>
            <h2 className="pl-h">{d.date === c.today ? "Today" : weekday(d.date)} <span>{d.count} {d.count === 1 ? "company" : "companies"}</span></h2>
            <div className="ex-day-list">
              {list.map(x => (
                <A key={x.symbol} to={stockPath(x.symbol)} className="ex-co"><CompanyLogo symbol={x.symbol} size={22} fallback={x.name} /><span>{x.name}</span></A>
              ))}
              {d.count > 12 && <button type="button" className="ex-more" onClick={() => setOpen(o => ({ ...o, [d.date]: !all }))}>{all ? "Fewer" : `+${d.count - 12} more`}</button>}
            </div>
          </section>
        );
      })}
      {c && !c.days.length && <p className="nw-empty">No results dates in the next two weeks on NSE's calendar.</p>}
      <p className="pl-note">Dates are board meetings companies have told NSE about; they can change.</p>
      <More />
    </PublicPage>
  );
}
