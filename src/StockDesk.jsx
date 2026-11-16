import { CalendarDays, CircleDollarSign, Bell, TriangleAlert, ArrowDown } from "lucide-react";
import { byId, chapterScore, chapterJudgement, chapterLine, chapterFigures } from "./chapterText.js";
import { resultsWatch, dividendWatch, cautions, keyFigures } from "./deskText.js";
import { alertsStore } from "./stores.js";
import { recentChanges } from "./recentChanges.js";
import { fmtRs } from "../server/levels.js";

// A company's page on a computer, laid out like a dashboard (26 Oct 2026:
// "it looks premium", then "design total page"): the company and its gist
// across the top, four chapter tiles, the chart beside what to watch, then
// one card per chapter — its answer and two figures on the left, its main
// panel on the right, its deeper tools under them (each chapter is a tab of
// its own, 27 Oct 2026). A phone keeps its
// tabbed chapters (StockDetail.jsx). Every word comes from chapterText.js and
// deskText.js; nothing here is a buy or sell call.

const TODAY = () => new Date().toISOString().slice(0, 10);

// The four tiles under the company: each chapter's answer and one figure;
// a click goes to its chapter
const TILES = ["business", "growth", "safety", "value"];
export function DeskTiles({ m, fairValue, price, onGo }) {
  const tiles = TILES.map(id => ({ id, s: chapterScore(id, m?.research), judge: chapterJudgement(id, m, { fairValue, price }) ?? chapterLine(id, m, { fairValue, price }), f: chapterFigures(id, m, { fairValue, price })[0] }))
    .filter(t => t.s && t.judge);
  if (tiles.length < 2) return null;
  return (
    <div className="dk-tiles">
      {tiles.map(({ id, s, judge, f }) => (
        <button key={id} type="button" className={`sd-card dk-tile sd-tone-${s.tone}`} onClick={() => onGo(id)} aria-label={`${byId[id].scoreLabel ?? byId[id].label}: ${judge}. Go to the chapter`}>
          <span className="dk-tile-top"><span>{byId[id].scoreLabel ?? byId[id].label}</span><em>{Math.round(s.score)} {s.word}</em></span>
          <span className="dk-tile-judge">{judge}</span>
          {f && <span className="dk-tile-fig"><b>{f.value}</b><small>{[f.label, f.against].filter(Boolean).join(" · ")}</small></span>}
          <ArrowDown className="dk-tile-go" size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// Beside the chart: its next results and dividend, the user's alerts on it,
// and what its own figures say to be careful of
// 5 Nov 2026 ("add the major things before, too"): the story so far, the last
// three months' results, ex-dates, bonuses, big moves and promoter changes, and
// what's announced ahead, from recentChanges.js like a phone's "What changed recently"
const shortDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
export function WhatToWatch({ m, symbol, holding, onAlert, signedIn }) {
  const alerts = alertsStore.use();
  const today = TODAY();
  const mine = (signedIn ? alerts ?? [] : []).filter(a => a.ticker === symbol && a.enabled);
  const coming = [resultsWatch(m, today), dividendWatch(m, today)].filter(Boolean);
  const careful = cautions(m);
  const { recent, upcoming } = recentChanges(m, holding, today, { window: 90 });
  // a dividend already in the dividend line above isn't said twice
  const lately = recent.filter(e => !(e.kind === "dividend" && coming.some(c => c.kind === "dividend"))).slice(0, 4);
  // what's announced ahead, less the results and dividend lines already above
  const ahead = upcoming.filter(u => !(coming.some(c => c.kind === "results") && /results|financial/i.test(u.text)) && !(coming.some(c => c.kind === "dividend") && /dividend/i.test(u.text))).slice(0, 3);
  if (!coming.length && !careful.length && !lately.length && !ahead.length) return null;
  const Icon = { results: CalendarDays, dividend: CircleDollarSign };
  return (
    <section className="sd-card dk-watch" aria-labelledby="dk-watch-title">
      <h3 id="dk-watch-title" className="dk-card-h">What to watch</h3>
      <ul className="dk-watch-list">
        {coming.map(w => { const I = Icon[w.kind]; return <li key={w.kind}><I size={16} aria-hidden="true" /><div><b>{w.title}</b>{w.text && <span>{w.text}</span>}</div></li>; })}
        <li>
          <Bell size={16} aria-hidden="true" />
          <div>
            <b>{mine.length ? `${mine.length === 1 ? "An alert" : `${mine.length} alerts`} set: ${mine.map(a => `${a.condition} ${fmtRs(a.threshold)}`).join(", ")}` : "No price alerts set"}</b>
            <button type="button" className="dk-link" onClick={onAlert}>{mine.length ? "Add another" : "Set one at a price you’d act on"} →</button>
          </div>
        </li>
      </ul>
      {ahead.length > 0 && (
        <>
          <h4 className="dk-watch-sub">Coming up</h4>
          <ol className="dk-watch-events">{ahead.map(e => <li key={`${e.kind}-${e.date}`}><time dateTime={e.date}>{shortDay(e.date)}</time><span>{e.text}</span></li>)}</ol>
        </>
      )}
      {lately.length > 0 && (
        <>
          <h4 className="dk-watch-sub">Lately</h4>
          <ol className="dk-watch-events">{lately.map(e => <li key={`${e.kind}-${e.date}`}><time dateTime={e.date}>{shortDay(e.date)}</time><span>{e.text}</span></li>)}</ol>
        </>
      )}
      {careful.length > 0 && (
        <>
          <h4 className="dk-watch-sub">From its figures</h4>
          <ul className="dk-watch-list dk-careful">
            {careful.map(c => <li key={c.title}><TriangleAlert size={16} aria-hidden="true" /><div><b>{c.title}</b><span>{c.text}</span></div></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

// Under the chart: the figures the chapters don't show, and where the price
// sits in its year
export function KeyFiguresRow({ m, price }) {
  const figs = keyFigures(m);
  const lo = m?.low52w, hi = m?.high52w;
  const at = lo > 0 && hi > lo && price > 0 ? Math.max(0, Math.min(1, (price - lo) / (hi - lo))) : null;
  if (!figs.length && at == null) return null;
  return (
    <div className="dk-keyfigs" aria-label="Key figures">
      {figs.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
      {at != null && (
        <div className="dk-range">
          <small>52 weeks · {fmtRs(lo)}–{fmtRs(hi)}</small>
          <span className="dk-range-bar" role="img" aria-label={`Price ${fmtRs(price)}, ${Math.round(at * 100)}% of the way from the year's low to its high`}><i style={{ left: `${at * 100}%` }} /></span>
        </div>
      )}
    </div>
  );
}

// ── The computer's Summary, as the owner chose from the mock-ups (16 Nov 2026):
// the chart full width, then "The scores, explained" (one card per chapter:
// its score, its answer in words and its checks, weakest first, at most
// four), then three even columns: what's coming, what its figures warn of,
// and why it moved. Words from chapterText.js and the research model.
const ORDER = { bad: 0, mid: 1, good: 2 };
const CARD_IDS = ["business", "growth", "safety", "owners", "value", "price"];
export function DeskScoreCards({ m, fairValue, price, onGo, checksOf }) {
  const cards = CARD_IDS.map(id => {
    const s = chapterScore(id, m?.research);
    if (!s) return null;
    const checks = checksOf(id) ?? [];
    return { id, s, judge: chapterJudgement(id, m, { fairValue, price }) ?? chapterLine(id, m, { fairValue, price }), checks };
  }).filter(Boolean);
  if (cards.length < 2) return null;
  const strong = cards.filter(c => c.s.tone === "good").length;
  return (
    <section className="dk-scores" aria-labelledby="dk-scores-h">
      <div className="dk-sec-h"><h2 id="dk-scores-h">The scores, explained</h2><span>{strong} of {cards.length} strong{m?.research?.coverage?.total ? ` · ${m.research.coverage.checked} checks from its filings` : ""}</span></div>
      <div className="dk-scores-grid">
        {cards.map(({ id, s, judge, checks }) => {
          const shown = [...checks].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]).slice(0, 4);
          const good = checks.filter(c => c.tone === "good").length;
          return (
            <button key={id} type="button" className={`dk-score sd-tone-${s.tone}`} onClick={() => onGo(id)} aria-label={`${byId[id].scoreLabel ?? byId[id].label}: ${Math.round(s.score)} of 100, ${s.word}. ${judge ?? ""} Open the chapter`}>
              <span className="dk-score-top"><span>{byId[id].scoreLabel ?? byId[id].label}</span><span className="dk-score-num"><b>{Math.round(s.score)}</b><small>{s.word}</small></span></span>
              {judge && <span className="dk-score-judge">{judge}</span>}
              {shown.length > 0 && (
                <span className="dk-score-checks">
                  {shown.map(c => <span key={c.key} className={`sd-tone-${c.tone}`}><i aria-hidden="true">{c.tone === "good" ? "✓" : c.tone === "bad" ? "✕" : "–"}</i>{c.question}</span>)}
                </span>
              )}
              <span className="dk-score-foot">{checks.length ? `${good} of ${checks.length} strong${checks.length > shown.length ? ` · ${checks.length - shown.length} more` : ""} · ` : ""}see the evidence ›</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Three even columns under the cards
export function DeskWatchColumns({ m, symbol, holding, onAlert, signedIn, moving }) {
  const alerts = alertsStore.use();
  const today = TODAY();
  const mine = (signedIn ? alerts ?? [] : []).filter(a => a.ticker === symbol && a.enabled);
  const coming = [resultsWatch(m, today), dividendWatch(m, today)].filter(Boolean);
  const careful = cautions(m);
  const { recent, upcoming } = recentChanges(m, holding, today, { window: 90 });
  const lately = recent.filter(e => !(e.kind === "dividend" && coming.some(c => c.kind === "dividend"))).slice(0, 3);
  const ahead = upcoming.filter(u => !(coming.some(c => c.kind === "results") && /results|financial/i.test(u.text)) && !(coming.some(c => c.kind === "dividend") && /dividend/i.test(u.text))).slice(0, 2);
  const Icon = { results: CalendarDays, dividend: CircleDollarSign };
  return (
    <div className="dk-cols">
      <section className="dk-col" aria-labelledby="dk-col-coming">
        <h2 id="dk-col-coming" className="dk-col-h">Coming up</h2>
        <ul className="dk-watch-list dk-col-box">
          {coming.map(w => { const I = Icon[w.kind]; return <li key={w.kind}><I size={16} aria-hidden="true" /><div><b>{w.title}</b>{w.text && <span>{w.text}</span>}</div></li>; })}
          {ahead.map(e => <li key={`${e.kind}-${e.date}`}><CalendarDays size={16} aria-hidden="true" /><div><b>{shortDay(e.date)}</b><span>{e.text}</span></div></li>)}
          <li>
            <Bell size={16} aria-hidden="true" />
            <div>
              <b>{mine.length ? `${mine.length === 1 ? "An alert" : `${mine.length} alerts`} set: ${mine.map(a => `${a.condition} ${fmtRs(a.threshold)}`).join(", ")}` : "No price alerts set"}</b>
              <button type="button" className="dk-link" onClick={onAlert}>{mine.length ? "Add another" : "Set one at a price you’d act on"} →</button>
            </div>
          </li>
        </ul>
      </section>
      <section className="dk-col" aria-labelledby="dk-col-figures">
        <h2 id="dk-col-figures" className="dk-col-h">From its figures</h2>
        <div className="dk-col-box">
          {careful.length > 0
            ? <ul className="dk-watch-list dk-careful">{careful.map(c => <li key={c.title}><TriangleAlert size={16} aria-hidden="true" /><div><b>{c.title}</b><span>{c.text}</span></div></li>)}</ul>
            : <p className="dk-col-empty">Nothing in its recent figures stands out as a caution.</p>}
          {lately.length > 0 && <ol className="dk-watch-events">{lately.map(e => <li key={`${e.kind}-${e.date}`}><time dateTime={e.date}>{shortDay(e.date)}</time><span>{e.text}</span></li>)}</ol>}
        </div>
      </section>
      {/* the panel inside names itself "Why is it moving?" for screen readers */}
      <div className="dk-col">
        <h2 className="dk-col-h" aria-hidden="true">Why is it moving?</h2>
        <div className="dk-col-box dk-col-moving">{moving}</div>
      </div>
    </div>
  );
}
