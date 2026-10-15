import { useLayoutEffect, useRef } from "react";
import {
  ArrowDown, ArrowRight, Bookmark, BriefcaseBusiness, Check, GitCompare,
  LineChart, ScanSearch, ShieldCheck, SlidersHorizontal, Bell,
} from "lucide-react";

const SCENES = [
  {
    eyebrow: "Stockwise India · NSE research",
    title: <>See beyond<br />the stock price.</>,
    body: "Discover stronger businesses, understand their financial health, and decide what deserves a closer look.",
  },
  {
    eyebrow: "01 / Screen with intent",
    title: <>Thousands of stocks.<br />A clearer shortlist.</>,
    body: "Begin with a strategy or shape your own screen across financial and ownership metrics.",
  },
  {
    eyebrow: "02 / Read the business",
    title: <>Look beneath<br />the surface.</>,
    body: "Move from market-wide results into the company’s filings, financial history, shareholding, and research checks.",
  },
  {
    eyebrow: "03 / Understand the reasoning",
    title: <>A score is only<br />the start of the story.</>,
    body: "See how six research lenses are built, what the filings support, and where information is missing.",
  },
  {
    eyebrow: "04 / Keep your research close",
    title: <>From a good question<br />to a considered watchlist.</>,
    body: "Save a company, compare it with others, set an alert, and revisit it against your own price levels.",
  },
  {
    eyebrow: "Stockwise India",
    title: <>Make each decision<br />more informed.</>,
    body: "Research the fundamentals. Understand the risks. Find the businesses worth watching.",
  },
];

const DOTS = Array.from({ length: 96 }, (_, i) => i);
const FILTERS = ["Sales growth · 3Y", "ROE · 5Y average", "Operating margin", "Debt / equity", "Promoter pledge"];
const LENSES = [
  ["Business", "Returns on the capital it uses"],
  ["Earnings", "Whether profit is backed by cash"],
  ["Balance sheet", "Debt and interest cover"],
  ["Governance", "Pledges, audits, and dilution"],
  ["Growth", "Sales and profit over time"],
  ["Valuation", "Price against the company’s own history"],
];

const formatted = value => value == null ? "—" : Number(value).toLocaleString("en-IN");

function OpeningVisual() {
  return <div className="story-visual story-opening" aria-label="Illustrative financial fundamentals chart, not market-price data">
    <div className="story-visual-label"><span><i /> FUNDAMENTALS, OVER TIME</span><span>Illustrative view</span></div>
    <div className="story-opening-chart">
      <div className="story-chart-legend"><span><i className="legend-growth" />Growth</span><span><i className="legend-cash" />Cash generation</span><span><i className="legend-health" />Financial health</span></div>
      <svg viewBox="0 0 820 380" role="img" aria-label="Three illustrative financial trend lines moving across a fine grid">
        <defs>
          <linearGradient id="story-chart-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6bd49b" stopOpacity=".12"/><stop offset="1" stopColor="#6bd49b" stopOpacity="0"/></linearGradient>
          <linearGradient id="story-chart-fade" x1="0" x2="1"><stop offset="0" stopColor="#080a0d" stopOpacity="1"/><stop offset=".2" stopColor="#080a0d" stopOpacity="0"/><stop offset=".83" stopColor="#080a0d" stopOpacity="0"/><stop offset="1" stopColor="#080a0d" stopOpacity=".7"/></linearGradient>
        </defs>
        <path className="story-area" d="M0 300 C65 293 61 246 123 253 S194 277 244 225 S314 230 366 186 S429 201 484 152 S560 169 614 116 S683 137 820 38 V380 H0Z" />
        <path className="story-grid-path" d="M0 300 C65 293 61 246 123 253 S194 277 244 225 S314 230 366 186 S429 201 484 152 S560 169 614 116 S683 137 820 38" />
        <path className="story-line story-line-main" d="M0 300 C65 293 61 246 123 253 S194 277 244 225 S314 230 366 186 S429 201 484 152 S560 169 614 116 S683 137 820 38" />
        <path className="story-line story-line-secondary" d="M0 324 C87 323 100 288 177 292 S280 271 343 257 S453 238 519 207 S641 198 705 162 S776 142 820 131" />
        <path className="story-line story-line-tertiary" d="M0 264 C92 240 102 286 183 278 S287 302 354 289 S458 309 522 300 S639 323 700 312 S775 332 820 339" />
        <g className="story-chart-markers"><circle cx="244" cy="225" r="4"/><circle cx="484" cy="152" r="4"/><circle cx="614" cy="116" r="4"/><circle cx="820" cy="38" r="4"/></g>
        <rect width="820" height="380" fill="url(#story-chart-fade)" />
      </svg>
      <div className="story-chart-axis"><span>REVENUE</span><span>PROFITABILITY</span><span>CASH FLOW</span><span>OWNERSHIP</span></div>
    </div>
    <div className="story-visual-footer"><span>Read the business behind the symbol</span><span>Scroll to follow the research <ArrowDown size={14}/></span></div>
  </div>;
}

