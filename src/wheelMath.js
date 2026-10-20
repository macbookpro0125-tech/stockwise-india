// The arithmetic of the scroll wheel (WheelPicker.jsx), an iPhone-style
// picker: rows on a drum, the middle one chosen.
const r3 = v => Math.round(v * 1000) / 1000 + 0; // + 0: no -0

// The row in the middle of the wheel, from how far it has scrolled
export function indexAt(scrollTop, rowHeight, count) {
  if (!(count > 0) || !(rowHeight > 0)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollTop / rowHeight)));
}

// How a row looks at `distance` rows from the middle (a fraction while it
// scrolls), on a drum like the iPhone's picker: the rows sit on a cylinder,
// each a fixed turn (about 41°) from the next, so away from the middle they
// squeeze in height (cos) and bunch toward it (sin) — upright, not tilted,
// so text never slants. 2.2 rows out the drum turns away (90°): one row
// clear above and below, slivers past them.
const TURN = Math.PI / 2 / 2.2;
export function rowLook(distance, rowHeight = 40) {
  const angle = distance * TURN;
  if (Math.abs(angle) >= Math.PI / 2) return { opacity: 0, y: r3(Math.sign(distance) * (rowHeight / TURN) - distance * rowHeight), scaleY: 0 };
  const radius = rowHeight / TURN;
  const c = Math.cos(angle);
  return { opacity: r3(Math.pow(c, 1.6)), y: r3(radius * Math.sin(angle) - distance * rowHeight), scaleY: r3(c) };
}
// The drum's height on screen: its diameter, plus half a row for the edges
export const drumHeight = rowHeight => Math.round((2 * rowHeight) / TURN + rowHeight / 2);

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
