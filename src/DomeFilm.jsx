import { useEffect, useRef } from "react";
import "@fontsource-variable/bodoni-moda/opsz.css";
import "@fontsource-variable/bodoni-moda/opsz-italic.css";
import domeUrl from "./assets/dome.webp";
import domeMidUrl from "./assets/dome-mid.webp";
import domeStarUrl from "./assets/dome-star.webp";
import { Logo } from "./site.jsx";
import "./dome-film.css";

// The top of the signed-out front page (16 Oct 2026): a scroll film, ported
// from stockwise-scroll/source/film.html. A sticky full-screen stage holds a
// canvas: a planetarium dome of stars that the camera pushes into, one star
// brightening until its light fills the frame and becomes the page. Captions
// fade in and out at set points in the scroll. The drawing code is the film's
// own, unchanged: at scroll 0 the canvas shows the picture exactly as it is.
// The light it ends in (#fff7ea) fades into the page below (.df-handoff).
// Brought in line with Apple's guidance (16 Oct 2026): a local-nav bar that
// frosts once the film moves, press feedback, size-specific type, and a still
// camera for anyone who asked their system for less motion.
// On large screens two sharper close-ups (LAYERS) fade in as the camera zooms,
// so the picture stays crisp instead of showing its pixels.
// The earlier story (CinematicStory.jsx + story-colours.css) is kept, unused.

// The source frame and the star it converges on (measured: 38.7% across, 11.9% down)
const IW = 1672, IH = 941, DX = 647, DY = 112, ZEND = 4.4, VOID = "#05060a";
// Sharper close-ups of the part of the dome the camera moves into, cut from a
// 4× upscale (scripts/make-dome-layers.mjs). Each rectangle is in the picture's
// own pixels; it is drawn over the picture in exactly the same place and faded
// in as the zoom passes z0 → z1, so the first frame is the picture alone. A
// screen loads one only if full zoom would stretch the picture past `need`
// screen px per picture px, so phones never fetch them.
const LAYERS = [
  { url: domeMidUrl, sx: 127, sy: 0, sw: 1305, sh: 941, z0: 1.3, z1: 1.6, need: 2.5 },
  { url: domeStarUrl, sx: 346, sy: 0, sw: 686, sh: 433, z0: 2.5, z1: 2.8, need: 4.5 },
];

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const c01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const seg = (p, a, b) => ease(c01((p - a) / (b - a)));
const f = n => n.toFixed(4);

