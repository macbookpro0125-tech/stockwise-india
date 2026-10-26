// What a company page's chapters say (StockChapters.jsx draws them): each
// chapter's score from the research model (server/research.js), its answer
// in plain words, two figures that back it, the company in one sentence, and
// what to watch. Plain functions of the stock's figures, so every company's
// wording can be checked (chapterText.test.js).
import { fmtRs } from "../server/levels.js";

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
export const byId = Object.fromEntries(CHAPTERS.map(c => [c.id, c]));

// The scorecard's bands and words (StockSide.jsx)
export const band = s => (s == null ? "none" : s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
export const WORD = { good: "Strong", mid: "Fair", bad: "Weak", none: "No data" };
export const num = v => v != null && Number.isFinite(Number(v));
const p1 = v => { const x = Math.abs(v) < 0.05 ? 0 : v; return `${Math.abs(x) >= 10 ? Math.round(x) : Number(x).toFixed(1)}%`; };
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
    case "news": {
      // its calendar: results filed or due, and the next corporate action
      const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
      const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
      const parts = [];
      if (m.nextResults && m.nextResults >= today) parts.push(`Results due ${day(m.nextResults)}`);
      else if (m.latestQuarterFiled) parts.push(`Latest results filed ${day(m.latestQuarterFiled)}`);
      const next = (m.events ?? []).filter(e => e?.date >= today && e.kind === "action").sort((a, b) => a.date.localeCompare(b.date))[0];
      if (next) parts.push(`${/dividend/i.test(next.title ?? "") ? "Ex-dividend" : next.title?.split(" - ")[0] ?? "Corporate action"} ${day(next.date)}`);
      return parts.length ? parts.join(" · ") : null;
    }
    case "price":
      if (!num(m.ret1y)) return null;
      return `${m.ret1y >= 0 ? "Up" : "Down"} ${p1(Math.abs(m.ret1y))} in a year${num(m.vsSma200) ? `, ${m.vsSma200 >= 0 ? "above" : "below"} its 200-day average` : ""}`;
    default:
      return null;
  }
}