function ScreenerVisual({ stats }) {
  const universeCount = formatted(stats?.companies);
  const filterCount = formatted(stats?.filters);
  return <div className="story-visual story-screener" aria-label="Illustration of screening conditions narrowing the listed-company universe">
    <div className="story-screen-heading"><div><span className="story-kicker"><SlidersHorizontal size={13}/> THE SCREENER</span><strong>Start with what matters to you.</strong></div><span className="story-screen-stat"><b>{filterCount}</b> filters</span></div>
    <div className="story-screen-stage">
      <div className="story-universe">
        <div className="story-universe-head"><span>LISTED COMPANIES</span><strong>{universeCount}</strong><small>in the market universe</small></div>
        <svg className="story-dot-map" viewBox="0 0 420 260" aria-hidden="true">
          {DOTS.map(i => {
            const x = 14 + (i % 12) * 35 + ((i * 17) % 9);
            const y = 16 + Math.floor(i / 12) * 30 + ((i * 13) % 8);
            const selected = i % 11 === 2 || i % 17 === 5 || i % 23 === 8;
            return <circle key={i} className={selected ? "universe-dot is-match" : "universe-dot"} cx={x} cy={y} r={selected ? 3.2 : 2.2} />;
          })}
        </svg>
        <div className="story-universe-caption"><span>Every point is a company</span><span>Illustrative, not live results</span></div>
      </div>
      <div className="story-filter-panel">
        <div className="story-filter-title"><span>YOUR CONDITIONS</span><b>Five ways to focus</b></div>
        <div className="story-filter-list">{FILTERS.map((label, i) => <div className="story-filter" key={label}><i><Check size={11}/></i><span>{label}</span><small>{["≥ range", "≥ range", "≥ range", "≤ range", "≤ range"][i]}</small></div>)}</div>
        <div className="story-match-output"><span className="story-match-bracket"/><div><b>From broad to focused</b><small>Each condition adds context</small></div><ArrowRight size={17}/></div>
      </div>
    </div>
    <div className="story-screen-footer"><span>13 ready-made strategies</span><span>Build your own from the metrics</span></div>
  </div>;
}

function ProductVisual({ final = false }) {
  return <div className={"story-visual story-product-shot" + (final ? " is-final" : "")}>
    <div className="story-shot-bar"><span><i/><i/><i/></span><b>STOCKWISE INDIA <small>· DISCOVER</small></b><span>PRODUCT SCREEN</span></div>
    <img src="/screens/discover.jpg" alt="Stockwise Discover interface with filters, strategy results, company quality scores and financial metrics; prices as of 1 October 2026." />
    {final && <div className="story-final-caption"><span>STOCKWISE INDIA</span><strong>Research, in context.</strong><small>Company results · filters · scores · financial metrics</small></div>}
  </div>;
}

function MethodVisual() {
  return <div className="story-visual story-method" aria-label="The six research lenses used in Stockwise quality scoring">
    <div className="story-method-head"><span><ShieldCheck size={15}/> THE QUALITY SCORE</span><small>Six lenses · checks explained</small></div>
    <div className="story-method-grid">{LENSES.map(([title, copy], i) => <div className="story-lens" key={title}><span className="story-lens-index">0{i + 1}</span><div><b>{title}</b><small>{copy}</small></div><i className="story-lens-trace"><span/></i></div>)}</div>
    <div className="story-method-note"><span>From NSE filings</span><i/><span>Missing data stays visible</span><i/><span>Not a buy or sell signal</span></div>
  </div>;
}

