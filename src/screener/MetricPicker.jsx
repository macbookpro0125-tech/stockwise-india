import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Pick metrics to filter on, or to show as columns: a search box, the
// categories, and the list. Several can be added before closing.
export default function MetricPicker({ meta, mode, chosen, onToggle, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sector has its own box in the filter panel; the table shows it under
  // each company's name
  const all = meta.metrics;
  const text = q.trim().toLowerCase();
  const list = all.filter(x => x && (text
    ? `${x.label} ${x.short ?? ""} ${x.about ?? ""} ${x.category}`.toLowerCase().includes(text)
    : cat === "All" || x.category === cat));
  const categories = ["All", ...meta.categories.filter(c => all.some(x => x?.category === c))];

  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div role="dialog" aria-label={mode === "filter" ? "Add filters" : "Choose columns"}
        style={{ width: "min(760px, 100%)", height: "min(620px, 100%)", display: "flex", flexDirection: "column", background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, boxShadow: "var(--sh-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: "1px solid var(--bdr)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", margin: 0, whiteSpace: "nowrap" }}>{mode === "filter" ? "Add filters" : "Columns"}</h3>
          <input className="input-base" autoFocus placeholder={`Search ${all.length} metrics — e.g. ROCE, dividend, return`} value={q} onChange={e => setQ(e.target.value)} style={{ height: 36, fontSize: 13, flex: 1, minWidth: 0 }} />
          <button type="button" className="btn-primary" onClick={onClose} style={{ height: 36, padding: "0 16px", fontSize: 13, boxShadow: "none" }}>Done</button>
        </div>

        <div className="picker-body" style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {!text && (
            <nav className="picker-cats" style={{ width: 180, flexShrink: 0, borderRight: "1px solid var(--bdr)", padding: 8, overflowY: "auto" }}>
              {categories.map(c => (
                <button key={c} type="button" onClick={() => setCat(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 13, cursor: "pointer", background: c === cat ? "var(--s3)" : "transparent", color: c === cat ? "var(--t1)" : "var(--t2)", fontWeight: c === cat ? 600 : 500 }}>
                  {c}
                </button>
              ))}
            </nav>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {list.length === 0 && <p style={{ fontSize: 13, color: "var(--t3)", padding: 12 }}>Nothing matches "{q}".</p>}
            {list.map(x => {
              const on = chosen.has(x.id);
              return (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 10, borderBottom: "1px solid var(--bdr)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)" }}>
                      {x.label}
                      {(text || cat === "All") && <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t3)", marginLeft: 8 }}>{x.category}</span>}
                    </div>
                    {x.about && <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.45, marginTop: 2 }}>{x.about}</div>}
                  </div>
                  <button type="button" onClick={() => onToggle(x.id)} aria-pressed={on}
                    style={{ flexShrink: 0, height: 30, minWidth: 84, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--bdr2)"}`, background: on ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent", color: on ? "var(--accent)" : "var(--t2)" }}>
                    {on ? "✓ Added" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
