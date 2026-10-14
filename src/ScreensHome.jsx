import { ArrowRight, Plus, SlidersHorizontal, TrendingUp, ChevronDown } from "lucide-react";
import HowItWorks from "./HowItWorks.jsx";

// Discover's first page on a computer (asked for 15 Oct 2026, after a
// screener's home of screens): a hero with what the screener covers and a way
// in, three ways to start — the strategies, a screen of your own, the filter
// list — each with a small picture of itself, then the strategies as cards
// (`children`). Every figure here is the app's own: companies screened,
// strategies, filters and the price date; nothing is made up.

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// compact: a phone — the hero in short, then the strategies (no tiles)
export default function ScreensHome({ meta, total, strategies, pricesDate, onStart, onCreate, onBrowseFilters, children, continueCard, compact = false }) {
  const filters = meta?.metrics?.length ?? null;
  // Filters people reach for first, by their short names in the metric list
  const chips = ["roce", "roe", "pe", "debtToEquity", "salesGrowth3y", "profitGrowth3y", "promoterPct", "divYield", "marketCapCr", "opm", "piotroski", "vsFairValue", "fiiPct", "priceToBook", "ret1y", "rsi14"]
    .map(id => meta?.byId.get(id)?.short).filter(Boolean);
  const scrollToStrategies = () => document.getElementById("popular-strategies")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  if (compact) return (
    <div className="sh sh-compact">
      <section className="sh-hero" aria-labelledby="sh-title">
        <div className="sh-hero-grid" aria-hidden="true" />
        <h2 id="sh-title" className="sh-title">Find the right stocks with <span>Stockwise Screener</span></h2>
        <p className="sh-lead">{[total && `${total.toLocaleString("en-IN")} NSE companies`, strategies && `${strategies} strategies`, filters && `${filters} filters`].filter(Boolean).join(" · ")}</p>
        <div className="sh-cta">
          <button type="button" className="btn-primary sh-start" onClick={onStart}>Start screening <ArrowRight size={16} aria-hidden="true" /></button>
          <HowItWorks label="How it works" style={{ height: 42, padding: "0 14px", fontSize: 13.5 }} />
        </div>
      </section>
      {continueCard}
      <section className="sh-section" aria-labelledby="sh-popular">
        <h2 id="sh-popular" className="sh-compact-head">Popular strategies</h2>
        {children}
      </section>
    </div>
  );

  return (
    <div className="sh">
      <section className="sh-hero" aria-labelledby="sh-title">
        <div className="sh-hero-grid" aria-hidden="true" />
        <div className="sh-hero-inner">
          <span className="sh-eyebrow">NSE screener · refreshed every trading evening</span>
          <h2 id="sh-title" className="sh-title">Find the right stocks with <span>Stockwise Screener</span></h2>
          <p className="sh-lead">A quality score and a fair value for every NSE company, worked out from its own filings — and {filters ?? "over a hundred"} filters to narrow them down.</p>
          <div className="sh-cta">
            <button type="button" className="btn-primary sh-start" onClick={onStart}>Start screening <ArrowRight size={16} aria-hidden="true" /></button>
            <HowItWorks label="How it works" style={{ height: 46, padding: "0 18px", fontSize: 14 }} />
          </div>
          <dl className="sh-stats">
            {[
              [total ? total.toLocaleString("en-IN") : "—", "companies"],
              [strategies ?? "—", "strategies"],
              [filters ?? "—", "filters"],
              [fmtDate(pricesDate) ?? "—", "latest prices"],
            ].map(([v, l]) => (
              <div key={l}><dt>{l}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </div>

        {/* The screener as a funnel: the market, the filters, a shortlist */}
        <div className="sh-funnel" aria-hidden="true">
          <div className="sh-funnel-step s1"><b>{total ? total.toLocaleString("en-IN") : "—"}</b> NSE companies</div>
          <ChevronDown size={16} />
          <div className="sh-funnel-step s2"><b>{filters ?? "—"}</b> filters</div>
          <ChevronDown size={16} />
          <div className="sh-funnel-step s3">
            <span className="sh-funnel-label">Your shortlist</span>
            {[82, 64, 74].map((w, i) => <span key={i} className="sh-funnel-row"><i /><em style={{ width: `${w}%` }} /></span>)}
          </div>
        </div>
      </section>

      {/* Three ways in, over the hero's lower edge */}
      <div className="sh-tiles">
        <button type="button" className="sh-tile" onClick={scrollToStrategies}>
          <div className="sh-tile-art" aria-hidden="true">
            <div className="sh-mini sh-mini-back" />
            <div className="sh-mini">
              <div className="sh-mini-icon"><TrendingUp size={14} /></div>
              <div className="sh-mini-name">High Quality Compounders</div>
              <div className="sh-mini-rules">Sales 3Y ≥ 10% · ROE 5Y ≥ 18% <b>+6 more</b></div>
              <div className="sh-mini-note">Durable businesses with strong moats</div>
            </div>
            <span className="sh-badge">{strategies ?? ""} ready-made</span>
          </div>
          <span className="sh-tile-foot">Ready-made strategies <ArrowRight size={18} aria-hidden="true" /></span>
        </button>

        <button type="button" className="sh-tile sh-tile-hl" onClick={onCreate}>
          <div className="sh-tile-art" aria-hidden="true">
            <div className="sh-form">
              <div className="sh-form-head">Your filters</div>
              {[["Return on capital (ROCE)", "≥", "20", "%"], ["Debt to equity", "≤", "0.5", ""], ["Promoter holding", "≥", "40", "%"]].map(([n, op, v, u]) => (
                <div key={n} className="sh-form-row"><span>{n}</span><span className="sh-form-val">{op} <b>{v}</b>{u}</span></div>
              ))}
              <div className="sh-form-add"><Plus size={12} /> Add filter</div>
            </div>
          </div>
          <span className="sh-tile-foot">Create your own screen <ArrowRight size={18} aria-hidden="true" /></span>
        </button>

        <button type="button" className="sh-tile" onClick={onBrowseFilters}>
          <div className="sh-tile-art sh-chips" aria-hidden="true">
            {chips.map((c, i) => <span key={c} className={i === 0 || i === 3 ? "on" : ""}>{c}</span>)}
          </div>
          <span className="sh-tile-foot"><span>{filters ?? ""} filters <span className="sh-tile-sub">· growth, value, quality, ownership…</span></span> <SlidersHorizontal size={18} aria-hidden="true" /></span>
        </button>
      </div>

      {continueCard}

      <section id="popular-strategies" className="sh-section" aria-labelledby="sh-popular">
        <div className="sh-section-head">
          <div>
            <h2 id="sh-popular">Popular strategies</h2>
            <p>Screens for common investing styles. Open one, then change any of its filters.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onCreate} style={{ height: 38 }}><Plus size={15} aria-hidden="true" /> Create new screen</button>
        </div>
        {children}
      </section>
    </div>
  );
}
