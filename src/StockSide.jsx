import { Building2, BadgeCheck, Scale, ShieldCheck, TrendingUp, Tag, Activity, Flag, ChevronRight } from "lucide-react";
import CompanyLogo from "./CompanyLogo.jsx";
import { StarIcon } from "./icons.jsx";
import { fmtRs } from "../server/levels.js";
import { docTop } from "./motion.js";

// The stock page's left column (replica/recon.md): who the company is, its
// price and recent returns, Watch and Alert, then a scorecard — one line per
// research group, each opening that group's checks further down the page.
// Every word and number comes from the research model (server/research.js)
// and NSE's closes; nothing here is a buy or sell call.

const day = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Same bands as the research dashboard (ResearchBadges.jsx qualityTone)
const band = s => (s == null ? "none" : s >= 70 ? "good" : s >= 50 ? "mid" : "bad");
const WORD = { good: "Strong", mid: "Fair", bad: "Weak", none: "No data" };

// What each group's band says, in a line
const LINES = {
  business: { good: "Earns high returns on the capital it uses", mid: "Middling returns on its capital", bad: "Thin returns on its capital" },
  earnings: { good: "Reported profit is backed by cash", mid: "Profit only partly backed by cash", bad: "Cash flow trails reported profit" },
  balance: { good: "Light on debt, interest well covered", mid: "Some debt worth watching", bad: "Debt weighs on the balance sheet" },
  governance: { good: "Clean on pledges, audits and dilution", mid: "A few governance points to check", bad: "Governance needs a close look" },
  growth: { good: "Growing faster than most companies", mid: "Growing at a moderate pace", bad: "Growth has been slow" },
  valuation: { good: "Priced below its usual multiples", mid: "Priced near its usual multiples", bad: "Priced above its usual multiples" },
};
const ICONS = { business: Building2, earnings: BadgeCheck, balance: Scale, governance: ShieldCheck, growth: TrendingUp, valuation: Tag, technical: Activity, flags: Flag };

// Opens a <details> of the research dashboard and brings it under the pinned bar
function openCheck(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "DETAILS") el.open = true;
  const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
  const bar = document.querySelector("[data-sticky-top]")?.offsetHeight ?? 0;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: docTop(el) - header - bar - 12, behavior: reduced ? "auto" : "smooth" });
}

function Row({ id, label, tone, word, line, target }) {
  const Icon = ICONS[id];
  return (
    <li>
      <button type="button" className={`sd-score sd-tone-${tone}`} onClick={() => openCheck(target)}>
        <span className="sd-score-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span>
        <span className="sd-score-text">
          <span className="sd-score-head">{label}</span>
          <span className="sd-score-line">{line}</span>
        </span>
        <span className="sd-score-word">{word}</span>
        <ChevronRight size={16} className="sd-score-go" aria-hidden="true" />
      </button>
    </li>
  );
}

export function Scorecard({ r }) {
  if (!r) {
    return (
      <section className="sd-card" aria-label="Scorecard">
        <h2 className="sd-card-title">Scorecard</h2>
        <p className="sd-muted">No usable annual results on file, so there is nothing to score.</p>
      </section>
    );
  }
  const rows = r.groups.map(g => {
    if (!g.applicable) return { id: g.id, label: g.label, tone: "none", word: "n/a", line: "Doesn't apply to lenders", target: `why-${g.id}` };
    const b = band(g.score);
    const word = g.id === "valuation" && g.score != null ? r.valuation.label : WORD[b];
    return { id: g.id, label: g.label, tone: b, word, line: b === "none" ? "Not enough filings to score" : LINES[g.id]?.[b] ?? "", target: `why-${g.id}` };
  });
  const t = r.technical;
  rows.push({
    id: "technical", label: "Technical setup", target: "why-technical",
    tone: t.score == null ? "none" : t.score >= 65 ? "good" : t.score >= 40 ? "mid" : "bad",
    word: t.score == null ? "No data" : t.label,
    line: t.score == null ? "Not enough price history" : "The past year's trend in the price",
  });
  const flags = r.flags ?? [];
  rows.push({
    id: "flags", label: "Red flags", target: "sec-scores",
    tone: flags.some(f => f.severity === "critical") ? "bad" : flags.length ? "mid" : "good",
    word: flags.length ? String(flags.length) : "None",
    line: flags.length ? flags[0].text : "Nothing flagged in the filings",
  });
  return (
    <section className="sd-card" aria-label="Scorecard">
      <div className="sd-card-titlerow">
        <h3 className="sd-card-title">Scorecard</h3>
        {r.quality != null && <span className="sd-muted">Quality {Math.round(r.quality)}/100</span>}
      </div>
      <ul className="sd-scores">
        {rows.map(row => <Row key={row.id} {...row} />)}
      </ul>
      <p className="sd-foot">From NSE filings and closes. A summary of the research checks, not advice.</p>
    </section>
  );
}

export default function StockSide({ data, m, price, priceLabel, watched, onWatch, onAlert }) {
  const returns = m ? [["1W", m.ret1w], ["1M", m.ret1m], ["1Y", m.ret1y]].filter(([, v]) => v != null) : [];
  return (
    <aside className="sd-side" aria-label={`${data.name} summary`}>
      <section className="sd-card sd-id">
        <div className="sd-id-top">
          <CompanyLogo symbol={data.symbol} size={44} />
          <div className="sd-id-name">
            <h2>{data.name}</h2>
            <span>{data.symbol} · NSE{m?.sector ? ` · ${m.sector}` : ""}</span>
          </div>
        </div>
        {price > 0 && (
          <div className="sd-price">
            <strong>{fmtRs(price)}</strong>
            {priceLabel && <span>{priceLabel}</span>}
          </div>
        )}
        {returns.length > 0 && (
          <div className="sd-returns" aria-label={`Returns to the ${day(m.closeDate ?? m.cmpDate)} NSE close`}>
            {returns.map(([k, v]) => (
              <span key={k} className={v >= 0 ? "up" : "down"}><b>{v >= 0 ? "+" : "−"}{Math.abs(v).toFixed(1)}%</b><em>{k}</em></span>
            ))}
          </div>
        )}
        <div className="sd-actions" data-tour="stock-actions">
          <button type="button" className={`sd-action${watched ? " on" : ""}`} onClick={onWatch} aria-pressed={watched}>
            <StarIcon filled={watched} /> {watched ? "In watchlist" : "Add to watchlist"}
          </button>
          <button type="button" className="sd-action sd-action-link" onClick={onAlert}>Set an alert<ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </section>
      <div className="sd-side-scores"><Scorecard r={m?.research} /></div>
    </aside>
  );
}
