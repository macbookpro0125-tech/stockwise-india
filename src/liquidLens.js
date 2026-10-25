// The tab bar's lens (Header.jsx BottomTabBar), as Apple's liquid glass (26 Oct
// 2026, from a screen recording of iOS 26's Phone app, after "it should look
// liquid, not glass"): a glossy capsule under the current tab at rest;
// pressed, held, or travelling to a tab, a clear drop a little bigger than
// the bar that shows the tabs under it magnified and in colour — more so
// toward its rim, as through the edge of a drop — while the real tabs under
// it are hidden. Moving fast it stretches, wider and flatter, and wobbles
// like jelly when it stops; let go, it springs onto the tab and turns back
// into the capsule. Its shape stays a capsule throughout.
//
// Drawn frame by frame here rather than by CSS transitions: the copy inside
// must stay aligned with the tabs under it at every point of a trip, and the
// stretch follows the drop's speed.

const ease = k => 1 - Math.pow(1 - k, 3);
// eases out past the end a touch, then settles
const springy = k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function createLens(nav, lens) {
  const rest = lens.querySelector(".btb-lens-rest");
  const glass = lens.querySelector(".btb-lens-glass");
  const copies = [...lens.querySelectorAll(".btb-lens-row")];
  const tabs = () => [...nav.querySelectorAll(".btb-tab")];
  const cur = { cx: null, g: 0 };
  const sp = { s: 0, v: 0, lastCx: null, lastT: 0, loop: 0, following: false };
  let anim = 0;
  let hidden = false;

  const pad = () => parseFloat(getComputedStyle(nav).paddingTop) || 0;
  const centreOf = i => { const t = tabs()[i]; return t ? t.offsetLeft + t.offsetWidth / 2 : 0; };
  const clamp = x => { const t = tabs()[0], W = t ? t.offsetWidth : 0, p = pad(); return Math.max(p + W / 2, Math.min(nav.clientWidth - p - W / 2, x)); };

  function draw() {
    const all = tabs();
    if (!all.length || cur.cx == null) return;
    const W = all[0].offsetWidth, H = nav.clientHeight, p = pad(), g = cur.g, st = sp.s;
    const w = W + 26 * g + 38 * st, h = H - 2 * p + 18 * g - 9 * st, top = (H - h) / 2, left = cur.cx - w / 2;
    lens.style.transform = `translate(${left}px, ${top}px)`;
    lens.style.width = `${w}px`;
    lens.style.height = `${h}px`;
    lens.style.zIndex = g > 0.02 ? "2" : "0";
    lens.style.opacity = hidden ? "0" : "1";
    rest.style.opacity = String(1 - g);
    glass.style.opacity = String(g);
    // the tabs under the lens, magnified around its centre (more toward the rim)
    copies.forEach((c, n) => {
      c.style.width = `${nav.clientWidth}px`;
      c.style.height = `${H}px`;
      c.style.left = `${-left}px`;
      c.style.top = `${-top}px`;
      c.style.transformOrigin = `${cur.cx}px ${H / 2}px`;
      c.style.transform = `scale(${1 + (n ? 0.34 : 0.16) * g})`;
    });
    // the real tabs under the drop are seen only through it
    const L = left + 10, R = left + w - 10, k = (1 - g).toFixed(3);
    for (const t of all) {
      if (g < 0.02 || hidden) { t.style.maskImage = t.style.webkitMaskImage = ""; continue; }
      const a = L - t.offsetLeft, b = R - t.offsetLeft;
      t.style.maskImage = t.style.webkitMaskImage = `linear-gradient(to right, #000 ${a - 6}px, rgba(0,0,0,${k}) ${a}px, rgba(0,0,0,${k}) ${b}px, #000 ${b + 6}px)`;
    }
  }

  // the stretch: a spring fed by how fast the drop moves, overshooting a little
  function wobble(now) {
    const dt = Math.max(1, now - (sp.lastT || now - 16));
    sp.lastT = now;
    const speed = sp.lastCx == null ? 0 : Math.abs(cur.cx - sp.lastCx) / dt;
    sp.lastCx = cur.cx;
    const target = Math.min(1, speed / 1.4) * cur.g;
    sp.v += (target - sp.s) * 0.22;
    sp.v *= 0.72;
    sp.s += sp.v;
    draw();
    if (sp.following || Math.abs(sp.v) > 0.0015 || Math.abs(sp.s) > 0.0015 || speed > 0.01) sp.loop = requestAnimationFrame(wobble);
    else { sp.loop = 0; sp.s = 0; sp.v = 0; sp.lastCx = null; draw(); }
  }
  const kick = () => { if (!reduced() && !sp.loop) { sp.lastT = 0; sp.loop = requestAnimationFrame(wobble); } };

  function animate(toCx, gAt, ms, path = springy) {
    cancelAnimationFrame(anim);
    if (reduced() || cur.cx == null) { cur.cx = toCx; cur.g = gAt(1); draw(); return; }
    const from = cur.cx, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      cur.cx = from + (toCx - from) * path(k);
      cur.g = gAt(k);
      draw();
      kick();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  return {
    // placed under a tab with no movement (first draw, a resize, unfolding)
    place(i) { cancelAnimationFrame(anim); hidden = i < 0; if (i >= 0) cur.cx = centreOf(i); cur.g = 0; sp.s = 0; draw(); },
    // a finger down on a tab: the drop lifts there
    lift(i) {
      hidden = false;
      const g0 = cur.g;
      animate(centreOf(i), k => g0 + (1 - g0) * ease(k), 220, cur.cx == null ? ease : springy);
    },
    // held and slid: it follows the finger exactly
    follow(x) {
      cancelAnimationFrame(anim);
      hidden = false;
      sp.following = true;
      cur.cx = clamp(x);
      cur.g = 1;
      draw();
      kick();
    },
    // let go, or the tab changed: it springs onto the tab and turns back into
    // the capsule — clear on the way if it has far to go
    drop(i) {
      sp.following = false;
      if (i < 0) { hidden = true; draw(); return; }
      hidden = false;
      const to = centreOf(i), g0 = cur.g;
      if (cur.cx == null) { this.place(i); return; }
      const far = Math.abs(to - cur.cx) > 4;
      if (!far && g0 < 0.02) { this.place(i); return; }
      animate(to, g0 > 0.5 || !far
        ? k => g0 * (1 - ease(Math.max(0, (k - 0.35) / 0.65)))
        : k => (k < 0.12 ? g0 + (1 - g0) * (k / 0.12) : k < 0.7 ? 1 : 1 - ease((k - 0.7) / 0.3)), 460);
    },
    hide() { hidden = true; cancelAnimationFrame(anim); cur.g = 0; draw(); },
    redraw: draw,
    destroy() { cancelAnimationFrame(anim); cancelAnimationFrame(sp.loop); for (const t of tabs()) t.style.maskImage = t.style.webkitMaskImage = ""; },
  };
}
