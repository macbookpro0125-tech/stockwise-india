// The phone tab bar's lens (Header.jsx BottomTabBar), matched to a screen
// recording of iOS 26's own tab bar (9 Nov 2026, "do it until it matches
// exactly"), measured frame by frame at 3x:
//
// - at rest, a soft grey capsule under the selected tab, 3.9px in from the
//   bar's top and bottom and never closer than 4.3px to its ends;
// - a finger down on a tab: the capsule sets off for it at once; ~50ms in it
//   lifts into a clear, bright drop 1.4 tab slots wide, whose rim bends and splits
//   the tabs under it into colour, and the whole bar swells ~3% and settles;
// - the trip is one spring, damping 0.9, response 0.331s (the recording's
//   path, fitted to within 2px at 3x): 90% there in ~180ms, no overshoot;
// - fast, the drop is flatter; slowing, it bunches up taller; pinned against
//   an end of the bar it squashes rather than leave it;
// - from ~175ms it shrinks, still clear; ~272ms after the touch (or 110ms
//   after letting go, if held longer) it lands, back to the grey capsule,
//   dipping a little below its size before it settles.
//
// One frame loop draws it all, so a new tab mid-trip only moves the target —
// it turns from where it is at the speed it has, never jumping. The drop is
// clear glass (9 Nov 2026, "theirs is liquid, ours is plain"): the page
// shows through it, frosting over only at speed; over the tabs it lays its
// own copy of them — in place at its middle, bent outward and split into
// colour at its rim — and the real tabs are cut away beneath it. Drawn here
// rather than by CSS transitions so that copy stays aligned with the tabs at
// every point of a trip.

import { createRimLens } from "./rimLens.js";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Apple's two numbers for a spring: response (s) and damping (1 = no overshoot)
const spring = (response, damping) => ({ k: (2 * Math.PI / response) ** 2, c: 4 * Math.PI * damping / response, w: 2 * Math.PI / response });
const MOVE = spring(0.331, 0.9);
const LIFT = spring(0.07, 1); // capsule ↔ drop in about two frames
// the drop's size: grows from the touch, and shrinks back from 175ms with a
// small wobble below the capsule's size (both fitted to the recording)
const GROW = spring(0.3, 0.8);
const SHRINK = spring(0.433, 0.66);
// its height wobbles like jelly: flatter at speed, taller as it slows, a
// little flat again (~100ms, ~200ms, ~300ms in the recording)
const JELLY = spring(0.2, 0.35);

const LIFT_AFTER = 50; // ms from the touch to the drop
const LAND_AFTER = 272; // ms from the touch to landing, for a tap
const LAND_HELD = 110; // ms from letting go, when held longer
const SHRINK_AFTER = 175; // ms from the touch to the drop starting to shrink
const SHRINK_HELD = 10;
const DROP = 1.4; // the drop's width, in tab slots — the same size from any tab
const PULSE = 0.028; // how much the bar swells

// iOS's layout of the tabs, measured: equal slots 4.3px in from the bar's ends;
// each tab's capsule as wide as its label + 45.6px and at least a slot + 3.5px;
// an end tab whose capsule would cross the 4.3px moves inward with it
export const EDGE = 4.3;
const CAP_PAD = 45.6;
const CAP_MIN = 3.5;
const CAP_INSET = 3.9;

function step(s, target, cfg, dt) {
  const a = -cfg.k * (s.x - target) - cfg.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return a;
}
const easeOut = k => 1 - (1 - k) ** 3;
// the bar's swell: up in 65ms, back down over 150ms
const pulseAt = t => (t <= 0 ? 0 : t < 65 ? easeOut(t / 65) : t < 215 ? 0.5 * (1 + Math.cos(Math.PI * (t - 65) / 150)) : 0);

