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
const RIDE = [150, 1300], FLY = [1380, 1780]; // CSS's logo waits for FLY's end (index.css)

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
  // kept as state (not added to the element by hand), so a redraw keeps it
  const [flying, setFlying] = useState(false);
  const done = useRef(false);
  const lineRef = useRef(null), dotRef = useRef(null), rootRef = useRef(null), logoRef = useRef(null), revealRef = useRef(null), revealInRef = useRef(null);
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
    setTimeout(() => setOn(false), fly ? 965 : 560);
  };

  useEffect(() => {
    if (!on) return;
    const t = setTimeout(finish, LENGTH_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The point of light rides the line's tip as the line is uncovered, then
  // flies in an arc to where the logo will stand, growing, and bursts into the
  // ripple the logo comes out of. All of it is worked out once, here, and
  // handed to the browser as keyframes (1 Nov 2026, "lagging" on Android): the
  // graphics chip runs them, whatever the app loading behind is doing.
  useEffect(() => {
    const line = lineRef.current, dot = dotRef.current, root = rootRef.current, logo = logoRef.current, win = revealRef.current, inner = revealInRef.current;
    if (!on || !line || !dot || !root || !logo || !win || !inner || !dot.animate) return;
    const W = root.clientWidth, H = root.clientHeight, total = line.getTotalLength();
    // the curve's height at each x (viewBox 0–1000 each way, stretched to the screen)
    const table = Array.from({ length: 201 }, (_, i) => line.getPointAtLength((total * i) / 200));
    const yAt = x => {
      let i = 1;
      while (i < 200 && table[i].x < x) i++;
      const a = table[i - 1], b = table[i], f = b.x > a.x ? (x - a.x) / (b.x - a.x) : 0;
      return a.y + (b.y - a.y) * f;
    };
    const out = t => 1 - (1 - t) ** 3, inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const [S, R, F, E] = [RIDE[0], RIDE[1], FLY[0], FLY[1]];
    const r = logo.getBoundingClientRect(), to = [r.left + r.width / 2, r.top + r.height / 2];
    const end = [W, (yAt(1000) / 1000) * H];
    const mid = [(end[0] + to[0]) / 2 + W * 0.12, Math.min(end[1], to[1]) - H * 0.08];
    const dotFrames = [], outer = [], in2 = [];
    const STEPS = 40;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS, p = out(t), offset = (S + (R - S) * t) / E, x = p * 1000;
      dotFrames.push({ offset, transform: `translate(${(x / 1000) * W}px, ${(yAt(x) / 1000) * H}px) scale(1)`, opacity: 1 });
      outer.push({ offset: t, transform: `translateX(${(p - 1) * 100}%)` });
      in2.push({ offset: t, transform: `translateX(${(1 - p) * 100}%)` });
    }
    for (let i = 0; i <= 24; i++) {
      const t = inOut(i / 24), offset = (F + (E - F) * (i / 24)) / E;
      const x = (1 - t) ** 2 * end[0] + 2 * (1 - t) * t * mid[0] + t * t * to[0];
      const y = (1 - t) ** 2 * end[1] + 2 * (1 - t) * t * mid[1] + t * t * to[1];
      dotFrames.push({ offset, transform: `translate(${x}px, ${y}px) scale(${1 + 2.2 * t})`, opacity: 1 });
    }
    dotFrames.unshift({ offset: 0, transform: dotFrames[0].transform, opacity: 1 });
    const runs = [
      dot.animate(dotFrames, { duration: E, fill: "forwards", easing: "linear" }),
      win.animate(outer, { duration: R - S, delay: S, fill: "both", easing: "linear" }),
      inner.animate(in2, { duration: R - S, delay: S, fill: "both", easing: "linear" }),
      dot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay: E, fill: "forwards", composite: "replace" }),
    ];
    // a light tap and a soft chime, in the phone app, as the logo lands
    const land = setTimeout(() => {
      landedRef.current = true;
      if (document.documentElement.classList.contains("in-app")) { try { tick(); } catch {} chime(); }
    }, E);
    return () => { clearTimeout(land); runs.forEach(a => a.cancel()); };
  }, [on]);

  if (!on) return null;
  return (
    <div ref={rootRef} className={`i4${flying ? " flying" : ""}${leaving ? " leaving" : ""}`} role="status" aria-label="Opening Jocular Insights" onClick={finish}>
      <div className="i4-bg" aria-hidden="true" />
      <div className="i4-glow" aria-hidden="true" />
      <div className="i4-chart" aria-hidden="true">
        {/* the fill under the line fades in on its own, so it has no hard edge */}
        <svg className="i4-area" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <defs>
            <linearGradient id="i4-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3E8BFF" stopOpacity="0.32" /><stop offset="1" stopColor="#3E8BFF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path} L1000,1000 L0,1000 Z`} fill="url(#i4-area)" />
        </svg>
        <div ref={revealRef} className="i4-reveal">
          <div ref={revealInRef} className="i4-reveal-in">
            <svg viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <defs>
                <linearGradient id="i4-stroke" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stopColor="#00E0BE" /><stop offset="0.55" stopColor="#3E8BFF" /><stop offset="1" stopColor="#A86BFF" />
                </linearGradient>
              </defs>
              {/* an echo of the line behind it, for depth */}
              <path d={path} className="i4-echo" stroke="url(#i4-stroke)" transform="translate(0 46)" />
              <path ref={lineRef} d={path} className="i4-line" stroke="url(#i4-stroke)" />
            </svg>
          </div>
        </div>
      </div>
      <span ref={dotRef} className="i4-dot" aria-hidden="true" />


      <div className="i4-lockup" aria-hidden="true">
        <span className="i4-logo-wrap"><span className="i4-ripple" /><span className="i4-ripple two" /><img ref={logoRef} src="/jocular-insights-dark.png" alt="" width="160" height="160" decoding="sync" /><span className="i4-glint" /></span>
        <div className="i4-name">Jocular <span>Insights</span></div>
      </div>
    </div>
  );
}
