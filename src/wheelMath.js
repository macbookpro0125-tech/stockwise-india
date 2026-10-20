// The arithmetic of the scroll wheel (WheelPicker.jsx), an iPhone-style
// picker: rows on a drum, the middle one chosen.
const r3 = v => Math.round(v * 1000) / 1000 + 0; // + 0: no -0

// The row in the middle of the wheel, from how far it has scrolled
export function indexAt(scrollTop, rowHeight, count) {
  if (!(count > 0) || !(rowHeight > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / rowHeight)));
}

// How a row looks at `distance` rows from the middle (a fraction while it
// scrolls): it tips away on the drum, shrinks a little and fades — but never
// past 72°, and never fainter than 0.12
export function rowLook(distance) {
  const d = Math.max(-4, Math.min(4, distance));
  return {
    opacity: r3(Math.max(0.12, 1 - Math.abs(d) * 0.3)),
    rotate: r3(-Math.max(-72, Math.min(72, d * 18))),
    scale: r3(1 - Math.min(Math.abs(d), 3) * 0.07),
  };
}

// Where a key moves the wheel to, or null for keys that aren't the wheel's
const PAGE = 4;
export function stepIndex(index, key, count) {
  const to = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: count - 1, PageDown: index + PAGE, PageUp: index - PAGE }[key];
  return to == null ? null : Math.min(count - 1, Math.max(0, to));
}

// A mouse wheel's click (lines in Firefox, ~100–120px elsewhere) moves the
// wheel one row, as a real picker does; a trackpad's small deltas (0 here)
// are left to scroll natively and snap
export function notchStep(deltaY, deltaMode) {
  if (!deltaY) return 0;
  if (deltaMode === 1 || deltaMode === 2 || Math.abs(deltaY) >= 40) return Math.sign(deltaY);
  return 0;
}
