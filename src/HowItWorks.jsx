import { useState, useEffect } from "react";

// The "How it works" walkthrough: a button, and the video in a popup. The
// video (public/how-it-works.webm) is recorded from the real app by
// scripts/record-demo.mjs — re-run that when the screens change. It only
// downloads when someone opens it.
export default function HowItWorks({ label = "▶ How it works", style }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)} style={{ height: 30, fontSize: 12, padding: "0 12px", ...style }}>
        {label}
      </button>
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ width: "min(1100px, 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>How Stockwise India works · 2 min</span>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost" style={{ height: 32, fontSize: 12 }}>✕ Close</button>
            </div>
            <video src="/how-it-works.webm" controls autoPlay playsInline style={{ display: "block", width: "100%", borderRadius: 12, background: "#000", aspectRatio: "16 / 10" }} />
          </div>
        </div>
      )}
    </>
  );
}
