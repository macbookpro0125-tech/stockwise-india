import { Check, Minus, X, Info } from "lucide-react";
import { byId, chapterScore, chapterJudgement, chapterLine } from "./chapterText.js";
import { NotesToggle } from "./StockChapters.jsx";

// A company's chapter as a tab on a computer, organised as questions (27 Oct
// 2026: "I want this to be organised and easy to understand"): the verdict;
// "In this tab", every question with its mark and short answer, which is the
// chapter's summary and its contents at once; one row per check the research
// model made (server/research.js) — the question, its mark and the model's
// own reason; then the detail, each panel under the question it answers.
// Every number is said once. The words are the model's; nothing here is a
// buy or sell call.

// A check's question, by the research model's item id; an item not listed
// asks its own label
const QUESTIONS = {
  returns: "Does it earn well on the money it uses?",
  marginStability: "Are its margins steady?",
  revenueConsistency: "Do its sales grow year after year?",
  reinvestment: "Does new money earn as well as the old?",
  competitive: "Does it have an edge over its rivals?",
  roa: "Does it earn well on its assets?",
  costToIncome: "Does it run lean?",
  cashConversion: "Is its profit real cash?",
  accruals: "Is profit running ahead of cash?",
  fcfConversion: "Does it keep cash after investing?",
  earningsConsistency: "Do its earnings hold up in bad years?",
  epsGrowth5y: "How fast have earnings a share grown over five years?",
  salesGrowth3y: "How fast are sales growing lately?",
  salesGrowth5y: "And over five years?",
  epsGrowth3y: "Are earnings a share growing?",
  forwardGrowth: "Is growth expected to continue?",
  marketSize: "Is there room to grow?",
  netDebt: "How much debt, against its cash?",
  interestCover: "Can it pay its interest?",
  currentRatio: "Can it pay what's due this year?",
  workingCapital: "How much cash is tied up in running it?",
  debtToEquity: "How much of it is paid for with debt?",
  grossNpa: "How many of its loans have gone bad?",
  netNpa: "After provisions, how much is bad?",
  provisionCover: "Has it set enough aside for bad loans?",
  cet1: "Does it hold enough capital?",
  creditCost: "What do bad loans cost it?",
  promoterStability: "Are the promoters holding on?",
  pledge: "Have the promoters pledged shares?",
  dilution: "Is it issuing new shares?",
  relatedParty: "Any dealings with related parties?",
  auditor: "Are its audits clean?",
  governanceFlags: "Anything worrying in its disclosures?",
  ownHistory: "Is the price below its fair value?",
  multiples: "Is it cheap on simple measures?",
  peers: "Is it cheap against similar companies?",
  fcfYield: "How much cash does it earn for its price?",
  dcf: "What does a cash-flow value say?",
  bookValue: "Is the price below its book-based value?",
  trend: "Is the trend up?",
  relativeStrength: "Is it beating the market?",
  momentum: "Is buying strong, or stretched?",
  volatility: "How hard can it fall?",
  liquidity: "Is it easy to buy and sell?",
};

