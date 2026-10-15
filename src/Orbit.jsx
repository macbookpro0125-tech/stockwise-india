import { useEffect, useRef } from "react";

// Earth seen from orbit, drawn on a canvas for the front page and the sign-in
// panel (asked for 16 Oct 2026, after a trading site's home): stars, the
// planet's lit rim, a sunrise on the horizon, city lights drifting with the
// planet's turn, and three lines of light tracing across its surface. All of
// it is drawn here, from scratch — no recorded video or image. The lines are
// decoration, not data. It pauses off-screen and in a background tab, and
// draws one still frame for anyone who asked their system for less motion.

// A small seeded random, so the scene is the same on every visit
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const LINES = [
  { seed: 11, rgb: "0,224,190", v: 0.34, x0: 0.04, x1: 0.58, delay: 0 },
  { seed: 23, rgb: "167,139,250", v: 0.16, x0: 0.42, x1: 0.97, delay: 1.8 },
  { seed: 37, rgb: "111,160,255", v: 0.52, x0: 0.22, x1: 0.84, delay: 3.4 },
];
const CYCLE = 7; // seconds: draw, hold, fade

// paused: hold the current frame (the sign-in panel's pause button)
export default function Orbit({ className = "", horizon = 0.6, paused = false }) {
  const ref = useRef(null);
  const pausedRef = useRef(paused);
  const playRef = useRef(null);
  pausedRef.current = paused;
  useEffect(() => { if (!paused) playRef.current?.(); }, [paused]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, onScreen = true;
    const start = performance.now();

    const rand = seeded(7);
    const stars = Array.from({ length: 240 }, () => ({ x: rand(), y: rand(), r: 0.3 + rand() ** 3 * 1.5, phase: rand() * 6.28, speed: 0.5 + rand() * 1.8 }));
    // City lights in clusters, on a band of the planet: u across (it wraps as
    // the planet turns), v down from the horizon
    const clusters = Array.from({ length: 26 }, () => ({ u: rand(), v: 0.06 + rand() * 0.86, spread: 0.008 + rand() * 0.05, n: 8 + Math.floor(rand() * 46) }));
    const lights = clusters.flatMap(c => Array.from({ length: c.n }, () => ({
      u: c.u + (rand() - 0.5) * c.spread * 2,
      v: Math.min(0.98, Math.max(0.03, c.v + (rand() - 0.5) * c.spread * 1.6)),
      b: 0.3 + rand() * 0.7, phase: rand() * 6.28,
    })));
    // Each line of light: a smooth random walk
    const walks = LINES.map(l => {
      const r = seeded(l.seed);
      let y = 0, vel = 0;
      return Array.from({ length: 140 }, () => { vel = vel * 0.85 + (r() - 0.49) * 0.9; y += vel; return y; });
    });

    // The planet is a circle far larger than the view; its top edge is the horizon
    const geo = () => {
      const R = Math.max(w * 1.3, h * 1.7);
      return { R, cx: w / 2, cy: h * horizon + R };
    };
    const horizonY = (x, g) => g.cy - Math.sqrt(Math.max(0, g.R * g.R - (x - g.cx) ** 2));
    // A point on the surface: foreshortened near the horizon, spreading wider
    // as it comes toward the viewer
    const surface = (u, v, g) => {
      const x = g.cx + (u - 0.5) * w * 1.35 * (1 + v * 0.35);
      const yh = horizonY(x, g);
      return [x, yh + (h - yh) * Math.pow(v, 1.55)];
    };

    const draw = t => {
      if (w < 8 || h < 8) return; // not laid out yet, or closing
      const g = geo();
      const hy = g.cy - g.R; // horizon height at the centre
      ctx.clearRect(0, 0, w, h);

      // Space
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, "#03040A");
      sky.addColorStop(1, "#0A1024");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Stars, above the horizon, twinkling
      for (const s of stars) {
        const x = s.x * w, y = s.y * hy * 1.02;
        if (y > horizonY(x, g) - 4) continue;
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(220,230,255,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
      }

      // The atmosphere: a soft blue-teal glow around the rim
      const atmo = ctx.createRadialGradient(g.cx, g.cy, Math.max(0, g.R - 40), g.cx, g.cy, g.R + 110);
      atmo.addColorStop(0, "rgba(40,140,255,0)");
      atmo.addColorStop(40 / 150, "rgba(90,190,255,0.55)");
      atmo.addColorStop(52 / 150, "rgba(0,224,190,0.22)");
      atmo.addColorStop(1, "rgba(30,90,200,0)");
      ctx.fillStyle = atmo;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R + 110, 0, 6.283); ctx.fill();

      // The planet's night side
      const ground = ctx.createRadialGradient(g.cx, hy, 10, g.cx, hy + h * 0.5, Math.max(w, h));
      ground.addColorStop(0, "#14305A");
      ground.addColorStop(0.18, "#0B1A36");
      ground.addColorStop(0.6, "#050A16");
      ground.addColorStop(1, "#02040A");
      ctx.save();
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, 0, 6.283); ctx.clip();
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, w, h);

      // Daylight spilling over the horizon near the sunrise
      const day = ctx.createRadialGradient(g.cx + w * 0.03, hy, 0, g.cx + w * 0.03, hy, w * 0.42);
      day.addColorStop(0, "rgba(120,200,255,0.55)");
      day.addColorStop(0.35, "rgba(40,110,200,0.22)");
      day.addColorStop(1, "rgba(10,30,80,0)");
      ctx.fillStyle = day;
      ctx.fillRect(0, 0, w, h);

      // City lights, turning slowly with the planet
      const turn = t * 0.006;
      for (const l of lights) {
        const u = (((l.u + turn) % 1) + 1) % 1;
        const edge = Math.min(1, u * 6, (1 - u) * 6); // fade where they wrap
        const [x, y] = surface(u, l.v, g);
        const a = l.b * edge * (0.75 + 0.25 * Math.sin(t * 1.3 + l.phase)) * (0.45 + l.v * 0.75);
        if (a < 0.03) continue;
        const r = 0.5 + l.v * 1.3;
        ctx.fillStyle = `rgba(255,${190 + Math.round(l.b * 40)},120,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }

      // Lines of light, each drawn across the surface, held, then faded
      LINES.forEach((l, i) => {
        const local = (t - l.delay) % CYCLE;
        if (local < 0) return;
        const progress = Math.min(1, local / 2.6);
        const fade = local < 4.6 ? 1 : Math.max(0, 1 - (local - 4.6) / 1.2);
        if (fade <= 0) return;
        const pts = walks[i];
        const n = Math.max(2, Math.floor(pts.length * progress));
        const path = new Path2D();
        let head = null;
        for (let k = 0; k < n; k++) {
          const u = l.x0 + (l.x1 - l.x0) * (k / (pts.length - 1));
          const [x, y] = surface(u, Math.min(0.95, Math.max(0.02, l.v + pts[k] * 0.006)), g);
          if (k === 0) path.moveTo(x, y); else path.lineTo(x, y);
          head = [x, y];
        }
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        for (const [width, alpha] of [[9, 0.07], [4, 0.18], [1.6, 0.95]]) {
          ctx.strokeStyle = `rgba(${l.rgb},${(alpha * fade).toFixed(3)})`;
          ctx.lineWidth = width;
          ctx.stroke(path);
        }
        if (head && progress < 1) {
          const glow = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 16);
          glow.addColorStop(0, `rgba(${l.rgb},${0.9 * fade})`);
          glow.addColorStop(1, `rgba(${l.rgb},0)`);
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(head[0], head[1], 16, 0, 6.283); ctx.fill();
        }
      });
      ctx.restore();

      // The thin bright rim
      ctx.strokeStyle = "rgba(170,225,255,0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.R, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();

      // The sunrise: a glow and a lens streak on the horizon, breathing slowly
      const sx = g.cx + w * 0.03, sy = hy - 2;
      const pulse = 0.9 + 0.1 * Math.sin(t * 0.7);
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.min(w, h) * 0.38);
      sun.addColorStop(0, `rgba(255,255,255,${0.95 * pulse})`);
      sun.addColorStop(0.06, `rgba(255,240,215,${0.75 * pulse})`);
      sun.addColorStop(0.25, `rgba(255,190,120,${0.22 * pulse})`);
      sun.addColorStop(1, "rgba(255,160,90,0)");
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(sx, sy, Math.min(w, h) * 0.38, 0, 6.283); ctx.fill();
      ctx.save();
      ctx.translate(sx, sy); ctx.scale(5.5, 0.16);
      const streak = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
      streak.addColorStop(0, `rgba(255,250,240,${0.85 * pulse})`);
      streak.addColorStop(1, "rgba(255,220,180,0)");
      ctx.fillStyle = streak;
      ctx.beginPath(); ctx.arc(0, 0, 90, 0, 6.283); ctx.fill();
      ctx.restore();
    };

    const frame = now => {
      raf = 0;
      if (!onScreen || document.hidden || pausedRef.current) return;
      draw((now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };
    const play = () => { if (!still && !raf && onScreen && !document.hidden && !pausedRef.current) raf = requestAnimationFrame(frame); };
    playRef.current = play;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(4.2); // one still frame, the lines drawn
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; play(); });
    io.observe(canvas);
    const vis = () => play();
    document.addEventListener("visibilitychange", vis);
    play();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [horizon]);

  return <canvas ref={ref} className={`orbit ${className}`} aria-hidden="true" />;
}
