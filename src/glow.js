// The hover glow, one for the whole app (index.css .glow): a soft accent
// light on whatever card or tile the pointer is over, sitting under the
// pointer. One listener, one frame at a time; mouse and trackpad only (a
// touch screen has no hover to show it on).
export function installGlow() {
  if (typeof window === "undefined" || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
  let frame = 0, last = null;
  document.addEventListener("pointermove", e => {
    last = e;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const el = last.target?.closest?.(".glow");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${Math.round(last.clientX - r.left)}px`);
      el.style.setProperty("--gy", `${Math.round(last.clientY - r.top)}px`);
    });
  }, { passive: true });
}
