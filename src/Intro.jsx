import { useEffect, useMemo, useRef, useState } from "react";
import { tick } from "./haptics.js";

// The opening, third version (31 Oct 2026: "start fresh … Apple-like"; the
// earlier ones looked cheap, slow and not like a markets app). One hero
// moment on black, as Apple's product films do it: a smooth market line in
// a teal–blue–violet gradient sweeps up the screen, a point of light riding
// its tip; the point of light becomes the app's own glass JI and the name,
// and the logo flies into its place in the app. No words but the name (31
// Oct 2026: "remove that wording totally").
//
// When: each start of the phone app; in a browser once a visit, on the front
// page. Never for a test browser or a search engine (navigator.webdriver), nor
// with reduced motion. A tap skips it.
const LENGTH_MS = 2700;

function wanted() {
  if (typeof window === "undefined") return false;
  if (navigator.webdriver || /bot|crawl|spider|lighthouse/i.test(navigator.userAgent)) return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  if (new URLSearchParams(location.search).has("nointro")) return false;
  if (document.documentElement.classList.contains("in-app")) return true;
  if (location.pathname !== "/") return false;
  try {
    if (sessionStorage.getItem("introSeen")) return false;
    sessionStorage.setItem("introSeen", "1");
  } catch {}
  return true;
}

// set before the app's first effects run, so what waits for the opening
// (StarFilm.jsx's 3D scene) knows to wait; cleared, with an "intro-leaving"
// event, the moment the opening starts to go
function decide() {
  const yes = wanted();
  if (yes) window.__introActive = true;
  return yes;
}

// The line: a market's climb with two honest dips, drawn as one smooth curve
// (Catmull–Rom through the points). A picture of a market, not a claim about one.
const POINTS = [[0, 820], [120, 760], [230, 790], [340, 650], [450, 690], [560, 520], [650, 560], [760, 380], [860, 300], [1000, 170]];
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// A soft two-note chime, made here (no sound file): a bell-like tone and its
// fifth, each a quick rise and a long fall. Only where sound may play unasked
// (the phone app); a browser that hasn't been tapped stays silent.
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctx.resume?.();
    if (ctx.state !== "running") { ctx.close?.(); return; }
    const now = ctx.currentTime, out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
    for (const [freq, at, peak] of [[1318.5, 0, 0.07], [1975.5, 0.09, 0.045], [659.3, 0, 0.03]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + at);
      g.gain.linearRampToValueAtTime(peak, now + at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 1.3);
      o.connect(g).connect(out);
      o.start(now + at); o.stop(now + at + 1.4);
    }
    setTimeout(() => ctx.close?.(), 1700);
  } catch {}
}

