import { recentChanges } from "./recentChanges.js";
import { todayIst } from "./watchEvents.js";

// "What changed recently", at the top of News & filings: the last six weeks'
// results, ex-dates, price moves and promoter changes, and what's due in the
// next two weeks (recentChanges.js). The filings themselves are below it.

const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default function StockRecent({ m, holding }) {
  if (!m) return null;
  const { recent, upcoming } = recentChanges(m, holding, todayIst());
  return (
    <section className="sd-card sd-recent" aria-labelledby="recent-title">
      <h3 id="recent-title" className="sd-card-title">What changed recently</h3>
      {recent.length
        ? <ol className="sd-recent-list">{recent.map(r => <li key={`${r.kind}-${r.date}`}><time dateTime={r.date}>{day(r.date)}</time><span>{r.text}</span></li>)}</ol>
        : <p className="sd-muted">Nothing new in the last six weeks: no results, ex-dates, big price moves or changes in the promoters' holding.</p>}
      {upcoming.length > 0 && (
        <>
          <h4 className="sd-glance-h sd-recent-h">Coming up</h4>
          <ol className="sd-recent-list">{upcoming.map(r => <li key={`${r.kind}-${r.date}`}><time dateTime={r.date}>{day(r.date)}</time><span>{r.text}</span></li>)}</ol>
        </>
      )}
      <p className="sd-foot">From the company's filings with NSE and NSE's daily closes. The announcements themselves are below.</p>
    </section>
  );
}