// What a chapter's score means, in plain words — for someone who doesn't
// know what a return on capital is (26 Oct 2026: "still not up to the mark").
// A score blends several checks, so the words follow the figures shown under
// them where those point another way: a sweep of every company (26 Oct 2026)
// found "nothing pledged" over pledged shares, "growing" over falling EPS,
// "priced above its earnings" over a fair value above the price
const JUDGE = {
  business: { good: "Earns high returns on the money it uses", mid: "Earns middling returns on its money", bad: "Earns little on the money it uses" },
  growth: { good: "Growing faster than most companies", mid: "Growing, but slowly", bad: "Barely growing" },
  safety: { good: "Could get through bad years comfortably", mid: "Carries some debt worth watching", bad: "Debt could hurt it in bad years" },
  owners: { good: "Steady owners, nothing pledged", mid: "A few ownership points to check", bad: "Ownership needs a close look" },
  value: { good: "Priced below what its earnings suggest", mid: "Priced about where its earnings suggest", bad: "Priced above what its earnings suggest" },
  price: { good: "The price is trending up", mid: "The price trend is mixed", bad: "The price is trending down" },
};
const latestProfit = m => (num(m.ttmProfitCr) ? m.ttmProfitCr : num(m.profitCr) ? m.profitCr : null);
// Growth's figures, recent first: 3 years, with 5 years beside it for the
// longer view; then 5 years against the sector; then the last 4 quarters. The
// sentence, the gist and the figures all read the same pick
function growthPick(m) {
  const rate = v => (Math.abs(v) < 0.5 ? "flat" : `${p1(v)} a yr`);
  const one = (y3, y5, ttm, sid, what) => {
    const sec = m.sectorCompare?.find(x => x.id === sid && num(x.value) && num(x.median));
    if (num(y3)) return { v: y3, label: `${what} growth, 3 yrs`, value: rate(y3), against: num(y5) ? `5 yrs: ${rate(y5)}` : "" };
    if (sec) return { v: sec.value, label: `${what} growth, 5 yrs`, value: `${p1(sec.value)} a yr`, against: `sector middle ${p1(sec.median)} a yr` };
    if (num(y5)) return { v: y5, label: `${what} growth, 5 yrs`, value: `${p1(y5)} a yr`, against: "" };
    if (num(ttm)) return { v: ttm, label: `${what} growth`, value: Math.abs(ttm) < 0.5 ? "flat" : p1(ttm), against: "last 4 quarters" };
    return null;
  };
  return {
    sales: one(m.salesGrowth3y, m.salesGrowth5y, m.ttmSalesGrowth, "salesGrowth5y", "Sales"),
    eps: one(m.epsGrowth3y, m.epsGrowth5y, m.ttmEpsGrowth, "epsGrowth5y", "EPS") ?? one(m.profitGrowth3y, m.profitGrowth5y, null, "", "Profit"),
  };
}
// a change under half a percent a year is no change
const flat = v => (v != null && Math.abs(v) < 0.5 ? 0 : v);
const growthOf = m => { const g = growthPick(m); return { eps: flat(g.eps?.v ?? null), sales: flat(g.sales?.v ?? null) }; };
// how fast, from the slower of the two
function growthPace(m) {
  const { eps, sales } = growthOf(m);
  const vals = [eps, sales].filter(v => v != null);
  if (!vals.length || vals.some(v => v < 0)) return null;
  const slow = Math.min(...vals), quick = Math.max(...vals);
  if (eps != null && sales != null && quick >= 15 && slow < 8) return sales > eps ? "sales-fast" : "eps-fast";
  return slow >= 15 ? "fast" : slow >= 8 ? "steadily" : "slowly";
}
// the promoters' stake since the oldest quarter on file, in points
function promoterMove(m) {
  const old = (m.promoterHistory ?? []).at(-1);
  if (!num(m.promoterPct) || !old || !num(old.pct)) return null;
  return { pts: Math.round((m.promoterPct - old.pct) * 10) / 10, year: new Date(old.asOfIso).getFullYear() };
}
// sales and EPS heading different ways, or both down: said as it is
function growthMix(m) {
  const { eps, sales } = growthOf(m);
  if (eps == null && sales == null) return null;
  if (eps == null) return sales < 0 ? "sales-only" : null;
  if (sales == null) return eps < 0 ? "eps-only" : null;
  if (sales < 0 && eps < 0) return "both";
  if (sales >= 0 && eps < 0) return "eps";
  if (sales < 0 && eps >= 0) return "sales";
  return null;
}
// Value: its own fair value against the price, when the page has one
const fvGap = ({ fairValue, price } = {}) => (num(fairValue) && num(price) && price > 0 ? fairValue / price - 1 : null);
function valueMix(tone, opts) {
  const g = fvGap(opts);
  if (g == null) return null;
  if (tone === "good" && g < 0) return "peers-cheap";
  if (tone === "bad" && g > 0) return "peers-dear";
  return null;
}
const auditClean = r => (r?.groups.find(g => g.id === "governance")?.items ?? []).find(i => i.id === "auditor")?.score >= 70;

