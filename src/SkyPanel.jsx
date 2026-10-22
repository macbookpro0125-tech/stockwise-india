import { useEffect, useRef } from "react";
import { createStarScene, panelCamera } from "./starScene.js";

// The sign-in panel's sky (16 Oct 2026): the front page's live star sky
// (starScene.js), and in it the app's own mark drawn as a constellation —
// "the lines should mean something: show my app's name". Since the JI logo
// (22 Oct 2026; it had drawn the old J and its chart line): stars down the J
// and the I are joined, then the ring is drawn round them star by star to
// its end star, at the ring's opening; "Jocular Insights" appears beneath.
// At rest it draws, holds, fades and draws again; as the form fills in
// (progress 0–1) it draws with it; on success a ring of light closes round
// the end star. The sky shifts a little with the pointer, the mark a little
// less — depth. Less motion: everything shown, still; the ring closed at once.
// paused: hold the frame (the panel's pause button).

// In a 512 × 512 square: the logo's own outline (scripts/brand/ji-paths.json,
// centre (505, 511) of 1024) scaled by 0.4566 about (256, 256), so its outer
// ring is 200 across the middle
const J = [[213, 156], [233, 156], [233, 214], [233, 272], [229, 302], [219, 320], [204, 334]];
const I = [[291, 197], [291, 237], [291, 278], [291, 320]];
// The outer ring is open on the right, from -27° (upper right) round over
// the top and the left to 19° (lower right), where its end star sits
const RING = { r: 200, from: -27, sweep: -314 };
const at = deg => [256 + RING.r * Math.cos(deg * Math.PI / 180), 256 + RING.r * Math.sin(deg * Math.PI / 180)];
const RING_STARS = Array.from({ length: 8 }, (_, i) => at(RING.from + RING.sweep * i / 7));
const END = RING_STARS[RING_STARS.length - 1];
const RING_PATH = (() => {
  const [x0, y0] = RING_STARS[0], [x1, y1] = END;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${RING.r} ${RING.r} 0 1 0 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
})();
// where along each line a star is reached (0–1 of its length), so it lights as the line arrives
const reach = pts => {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let run = 0;
  return pts.map((_, i) => (i === 0 ? 0 : (run += seg[i - 1]) / total));
};
const pts = list => list.map(p => p.join(",")).join(" ");
const arc = (k, r = 34) => { // one of the six arcs of light round the end star, clockwise from the top
  const a0 = -Math.PI / 2 + k * Math.PI / 3 + 0.07, a1 = a0 + Math.PI / 3 - 0.14;
  const p = a => [END[0] + r * Math.cos(a), END[1] + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

const LOOP = 16; // seconds at rest: draw, hold, fade, rest
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;

const Star = ({ p, at, className }) => (
  <g className={`am-star ${className}`} style={{ "--at": at.toFixed(3) }}><circle cx={p[0]} cy={p[1]} r="13" fill="url(#auth-star-glow)" /><circle cx={p[0]} cy={p[1]} r="3.4" className="am-core" /></g>
);

function Mark({ markRef }) {
  return (
    <svg ref={markRef} className="auth-mark" viewBox="0 0 512 560" aria-hidden="true">
      <defs>
        <radialGradient id="auth-star-glow"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="#00E0BE" stopOpacity=".35" /><stop offset="1" stopColor="#00E0BE" stopOpacity="0" /></radialGradient>
        <radialGradient id="auth-end-glow"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".25" stopColor="#FFE8C4" stopOpacity=".55" /><stop offset="1" stopColor="#FFD9A0" stopOpacity="0" /></radialGradient>
      </defs>
      <g className="auth-mark-all">
        {/* the J and the I, drawn together */}
        {[J, I].map((letter, n) => (
          <g key={n}>
            <polyline points={pts(letter)} pathLength="1" className="am-line am-glow am-s" />
            <polyline points={pts(letter)} pathLength="1" className="am-line am-s" />
            {letter.map((p, i) => <Star key={i} p={p} at={reach(letter)[i]} className="am-s-star" />)}
          </g>
        ))}
        {/* the ring round them, to the end star */}
        <path d={RING_PATH} pathLength="1" className="am-line am-glow am-c" />
        <path d={RING_PATH} pathLength="1" className="am-line am-c" />
        {RING_STARS.slice(0, -1).map((p, i) => <Star key={i} p={p} at={i / (RING_STARS.length - 1)} className="am-c-star" />)}
        <g className="am-end">
          <circle cx={END[0]} cy={END[1]} r="44" fill="url(#auth-end-glow)" />
          <path d={`M${END[0] - 26} ${END[1]}H${END[0] + 26}M${END[0]} ${END[1] - 26}V${END[1] + 26}`} className="am-rays" />
          <circle cx={END[0]} cy={END[1]} r="6.5" className="am-core" />
        </g>
        {/* the arcs of light, closing when you're in */}
        {[0, 1, 2, 3, 4, 5].map(k => <path key={k} d={arc(k)} pathLength="1" className="am-arc" style={{ "--k": k }} />)}
        {/* the name, as in the logo */}
        <text x="256" y="532" textAnchor="middle" className="am-word">Jocular <tspan className="am-wise">Insights</tspan></text>
      </g>
    </svg>
  );
}

export default function SkyPanel({ progress = 0, success = false, paused = false, className = "" }) {
  const ref = useRef(null), markRef = useRef(null);
  const live = useRef({ progress, success, paused });
  live.current = { progress, success, paused };
  const kick = useRef(null);
  useEffect(() => { kick.current?.(); }, [progress, success, paused]);

  useEffect(() => {
    const cv = ref.current, mark = markRef.current;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const scene = createStarScene(cv, { reduce });
    if (!scene) return;
    let dist = 118;
    // a wide band (the phone layout) sees more sky, so the camera stands further back
    const resize = () => { scene.resize(cv.clientWidth, cv.clientHeight, Math.min(window.devicePixelRatio || 1, 2)); dist = cv.clientWidth / Math.max(1, cv.clientHeight) > 1.4 ? 185 : 118; };

    const t0 = performance.now();
    let raf = 0, last = t0, look = [0, 0], aim = [0, 0], s = 0, c = 0, ring = 0, word = 0, all = 1;
    const frame = now => {
      raf = 0;
      const { progress: pr, success: ok, paused: hold } = live.current;
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      const t = reduce ? 0 : (now - t0) / 1000;
      const k = 1 - Math.exp(-dt * 5); // smoothing toward each target
      if (reduce) { s = c = word = all = 1; ring = ok ? 1 : 0; }
      else if (ok || pr > 0) {
        // the form draws the mark: the letters, then the ring; success completes it
        const ws = ok ? 1 : c01(pr / 0.55), wc = ok ? 1 : c01((pr - 0.55) / 0.45);
        s += (ws - s) * k; c += (wc - c) * k; all += (1 - all) * k;
        word = c01((c - 0.8) / 0.2);
        if (ok) ring = Math.min(1, ring + dt / 0.7);
      } else {
        // at rest: the letters, the ring, the name; hold; fade; rest; again
        const u = (t % LOOP) / LOOP;
        s = ease(c01(u / 0.36)); c = ease(c01((u - 0.36) / 0.18)); word = c01((u - 0.54) / 0.08);
        all = u < 0.84 ? 1 : 1 - c01((u - 0.84) / 0.1);
      }
      look = reduce ? [0, 0] : [look[0] + (aim[0] - look[0]) * k, look[1] + (aim[1] - look[1]) * k];
      for (const [name, v] of [["--s", s], ["--c", c], ["--r", ring], ["--w", word], ["--all", all]]) mark.style.setProperty(name, v.toFixed(3));
      mark.style.setProperty("--px", `${(-look[0] * 9).toFixed(1)}px`);
      mark.style.setProperty("--py", `${(-look[1] * 6).toFixed(1)}px`);
      scene.render(0, t, {
        camera: panelCamera(t, look, dist),
        // the sky only: its own lines and star give way to the mark
        stages: { lines: 0, lineFade: 0, hero: 0, boost: 1, yield: 1, ring: 0, ringFade: 0, reveal: 0, vfull: 0, rimFade: 0 },
      });
      if (!hold && !reduce) raf = requestAnimationFrame(frame);
    };
    const go = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    kick.current = go;
    const point = e => { aim = [(e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1]; };
    window.addEventListener("pointermove", point, { passive: true });
    const ro = new ResizeObserver(() => { resize(); go(); });
    ro.observe(cv);
    resize(); go();
    return () => {
      kick.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", point);
      ro.disconnect();
      scene.destroy();
    };
  }, []);

  return <>
    <canvas ref={ref} className={className} aria-hidden="true" />
    <Mark markRef={markRef} />
  </>;
}