export default function Intro() {
  const [on, setOn] = useState(decide);
  const [leaving, setLeaving] = useState(false);
  // kept as state (not added to the element by hand), so a redraw keeps them
  const [landed, setLanded] = useState(false);
  const [flying, setFlying] = useState(false);
  const done = useRef(false);
  const lineRef = useRef(null), dotRef = useRef(null), rootRef = useRef(null), logoRef = useRef(null);
  const landedRef = useRef(false);
  const path = useMemo(() => smooth(POINTS), []);

  // The ending: the logo shrinks and flies into the app's own logo in its
  // header (whichever is showing: the app's bar, the phone's search bar, the
  // front page's) while the film around it falls away; with none in view, it
  // just fades. The app's logo is then exactly where this one came to rest.
  const finish = () => {
    if (done.current) return;
    done.current = true;
    const img = logoRef.current;
    const target = img && [...document.querySelectorAll(".brand-mark")].find(el => {
      if (rootRef.current?.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 8 && r.top >= -4 && r.top < window.innerHeight * 0.3 && getComputedStyle(el).visibility !== "hidden";
    });
    let fly = false;
    if (target && landedRef.current) {
      const from = img.getBoundingClientRect(), to = target.getBoundingClientRect();
      img.style.setProperty("--fly", `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})`);
      fly = true;
    }
    setFlying(fly);
    setLeaving(true);
    window.__introActive = false;
    window.dispatchEvent(new Event("intro-leaving"));
    setTimeout(() => setOn(false), fly ? 760 : 560);
  };

  useEffect(() => {
    if (!on) return;
    const t = setTimeout(finish, LENGTH_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The point of light: it rides the line's tip as the line draws (the draw is
  // CSS; the point follows the same curve and timing), then flies in an arc to
  // where the logo will stand, growing, and
  // bursts into the ripple the logo comes out of (one thing becomes the next)
  useEffect(() => {
    const line = lineRef.current, dot = dotRef.current, root = rootRef.current, logo = logoRef.current;
    if (!on || !line || !dot || !root || !logo) return;
    const total = line.getTotalLength();
    const t0 = performance.now();
    const RIDE = [150, 1300], FLY = [1380, 1780];
    const out = t => 1 - (1 - t) ** 3, inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    let raf = 0, end = null, down = false;
    const step = now => {
      const e = now - t0, W = root.clientWidth, H = root.clientHeight;
      if (e < FLY[0]) {
        const t = Math.max(0, Math.min(1, (e - RIDE[0]) / (RIDE[1] - RIDE[0])));
        const p = line.getPointAtLength(total * out(t));
        // the line is stretched to the screen (viewBox 0–1000 each way)
        end = [(p.x / 1000) * W, (p.y / 1000) * H];
        dot.style.transform = `translate(${end[0]}px, ${end[1]}px)`;
      } else if (e < FLY[1]) {
        const r = logo.getBoundingClientRect(), to = [r.left + r.width / 2, r.top + r.height / 2];
        const t = inOut((e - FLY[0]) / (FLY[1] - FLY[0]));
        // an arc: out and over, not a straight slide
        const mid = [(end[0] + to[0]) / 2 + W * 0.12, Math.min(end[1], to[1]) - H * 0.08];
        const x = (1 - t) ** 2 * end[0] + 2 * (1 - t) * t * mid[0] + t * t * to[0];
        const y = (1 - t) ** 2 * end[1] + 2 * (1 - t) * t * mid[1] + t * t * to[1];
        dot.style.transform = `translate(${x}px, ${y}px) scale(${1 + 2.2 * t})`;
      } else if (!down) {
        down = true;
        landedRef.current = true;
        setLanded(true);
        // a light tap and a soft chime, in the phone app, as the logo lands
        if (document.documentElement.classList.contains("in-app")) { try { tick(); } catch {} chime(); }
      }
      if (e < FLY[1] + 50) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;
  return (
    <div ref={rootRef} className={`i4${landed ? " landed" : ""}${flying ? " flying" : ""}${leaving ? " leaving" : ""}`} role="status" aria-label="Opening Jocular Insights" onClick={finish}>
      <div className="i4-glow" aria-hidden="true" />
      <svg className="i4-chart" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="i4-stroke" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#00E0BE" /><stop offset="0.55" stopColor="#3E8BFF" /><stop offset="1" stopColor="#A86BFF" />
          </linearGradient>
          <linearGradient id="i4-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3E8BFF" stopOpacity="0.32" /><stop offset="1" stopColor="#3E8BFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L1000,1000 L0,1000 Z`} className="i4-area" fill="url(#i4-area)" />
        {/* an echo of the line behind it, for depth, and a travelling shimmer once it's drawn */}
        <path d={path} className="i4-echo" stroke="url(#i4-stroke)" pathLength="1" transform="translate(0 46)" />
        <path ref={lineRef} d={path} className="i4-line" stroke="url(#i4-stroke)" pathLength="1" />
        <path d={path} className="i4-shimmer" pathLength="1" />
      </svg>
      <span ref={dotRef} className="i4-dot" aria-hidden="true" />


      <div className="i4-lockup" aria-hidden="true">
        <span className="i4-logo-wrap"><span className="i4-ripple" /><span className="i4-ripple two" /><img ref={logoRef} src="/jocular-insights-dark.png" alt="" width="160" height="160" decoding="sync" /><span className="i4-glint" /></span>
        <div className="i4-name">Jocular <span>Insights</span></div>
      </div>
    </div>
  );
}
