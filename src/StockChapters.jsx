import { Check, Minus, X, ChevronRight, TriangleAlert, Eye } from "lucide-react";
import { fmtRs } from "../server/levels.js";

// A company page on a phone reads as chapters, in the order a careful
// investor asks (26 Oct 2026: "once we should understand about the stock
// totally"): what is it, is it good, is it growing, is it safe, who owns it,
// is the price fair, how is the market treating it, what's new. Each score
// lives in the chapter with its evidence — the Summary has one line per
// chapter, and each chapter opens with its answer and ends with its checks
// and what to watch. Every score, word and sentence is the research model's
// (server/research.js); nothing here is a buy or sell call.

// id, tab label, the question it answers, the research groups it judges,
// the page parts it holds (sec-…)
export const CHAPTERS = [
  { id: "overview", label: "Summary", question: "What is it, and what's the gist?", parts: ["overview", "events"] },
  { id: "business", label: "Business", question: "What does it do, and how well?", groups: ["business", "earnings"], parts: ["about", "business", "peers"] },
  { id: "growth", label: "Growth", question: "Is it getting bigger?", groups: ["growth"], parts: ["financials"] },
  { id: "safety", label: "Safety", question: "Could it get through bad years?", groups: ["balance"], parts: ["health"] },
  { id: "owners", label: "Owners", question: "Who owns it, and what do shareholders get?", groups: ["governance"], parts: ["holding", "dividends"] },
  { id: "value", label: "Value", question: "Is the price fair for what it earns?", groups: ["valuation"], parts: ["valuation", "sizing", "levels"] },
  { id: "price", label: "Price", question: "How is the market treating it?", parts: ["performance", "technicals"] },
  { id: "news", label: "News", question: "What has it said lately?", parts: ["filings", "web"] },
];
const byId = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));