function WorkflowVisual() {
  const steps = [
    [Bookmark, "Watchlist", "Save a company"],
    [GitCompare, "Compare", "Up to five companies"],
    [Bell, "Price alerts", "At the latest daily close"],
    [BriefcaseBusiness, "Portfolio", "Track your own holdings"],
  ];
  return <div className="story-visual story-workflow" aria-label="Stockwise watchlist, comparison, price-alert, and portfolio features">
    <div className="story-workflow-top"><span>YOUR RESEARCH, IN ONE PLACE</span><small>Find · understand · follow</small></div>
    <div className="story-workflow-rail"><i/><i/><i/></div>
    <div className="story-workflow-grid">{steps.map(([Icon, title, copy], i) => <div className="story-work-item" key={title}><span className="story-work-index">0{i + 1}</span><span className="story-work-icon"><Icon size={19}/></span><b>{title}</b><small>{copy}</small></div>)}</div>
    <div className="story-workflow-footer"><LineChart size={15}/><span>Research-led tracking, at your pace.</span><ArrowRight size={15}/></div>
  </div>;
}

function ScreenVisual({ scene, stats }) {
  if (scene === 0) return <OpeningVisual/>;
  if (scene === 1) return <ScreenerVisual stats={stats}/>;
  if (scene === 2) return <ProductVisual/>;
  if (scene === 3) return <MethodVisual/>;
  if (scene === 4) return <WorkflowVisual/>;
  return <ProductVisual final/>;
}

