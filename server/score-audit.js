// The nightly check of every company's scores (13 Nov 2026). The scores are
// rules applied to filed figures, so a wrong score is a wrong rule or wrong
// data; this lists the companies where something looks off, for a person
// (or the weekly review in Claude Code) to look at and fix the rule or the
// data — never to change one company's score by hand. Acme Solar's valuation
// of 8 (a fast grower building plants, judged as if it were neither) is the
// kind of thing it is for.
//
// One file a trading day in data/score-audit/<pricesDate>.json: the flags,
// and every company's scores, so the next night can see what moved.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./paths.js";
import { RESEARCH_VERSION } from "./research.js";

export const AUDIT_DIR = join(DATA_DIR, "score-audit");
const KEEP = 21; // about a month of trading days

const r1 = v => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const fin = v => typeof v === "number" && Number.isFinite(v);
const itemOf = (r, groupId, itemId) => r?.groups?.find(g => g.id === groupId)?.items.find(i => i.id === itemId) ?? null;

// Each check: [id, severity 1–3, test(m, r, prev) → detail string or null]
const CHECKS = [
  // A big move in a day without new results: a price can move valuation, but
  // 15 points of the overall score from one day's price is a lot
  ["jump", 3, (m, r, prev) => {
    if (!prev || prev.quarter !== (m.latestQuarter ?? null) || prev.fyEnd !== (m.fyEnd ?? null)) return null;
    const dO = fin(prev.overall) && fin(r.overall?.score) ? r.overall.score - prev.overall : null;
    const dQ = fin(prev.quality) && fin(r.quality) ? r.quality - prev.quality : null;
    const big = [dO, dQ].filter(d => d != null && Math.abs(d) >= 15);
    if (!big.length) return null;
    return `Overall ${prev.overall ?? "—"} → ${r1(r.overall?.score) ?? "—"}, quality ${prev.quality ?? "—"} → ${r1(r.quality) ?? "—"} with no new results (close ${prev.close ?? "—"} → ${m.close ?? "—"})`;
  }],
  // A fast grower marked as almost as dear as it gets
  ["growerMarkedDear", 2, (m, r) => {
    // not when the P/E is beyond any growth's reach (2.5× its sector or more)
    const v = r.valuation?.score, g = fin(m.epsGrowth3y) ? m.epsGrowth3y : m.ttmEpsGrowth;
    const ratio = itemOf(r, "valuation", "peers")?.value;
    return fin(v) && v <= 10 && fin(g) && g >= 30 && fin(ratio) && ratio < 2.5 ? `Valuation ${r1(v)} while EPS grew ${r1(g)}% a year, at ${r1(ratio)}× its sector's P/E` : null;
  }],
  // Very cheap against its sector and rated highly: a value trap, or a figure wrong
  ["tooCheap", 2, (m, r) => {
    const ratio = itemOf(r, "valuation", "peers")?.value;
    return fin(ratio) && ratio < 0.35 && r.overall?.score >= 70 ? `P/E is ${r1(ratio * 100)}% of its sector's, with an overall of ${r1(r.overall.score)}: check the EPS and share count` : null;
  }],
  // A high score resting on little data
  ["thinData", 2, (m, r) => (r.overall?.score >= 70 && fin(r.confidence) && r.confidence < 60 ? `Overall ${r1(r.overall.score)} with data confidence ${r1(r.confidence)}` : null)],
  // Results overdue and still scored high
  ["stale", 1, (m, r) => (r.flags?.some(f => f.id === "annualStale") && r.overall?.score >= 60 ? `Latest annual results ${m.fyEnd}; overall ${r1(r.overall.score)}` : null)],
  // Figures that disagree with each other or can hardly be true
  // already shown on the page as a caution (metrics.js epsMismatch): low
  ["epsMismatch", 1, m => (m.epsMismatch ? `Filed EPS ₹${r1(m.epsMismatch.reportedEps)} against ₹${r1(m.epsMismatch.correctedEps)} from profit ÷ shares` : null)],
  ["oddPe", 3, m => (!m.ttmOneOff && fin(m.peTtm ?? m.peFy) && (m.peTtm ?? m.peFy) > 0 && (m.peTtm ?? m.peFy) < 2 ? `P/E ${r1(m.peTtm ?? m.peFy)}: profit or share count likely wrong` : null)],
  ["oddRoe", 2, m => (!m.lender && fin(m.roe) && m.roe > 100 ? `ROE ${r1(m.roe)}%` : null)],
  ["oddMargin", 1, m => (!m.lender && !m.utility && fin(m.opm) && m.opm > 90 ? `Operating margin ${r1(m.opm)}%` : null)],
  // mostly real, uneven business (13 Nov review: a licensing deal, housing
  // sales booked unevenly, a business sold); kept low for a real unit slip
  ["oddGrowth", 1, m => (fin(m.ttmSalesGrowth) && (m.ttmSalesGrowth > 500 || m.ttmSalesGrowth < -90) ? `Sales over the last four quarters ${m.ttmSalesGrowth > 0 ? "up" : "down"} ${r1(Math.abs(m.ttmSalesGrowth))}%: a unit slip?` : null)],
  ["oddPriceToSales", 1, m => (!m.lender && fin(m.priceToSales) && m.priceToSales > 100 ? `Price ${r1(m.priceToSales)}× sales` : null)],
];
export const CHECK_IDS = CHECKS.map(([id]) => id);