// research.js's verdict word at the end of a reason; the mark says it
const VERDICT = /\s*—\s*(strong|fair|weak|poor)\.?$/i;
const say = t => String(t ?? "").replace(VERDICT, ".").trim();
const tone = s => (s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
const WORDS = { good: "Strong", mid: "Fair", bad: "Weak" };
const MARKS = { good: Check, mid: Minus, bad: X, info: Info };

// The checks this chapter's groups made, as question rows (a Price chapter:
// the technical parts)
export function chapterChecks(id, r) {
  if (!r) return [];
  const items = id === "price"
    ? (r.technical?.parts ?? []).map(p => ({ ...p, reason: p.reason }))
    : (byId[id]?.groups ?? []).map(gid => r.groups.find(g => g.id === gid)).filter(g => g?.applicable).flatMap(g => g.items ?? []);
  return items
    .filter(it => !it.hide && !it.na && it.score != null && it.reason)
    .map(it => ({ key: it.id, question: QUESTIONS[it.id] ?? `${it.label}?`, measure: it.label, tone: tone(it.score), score: it.score, answer: say(it.reason) }));
}

function Mark({ t, size = 13 }) {
  const I = MARKS[t];
  return <span className={`ct-mark ct-${t}`} aria-label={t === "info" ? undefined : WORDS[t]} aria-hidden={t === "info" ? "true" : undefined}><I size={size} strokeWidth={2.6} aria-hidden="true" /></span>;
}

// rows: the checks (chapterChecks); detail: [{ key, question, answer?,
// short?, body, after?: a check's key it answers, first?: true }] — a panel
// sits right under the question it answers; the rest open or close the tab
export default function ChapterTab({ id, m, fairValue, price, sec, tab, tour, lead, rows, detail = [], flags = [] }) {
  const c = byId[id];
  const s = chapterScore(id, m?.research);
  const judge = m ? chapterJudgement(id, m, { fairValue, price }) ?? chapterLine(id, m, { fairValue, price }) : null;
  const n = t => rows.filter(r => r.tone === t).length;
  const summary = rows.length
    ? [`${n("good")} of ${rows.length} ${rows.length === 1 ? "check is" : "checks are"} strong`, n("mid") && `${n("mid")} fair`, n("bad") && `${n("bad")} weak`].filter(Boolean).join(", ")
      + (flags.length ? `. ${flags.length === 1 ? "One red flag" : `${flags.length} red flags`} below.` : (id === "safety" || id === "owners") && m ? ". No red flags in its filings." : ".")
    : null;
  // one list: the checks in the model's order, each with the panel that
  // answers it; a panel whose check is missing (a bank has other checks)
  // goes to the end
  const keys = new Set(rows.map(r => r.key));
  const under = k => detail.filter(d => d.after === k);
  const blocks = [
    ...detail.filter(d => d.first).map(d => ({ ...d, info: true })),
    ...rows.flatMap(r => [{ ...r, body: under(r.key).map(d => <div key={d.key} className="ct-evidence">{d.body}</div>) }]),
    ...detail.filter(d => !d.first && !(d.after && keys.has(d.after))).map(d => ({ ...d, info: true })),
  ];
  return (
    <section id={sec ? `sec-${sec}` : undefined} className="ss-section ct" data-tab={tab ?? id} data-tour={tour} aria-labelledby={`ct-${id}`}>
      <header className="ct-card ct-verdict">
        <div className="ct-verdict-top">
          <div className="ct-verdict-text">
            <p className="ct-eyebrow" id={`ct-${id}`}>{c.label} · {c.question}</p>
            {judge && <h2 className="ct-judge">{judge}</h2>}
            {summary && <p className="ct-summary">{summary}</p>}
            {lead && <p className="ct-summary">{lead}</p>}
          </div>
          <div className="ct-verdict-side">
            {s && (
              <div className={`ct-score sd-tone-${s.tone}`}>
                <div><b>{Math.round(s.score)}</b> <span>{s.word}</span> <small>out of 100</small></div>
                <span className="ct-bar" aria-hidden="true"><i style={{ width: `${Math.max(3, Math.min(100, s.score))}%` }} /></span>
              </div>
            )}
            <NotesToggle />
          </div>
        </div>
        {flags.length > 0 && (
          <ul className="ct-flags">{flags.map(f => <li key={f.id} className={f.severity === "critical" ? "ct-bad" : "ct-mid"}><b>{f.severity === "critical" ? "Red flag." : "Caution."}</b> {f.text}</li>)}</ul>
        )}
      </header>

      <div className="ct-list">
        {blocks.map(b => (
          <article key={b.key} className="ct-q">
            <div className="ct-q-head">
              <div className="ct-q-left">
                <h3>{b.question}</h3>
                {!b.info && <span className={`ct-chip ct-${b.tone}`}><Mark t={b.tone} size={12} /> {WORDS[b.tone]}</span>}
              </div>
              <div className="ct-q-right">
                {(b.info ? b.answer ?? b.short : b.answer) && <p className="ct-row-a">{b.info ? b.answer ?? b.short : b.answer}</p>}
                {!b.info && <span className="ct-measure">Checked: {b.measure}</span>}
              </div>
            </div>
            {b.info ? <div className="ct-evidence">{b.body}</div> : b.body}
          </article>
        ))}
      </div>
    </section>
  );
}
