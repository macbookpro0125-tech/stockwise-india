import { useState } from "react";

export default function Header({ tab, onTab, onLogout, onSearch }) {
  const [q, setQ] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const symbol = q.trim().toUpperCase();
    if (symbol) { onSearch(symbol); setQ(""); }
  };

  return (
    <div style={{ borderBottom: "1px solid var(--bdr)", background: "var(--s1)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => onTab("discover")}>
          <img src="/stockwise-india-icon.svg" alt="" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>
            Stock<span style={{ color: "var(--brand-wise)" }}>wise</span>{" "}
            <span style={{ color: "var(--t3)", fontWeight: 500 }}>India</span>
          </h1>
        </div>

        <form onSubmit={submit} style={{ flex: 1, maxWidth: 320, minWidth: 160 }}>
          <input placeholder="Search NSE symbol (e.g. TCS)" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%" }} />
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[["discover", "Discover"], ["alerts", "Alerts"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onTab(key)}
              style={{
                border: "none",
                background: tab === key ? "var(--s3)" : "transparent",
                color: tab === key ? "var(--t1)" : "var(--t2)",
              }}
            >
              {label}
            </button>
          ))}
          <button className="btn-ghost" onClick={onLogout} style={{ marginLeft: 8 }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
