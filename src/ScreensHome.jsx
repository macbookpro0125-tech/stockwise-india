import { ChevronRight, Plus } from "lucide-react";
import LiveScreen from "./LiveScreen.jsx";
import HowItWorks from "./HowItWorks.jsx";
import Reveal from "./Reveal.jsx";
import { useScrollScrub } from "./motion.js";
import CurvedRow from "./CurvedRow.jsx";
import StrategyMark, { markColor } from "./StrategyMarks.jsx";
import "./curved-row.css";

// Discover's first page, set like a product page (asked for 15 Oct 2026: "like
// the Apple website, wording and motion"): a centred headline over a large
// picture of the product working — one real strategy narrowing the market —
// that grows into place as you scroll; three ways in; then the strategies.

// A strategy on the curved row through the hero: its mark, name and line,
// in its own colour (no figures)
const RibbonCard = ({ p }) => (
  <div className="rb-card" style={{ "--hue": markColor(p.id) ?? "#00E0BE" }}>
    <StrategyMark preset={p} size={40} />
    <b>{p.name}</b>
    <span>{p.description}</span>
  </div>
);

// The product shot grows from 90% to full size, and lifts, as it scrolls up
const growIn = (el, p) => {
  el.style.transform = `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`;
  el.style.opacity = String(0.35 + 0.65 * p);
};

// compact: a phone — the headline, its buttons, then the strategies
// ribbon: the strategies for the curved row through the hero (16 Oct 2026,
// "Scroll Tilted Grid"); onPickStrategy opens one, as its card in the grid does
export default function ScreensHome({ meta, total, onStart, onCreate, newsTile = null, children, continueCard, newsCard = null, compact = false, ribbon = [], onPickStrategy }) {
  const shotRef = useScrollScrub(growIn, 0.8);
  const scrollToStrategies = () => document.getElementById("popular-strategies")?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  const title = <>
    <Reveal as="p" className="ap-eyebrow">Indian stock market research</Reveal>
    <Reveal as="h2" delay={1} id="ap-title" className="ap-title">Find the few worth owning.</Reveal>
  </>;
  const rest = <>
    <Reveal as="p" delay={2} className="ap-sub">
      Every NSE company, scored on its own filings. Narrow the market down to the handful that fit.
    </Reveal>
    <Reveal delay={3} className="ap-ctas">
      <button type="button" className="ap-btn" onClick={onStart}>Start screening</button>
      <HowItWorks plain label="See how it works" />
    </Reveal>
  </>;
  // The strategies curve past between the title and the buttons; hovering
  // pauses them, a click opens one. The grid below stays the way to choose
  // by keyboard (the row is decorative to screen readers).
  const hero = compact ? null : ribbon.length ? (
    <CurvedRow items={ribbon} render={p => <RibbonCard p={p} />} onPick={onPickStrategy} className="ap-ribbon"
      tileHeight={compact ? 24 : 25} aspectRatio={16 / 10} axis={52} curve={compact ? 46 : 76} speed={4.5}>
      <section className="ap-hero ap-hero-ribbon" aria-labelledby="ap-title">
        <div className="ap-hero-top">{title}</div>
        <div className="ap-hero-bottom">{rest}</div>
      </section>
    </CurvedRow>
  ) : (
    <section className="ap-hero" aria-labelledby="ap-title">{title}{rest}</section>
  );

  // A phone (17 Oct 2026, the app on a phone as clean as a native one): no
  // hero — a large title, one line, then the strategies; a new screen from
  // the + beside the title or the card at the end
  if (compact) return (
    <div className="ph-home">
      <div className="ph-title-row">
        <h2 className="phone-title" id="sh-popular">Strategies</h2>
        <button type="button" className="ph-round" onClick={onCreate} aria-label="New screen: start from the whole market"><Plus size={22} aria-hidden="true" /></button>
      </div>
      <p className="ph-lede">Each strategy is a ready-made screen. Pick one to see which companies fit it today.</p>
      {/* The market's news near the top, three items and See all (22 Oct 2026) */}
      {newsCard}
      {children}
      {/* The screen you set yourself, at the end with "Build your own" (20 Oct 2026) */}
      {continueCard}
      <button type="button" className="ph-build" onClick={onCreate}>
        <span>
          <span className="ph-build-title">Build your own</span>
          <span className="ph-build-sub">Start from the whole market and add only the filters you want.</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div className="ap">
      {hero}

      {/* The product, working: a real strategy narrowing the market */}
      <div className="ap-shot-wrap">
        <div ref={shotRef} className="ap-shot"><LiveScreen meta={meta} total={total} /></div>
      </div>

      <section className="ap-tiles" aria-label="Ways to start">
        <Reveal as="button" type="button" className={`ap-tile${newsTile ? "" : " ap-tile-dark"} glow`} onClick={scrollToStrategies}>
          <span className="ap-tile-eyebrow">Strategies</span>
          <span className="ap-tile-title">Start from a classic.</span>
          <span className="ap-tile-sub">Quality compounders, dividend payers, deep value. Ready to run.</span>
          <span className="ap-tile-link">Browse strategies<ChevronRight size={17} aria-hidden="true" /></span>
        </Reveal>
        <Reveal as="button" type="button" delay={1} className="ap-tile glow" onClick={onCreate}>
          <span className="ap-tile-eyebrow">Your screen</span>
          <span className="ap-tile-title">Or make your own.</span>
          <span className="ap-tile-sub">Begin with the whole market. Add only what matters to you.</span>
          <span className="ap-tile-link">Create new screen<ChevronRight size={17} aria-hidden="true" /></span>
        </Reveal>
        {/* In the Filters tile's place (23 Oct 2026): the news itself, the
            whole width (NewsView.jsx NewsTile) */}
        {newsTile}
      </section>

      <section id="popular-strategies" className="sh-section" aria-labelledby="sh-popular">
        <div className="ap-section-head">
          <Reveal as="h2" id="sh-popular" className="ap-h2">Explore the strategies. <span>See what fits today.</span></Reveal>
        </div>
        {children}
        {/* The screen you set yourself, after the strategies (20 Oct 2026) */}
        {continueCard}
      </section>
    </div>
  );
}
