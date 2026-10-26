import { Check, Minus, X, TriangleAlert, Eye, Info } from "lucide-react";
import { CHAPTERS, byId, WORD, chapterScore, chapterLine, chapterJudgement, chapterFigures, gistLine, watchFor } from "./chapterText.js";

export { CHAPTERS };

// A company page on a phone reads as chapters, in the order a careful
// investor asks (26 Oct 2026: "once we should understand about the stock
// totally"): what is it, is it good, is it growing, is it safe, who owns it,
// is the price fair, how is the market treating it, what's new. Each score
// lives in the chapter with its evidence — the Summary has one line per
// chapter, and each chapter opens with its answer and ends with its checks
// and what to watch. Every score, word and sentence is the research model's
// (server/research.js); nothing here is a buy or sell call.

// The Summary's top: the gist, then a bar per chapter, each opening it
export function VerdictLines({ m, fairValue, price, onGo }) {
  const r = m?.research;
  const rows = CHAPTERS.filter(c => !["overview", "news"].includes(c.id))
    .map(c => ({ c, s: chapterScore(c.id, r) }))
    .filter(x => x.s);
  const gist = gistLine(m, { fairValue, price });
  if (!rows.length && !gist) return null;
  return (
    <section className="sd-card sd-verdict" aria-labelledby="verdict-title">
      <div className="sd-chapter-qrow"><h3 id="verdict-title" className="sd-verdict-h">In short</h3><NotesToggle /></div>
      {gist && <p className="sd-gist">{gist}</p>}
      <ul className="sd-verdict-list">
        {rows.map(({ c, s }) => (
          <li key={c.id}>
            <button type="button" className={`sd-verdict-row sd-tone-${s.tone}`} onClick={() => onGo(c.id)} aria-label={`${c.label}: ${Math.round(s.score)} of 100, ${s.word}`}>
              <span className="sd-verdict-name">{c.label}</span>
              <span className="sd-verdict-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, Math.min(100, s.score))}%` }} /></span>
              <span className="sd-verdict-num">{Math.round(s.score)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="sd-verdict-hint">Tap a line for its chapter · scored from NSE filings, not advice</p>
    </section>
  );
}

// The page's small print (sources, how a figure was worked out) is hidden on
// a phone until asked for, here (index.css html.sd-notes)
export function NotesToggle() {
  return (
    <button type="button" className="sd-notes-btn" aria-label="Show sources and notes"
      onClick={e => { const on = document.documentElement.classList.toggle("sd-notes"); e.currentTarget.setAttribute("aria-pressed", String(on)); }}>
      <Info size={16} aria-hidden="true" />
    </button>
  );
}

// A chapter's opening: the question; the answer in plain words with its
// score; two figures that back it, each against something
export function ChapterTop({ id, m, fairValue, price }) {
  const c = byId[id];
  const s = chapterScore(id, m?.research);
  const judge = chapterJudgement(id, m, { fairValue, price });
  const line = chapterLine(id, m, { fairValue, price });
  const figures = chapterFigures(id, m, { fairValue, price });
  return (
    <header className="sd-chapter-top">
      <div className="sd-chapter-qrow"><p className="sd-chapter-q">{c.question}</p><NotesToggle /></div>
      {(judge || line || s) && (
        <div className={`sd-chapter-answer sd-tone-${s?.tone ?? "none"}`}>
          <div className="sd-chapter-head">
            <span className="sd-chapter-line">{judge ?? line}</span>
            {s && <span className="sd-chapter-score"><b>{Math.round(s.score)}</b> {s.word}</span>}
          </div>
          {figures.length > 0 && (
            <div className="sd-chapter-figs">
              {figures.map(f => <div key={f.label}><small>{f.label}</small><b>{f.value}</b>{f.against && <small>{f.against}</small>}</div>)}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

// research.js's verdict word at the end of a check's sentence; the mark says it
const VERDICT = /\s*—\s*(strong|fair|weak|poor)\.$/;
const say = t => String(t ?? "").replace(VERDICT, ".");
const mark = s => (s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
const MARKS = { good: Check, mid: Minus, bad: X };

function CheckRow({ label, score, text }) {
  const tone = mark(score);
  const Icon = MARKS[tone];
  return (
    <li className={`sd-check sd-tone-${tone}`}>
      <span className="sd-check-mark" aria-label={WORD[tone]}><Icon size={14} strokeWidth={2.4} aria-hidden="true" /></span>
      <span className="sd-check-text"><small>{label}</small>{say(text)}</span>
    </li>
  );
}

// A chapter's end: the checks behind its score, then what to watch
export function ChapterEnd({ id, m }) {
  const r = m?.research;
  const c = byId[id];
  let rows = [];
  let skipped = 0;
  if (id === "price") {
    rows = (r?.technical?.parts ?? []).filter(p => p.score != null).map(p => ({ key: p.id, label: p.label, score: p.score, text: p.reason }));
  } else {
    for (const g of (c.groups ?? []).map(gid => r?.groups.find(x => x.id === gid)).filter(g => g?.applicable)) {
      for (const it of g.items ?? []) {
        if (it.hide || it.na) continue;
        if (it.score == null || !it.reason) { skipped++; continue; }
        rows.push({ key: `${g.id}-${it.id}`, label: it.label, score: it.score, text: it.reason });
      }
    }
  }
  const flags = id === "safety" || id === "owners" ? (r?.flags ?? []) : [];
  const watch = m ? watchFor(id, m) : [];
  if (!rows.length && !watch.length && !flags.length) return null;
  return (
    <>
      {(rows.length > 0 || flags.length > 0) && (
        <section className="sd-card sd-checks" aria-labelledby={`checks-${id}`}>
          <h3 id={`checks-${id}`} className="sd-card-title">The checks</h3>
          {flags.map(f => (
            <p key={f.id} className={`sd-flag sd-tone-${f.severity === "critical" ? "bad" : "mid"}`}>
              <TriangleAlert size={15} aria-hidden="true" /> <span><b>{f.severity === "critical" ? "Red flag." : "Caution."}</b> {f.text}</span>
            </p>
          ))}
          <ul className="sd-check-list">{rows.map(({ key, ...row }) => <CheckRow key={key} {...row} />)}</ul>
          {skipped > 0 && <p className="sd-foot">{skipped === 1 ? "One check" : `${skipped} checks`} couldn't be made from the filings.</p>}
        </section>
      )}
      {watch.length > 0 && (
        <section className="sd-card sd-watch" aria-labelledby={`watch-${id}`}>
          <h3 id={`watch-${id}`} className="sd-card-title"><Eye size={16} aria-hidden="true" /> What to watch</h3>
          <ul className="sd-watch-list">{watch.map(([label, text]) => <li key={label}><b>{label}</b> {text}</li>)}</ul>
        </section>
      )}
    </>
  );
}
