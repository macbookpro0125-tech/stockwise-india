import { useEffect, useRef, useState } from "react";
import { ChevronRight, MousePointer2 } from "lucide-react";
import { Logo } from "./site.jsx";
import StrategyMark, { markColor } from "./StrategyMarks.jsx";
import { createStarScene } from "./starScene.js";
import DomeFilm from "./DomeFilm.jsx";
import HeroSearch from "./HeroSearch.jsx";
import "./star-film.css";

// The top of the signed-out front page (16 Oct 2026, "make it from scratch,
// 4K, clarity when it zooms"): a scroll film drawn live in WebGL
// (starScene.js), so every frame is computed at the screen's own resolution
// and stays sharp however far the camera flies in. Styled as the app itself
// ("make it match the app"): its navy and teal over the night sky, Discover's
// type and buttons, and an ending that opens onto the page's own theme.
// Styles: star-film.css. The dome film (DomeFilm.jsx) is kept, and stands in
// where WebGL2 isn't available.

const c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;

const Arrow = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" style={{ marginLeft: 8 }}><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// The fair-price gauge: the levels on a company's page ("Model price
// levels"), in the same order and colours, set around a dial, with today's
// price as a needle that sweeps in and settles below the fair value. No
// figures. Positions are fractions of the dial, left (0) to right (1).
const GX = 200, GY = 214, GR = 168;
const at = (f, r = GR) => [GX - r * Math.cos(Math.PI * f), GY - r * Math.sin(Math.PI * f)];
const arcPath = (f1, f2, r = GR) => { const [x1, y1] = at(f1, r), [x2, y2] = at(f2, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
const SEGMENTS = [ // [from, to, kind, label] — drawn in this order as the scene plays
  [0, 0.12, "red", "Stop-loss"],
  [0.135, 0.3, "level3", "Level 3"],
  [0.315, 0.48, "level2", "Level 2"],
  [0.495, 0.66, "level1", "Level 1"],
  [0.88, 1, "red", "Upper level"],
];
const FAIR = 0.78, TODAY = 0.57;

function Gauge() {
  const label = (f, text, cls, r = GR + 22) => {
    const [x, y] = at(f, r);
    const anchor = f < 0.42 ? "end" : f > 0.58 ? "start" : "middle";
    return <text x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={anchor} className={cls}>{text}</text>;
  };
  return (
    <svg className="sf-gauge" viewBox="0 0 400 240" aria-hidden="true">
      <defs>
        <radialGradient id="sf-fair-glow"><stop offset="0" stopColor="var(--accent)" stopOpacity=".55" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
      </defs>
      <path d={arcPath(0, 1)} className="sf-g-track" />
      {/* the gap between today's price and the fair value */}
      <path d={arcPath(TODAY, FAIR)} pathLength="1" className="sf-g-gap" />
      {SEGMENTS.map(([f1, f2, kind], i) => (
        <path key={i} d={arcPath(f1, f2)} pathLength="1" className={`sf-g-seg sf-g-${kind}`} style={{ "--a": (i * 0.1).toFixed(2), "--b": (i * 0.1 + 0.16).toFixed(2) }} />
      ))}
      {SEGMENTS.map(([f1, f2, kind, text], i) => (
        <g key={text} className="sf-g-lab" style={{ "--a": (i * 0.1 + 0.08).toFixed(2), "--b": (i * 0.1 + 0.2).toFixed(2) }}>
          {i === 0 ? <text x={at(0)[0] + 2} y={GY + 24} className={`sf-g-${kind}`}>{text}</text>
            : i === SEGMENTS.length - 1 ? <text x={at(1)[0] - 2} y={GY + 24} textAnchor="end" className={`sf-g-${kind}`}>{text}</text>
            : label((f1 + f2) / 2, text, `sf-g-${kind}`)}
        </g>
      ))}
      {/* the fair value: a point that glows */}
      <g className="sf-g-fair" style={{ "--a": "0.45", "--b": "0.6" }}>
        <circle cx={at(FAIR)[0]} cy={at(FAIR)[1]} r="26" fill="url(#sf-fair-glow)" />
        <circle cx={at(FAIR)[0]} cy={at(FAIR)[1]} r="7" className="sf-g-fairdot" />
        {label(FAIR, "Fair value", "sf-g-fairlab", GR + 24)}
      </g>
      {/* today's price: a needle that sweeps in from the left */}
      <g className="sf-g-needle">
        <line x1={GX} y1={GY} x2={GX - GR + 26} y2={GY} />
        <circle cx={GX - GR + 26} cy={GY} r="4.5" />
      </g>
      <circle cx={GX} cy={GY} r="6" className="sf-g-pivot" />
      {/* "Today" beside the needle, just to its left, clear of the line */}
      <g className="sf-g-today">{(() => { const [x, y] = at(TODAY - 0.075, GR - 52); return <text x={x.toFixed(1)} y={y.toFixed(1)} textAnchor="end">Today</text>; })()}</g>
    </svg>
  );
}

// "Then, choose a strategy" (after the fair price): three of Discover's
// strategies as tall cards, each in its own colour, with their own marks,
// names and descriptions (server/presets.js). As the scene plays the front
// card turns away and the next comes forward; a glass card offers it, and
// the pointer taps "Open screen". No figures.
const PICK = [
  { id: "dividend_aristocrats", name: "Dividend Aristocrats", description: "Consistent dividend payers with stable cash flows" },
  { id: "high_quality_compounders", name: "High Quality Compounders", description: "Buffett-style: durable businesses with strong moats" },
  { id: "undervalued_growth", name: "Undervalued Growth", description: "Growing companies trading below fair value" },
];
const PICK_IN = 0.795, PICK_TO = 0.885; // the cards change across the scene

// A small constellation on each card: the companies it finds, lit and
// joined, among the ones it passes over. Seeded, so each card keeps its own.
function Constellation({ seed }) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const dots = Array.from({ length: 16 }, () => [16 + r() * 228, 12 + r() * 116, r()]);
  const lit = dots.map((d, i) => i).filter(i => i % 3 === 0).sort((a, b) => dots[a][0] - dots[b][0]);
  const path = lit.map((i, k) => `${k ? "L" : "M"}${dots[i][0].toFixed(1)} ${dots[i][1].toFixed(1)}`).join("");
  return (
    <svg className="sf-tall-sky" viewBox="0 0 260 140" aria-hidden="true">
      <path d={path} />
      {dots.map(([x, y, b], i) => <circle key={i} cx={x} cy={y} r={lit.includes(i) ? 3.4 : 1.4 + b} className={lit.includes(i) ? "on" : ""} />)}
    </svg>
  );
}


// The page's --bg, as a 0–1 colour for the film's ending
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return fallback;
    const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  };
  return { page: rgb("--bg", [0.031, 0.031, 0.063]) };
}

