import { pairing } from "./overallRank.js";
import { TwoScores } from "./twoScores.jsx";
import { useState } from "react";
import { Check, Minus, X, TriangleAlert, Eye, Info, ChevronRight, ChevronDown, CalendarDays, CircleDollarSign, Bell } from "lucide-react";
import { chapterChecks } from "./ChapterTab.jsx";
import { resultsWatch, dividendWatch, cautions } from "./deskText.js";
import { alertsStore } from "./stores.js";
import { fmtRs } from "../server/levels.js";
import { CHAPTERS, byId, WORD, band, chapterScore, chapterLine, chapterJudgement, chapterFigures, gistLine, watchFor } from "./chapterText.js";

export { CHAPTERS };

// A company page on a phone reads as chapters, in the order a careful
// investor asks (26 Oct 2026: "once we should understand about the stock
// totally"): what is it, is it good, is it growing, is it safe, who owns it,
// is the price fair, how is the market treating it, what's new. Each score
// lives in the chapter with its evidence — the Summary has one line per
// chapter, and each chapter opens with its answer and ends with its checks
// and what to watch. Every score, word and sentence is the research model's
// (server/research.js); nothing here is a buy or sell call.

// 15 Nov 2026 ("Yes, build it", the phone mock-ups): a phone's company page
// reads as one plain heading per part, each part in one glass box, as on
// Screeners. The heading says what the box holds; a panel's own title inside
// is hidden (index.css .sd-pbox).
export function PBlock({ id, title, right, className = "", children }) {
  return (
    <div id={id} className={`sd-pblock ${className}`}>
      {(title || right) && <div className="sd-ph-row">{title && <h3 className="sd-ph">{title}</h3>}{right}</div>}
      <div className="sd-pbox">{children}</div>
    </div>
  );
}

const ROW_MARKS = { good: Check, mid: Minus, bad: X };
// One row of a grouped list: a mark (✓ – ✗) or a line icon, a name and a line
// under it, and what sits at its end
export function PRow({ tone, icon: Icon, name, sub, end, onClick, label }) {
  const M = tone ? ROW_MARKS[tone] : null;
  const inner = (
    <>
      {M ? <span className={`sd-prow-mark sd-tone-${tone}`} aria-label={WORD[tone]}><M size={14} strokeWidth={2.4} aria-hidden="true" /></span>
        : Icon ? <span className="sd-prow-ic" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span> : null}
      <span className="sd-prow-tx"><span className="sd-prow-nm">{name}</span>{sub && <span className="sd-prow-sb">{sub}</span>}</span>
      {(end || onClick) && <span className="sd-prow-end">{end}{onClick && <ChevronRight size={18} aria-hidden="true" />}</span>}
    </>
  );
  return <li className={`sd-prow${tone ? ` sd-tone-${tone}` : ""}`}>{onClick ? <button type="button" onClick={onClick} aria-label={label}>{inner}</button> : <div>{inner}</div>}</li>;
}

// The Summary's top: the overall score, the gist and its rank, then one line
// per chapter in words — its answer, its score — each opening its chapter
export function VerdictLines({ m, fairValue, price, onGo }) {
  const r = m?.research;
  const rows = CHAPTERS.filter(c => !["overview", "news"].includes(c.id))
    .map(c => ({ c, s: chapterScore(c.id, r), line: chapterJudgement(c.id, m, { fairValue, price }) ?? chapterLine(c.id, m, { fairValue, price }) }))
    .filter(x => x.s);
  const gist = gistLine(m, { fairValue, price });
  if (!rows.length && !gist) return null;
  // the company's overall score, top right (4 Nov 2026: "show the overall score").
  // 12 Nov 2026: the research model's overall score — quality and valuation
  // blended, trimmed for price swings and data gaps — the same number the
  // lists call Overall
  const o = r?.overall?.score;
  const overall = o != null && Number.isFinite(o) ? { score: Math.round(o), tone: band(o) } : null;
  // how complete the figures behind it are (research.js confidence: coverage,
  // source, recency, freshness), in a word
  const conf = r?.confidence;
  const confWord = conf == null ? null : conf >= 80 ? "High" : conf >= 60 ? "Medium" : "Low";
  return (
    <section className="sd-verdict" aria-labelledby="verdict-title">
      <div className="sd-ph-row">
        <h3 id="verdict-title" className="sd-ph">In short</h3>
        <span className="sd-verdict-overall">
          {/* the business score and the price, apart (21 Nov 2026: one blended number read 33 for a strong, dear company) */}
          <TwoScores research={r} />
          <NotesToggle />
        </span>
      </div>
      {gist && <p className="sd-gist">{gist}</p>}
      {pairing(m) && (
        <p className={`sd-pair sd-pair-${pairing(m).tone}`} title={pairing(m).text}>
          <b>{pairing(m).label}</b> · {pairing(m).tone === "good" ? "this pairing beat the average company in our tests" : "this pairing did worst in our tests"} · <a href={pairing(m).href}>{pairing(m).tone === "good" ? "See them all" : "How we tested"}</a>
        </p>
      )}
      {rows.length > 0 && (
        <ul className="sd-prows">
          {rows.map(({ c, s, line }) => (
            <PRow key={c.id} tone={s.tone} name={c.scoreLabel ?? c.label} sub={line} onClick={() => onGo(c.id)}
              label={`${c.scoreLabel ?? c.label}: ${line ? `${line}. ` : ""}${Math.round(s.score)} of 100, ${s.word}`}
              end={<span className={`sd-prow-score sd-tone-${s.tone}`}><b>{Math.round(s.score)}</b><small>{s.word}</small></span>} />
          ))}
        </ul>
      )}
      <p className="sd-pfoot">
        {confWord && <span className={`sd-conf-${confWord.toLowerCase()}`} title="How complete and recent the filed figures behind the scores are: not a forecast, and not confidence in the company">Data confidence <b>{confWord}</b>{r?.coverage?.total ? ` · ${r.coverage.checked} of ${r.coverage.total} checks have figures` : ""} · </span>}
        scored from NSE filings, not advice
      </p>
    </section>
  );
}