// rows: the market's metrics (screen.js allMetrics().rows); prev: the last
// audit's scores ({ SYMBOL: {...} }) or null
export function auditScores(rows, prev = null, { pricesDate = null, now = new Date() } = {}) {
  const flags = [], scores = {};
  for (const m of rows) {
    const r = m.research;
    if (!r) continue;
    scores[m.symbol] = { overall: r1(r.overall?.score), quality: r1(r.quality), valuation: r1(r.valuation?.score), close: m.close ?? null, quarter: m.latestQuarter ?? null, fyEnd: m.fyEnd ?? null };
    for (const [id, severity, test] of CHECKS) {
      const detail = test(m, r, prev?.[m.symbol] ?? null);
      if (detail) flags.push({ symbol: m.symbol, name: m.name ?? m.symbol, check: id, severity, detail, overall: r1(r.overall?.score), marketCapCr: m.marketCapCr != null ? Math.round(m.marketCapCr) : null });
    }
  }
  // Most serious first, then the larger company (more people look at it)
  flags.sort((a, b) => b.severity - a.severity || (b.marketCapCr ?? 0) - (a.marketCapCr ?? 0));
  const byCheck = Object.fromEntries(CHECK_IDS.map(id => [id, flags.filter(f => f.check === id).length]));
  return { date: now.toISOString(), pricesDate, scoreVersion: RESEARCH_VERSION, companies: Object.keys(scores).length, flagged: new Set(flags.map(f => f.symbol)).size, byCheck, flags, scores };
}

const files = () => (existsSync(AUDIT_DIR) ? readdirSync(AUDIT_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : []);
export const hasAudit = pricesDate => files().includes(`${pricesDate}.json`);

export function loadAudit(pricesDate = null) {
  const list = files();
  const file = pricesDate ? `${pricesDate}.json` : list.at(-1);
  if (!file || !list.includes(file)) return null;
  try { return JSON.parse(readFileSync(join(AUDIT_DIR, file), "utf-8")); } catch { return null; }
}

// The night's audit, saved beside the last few; the day before's scores are
// what "moved in a day" is measured against
export function saveAudit(rows, pricesDate) {
  const before = files().filter(f => f < `${pricesDate}.json`).at(-1);
  const prev = before ? loadAudit(before.slice(0, -5))?.scores ?? null : null;
  const audit = auditScores(rows, prev, { pricesDate });
  mkdirSync(AUDIT_DIR, { recursive: true });
  writeFileSync(join(AUDIT_DIR, `${pricesDate}.json`), JSON.stringify(audit));
  for (const old of files().slice(0, -KEEP)) unlinkSync(join(AUDIT_DIR, old));
  return audit;
}

// What the owner's page and the weekly review read: the flags without the
// whole market's scores
export const auditSummary = a => (a ? { ...a, scores: undefined, days: files().map(f => f.slice(0, -5)) } : null);
