import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Logo } from "./site.jsx";
import { createStarScene } from "./starScene.js";
import DomeFilm from "./DomeFilm.jsx";
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

const hasWebGL2 = () => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } };

// The page's --bg and --accent, as 0–1 colours for the film's ending
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (name, fallback) => {
    const v = cs.getPropertyValue(name).trim();
    const m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return fallback;
    const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  };
  return { page: rgb("--bg", [0.031, 0.031, 0.063]), ink: rgb("--accent", [0, 0.878, 0.745]) };
}

// stats: the front page's api.stats() — companies, strategies (null until loaded)
export default function StarFilm({ onJoin, onLogin, stats }) {
  const [gl2] = useState(hasWebGL2);
  const trackRef = useRef(null), stageRef = useRef(null), canvasRef = useRef(null);
  const barRef = useRef(null), cueRef = useRef(null), capsRef = useRef([]);
  const sceneRef = useRef(null);
  const cap = i => el => { capsRef.current[i] = el; };
  const companies = stats?.companies;
  const strategies = stats?.strategies ?? 13;

  useEffect(() => {
    if (!gl2) return;
    const track = trackRef.current, stage = stageRef.current, cv = canvasRef.current;
    const caps = capsRef.current.filter(Boolean);
    const cue = cueRef.current, bar = barRef.current;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const exporting = new URLSearchParams(location.search).has("film-export");
    const scene = createStarScene(cv, { companies: companies ?? 2252, strategies, reduce, preserve: exporting, theme: readTheme() });
    if (!scene) return;
    sceneRef.current = scene;

    const resize = () => scene.resize(stage.clientWidth, stage.clientHeight, Math.min(window.devicePixelRatio || 1, 2));

    function captions(p) {
      for (const el of caps) {
        const a = +el.dataset.in, h = +el.dataset.hold, b = +el.dataset.out;
        const rise = Math.max((h - a) * 0.4, 0.008), fall = Math.max((b - h) * 0.6, 0.008);
        let o = 0;
        if (p >= a && p <= b) o = c01(Math.min((p - a) / rise, 1) * Math.min((b - p) / fall, 1));
        el.style.opacity = o.toFixed(3);
        el.classList.toggle("live", o > 0.6);
        el.inert = o < 0.05; // faded out: not clickable, not reachable with Tab
        if (!reduce) el.firstElementChild.style.transform = "translateY(" + ((p - h) * -40).toFixed(1) + "px)";
      }
      cue.style.opacity = p < 0.015 ? 1 : 0;
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
      if (frozen || !onScreen) return;
      const dt = Math.min((ts - last) / 1000, 0.5) || 0.016; last = ts;
      const d = target - p;
      const moving = !(reduce || Math.abs(d) < 0.0004);
      if (moving) p += d * (1 - Math.exp(-dt * 14)); else p = target;
      if (moving || ts - lastDraw > 32) { scene.render(p, now()); captions(p); lastDraw = ts; }
      if (moving || !reduce) raf = requestAnimationFrame(tick); // less motion: no twinkle, so stop once caught up
    }
    const kick = () => {
      if (!onScreen || frozen) return;
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
    const themeWatch = new MutationObserver(() => { scene.setTheme(readTheme()); redraw(); });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    resize(); readTarget(); p = target; scene.render(p, 0); captions(p); kick();

    // The 4K export (scripts/render-star-film.mjs) steps the film frame by frame
    if (exporting) window.__starFilm = (fp, ft) => { frozen = true; p = target = fp; scene.render(fp, ft); captions(fp); };

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
  }, [gl2]); // eslint-disable-line react-hooks/exhaustive-deps

  // The real counts, once they arrive: one star per company, one constellation per strategy
  useEffect(() => { if (companies != null) sceneRef.current?.setCounts(companies, strategies); }, [companies, strategies]);

  if (!gl2) return <DomeFilm onJoin={onJoin} onLogin={onLogin} stats={stats} />;

  return (
    <section ref={trackRef} className="sf-track" aria-label="Stockwise India">
      <div ref={stageRef} className="sf-stage">
        <canvas ref={canvasRef} className="sf-film" role="img" aria-label="A night sky of stars, one for each company. Teal constellation lines join groups of them around one star; the camera flies toward it until it opens onto the page." />

        <div ref={barRef} className="sf-bar">
          <Logo />
          <button type="button" className="sf-signin" onClick={onLogin}>Sign in</button>
        </div>

        <div ref={cap(0)} className="sf-cap sf-sky sf-open" data-in="-0.05" data-hold="0.02" data-out="0.10"><div className="sf-ci">
          <p className="sf-eb">NSE · Fundamental research</p>
          <h1>Stockwise <span>India</span></h1>
          <p>Find great businesses. Invest with clarity.</p>
          <button type="button" className="sf-btn" onClick={onJoin}>Create free account<Arrow /></button>
        </div></div>

        <div ref={cap(1)} className="sf-cap sf-sky sf-left" data-in="0.13" data-hold="0.20" data-out="0.27"><div className="sf-ci">
          <h2>{companies != null ? `${companies.toLocaleString("en-IN")} companies.` : "Every NSE company."}<br /><span>One night sky.</span></h2>
          <p>Every NSE-listed business, read from its own filings.</p>
        </div></div>

        <div ref={cap(2)} className="sf-cap sf-sky sf-right" data-in="0.30" data-hold="0.37" data-out="0.44"><div className="sf-ci">
          <h2>Strategies draw <span>the lines.</span></h2>
          <p>{strategies} ready-made screens connect the companies worth a closer look.</p>
        </div></div>

        <div ref={cap(3)} className="sf-cap sf-sky sf-left" data-in="0.47" data-hold="0.54" data-out="0.61"><div className="sf-ci">
          <h2>Then one star, <span>scored.</span></h2>
          <p>A hundred points across six areas, with every check explained.</p>
        </div></div>

        <div ref={cap(4)} className="sf-cap sf-page sf-right" data-in="0.66" data-hold="0.73" data-out="0.81"><div className="sf-ci">
          <h2>Then, <span>a fair price.</span></h2>
          <p>Five valuation methods side by side, even when they disagree.</p>
        </div></div>

        <div ref={cap(5)} className="sf-cap sf-page sf-center" data-in="0.86" data-hold="0.95" data-out="1.2"><div className="sf-ci">
          <p className="sf-eb">Stockwise India</p>
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
