import { useState } from "react";
import { useWatchlist } from "./watchlist.js";

export default function Header({ tab, onTab, onLogout, onSearch }) {
  const [q, setQ] = useState("");
  const watchCount = useWatchlist().size;

  const submit = (e) => {
    e.preventDefault();
    const symbol = q.trim().toUpperCase();
    if (symbol) { onSearch(symbol); setQ(""); }
  };

  return (
    <div className="app-header" style={{ borderBottom: "1px solid var(--bdr)", background: "var(--s1)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onTab("discover")}>
          <img src="/stockwise-india-icon.svg" alt="" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>
            Stock<span style={{ color: "var(--brand-wise)" }}>wise</span>{" "}
            <span style={{ color: "var(--t3)", fontWeight: 500 }}>India</span>
          </h1>
        </div>

        <form onSubmit={submit} style={{ flex: 1, maxWidth: 360, minWidth: 160, position: "relative" }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--t3)", pointerEvents: "none" }}>⌕</span>
          <input placeholder="Search NSE symbol (e.g. TCS)" value={q} onChange={e => setQ(e.target.value)} className="input-base" style={{ paddingLeft: 34, height: 38 }} />
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[["discover", "Discover"], ["watchlist", "Watchlist", watchCount], ["alerts", "Alerts"]].map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => onTab(key)}
              style={{
                height: 34, padding: "0 14px", borderRadius: 9,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
                background: tab === key ? "rgba(0,224,190,0.1)" : "transparent",
                color: tab === key ? "var(--accent)" : "var(--t2)",
                transition: "all 150ms",
              }}
            >
              {label}
              {count > 0 && (
                <span className="mono" style={{ fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 999, lineHeight: "16px", background: "var(--accent)", color: "#07070E" }}>
                  {count}
                </span>
              )}
            </button>
          ))}
          <button className="btn-ghost" onClick={onLogout} style={{ marginLeft: 8, height: 34, fontSize: 12, whiteSpace: "nowrap" }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