export function chapterJudgement(id, m, opts = {}) {
  const r = m?.research;
  const s = chapterScore(id, r);
  if (!s || s.tone === "none") return null;
  const t = s.tone;
  switch (id) {
    case "business": {
      const p = latestProfit(m);
      if (p != null && p < 0) return t === "good" ? "Earned well for years, but made a loss lately" : "Made a loss lately";
      const shown = chapterFigures("business", m).find(f => /^Return on/.test(f.label));
      const ret = shown?.v;
      const vs = sector(m, m.lender || /equity/.test(shown?.label ?? "") ? "roe" : "roce5y");
      if (!num(ret)) {
        const opm = sector(m, "opm5y");
        if (opm) return opm.value >= opm.median ? "Keeps a wider margin on its sales than most" : "Keeps a thinner margin on its sales than most";
        return null;
      }
      const [hi, mid, low] = m.lender ? [18, 12, 8] : [25, 15, 8];
      if (ret >= hi && (vs?.beats ?? 1) >= 0.75) return "Earns far more on its money than most companies";
      if (ret >= mid) return "Earns good returns on its money";
      if (ret >= low) return "Earns modest returns on its money";
      return "Earns little on the money it uses";
    }
    case "growth": {
      const mix = growthMix(m);
      if (mix === "both") return "Sales and earnings are both shrinking";
      if (mix === "eps") return "Sales are growing, but earnings per share are falling";
      if (mix === "sales") return "Earnings are up, but sales are shrinking";
      if (mix === "sales-only") return "Sales have been shrinking";
      if (mix === "eps-only") return "Earnings have been shrinking";
      const pace = growthPace(m);
      if (pace === "fast") return "Growing fast";
      if (pace === "steadily") return "Growing steadily";
      if (pace === "slowly") return "Growing, but slowly";
      if (pace === "sales-fast") return "Sales growing fast, earnings slowly";
      if (pace === "eps-fast") return "Earnings growing fast, sales slowly";
      return JUDGE.growth[t];
    }
    case "safety":
      if (t === "good" && num(m.netDebtCr) && m.netDebtCr <= 0) return "Has more cash than debt";
      return JUDGE.safety[t];
    case "owners": {
      if (m.promoterPct === 0) return `No promoter group${t === "good" && auditClean(r) ? ", clean audits" : ""}`;
      const pledged = num(m.pledgedPct) && m.pledgedPct >= 0.5;
      const move = promoterMove(m);
      const fell = move && move.pts <= -10 ? `The promoters' stake has fallen sharply since ${move.year}` : move && move.pts <= -3 ? `The promoters' stake has been falling since ${move.year}` : null;
      if (fell) return pledged ? `${fell}, and some of it is pledged` : fell;
      if (pledged) return t === "good" ? "Steady owners, though some of their shares are pledged" : "Some promoter shares are pledged: worth a close look";
      if (t === "good" && num(m.pledgedPct) && m.pledgedPct > 0) return "Steady owners, hardly any shares pledged";
      if (t === "good") return `Steady owners, nothing pledged${auditClean(r) ? ", clean audits" : ""}`;
      return JUDGE.owners[t];
    }
    case "value": {
      const mix = valueMix(t, opts);
      if (mix === "peers-cheap") return "Cheap against its peers, though above its own fair value";
      if (mix === "peers-dear") return "Under its own fair value, but dear against its peers";
      const g = fvGap(opts);
      if (t === "mid" && g != null && g < -0.15) return "Priced above its own fair value";
      if (t === "mid" && g != null && g > 0.15) return "Priced below its own fair value";
      return JUDGE.value[t];
    }
    case "price":
      if (t === "bad" && num(m.ret1y) && m.ret1y > 20) return "Up over the year, but turning down lately";
      if (t === "good" && num(m.ret1y) && m.ret1y < -20) return "Down over the year, but turning up lately";
      return JUDGE.price[t];
    default:
      return null;
  }
}

