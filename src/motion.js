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
  return target == null ? null : v;
}
