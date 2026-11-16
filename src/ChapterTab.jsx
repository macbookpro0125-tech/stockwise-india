import { Check, Minus, X, Info, Eye } from "lucide-react";
import { byId, chapterScore, chapterJudgement, chapterLine, chapterFigures, watchFor } from "./chapterText.js";
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

// two small panels side by side (half: true on both, next to each other; 16
// Nov 2026, from the owner's chosen mock-ups)
function pairUp(blocks) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const a = blocks[i], b = blocks[i + 1];
    if (a.info && a.half && b?.info && b.half) { out.push({ key: `${a.key}+${b.key}`, pair: [a, b] }); i++; }
    else out.push(a);
  }
  return out;
}

// Each panel under a plain heading in one box, as on the Overview and a phone
// (16 Nov 2026, the owner's chosen mock-up). The heading names what's in the
// box; the panel's own title inside is hidden (index.css .ct-box).
const TITLES = {
  about: "About the company", sector: "Against its sector", scores: "How the scores are worked out",
  results: "Sales, profit and margin", quarterly: "Quarterly results", pnl: "Profit and loss", balance: "Balance sheet",
  cash: "Cash flow", ratios: "Ratios", compare: "Compare with other companies", history: "What its history suggests",
  owns: "What it owns and owes", piotroski: "Piotroski score",
  who: "Who owns it", insiders: "Insider and promoter trades", dividends: "What it pays shareholders",
  ways: "Fair value, four ways", levels: "Your price levels", peers: "Against similar companies",
  yours: "Check or change the inputs", sizing: "How much, and when", figures: "More figures",
  done: "How the price has done", neighbours: "Its industry", technicals: "The trend in the price",
  changed: "What changed recently", call: "Earnings calls", nse: "News & filings", web: "Elsewhere on the web",
};
function EvidenceBlock({ b }) {
  const title = TITLES[b.key] ?? b.question;
  // a side note that only repeats the heading ("Piotroski score 6 of 9") is left off
  const note = b.answer ?? b.short;
  const showNote = note && !String(note).toLowerCase().startsWith(String(title).toLowerCase());
  return (
    <div className="ct-block">
      <div className="ct-block-h"><h3>{title}</h3>{showNote && <span>{note}</span>}</div>
      <div className="ct-evidence ct-box">{b.body}</div>
    </div>
  );
}

function Mark({ t, size = 13 }) {
  const I = MARKS[t];
  return <span className={`ct-mark ct-${t}`} role={t === "info" ? undefined : "img"} aria-label={t === "info" ? undefined : WORDS[t]} aria-hidden={t === "info" ? "true" : undefined}><I size={size} strokeWidth={2.6} aria-hidden="true" /></span>;
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
  // 16 Nov 2026 (the owner: "is its profit real cash · strong… should be
  // last of the page"): the evidence first, in its own order, and the checks
  // together at the end, each with its mark and the model's own answer
  const blocks = [
    ...detail.filter(d => d.first).map(d => ({ ...d, info: true })),
    ...detail.filter(d => !d.first).map(d => ({ ...d, info: true })),
    ...rows.map(r => ({ ...r, body: null })),
  ];
  const watch = m ? watchFor(id, m) : [];
  return (
    <section id={sec ? `sec-${sec}` : undefined} className="ss-section ct" data-tab={tab ?? id} data-tour={tour} aria-labelledby={`ct-${id}`}>
      <header className="ct-card ct-verdict">
        <div className="ct-verdict-top">
          <div className="ct-verdict-text">
            <p className="ct-eyebrow" id={`ct-${id}`}>{c.label} · {c.question}</p>
            {judge && <h2 className="ct-judge">{judge}</h2>}
            {summary && <p className="ct-summary">{summary}</p>}
            {lead && <p className="ct-summary">{lead}</p>}
            {m && chapterFigures(id, m, { fairValue, price }).length > 0 && (
              <div className="ct-figs">{chapterFigures(id, m, { fairValue, price }).map(f => <div key={f.label}><small>{f.label}</small><b>{f.value}</b>{f.against && <small>{f.against}</small>}</div>)}</div>
            )}
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
        {pairUp(blocks.filter(b => b.info && !b.fold)).map(b => b.pair ? (
          <div key={b.key} className="ct-pair">{b.pair.map(x => <EvidenceBlock key={x.key} b={x} />)}</div>
        ) : <EvidenceBlock key={b.key} b={b} />)}

        {/* rarely needed: a row that opens (16 Nov 2026, the chosen mock-up) */}
        {blocks.some(b => b.fold) && (
          <div className="ct-block">
            <div className="ct-block-h"><h3>More</h3></div>
            <div className="ct-folds">
              {blocks.filter(b => b.fold).map(b => (
                <details key={b.key} className="ct-fold">
                  <summary><span><b>{TITLES[b.key] ?? b.question}</b>{b.short && <small>{b.short}</small>}</span></summary>
                  <div className="ct-evidence">{b.body}</div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* the checks last, then what to watch (16 Nov 2026, the owner) */}
        {rows.length > 0 && (
          <div className="ct-block">
            <div className="ct-block-h"><h3>The checks</h3><span>{rows.filter(r => r.tone === "good").length} of {rows.length} strong</span></div>
            <ul className="ct-checks">
              {rows.map(r => (
                <li key={r.key} className={`sd-tone-${r.tone}`}>
                  <Mark t={r.tone} size={12} />
                  <div><b>{r.question}</b><span>{r.answer}</span><small>Checked: {r.measure}</small></div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {watch.length > 0 && (
          <div className="ct-block">
            <div className="ct-block-h"><h3>What to watch</h3></div>
            <ul className="ct-checks ct-watch">
              {watch.map(([label, text]) => <li key={label}><Eye size={16} aria-hidden="true" /><div><b>{label}</b><span>{text}</span></div></li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
