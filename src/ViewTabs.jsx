import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

// The table's column views in one row (31 Oct 2026): as many as fit, the
// rest behind + — the one picked always shows, in place of the last that
// fits. Widths are measured from a hidden copy of the row, again whenever
// the row's room changes.
export default function ViewTabs({ sets, current, onPick }) {
  const box = useRef(null), ruler = useRef(null), menuRef = useRef(null);
  const [fit, setFit] = useState(sets.length);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = box.current, r = ruler.current;
    if (!el || !r) return;
    const measure = () => {
      const widths = [...r.children].map(c => c.getBoundingClientRect().width);
      const room = el.getBoundingClientRect().width;
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= room) { setFit(sets.length); return; }
      const plus = 40;
      let used = 0, n = 0;
      while (n < widths.length && used + widths[n] + plus <= room) used += widths[n++];
      setFit(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sets]);

  useEffect(() => {
    if (!open) return;
    const away = e => { if (!menuRef.current?.contains(e.target) && !box.current?.querySelector(".vt-more")?.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const at = sets.findIndex(s => s.id === current);
  let shown = sets.slice(0, fit);
  if (fit < sets.length && at >= fit) shown = [...sets.slice(0, fit - 1), sets[at]];
  const rest = sets.filter(s => !shown.includes(s));
  const button = s => (
    <button key={s.id} type="button" aria-pressed={s.id === current} onClick={() => { setOpen(false); onPick(s); }}>{s.label}</button>
  );
  return (
    <div className="vt" ref={box}>
      <div className="ss-seg vt-ruler" ref={ruler} aria-hidden="true">
        {sets.map(s => <button key={s.id} type="button" tabIndex={-1}>{s.label}</button>)}
      </div>
      <div className="ss-seg" role="group" aria-label="Columns to show">
        {shown.map(button)}
        {rest.length > 0 && (
          <button type="button" className="vt-more" aria-haspopup="menu" aria-expanded={open} aria-label={`${rest.length} more views`} title="More views"
            onClick={() => setOpen(o => !o)}>
            <Plus size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && rest.length > 0 && (
        <div className="vt-menu" ref={menuRef} role="menu" aria-label="More views">
          {rest.map(s => (
            <button key={s.id} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(s); }}>{s.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
