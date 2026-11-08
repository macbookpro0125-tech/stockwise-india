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
// Moved by springs (8 Nov 2026, "iOS 26 liquid glass" brief): one for where
// it is, one for how much of a drop it is, one for its stretch. A new tab
// mid-trip only moves the target, so it turns from where it is at the speed
// it has — tapped fast across the bar it never jumps or restarts — and a
// finger's slide hands its speed on when let go. How clear it is follows how
// far it still has to go, so it lifts as it leaves and settles as it lands.
//
// Drawn frame by frame here rather than by CSS transitions: the copy inside
// must stay aligned with the tabs under it at every point of a trip, and the
// stretch follows the drop's speed.

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Apple's two numbers for a spring: response (s, how quickly it gets there)
// and damping (1 = no overshoot)
const spring = (response, damping) => ({ k: (2 * Math.PI / response) ** 2, c: 4 * Math.PI * damping / response });
const MOVE = spring(0.3, 0.82); // the trip: ~250–300 ms, a hair of overshoot
const CLEAR = spring(0.2, 1); // capsule ↔ drop
const STRETCH = spring(0.24, 0.55); // the jelly

function step(s, target, cfg, dt) {
  const a = -cfg.k * (s.x - target) - cfg.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

export function createLens(nav, lens) {
  const rest = lens.querySelector(".btb-lens-rest");
  const glass = lens.querySelector(".btb-lens-glass");
  const copies = [...lens.querySelectorAll(".btb-lens-row")];
  const tabs = () => [...nav.querySelectorAll(".btb-tab")];
  const pos = { x: null, v: 0 }; // its centre, px from the bar's left; px/s
  const clear = { x: 0, v: 0 }; // 0 the capsule, 1 the drop
  const st = { x: 0, v: 0 }; // stretch
  let to = null; // the tab's centre it's going to
  let trip = 1; // how far this trip is, for how clear it is on the way
  let held = false; // a finger is down: a drop whatever its distance
  let following = false; // a finger is sliding it
  let hidden = false;
  let loop = 0, last = 0;

  const pad = () => parseFloat(getComputedStyle(nav).paddingTop) || 0;
  const centreOf = i => { const t = tabs()[i]; return t ? t.offsetLeft + t.offsetWidth / 2 : 0; };
  const clamp = x => { const t = tabs()[0], W = t ? t.offsetWidth : 0, p = pad(); return Math.max(p + W / 2, Math.min(nav.clientWidth - p - W / 2, x)); };

  function draw() {
    const all = tabs();
    if (!all.length || pos.x == null) return;
    const W = all[0].offsetWidth, H = nav.clientHeight, p = pad();
    const g = Math.max(0, Math.min(1, clear.x)), s = Math.max(-0.4, Math.min(1, st.x));
    const w = W + 24 * g + 30 * s, h = H - 2 * p + 16 * g - 7 * s, top = (H - h) / 2, left = pos.x - w / 2;
    lens.style.transform = `translate3d(${left}px, ${top}px, 0)`;
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
      c.style.transformOrigin = `${pos.x}px ${H / 2}px`;
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

  // how much of a drop it should be now: all of one under a finger, else
  // as much as it has still to travel (a short hop stays mostly capsule)
  const clearTarget = () => {
    if (held || following) return 1;
    if (to == null) return 0;
    const W = tabs()[0]?.offsetWidth || 1;
    return Math.min(1, Math.abs(to - pos.x) / Math.min(trip, W * 0.55)) * Math.min(1, trip / (W * 0.5));
  };

  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now - 16)) / 1000);
    last = now;
    // small fixed steps keep the springs steady on a slow frame
    for (let n = Math.ceil(dt / 0.004), h = dt / n; n > 0; n--) {
      if (!following && to != null) step(pos, to, MOVE, h);
      step(clear, clearTarget(), CLEAR, h);
      step(st, Math.min(1, Math.abs(pos.v) / 1500) * Math.max(0, clear.x), STRETCH, h);
    }
    draw();
    const settled = !following && (to == null || (Math.abs(pos.x - to) < 0.3 && Math.abs(pos.v) < 4))
      && Math.abs(clear.x - clearTarget()) < 0.002 && Math.abs(clear.v) < 0.02 && Math.abs(st.x) < 0.002 && Math.abs(st.v) < 0.02;
    if (settled) {
      if (to != null) pos.x = to;
      pos.v = 0; clear.x = clearTarget(); clear.v = 0; st.x = 0; st.v = 0;
      draw();
      loop = 0; last = 0;
      return;
    }
    loop = requestAnimationFrame(frame);
  }
  const run = () => {
    if (reduced()) {
      // no travel: it's simply there, as the capsule
      if (to != null) pos.x = to;
      pos.v = 0; clear.x = held || following ? 1 : 0; clear.v = 0; st.x = 0; st.v = 0;
      draw();
      return;
    }
    if (!loop) { last = 0; loop = requestAnimationFrame(frame); }
  };
  const aim = i => {
    const t = centreOf(i);
    if (pos.x == null) pos.x = t;
    // a new trip measures from where it is now, not where it set off
    if (t !== to) trip = Math.max(1, Math.abs(t - pos.x));
    to = t;
  };

  return {
    // placed under a tab with no movement (first draw, a resize, unfolding)
    place(i) {
      cancelAnimationFrame(loop); loop = 0;
      hidden = i < 0; held = following = false;
      if (i >= 0) { to = pos.x = centreOf(i); }
      pos.v = 0; clear.x = clear.v = 0; st.x = st.v = 0;
      draw();
    },
    // a finger down on a tab: the drop lifts there
    lift(i) { hidden = false; held = true; following = false; aim(i); run(); },
    // held and slid: it follows the finger exactly, and keeps its speed
    follow(x) {
      hidden = false; held = true;
      const now = performance.now(), nx = clamp(x);
      if (following && pos.x != null && this._t) {
        const dt = Math.max(0.008, (now - this._t) / 1000);
        pos.v = pos.v * 0.4 + ((nx - pos.x) / dt) * 0.6;
      } else pos.v = 0;
      this._t = now;
      following = true;
      pos.x = nx; to = nx;
      run();
    },
    // let go, or the tab changed: it springs onto the tab — carrying the
    // finger's speed — and turns back into the capsule as it lands
    drop(i) {
      following = false; held = false; this._t = 0;
      if (i < 0) { hidden = true; draw(); return; }
      hidden = false;
      if (pos.x == null) { this.place(i); return; }
      aim(i);
      run();
    },
    hide() { hidden = true; held = following = false; cancelAnimationFrame(loop); loop = 0; clear.x = clear.v = 0; st.x = st.v = 0; draw(); },
    redraw: draw,
    destroy() { cancelAnimationFrame(loop); loop = 0; for (const t of tabs()) t.style.maskImage = t.style.webkitMaskImage = ""; },
  };
}
