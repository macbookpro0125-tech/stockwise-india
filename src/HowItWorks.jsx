import { useState, useEffect } from "react";
import { Play, X, ChevronRight } from "lucide-react";

// The "How it works" walkthrough: a button, and the video in a popup. The
// video (public/how-it-works.webm) is recorded from the real app by
// scripts/record-demo.mjs — re-run that when the screens change. It only
// downloads when someone opens it.
// plain: a text link with a chevron (Discover's first page), not a button
export default function HowItWorks({ label = "How it works", style, plain = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {plain ? (
        <button type="button" className="ap-link" onClick={() => setOpen(true)} style={style}>{label}<ChevronRight size={18} aria-hidden="true" /></button>
      ) : (
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)} style={{ height: 30, fontSize: 12.5, padding: "0 12px", ...style }}>
          <Play size={12} fill="currentColor" strokeWidth={0} /> {label}
        </button>
      )}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 150ms cubic-bezier(0.23, 1, 0.32, 1) backwards" }}
        >
          <div style={{ width: "min(1100px, 100%)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 400, color: "#fff" }}>How Jocular Insights works · 2 min</span>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ height: 32, fontSize: 12.5 }}><X size={14} /> Close</button>
            </div>
            <video src="/how-it-works.webm" controls autoPlay playsInline style={{ display: "block", width: "100%", borderRadius: 12, background: "#000", aspectRatio: "16 / 10" }} />
          </div>
        </div>
      )}
    </>
  );
}
