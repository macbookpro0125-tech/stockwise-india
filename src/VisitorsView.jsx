// The owner's visitor numbers (24 Oct 2026, server/visits.js): people a day
// and a week, page loads, signed-in people active and sign-ups — counted
// anonymously, totals only; and the detail (27 Oct 2026, "I want detailed
// report"): the pages people arrived on, where they came from, their device
// and the hour. Only the accounts in OWNER_EMAILS see the tab.
import { useEffect, useState } from "react";
import { api } from "./api.js";

const fmt = n => Number(n ?? 0).toLocaleString("en-IN");
const dayName = d => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const weekName = d => `Week of ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))}`;

// A page's address, as words
const PAGE_NAMES = { "/": "Front page", "/about": "About", "/help": "Help", "/methodology": "Methodology", "/privacy": "Privacy policy", "/disclaimer": "Disclaimer", "/stock-screener-india": "Stock screener (guide)", "/screens": "All screens", "/sectors": "All sectors", "/results-calendar": "Results calendar", "/explore": "Explore", "/news": "News", "/learn": "Guides", "/reset-password": "Reset password", Other: "Other addresses" };
const words = slug => { const t = slug.replace(/-/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
const pageName = k => PAGE_NAMES[k] ?? k.replace(/^\/stock\//, "Company · ").replace(/^\/(sector|screens|learn)\/(.+)$/, (_, kind, slug) => `${{ sector: "Sector", screens: "Screen", learn: "Guide" }[kind]} · ${words(slug)}`);
// A country's name from its two-letter code
const countryNames = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
const countryName = c => (c === "Unknown" ? "Unknown" : countryNames?.of(c) ?? c);
const hourName = h => { const n = Number(h); return `${n % 12 || 12} ${n < 12 ? "am" : "pm"}`; };

// One breakdown: its rows with a bar for visitors, the first few unless opened
// total: the period's visitors — for a list where each visit has one row
// (country, device, hour), the visits from before the list began counting
// are shown as one row, so the list adds up to the total (28 Oct 2026)
const EARLIER = "Before this list started";
function Breakdown({ id, title, note, rows: given = [], name = k => k, first = 8, total = null }) {
  const [all, setAll] = useState(false);
  const counted = given.reduce((n, r) => n + r.visitors, 0);
  const rows = total != null && total > counted ? [...given, { key: EARLIER, visitors: total - counted, pageLoads: null }] : given;
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map(r => r.visitors));
  const shown = all ? rows : rows.slice(0, first);
  return (
    <section className="vs-section vs-break" aria-labelledby={id}>
      <h3 className="ex-h" id={id}>{title}</h3>
      {note && <p className="vs-note">{note}</p>}
      <table className="vs-table">
        <thead><tr><th>{title.split(" ")[0] === "Pages" ? "Page" : "Name"}</th><th>Visitors</th><th>Page loads</th></tr></thead>
        <tbody>{shown.map(r => (
          <tr key={r.key}>
            <th className={r.key === EARLIER ? "vs-earlier" : undefined}>{r.key === EARLIER ? EARLIER : name(r.key)}</th>
            <td><span className="vs-bar" style={{ width: `${(r.visitors / max) * 100}%` }} aria-hidden="true" />{fmt(r.visitors)}</td>
            <td>{r.pageLoads == null ? "—" : fmt(r.pageLoads)}</td>
          </tr>
        ))}</tbody>
      </table>
      {rows.length > first && <button type="button" className="vs-more" onClick={() => setAll(a => !a)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </section>
  );
}

// Visitors by hour of the day, India's time
function Hours({ rows = [] }) {
  if (!rows.length) return null;
  const by = Object.fromEntries(rows.map(r => [r.key, r.visitors]));
  const max = Math.max(1, ...rows.map(r => r.visitors));
  const busiest = rows.reduce((a, b) => (b.visitors > a.visitors ? b : a));
  return (
    <section className="vs-section" aria-labelledby="vs-hours">
      <h3 className="ex-h" id="vs-hours">Time of day</h3>
      <p className="vs-note">Visitors by hour, India's time. Busiest: {hourName(busiest.key)} ({fmt(busiest.visitors)}).</p>
      <div className="vs-hours" role="img" aria-label={`Visitors by hour; busiest ${hourName(busiest.key)}`}>
        {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map(h => (
          <span key={h} className="vs-hour" title={`${hourName(h)}: ${fmt(by[h] ?? 0)}`}>
            <i style={{ height: `${((by[h] ?? 0) / max) * 100}%` }} />
            <small>{Number(h) % 6 === 0 ? hourName(h) : ""}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

export default function VisitorsView() {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("today");
  useEffect(() => { api.ownerStats().then(setS).catch(e => setError(e.message)); }, []);
  if (error) return <div className="vs-page"><p className="nw-empty">{error}</p></div>;
  if (!s) return <div className="vs-page"><div className="nw-skel" role="status" aria-label="Loading">{[0, 1, 2].map(i => <span key={i} />)}</div></div>;
  // one period for the whole page (28 Oct 2026, "last month, last week button")
  const PERIODS = [["today", "Today", 1], ["last7", "Last 7 days", 7], ["last30", "Last 30 days", 30]];
  const [, label, span] = PERIODS.find(([k]) => k === period);
  const from = new Date(Date.parse(`${s.today}T00:00:00Z`) - (span - 1) * 86_400_000).toISOString().slice(0, 10);
  const inPeriod = s.days.filter(d => d.day >= from);
  const sum = k => inPeriod.reduce((n, d) => n + (d[k] ?? 0), 0);
  const many = span > 1;
  const max = Math.max(1, ...inPeriod.map(d => d.visitors));
  return (
    <div className="vs-page">
      <div className="vs-period vs-period-top" role="group" aria-label="Period">
        {PERIODS.map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
      </div>
      <div className="vs-tiles">
        <div className="vs-tile"><span>Visitors · {label.toLowerCase()}</span><b>{fmt(sum("visitors"))}</b><em>{many ? "Each day's visitors added up" : "Each person once"}</em></div>
        <div className="vs-tile"><span>Page loads</span><b>{fmt(sum("pageLoads"))}</b><em>Every page opened</em></div>
        <div className="vs-tile"><span>Signed in</span><b>{fmt(sum("activeUsers"))}</b><em>{many ? "Accounts each day, added up" : "Accounts that opened the app"}</em></div>
        <div className="vs-tile"><span>Sign-ups</span><b>{fmt(sum("signups"))}</b><em>{fmt(s.accounts)} {s.accounts === 1 ? "account" : "accounts"} in all</em></div>
      </div>

      <section className="vs-section" aria-labelledby="vs-days">
        <h3 className="ex-h" id="vs-days">By day</h3>
        {inPeriod.length ? (
          <table className="vs-table">
            <thead><tr><th>Day</th><th>Visitors</th><th>Page loads</th><th>Signed in</th><th>Sign-ups</th></tr></thead>
            <tbody>{inPeriod.map(d => (
              <tr key={d.day}>
                <th>{d.day === s.today ? "Today" : dayName(d.day)}</th>
                <td><span className="vs-bar" style={{ width: `${(d.visitors / max) * 100}%` }} aria-hidden="true" />{fmt(d.visitors)}</td>
                <td>{fmt(d.pageLoads)}</td><td>{fmt(d.activeUsers)}</td><td>{fmt(d.signups)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="nw-empty">Nothing counted yet in this period.</p>}
      </section>

      {s.weeks.length > 0 && (
        <section className="vs-section" aria-labelledby="vs-weeks">
          <h3 className="ex-h" id="vs-weeks">By week</h3>
          <ul className="vs-weeks">{s.weeks.map(w => <li key={w.week}><span>{w.week === s.week ? "This week" : weekName(w.week)}</span><b>{fmt(w.visitors)}</b></li>)}</ul>
        </section>
      )}

      {s.detail && (
        <>
          {Object.keys(s.detail[period] ?? {}).length === 0 && <p className="nw-empty">No detail yet{s.detailSince ? "" : " — it starts with the next visit"}.</p>}
          <Breakdown id="vs-pages" title="Pages people arrived on" note="The page a visit started on, from Google, a link or a typed address. Someone who opened two pages counts on both, so this adds up to more than the visitors." rows={s.detail[period]?.page} name={pageName} />
          <Breakdown id="vs-sources" title="Where they came from" note="The site a link was on. Typed, bookmark or app: no link, as when the address is typed, saved, or opened in our app." rows={s.detail[period]?.source} />
          <Breakdown id="vs-countries" title="Country" note="From each visitor's internet address, looked up on our server; only the country is kept." rows={s.detail[period]?.country} name={countryName} total={sum("visitors")} />
          <Breakdown id="vs-devices" title="Device" rows={s.detail[period]?.device} total={sum("visitors")} />
          <Hours rows={s.detail[period]?.hour} />
          {many && <p className="vs-note">Over {span} days each day's visitors are added up, so someone who came on two days counts twice; By week counts each person once a week.</p>}
        </>
      )}

      <p className="nw-note">Counted on our own server since {s.since ? dayName(s.since) : "today"}, without cookies: each visitor is a code made with a secret that's deleted at the end of the day (and the week), so nobody can be identified or followed. Robots and link previews aren't counted; from 30 Oct 2026 a visit counts only once the page has started in a browser, which most robots never do, so earlier days count more. One person on a phone and a computer counts twice.{s.detailSince ? ` The detail by page, source, device, hour and country starts on ${dayName(s.detailSince)}.` : ""}</p>
    </div>
  );
}
