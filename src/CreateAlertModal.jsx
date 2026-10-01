import { useState } from "react";
import { api } from "./api.js";
import { alertsStore } from "./stores.js";

// The original's Set Alert modal (stock-screener CreateAlertModal), price
// alerts only: same default of 10% under the current price, plus one-tap
// picks for the stock's buy phases. Duplicates are refused by the server and
// the reason is shown instead of closing as if a new alert had been made.
export default function CreateAlertModal({ stock, onClose }) {
  const { symbol, name, cmp } = stock;
  const [condition, setCondition] = useState("below");
  const [threshold, setThreshold] = useState(cmp ? String(Math.round(cmp * 0.9)) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const picks = [
    ["Phase 1", stock.p1], ["Phase 2", stock.p2], ["Phase 3", stock.p3],
  ].filter(([, v]) => v > 0);

  const create = async () => {
    if (!(Number(threshold) > 0)) return;
    setBusy(true);
    setError("");
    try {
      await api.createAlert({ ticker: symbol, name, condition, threshold: Number(threshold) });
      alertsStore.refresh();
      onClose(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const label = { fontSize: 12, fontWeight: 600, color: "var(--t3)", marginBottom: 8 };
  const chip = active => ({
    height: 32, padding: "0 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
    border: `1px solid ${active ? "var(--accent)" : "var(--bdr2)"}`,
    background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "var(--s1)",
    color: active ? "var(--accent)" : "var(--t2)",
  });

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(false); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div style={{ background: "var(--s2)", border: "1px solid var(--bdr2)", borderRadius: 18, padding: 28, width: 380, maxWidth: "90vw", boxShadow: "var(--sh-lg)", animation: "fadeUp 200ms cubic-bezier(0,0,0.2,1) backwards" }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>Set Alert</div>
        <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 20 }}>
          {name || symbol}{cmp ? ` · now ₹${cmp.toLocaleString("en-IN")}` : ""}
        </div>

        <div style={label}>When the price</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setCondition("below")} style={chip(condition === "below")}>Drops to</button>
          <button onClick={() => setCondition("above")} style={chip(condition === "above")}>Rises to</button>
        </div>

        <div style={label}>Price (₹)</div>
        <input
          type="number" value={threshold} autoFocus
          onChange={e => setThreshold(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") create(); if (e.key === "Escape") onClose(false); }}
          className="input-base mono" style={{ marginBottom: 10, fontSize: 15 }}
        />
        {picks.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {picks.map(([l, v]) => (
              <button key={l} onClick={() => { setCondition("below"); setThreshold(String(v)); }} style={{ ...chip(condition === "below" && Number(threshold) === v), height: 28, fontSize: 11 }}>
                {l} ₹{v.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid var(--red-bdr)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 16, lineHeight: 1.6 }}>
          Checked against each day's closing price and shown on the Alerts tab. No email or phone notifications yet.
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={create} disabled={busy || !(Number(threshold) > 0)} className="btn-primary" style={{ flex: 1 }}>{busy ? "Saving…" : "Create alert"}</button>
          <button onClick={() => onClose(false)} className="btn-ghost" style={{ flex: 1, height: 44 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