// Two figures that back the answer, each against something: the sector's
// middle company, its own usual, or the index — and, without those, the
// figure on its own rather than none (a new listing has no 5-year average)
const sector = (m, id) => m.sectorCompare?.find(x => x.id === id && num(x.value) && num(x.median));
const middle = v => `sector middle ${v}`;
const yr = v => `${p1(v)} a yr`;
export function chapterFigures(id, m, { fairValue, price } = {}) {
  if (!m) return [];
  const out = [];
  const vsSector = (sid, label, fmt) => { const x = sector(m, sid); if (x) out.push({ label, value: fmt(x.value), against: middle(fmt(x.median)), v: x.value }); return !!x; };
  const plain = (v, label, fmt, against = "") => { if (!num(v)) return false; out.push({ label, value: fmt(v), against, v }); return true; };
  switch (id) {
    case "business":
      if (m.lender) { vsSector("roe", "Return on equity", p1) || plain(m.roeAvg, "Return on equity", p1, "average") || plain(m.roe, "Return on equity", p1, "latest year"); break; }
      vsSector("roce5y", "Return on capital", p1) || plain(m.roce5y, "Return on capital", p1, "5-year average") || vsSector("roe", "Return on equity", p1) || plain(m.roce, "Return on capital", p1, "latest year");
      vsSector("opm5y", "Operating margin", p1) || plain(m.opm5y, "Operating margin", p1, "5-year average") || plain(m.opm, "Operating margin", p1, "latest year");
      break;
    case "growth": {
      const g = growthPick(m);
      for (const f of [g.sales, g.eps]) if (f) out.push({ label: f.label, value: f.value, against: f.against });
      break;
    }
    case "safety":
      if (m.lender) {
        if (m.bank?.gnpaPct != null) out.push({ label: "Bad loans", value: p1(m.bank.gnpaPct), against: "of its loans" });
        if (m.bank?.cet1Pct != null) out.push({ label: "Core capital", value: p1(m.bank.cet1Pct), against: "of risk-weighted loans" });
        break;
      }
      if (num(m.netDebtCr)) out.push({ label: m.netDebtCr <= 0 ? "Net cash" : "Net debt", value: `₹${Math.round(Math.abs(m.netDebtCr)).toLocaleString("en-IN")} Cr`, against: m.netDebtCr <= 0 ? "more cash than debt" : "debt less cash" });
      plain(m.interestCoverage, "Interest cover", x1, "profit over interest") || vsSector("debtToEquity", "Debt to equity", v => `${Number(v).toFixed(2)}×`) || plain(m.debtToEquity, "Debt to equity", v => `${Number(v).toFixed(2)}×`) || plain(m.currentRatio, "Current ratio", x1, "short-term assets over dues");
      break;
    case "owners": {
      if (num(m.promoterPct) && m.promoterPct > 0) {
        const move = promoterMove(m);
        const pledged = num(m.pledgedPct) && m.pledgedPct >= 0.5 ? `${p1(m.pledgedPct)} of it pledged` : null;
        out.push({ label: "Promoters hold", value: p1(m.promoterPct), against: pledged ?? (move == null ? "" : Math.abs(move.pts) < 0.5 ? `same as ${move.year}` : `${move.pts > 0 ? "up" : "down"} ${Math.abs(move.pts).toFixed(1)} pts since ${move.year}`) });
      } else if (num(m.fiiPct) || num(m.diiPct)) {
        out.push({ label: "Institutions hold", value: p1((m.fiiPct ?? 0) + (m.diiPct ?? 0)), against: "foreign and Indian funds" });
      }
      if (num(m.divYield) && m.divYield > 0) out.push({ label: "Dividend yield", value: p1(m.divYield), against: num(m.payoutPct) ? `pays out ${p1(m.payoutPct)} of profit` : "" });
      else plain(m.divYield, "Dividend yield", p1, "pays no dividend");
      break;
    }
    case "value":
      if (num(fairValue) && num(price)) out.push({ label: "Fair value", value: fmtRs(fairValue), against: `price ${fmtRs(price)}` });
      if (num(m.pe) && m.pe > 0 && num(m.medianPe)) out.push({ label: "P/E", value: `${Math.round(m.pe)}`, against: `its usual ${Math.round(m.medianPe)}` });
      else vsSector("peTtm", "P/E", v => `${Math.round(v)}`) || (num(m.pe) && m.pe > 0 && plain(m.pe, "P/E", v => `${Math.round(v)}`, "price over a year's earnings"));
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

// The company in one sentence, from its chapters — the gist before any
// figure ("A strong, cash-rich leader that's growing slowly, priced below
// what its earnings suggest"); each part agrees with its chapter's answer
export function gistLine(m, opts = {}) {
  const r = m?.research;
  const t = id => chapterScore(id, r)?.tone;
  const biz = t("business"), grow = t("growth"), safe = t("safety"), val = t("value");
  if (!biz || biz === "none") return null;
  const quality = { good: "A strong", mid: "A middling", bad: "A weak" }[biz];
  const cash = safe === "good" && num(m.netDebtCr) && m.netDebtCr <= 0 ? ", cash-rich" : safe === "bad" ? ", indebted" : "";
  const who = m.sectorShare?.rank && m.sectorShare.rank <= 3 && m.sectorShare.companies >= 10 ? "leader" : "business";
  const p = latestProfit(m);
  const mix = growthMix(m);
  const growth = p != null && p < 0 ? " that made a loss lately"
    : mix === "both" ? " that's shrinking"
    : mix === "eps" ? " with sales up but earnings down"
    : mix === "sales" ? " with earnings up but sales down"
    : mix === "sales-only" ? " with shrinking sales"
    : mix === "eps-only" ? " with shrinking earnings"
    : { fast: " that's growing fast", steadily: " that's growing steadily", slowly: " that's growing slowly", "sales-fast": " with sales growing fast, earnings slowly", "eps-fast": " with earnings growing fast, sales slowly" }[growthPace(m)]
    ?? { good: " that's growing fast", mid: " that's growing slowly", bad: " that's barely growing" }[grow] ?? "";
  const vmix = valueMix(val, opts);
  const g = fvGap(opts);
  const price = vmix === "peers-cheap" ? ", cheap against its peers" : vmix === "peers-dear" ? ", dear against its peers"
    : val === "mid" && g != null && g < -0.15 ? ", priced above its own fair value"
    : val === "mid" && g != null && g > 0.15 ? ", priced below its own fair value"
    : { good: ", priced below what its earnings suggest", mid: ", priced about where its earnings suggest", bad: ", priced above what its earnings suggest" }[val] ?? "";
  return `${quality}${cash} ${who}${growth}${price}.`;
}

// What to take to the next results, by chapter (ThesisMonitor.jsx's
// questions, each now where its figures are)
export function watchFor(id, m) {
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