// The Summary's What to watch on a phone (the computer's list, 15 Nov 2026):
// its next results and dividend, what its own figures say to be careful of,
// and the user's price alerts on it
const TODAY = () => new Date().toISOString().slice(0, 10);
export function PhoneWatch({ m, symbol, signedIn, onAlert }) {
  const alerts = alertsStore.use();
  const today = TODAY();
  const mine = (signedIn ? alerts ?? [] : []).filter(a => a.ticker === symbol && a.enabled);
  const coming = [resultsWatch(m, today), dividendWatch(m, today)].filter(Boolean);
  const careful = cautions(m);
  const Icon = { results: CalendarDays, dividend: CircleDollarSign };
  return (
    <PBlock title="What to watch">
      <ul className="sd-prows">
        {coming.map(w => <PRow key={w.kind} icon={Icon[w.kind]} name={w.title} sub={w.text} />)}
        {careful.map(c => <PRow key={c.title} icon={TriangleAlert} name={c.title} sub={c.text} />)}
        <PRow icon={Bell} onClick={onAlert}
          name={mine.length ? `${mine.length === 1 ? "An alert" : `${mine.length} alerts`} set: ${mine.map(a => `${a.condition} ${fmtRs(a.threshold)}`).join(", ")}` : "No price alerts set"}
          sub={<span className="sd-prow-teal">{mine.length ? "Add another" : "Set one at a price you’d act on"}</span>}
          label={mine.length ? "Add another price alert" : "Set a price alert"} />
      </ul>
    </PBlock>
  );
}

// A row that opens to show what's under it, built only once opened (a closed
// <details> still builds it all; the scores folded in the Summary made each
// company open slower, 26 Oct 2026)
export function FoldRow({ id, icon: Icon, name, sub, children }) {
  const [opened, setOpened] = useState(false);
  return (
    <li className="sd-prow sd-prow-fold">
      <details id={id} onToggle={e => { if (e.currentTarget.open) setOpened(true); }}>
        <summary>
          {Icon && <span className="sd-prow-ic" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>}
          <span className="sd-prow-tx"><span className="sd-prow-nm">{name}</span>{sub && <span className="sd-prow-sb">{sub}</span>}</span>
          <span className="sd-prow-end"><ChevronDown className="sd-prow-chev" size={18} aria-hidden="true" /></span>
        </summary>
        <div className="sd-prow-body">{opened && children}</div>
      </details>
    </li>
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

// A chapter's checks and what to watch, right under its answer (15 Nov 2026:
// they came last, under the evidence): each check as the plain question it
// asks, with its mark and the model's own finding — the computer's questions
// (ChapterTab.jsx) — then what to watch; the evidence follows
export function ChapterEnd({ id, m }) {
  const r = m?.research;
  const c = byId[id];
  const rows = chapterChecks(id, r);
  let skipped = 0;
  if (id !== "price") {
    for (const g of (c.groups ?? []).map(gid => r?.groups.find(x => x.id === gid)).filter(g => g?.applicable)) {
      for (const it of g.items ?? []) if (!it.hide && !it.na && (it.score == null || !it.reason)) skipped++;
    }
  }
  const flags = id === "safety" || id === "owners" ? (r?.flags ?? []) : [];
  const watch = m ? watchFor(id, m) : [];
  if (!rows.length && !watch.length && !flags.length) return null;
  const strong = rows.filter(x => x.tone === "good").length;
  return (
    <div className="sd-chapter-end">
      {(rows.length > 0 || flags.length > 0) && (
        <section className="sd-checks" aria-labelledby={`checks-${id}`}>
          <div className="sd-ph-row">
            <h3 id={`checks-${id}`} className="sd-ph">The checks</h3>
            {rows.length > 0 && <span className="sd-ph-note">{strong} of {rows.length} strong</span>}
          </div>
          {flags.map(f => (
            <p key={f.id} className={`sd-flag sd-tone-${f.severity === "critical" ? "bad" : "mid"}`}>
              <TriangleAlert size={15} aria-hidden="true" /> <span><b>{f.severity === "critical" ? "Red flag." : "Caution."}</b> {f.text}</span>
            </p>
          ))}
          {rows.length > 0 && (
            <ul className="sd-prows">
              {rows.map(x => <PRow key={x.key} tone={x.tone} name={x.question} sub={<span title={`Checked: ${x.measure}`}>{x.answer}</span>} />)}
            </ul>
          )}
          {skipped > 0 && <p className="sd-pfoot">{skipped === 1 ? "One check" : `${skipped} checks`} couldn't be made from the filings.</p>}
        </section>
      )}
      {watch.length > 0 && (
        <section className="sd-watch" aria-labelledby={`watch-${id}`}>
          <div className="sd-ph-row"><h3 id={`watch-${id}`} className="sd-ph">What to watch</h3></div>
          <ul className="sd-prows">{watch.map(([label, text]) => <PRow key={label} icon={Eye} name={label} sub={text} />)}</ul>
        </section>
      )}
    </div>
  );
}
