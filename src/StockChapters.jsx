import { Check, Minus, X, TriangleAlert, Eye, Info } from "lucide-react";
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

// What a chapter's score means, in plain words — for someone who doesn't
// know what a return on capital is (26 Oct 2026: "still not up to the mark")
const JUDGE = {
  business: { good: "Earns far more on its money than most companies", mid: "Earns middling returns on its money", bad: "Earns little on the money it uses" },
  growth: { good: "Growing faster than most companies", mid: "Growing, but slowly", bad: "Barely growing" },
  safety: { good: "Could get through bad years comfortably", mid: "Carries some debt worth watching", bad: "Debt could hurt it in bad years" },
  owners: { good: "Steady owners, nothing pledged, clean audits", mid: "A few ownership points to check", bad: "Ownership needs a close look" },
  value: { good: "Priced below what its earnings suggest", mid: "Priced about where its earnings suggest", bad: "Priced above what its earnings suggest" },
  price: { good: "The price is trending up", mid: "The price trend is mixed", bad: "The price is trending down" },
};
export function chapterJudgement(id, m) {
  const s = chapterScore(id, m?.research);
  if (!s || s.tone === "none") return null;
  if (id === "safety" && s.tone === "good" && num(m.netDebtCr) && m.netDebtCr <= 0) return "Has more cash than debt";
  if (id === "growth" && num(m.epsGrowth3y) && m.epsGrowth3y < 0 && s.tone !== "good") return "Its earnings have been shrinking";
  if (id === "owners" && s.tone === "good" && m.promoterPct === 0) return "No promoter group, clean audits";
  return JUDGE[id]?.[s.tone] ?? null;
}

// Two figures that back the answer, each against something: the sector's
// middle company, its own usual, or the index
const sector = (m, id) => m.sectorCompare?.find(x => x.id === id && num(x.value) && num(x.median));
const middle = v => `sector middle ${v}`;
export function chapterFigures(id, m, { fairValue, price } = {}) {
  if (!m) return [];
  const out = [];
  const vsSector = (sid, label, fmt) => { const x = sector(m, sid); if (x) out.push({ label, value: fmt(x.value), against: middle(fmt(x.median)) }); return !!x; };
  switch (id) {
    case "business":
      if (m.lender) { vsSector("roe", "Return on equity", p1); break; }
      vsSector("roce5y", "Return on capital", p1) || (num(m.roce5y) && out.push({ label: "Return on capital", value: p1(m.roce5y), against: "5-year average" }));
      vsSector("opm5y", "Operating margin", p1);
      break;
    case "growth":
      vsSector("salesGrowth5y", "Sales growth, 5 yrs", v => `${p1(v)} a yr`) || (num(m.salesGrowth3y) && out.push({ label: "Sales growth, 3 yrs", value: `${p1(m.salesGrowth3y)} a yr`, against: "" }));
      vsSector("epsGrowth5y", "EPS growth, 5 yrs", v => `${p1(v)} a yr`) || (num(m.epsGrowth3y) && out.push({ label: "EPS growth, 3 yrs", value: `${p1(m.epsGrowth3y)} a yr`, against: "" }));
      break;
    case "safety":
      if (m.lender) {
        if (m.bank?.gnpaPct != null) out.push({ label: "Bad loans", value: p1(m.bank.gnpaPct), against: "of its loans" });
        if (m.bank?.cet1Pct != null) out.push({ label: "Core capital", value: p1(m.bank.cet1Pct), against: "of risk-weighted loans" });
        break;
      }
      if (num(m.netDebtCr)) out.push({ label: m.netDebtCr <= 0 ? "Net cash" : "Net debt", value: `₹${Math.round(Math.abs(m.netDebtCr)).toLocaleString("en-IN")} Cr`, against: m.netDebtCr <= 0 ? "more cash than debt" : "debt less cash" });
      if (num(m.interestCoverage)) out.push({ label: "Interest cover", value: x1(m.interestCoverage), against: "profit over interest" });
      else vsSector("debtToEquity", "Debt to equity", v => `${Number(v).toFixed(2)}×`);
      break;
    case "owners": {
      if (num(m.promoterPct) && m.promoterPct > 0) {
        const old = (m.promoterHistory ?? []).at(-1);
        const ch = old && num(old.pct) ? m.promoterPct - old.pct : null;
        out.push({ label: "Promoters hold", value: p1(m.promoterPct), against: ch == null ? "" : Math.abs(ch) < 0.5 ? `same as ${new Date(old.asOfIso).getFullYear()}` : `${ch > 0 ? "up" : "down"} ${Math.abs(ch).toFixed(1)} pts since ${new Date(old.asOfIso).getFullYear()}` });
      }
      if (num(m.divYield) && m.divYield > 0) out.push({ label: "Dividend yield", value: p1(m.divYield), against: num(m.payoutPct) ? `pays out ${p1(m.payoutPct)} of profit` : "" });
      break;
    }
    case "value":
      if (num(fairValue) && num(price)) out.push({ label: "Fair value", value: fmtRs(fairValue), against: `price ${fmtRs(price)}` });
      if (num(m.pe) && num(m.medianPe)) out.push({ label: "P/E", value: `${Math.round(m.pe)}`, against: `its usual ${Math.round(m.medianPe)}` });
      else vsSector("peTtm", "P/E", v => `${Math.round(v)}`);
      break;
    case "price": {
      const nifty = m.benchmarks?.market?.returns?.y1;
      if (num(m.ret1y)) out.push({ label: "1 year", value: `${m.ret1y >= 0 ? "+" : "−"}${p1(Math.abs(m.ret1y))}`, against: num(nifty) ? `${m.benchmarks.market.name} ${nifty >= 0 ? "+" : "−"}${p1(Math.abs(nifty))}` : "" });
      const vol = m.volatilityPeers?.sector?.median;
      if (num(m.volatility1y)) out.push({ label: "Price swings", value: `${Math.round(m.volatility1y)}% a yr`, against: num(vol) ? middle(`${Math.round(vol)}%`) : "" });
      break;
    }
  }
  return out.slice(0, 2);
}

// The company in one sentence, from its chapters' scores — the gist before
// any figure (e.g. "A strong, cash-rich business growing slowly, priced
// below what its earnings suggest")
export function gistLine(m) {
  const r = m?.research;
  const t = id => chapterScore(id, r)?.tone;
  const biz = t("business"), grow = t("growth"), safe = t("safety"), val = t("value");
  if (!biz || biz === "none") return null;
  const quality = { good: "A strong", mid: "A middling", bad: "A weak" }[biz];
  const cash = safe === "good" && num(m.netDebtCr) && m.netDebtCr <= 0 ? ", cash-rich" : safe === "bad" ? ", indebted" : "";
  const who = m.sectorShare?.rank && m.sectorShare.rank <= 3 && m.sectorShare.companies >= 10 ? "leader" : "business";
  const growth = { good: " that's growing fast", mid: " that's growing slowly", bad: " that's barely growing" }[grow] ?? "";
  const price = { good: ", priced below what its earnings suggest", mid: ", priced about where its earnings suggest", bad: ", priced above what its earnings suggest" }[val] ?? "";
  return `${quality}${cash} ${who}${growth}${price}.`;
}

// The Summary's top: the gist, then a bar per chapter, each opening it
export function VerdictLines({ m, onGo }) {
  const r = m?.research;
  const rows = CHAPTERS.filter(c => !["overview", "news"].includes(c.id))
    .map(c => ({ c, s: chapterScore(c.id, r) }))
    .filter(x => x.s);
  const gist = gistLine(m);
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
  const judge = chapterJudgement(id, m);
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
