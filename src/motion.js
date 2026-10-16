import { useState, useEffect, useRef } from "react";

// Small motion helpers for Discover's first page: reveal on scroll, numbers
// that count up, and a check for people who asked their system for less
// motion — for them everything shows in its final state at once.

export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// true once the element has come into view (and stays true)
export function useInView(options = { rootMargin: "0px 0px -8% 0px" }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => reducedMotion() || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, options);
    io.observe(ref.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);
  return [ref, seen];
}

// Counts from 0 to target once `run` turns true (ease-out, ~0.9 s)
export function useCountUp(target, run = true, ms = 900) {
  const [v, setV] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (target == null) return;
    if (!run) return;
    if (reducedMotion()) { setV(target); return; }
    let frame, start;
    const step = t => {
      start ??= t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, run, ms]);
  // less motion: the figure itself, from the first render it's known (the
  // state above only catches up after that render, and is null till then)
  return target == null ? null : reducedMotion() ? target : v;
}

// Ties an element's look to the scroll, 1:1 and every frame (no easing lag,
// so it can never fall behind or be "interrupted"): `apply(el, p)` gets p
// from 0 (the element's top at the bottom of the window) to 1 (its top
// `span` of the window higher up). Writes styles directly — no re-renders.
export function useScrollScrub(apply, span = 0.75) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion()) { apply(el, 1); return; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight || 1;
      const top = el.getBoundingClientRect().top;
      apply(el, Math.min(1, Math.max(0, (vh - top) / (vh * span))));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

// An element's distance from the top of the page, ignoring transforms — so a
// section still sliding in (scroll-linked reveal) is measured where it will
// settle, not where it is drawn this frame
export function docTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}
