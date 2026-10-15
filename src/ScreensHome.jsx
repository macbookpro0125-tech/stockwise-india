import { ChevronRight } from "lucide-react";
import LiveScreen from "./LiveScreen.jsx";
import HowItWorks from "./HowItWorks.jsx";
import Reveal from "./Reveal.jsx";
import { useCountUp, useInView, useScrollScrub } from "./motion.js";

// Discover's first page, set like a product page (asked for 15 Oct 2026: "like
// the Apple website, wording and motion"): a centred headline over a large
// picture of the product working — one real strategy narrowing the market —
// that grows into place as you scroll; the figures in large type; three ways
// in; then the strategies (`children`). Every figure is the app's own:
// companies screened, filters, strategies and the price date.

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

// A large figure that counts up once it scrolls into view
function Figure({ value, label, delay }) {
  const [ref, inView] = useInView();
  const n = useCountUp(typeof value === "number" ? value : null, inView, 1200);
  return (
    <div ref={ref} className={`ap-figure ap-reveal${inView ? " in" : ""}`} style={{ "--d": delay }}>
      <span className="ap-figure-value">{typeof value === "number" ? n.toLocaleString("en-IN") : value ?? "—"}</span>
      <span className="ap-figure-label">{label}</span>
    </div>
  );
}

// The product shot grows from 90% to full size, and lifts, as it scrolls up
const growIn = (el, p) => {
  el.style.transform = `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`;
  el.style.opacity = String(0.35 + 0.65 * p);
};

// compact: a phone — the headline, its buttons, then the strategies
export default function ScreensHome({ meta, total, strategies, pricesDate, onStart, onCreate, onBrowseFilters, children, continueCard, compact = false }) {
  const filters = meta?.metrics?.length ?? null;
  const shotRef = useScrollScrub(growIn, 0.8);
  const scrollToStrategies = () => document.getElementById("popular-strategies")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  const hero = (
    <section className="ap-hero" aria-labelledby="ap-title">
      <Reveal as="p" className="ap-eyebrow">Stockwise Screener</Reveal>
      <Reveal as="h2" delay={1} id="ap-title" className="ap-title">Find the few worth owning.</Reveal>
      <Reveal as="p" delay={2} className="ap-sub">
        Every NSE company, scored on its own filings.{total ? <> Narrow {total.toLocaleString("en-IN")} down to the handful that fit.</> : null}
      </Reveal>
      <Reveal delay={3} className="ap-ctas">
        <button type="button" className="ap-btn" onClick={onStart}>Start screening</button>
        <HowItWorks plain label="See how it works" />
      </Reveal>
    </section>
  );

  if (compact) return (
    <div className="ap ap-compact">
      {hero}
      {continueCard}
      <section className="sh-section" aria-labelledby="sh-popular">
        <h2 id="sh-popular" className="ap-compact-head">Explore the strategies.</h2>
        {children}
      </section>
    </div>
  );

  return (
    <div className="ap">
      {hero}

      {/* The product, working: a real strategy narrowing the market */}
      <div className="ap-shot-wrap">
        <div ref={shotRef} className="ap-shot"><LiveScreen meta={meta} total={total} /></div>
      </div>

      <section className="ap-band" aria-labelledby="ap-band-title">
        <Reveal as="h2" id="ap-band-title" className="ap-h2">Built on the filings. <span>Not on the noise.</span></Reveal>
        <div className="ap-figures">
          <Figure value={total} label="NSE companies, each with a quality score" delay={0} />
          <Figure value={filters} label="filters, from return on capital to promoter pledges" delay={1} />
          <Figure value={strategies} label="ready-made strategies to start from" delay={2} />
          <Figure value={fmtDate(pricesDate)} label="latest closing prices, refreshed every trading evening" delay={3} />
        </div>
      </section>

      <section className="ap-tiles" aria-label="Ways to start">
        <Reveal as="button" type="button" className="ap-tile ap-tile-dark" onClick={scrollToStrategies}>
          <span className="ap-tile-eyebrow">Strategies</span>
          <span className="ap-tile-title">Start from a classic.</span>
          <span className="ap-tile-sub">Quality compounders, dividend payers, deep value. Ready to run.</span>
          <span className="ap-tile-link">Browse strategies<ChevronRight size={17} aria-hidden="true" /></span>
        </Reveal>
        <Reveal as="button" type="button" delay={1} className="ap-tile" onClick={onCreate}>
          <span className="ap-tile-eyebrow">Your screen</span>
          <span className="ap-tile-title">Or make your own.</span>
          <span className="ap-tile-sub">Begin with the whole market. Add only what matters to you.</span>
          <span className="ap-tile-link">Create new screen<ChevronRight size={17} aria-hidden="true" /></span>
        </Reveal>
        <Reveal as="button" type="button" delay={2} className="ap-tile" onClick={onBrowseFilters}>
          <span className="ap-tile-eyebrow">Filters</span>
          <span className="ap-tile-title">{filters ?? "Every"} ways to look.</span>
          <span className="ap-tile-sub">Growth, value, quality, ownership, momentum. All in one place.</span>
          <span className="ap-tile-link">See the filters<ChevronRight size={17} aria-hidden="true" /></span>
        </Reveal>
      </section>

      {continueCard}

      <section id="popular-strategies" className="sh-section" aria-labelledby="sh-popular">
        <div className="ap-section-head">
          <Reveal as="h2" id="sh-popular" className="ap-h2">Explore the strategies. <span>See what fits today.</span></Reveal>
        </div>
        {children}
      </section>
    </div>
  );
}
