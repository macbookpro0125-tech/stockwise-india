import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { indexAt, rowLook, stepIndex, notchStep, drumHeight } from "./wheelMath.js";

// An iPhone-style scroll wheel (asked for 20 Oct 2026, from the clock app's
// time picker): rows on a drum, the middle one on a pill is the choice. The
// rows squeeze and bunch toward the edges as on a cylinder, upright (a 3D
// tilt slanted wide text like italics).
// A mouse wheel moves it one row per click; a trackpad scrolls it freely and
// it snaps to a row; or click a row, or use the arrow keys, Home, End and
// Page Up/Down.
//
//   items     [{ id, label }], in order
//   value     the chosen id; when it changes from outside the wheel turns to
//             it without calling onChange
//   onChange  (id) => …, once the wheel settles on another row — not for
//             every row it passes while spinning
//   label     its name for screen readers ("Strategy")
//   rowHeight px; the drum is about 3.3 rows tall
//   className for a look of its own (Discover's title-sized "wheel-title")
const SETTLE_MS = 140;

export default function WheelPicker({ items, value, onChange, label, rowHeight = 40, className = "" }) {
  const scroller = useRef(null);
  const rows = useRef([]);
  const quiet = useRef(false);
  const timer = useRef(0);
  // Where clicks of a mouse wheel are taking it, while they come quickly
  const target = useRef(null);
  const frame = useRef(0);
  const id = useId();
  const chosen = Math.max(0, items.findIndex(i => i.id === value));
  const [middle, setMiddle] = useState(chosen);
  const height = drumHeight(rowHeight);
  const pad = (height - rowHeight) / 2;

  // Each row's face squeezes, bunches and fades with its distance from the
  // middle. The face moves, never the row: the rows are where the scroll
  // snaps, and moving them shifted the snap points mid-scroll (it stopped
  // short)
  const paint = () => {
    const el = scroller.current;
    if (!el) return;
    const at = el.scrollTop / rowHeight;
    rows.current.forEach((row, i) => {
      if (!row) return;
      const { opacity, y, scaleY } = rowLook(i - at, rowHeight);
      row.style.opacity = opacity;
      row.style.transform = `translateY(${y}px) scaleY(${scaleY})`;
    });
    setMiddle(indexAt(el.scrollTop, rowHeight, items.length));
  };

  // Turn to the value given from outside, without reporting it back
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const top = chosen * rowHeight;
    if (Math.abs(el.scrollTop - top) > 1) { quiet.current = true; el.scrollTop = top; }
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, items.length, rowHeight]);

  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(frame.current); }, []);

  const settle = () => {
    const el = scroller.current;
    if (!el) return;
    target.current = null;
    if (quiet.current) { quiet.current = false; return; }
    const item = items[indexAt(el.scrollTop, rowHeight, items.length)];
    if (item && item.id !== value) onChange(item.id);
  };
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(paint);
    clearTimeout(timer.current);
    timer.current = setTimeout(settle, SETTLE_MS);
  };
  const turnTo = i => {
    quiet.current = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scroller.current?.scrollTo({ top: i * rowHeight, behavior: reduced ? "auto" : "smooth" });
  };
  // A mouse wheel's clicks, one row each (React's onWheel can't stop the
  // page scrolling, so it's a listener of our own)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = e => {
      const step = notchStep(e.deltaY, e.deltaMode);
      if (!step) return;
      e.preventDefault();
      const from = target.current ?? indexAt(el.scrollTop, rowHeight, items.length);
      target.current = Math.min(items.length - 1, Math.max(0, from + step));
      turnTo(target.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, rowHeight]);
  const onKeyDown = e => {
    const to = stepIndex(middle, e.key, items.length);
    if (to == null) return;
    e.preventDefault();
    turnTo(to);
  };

  return (
    <div className={`wheel ${className}`} style={{ height }}>
      <div className="wheel-pill" aria-hidden="true" style={{ top: pad, height: rowHeight }} />
      <div ref={scroller} className="wheel-scroll" role="listbox" aria-label={label} tabIndex={0}
        aria-activedescendant={items.length ? `${id}-${middle}` : undefined} onScroll={onScroll} onKeyDown={onKeyDown}>
        <div style={{ height: pad }} aria-hidden="true" />
        {items.map((item, i) => (
          <div key={item.id} id={`${id}-${i}`} role="option" aria-selected={i === middle}
            className={`wheel-row${i === middle ? " on" : ""}`} style={{ height: rowHeight }} title={item.label} onClick={() => turnTo(i)}>
            <span className="wheel-face" ref={el => { rows.current[i] = el; }}>{item.label}</span>
          </div>
        ))}
        <div style={{ height: pad }} aria-hidden="true" />
      </div>
    </div>
  );
}