// The scorecard's bands and words (StockSide.jsx)
const band = s => (s == null ? "none" : s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
const WORD = { good: "Strong", mid: "Fair", bad: "Weak", none: "No data" };
const num = v => v != null && Number.isFinite(Number(v));
const p1 = v => `${Math.abs(v) >= 10 ? Math.round(v) : Number(v).toFixed(1)}%`;
const x1 = v => `${Number(v) >= 10 ? Math.round(v) : Number(v).toFixed(1)}×`;

// A chapter's score and word: its groups weighted as the quality score
// weighs them; Value and Price by their own lenses
export function chapterScore(id, r) {
  if (!r) return null;
  if (id === "price") {
    const t = r.technical;
    return t?.score == null ? null : { score: t.score, word: t.label, tone: t.score >= 65 ? "good" : t.score >= 40 ? "mid" : "bad" };
  }
  const groups = (byId[id]?.groups ?? []).map(g => r.groups.find(x => x.id === g)).filter(g => g?.applicable && g.score != null);
  if (!groups.length) return null;
  const weight = groups.reduce((s, g) => s + (g.weight ?? 1), 0);
  const score = groups.reduce((s, g) => s + g.score * (g.weight ?? 1), 0) / weight;
  const tone = band(score);
  return { score, word: id === "value" ? r.valuation?.label ?? WORD[tone] : WORD[tone], tone };
}

// The chapter's answer in a line, from the company's own figures
export function chapterLine(id, m, { fairValue, price } = {}) {
  if (!m) return null;
  switch (id) {
    case "business":
      if (m.lender) return num(m.roeAvg) ? `${p1(m.roeAvg)} average return on equity` : null;
      if (num(m.roce5y)) return `${p1(m.roce5y)} return on capital${num(m.opm5y) ? `, ${p1(m.opm5y)} margins` : ""}`;
      return null;
    case "growth": {
      const eps = m.epsGrowth3y, sales = m.salesGrowth3y;
      if (!num(eps) && !num(sales)) return null;
      const say = (v, what) => `${what} ${v >= 0 ? "up" : "down"} ${p1(Math.abs(v))} a year`;
      return [num(eps) && say(eps, "EPS"), num(sales) && say(sales, "sales")].filter(Boolean).join(", ") + " over 3 years";
    }
    case "safety":
      if (m.lender) return m.bank?.gnpaPct != null ? `Bad loans ${p1(m.bank.gnpaPct)} of loans, capital ${p1(m.bank.cet1Pct)}` : null;
      if (num(m.netDebtCr) && m.netDebtCr <= 0) return `More cash than debt${num(m.interestCoverage) ? `, interest covered ${x1(m.interestCoverage)}` : ""}`;
      if (num(m.debtToEquity)) return `Debt ${x1(m.debtToEquity)} its equity${num(m.interestCoverage) ? `, interest covered ${x1(m.interestCoverage)}` : ""}`;
      return null;
    case "owners":
      if (!num(m.promoterPct)) return null;
      if (m.promoterPct === 0) return "No promoter group: held by institutions and the public";
      return `Promoters hold ${p1(m.promoterPct)}, ${m.pledgedPct > 0 ? `${p1(m.pledgedPct)} of it pledged` : "none pledged"}`;
    case "value":
      if (num(fairValue) && num(price) && price > 0) {
        const gap = (fairValue / price - 1) * 100;
        return `Fair value ${fmtRs(fairValue)}, ${Math.abs(gap) < 2 ? "about today's price" : `${p1(Math.abs(gap))} ${gap > 0 ? "above" : "below"} the price`}`;
      }
      return num(m.pe) && num(m.medianPe) ? `P/E ${Math.round(m.pe)} against its usual ${Math.round(m.medianPe)}` : null;
    case "price":
      if (!num(m.ret1y)) return null;
      return `${m.ret1y >= 0 ? "Up" : "Down"} ${p1(Math.abs(m.ret1y))} in a year${num(m.vsSma200) ? `, ${m.vsSma200 >= 0 ? "above" : "below"} its 200-day average` : ""}`;
    default:
      return null;
  }
}

// The Summary's verdict: one line per chapter, each opening it
export function VerdictLines({ m, fairValue, price, onGo }) {
  const r = m?.research;
  const rows = CHAPTERS.filter(c => !["overview", "news"].includes(c.id))
    .map(c => ({ c, s: chapterScore(c.id, r), line: chapterLine(c.id, m, { fairValue, price }) }))
    .filter(x => x.s || x.line);
  if (!rows.length) return null;
  return (
    <section className="sd-card sd-verdict" aria-labelledby="verdict-title">
      <h3 id="verdict-title" className="sd-card-title">In one line each</h3>
      <ul className="sd-verdict-list">
        {rows.map(({ c, s, line }) => (
          <li key={c.id}>
            <button type="button" className={`sd-verdict-row sd-tone-${s?.tone ?? "none"}`} onClick={() => onGo(c.id)}>
              <span className="sd-verdict-name">{c.label}</span>
              <span className="sd-verdict-line">{line ?? c.question}</span>
              {s && <span className="sd-verdict-word">{s.word}</span>}
              <ChevronRight size={16} className="sd-score-go" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className="sd-foot">From NSE filings and closes, scored by the research model. Observations, not advice.</p>
    </section>
  );
}

// A chapter's opening: the question, and its answer with the score
export function ChapterTop({ id, m, fairValue, price }) {
  const c = byId[id];
  const s = chapterScore(id, m?.research);
  const line = chapterLine(id, m, { fairValue, price });
  return (
    <header className="sd-chapter-top">
      <p className="sd-chapter-q">{c.question}</p>
      {(line || s) && (
        <div className={`sd-chapter-answer sd-tone-${s?.tone ?? "none"}`}>
          {line && <span className="sd-chapter-line">{line}</span>}
          {s && <span className="sd-chapter-score"><b>{Math.round(s.score)}</b> {s.word}</span>}
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

// What to take to the next results, by chapter (ThesisMonitor.jsx's
// questions, each now where its figures are)
function watchFor(id, m) {
  const q = [];
  if (id === "business" && num(m.opm) && num(m.opm5y)) q.push(["Operating margin", "Is the margin holding near its five-year average?"]);
  if (id === "growth" && num(m.salesGrowth3y)) q.push(["Revenue trend", "Is sales growth speeding up or slowing down?"]);
  if (id === "safety" && num(m.debtToEquity)) q.push(["Leverage", "Is debt growing faster than equity, or interest getting harder to cover?"]);
  if (id === "safety" && num(m.fcfCr)) q.push(["Cash generation", "Is free cash flow keeping up with profit?"]);
  if (id === "owners" && num(m.promoterPct) && m.promoterPct > 0) q.push(["Ownership", "Are the promoters' holding or pledges changing?"]);
  if (id === "value") q.push(["Earnings", "Does each year's EPS hold the fair value where it is?"]);
  if (id === "price" && num(m.vsSma200)) q.push(["Trend", "Does the price hold on the right side of its 200-day average?"]);
  return q;
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
