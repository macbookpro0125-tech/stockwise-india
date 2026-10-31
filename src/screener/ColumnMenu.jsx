import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ArrowUp, ArrowDown, X, ArrowLeft, ArrowRight, ArrowLeftToLine, ArrowRightToLine, Trash2 } from "lucide-react";
import { formatInput, unitLabel } from "./meta.js";
import { Definition } from "./MetricInfo.jsx";

// A column's ▾ menu on Discover's table, as Excel's filter button: sort the
// column either way, or keep only rows whose value is at least / at most a
// number. The number filter is the same filter the sidebar edits, so the two
// agree and the server screens it as before. Opens under the button, fixed
// to the window so the table's scrolling box can't clip it.

function parse(text) {
  const t = String(text).trim().replace(/[,₹%x\s]/gi, "");
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined; // undefined: not a number
}

// about: the column's metric, whose definition and period head the menu (the
// ⓘ that used to sit beside every header now lives here)
export default function ColumnMenu({ anchor, label, text = false, def, about = null, meta = null, filter, onSort, onApply, onClose, column = null }) {
  const [at, setAt] = useState(null);
  const [min, setMin] = useState(def ? formatInput(def, filter?.min) : "");
  const [max, setMax] = useState(def ? formatInput(def, filter?.max) : "");
  const [bad, setBad] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect(), width = about ? 300 : 248;
    setAt({ left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), top: r.bottom + 6, width });
  }, [anchor]);

  // Closes on Escape, a click elsewhere, or when the page moves under it
  useEffect(() => {
    const away = e => { if (!ref.current?.contains(e.target) && !anchor.contains(e.target)) onClose(); };
    const key = e => { if (e.key === "Escape") { onClose(); anchor.focus(); } };
    const moved = e => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);
  useEffect(() => { ref.current?.querySelector("button")?.focus(); }, [at]);

  const apply = e => {
    e.preventDefault();
    const lo = parse(min), hi = parse(max);
    if (lo === undefined || hi === undefined) { setBad(true); return; }
    onApply(lo, hi);
    onClose();
  };
  const unit = def ? unitLabel(def) : "";
  const filtered = filter && (filter.min != null || filter.max != null);
  const item = { display: "flex", alignItems: "center", gap: 8, width: "100%", height: 34, padding: "0 10px", border: 0, borderRadius: 6, background: "none", color: "var(--t1)", fontSize: 13, fontFamily: "inherit", cursor: "pointer", textAlign: "left" };
  const box = { width: "100%", height: 34, fontSize: 13, padding: "0 8px" };

  if (!at) return null;
  return (
    <div ref={ref} role="dialog" aria-label={`${label}: sort and filter`} className="column-menu"
      onClick={e => e.stopPropagation()}
      style={{ position: "fixed", left: at.left, top: at.top, width: at.width, zIndex: 300, padding: 6, borderRadius: 10, background: "var(--s3)", border: "1px solid var(--bdr2)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", textAlign: "left", fontWeight: 400, cursor: "default", whiteSpace: "normal" }}>
      {/* The column itself (31 Oct 2026): its name with 🗑 to take it off,
          and the period it shows where the measure has several */}
      {column && (
        <div className="cm-head">
          <strong>{column.name}</strong>
          {column.onRemove && (
            <button type="button" className="cm-trash" aria-label={`Remove the ${column.name} column`} title="Remove this column" onClick={() => { column.onRemove(); onClose(); }}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
          {column.periods && (
            <select className="cm-period" aria-label="Period" value={column.current} onChange={e => { column.onPeriod(e.target.value); onClose(); }}>
              {column.periods.map(([id, words]) => <option key={id} value={id}>{words}</option>)}
            </select>
          )}
        </div>
      )}
      {about && (
        <div style={{ padding: "8px 10px 10px", marginBottom: 4, borderBottom: "1px solid var(--bdr2)" }}>
          <Definition def={about} meta={meta} titled={!column} short />
        </div>
      )}
      <button type="button" className="column-menu-item" style={item} onClick={() => { onSort("asc"); onClose(); }}>
        <ArrowUp size={14} aria-hidden="true" /> {text ? "Sort A to Z" : "Sort smallest to largest"}
      </button>
      <button type="button" className="column-menu-item" style={item} onClick={() => { onSort("desc"); onClose(); }}>
        <ArrowDown size={14} aria-hidden="true" /> {text ? "Sort Z to A" : "Sort largest to smallest"}
      </button>

      {column?.onStep && (
        <div style={{ borderTop: "1px solid var(--bdr2)", marginTop: 6, paddingTop: 6 }}>
          {[["left", "Move left", ArrowLeft, column.first], ["right", "Move right", ArrowRight, column.last],
            ["start", "Move to the start", ArrowLeftToLine, column.first], ["end", "Move to the end", ArrowRightToLine, column.last]].map(([where, words, Icon, off]) => (
            <button key={where} type="button" className="column-menu-item" style={{ ...item, opacity: off ? 0.4 : 1, cursor: off ? "default" : "pointer" }} disabled={off}
              onClick={() => { column.onStep(where); onClose(); }}>
              <Icon size={14} aria-hidden="true" /> {words}
            </button>
          ))}
        </div>
      )}

      {def && (
        <form onSubmit={apply} style={{ borderTop: "1px solid var(--bdr2)", marginTop: 6, padding: "10px 6px 4px" }}>
          <div style={{ fontSize: 12, fontWeight: 400, color: "var(--t2)", marginBottom: 8 }}>
            Filter {label}{unit ? <span style={{ fontWeight: 400, color: "var(--t3)" }}> ({unit})</span> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>
              At least
              <input className="input-base" inputMode="decimal" value={min} onChange={e => { setMin(e.target.value); setBad(false); }} placeholder="No limit" style={{ ...box, marginTop: 3 }} />
            </label>
            <label style={{ fontSize: 11, color: "var(--t3)" }}>
              At most
              <input className="input-base" inputMode="decimal" value={max} onChange={e => { setMax(e.target.value); setBad(false); }} placeholder="No limit" style={{ ...box, marginTop: 3 }} />
            </label>
          </div>
          {bad && <div role="alert" style={{ fontSize: 11, color: "var(--red)", marginBottom: 6 }}>Numbers only, please.</div>}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
            {filtered && (
              <button type="button" className="btn-ghost" onClick={() => { onApply(null, null); onClose(); }} style={{ height: 30, fontSize: 12, marginRight: "auto" }}>
                <X size={13} aria-hidden="true" /> Clear filter
              </button>
            )}
            <button type="submit" className="btn-primary" style={{ height: 30, padding: "0 14px", fontSize: 12 }}>Apply</button>
          </div>
        </form>
      )}
    </div>
  );
}