const Arrow = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// The captions carry no figures (asked 16 Oct 2026: no numbers on this page)
export default function DomeFilm({ onJoin, onLogin }) {
  const trackRef = useRef(null), stageRef = useRef(null), canvasRef = useRef(null);
  const barRef = useRef(null), cueRef = useRef(null), capsRef = useRef([]);
  const cap = i => el => { capsRef.current[i] = el; };

  useEffect(() => {
    const track = trackRef.current, stage = stageRef.current, cv = canvasRef.current;
    const ctx = cv.getContext("2d", { alpha: false });
    const off = document.createElement("canvas"), octx = off.getContext("2d");
    const caps = capsRef.current.filter(Boolean);
    const cue = cueRef.current, bar = barRef.current;
    const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let cw, ch, dpr, s0, bx, by, Px, Py, D0x, D0y;
    const img = new Image();
    let bloom = null, ready = false, disposed = false;
    const layers = LAYERS.map(l => ({ ...l, img: null, asked: false }));
    // Fetch the close-ups this screen needs, once the picture itself is up.
    // The camera never moves for less motion, so nothing to sharpen there.
    function loadLayers() {
      if (!ready || reduce) return;
      const most = ZEND * s0 * dpr;
      for (const l of layers) {
        if (l.asked || most <= l.need) continue;
        l.asked = true;
        const im = new Image();
        im.decoding = "async";
        im.src = l.url;
        im.decode().then(() => { if (disposed) return; l.img = im; if (onScreen) draw(p); }).catch(() => {}); // the picture alone still works
      }
    }

    function makeBloom() { // only the existing stars glow: bright points, warm tint, soft blur
      const w = Math.round(IW / 3), h = Math.round(IH / 3);
      const a = document.createElement("canvas"); a.width = w; a.height = h;
      const ax = a.getContext("2d"); ax.drawImage(img, 0, 0, w, h);
      const d = ax.getImageData(0, 0, w, h), px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
        const k = Math.pow(Math.max(0, (l - 0.30) / 0.70), 0.85);
        px[i] = 255 * k; px[i + 1] = 226 * k; px[i + 2] = 182 * k; px[i + 3] = 255;
      }
      ax.putImageData(d, 0, 0);
      const b1 = document.createElement("canvas"); b1.width = Math.round(w / 3); b1.height = Math.round(h / 3);
      const c1 = b1.getContext("2d"); c1.imageSmoothingQuality = "high"; c1.drawImage(a, 0, 0, b1.width, b1.height);
      const out = document.createElement("canvas"); out.width = w; out.height = h;
      const oc = out.getContext("2d"); oc.imageSmoothingQuality = "high";
      oc.drawImage(a, 0, 0); oc.globalCompositeOperation = "lighter"; oc.globalAlpha = 0.9; oc.drawImage(b1, 0, 0, w, h);
      return out;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = stage.clientWidth; ch = stage.clientHeight;
      cv.width = off.width = Math.round(cw * dpr); cv.height = off.height = Math.round(ch * dpr);
      s0 = Math.min(cw / IW, ch / IH); // contain: the untouched frame at rest
      bx = (cw - IW * s0) / 2; by = (ch - IH * s0) / 2;
      if (ch > cw) by = Math.min(by, ch * 0.16); // phones: sit the frame high, captions live in the space below
      D0x = bx + DX * s0; D0y = by + DY * s0;
      // zoom about one fixed pivot so the star lands at screen centre at ZEND; a pure zoom
      // about a point inside the frame never shows anything outside the picture
      Px = (ZEND * D0x - cw / 2) / (ZEND - 1); Py = (ZEND * D0y - ch / 2) / (ZEND - 1);
      const L = Math.max(0, bx), T = Math.max(0, by), R = Math.min(cw, bx + IW * s0), B = Math.min(ch, by + IH * s0);
      Px = Math.min(R, Math.max(L, Px)); Py = Math.min(B, Math.max(T, Py));
      loadLayers(); // a window made larger may now need them
    }

    function feather(ix, iy, iw, ih) { // letterboxed screens only: blend the frame edge into the night
      const E = [[iy, iy, 0, 1], [ch - (iy + ih), iy + ih, 0, -1], [ix, ix, 1, 1], [cw - (ix + iw), ix + iw, 1, -1]];
      for (let k = 0; k < 4; k++) {
        const gap = E[k][0]; if (gap <= 2) continue;
        const at = E[k][1], hz = E[k][2], dir = E[k][3], fw = Math.min(gap * 0.9, (hz ? iw : ih) * 0.10, 120);
        const g = hz ? ctx.createLinearGradient(at, 0, at + dir * fw, 0) : ctx.createLinearGradient(0, at, 0, at + dir * fw);
        g.addColorStop(0, "rgba(5,6,10,1)"); g.addColorStop(1, "rgba(5,6,10,0)");
        ctx.fillStyle = g;
        if (hz) ctx.fillRect(dir > 0 ? at : at - fw, 0, fw, ch); else ctx.fillRect(0, dir > 0 ? at : at - fw, cw, fw);
      }
    }

    function draw(p) {
      if (!ready) return;
      // Less motion asked for: the camera holds still (a full-screen push is the
      // movement that unsettles most) and the light still grows in place
      const z = reduce ? 1 : 1 + (ZEND - 1) * ease(p), tx = Px * (1 - z), ty = Py * (1 - z);
      const ix = tx + z * bx, iy = ty + z * by, iw = IW * s0 * z, ih = IH * s0 * z;
      const dx = Px + z * (D0x - Px), dy = Py + z * (D0y - Py);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.fillStyle = VOID; ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, ix, iy, iw, ih);
      for (const l of layers) { // the sharper close-ups, in the picture's own place
        const a = l.img ? c01((z - l.z0) / (l.z1 - l.z0)) : 0;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(l.img, ix + l.sx * s0 * z, iy + l.sy * s0 * z, l.sw * s0 * z, l.sh * s0 * z);
      }
      ctx.globalAlpha = 1;
      feather(ix, iy, iw, ih);
      const minD = Math.min(cw, ch), diag = Math.hypot(cw, ch);

      const sp = seg(p, 0.10, 0.80); // the stars around it pick up the glow, spreading outward
      if (sp > 0.001) {
        octx.setTransform(dpr, 0, 0, dpr, 0, 0);
        octx.globalCompositeOperation = "source-over"; octx.globalAlpha = 1;
        octx.clearRect(0, 0, cw, ch); octx.imageSmoothingQuality = "high";
        octx.drawImage(bloom, ix, iy, iw, ih);
        octx.globalCompositeOperation = "destination-in";
        const r = minD * 0.06 + diag * 1.05 * sp, g = octx.createRadialGradient(dx, dy, 0, dx, dy, r);
        g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.55, "rgba(0,0,0,0.85)"); g.addColorStop(1, "rgba(0,0,0,0)");
        octx.fillStyle = g; octx.fillRect(0, 0, cw, ch);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "screen"; ctx.globalAlpha = Math.min(1, sp * 1.25);
        ctx.drawImage(off, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
      }
      const gp = seg(p, 0.03, 0.88); // the star itself brightens in warm white and champagne
      if (gp > 0.0005) {
        ctx.globalCompositeOperation = "screen";
        const rr = minD * 0.025 + diag * 1.25 * gp, h = ctx.createRadialGradient(dx, dy, 0, dx, dy, rr), core = Math.min(1, 0.25 + gp * 1.2);
        h.addColorStop(0, "rgba(255,255,255," + f(core) + ")");
        h.addColorStop(0.06, "rgba(255,248,236," + f(core * 0.85) + ")");
        h.addColorStop(0.22, "rgba(255,232,196," + f(0.75 * gp) + ")");
        h.addColorStop(0.48, "rgba(255,214,160," + f(0.42 * gp) + ")");
        h.addColorStop(1, "rgba(255,205,150,0)");
        ctx.fillStyle = h; ctx.fillRect(0, 0, cw, ch);
      }
      const vp = seg(p, 0.62, 1.0); // light fills the frame and becomes the page
      if (vp > 0.0005) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255,247,234," + f(vp) + ")"; ctx.fillRect(0, 0, cw, ch);
      }
      ctx.globalCompositeOperation = "source-over";
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
        if (!reduce) el.firstElementChild.style.transform = "translateY(" + ((p - h) * -40).toFixed(1) + "px)";
      }
      cue.style.opacity = p < 0.015 ? 1 : 0;
      // the bar frosts once the film moves, and turns light when the captions do
      bar.classList.toggle("df-bar-on", p > 0.004);
      bar.classList.toggle("df-bar-light", p > 0.45);
    }

    // scroll → progress, time-based smoothing so flicks glide and throttled tabs still converge
    let p = 0, target = 0, raf = 0, last = 0, onScreen = true;
    const readTarget = () => {
      const max = track.offsetHeight - stage.clientHeight;
      target = max > 0 ? c01(-track.getBoundingClientRect().top / max) : 0;
    };
    function tick(now) {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.5) || 0.016; last = now;
      const d = target - p;
      if (reduce || Math.abs(d) < 0.0004) p = target; else p += d * (1 - Math.exp(-dt * 14));
      draw(p); captions(p);
      if (p !== target && onScreen) raf = requestAnimationFrame(tick); // stops once caught up
    }
    const kick = () => {
      if (!onScreen) return; // off screen: nothing to redraw until it's back
      readTarget();
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    const onResize = () => { resize(); readTarget(); if (onScreen) { draw(p); captions(p); } };

    img.onload = () => { bloom = makeBloom(); ready = true; resize(); readTarget(); p = target; draw(p); captions(p); };
    img.src = domeUrl;
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", onResize);
    const io = new IntersectionObserver(entries => {
      onScreen = entries[entries.length - 1].isIntersecting; // the latest, when a jump queues two
      if (onScreen) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    });
    io.observe(track);
    resize(); readTarget(); captions(target);

    return () => {
      disposed = true;
      img.onload = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, []);


  return (
    <>
      <section ref={trackRef} className="df-track" aria-label="Stockwise India">
        <div ref={stageRef} className="df-stage">
          <canvas ref={canvasRef} className="df-film" role="img" aria-label="A visitor in a planetarium looks up at a dome of stars joined by gold constellation lines. The camera pushes toward the brightest star until its light fills the screen." />

          <div ref={barRef} className="df-bar">
            <Logo />
            <button type="button" className="df-signin" onClick={onLogin}>Sign in</button>
          </div>

          <div ref={cap(0)} className="df-cap df-dk df-open" data-in="-0.05" data-hold="0.02" data-out="0.10"><div className="df-ci">
            <p className="df-eb">NSE · Fundamental research</p>
            <h1>Stock<i>wise</i> India</h1>
            <p>Find great businesses. Invest with clarity.</p>
            <button type="button" className="df-btn df-btn-glow" onClick={onJoin}>Create free account<Arrow /></button>
          </div></div>

          <div ref={cap(1)} className="df-cap df-dk df-left" data-in="0.13" data-hold="0.20" data-out="0.27"><div className="df-ci">
            <h2>Every NSE company.<br /><i>One night sky.</i></h2>
            <p>Every NSE-listed business, read from its own filings.</p>
          </div></div>

          <div ref={cap(2)} className="df-cap df-dk df-right" data-in="0.30" data-hold="0.37" data-out="0.44"><div className="df-ci">
            <h2>Strategies draw<br /><i>the lines.</i></h2>
            <p>Ready-made screens connect the companies worth a closer look.</p>
          </div></div>

          <div ref={cap(3)} className="df-cap df-lt df-left" data-in="0.47" data-hold="0.54" data-out="0.61"><div className="df-ci">
            <h2>Then one star,<br /><i>scored.</i></h2>
            <p>A hundred points across six areas, with every check explained.</p>
          </div></div>

          <div ref={cap(4)} className="df-cap df-lt df-right" data-in="0.64" data-hold="0.72" data-out="0.80"><div className="df-ci">
            <h2>Then, a<br /><i>fair price.</i></h2>
            <p>Five valuation methods side by side, even when they disagree.</p>
          </div></div>

          <div ref={cap(5)} className="df-cap df-lt df-center" data-in="0.86" data-hold="0.95" data-out="1.2"><div className="df-ci">
            <p className="df-eb">Stockwise India</p>
            <h2 className="df-h1">See the market <i>clearly.</i></h2>
            <p>Quality NSE companies and their fair value. Free during early access.</p>
            <div className="df-actions">
              <button type="button" className="df-btn df-btn-ink" onClick={onJoin}>Create free account<Arrow /></button>
              <button type="button" className="df-btn df-btn-line" onClick={onLogin}>Sign in</button>
            </div>
          </div></div>

          <div ref={cueRef} className="df-cue" aria-hidden="true">Scroll</div>
        </div>
      </section>
      {/* The film ends on its light; this fades it into the page, in either theme */}
      <div className="df-handoff" aria-hidden="true" />
    </>
  );
}