// stats: the front page's api.stats() — companies, strategies (null until loaded).
// They only set how many stars and constellations the film draws; the captions
// carry no figures (asked 16 Oct 2026: no numbers on this page).
export default function StarFilm({ onJoin, onLogin, stats }) {
  // Whether the browser draws WebGL 2: learnt from the scene itself (it returns
  // null without it), rather than a test context made just to ask — that
  // cost a second context at every load. And while the opening plays
  // (Intro.jsx) the scene waits: building it froze the page for a moment,
  // which stalled the opening's ring and lines (31 Oct 2026).
  const [gl2, setGl2] = useState(true);
  const [ready, setReady] = useState(() => !window.__introActive);
  useEffect(() => {
    if (ready) return;
    const go = () => setReady(true);
    window.addEventListener("intro-leaving", go, { once: true });
    return () => window.removeEventListener("intro-leaving", go);
  }, [ready]);
  const trackRef = useRef(null), stageRef = useRef(null), canvasRef = useRef(null);
  const barRef = useRef(null), cueRef = useRef(null), capsRef = useRef([]), pickRef = useRef(null), pointerRef = useRef(null), openRef = useRef(null), frontRef = useRef(0);
  const sceneRef = useRef(null);
  const cap = i => el => { capsRef.current[i] = el; };
  const companies = stats?.companies;
  const strategies = stats?.strategies ?? 13;

  useEffect(() => {
    if (!gl2 || !ready) return;
    const track = trackRef.current, stage = stageRef.current, cv = canvasRef.current;
    const caps = capsRef.current.filter(Boolean);
    const cue = cueRef.current, bar = barRef.current;
    const pick = pickRef.current, pointer = pointerRef.current;
    const cards = [...pick.querySelectorAll(".sf-tall")], names = [...pick.querySelectorAll(".sf-glass-name")], blooms = [...pick.querySelectorAll(".sf-bloom")];
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const exporting = new URLSearchParams(location.search).has("film-export");
    const scene = createStarScene(cv, { companies: companies ?? 2252, strategies, reduce, preserve: exporting, theme: readTheme() });
    if (!scene) { setGl2(false); return; }
    sceneRef.current = scene;

    const resize = () => scene.resize(stage.clientWidth, stage.clientHeight, Math.min(window.devicePixelRatio || 1, 2));

    // The strategy cards: the front one turns away to the left and the next
    // comes forward from behind; each rests while the pointer taps "Open
    // screen". Less motion: they change places without travelling.
    function turnPick(p) {
      const last = cards.length - 1;
      const t = c01((p - PICK_IN) / (PICK_TO - PICK_IN)) * last;
      const n = Math.min(last - 1, Math.floor(t)), f = t - n;
      const move = reduce ? (f < 0.5 ? 0 : 1) : (f < 0.3 ? 0 : f > 0.7 ? 1 : ((u => u * u * (3 - 2 * u))((f - 0.3) / 0.4)));
      const step = t >= last ? last : n + move;
      cards.forEach((el, i) => {
        const k = i - step; // 0 in front, 1 and 2 behind, below 0 turned away
        const x = k >= 0 ? k * 24 : k * 70, sc = k >= 0 ? 1 - k * 0.11 : 1 + k * 0.05, ry = k >= 0 ? -k * 12 : -k * 28;
        el.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}%) rotateY(${ry.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        el.style.opacity = (k >= 0 ? Math.max(0, 1 - Math.max(0, k - 1.2) * 1.5) : Math.max(0, 1 + k * 1.6)).toFixed(3);
        el.style.zIndex = String(Math.round(20 - Math.abs(k) * 4));
        el.style.setProperty("--dim", Math.min(Math.max(k, 0), 1.6) * 0.32);
      });
      const front = Math.round(step);
      names.forEach((el, i) => el.classList.toggle("on", i === front));
      if (frontRef.current !== front) { frontRef.current = front; openRef.current?.setAttribute("aria-label", `Open ${PICK[front].name}`); }
      blooms.forEach((el, i) => { el.style.opacity = Math.max(0, 1 - Math.abs(step - i)).toFixed(3); });
      // the pointer comes in and taps "Open screen" while a card rests
      const resting = t >= last || f > 0.72 || f < 0.28;
      const r = t >= last ? 1 : f > 0.72 ? (f - 0.72) / 0.28 : f < 0.28 ? 0.5 + f / 0.56 : 0;
      pointer.style.opacity = resting && t > 0.02 ? "1" : "0";
      pointer.classList.toggle("tap", resting && r > 0.35 && r < 0.75);
    }

    function captions(p) {
      for (const el of caps) {
        const a = +el.dataset.in, h = +el.dataset.hold, b = +el.dataset.out;
        const rise = Math.max((h - a) * 0.4, 0.008), fall = Math.max((b - h) * 0.6, 0.008);
        let o = 0;
        if (p >= a && p <= b) o = c01(Math.min((p - a) / rise, 1) * Math.min((b - p) / fall, 1));
        el.style.opacity = o.toFixed(3);
        el.classList.toggle("live", o > 0.6);
        el.inert = o < 0.05; // faded out: not clickable, not reachable with Tab
        if (el.dataset.k != null) el.style.setProperty("--k", c01((p - a) / (h - a)).toFixed(3)); // the gauge plays to its hold
        if (!reduce) el.firstElementChild.style.transform = "translateY(" + ((p - h) * -40).toFixed(1) + "px)";
      }
      cue.style.opacity = p < 0.015 ? 1 : 0;
      if (p > PICK_IN - 0.03 && p < PICK_TO + 0.04) turnPick(p); // only while it can be seen
      // the bar takes the header's material once the film moves, and the
      // page's own theme once the film has opened onto it
      bar.classList.toggle("sf-bar-on", p > 0.004);
      bar.classList.toggle("sf-bar-page", p > 0.66); // once the page has reached the top
    }

    // scroll → progress, smoothed over time; the sky keeps twinkling while on
    // screen (at most 30 frames a second once the scroll has caught up)
    let p = 0, target = 0, raf = 0, last = 0, lastDraw = 0, onScreen = true, frozen = false;
    const t0 = performance.now();
    const readTarget = () => {
      const max = track.offsetHeight - stage.clientHeight;
      target = max > 0 ? c01(-track.getBoundingClientRect().top / max) : 0;
    };
    const now = () => (performance.now() - t0) / 1000;
    function tick(ts) {
      raf = 0;
      if (frozen || !onScreen || resting()) return;
      const dt = Math.min((ts - last) / 1000, 0.5) || 0.016; last = ts;
      const d = target - p;
      const moving = !(reduce || Math.abs(d) < 0.0004);
      if (moving) p += d * (1 - Math.exp(-dt * 14)); else p = target;
      if (moving || ts - lastDraw > 32) { scene.render(p, now()); captions(p); lastDraw = ts; }
      if (moving || !reduce) raf = requestAnimationFrame(tick); // less motion: no twinkle, so stop once caught up
    }
    // the sign-in dialog covers the film: it rests until the dialog closes
    const resting = () => document.documentElement.classList.contains("auth-open");
    const kick = () => {
      if (!onScreen || frozen || resting()) return;
      readTarget();
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    const redraw = () => { if (onScreen) { scene.render(p, now()); captions(p); } };
    const onResize = () => { resize(); readTarget(); redraw(); };

    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    const io = new IntersectionObserver(entries => {
      onScreen = entries[entries.length - 1].isIntersecting; // the latest, when a jump queues two
      if (onScreen) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });
    io.observe(track);
    // light or dark: the ending opens onto whichever page is showing
    const themeWatch = new MutationObserver(() => { scene.setTheme(readTheme()); if (!resting()) { redraw(); kick(); } });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    resize(); readTarget(); p = target; scene.render(p, 0); captions(p); kick();

    // The 4K export (scripts/render-star-film.mjs) steps the film frame by frame
    // (the orbit rings and the scroll cue run on the frame's own clock, not the wall's)
    if (exporting) window.__starFilm = (fp, ft) => {
      frozen = true; p = target = fp; scene.render(fp, ft); captions(fp);
      for (const an of document.getAnimations()) if (an.animationName === "sf-orbit" || an.animationName === "sf-cue") { an.pause(); an.currentTime = ft * 1000; }
    };

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      themeWatch.disconnect();
      if (exporting) delete window.__starFilm;
      scene.destroy();
      sceneRef.current = null;
    };
  }, [gl2, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // The real counts, once they arrive: one star per company, one constellation per strategy
  useEffect(() => { if (companies != null) sceneRef.current?.setCounts(companies, strategies); }, [companies, strategies]);

  if (!gl2) return <DomeFilm onJoin={onJoin} onLogin={onLogin} />;

  return (
    <section ref={trackRef} className="sf-track" aria-label="Jocular Insights">
      <div ref={stageRef} className="sf-stage">
        <canvas ref={canvasRef} className="sf-film" role="img" aria-label="A night sky of stars, one for each company. Teal constellation lines join groups of them around one star; the camera flies toward it until it opens onto the page." />

        <div ref={barRef} className="sf-bar">
          <Logo />
          <button type="button" className="sf-signin" onClick={onLogin}>Sign in</button>
        </div>

        <div ref={cap(0)} className="sf-cap sf-sky sf-open" data-in="-0.05" data-hold="0.02" data-out="0.10"><div className="sf-ci">
          <p className="sf-eb">Indian stock market · Fundamental research</p>
          <h1>Jocular <span>Insights</span></h1>
          <p>Free quality scores and fair values for every NSE company, from its own filings.</p>
          <HeroSearch className="sf-hs" />
          <button type="button" className="sf-btn" onClick={onJoin}>Create free account<Arrow /></button>
          <p className="sf-why">Your watchlist, price alerts and results reminders.</p>
        </div></div>

        <div ref={cap(1)} className="sf-cap sf-sky sf-left" data-in="0.13" data-hold="0.20" data-out="0.27"><div className="sf-ci">
          <h2>Every NSE company.<br /><span>One night sky.</span></h2>
          <p>Every NSE-listed business, read from its own filings.</p>
        </div></div>

        <div ref={cap(2)} className="sf-cap sf-sky sf-right" data-in="0.30" data-hold="0.37" data-out="0.44"><div className="sf-ci">
          <h2>Strategies draw <span>the lines.</span></h2>
          <p>Ready-made strategies connect the companies worth a closer look.</p>
        </div></div>

        <div ref={cap(3)} className="sf-cap sf-sky sf-left" data-in="0.47" data-hold="0.54" data-out="0.61"><div className="sf-ci">
          <h2>Then one star, <span>scored.</span></h2>
          <p>A hundred points across six areas, with every check explained.</p>
        </div></div>

        <div ref={cap(4)} className="sf-cap sf-page sf-left" data-in="0.66" data-hold="0.72" data-out="0.785"><div className="sf-ci">
          <h2>Then, <span>a fair price.</span></h2>
          <p>A fair value from the company's own history, the price levels around it, and where today's price sits.</p>
        </div></div>

        <div ref={cap(5)} className="sf-cap sf-page sf-gauge-wrap" data-in="0.66" data-hold="0.745" data-out="0.785" data-k="" aria-hidden="true"><div className="sf-ci">
          <Gauge />
        </div></div>

        <div ref={cap(7)} className="sf-cap sf-page sf-left" data-in="0.785" data-hold="0.84" data-out="0.9"><div className="sf-ci">
          <h2>Then, choose <span>a strategy.</span></h2>
          <p>Pick a ready-made screen in the app and the companies that fit it are listed for you.</p>
        </div></div>

        <div ref={cap(8)} className="sf-cap sf-page sf-pick-wrap" data-in="0.78" data-hold="0.84" data-out="0.905"><div className="sf-ci">
          <div ref={pickRef} className="sf-pick">
            {PICK.map(p => <div key={p.id} className="sf-bloom" style={{ "--hue": markColor(p.id) }} aria-hidden="true" />)}
            <div className="sf-orbits" aria-hidden="true"><i /><i /><i /></div>
            {PICK.map((p, i) => (
              <div key={p.id} className="sf-tall" style={{ "--hue": markColor(p.id) }} aria-hidden="true">
                <div className="sf-tall-top"><StrategyMark preset={p} size={44} /><span className="sf-tall-info">i</span></div>
                <Constellation seed={i + 3} />
                <div className="sf-tall-text"><b>{p.name}</b><span>{p.description}</span></div>
              </div>
            ))}
            {/* A real button: notes the strategy, then opens sign-up; once
                signed in, Discover opens that strategy (DiscoverView.jsx) */}
            <div className="sf-glass">
              <small>Choose a strategy</small>
              <div className="sf-glass-names" aria-hidden="true">{PICK.map(p => <b key={p.id} className="sf-glass-name">{p.name}</b>)}</div>
              <button ref={openRef} type="button" className="sf-glass-btn" aria-label={`Open ${PICK[0].name}`} onClick={() => {
                const u = new URL(window.location.href);
                u.searchParams.set("strategy", PICK[frontRef.current].id);
                window.history.replaceState(null, "", u);
                onJoin();
              }}>Open screen<i aria-hidden="true"><ChevronRight size={15} /></i></button>
            </div>
            <div className="sf-blurcard" aria-hidden="true"><i /><i /><i /></div>
            <div ref={pointerRef} className="sf-pointer" aria-hidden="true"><MousePointer2 size={26} strokeWidth={1.6} /></div>
          </div>
        </div></div>

        <div ref={cap(6)} className="sf-cap sf-page sf-center" data-in="0.91" data-hold="0.97" data-out="1.2"><div className="sf-ci">
          <p className="sf-eb">Jocular Insights</p>
          <h2 className="sf-h1">See the market <span>clearly.</span></h2>
          <p>Quality NSE companies and their fair value. Free during early access.</p>
          <div className="sf-actions">
            <button type="button" className="sf-btn" onClick={onJoin}>Create free account</button>
            <button type="button" className="sf-link" onClick={onLogin}>Sign in<ChevronRight size={17} aria-hidden="true" /></button>
          </div>
        </div></div>

        <div ref={cueRef} className="sf-cue" aria-hidden="true">Scroll</div>
      </div>
    </section>
  );
}