export function createLens(nav, lens, top) {
  const rest = lens.querySelector(".btb-lens-rest");
  const glass = lens.querySelector(".btb-lens-glass");
  const rows = [...top.querySelectorAll(".btb-lens-row")];
  const tabs = () => [...nav.querySelectorAll(".btb-tab")];
  const now = () => performance.now();
  // the rim's lens (rimLens.js): drawn again when the open tab or the theme changes
  const canvas = top.querySelector(".btb-lens-canvas");
  const rim = canvas ? createRimLens(nav, canvas) : null;
  const theme = typeof MutationObserver !== "undefined" ? new MutationObserver(() => rim?.build()) : null;
  theme?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });

  let geo = null; // { W, H, centres[], caps[], slot }
  const pos = { x: null, v: 0 };
  const lift = { x: 0, v: 0 };
  const sw = { x: null, v: 0 }, sh = { x: null, v: 0 }; // the lens's width and height, px
  let to = null;
  let pressedAt = null, releasedAt = null, lastPress = null, following = false, hidden = false, followT = 0;
  let speedNow = 0; // 0 still, 1 a hop's top speed
  let settleNow = 0; // 0 lifted, 1 greyed back toward the capsule (before it lands)
  let loop = 0, last = 0;

  // where each tab's icon and capsule sit, as iOS lays them out
  function layout() {
    const all = tabs();
    if (!all.length || !nav.clientWidth) return;
    const W = nav.clientWidth, H = nav.clientHeight;
    const slot = (W - 2 * EDGE) / all.length;
    const centres = [], caps = [];
    all.forEach((t, i) => {
      const label = t.querySelector(".btb-label");
      const lw = label ? label.scrollWidth : 0;
      const cap = Math.max(slot + CAP_MIN, lw + CAP_PAD);
      const home = EDGE + slot * (i + 0.5);
      const c = Math.min(W - EDGE - cap / 2, Math.max(EDGE + cap / 2, home));
      centres.push(c); caps.push(cap);
      const shift = `${(c - home).toFixed(2)}px 0`;
      t.style.translate = shift;
      for (const r of rows) { const copy = r.children[i]; if (copy) copy.style.translate = shift; }
    });
    for (const r of rows) { r.style.width = `${W}px`; r.style.height = `${H}px`; }
    geo = { W, H, centres, caps, slot };
    rim?.build();
  }
  const capAt = x => {
    const { centres, caps } = geo;
    if (x <= centres[0]) return caps[0];
    for (let i = 0; i < centres.length - 1; i++) {
      if (x <= centres[i + 1]) { const k = (x - centres[i]) / (centres[i + 1] - centres[i]); return caps[i] + (caps[i + 1] - caps[i]) * k; }
    }
    return caps[caps.length - 1];
  };
  const clampX = x => Math.max(geo.centres[0], Math.min(geo.centres[geo.centres.length - 1], x));

  function draw() {
    if (!geo || pos.x == null) return;
    const { W, H } = geo;
    const g = Math.max(0, Math.min(1, lift.x));
    const w = sw.x ?? capAt(pos.x), h = sh.x ?? H - 2 * CAP_INSET;
    // pinned against an end, it squashes rather than leave the bar
    const L = Math.max(EDGE, pos.x - w / 2), R = Math.min(W - EDGE, pos.x + w / 2);
    const y = (H - h) / 2;
    // the capsule and the drop's glass under the tabs; its view of the tabs
    // over them — placed by left/top, not on a layer of its own, so it lines
    // up with the real tabs to the pixel
    lens.style.transform = `translate3d(${L}px, ${y}px, 0)`;
    for (const el of [lens, top]) { el.style.width = `${Math.max(0, R - L)}px`; el.style.height = `${h}px`; }
    top.style.left = `${L}px`;
    top.style.top = `${y}px`;
    // (nearly landed, the bending is too slight to see: the real tabs again)
    const up = !hidden && g >= 0.06;
    lens.style.opacity = hidden ? "0" : "1";
    // as it shrinks it greys back toward the capsule, before it lands (the
    // recording's drop is grey through the middle by ~235ms)
    rest.style.opacity = String(Math.max(1 - g, settleNow));
    glass.style.opacity = String(g * (1 - 0.6 * settleNow));
    // milky white while it's moving fast, clearing as it slows so the page
    // shows faintly through it (the recording: white to ~135ms, the page
    // coming through from ~165ms)
    const frost = Math.min(1, 0.15 + 1.5 * speedNow);
    glass.style.setProperty("--frost", frost.toFixed(3));
    // lifted, the tabs under the drop are drawn by it: in place at its middle
    // and bent outward toward its rim (each colour a little more than the
    // last), so the real ones are cut away there
    top.style.visibility = up ? "visible" : "hidden";
    top.style.setProperty("--g", g.toFixed(3));
    if (up) rim?.draw(L, R, y, h, g);
    const cx = (L + R) / 2;
    for (const r of rows) {
      r.style.left = `${-L}px`;
      r.style.top = `${-y}px`;
      r.style.transformOrigin = `${cx}px ${H / 2}px`;
      r.style.transform = `scale(${1 + (Number(r.dataset.k) || 0) * g})`;
    }
    // (the tab's drawing only: the button itself stays whole, so a finger
    // lifted over the drop still taps it)
    const rr = h / 2;
    for (const t of tabs()) {
      const face = t.querySelector(".btb-face") || t;
      if (!up) { if (face.style.clipPath) face.style.clipPath = ""; continue; }
      const off = t.offsetLeft + (parseFloat(t.style.translate) || 0) + face.offsetLeft;
      const a = L - off, b = R - off, yy = y - face.offsetTop;
      face.style.clipPath = `path(evenodd, 'M-999 -999H999V999H-999Z M${(a + rr).toFixed(2)} ${yy.toFixed(2)}H${(b - rr).toFixed(2)}A${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 1 ${(b - rr).toFixed(2)} ${(yy + h).toFixed(2)}H${(a + rr).toFixed(2)}A${rr.toFixed(2)} ${rr.toFixed(2)} 0 0 1 ${(a + rr).toFixed(2)} ${yy.toFixed(2)}Z')`;
    }
  }

  const liftTarget = t => (following ? 1 : pressedAt != null && t - pressedAt >= LIFT_AFTER ? 1 : 0);
  const sizeTarget = t => (following ? 1 : pressedAt != null && !(releasedAt != null && t >= Math.max(pressedAt + SHRINK_AFTER, releasedAt + SHRINK_HELD)) ? 1 : 0);

  function frame() {
    const t = now();
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60);
    last = t;
    // greying back from when it starts to shrink (once let go), over 110ms
    if (pressedAt != null && releasedAt != null && !following) settleNow = Math.max(settleNow, Math.min(1, Math.max(0, (t - Math.max(pressedAt + SHRINK_AFTER, releasedAt + SHRINK_HELD)) / 110)));
    else if (pressedAt == null && lift.x < 0.01) settleNow = 0;
    // landing: long enough after the touch, and the finger gone
    if (pressedAt != null && !following && releasedAt != null && t >= Math.max(pressedAt + LAND_AFTER, releasedAt + LAND_HELD)) pressedAt = null;
    const gT = liftTarget(t), qT = sizeTarget(t), SIZE = qT ? GROW : SHRINK;
    const vRef = 0.368 * geo.slot * MOVE.w, aRef = 0.135 * MOVE.w * MOVE.w * geo.slot;
    const capH = geo.H - 2 * CAP_INSET, dropW = DROP * geo.slot;
    if (sw.x == null) sw.x = capAt(pos.x);
    if (sh.x == null) sh.x = capH;
    for (let n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n; n > 0; n--) {
      const acc = !following && to != null ? step(pos, to, MOVE, h) : 0;
      step(lift, gT, LIFT, h);
      const g = Math.max(0, Math.min(1, lift.x));
      const speed = Math.min(1, Math.abs(pos.v) / vRef);
      const slowing = pos.v === 0 ? 0 : Math.max(0, Math.min(1, -acc * Math.sign(pos.v) / aRef));
      // fast it is flatter and a touch longer; slowing, it bunches up taller
      const cap = capAt(pos.x);
      step(sw, cap + qT * (dropW - cap + geo.slot * 0.03 * speed), SIZE, h);
      step(sh, capH * (1 + g * (-0.15 * speed + 0.12 * slowing)), JELLY, h);
      speedNow = speed;
    }
    // the bar swells as the drop lifts, then settles
    const since = lastPress == null ? 1e9 : t - lastPress - 35;
    const p = since < 260 ? pulseAt(since) : 0;
    nav.style.scale = p > 0.001 ? String(1 + PULSE * p) : "";
    draw();
    const settled = pressedAt == null && !following
      && (to == null || (Math.abs(pos.x - to) < 0.2 && Math.abs(pos.v) < 3))
      && Math.abs(lift.x - gT) < 0.002 && Math.abs(lift.v) < 0.02
      && Math.abs(sw.x - capAt(pos.x)) < 0.05 && Math.abs(sw.v) < 1 && Math.abs(sh.x - (geo.H - 2 * CAP_INSET)) < 0.05 && Math.abs(sh.v) < 1
      && p <= 0.001;
    if (settled) {
      if (to != null) pos.x = to;
      pos.v = 0; lift.x = gT; lift.v = 0; sw.x = sh.x = null; sw.v = sh.v = 0; speedNow = 0; settleNow = 0;
      nav.style.scale = "";
      draw();
      loop = 0; last = 0;
      return;
    }
    loop = requestAnimationFrame(frame);
  }
  const run = () => {
    if (!geo) layout();
    if (!geo) return;
    if (reduced()) {
      if (to != null) pos.x = to;
      pos.v = 0; lift.x = following ? 1 : 0; lift.v = 0; sw.x = sh.x = null; sw.v = sh.v = 0;
      nav.style.scale = "";
      draw();
      return;
    }
    if (!loop) { last = 0; loop = requestAnimationFrame(frame); }
  };
  const aim = i => {
    if (!geo) layout();
    if (!geo || i < 0) return;
    const c = geo.centres[i];
    if (pos.x == null) pos.x = c;
    to = c;
  };

  return {
    layout() { layout(); draw(); },
    // placed under a tab with no movement (first draw, a resize, unfolding)
    place(i) {
      cancelAnimationFrame(loop); loop = 0; last = 0;
      layout();
      hidden = i < 0; pressedAt = releasedAt = null; following = false;
      if (i >= 0 && geo) to = pos.x = geo.centres[i];
      pos.v = 0; lift.x = lift.v = 0; sw.x = sh.x = null; sw.v = sh.v = 0;
      nav.style.scale = "";
      draw();
    },
    // a finger down on a tab: off it goes, lifting into the drop on the way
    press(i) {
      hidden = false; following = false; settleNow = 0;
      pressedAt = lastPress = now(); releasedAt = null;
      aim(i); run();
    },
    // held and slid: the drop follows the finger exactly, keeping its speed
    follow(x) {
      if (!geo) layout();
      if (!geo) return;
      hidden = false;
      const t = now(), nx = clampX(x);
      if (following && pos.x != null && followT) pos.v = pos.v * 0.4 + ((nx - pos.x) / Math.max(0.008, (t - followT) / 1000)) * 0.6;
      else pos.v = 0;
      followT = t;
      following = true;
      if (pressedAt == null) pressedAt = lastPress = t;
      pos.x = nx; to = nx;
      run();
    },
    // the finger lifted: to tab i (or where it was going), landing on time
    release(i) {
      following = false; followT = 0;
      releasedAt = now();
      if (i != null) aim(i);
      run();
    },
    // the selected tab changed — by a tap, a slide, or the app itself (then
    // the capsule just moves, without lifting)
    select(i) {
      if (i < 0) { hidden = true; draw(); return; }
      hidden = false;
      rim?.build(); // the open tab's icon is filled now
      if (pos.x == null) { this.place(i); return; }
      aim(i); run();
    },
    hide() { hidden = true; pressedAt = null; following = false; cancelAnimationFrame(loop); loop = 0; lift.x = lift.v = 0; sw.x = sh.x = null; sw.v = sh.v = 0; nav.style.scale = ""; draw(); },
    redraw: draw,
    destroy() {
      cancelAnimationFrame(loop); loop = 0;
      theme?.disconnect();
      nav.style.scale = "";
      for (const t of tabs()) { t.style.translate = ""; const face = t.querySelector(".btb-face"); if (face) face.style.clipPath = ""; }
    },
  };
}
