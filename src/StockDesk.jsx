import { CalendarDays, CircleDollarSign, Bell, TriangleAlert, ChevronDown, ArrowDown } from "lucide-react";
import { byId, chapterScore, chapterJudgement, chapterLine, chapterFigures } from "./chapterText.js";
import { resultsWatch, dividendWatch, cautions, keyFigures } from "./deskText.js";
import { alertsStore } from "./stores.js";
import { fmtRs } from "../server/levels.js";
import { NotesToggle } from "./StockChapters.jsx";

// A company's page on a computer, laid out like a dashboard (26 Oct 2026:
// "it looks premium", then "design total page"): the company and its gist
// across the top, four chapter tiles, the chart beside what to watch, then
// one card per chapter — its answer and two figures on the left, its main
// panel on the right, the deeper tools folded under "More". A phone keeps its
// tabbed chapters (StockDetail.jsx). Every word comes from chapterText.js and
// deskText.js; nothing here is a buy or sell call.

const TODAY = () => new Date().toISOString().slice(0, 10);

// A chapter's score as a bar with its word
function ScoreBar({ s }) {
  if (!s) return null;
  return (
    <div className={`dk-score sd-tone-${s.tone}`}>
      <span className="dk-score-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, Math.min(100, s.score))}%` }} /></span>
      <span className="dk-score-num"><b>{Math.round(s.score)}</b> {s.word}</span>
    </div>
  );
}

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
        <button key={id} type="button" className={`sd-card dk-tile sd-tone-${s.tone}`} onClick={() => onGo(id)} aria-label={`${byId[id].label}: ${judge}. Go to the chapter`}>
          <span className="dk-tile-top"><span>{byId[id].label}</span><em>{Math.round(s.score)} {s.word}</em></span>
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
export function WhatToWatch({ m, symbol, onAlert, signedIn }) {
  const alerts = alertsStore.use();
  const today = TODAY();
  const mine = (signedIn ? alerts ?? [] : []).filter(a => a.ticker === symbol && a.enabled);
  const coming = [resultsWatch(m, today), dividendWatch(m, today)].filter(Boolean);
  const careful = cautions(m);
  if (!coming.length && !careful.length) return null;
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

// The deeper tools, folded. Built with the page (a computer has the room;
// a phone never shows these) so a link into one — the Safety panel's line
// to the scorecard — finds it and opens the fold (StockSide.jsx openCheck)
function More({ label, children }) {
  return (
    <details className="dk-more">
      <summary><ChevronDown size={16} aria-hidden="true" /> {label}</summary>
      <div className="dk-more-body">{children}</div>
    </details>
  );
}

// One chapter: its answer, score and two figures on the left with a note;
// its main panel on the right; deeper tools folded underneath
export function DeskChapter({ id, m, fairValue, price, note, more, moreLabel, children, sec, tab }) {
  const c = byId[id];
  const s = chapterScore(id, m?.research);
  const judge = m ? chapterJudgement(id, m, { fairValue, price }) ?? chapterLine(id, m, { fairValue, price }) : null;
  const figures = m ? chapterFigures(id, m, { fairValue, price }) : [];
  return (
    <section id={sec ? `sec-${sec}` : undefined} className="ss-section dk-chapter" data-tab={tab ?? id} aria-labelledby={`dk-${id}`}>
      <div className="dk-chapter-grid">
        <header className="dk-chapter-left">
          <div className="dk-chapter-q"><h2 id={`dk-${id}`}>{c.label}</h2><NotesToggle /></div>
          <p className="dk-chapter-question">{c.question}</p>
          <ScoreBar s={s} />
          {judge && <p className="dk-chapter-judge">{judge}</p>}
          {figures.length > 0 && (
            <dl className="dk-figs">
              {figures.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd>{f.against && <small>{f.against}</small>}</div>)}
            </dl>
          )}
          {note && <p className="dk-note">{note.lead && <b>{note.lead} </b>}{note.text}</p>}
        </header>
        <div className="dk-chapter-right">{children}</div>
      </div>
      {more && <More label={moreLabel ?? `More on ${c.label.toLowerCase()}`}>{more}</More>}
    </section>
  );
}