export default function CinematicStory({ onJoin, onLogin, onDiscover, stats }) {
  const root = useRef(null);
  const scenes = useRef([]);
  const counter = useRef(null);
  const progress = useRef(null);

  useLayoutEffect(() => {
    let disposed = false;
    let media;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, triggerModule]) => {
      if (disposed) return;
      const gsap = gsapModule.default;
      const ScrollTrigger = triggerModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        const host = root.current;
        const slides = scenes.current.filter(Boolean);
        if (!host || slides.length !== SCENES.length) return;
        host.classList.add("is-animated");
        gsap.set(slides.slice(1), { autoAlpha: 0 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: host,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.42,
            invalidateOnRefresh: true,
            onUpdate(self) {
              const current = Math.min(SCENES.length, Math.floor(self.progress * SCENES.length) + 1);
              if (counter.current) counter.current.textContent = String(current).padStart(2, "0") + " — " + String(SCENES.length).padStart(2, "0");
              if (progress.current) gsap.set(progress.current, { scaleY: self.progress });
            },
          },
        });
        const q = selector => host.querySelectorAll(selector);
        tl.fromTo(q(".story-line-main"), { strokeDashoffset: 1120 }, { strokeDashoffset: 0, duration: 1.45, ease: "none" }, 0.05)
          .fromTo(q(".story-line-secondary"), { strokeDashoffset: 1120 }, { strokeDashoffset: 0, duration: 1.35, ease: "none" }, 0.25)
          .fromTo(q(".story-line-tertiary"), { strokeDashoffset: 1120 }, { strokeDashoffset: 0, duration: 1.25, ease: "none" }, 0.45)
          .fromTo(q(".story-chart-markers circle"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, stagger: 0.16, duration: 0.22 }, 0.4)
          .fromTo(q(".story-chart-legend span"), { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.25 }, 0.3)
          .fromTo(q(".story-filter"), { x: 18, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.08, duration: 0.22 }, 0.96)
          .fromTo(q(".story-match-output"), { clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 0 0 0)", opacity: 1, duration: 0.34 }, 1.5)
          .to(q(".universe-dot:not(.is-match)"), { opacity: 0.13, scale: 0.7, stagger: 0.002, duration: 0.3 }, 1.5)
          .to(q(".universe-dot.is-match"), { opacity: 1, scale: 1.55, stagger: 0.03, duration: 0.26 }, 1.62)
          .fromTo(q(".story-lens"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.085, duration: 0.22 }, 2.98)
          .fromTo(q(".story-lens-trace span"), { scaleX: 0 }, { scaleX: 1, stagger: 0.08, duration: 0.3 }, 3.14)
          .fromTo(q(".story-work-item"), { x: 25, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.11, duration: 0.28 }, 3.96)
          .fromTo(q(".story-workflow-rail"), { scaleX: 0 }, { scaleX: 1, duration: 0.42 }, 4.02);

        slides.forEach((slide, i) => {
          if (i === 0) return;
          const previous = slides[i - 1];
          const at = i - 0.22;
          tl.to(previous, { autoAlpha: 0, y: -14, duration: 0.16, ease: "power2.in" }, at)
            .to(previous.querySelector(".story-visual"), { x: -28, scale: 0.985, autoAlpha: 0, duration: 0.34, ease: "power1.in" }, at)
            .fromTo(slide, { y: 17, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.2, ease: "power2.out" }, at + 0.08)
            .fromTo(slide.querySelector(".story-visual"), { x: 34, scale: 0.985, autoAlpha: 0, clipPath: "inset(0 0 12% 0)" }, { x: 0, scale: 1, autoAlpha: 1, clipPath: "inset(0 0 0 0)", duration: 0.44, ease: "power2.out" }, at + 0.1);
        });
        ScrollTrigger.refresh();
        return () => { tl.scrollTrigger?.kill(); tl.kill(); host.classList.remove("is-animated"); };
      });
    }).catch(() => {});
    return () => { disposed = true; media?.revert(); };
  }, []);

  return <section className="cinematic-track" ref={root} aria-label="The Stockwise India research story">
    <div className="cinematic-sticky">
      <div className="story-atmosphere" aria-hidden="true"><i/><i/><i/></div>
      <header className="story-topline">
        <a className="story-brand" href="#top" aria-label="Stockwise India, home"><img src="/stockwise-india-icon.svg" alt=""/><span>Stockwise <i>India</i></span></a>
        <nav className="story-nav" aria-label="Landing page">
          <a href="#product-preview">The platform</a><a href="#research-features">Research</a>
          <button type="button" onClick={onLogin}>Sign in <ArrowRight size={14}/></button>
        </nav>
      </header>
      {SCENES.map((scene, i) => <article className={"story-scene story-scene-" + i} key={scene.eyebrow} ref={el => { scenes.current[i] = el; }} aria-label={scene.eyebrow}>
        <div className="story-copy">
          <span className="story-eyebrow"><i/>{scene.eyebrow}</span>
          <h2>{scene.title}</h2><p>{scene.body}</p>
          {(i === 0 || i === SCENES.length - 1) && <div className="story-actions">
            <button className="story-cta" type="button" onClick={onJoin}>{i === 0 ? "Explore Stockwise" : "Start exploring Stockwise"}<ArrowRight size={16}/></button>
            <button className="story-link" type="button" onClick={() => onDiscover(i === 0 ? "research" : "screener")}>{i === 0 ? "Discover our research" : "View the stock screener"}<ArrowDown size={14}/></button>
          </div>}
          {i === 1 && <div className="story-truth"><ScanSearch size={14}/><span>{formatted(stats?.companies)} listed companies · {formatted(stats?.filters)} filters</span></div>}
          {i === 3 && <div className="story-truth"><ShieldCheck size={14}/><span>Experimental model · transparent checks</span></div>}
          {i === 4 && <div className="story-truth"><Check size={14}/><span>Alerts use the latest daily close</span></div>}
        </div>
        <ScreenVisual scene={i} stats={stats}/>
        {i === 0 && <div className="story-scroll-cue"><span/>A closer look starts here</div>}
      </article>)}
      <div className="story-progress-rail" aria-hidden="true"><i ref={progress}/></div>
      <div className="story-counter" aria-hidden="true">THE RESEARCH JOURNEY <span ref={counter}>01 — 06</span></div>
    </div>
  </section>;
}
