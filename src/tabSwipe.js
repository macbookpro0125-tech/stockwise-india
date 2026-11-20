// Swiping between a company's tabs on a phone (20 Nov 2026, the owner: "when
// I swipe from Overview it should go to Business"). A quick, mostly sideways
// swipe on the page moves one tab; not one that starts on something that
// scrolls sideways itself (a chart, a wide table, a row of chips), on a form
// field or in a dialog, nor one from the screen's edge (the phone's own Back).

// 20 Nov 2026 (the owner: "only working to the left"): a thumb's swipe to the
// right curves up more than one to the left, so a swipe needs to be only a
// little more sideways than up or down (1.3×, was 2×), and a little shorter
export const SWIPE = { minDx: 60, ratio: 1.3, maxMs: 800, edge: 20 };

// the decision, apart from the page, for the tests: -1 back a tab, +1 on, 0 none
export function swipeStep({ dx, dy, ms, startX, width }) {
  if (startX < SWIPE.edge || startX > width - SWIPE.edge) return 0;
  if (ms > SWIPE.maxMs || Math.abs(dx) < SWIPE.minDx || Math.abs(dx) < SWIPE.ratio * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

// a target on something that takes sideways moves for itself
export function takesSideways(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.matches?.("input, textarea, select, canvas, [role=dialog], [data-no-swipe], .tv-lightweight-charts")) return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

// Listens on `el`; onStep(+1 | -1) on a swipe
export function watchSwipes(el, onStep) {
  let start = null;
  const down = e => {
    const t = e.touches?.[0];
    start = t && e.touches.length === 1 && !takesSideways(e.target) ? { x: t.clientX, y: t.clientY, at: performance.now() } : null;
  };
  const up = e => {
    const t = e.changedTouches?.[0];
    if (!start || !t) return;
    const step = swipeStep({ dx: t.clientX - start.x, dy: t.clientY - start.y, ms: performance.now() - start.at, startX: start.x, width: window.innerWidth });
    start = null;
    if (step && !window.getSelection?.()?.toString()) onStep(step);
  };
  const cancel = () => { start = null; };
  el.addEventListener("touchstart", down, { passive: true });
  el.addEventListener("touchend", up, { passive: true });
  el.addEventListener("touchcancel", cancel, { passive: true });
  return () => { el.removeEventListener("touchstart", down); el.removeEventListener("touchend", up); el.removeEventListener("touchcancel", cancel); };
}
